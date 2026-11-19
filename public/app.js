const list = document.getElementById("list");
const msg = document.getElementById("msg");

function row(ok, text) {
  const li = document.createElement("li");
  li.className = ok ? "ok" : "no";
  li.textContent = text;
  list.appendChild(li);
}

async function refresh() {
  try {
    const s = await (await fetch("/api/device/status")).json();
    list.replaceChildren();
    row(s.adbAvailable, "ADB disponível");
    const d = s.device;
    row(s.deviceAuthorized, d ? `Dispositivo autorizado: ${d.model || ""} ${d.serial}${d.androidVersion ? " (Android " + d.androidVersion + ")" : ""}` : "Dispositivo autorizado");
    row(s.jwLibraryInstalled, "JW Library instalada");
    row(s.jwLibraryForeground, "JW Library em primeiro plano");
    msg.textContent = s.message || s.error || "";
  } catch (e) {
    msg.textContent = "Erro ao contactar o servidor: " + e.message;
  }
}

document.getElementById("refresh").onclick = refresh;
refresh();
setInterval(refresh, 5000);

document.getElementById("copy").onclick = async () => {
  const out = document.getElementById("copyMsg");
  try {
    const r = await fetch("/api/clipboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: document.getElementById("answer").value }),
    });
    const j = await r.json();
    out.textContent = j.ok ? "✅ Copiado. Cole no Scrcpy com Ctrl+V." : "❌ " + j.error;
  } catch (e) {
    out.textContent = "❌ " + e.message;
  }
};

document.getElementById("ask").onclick = async () => {
  const out = document.getElementById("askMsg");
  out.textContent = "A pensar…";
  try {
    const r = await fetch("/api/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: document.getElementById("question").value }),
    });
    const j = await r.json();
    const src = document.getElementById("sources");
    src.replaceChildren();
    for (const s of j.sources || []) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = s.url; a.target = "_blank"; a.rel = "noopener";
      a.textContent = s.title + (s.reference ? " — " + s.reference : "");
      li.appendChild(a);
      src.appendChild(li);
    }
    if (j.ok && j.text) {
      document.getElementById("answer").value = j.text;
      out.textContent = "✅ Resposta abaixo (palavras: " + j.keywords.join(", ") + "). Reveja as fontes e edite antes de copiar.";
    } else if (j.ok) {
      out.textContent = "⚠️ " + j.reason;
    } else {
      out.textContent = "❌ " + j.error;
    }
  } catch (e) {
    out.textContent = "❌ " + e.message;
  }
};

let studyUrl = "";
let studyQuestions = [];
const answers = new Map(); // número -> {status, text, paragraphs, error, el}
let running = false;

const post = (url, body) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

function render(q) {
  const a = answers.get(q.number);
  const el = a.el;
  const labels = { pending: "", running: "⏳ a gerar…", done: "✅ pronta", error: "❌ " + (a.error || "") };
  el.status.textContent = labels[a.status];
  el.gen.disabled = !q.hasParagraph || a.status === "running";
  el.gen.textContent = a.status === "done" ? "Refazer" : "Preparar resposta";
  el.copy.hidden = el.show.hidden = a.status !== "done";
  el.text.hidden = a.status !== "done";
  if (a.status === "done" && el.text.value !== a.text && document.activeElement !== el.text) el.text.value = a.text;
}

async function generate(q, force) {
  const a = answers.get(q.number);
  if (a.status === "running" || (a.status === "done" && !force)) return;
  a.status = "running";
  render(q);
  try {
    const j = await post("/api/study/answer", { url: studyUrl, number: q.number });
    if (j.ok) Object.assign(a, { status: "done", text: j.text, paragraphs: j.paragraphs });
    else Object.assign(a, { status: "error", error: j.error });
  } catch (e) {
    Object.assign(a, { status: "error", error: e.message });
  }
  render(q);
}

function showAnswer(q) {
  const a = answers.get(q.number);
  document.getElementById("answer").value = a.el.text.value;
  document.getElementById("para").textContent = (a.paragraphs || []).join("\n\n");
  document.getElementById("paraBox").hidden = false;
}

async function copyText(text, out) {
  const j = await post("/api/clipboard", { text });
  out.textContent = j.ok ? "✅ copiado" : "❌ " + j.error;
}

async function generateAll() {
  if (running) return;
  running = true;
  const msg = document.getElementById("studyMsg");
  const todo = studyQuestions.filter((q) => q.hasParagraph && answers.get(q.number).status !== "done");
  for (let i = 0; i < todo.length; i++) {
    msg.textContent = `A preparar ${i + 1}/${todo.length}… (pode usar as já prontas enquanto espera)`;
    await generate(todo[i]);
  }
  msg.textContent = "✅ Concluído. Reveja cada resposta antes de copiar.";
  running = false;
}

document.getElementById("loadStudy").onclick = async () => {
  const msg = document.getElementById("studyMsg");
  const list = document.getElementById("studyList");
  msg.textContent = "A carregar…";
  list.replaceChildren();
  answers.clear();
  const j = await post("/api/study/load", { url: document.getElementById("studyUrl").value });
  if (!j.ok) { msg.textContent = "❌ " + j.error; return; }
  studyUrl = document.getElementById("studyUrl").value;
  studyQuestions = j.questions;
  msg.textContent = "✅ " + j.questions.length + " perguntas";
  document.getElementById("studyTitle").textContent = j.title + " — " + j.week;
  document.getElementById("genAll").hidden = false;
  if (j.studyLink) {
    const b = document.createElement("button");
    b.textContent = "Carregar o estudo bíblico de congregação desta semana";
    b.onclick = () => { document.getElementById("studyUrl").value = j.studyLink; document.getElementById("loadStudy").click(); };
    list.appendChild(b);
  }
  for (const q of j.questions) {
    const li = document.createElement("li");
    li.value = q.number || 0;
    li.append((q.section ? "[" + q.section + "] " : "") + q.text + " ");
    const el = {};
    el.gen = document.createElement("button");
    el.gen.onclick = () => generate(q, true);
    el.status = document.createElement("span");
    el.text = document.createElement("textarea");
    el.text.rows = 4; el.text.style.width = "100%";
    el.copy = document.createElement("button");
    el.copy.textContent = "Copiar";
    el.copy.onclick = () => copyText(el.text.value, el.status);
    el.show = document.createElement("button");
    el.show.textContent = "Ver com o texto-base";
    el.show.onclick = () => showAnswer(q);
    li.append(el.gen, " ", el.copy, " ", el.show, " ", el.status, el.text);
    answers.set(q.number, { status: "pending", el });
    render(q);
    list.appendChild(li);
  }
};

document.getElementById("genAll").onclick = generateAll;
