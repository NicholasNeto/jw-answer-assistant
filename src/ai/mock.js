// IA simulada para desenvolver a UI/automação sem gastar tokens.
// MOCK_ERROR=quota|auth|timeout|unavailable|empty  força esse erro; MOCK_DELAY_MS ajusta a espera.
const { AppError } = require("./errors");

async function generate(prompt) {
  await new Promise((r) => setTimeout(r, Number(process.env.MOCK_DELAY_MS ?? 600)));
  const forced = process.env.MOCK_ERROR;
  if (forced) throw new AppError(forced, { detail: "erro simulado (mock)", retryAfterSec: forced === "quota" ? 30 : null });
  const q = (prompt.match(/Pergunta[^:\n]*:\s*(.+)/) || [])[1] || "";
  return { text: `[MOCK] Resposta simulada para: ${q.slice(0, 120)}`, model: "mock" };
}

module.exports = { generate };
