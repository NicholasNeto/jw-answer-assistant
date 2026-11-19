const test = require("node:test");
const assert = require("node:assert");
const { isOfficialUrl, fetchOfficial } = require("../src/sources/official");
const { extractKeywords, parseSearchResults } = require("../src/sources/wol");
const { answerFromOfficialSources, buildPrompt } = require("../src/answer");

test("isOfficialUrl: só https e hosts exatos", () => {
  assert.ok(isOfficialUrl("https://wol.jw.org/pt/wol/d/r5/lp-t/1"));
  assert.ok(isOfficialUrl("https://www.jw.org/pt/"));
  for (const u of ["http://wol.jw.org/", "https://wol.jw.org.evil.com/", "https://evil.com/wol.jw.org", "https://user@wol.jw.org/", "https://wol.jw.org:8443/", "ftp://wol.jw.org/", "lixo"])
    assert.ok(!isOfficialUrl(u), u);
});

test("fetchOfficial: bloqueia redirecionamento para fora", async () => {
  const fake = async () => ({ status: 302, ok: false, headers: new Map([["location", "https://evil.com/x"]]) });
  await assert.rejects(fetchOfficial("https://wol.jw.org/a", { fetchImpl: fake }), /não oficial/);
});

test("extractKeywords remove stopwords", () => {
  assert.deepStrictEqual(extractKeywords("Por que Jael demonstrou coragem?"), ["jael", "demonstrou", "coragem"]);
});

const HTML = `<li class="caption"><a class="lnk" href="/pt/wol/d/r5/lp-t/1102025917?q=Jael&amp;p=par">“A mais abençoada”</a></li>
<li class="result"><li class="searchResult"><div class="document"><p>Baraque elogiou <span class="mk">Jael</span>. </p> <strong>...</strong> <p>Ela agiu &ldquo;bem&rdquo;.</p></div></li><li class="ref">wcg cap. 17 - Coragem</li></li>`;

test("parseSearchResults", () => {
  const r = parseSearchResults(HTML);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].url, "https://wol.jw.org/pt/wol/d/r5/lp-t/1102025917");
  assert.deepStrictEqual(r[0].paragraphs, ["Baraque elogiou Jael.", "Ela agiu “bem”."]);
  assert.strictEqual(r[0].reference, "wcg cap. 17 - Coragem");
});

test("answer: sem fontes não chama a IA; com fontes inclui-as no prompt", async () => {
  let called = 0;
  const gen = async (p) => { called++; return { text: "ok [1]", model: "m", p }; };
  const page = (html) => async () => ({ status: 200, ok: true, headers: new Map(), text: async () => html });
  const none = await answerFromOfficialSources("Jael coragem", { fetchImpl: page("<html></html>"), generate: gen });
  assert.strictEqual(none.text, null);
  assert.strictEqual(called, 0);
  const some = await answerFromOfficialSources("Jael coragem", { fetchImpl: page(HTML), generate: gen });
  assert.strictEqual(some.text, "ok [1]");
  assert.strictEqual(some.sources[0].url, "https://wol.jw.org/pt/wol/d/r5/lp-t/1102025917");
  assert.match(buildPrompt("q", [{ title: "T", reference: "R", paragraphs: ["p1"] }]), /\[1\] T \(R\)\np1/);
});
