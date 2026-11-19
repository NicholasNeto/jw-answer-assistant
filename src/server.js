const path = require("path");
const fs = require("fs");

const envFile = path.join(__dirname, "..", ".env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
if (process.argv.includes("--mock")) process.env.AI_PROVIDER = "mock";
if (process.argv.includes("--real")) process.env.AI_PROVIDER = "gemini";

const express = require("express");
const { getDeviceStatus } = require("./android/status");
const { copyToClipboard } = require("./clipboard");
const ai = require("./ai/provider");
const { answerFromOfficialSources, answerStudyQuestion } = require("./answer");
const { toPayload } = require("./ai/errors");
const { loadStudyArticle } = require("./sources/study");

const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/config", (_req, res) => res.json({ aiProvider: ai.providerName() }));

app.get("/api/device/status", async (_req, res) => {
  try {
    res.json(await getDeviceStatus());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/clipboard", async (req, res) => {
  try {
    await copyToClipboard(req.body && req.body.text);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.post("/api/ai/ask", async (req, res) => {
  const q = req.body && typeof req.body.question === "string" ? req.body.question.trim() : "";
  if (!q || q.length > 2000) {
    return res.status(400).json({ ok: false, error: "Pergunta vazia ou demasiado longa (máx. 2000)." });
  }
  try {
    const { text, model } = await ai.generate(q);
    res.json({ ok: true, text, model });
  } catch (e) {
    const p = toPayload(e);
    res.status(p.code === "quota" ? 429 : 502).json(p);
  }
});

app.post("/api/answer", async (req, res) => {
  const q = req.body && typeof req.body.question === "string" ? req.body.question.trim() : "";
  if (!q || q.length > 2000) {
    return res.status(400).json({ ok: false, error: "Pergunta vazia ou demasiado longa (máx. 2000)." });
  }
  try {
    res.json({ ok: true, ...(await answerFromOfficialSources(q)) });
  } catch (e) {
    const p = toPayload(e);
    res.status(p.code === "quota" ? 429 : 502).json(p);
  }
});

app.post("/api/study/load", async (req, res) => {
  try {
    const a = await loadStudyArticle(String((req.body && req.body.url) || ""));
    res.json({ ok: true, type: a.type, title: a.title, week: a.week, url: a.url, studyLink: a.studyLink || null, questions: a.questions.map(({ number, label, section, text, paragraphs, refs }) => ({ number, label, section: section || "", text, hasParagraph: a.type === "midweek" ? refs.length > 0 : paragraphs.length > 0 })) });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.post("/api/study/answer", async (req, res) => {
  try {
    const a = await loadStudyArticle(String((req.body && req.body.url) || ""));
    res.json({ ok: true, ...(await answerStudyQuestion(a, Number(req.body.number))) });
  } catch (e) {
    const p = toPayload(e);
    res.status(p.code === "quota" ? 429 : 400).json(p);
  }
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, "127.0.0.1", () => {
  console.log(`JW Answer Assistant em http://localhost:${port}`);
});
