require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai"); // @google/generative-ai is deprecated - use @google/genai
const { buildKnowledgeBase, retrieveRelevantChunks } = require("./knowledge/ragEngine");
const { buildSystemPrompt } = require("./knowledge/systemPrompt");

const app = express();
app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const CHAT_MODEL = "gemini-flash-latest";

let knowledgeBaseReady = false;

app.post("/api/chat", async (req, res) => {
  try {
    if (!knowledgeBaseReady) {
      return res.status(503).json({ error: "Knowledge base is still loading, please wait a few seconds and try again." });
    }

    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    const relevantChunks = await retrieveRelevantChunks(message, 4);
    const contextText = relevantChunks
      .map((c, i) => `[${i + 1}] (source: ${c.source})\n${c.text}`)
      .join("\n\n");

    const systemInstruction = buildSystemPrompt(contextText);

    const chat = ai.chats.create({
      model: CHAT_MODEL,
      history: history || [],
      config: { systemInstruction },
    });

    const result = await chat.sendMessage({ message });
    const responseText = result.text;

    res.json({ reply: responseText, sources: relevantChunks.map((c) => c.source) });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", knowledgeBaseReady });
});

const PORT = process.env.PORT || 5000;

buildKnowledgeBase()
  .then(() => {
    knowledgeBaseReady = true;
    app.listen(PORT, () => console.log(`Server running on port ${PORT} — knowledge base ready`));
  })
  .catch((err) => {
    console.error("Failed to build knowledge base:", err);
    app.listen(PORT, () => console.log(`Server running on port ${PORT} — knowledge base failed to load`));
  });