// Erros da IA com código estável e mensagem amigável para o utilizador.
const MESSAGES = {
  quota: "O limite de utilização da IA foi atingido. Aguarde um pouco e tente de novo.",
  auth: "A chave da IA é inválida ou não tem permissão. Verifique o GEMINI_API_KEY no .env.",
  timeout: "A IA demorou demasiado a responder. Tente de novo dentro de instantes.",
  unavailable: "A IA está temporariamente indisponível. Tente de novo dentro de instantes.",
  empty: "A IA não devolveu nenhuma resposta. Tente de novo.",
  no_key: "A chave da IA não está configurada (GEMINI_API_KEY no .env).",
  no_source: "Esta pergunta não tem texto-base que a app consiga ler. Responda manualmente.",
  unknown: "Não foi possível gerar esta resposta.",
};
const RETRYABLE = new Set(["quota", "timeout", "unavailable", "empty", "unknown"]);

class AppError extends Error {
  constructor(code, { detail, retryAfterSec } = {}) {
    super(MESSAGES[code] || MESSAGES.unknown);
    this.code = code;
    this.detail = detail;
    this.retryAfterSec = retryAfterSec || null;
    this.retryable = RETRYABLE.has(code);
  }
}

// "34.5s" / "34s" -> 35
function parseRetryDelay(body) {
  const details = (body && body.error && body.error.details) || [];
  for (const d of details) {
    const m = String(d.retryDelay || "").match(/^(\d+(?:\.\d+)?)s$/);
    if (m) return Math.ceil(Number(m[1]));
  }
  return null;
}

function classifyHttpError(status, body) {
  const detail = (body && body.error && body.error.message) || `HTTP ${status}`;
  const retryAfterSec = parseRetryDelay(body);
  const gstatus = body && body.error && body.error.status;
  let code = "unknown";
  if (status === 429 || gstatus === "RESOURCE_EXHAUSTED") code = "quota";
  else if (status === 401 || status === 403 || gstatus === "UNAUTHENTICATED" || gstatus === "PERMISSION_DENIED") code = "auth";
  else if (status === 400 && /api key/i.test(detail)) code = "auth";
  else if (status >= 500) code = "unavailable";
  return new AppError(code, { detail, retryAfterSec });
}

function toPayload(e) {
  const known = e instanceof AppError;
  return {
    ok: false,
    error: known ? e.message : e.message || MESSAGES.unknown,
    code: known ? e.code : "unknown",
    retryable: known ? e.retryable : true,
    retryAfterSec: known ? e.retryAfterSec : null,
  };
}

module.exports = { AppError, classifyHttpError, parseRetryDelay, toPayload };
