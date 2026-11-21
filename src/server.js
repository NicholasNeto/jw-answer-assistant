const path = require("path");
const fs = require("fs");

const envFile = path.join(__dirname, "..", ".env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
if (process.argv.includes("--mock")) process.env.AI_PROVIDER = "mock";
if (process.argv.includes("--mock-device")) process.env.DEVICE_MOCK = "1";
if (process.argv.includes("--real")) process.env.AI_PROVIDER = "gemini";

const express = require("express");
const { getDeviceStatus } = require("./android/status");
const { copyToClipboard } = require("./clipboard");
const ai = require("./ai/provider");
const { answerFromOfficialSources, answerStudyQuestion } = require("./answer");
const device = require("./android/device");
const { matchQuestion } = require("./match");
const store = require("./store");
const { toPayload } = require("./ai/errors");
const { loadStudyArticle } = require("./sources/study");

const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/config", (_req, res) => res.json({ aiProvider: ai.providerName(), deviceMock: device.isMock() }));

app.get("/api/answers", (req, res) => {
  try {
    const all = store.getAnswers(String(req.query.url || ""));
    const mockAi = ai.providerName() === "mock";
    // respostas simuladas nunca são devolvidas fora do modo mock
    res.json({ ok: true, answers: Object.fromEntries(Object.entries(all).filter(([, v]) => mockAi || v.model !== "mock")) });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.put("/api/answers", (req, res) => {
  const { url, number, text, model } = req.body || {};
  if (typeof text !== "string" || text.length > 5000 || !Number.isInteger(number)) return res.status(400).json({ ok: false, error: "Dados inválidos." });
  try {
    store.saveAnswer(String(url), number, text, model);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.post("/api/device/insert", async (req, res) => {
  const text = req.body && req.body.text;
  if (typeof text !== "string" || text.length > 5000) return res.status(400).json({ ok: false, error: "Texto inválido (máx. 5000)." });
  const { url, number } = req.body;
  let r;
  if (url && number != null) {
    try {
      const a = await loadStudyArticle(String(url));
      const q = a.questions.find((x) => x.number === Number(number));
      if (!q) return res.status(400).json({ ok: false, error: "Pergunta não encontrada." });
      r = await device.insertForQuestion(q.text, text);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  } else {
    r = await device.insertText(text);
  }
  res.status(r.ok ? 200 : 502).json(r);
});

app.get("/api/device/screen", async (_req, res) => {
  const s = await device.readScreen({ questions: [] });
  if (!s.ok) return res.status(502).json(s);
  const nodes = s.nodes || [];
  const vis = (n) => n.rect && n.rect.x2 > n.rect.x1 && n.rect.y2 > n.rect.y1;
  const short = (n, i) => ({ i, text: n.text.slice(0, 60), bounds: n.bounds, cls: n.cls, id: n.id, editable: n.editable, focused: n.focused, clickable: n.clickable });
  res.json({
    ok: true,
    totalNodes: nodes.length,
    nodesWithBounds: nodes.filter(vis).length,
    editableFields: nodes.map((n, i) => (n.editable ? short(n, i) : null)).filter(Boolean),
    visibleNodes: nodes.map((n, i) => (vis(n) && n.text ? short(n, i) : null)).filter(Boolean).slice(0, 150),
    labels: nodes.map((n, i) => (/sua resposta/i.test(n.text) ? short(n, i) : null)).filter(Boolean).slice(0, 40),
  });
});

app.post("/api/flow/detect", async (req, res) => {
  try {
    const url = String((req.body && req.body.url) || "");
    const a = await loadStudyArticle(url);
    const screen = await device.readScreen({ questions: a.questions });
    if (!screen.ok) return res.status(502).json(screen);
    const m = matchQuestion(screen.visibleTexts && screen.visibleTexts.length ? screen.visibleTexts : screen.texts, a.questions);
    if (!m.found) return res.json({ ok: true, found: false, message: "Não reconheci nenhuma pergunta deste artigo no ecrã. Abra a pergunta no JW Library." });
    const q = a.questions.find((x) => x.number === m.number);
    const saved = store.getAnswers(url)[m.number];
    const mockAi = ai.providerName() === "mock";
    res.json({
      ok: true, found: true, number: m.number, label: q.label, question: q.text, score: m.score, ambiguous: m.ambiguous,
      focusedEditField: screen.focusedEditField,
      answer: saved && (mockAi || saved.model !== "mock") ? saved.text : null,
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

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
