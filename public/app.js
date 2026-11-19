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
document.getElementById("loadStudy").onclick = async () => {
  const msg = document.getElementById("studyMsg");
  const list = document.getElementById("studyList");
  msg.textContent = "A carregar…";
  list.replaceChildren();
  const r = await fetch("/api/study/load", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: document.getElementById("studyUrl").value }) });
  const j = await r.json();
  if (!j.ok) { msg.textContent = "❌ " + j.error; return; }
  studyUrl = document.getElementById("studyUrl").value;
  msg.textContent = "✅ " + j.questions.length + " perguntas";
  document.getElementById("studyTitle").textContent = j.title + " — " + j.week;
  for (const q of j.questions) {
    const li = document.createElement("li");
    li.value = q.number || 0;
    li.append(q.text + " ");
    const b = document.createElement("button");
    b.textContent = "Preparar resposta";
    b.disabled = !q.hasParagraph;
    b.onclick = () => answerStudy(q.number, b);
    li.appendChild(b);
    list.appendChild(li);
  }
};

async function answerStudy(number, btn) {
  const msg = document.getElementById("studyMsg");
  btn.disabled = true;
  msg.textContent = "A preparar a pergunta " + number + " (pode demorar até 1–2 min)…";
  try {
    const r = await fetch("/api/study/answer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: studyUrl, number }) });
    const j = await r.json();
    if (!j.ok) { msg.textContent = "❌ " + j.error; return; }
    document.getElementById("answer").value = j.text;
    document.getElementById("para").textContent = j.paragraphs.join("\n\n");
    document.getElementById("paraBox").hidden = false;
    msg.textContent = "✅ Pergunta " + number + " pronta abaixo. Reveja com o parágrafo antes de copiar.";
  } catch (e) {
    msg.textContent = "❌ " + e.message;
  } finally {
    btn.disabled = false;
  }
}
