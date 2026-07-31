const fs = require("fs");
const path = require("path");
const { PDFLoader } = require("@langchain/community/document_loaders/fs/pdf");
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { Pinecone } = require("@pinecone-database/pinecone");

require("dotenv").config({ path: path.join(__dirname, "../.env") });


const GEMINI_EMBEDDING_MODEL = "models/gemini-embedding-001";
const EMBEDDING_DIMENSION = 1024;

// --- Rate limiting & Resilience settings -----------------------------------
const BATCH_SIZE = 10;
const DELAY_BETWEEN_BATCHES_MS = 3000;
const MAX_RETRIES = 6;
const BASE_BACKOFF_MS = 2000;
const PROGRESS_FILE = path.join(__dirname, "vectorize-history-progress.json");
// ---------------------------------------------------------------------------

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadProgress() {
    try {
        if (fs.existsSync(PROGRESS_FILE)) {
            const raw = fs.readFileSync(PROGRESS_FILE, "utf-8");
            return JSON.parse(raw);
        }
    } catch (err) {
        console.warn("Could not read progress file, starting fresh.");
    }
    return { lastCompletedBatch: -1 };
}

function saveProgress(batchIndex) {
    try {
        fs.writeFileSync(
            PROGRESS_FILE,
            JSON.stringify({ lastCompletedBatch: batchIndex }, null, 2)
        );
    } catch (err) {
        console.warn("Failed to write progress file:", err.message);
    }
}

/**
 * Calculates printed page number and determines metadata for History and Civics.
 * 
 * Offsets:
 * - History Section (Printed Pgs 1-58):  Offset = 5  (PDF Pg = Print Pg + 5)
 * - Civics Section  (Printed Pgs 59-98): Offset = 64 (PDF Pg = Print Pg + 64)
 */
function getHistoryCivicsMetadata(rawPdfPage) {
    let printedPageNum = 0;

    // Determine printed page number based on PDF page ranges
    if (rawPdfPage > 64) {
        printedPageNum = rawPdfPage - 64; // Civics Offset
    } else if (rawPdfPage > 5) {
        printedPageNum = rawPdfPage - 5;  // History Offset
    }

    // --- CIVICS SECTION ---
    if (printedPageNum >= 93) return { printedPageNum, section: "Civics", chapter: "6", chapterName: "International Problems" };
    if (printedPageNum >= 84) return { printedPageNum, section: "Civics", chapter: "5", chapterName: "India and Other Countries" };
    if (printedPageNum >= 77) return { printedPageNum, section: "Civics", chapter: "4", chapterName: "The United Nations" };
    if (printedPageNum >= 71) return { printedPageNum, section: "Civics", chapter: "3", chapterName: "India’s Defence System" };
    if (printedPageNum >= 65) return { printedPageNum, section: "Civics", chapter: "2", chapterName: "India’s Foreign Policy" };
    if (printedPageNum >= 59) return { printedPageNum, section: "Civics", chapter: "1", chapterName: "Post World War Political Developments" };

    // --- HISTORY SECTION ---
    if (printedPageNum >= 52) return { printedPageNum, section: "History", chapter: "10", chapterName: "Changing Life : 2" };
    if (printedPageNum >= 47) return { printedPageNum, section: "History", chapter: "9", chapterName: "Changing Life : 1" };
    if (printedPageNum >= 43) return { printedPageNum, section: "History", chapter: "8", chapterName: "Industry and Trade" };
    if (printedPageNum >= 37) return { printedPageNum, section: "History", chapter: "7", chapterName: "Science and Technology" };
    if (printedPageNum >= 31) return { printedPageNum, section: "History", chapter: "6", chapterName: "Empowerment of Women and other Weaker Sections" };
    if (printedPageNum >= 23) return { printedPageNum, section: "History", chapter: "5", chapterName: "Education" };
    if (printedPageNum >= 15) return { printedPageNum, section: "History", chapter: "4", chapterName: "Economic Development" };
    if (printedPageNum >= 10) return { printedPageNum, section: "History", chapter: "3", chapterName: "India’s Internal Challenges" };
    if (printedPageNum >= 5) return { printedPageNum, section: "History", chapter: "2", chapterName: "India : Events after 1960" };
    if (printedPageNum >= 1) return { printedPageNum, section: "History", chapter: "1", chapterName: "Sources of History" };

    return { printedPageNum: 0, section: "Front Matter", chapter: "Prelims", chapterName: "Preface & Contents" };
}

function isRetryableError(err) {
    const msg = String(err && err.message ? err.message : err);
    return (
        msg.includes("429") ||
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.includes("quota") ||
        msg.includes("rate limit") ||
        msg.includes("503") ||
        msg.includes("overloaded") ||
        msg.includes("fetch failed")
    );
}

