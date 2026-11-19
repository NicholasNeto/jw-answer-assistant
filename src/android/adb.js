const { execFile } = require("child_process");

const JW_LIBRARY_PACKAGE = "org.jw.jwlibrary.mobile";

function getAdbPath() {
  return process.env.ADB_PATH || "adb";
}

// Executa o adb sem shell. Nunca rejeita: devolve { ok, stdout, stderr, error }.
function runAdb(args, { serial, timeout = 8000 } = {}) {
  const fullArgs = serial ? ["-s", serial, ...args] : args;
  return new Promise((resolve) => {
    execFile(
      getAdbPath(),
      fullArgs,
      { timeout, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          resolve({
            ok: false,
            stdout: stdout || "",
            stderr: stderr || "",
            error: error.code === "ENOENT" ? "ADB_NOT_FOUND" : error.message,
          });
        } else {
          resolve({ ok: true, stdout, stderr: stderr || "", error: null });
        }
      }
    );
  });
}

module.exports = { runAdb, getAdbPath, JW_LIBRARY_PACKAGE };
