const { runAdb } = require("./adb");
const { normalize } = require("../match");

const toks = (s) => normalize(s).split(" ").filter((t) => t.length > 2);
const visible = (r) => r && r.x2 > r.x1 && r.y2 > r.y1;

// Dado o ecrã (nós por ordem do documento), acha a caixa de resposta que pertence à pergunta.
function locateField(nodes, questionText) {
  const q = new Set(toks(questionText));
  if (!q.size) return { ok: false, code: "question_not_visible" };
  let best = null;
  nodes.forEach((n, i) => {
    if (n.editable || !n.text) return;
    const t = [...new Set(toks(n.text))];
    if (t.length < 3) return;
    const inQ = t.filter((x) => q.has(x)).length;
    const coverage = inQ / q.size;
    const containment = inQ / t.length;
    if (containment < 0.8) return;
    if (!best || coverage > best.coverage) best = { i, coverage, node: n };
  });
  if (!best || best.coverage < 0.5) return { ok: false, code: "question_not_visible" };
  const field = nodes.slice(best.i + 1).find((n) => n.editable && visible(n.rect));
  if (!field) return { ok: false, code: "field_not_found" };
  const r = field.rect;
  return { ok: true, x: Math.round((r.x1 + r.x2) / 2), y: Math.round((r.y1 + r.y2) / 2) };
}

const MESSAGES = {
  question_not_visible: "Não vejo essa pergunta no ecrã do telemóvel. Abra/role até ela no JW Library e tente de novo.",
  field_not_found: "Vejo a pergunta, mas não encontrei a caixa de resposta dela. Role um pouco para a caixa ficar visível.",
};

// Toca na caixa da pergunta certa e só então insere o texto. Recusa se não tiver certeza do campo.
async function insertForQuestion(question, text, { readScreen, insertText, run = runAdb, serial = process.env.ADB_SERIAL, wait = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const screen = await readScreen();
  if (!screen.ok) return screen;
  const loc = locateField(screen.nodes, question);
  if (!loc.ok) return { ok: false, code: loc.code, error: MESSAGES[loc.code] };
  const tap = await run(["shell", "input", "tap", String(loc.x), String(loc.y)], { serial });
  if (!tap.ok) return { ok: false, code: "adb", error: "Não consegui tocar no ecrã do telemóvel." };
  await wait(500);
  const r = await insertText(text);
  return r.ok ? { ...r, targeted: true } : r;
}

module.exports = { locateField, insertForQuestion };
