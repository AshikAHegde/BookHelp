require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { PDFLoader } = require("@langchain/community/document_loaders/fs/pdf");
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { Pinecone } = require("@pinecone-database/pinecone");

const GEMINI_EMBEDDING_MODEL = "models/gemini-embedding-001";
const EMBEDDING_DIMENSION = 1024;

// Adjust this offset based on where Page 1 of the printed book starts in the PDF file
const PAGE_OFFSET = 10;

// --- Rate limiting / resilience knobs -------------------------------------
const BATCH_SIZE = 10;              // smaller batches = fewer chunks lost per failed request
const DELAY_BETWEEN_BATCHES_MS = 4000; // pause between batches so you don't hammer the API
const MAX_RETRIES = 6;              // per-batch retry attempts on failure
const BASE_BACKOFF_MS = 2000;       // starting backoff, doubles each retry
const PROGRESS_FILE = path.join(__dirname, "vectorize-progress.json");
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadProgress() {
  try {
    const raw = fs.readFileSync(PROGRESS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { lastCompletedBatch: -1 };
  }
}

function saveProgress(batchIndex) {
  fs.writeFileSync(
    PROGRESS_FILE,
    JSON.stringify({ lastCompletedBatch: batchIndex }, null, 2)
  );
}

// Helper function to map printed page numbers to textbook chapters and units
function getChapterMetadata(pageNum) {
  if (pageNum >= 97) return { chapter: "Glossary", area: "Reference", chapterName: "Glossary" };
  if (pageNum >= 88) return { chapter: "12", area: "Human Geography", chapterName: "Tourism" };
  if (pageNum >= 82) return { chapter: "11", area: "Human Geography", chapterName: "Transport and Communication" };
  if (pageNum >= 75) return { chapter: "10", area: "Human Geography", chapterName: "Urbanisation" };
  if (pageNum >= 67) return { chapter: "9", area: "Human Geography", chapterName: "Trade" };
  if (pageNum >= 64) return { chapter: "8", area: "Human Geography", chapterName: "Introduction to Economics" };
  if (pageNum >= 57) return { chapter: "7", area: "General Geography", chapterName: "International Date Line" };
  if (pageNum >= 50) return { chapter: "6", area: "Physical Geography", chapterName: "The Properties of Sea Water" };
  if (pageNum >= 41) return { chapter: "5", area: "Physical Geography", chapterName: "Precipitation" };
  if (pageNum >= 30) return { chapter: "4", area: "Physical Geography", chapterName: "Exogenetic Processes Part-2" };
  if (pageNum >= 23) return { chapter: "3", area: "Physical Geography", chapterName: "Exogenetic Processes Part-1" };
  if (pageNum >= 9) return { chapter: "2", area: "Physical Geography", chapterName: "Endogenetic Movements" };
  if (pageNum >= 1) return { chapter: "1", area: "Practical Geography", chapterName: "Distributional Maps" };
  return { chapter: "Prelims", area: "Front Matter", chapterName: "Introduction & Index" };
}

// Detect if an error looks like a rate-limit / quota error worth retrying
function isRetryableError(err) {
  const msg = String(err && err.message ? err.message : err);
  return (
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("503") ||
    msg.includes("overloaded")
  );
}

// Wraps any async function with exponential backoff + jitter retries
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
        `[${label}] retryable error (attempt ${attempt}/${MAX_RETRIES}): ${err.message}. Waiting ${Math.round(waitMs / 1000)}s before retry...`
      );
      await sleep(waitMs);
    }
  }
}

// Your Gemini Embedding Function
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
    // Surface status code clearly so isRetryableError can catch it
    throw new Error(`Embedding API failed: ${response.status} ${bodyText}`);
  }

  const data = await response.json();
  return (data.embeddings ?? []).map((embedding) => embedding.values ?? []);
}

// Main execution function
async function vectorizeBook() {
  try {
    // 1. Initialize Pinecone client
    const pc = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
    const index = pc.Index(process.env.PINECONE_INDEX_NAME);

    console.log("Loading PDF...");
    const pdfPath = path.join(__dirname, "geo.pdf");
    const loader = new PDFLoader(pdfPath);
    const docs = await loader.load();

    console.log("Chunking text...");
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const chunks = await splitter.splitDocuments(docs);
    console.log(`Generated ${chunks.length} chunks.`);

    const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);

    // Resume support: skip batches already completed in a previous run
    const progress = loadProgress();
    const startBatch = progress.lastCompletedBatch + 1;
    if (startBatch > 0) {
      console.log(`Resuming from batch ${startBatch + 1} of ${totalBatches} (found existing progress file).`);
    }

    for (let batchIdx = startBatch; batchIdx < totalBatches; batchIdx++) {
      const i = batchIdx * BATCH_SIZE;
      const batchChunks = chunks.slice(i, i + BATCH_SIZE);

      console.log(`Processing batch ${batchIdx + 1} of ${totalBatches}...`);

      const texts = batchChunks.map((chunk) => chunk.pageContent);

      // Generate embeddings, retrying on quota/rate-limit errors
      const embeddings = await withRetry(
        () => embedDocuments(texts),
        `embed batch ${batchIdx + 1}`
      );

      // Construct vectors with strict, dynamic textbook metadata
      const vectors = [];

      for (let j = 0; j < batchChunks.length; j++) {
        const chunk = batchChunks[j];
        const embedding = embeddings[j];

        if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
          console.warn(`No embedding returned for chunk ${i + j}, skipping.`);
          continue;
        }

        const rawPdfPage = chunk.metadata.loc?.pageNumber || chunk.metadata.page || 0;
        const printedPageNum = rawPdfPage > PAGE_OFFSET ? rawPdfPage - PAGE_OFFSET : 0;
        const chapterMeta = getChapterMetadata(printedPageNum);

        vectors.push({
          id: `geo-std9-page${printedPageNum}-chunk${i + j}`,
          values: embedding,
          metadata: {
            text: chunk.pageContent,
            standard: "9",
            subject: "Geography",
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
      } else {
        console.warn(`No valid vectors generated for batch ${batchIdx + 1}, skipping upsert.`);
      }

      // Mark this batch as done so a crash/quota-cutoff can resume from here
      saveProgress(batchIdx);

      // Throttle: pause before the next batch to stay under rate limits
      if (batchIdx < totalBatches - 1) {
        await sleep(DELAY_BETWEEN_BATCHES_MS);
      }
    }

    console.log("Book successfully vectorized and stored in Pinecone!");
    // Clean up progress file on full success
    if (fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
  } catch (error) {
    console.error("Error during vectorization process:", error);
    console.error(
      "Progress has been saved — rerun the script and it will resume from the last completed batch instead of starting over."
    );
    process.exit(1);
  }
}

// Run the script
vectorizeBook();