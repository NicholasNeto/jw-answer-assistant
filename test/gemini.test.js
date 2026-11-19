const test = require("node:test");
const assert = require("node:assert");
const { extractText, generate } = require("../src/ai/gemini");

test("extractText: steps com thought + model_output", () => {
  const i = { steps: [{ type: "thought" }, { type: "model_output", content: [{ type: "text", text: "Olá " }, { type: "text", text: "mundo" }] }] };
  assert.strictEqual(extractText(i), "Olá mundo");
  assert.strictEqual(extractText({ output_text: "x" }), "x");
  assert.strictEqual(extractText({}), "");
});

test("generate: sem chave dá erro claro; erro HTTP propagado", async () => {
  delete process.env.GEMINI_API_KEY;
  await assert.rejects(generate("x"), /GEMINI_API_KEY/);
  process.env.GEMINI_API_KEY = "k";
  const fake = async () => ({ ok: false, status: 429, json: async () => ({ error: { message: "quota" } }) });
  await assert.rejects(generate("x", { fetchImpl: fake }), /limite/i);
  const ok = async () => ({ ok: true, json: async () => ({ output_text: "resp" }) });
  assert.deepStrictEqual(await generate("x", { fetchImpl: ok }), { text: "resp", model: "gemini-4-hydrogen" });
});
