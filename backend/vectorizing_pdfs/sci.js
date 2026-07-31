require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { PDFLoader } = require("@langchain/community/document_loaders/fs/pdf");
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { Pinecone } = require("@pinecone-database/pinecone");

const GEMINI_EMBEDDING_MODEL = "models/gemini-embedding-001";
const EMBEDDING_DIMENSION = 1024;

// PDF page 11 corresponds to Printed Page 1 -> Offset is 10
const PAGE_OFFSET = 10;

// --- Rate limiting & Resilience settings -----------------------------------
const BATCH_SIZE = 10;                 // Safe batch size
const DELAY_BETWEEN_BATCHES_MS = 3000; // Throttle to prevent hitting 429 rate limits
const MAX_RETRIES = 6;                 // Per-batch retries
const BASE_BACKOFF_MS = 2000;          // Backoff delay starts at 2s and doubles
const PROGRESS_FILE = path.join(__dirname, "vectorize-science-progress.json");
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
 * Maps printed page numbers to textbook chapters, titles, and unit domains.
 */
function getChapterMetadata(pageNum) {
    if (pageNum >= 209) return { chapter: "18", area: "Space Science", chapterName: "Observing Space : Telescopes" };
    if (pageNum >= 194) return { chapter: "17", area: "Biology", chapterName: "Introduction to Biotechnology" };
    if (pageNum >= 179) return { chapter: "16", area: "Biology", chapterName: "Heredity and Variation" };
    if (pageNum >= 163) return { chapter: "15", area: "Biology", chapterName: "Life Processes in Living Organisms" };
    if (pageNum >= 150) return { chapter: "14", area: "Chemistry", chapterName: "Substances in Common Use" };
    if (pageNum >= 138) return { chapter: "13", area: "Chemistry", chapterName: "Carbon : An important element" };
    if (pageNum >= 128) return { chapter: "12", area: "Physics", chapterName: "Study of Sound" };
    if (pageNum >= 115) return { chapter: "11", area: "Physics", chapterName: "Reflection of Light" };
    if (pageNum >= 108) return { chapter: "10", area: "ICT", chapterName: "Information Communication Technology (ICT)" };
    if (pageNum >= 96) return { chapter: "9", area: "Environmental Science", chapterName: "Environmental Management" };
    if (pageNum >= 88) return { chapter: "8", area: "Biology", chapterName: "Useful and Harmful Microbes" };
    if (pageNum >= 81) return { chapter: "7", area: "Environmental Science", chapterName: "Energy Flow in an Ecosystem" };
    if (pageNum >= 75) return { chapter: "6", area: "Biology", chapterName: "Classification of Plants" };
    if (pageNum >= 58) return { chapter: "5", area: "Chemistry", chapterName: "Acids, Bases and Salts" };
    if (pageNum >= 46) return { chapter: "4", area: "Chemistry", chapterName: "Measurement of Matter" };
    if (pageNum >= 30) return { chapter: "3", area: "Physics", chapterName: "Current Electricity" };
    if (pageNum >= 18) return { chapter: "2", area: "Physics", chapterName: "Work and Energy" };
    if (pageNum >= 1) return { chapter: "1", area: "Physics", chapterName: "Laws of Motion" };

    return { chapter: "Prelims", area: "Front Matter", chapterName: "Preface & Contents" };
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

async function vectorizeScienceBook() {
    try {
        if (!process.env.GEMINI_API_KEY || !process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX_NAME) {
            throw new Error("Missing required environment variables in .env file!");
        }

        const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        const index = pc.Index(process.env.PINECONE_INDEX_NAME);

        const pdfPath = path.join(__dirname, "sc.pdf");
        if (!fs.existsSync(pdfPath)) {
            throw new Error(`File not found: ${pdfPath}`);
        }

        console.log("Loading Science PDF (sc.pdf)...");
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

                // Edge case: Validate embedding response structure
                if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
                    console.warn(`Missing embedding vector for chunk index ${i + j}, skipping.`);
                    continue;
                }

                // Safe PDF Page Extraction Edge Case
                const rawPdfPage = chunk.metadata.loc?.pageNumber ?? chunk.metadata.page ?? 0;
                const printedPageNum = rawPdfPage > PAGE_OFFSET ? rawPdfPage - PAGE_OFFSET : 0;
                const chapterMeta = getChapterMetadata(printedPageNum);

                vectors.push({
                    id: `sci-std9-p${printedPageNum}-c${i + j}`,
                    values: embedding,
                    metadata: {
                        text: chunk.pageContent,
                        standard: "9",
                        subject: "Science and Technology",
                        board: "Maharashtra State Board",
                        medium: "English",
                        language: "English",
                        year: "2026",
                        page: printedPageNum,
                        unit: chapterMeta.area,
                        chapter_number: chapterMeta.chapter,
                        chapter_name: chapterMeta.chapterName,
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

        console.log("Science textbook successfully vectorized into Pinecone!");
        if (fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
    } catch (error) {
        console.error("Critical error during execution:", error);
        process.exit(1);
    }
}

vectorizeScienceBook();