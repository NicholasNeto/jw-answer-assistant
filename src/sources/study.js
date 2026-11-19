const { fetchOfficial, isOfficialUrl } = require("./official");
const { stripTags } = require("./wol");

// Só documentos do WOL (/wol/d/...).
function isStudyUrl(value) {
  return isOfficialUrl(value) && new URL(value).hostname === "wol.jw.org" && /\/wol\/d\//.test(value);
}

// Parser puro: artigo de estudo -> perguntas com os respetivos parágrafos.
function parseStudyArticle(html) {
  const title = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1];
  const week = (html.match(/class="contextTtl[^>]*>([\s\S]*?)<\/p>/) || [])[1];

  const questions = [];
  const re = /<p[^>]*data-pid="(\d+)"[^>]*class="qu"[^>]*>([\s\S]*?)<\/p>/g;
  for (const m of html.matchAll(re)) {
    const raw = m[2];
    const num = (raw.match(/<strong>\s*(\d+)\.\s*<\/strong>/) || [])[1];
    const text = stripTags(raw.replace(/<strong>\s*\d+\.\s*<\/strong>/, ""));
    questions.push({ pid: m[1], number: num ? Number(num) : null, text, paragraphs: [], scriptures: [] });
  }
  const byPid = new Map(questions.map((q) => [q.pid, q]));

  const pre = /<p[^>]*data-rel-pid="\[([\d,\s]+)\]"[^>]*>([\s\S]*?)<\/p>/g;
  for (const m of html.matchAll(pre)) {
    const body = m[2].replace(/<span class="parNum"[\s\S]*?<\/span>/, "");
    const text = stripTags(body);
    const refs = [...body.matchAll(/<a [^>]*class="b"[^>]*>([\s\S]*?)<\/a>/g)].map((r) => stripTags(r[1]));
    for (const pid of m[1].split(",").map((x) => x.trim())) {
      const q = byPid.get(pid);
      if (q) {
        q.paragraphs.push(text);
        q.scriptures.push(...refs);
      }
    }
  }
  return {
    title: title ? stripTags(title) : "",
    week: week ? stripTags(week) : "",
    questions: questions.filter((q) => q.text),
  };
}

const cache = new Map();

async function loadStudyArticle(url, { fetchImpl } = {}) {
  if (!isStudyUrl(url)) throw new Error("O link tem de ser de um documento em wol.jw.org (…/wol/d/…).");
  const key = new URL(url).pathname;
  if (cache.has(key)) return cache.get(key);
  const { html } = await fetchOfficial(url, { fetchImpl });
  const article = { ...parseStudyArticle(html), url: new URL(url).origin + key };
  if (!article.questions.length) throw new Error("Não encontrei perguntas de estudo neste documento.");
  cache.set(key, article);
  return article;
}

module.exports = { parseStudyArticle, loadStudyArticle, isStudyUrl };
