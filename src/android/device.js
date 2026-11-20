// Fachada do dispositivo: real (adb) ou simulada (--mock-device / DEVICE_MOCK=1), para desenvolver sem telemóvel.
const { insertForQuestion } = require("./target");
const real = { readScreen: require("./screen").readScreen, insertText: require("./input").insertText };

const inserted = [];
const mock = {
  async readScreen({ questions = [] } = {}) {
    const n = Number(process.env.MOCK_OPEN_QUESTION || 1);
    const q = questions.find((x) => x.number === n) || questions[0];
    const texts = ["JW Library", "Reunião", q ? q.text : "Sem perguntas carregadas", "Escreva a sua resposta"];
    return { ok: true, texts, hasEditField: true, focusedEditField: true };
  },
  async insertText(text) {
    if (!text || !text.trim()) return { ok: false, code: "empty", error: "Não há texto para inserir." };
    inserted.push(text);
    console.log("[mock-device] texto inserido:", text.slice(0, 80));
    return { ok: true, method: "mock" };
  },
};

async function insertForQuestionFacade(question, text) {
  if (isMock()) return { ...(await mock.insertText(text)), targeted: true };
  return insertForQuestion(question, text, real);
}

const isMock = () => process.env.DEVICE_MOCK === "1";
module.exports = {
  readScreen: (o) => (isMock() ? mock : real).readScreen(o),
  insertText: (t, o) => (isMock() ? mock : real).insertText(t, o),
  insertForQuestion: insertForQuestionFacade,
  isMock,
  mockInserted: inserted,
};
