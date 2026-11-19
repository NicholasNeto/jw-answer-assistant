const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const API_REVISION = "2026-05-20";

// Parser puro: extrai o texto final da resposta da Interactions API.
function extractText(interaction) {
  if (!interaction) return "";
  if (typeof interaction.output_text === "string") return interaction.output_text;
  const parts = [];
  for (const step of interaction.steps || []) {
    if (step.type !== "model_output") continue;
    for (const c of step.content || []) {
      if (c.type === "text" && typeof c.text === "string") parts.push(c.text);
    }
  }
  return parts.join("");
}

async function generate(prompt, { fetchImpl = fetch } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY não definida no .env.");
  const model = process.env.GEMINI_MODEL || "gemini-4-hydrogen";

  const res = await fetchImpl(ENDPOINT, {
    method: "POST",
    headers: {
      "x-goog-api-key": key,
      "Content-Type": "application/json",
      "Api-Revision": API_REVISION,
    },
    body: JSON.stringify({ model, input: prompt }),
    signal: AbortSignal.timeout(60000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body.error && body.error.message) || `HTTP ${res.status}`;
    throw new Error(`Gemini: ${msg}`);
  }
  const text = extractText(body);
  if (!text) throw new Error("Gemini devolveu uma resposta vazia.");
  return { text, model };
}

module.exports = { generate, extractText };
