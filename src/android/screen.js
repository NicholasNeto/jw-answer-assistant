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
    const b = attr("bounds").match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    nodes.push({
      text: text || desc,
      rect: b ? { x1: +b[1], y1: +b[2], x2: +b[3], y2: +b[4] } : null,
      editable: /EditText/.test(cls) || attr("editable") === "true",
      focused: attr("focused") === "true",
      bounds: attr("bounds"),
      cls,
      id: attr("resource-id"),
      clickable: attr("clickable") === "true",
      focusable: attr("focusable") === "true",
    });
  }
  const texts = nodes.filter((n) => n.text).map((n) => n.text);
  const fields = nodes.filter((n) => n.editable);
  const visibleTexts = nodes.filter((n) => n.text && n.rect && n.rect.x2 > n.rect.x1 && n.rect.y2 > n.rect.y1).map((n) => n.text);
  return { texts, visibleTexts, nodes, hasEditField: fields.length > 0, focusedEditField: fields.some((f) => f.focused) };
}

// Lê o ecrã do telemóvel (sem captura de imagem nem IA). Devolve { ok, texts, ... } ou { ok:false, error }.
async function dumpXml(run, serial) {
  const r = await run(["exec-out", "uiautomator", "dump", "/dev/tty"], { serial, timeout: 20000 });
  if (!r.ok) return { ok: false, error: r.error === "ADB_NOT_FOUND" ? "ADB não encontrado." : "Não consegui ler o ecrã do telemóvel (ligado e autorizado?)." };
  const xml = r.stdout.slice(r.stdout.indexOf("<?xml") >= 0 ? r.stdout.indexOf("<?xml") : 0);
  if (!xml.includes("<node")) return { ok: false, error: "O telemóvel não devolveu o conteúdo do ecrã." };
  return { ok: true, xml };
}

// Lê o ecrã do telemóvel (sem captura de imagem nem IA). A WebView do JW Library só expõe o conteúdo
// depois de a primeira leitura ativar a acessibilidade, por isso lemos uma segunda vez.
async function readScreen({ serial = process.env.ADB_SERIAL, run = runAdb, wait = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  let d = await dumpXml(run, serial);
  if (!d.ok) return d;
  if (d.xml.includes("android.webkit.WebView")) {
    await wait(700);
    const d2 = await dumpXml(run, serial);
    if (d2.ok) d = d2;
  }
  return { ok: true, ...parseUiDump(d.xml) };
}

module.exports = { parseUiDump, readScreen };
