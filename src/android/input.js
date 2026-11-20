const { runAdb } = require("./adb");

const ADB_KEYBOARD_IME = "com.android.adbkeyboard/.AdbIME";

// `adb shell input text` só aceita ASCII; espaços viram %s e metacaracteres do shell são escapados.
function isAscii(text) {
  return /^[\x20-\x7e\n]*$/.test(text);
}
function escapeForInputText(line) {
  return line.replace(/ /g, "%s").replace(/([\\'"&|;<>()$`!*?\[\]{}~#^])/g, "\\$1");
}

function fail(code, error) {
  return { ok: false, code, error };
}

// Insere texto no campo focado do telemóvel.
// Preferido: ADB Keyboard (aceita acentos). Alternativa: input text (só ASCII).
async function insertText(text, { serial = process.env.ADB_SERIAL, run = runAdb } = {}) {
  if (!text || !text.trim()) return fail("empty", "Não há texto para inserir.");
  const sh = (...args) => run(["shell", ...args], { serial });

  const ime = await sh("ime", "list", "-a", "-s");
  if (!ime.ok) return fail("adb", "Não consegui falar com o telemóvel (ligado e autorizado?).");

  if (ime.stdout.includes(ADB_KEYBOARD_IME)) {
    const prev = (await sh("settings", "get", "secure", "default_input_method")).stdout.trim();
    await sh("ime", "enable", ADB_KEYBOARD_IME);
    await sh("ime", "set", ADB_KEYBOARD_IME);
    const b64 = Buffer.from(text, "utf8").toString("base64");
    const r = await sh("am", "broadcast", "-a", "ADB_INPUT_B64", "--es", "msg", b64);
    if (prev && prev !== "null" && prev !== ADB_KEYBOARD_IME) await sh("ime", "set", prev);
    if (!r.ok) return fail("adb", "Falhou ao enviar o texto ao telemóvel.");
    return { ok: true, method: "adbkeyboard" };
  }

  if (!isAscii(text)) {
    return fail("needs_adbkeyboard", "O texto tem acentos e o ADB sozinho não os consegue escrever. Instale o 'ADB Keyboard' no telemóvel (veja o README).");
  }
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]) {
      const r = await sh("input", "text", escapeForInputText(lines[i]));
      if (!r.ok) return fail("adb", "Falhou ao escrever no telemóvel.");
    }
    if (i < lines.length - 1) await sh("input", "keyevent", "KEYCODE_ENTER");
  }
  return { ok: true, method: "input" };
}

module.exports = { insertText, escapeForInputText, isAscii, ADB_KEYBOARD_IME };
