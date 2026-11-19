// Camada de abstração: o resto da app só usa generate(prompt).
const providers = {
  gemini: () => require("./gemini"),
  mock: () => require("./mock"),
};

function getProvider() {
  const name = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  if (!providers[name]) throw new Error(`Fornecedor de IA desconhecido: ${name}`);
  return providers[name]();
}

async function generate(prompt) {
  return getProvider().generate(prompt);
}

function providerName() {
  return (process.env.AI_PROVIDER || "gemini").toLowerCase();
}

module.exports = { generate, providerName };
