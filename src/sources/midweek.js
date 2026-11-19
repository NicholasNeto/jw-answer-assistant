const { fetchOfficial } = require("./official");
const { stripTags } = require("./wol");

const MAX_CHARS = 1500;
const MAX_REFS = 4;

function absolute(href, base) {
  return new URL(href.replace(/&amp;/g, "&"), base).toString();
}

// Parser puro do caderno da reunião de meio de semana: perguntas com caixa de resposta + referências.
function parseMidweekArticle(html, baseUrl = "https://wol.jw.org") {
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
  const week = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "";
  const questions = [];
  let studyLink = null;
  const parts = html.split(/<h3[^>]*data-pid="\d+"[^>]*>/).slice(1);
  for (const part of parts) {
    const [heading, ...restParts] = part.split("</h3>");
    const section = stripTags(heading);
    const body = restParts.join("</h3>");
    if (/Estudo bíblico de congregação/i.test(section)) {
      const m = body.match(/<a [^>]*href="([^"]*\/wol\/(?:pc|d)\/[^"]*)"/);
      if (m) studyLink = absolute(m[1], baseUrl);
    }
    const re = /<p[^>]*data-pid="\d+"[^>]*>((?:(?!<\/p>)[\s\S])*?)<\/p>\s*<div class="gen-field"/g;
    for (const m of body.matchAll(re)) {
      const refs = [...m[1].matchAll(/<a [^>]*href="([^"]*\/wol\/(bc|pc|rslink)\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((r) => ({
        kind: r[2] === "bc" ? "bc" : "pc",
        url: absolute(r[1], baseUrl),
        label: stripTags(r[3]),
      }));
      questions.push({ number: questions.length + 1, section, text: stripTags(m[1]), refs, paragraphs: [] });
    }
  }
  return { title: stripTags(title.split("—")[0].split("&mdash;")[0]), week: stripTags(week), questions, studyLink };
}

// "Lam. 2:1" -> {chapter:2, verses:[1]}; "14" herda o capítulo anterior.
function parseVerseSpec(label, prevChapter) {
  const m = label.match(/(?:(\d+):)?\s*([\d,\s\-–]+)\s*$/);
  if (!m) return null;
  const chapter = m[1] ? Number(m[1]) : prevChapter;
  if (!chapter) return null;
  const verses = [];
  for (const piece of m[2].split(",").map((x) => x.trim()).filter(Boolean)) {
    const r = piece.split(/[-–]/).map(Number);
    if (r.some(Number.isNaN)) continue;
    const [a, b = a] = r;
    for (let v = a; v <= Math.min(b, a + 30); v++) verses.push(v);
  }
  return verses.length ? { chapter, verses } : null;
}

function extractVerses(html, chapter, verses) {
  const want = new Set(verses);
  const out = new Map();
  for (const m of html.matchAll(/<span id="v\d+-(\d+)-(\d+)-\d+" class="v">([\s\S]*?)<\/span>/g)) {
    if (Number(m[1]) !== chapter || !want.has(Number(m[2]))) continue;
    const text = stripTags(m[3].replace(/<a [^>]*>[\s\S]*?<\/a>/g, ""));
    out.set(Number(m[2]), ((out.get(Number(m[2])) || "") + " " + text).trim());
  }
  return [...out].sort((a, b) => a[0] - b[0]).map(([v, t]) => `${v} ${t}`).join(" ");
}

// "§ 12", "§§ 7-9", "§§ 5, 7" -> [12] / [7,8,9] / [5,7]
function parseParagraphNumbers(label) {
  const m = label.match(/§§?\s*([\d,\s\-–]+)/);
  if (!m) return [];
  const nums = [];
  for (const piece of m[1].split(",").map((x) => x.trim()).filter(Boolean)) {
    const [a, b = a] = piece.split(/[-–]/).map(Number);
    for (let n = a; n <= Math.min(b, a + 20); n++) nums.push(n);
  }
  return nums;
}

function extractNumberedParagraphs(html, numbers) {
  const want = new Set(numbers);
  const out = [];
  for (const m of html.matchAll(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?<span class="parNum" data-pnum="(\d+)"[^>]*>(?:(?!<\/p>)[\s\S])*?<\/p>/g)) {
    const n = Number(m[1]);
    if (want.has(n)) out.push(`§${n}: ` + stripTags(m[0].replace(/<span class="parNum"[\s\S]*?<\/span>/, "")));
  }
  return out;
}

function extractByPid(html, from, to) {
  const out = [];
  for (const m of html.matchAll(/<p[^>]*data-pid="(\d+)"[^>]*>((?:(?!<\/p>)[\s\S])*?)<\/p>/g)) {
    const n = Number(m[1]);
    if (n >= from && n <= to) out.push(stripTags(m[2]));
  }
  return out;
}

// Segue as referências da pergunta (só URLs oficiais) e devolve os textos-base.
async function resolveReferences(question, { fetchImpl } = {}) {
  const sources = [];
  let chapter = null;
  const pages = new Map();
  const getPage = (url) => {
    if (!pages.has(url)) pages.set(url, fetchOfficial(url, { fetchImpl }).then((r) => r.html));
    return pages.get(url);
  };
  for (const ref of question.refs.slice(0, MAX_REFS)) {
    try {
      if (ref.kind === "bc") {
        const spec = parseVerseSpec(ref.label, chapter);
        if (!spec) continue;
        chapter = spec.chapter;
        const text = extractVerses(await getPage(ref.url), spec.chapter, spec.verses);
        if (text) sources.push({ label: ref.label, url: ref.url, text: text.slice(0, MAX_CHARS) });
      } else {
        const html = await getPage(ref.url);
        const q = new URL(ref.url).searchParams;
        const begin = Number(q.get("beginpar")), end = Number(q.get("endpar") || begin);
        let paras = [];
        if (begin) paras = extractByPid(html, begin, Math.min(end, begin + 10));
        if (!paras.length) {
          const nums = parseParagraphNumbers(ref.label);
          if (nums.length) paras = extractNumberedParagraphs(html, nums);
        }
        if (paras.length) sources.push({ label: ref.label, url: ref.url, text: paras.join("\n").slice(0, MAX_CHARS) });
      }
    } catch {
      // referência inacessível: simplesmente não é usada
    }
  }
  return sources;
}

module.exports = { parseMidweekArticle, parseVerseSpec, extractVerses, parseParagraphNumbers, extractNumberedParagraphs, extractByPid, resolveReferences };
