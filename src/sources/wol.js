const { fetchOfficial } = require("./official");

const STOPWORDS = new Set(
  "a o as os um uma uns umas de do da dos das em no na nos nas por para com sem sobre e ou que qual quais quem como quando onde porque por que se foi era ser são é ao aos à às pelo pela pelos pelas seu sua seus suas ele ela eles elas isso isto esse essa este esta mais muito também já não sim ter tem tinha pode podem deve".split(" ")
);

function extractKeywords(question, max = 5) {
  const seen = new Set();
  const words = question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !seen.has(w) && seen.add(w));
  return words.slice(0, max);
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&nbsp;|&lrm;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

// Parser puro dos resultados de pesquisa do WOL.
function parseSearchResults(html, base = "https://wol.jw.org") {
  const results = [];
  const blocks = html.split('<li class="caption">').slice(1);
  for (const block of blocks) {
    const link = block.match(/<a class="lnk" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!link) continue;
    const url = new URL(decodeEntities(link[1]), base);
    url.search = "";
    const paragraphs = [...block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
      .map((m) => stripTags(m[1]))
      .filter(Boolean);
    const ref = block.match(/<li class="ref">([\s\S]*?)<\/li>/);
    if (!paragraphs.length) continue;
    results.push({
      title: stripTags(link[2]),
      url: url.toString(),
      reference: ref ? stripTags(ref[1]) : "",
      paragraphs,
    });
  }
  return results;
}

function buildSearchUrl(keywords, lang = "pt", proximity = "doc") {
  const q = encodeURIComponent(keywords.join(" "));
  return `https://wol.jw.org/${lang}/wol/s/r5/lp-t?q=${q}&p=${proximity}&r=occ`;
}

// Pesquisa no mesmo parágrafo; se vazio, reduz palavras-chave e depois alarga ao artigo.
async function searchOfficial(question, { fetchImpl, limit = 5 } = {}) {
  const lang = process.env.WOL_LANG || "pt";
  const all = extractKeywords(question);
  for (const proximity of ["par", "doc"]) {
    for (let n = all.length; n >= Math.min(2, all.length) && n > 0; n--) {
      const { html } = await fetchOfficial(buildSearchUrl(all.slice(0, n), lang, proximity), { fetchImpl });
      const results = parseSearchResults(html).slice(0, limit);
      if (results.length) return { keywords: all.slice(0, n), results };
    }
  }
  return { keywords: all, results: [] };
}

module.exports = { stripTags, decodeEntities, extractKeywords, parseSearchResults, buildSearchUrl, searchOfficial };
