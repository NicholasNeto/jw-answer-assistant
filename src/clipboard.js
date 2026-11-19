const { spawn } = require("child_process");

const MAX_LENGTH = 10000;

function copyToClipboard(text) {
  return new Promise((resolve, reject) => {
    if (typeof text !== "string" || text.length === 0) {
      return reject(new Error("Texto vazio."));
    }
    if (text.length > MAX_LENGTH) {
      return reject(new Error(`Texto demasiado longo (máx. ${MAX_LENGTH}).`));
    }
    const p = spawn("pbcopy");
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`pbcopy terminou com código ${code}`))
    );
    p.stdin.on("error", reject);
    p.stdin.end(text, "utf8");
  });
}

module.exports = { copyToClipboard, MAX_LENGTH };