async function withRetry(fn, label) {
    let attempt = 0;
    while (true) {
        try {
            return await fn();
        } catch (err) {
            attempt++;
            if (attempt > MAX_RETRIES || !isRetryableError(err)) {
                throw err;
            }
            const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
            const jitter = Math.random() * 1000;
            const waitMs = backoff + jitter;
            console.warn(
                `[${label}] Retryable error (attempt ${attempt}/${MAX_RETRIES}): ${err.message}. Waiting ${Math.round(waitMs / 1000)}s...`
            );
            await sleep(waitMs);
        }
    }
}

async function embedDocuments(texts) {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${GEMINI_EMBEDDING_MODEL}:batchEmbedContents`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": process.env.GEMINI_API_KEY,
            },
            body: JSON.stringify({
                requests: texts.map((text) => ({
                    model: GEMINI_EMBEDDING_MODEL,
                    taskType: "RETRIEVAL_DOCUMENT",
                    outputDimensionality: EMBEDDING_DIMENSION,
                    content: {
                        parts: [{ text }],
                    },
                })),
            }),
        }
    );

    if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(`Embedding API failed: ${response.status} ${bodyText}`);
    }

    const data = await response.json();
    return (data.embeddings ?? []).map((embedding) => embedding.values ?? []);
}

async function vectorizeHistoryBook() {
    try {
        if (!process.env.GEMINI_API_KEY || !process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX_NAME) {
            throw new Error("Missing required environment variables in .env file!");
        }

        const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        const index = pc.Index(process.env.PINECONE_INDEX_NAME);

        const pdfPath = path.join(__dirname, "hc.pdf");
        if (!fs.existsSync(pdfPath)) {
            throw new Error(`File not found: ${pdfPath}`);
        }

        console.log("Loading History and Civics PDF (hc.pdf)...");
        const loader = new PDFLoader(pdfPath);
        const docs = await loader.load();

        console.log("Chunking text...");
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
        const chunks = await splitter.splitDocuments(docs);
        console.log(`Generated ${chunks.length} total chunks.`);

        const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);
        const progress = loadProgress();
        const startBatch = progress.lastCompletedBatch + 1;

        if (startBatch > 0) {
            console.log(`Resuming from batch ${startBatch + 1} of ${totalBatches}...`);
        }

        for (let batchIdx = startBatch; batchIdx < totalBatches; batchIdx++) {
            const i = batchIdx * BATCH_SIZE;
            const batchChunks = chunks.slice(i, i + BATCH_SIZE);

            console.log(`Processing batch ${batchIdx + 1} of ${totalBatches}...`);

            // Edge case: Clean empty text strings or missing content
            const texts = batchChunks.map((chunk) => chunk.pageContent.trim()).filter((t) => t.length > 0);

            if (texts.length === 0) {
                console.warn(`Batch ${batchIdx + 1} contains empty text content, skipping API call.`);
                saveProgress(batchIdx);
                continue;
            }

            const embeddings = await withRetry(
                () => embedDocuments(texts),
                `embed batch ${batchIdx + 1}`
            );

            const vectors = [];

            for (let j = 0; j < batchChunks.length; j++) {
                const chunk = batchChunks[j];
                const embedding = embeddings[j];

                if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
                    console.warn(`Missing embedding vector for chunk index ${i + j}, skipping.`);
                    continue;
                }

                // Extract PDF page number safely (1-based index usually from LangChain loader)
                const rawPdfPage = (chunk.metadata.loc?.pageNumber ?? chunk.metadata.page ?? 0) + 1;
                const meta = getHistoryCivicsMetadata(rawPdfPage);

                vectors.push({
                    id: `hc-std9-p${meta.printedPageNum}-c${i + j}`,
                    values: embedding,
                    metadata: {
                        text: chunk.pageContent,
                        standard: "9",
                        subject: meta.section === "Civics" ? "Political Science / Civics" : "History",
                        board: "Maharashtra State Board",
                        medium: "English",
                        language: "English",
                        year: "2026",
                        page: meta.printedPageNum,
                        unit: meta.section,
                        chapter_number: meta.chapter,
                        chapter_name: meta.chapterName,
                    },
                });
            }

            if (vectors.length > 0) {
                await withRetry(
                    () => index.upsert({ records: vectors }),
                    `upsert batch ${batchIdx + 1}`
                );
            }

            saveProgress(batchIdx);

            if (batchIdx < totalBatches - 1) {
                await sleep(DELAY_BETWEEN_BATCHES_MS);
            }
        }

        console.log("History & Civics textbook successfully vectorized into Pinecone!");
        if (fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
    } catch (error) {
        console.error("Critical error during execution:", error);
        process.exit(1);
    }
}

vectorizeHistoryBook();