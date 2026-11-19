const test = require("node:test");
const assert = require("node:assert");
const { parseMidweekArticle, parseVerseSpec, extractVerses, parseParagraphNumbers, extractByPid } = require("../src/sources/midweek");

const html = `<h1>16 A 22 DE NOVEMBRO</h1>
<h3 data-pid="5">2. Pérolas espirituais</h3>
<p data-pid="13"><a href="/pt-PT/wol/bc/r296/lp-tpo/1/3/0" class="b">Lam. 2:1</a> — Porquê? (<a href="/wol/rslink/r296/lp-tpo?docid=1&amp;beginpar=2&amp;endpar=2"><em>w07</em> § 1</a>)</p>
<div class="gen-field"><textarea></textarea></div>
<p data-pid="14">Que pérolas encontrou?</p><div class="gen-field"></div>`;

test("midweek: perguntas e referências", () => {
  const a = parseMidweekArticle(html);
  assert.equal(a.questions.length, 2);
  assert.deepEqual(a.questions[0].refs.map((r) => r.kind), ["bc", "pc"]);
  assert.equal(a.questions[1].refs.length, 0);
});

test("midweek: versículos e parágrafos", () => {
  assert.deepEqual(parseVerseSpec("Apo. 7:9, 10", null), { chapter: 7, verses: [9, 10] });
  assert.deepEqual(parseVerseSpec("14", 7), { chapter: 7, verses: [14] });
  const v = '<span id="v1-2-1-1" class="v"><a class="vl">1</a> Texto <a class="fn">*</a>um</span><span id="v1-2-2-1" class="v">dois</span>';
  assert.equal(extractVerses(v, 2, [1]), "1 Texto um");
  assert.deepEqual(parseParagraphNumbers("w24 §§ 7-9"), [7, 8, 9]);
  assert.deepEqual(extractByPid('<p data-pid="2">A</p><p data-pid="3">B</p>', 2, 2), ["A"]);
});
