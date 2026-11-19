const { AppError, classifyHttpError } = require("./errors");
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
  if (!key) throw new AppError("no_key");
  const model = process.env.GEMINI_MODEL || "gemini-4-hydrogen";

  let res;
  try {
    res = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: {
        "x-goog-api-key": key,
        "Content-Type": "application/json",
        "Api-Revision": API_REVISION,
      },
      body: JSON.stringify({ model, input: prompt }),
      signal: AbortSignal.timeout(120000),
    });
  } catch (e) {
    if (e.name === "TimeoutError" || e.name === "AbortError") throw new AppError("timeout");
    throw new AppError("unavailable", { detail: e.message });
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw classifyHttpError(res.status, body);
  }
  const text = extractText(body);
  if (!text) throw new AppError("empty");
  return { text, model };
}

module.exports = { generate, extractText };
