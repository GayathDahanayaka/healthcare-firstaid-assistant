const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { PDFParse } = require("pdf-parse"); // pdf-parse v2+ uses a class, not a plain function
const { GoogleGenAI } = require("@google/genai"); // @google/generative-ai is deprecated - use @google/genai

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const EMBEDDING_MODEL = "gemini-embedding-001"; // text-embedding-004 is retired

// Free tier: ~100 embedContent requests/minute AND only ~1000/day. Large PDFs
// can produce thousands of chunks, and nodemon restarting on every file save
// would normally re-embed everything from scratch each time — burning through
// the DAILY quota fast just from development. Three fixes together solve this:
// 1. Bigger chunks (fewer total chunks to embed)
// 2. Batch several chunks into one embedContent call, with delay + retry
// 3. Cache embeddings to disk — only call the API when the source documents
//    actually change, not on every server restart
const BATCH_SIZE = 50;       // chunks embedded per API call
const DELAY_MS = 1500;       // pause between batches
const MAX_RETRIES = 4;

const CACHE_DIR = path.join(__dirname, ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "embeddings-cache.json");

let vectorStore = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fingerprints the documents folder (filenames + sizes + modified times) so
// we can detect "documents unchanged since last run" without re-reading
// full file contents every time.
function getDocsFingerprint(docsDir, files) {
  const hash = crypto.createHash("md5");
  for (const file of [...files].sort()) {
    const stat = fs.statSync(path.join(docsDir, file));
    hash.update(`${file}:${stat.size}:${stat.mtimeMs}`);
  }
  return hash.digest("hex");
}

// Embeds an array of texts in ONE request, retrying with backoff on 429s.
async function embedBatch(texts, attempt = 1) {
  try {
    const result = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: texts,
    });
    return result.embeddings.map((e) => e.values);
  } catch (err) {
    const isRateLimit = err.status === 429 || (err.message && err.message.includes("RESOURCE_EXHAUSTED"));
    if (isRateLimit && attempt <= MAX_RETRIES) {
      const waitMs = 25000; // free tier per-minute quota resets on a rolling window
      console.log(`Rate limited (attempt ${attempt}/${MAX_RETRIES}) — waiting ${waitMs / 1000}s before retry...`);
      await sleep(waitMs);
      return embedBatch(texts, attempt + 1);
    }
    throw err;
  }
}

async function embedText(text) {
  const [vector] = await embedBatch([text]);
  return vector;
}

function chunkText(text, chunkSize = 1500, overlap = 100) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end).trim());
    start += chunkSize - overlap;
  }
  return chunks.filter((c) => c.length > 30);
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function buildKnowledgeBase() {
  const docsDir = path.join(__dirname, "documents");
  const files = fs.readdirSync(docsDir).filter((f) => f.endsWith(".pdf") || f.endsWith(".txt"));
  const fingerprint = getDocsFingerprint(docsDir, files);

  // Try the cache first — skip calling the embedding API entirely if the
  // source documents haven't changed since we last embedded them.
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const cached = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
      if (cached.fingerprint === fingerprint) {
        vectorStore = cached.vectorStore;
        console.log(`Loaded ${vectorStore.length} chunks from cache (documents unchanged) — no API calls needed.`);
        return;
      }
      console.log("Source documents changed since last run — re-embedding...");
    } catch (e) {
      console.log("Cache file unreadable, rebuilding knowledge base...");
    }
  }

  let allChunks = [];

  for (const file of files) {
    const filePath = path.join(docsDir, file);
    let rawText = "";

    if (file.endsWith(".pdf")) {
      const buffer = fs.readFileSync(filePath);
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      rawText = result.text;
      await parser.destroy();
    } else {
      rawText = fs.readFileSync(filePath, "utf-8");
    }

    const chunks = chunkText(rawText);
    console.log(`Loaded ${chunks.length} chunks from ${file}`);
    allChunks = allChunks.concat(chunks.map((text) => ({ text, source: file })));
  }

  console.log(`Embedding ${allChunks.length} chunks in batches of ${BATCH_SIZE} (this runs once, then gets cached)...`);

  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map((c) => c.text);
    const embeddings = await embedBatch(texts);

    batch.forEach((chunk, idx) => {
      vectorStore.push({
        text: chunk.text,
        source: chunk.source,
        embedding: embeddings[idx],
      });
    });

    console.log(`Embedded ${Math.min(i + BATCH_SIZE, allChunks.length)}/${allChunks.length} chunks`);

    if (i + BATCH_SIZE < allChunks.length) {
      await sleep(DELAY_MS);
    }
  }

  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify({ fingerprint, vectorStore }));
  console.log(`Knowledge base ready: ${vectorStore.length} chunks embedded and cached to disk.`);
}

async function retrieveRelevantChunks(query, topK = 4) {
  const queryVector = await embedText(query);

  const scored = vectorStore.map((entry) => ({
    ...entry,
    score: cosineSimilarity(queryVector, entry.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

module.exports = { buildKnowledgeBase, retrieveRelevantChunks };