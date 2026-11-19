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
    const r = await fetch("/api/ai/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: document.getElementById("question").value }),
    });
    const j = await r.json();
    if (j.ok) {
      document.getElementById("answer").value = j.text;
      out.textContent = "✅ Resposta abaixo (modelo " + j.model + "). Reveja/edite antes de copiar.";
    } else {
      out.textContent = "❌ " + j.error;
    }
  } catch (e) {
    out.textContent = "❌ " + e.message;
  }
};
