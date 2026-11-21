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

test("alvo: acha a caixa da pergunta certa e recusa se a pergunta não está visível", async () => {
  const { locateField, insertForQuestion } = require("../src/android/target");
  const r = (y) => ({ x1: 0, y1: y, x2: 100, y2: y + 50 });
  const nodes = [
    { text: "Quem são os dez homens hoje na pregação?", rect: r(0) },
    { text: "", editable: true, rect: r(100) },
    { text: "Como Jeová cuida dos seus servos fiéis hoje?", rect: r(200) },
    { text: "", editable: true, rect: r(300) },
  ];
  assert.deepEqual(locateField(nodes, "Como Jeová cuida dos seus servos fiéis hoje?"), { ok: true, x: 50, y: 325 });
  assert.equal(locateField(nodes, "Tema totalmente diferente sem relação nenhuma").code, "question_not_visible");

  // texto palavra a palavra, como no JW Library; o rótulo "Sua resposta" é ignorado
  const words = (t) => t.split(" ").map((w) => ({ text: w, rect: r(0) }));
  const real = [...words("1 . Por que é importante pregar em muitas línguas ?"), { text: "Sua resposta", rect: r(0) }, { text: "", editable: true, rect: r(500) },
    ...words("LEMBRA o que Jeová fez"), ...words("2 . Quem representa os dez homens hoje ?"), { text: "Sua resposta", rect: r(0) }, { text: "", editable: true, rect: r(900) }];
  assert.equal(locateField(real, "Por que é importante pregar em muitas línguas?").y, 525);
  assert.equal(locateField(real, "Quem representa os dez homens hoje?").y, 925);
  const off = real.map((n) => (n.editable ? { ...n, rect: { x1: 0, y1: 0, x2: 0, y2: 0 } } : n));
  assert.equal(locateField(off, "Quem representa os dez homens hoje?").code, "field_offscreen");

  const calls = [];
  const ok = await insertForQuestion("Como Jeová cuida dos seus servos fiéis hoje?", "resp", {
    readScreen: async () => ({ ok: true, nodes }),
    insertText: async () => ({ ok: true, method: "adbkeyboard" }),
    run: async (a) => (calls.push(a.join(" ")), { ok: true }),
    wait: async () => {},
  });
  assert.ok(ok.ok && ok.targeted);
  assert.equal(calls[0], "shell input tap 50 325");
  const no = await insertForQuestion("Pergunta que não aparece no ecrã atual nenhum", "x", { readScreen: async () => ({ ok: true, nodes }), insertText: async () => assert.fail("não devia inserir") });
  assert.equal(no.code, "question_not_visible");
});
