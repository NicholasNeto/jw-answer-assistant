const ai = require("./ai/provider");
const { AppError } = require("./ai/errors");
const { searchOfficial } = require("./sources/wol");
const { resolveReferences } = require("./sources/midweek");

const MAX_CHARS_PER_SOURCE = 1500;

function buildPrompt(question, sources) {
  const blocks = sources
    .map((s, i) => `[${i + 1}] ${s.title} (${s.reference})\n${s.paragraphs.join("\n").slice(0, MAX_CHARS_PER_SOURCE)}`)
    .join("\n\n");
  return [
    "Responda à pergunta em português, de forma breve, usando EXCLUSIVAMENTE os trechos numerados abaixo.",
    "Não use conhecimento próprio. Cite as fontes no fim de cada afirmação, assim: [1].",
    'Se os trechos não bastarem para responder, diga apenas: "Os trechos oficiais encontrados não respondem à pergunta."',
    "",
    `Pergunta: ${question}`,
    "",
    "Trechos:",
    blocks,
  ].join("\n");
}

async function answerFromOfficialSources(question, deps = {}) {
  const { keywords, results } = await searchOfficial(question, deps);
  if (!results.length) {
    return { text: null, sources: [], keywords, reason: "Nenhuma fonte oficial encontrada." };
  }
  const { text, model } = await (deps.generate || ai.generate)(buildPrompt(question, results));
  return {
    text,
    model,
    keywords,
    sources: results.map((s, i) => ({ n: i + 1, title: s.title, url: s.url, reference: s.reference })),
  };
}

function buildStudyPrompt(q, article) {
  return [
    "Responda à pergunta de estudo em português, de forma breve e com as palavras do estudante, usando EXCLUSIVAMENTE o(s) parágrafo(s) abaixo.",
    "Não use conhecimento próprio nem acrescente informação que não esteja no parágrafo.",
    'Se o parágrafo não bastar para responder, diga apenas: "O parágrafo não responde claramente à pergunta."',
    "",
    `Artigo: ${article.title}`,
    `Pergunta ${q.number}: ${q.text}`,
    "",
    "Parágrafo(s):",
    q.paragraphs.join("\n"),
  ].join("\n");
}

function buildMidweekPrompt(q, article, sources) {
  const blocks = sources.map((s, i) => `[${i + 1}] ${s.label}\n${s.text}`).join("\n\n");
  return [
    "Responda à pergunta em português, de forma breve e com as palavras do estudante, usando EXCLUSIVAMENTE os textos de referência abaixo.",
    "Não use conhecimento próprio nem acrescente informação que não esteja nesses textos.",
    'Se os textos não bastarem para responder, diga apenas: "As referências não respondem claramente à pergunta."',
    "",
    `Secção: ${q.section}`,
    `Pergunta: ${q.text}`,
    "",
    "Textos de referência:",
    blocks,
  ].join("\n");
}

async function answerMidweekQuestion(article, number, deps = {}) {
  const q = article.questions.find((x) => x.number === number);
  if (!q) throw new Error(`Pergunta ${number} não encontrada.`);
  const sources = await resolveReferences(q, deps);
  if (!sources.length) {
    throw new AppError("no_source");
  }
  const { text, model } = await (deps.generate || ai.generate)(buildMidweekPrompt(q, article, sources));
  return { text, model, question: q.text, paragraphs: sources.map((s) => `${s.label}: ${s.text}`), source: { title: article.title, url: article.url } };
}

async function answerStudyQuestion(article, number, deps = {}) {
  if (article.type === "midweek") return answerMidweekQuestion(article, number, deps);
  const q = article.questions.find((x) => x.number === number);
  if (!q) throw new Error(`Pergunta ${number} não encontrada.`);
  if (!q.paragraphs.length) throw new AppError("no_source");
  const { text, model } = await (deps.generate || ai.generate)(buildStudyPrompt(q, article));
  return { text, model, question: q.text, paragraphs: q.paragraphs, source: { title: article.title, url: article.url } };
}

module.exports = { buildMidweekPrompt, answerFromOfficialSources, buildPrompt, buildStudyPrompt, answerStudyQuestion };
