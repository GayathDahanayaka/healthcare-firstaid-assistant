// server/knowledge/ragEngine.js
// Loads documents, splits them into chunks, embeds each chunk using
// Gemini's free text-embedding-004 model, and retrieves the most
// relevant chunks for a given user question using cosine similarity.

const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

let vectorStore = [];

function chunkText(text, chunkSize = 500, overlap = 50) {
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
  const files = fs.readdirSync(docsDir);
  let allChunks = [];

  for (const file of files) {
    const filePath = path.join(docsDir, file);
    let rawText = "";

    if (file.endsWith(".pdf")) {
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      rawText = data.text;
    } else if (file.endsWith(".txt")) {
      rawText = fs.readFileSync(filePath, "utf-8");
    } else {
      continue;
    }

    const chunks = chunkText(rawText);
    console.log(`Loaded ${chunks.length} chunks from ${file}`);
    allChunks = allChunks.concat(chunks.map((text) => ({ text, source: file })));
  }

  console.log(`Embedding ${allChunks.length} chunks total... (runs once at startup)`);

  for (const chunk of allChunks) {
    const result = await embeddingModel.embedContent(chunk.text);
    vectorStore.push({
      text: chunk.text,
      source: chunk.source,
      embedding: result.embedding.values,
    });
  }

  console.log("Knowledge base ready:", vectorStore.length, "chunks embedded.");
}

async function retrieveRelevantChunks(query, topK = 4) {
  const queryEmbedding = await embeddingModel.embedContent(query);
  const queryVector = queryEmbedding.embedding.values;

  const scored = vectorStore.map((entry) => ({
    ...entry,
    score: cosineSimilarity(queryVector, entry.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

module.exports = { buildKnowledgeBase, retrieveRelevantChunks };