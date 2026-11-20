const { fetchOfficial, isOfficialUrl } = require("./official");
const { stripTags } = require("./wol");
const { parseMidweekArticle } = require("./midweek");

// Só documentos do WOL (/wol/d/...).
function isStudyUrl(value) {
  return isOfficialUrl(value) && new URL(value).hostname === "wol.jw.org" && /\/wol\/(?:d|pc)\//.test(value);
}

function studyLabel(q) {
  const n = q.parNums;
  const par = !n.length ? "" : n.length === 1 ? ` · § ${n[0]}` : ` · §§ ${n[0]}-${n[n.length - 1]}`;
  const num = q.numberEnd ? `Perguntas ${q.number}-${q.numberEnd}` : q.number ? `Pergunta ${q.number}` : "Pergunta";
  return num + par;
}

// Parser puro: artigo de estudo -> perguntas com os respetivos parágrafos.
function parseStudyArticle(html) {
  const title = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1];
  const week = (html.match(/class="contextTtl[^>]*>([\s\S]*?)<\/p>/) || [])[1];

  const questions = [];
  const re = /<p[^>]*data-pid="(\d+)"[^>]*class="qu"[^>]*>([\s\S]*?)<\/p>/g;
  for (const m of html.matchAll(re)) {
    const raw = m[2];
    const numRe = /<strong>\s*(\d+)(?:\s*[-–,]\s*(\d+))?\.\s*<\/strong>/;
    const nm = raw.match(numRe);
    const text = stripTags(raw.replace(numRe, ""));
    questions.push({ pid: m[1], number: nm ? Number(nm[1]) : null, numberEnd: nm && nm[2] ? Number(nm[2]) : null, text, paragraphs: [], parNums: [], scriptures: [] });
  }
  const byPid = new Map(questions.map((q) => [q.pid, q]));

  const pre = /<p[^>]*data-rel-pid="\[([\d,\s]+)\]"[^>]*>([\s\S]*?)<\/p>/g;
  for (const m of html.matchAll(pre)) {
    const pn = (m[2].match(/data-pnum="(\d+)"/) || [])[1];
    const body = m[2].replace(/<span class="parNum"[\s\S]*?<\/span>/, "");
    const text = stripTags(body);
    const refs = [...body.matchAll(/<a [^>]*class="b"[^>]*>([\s\S]*?)<\/a>/g)].map((r) => stripTags(r[1]));
    for (const pid of m[1].split(",").map((x) => x.trim())) {
      const q = byPid.get(pid);
      if (q) {
        q.paragraphs.push(text);
        if (pn) q.parNums.push(Number(pn));
        q.scriptures.push(...refs);
      }
    }
  }
  return {
    title: title ? stripTags(title) : "",
    week: week ? stripTags(week) : "",
    questions: questions.filter((q) => q.text).map((q) => ({ ...q, label: studyLabel(q) })),
  };
}

const cache = new Map();

async function loadStudyArticle(url, { fetchImpl } = {}) {
  if (!isStudyUrl(url)) throw new Error("O link tem de ser de um documento em wol.jw.org (…/wol/d/…).");
  const key = new URL(url).pathname;
  if (cache.has(key)) return cache.get(key);
  const { html } = await fetchOfficial(url, { fetchImpl });
  let article = { type: "study", ...parseStudyArticle(html), url: new URL(url).origin + key };
  if (!article.questions.length) {
    article = { type: "midweek", ...parseMidweekArticle(html, url), url: new URL(url).origin + key };
  }
  if (!article.questions.length) throw new Error("Não encontrei perguntas neste documento.");
  cache.set(key, article);
  return article;
}

module.exports = { parseStudyArticle, loadStudyArticle, isStudyUrl };
