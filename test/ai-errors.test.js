const test = require("node:test");
const assert = require("node:assert");
const { classifyHttpError, toPayload, AppError } = require("../src/ai/errors");
const gemini = require("../src/ai/gemini");

test("erros: 429 vira quota amigável com tempo de espera", () => {
  const e = classifyHttpError(429, { error: { status: "RESOURCE_EXHAUSTED", message: "x", details: [{ retryDelay: "34.2s" }] } });
  assert.equal(e.code, "quota");
  assert.equal(e.retryAfterSec, 35);
  assert.match(toPayload(e).error, /limite/i);
  assert.equal(classifyHttpError(403, {}).code, "auth");
  assert.equal(classifyHttpError(503, {}).code, "unavailable");
});

test("gemini: 429 e timeout geram AppError", async () => {
  process.env.GEMINI_API_KEY = "k";
  const quota = async () => ({ ok: false, status: 429, json: async () => ({ error: { message: "m" } }) });
  await assert.rejects(gemini.generate("p", { fetchImpl: quota }), (e) => e instanceof AppError && e.code === "quota");
  const slow = async () => { const e = new Error("t"); e.name = "TimeoutError"; throw e; };
  await assert.rejects(gemini.generate("p", { fetchImpl: slow }), (e) => e.code === "timeout");
});

test("mock: responde e simula erro", async () => {
  process.env.MOCK_DELAY_MS = "0";
  const mock = require("../src/ai/mock");
  assert.match((await mock.generate("Pergunta 1: olá")).text, /MOCK/);
  process.env.MOCK_ERROR = "quota";
  await assert.rejects(mock.generate("x"), (e) => e.code === "quota");
  delete process.env.MOCK_ERROR;
});
