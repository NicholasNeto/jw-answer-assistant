const test = require("node:test");
const assert = require("node:assert");
const { parseStudyArticle, isStudyUrl } = require("../src/sources/study");

const HTML = `<h1><strong>Pregamos</strong></h1><p class="contextTtl" data-pid="1"><strong>16 A 22 DE NOVEMBRO</strong></p>
<p id="p40" data-pid="40" class="qu"> <strong>1.</strong> Porque é que pregamos? (<a class="b" href="/x">Romanos 10:13, 14</a>)</p>
<div class="gen-field" id="p41" data-pid="41"><textarea></textarea></div>
<p id="p7" data-pid="7" data-rel-pid="[40]"><span class="parNum" data-pnum="1"></span>LEMBRA-SE de Babel? <a class="b" href="/y">Gén. 11:6-9</a> Temos de pregar.</p>
<p id="p42" data-pid="42" class="qu"> <strong>2.</strong> O que profetizou Zacarias?</p>
<p id="p8" data-pid="8" data-rel-pid="[42]"><span class="parNum" data-pnum="2"><strong><sup>2</sup></strong></span> Zacarias disse algo.</p>
<p id="p9" data-pid="9" data-rel-pid="[42]">Segundo parágrafo.</p>`;

test("parseStudyArticle: pergunta -> parágrafos", () => {
  const a = parseStudyArticle(HTML);
  assert.strictEqual(a.title, "Pregamos");
  assert.strictEqual(a.questions.length, 2);
  assert.strictEqual(a.questions[0].number, 1);
  assert.strictEqual(a.questions[0].text, "Porque é que pregamos? (Romanos 10:13, 14)");
  assert.deepStrictEqual(a.questions[0].paragraphs, ["LEMBRA-SE de Babel? Gén. 11:6-9 Temos de pregar."]);
  assert.deepStrictEqual(a.questions[1].paragraphs, ["Zacarias disse algo.", "Segundo parágrafo."]);
});

test("isStudyUrl", () => {
  assert.ok(isStudyUrl("https://wol.jw.org/pt-PT/wol/d/r296/lp-tpo/2026562"));
  assert.ok(!isStudyUrl("https://wol.jw.org/pt/wol/h/r5/lp-t"));
  assert.ok(!isStudyUrl("https://evil.com/wol/d/x"));
});
