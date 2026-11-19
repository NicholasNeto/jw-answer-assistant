
const { spawn } = require("child_process");

function copyToClipboard(text) {
  return new Promise((resolve, reject) => {
    const clipboard = spawn("pbcopy");

    clipboard.on("error", reject);

    clipboard.on("close", (code) => {
      if (code === 0) {
        console.log("Texto copiado para o clipboard!");
        resolve();
      } else {
        reject(new Error(`pbcopy terminou com código ${code}`));
      }
    });

    clipboard.stdin.on("error", reject);
    clipboard.stdin.end(text, "utf8");
  });
}

async function main() {
  const answer =
    "Jeová deu coragem a Jael, e ela demonstrou confiança por meio das suas ações.";

  try {
    await copyToClipboard(answer);
  } catch (error) {
    console.error("Erro ao copiar texto:", error.message);
  }
}

main();
