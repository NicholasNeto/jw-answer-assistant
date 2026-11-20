// Liga o texto visível no ecrã do telemóvel a uma pergunta do artigo carregado.
function normalize(s) {
  return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
const tokens = (s) => normalize(s).split(" ").filter((t) => t.length > 2);

function matchQuestion(screenTexts, questions, { threshold = 0.6 } = {}) {
  const screen = new Set(tokens(screenTexts.join(" ")));
  const scored = questions
    .map((q) => {
      const t = [...new Set(tokens(q.text))];
      const hit = t.filter((x) => screen.has(x)).length;
      return { number: q.number, score: t.length ? hit / t.length : 0 };
    })
    .sort((a, b) => b.score - a.score);
  const [best, second] = scored;
  if (!best || best.score < threshold) return { found: false, best: best || null };
  return { found: true, number: best.number, score: best.score, ambiguous: !!second && best.score - second.score < 0.1 };
}

module.exports = { matchQuestion, normalize };
