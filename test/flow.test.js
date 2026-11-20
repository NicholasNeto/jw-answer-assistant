const test = require("node:test");
const assert = require("node:assert");
const os = require("os");
const path = require("path");
const { parseUiDump, readScreen } = require("../src/android/screen");
const { insertText, escapeForInputText } = require("../src/android/input");
const { matchQuestion } = require("../src/match");

const xml = `<?xml version='1.0'?><hierarchy><node text="Porque é que temos de pregar &amp; ensinar?" class="android.widget.TextView" bounds="[0,0][1,1]"/>
<node text="" content-desc="Parágrafo 3" class="android.view.View"/><node text="" class="android.widget.EditText" focused="true"/></hierarchy>UI hierarchy dumped to: /dev/tty`;

test("ecrã: parse do uiautomator", async () => {
  const p = parseUiDump(xml);
  assert.deepEqual(p.texts, ["Porque é que temos de pregar & ensinar?", "Parágrafo 3"]);
  assert.ok(p.focusedEditField);
  const r = await readScreen({ run: async () => ({ ok: true, stdout: xml }) });
  assert.ok(r.ok && r.texts.length === 2);
  assert.equal((await readScreen({ run: async () => ({ ok: false, error: "x" }) })).ok, false);
});

test("match: escolhe a pergunta certa e rejeita ecrã sem relação", () => {
  const qs = [
    { number: 1, text: "Porque é que temos de pregar numa língua que as pessoas entendam?" },
    { number: 2, text: "Como é que Jeová cuida dos seus servos fiéis hoje?" },
  ];
  const m = matchQuestion(["2. Como é que Jeová cuida dos seus servos fiéis hoje?"], qs);
  assert.ok(m.found && m.number === 2 && !m.ambiguous);
  assert.equal(matchQuestion(["Definições do telemóvel"], qs).found, false);
});

test("inserir: ADB Keyboard (acentos) restaura o teclado; sem ele só ASCII", async () => {
  const calls = [];
  const withKb = async (args) => {
    calls.push(args.join(" "));
    if (args.includes("list")) return { ok: true, stdout: "com.android.adbkeyboard/.AdbIME\ncom.x/.Y\n" };
    if (args.includes("get")) return { ok: true, stdout: "com.x/.Y\n" };
    return { ok: true, stdout: "" };
  };
  const r = await insertText("Olá, é isto", { run: withKb });
  assert.equal(r.method, "adbkeyboard");
  assert.match(calls.find((c) => c.includes("ADB_INPUT_B64")), new RegExp(Buffer.from("Olá, é isto").toString("base64")));
  assert.equal(calls[calls.length - 1], "shell ime set com.x/.Y");

  const noKb = async () => ({ ok: true, stdout: "com.x/.Y\n" });
  assert.equal((await insertText("Olá", { run: noKb })).code, "needs_adbkeyboard");
  assert.equal((await insertText("hello world", { run: noKb })).method, "input");
  assert.equal(escapeForInputText("a b&c"), "a%sb\\&c");
});

test("store: guarda e lê respostas por artigo", () => {
  process.env.ANSWERS_FILE = path.join(os.tmpdir(), `ans-${process.pid}.json`);
  const store = require("../src/store");
  store.saveAnswer("https://wol.jw.org/pt/wol/d/r1/x/123", 2, "resp", "mock");
  assert.equal(store.getAnswers("https://wol.jw.org/pt/wol/d/r1/x/123")[2].text, "resp");
  assert.deepEqual(store.getAnswers("https://wol.jw.org/pt/wol/d/r1/x/999"), {});
});
