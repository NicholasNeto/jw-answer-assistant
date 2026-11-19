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
