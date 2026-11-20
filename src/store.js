const fs = require("fs");
const path = require("path");

const FILE = () => process.env.ANSWERS_FILE || path.join(__dirname, "..", "data", "answers.json");

function readAll() {
  try {
    return JSON.parse(fs.readFileSync(FILE(), "utf8"));
  } catch {
    return {};
  }
}

const keyOf = (url) => new URL(url).pathname;

function getAnswers(url) {
  return readAll()[keyOf(url)] || {};
}

function saveAnswer(url, number, text, model) {
  const all = readAll();
  const k = keyOf(url);
  all[k] = all[k] || {};
  all[k][number] = { text, model: model || null, savedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(FILE()), { recursive: true });
  fs.writeFileSync(FILE(), JSON.stringify(all, null, 2));
}

module.exports = { getAnswers, saveAnswer };
