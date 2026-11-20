const { runAdb } = require("./adb");

function decode(s) {
  return s
    .replace(/&#10;/g, "\n")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// Parser puro do XML do `uiautomator dump`: textos visíveis e campos de texto editáveis.
function parseUiDump(xml) {
  const nodes = [];
  for (const m of String(xml).matchAll(/<node\b([^>]*?)\/?>/g)) {
    const attr = (name) => {
      const r = m[1].match(new RegExp(`\\b${name}="([^"]*)"`));
      return r ? decode(r[1]) : "";
    };
    const text = attr("text").trim();
    const desc = attr("content-desc").trim();
    const cls = attr("class");
    nodes.push({
      text: text || desc,
      editable: /EditText/.test(cls) || attr("editable") === "true",
      focused: attr("focused") === "true",
      bounds: attr("bounds"),
    });
  }
  const texts = nodes.filter((n) => n.text).map((n) => n.text);
  const fields = nodes.filter((n) => n.editable);
  return { texts, hasEditField: fields.length > 0, focusedEditField: fields.some((f) => f.focused) };
}

// Lê o ecrã do telemóvel (sem captura de imagem nem IA). Devolve { ok, texts, ... } ou { ok:false, error }.
async function readScreen({ serial = process.env.ADB_SERIAL, run = runAdb } = {}) {
  const r = await run(["exec-out", "uiautomator", "dump", "/dev/tty"], { serial, timeout: 15000 });
  if (!r.ok) return { ok: false, error: r.error === "ADB_NOT_FOUND" ? "ADB não encontrado." : "Não consegui ler o ecrã do telemóvel (ligado e autorizado?)." };
  const xml = r.stdout.slice(r.stdout.indexOf("<?xml") >= 0 ? r.stdout.indexOf("<?xml") : 0);
  if (!xml.includes("<node")) return { ok: false, error: "O telemóvel não devolveu o conteúdo do ecrã." };
  return { ok: true, ...parseUiDump(xml) };
}

module.exports = { parseUiDump, readScreen };
