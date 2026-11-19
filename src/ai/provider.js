// Camada de abstração: o resto da app só usa generate(prompt).
const providers = {
  gemini: () => require("./gemini"),
};

function getProvider() {
  const name = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  if (!providers[name]) throw new Error(`Fornecedor de IA desconhecido: ${name}`);
  return providers[name]();
}

async function generate(prompt) {
  return getProvider().generate(prompt);
}

module.exports = { generate };
