const { runAdb } = require("./adb");
const { normalize } = require("../match");

const toks = (s) => normalize(s).split(" ").filter((t) => t.length > 2);
const visible = (r) => r && r.x2 > r.x1 && r.y2 > r.y1;

const WINDOW = 60;
const LABELS = /^sua resposta$/i;

// O JW Library expõe o texto palavra a palavra, e a caixa de resposta vem logo depois da pergunta.
// Para cada caixa, medimos quanto da pergunta aparece nos nós imediatamente antes dela.
function locateField(nodes, questionText) {
  const q = new Set(toks(questionText));
  if (!q.size) return { ok: false, code: "question_not_visible" };
  let best = null;
  nodes.forEach((n, k) => {
    if (!n.editable) return;
    const seen = new Set();
    let count = 0;
    for (let i = k - 1; i >= 0 && count < WINDOW; i--) {
      if (nodes[i].editable) break;
      if (!nodes[i].text || LABELS.test(nodes[i].text)) continue;
      count++;
      toks(nodes[i].text).forEach((t) => q.has(t) && seen.add(t));
    }
    const coverage = seen.size / q.size;
    if (!best || coverage > best.coverage) best = { k, coverage };
  });
  if (!best || best.coverage < 0.7) return { ok: false, code: "question_not_visible" };
  const r = nodes[best.k].rect;
  if (!visible(r)) return { ok: false, code: "field_offscreen" };
  return { ok: true, x: Math.round((r.x1 + r.x2) / 2), y: Math.round((r.y1 + r.y2) / 2) };
}

const MESSAGES = {
  question_not_visible: "Não encontrei essa pergunta no telemóvel. Confirme que o artigo carregado está no mesmo idioma do JW Library (pt-PT ou pt-BR) e que a pergunta existe nessa página.",
  field_offscreen: "Encontrei a pergunta, mas a caixa de resposta não está visível no ecrã. Role até ela no JW Library e tente de novo.",
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
