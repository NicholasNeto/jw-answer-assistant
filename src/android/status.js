const { runAdb, getAdbPath, JW_LIBRARY_PACKAGE } = require("./adb");

// ---- Parsers puros (testáveis sem dispositivo) ----

function parseDevices(output) {
  return output
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("*"))
    .map((l) => {
      const [serial, state] = l.split(/\s+/);
      return { serial, state };
    });
}

function parseInstalled(output, pkg) {
  return output.split(/\r?\n/).some((l) => l.trim() === `package:${pkg}`);
}

// Extrai o pacote da janela/atividade com foco a partir de `dumpsys window`.
function parseForeground(dumpsys) {
  const lines = dumpsys.split(/\r?\n/);
  const re = /([A-Za-z][\w.]*)\/([\w.$]+)/;
  for (const key of ["mCurrentFocus", "mFocusedApp"]) {
    for (const line of lines) {
      if (!line.includes(key) || line.includes("=null")) continue;
      const m = line.match(re);
      if (m) return { package: m[1], activity: m[2] };
    }
  }
  return null;
}

// ---- Orquestração ----

async function getDeviceStatus() {
  const status = {
    adbAvailable: false,
    adbPath: getAdbPath(),
    device: null,
    deviceAuthorized: false,
    jwLibraryInstalled: false,
    jwLibraryForeground: false,
    foregroundPackage: null,
    message: "",
  };

  const devices = await runAdb(["devices"]);
  if (!devices.ok) {
    status.message =
      devices.error === "ADB_NOT_FOUND"
        ? "ADB não encontrado. Defina ADB_PATH no ficheiro .env."
        : `Erro ao executar o ADB: ${devices.error}`;
    return status;
  }
  status.adbAvailable = true;

  const list = parseDevices(devices.stdout);
  const wanted = process.env.ADB_SERIAL;
  const chosen = wanted
    ? list.find((d) => d.serial === wanted)
    : list.find((d) => d.state === "device") || list[0];

  if (!chosen) {
    status.message = "Nenhum dispositivo Android ligado.";
    return status;
  }
  status.device = chosen;
  if (chosen.state === "unauthorized") {
    status.message = "Dispositivo não autorizado. Aceite a depuração USB no telemóvel.";
    return status;
  }
  if (chosen.state !== "device") {
    status.message = `Dispositivo em estado '${chosen.state}'.`;
    return status;
  }
  status.deviceAuthorized = true;

  const serial = chosen.serial;
  const [model, release, pkgs, win] = await Promise.all([
    runAdb(["shell", "getprop", "ro.product.model"], { serial }),
    runAdb(["shell", "getprop", "ro.build.version.release"], { serial }),
    runAdb(["shell", "pm", "list", "packages", JW_LIBRARY_PACKAGE], { serial }),
    runAdb(["shell", "dumpsys", "window"], { serial, timeout: 15000 }),
  ]);
  status.device = {
    ...chosen,
    model: model.stdout.trim() || null,
    androidVersion: release.stdout.trim() || null,
  };
  status.jwLibraryInstalled = pkgs.ok && parseInstalled(pkgs.stdout, JW_LIBRARY_PACKAGE);
  const fg = win.ok ? parseForeground(win.stdout) : null;
  status.foregroundPackage = fg ? fg.package : null;
  status.jwLibraryForeground = !!fg && fg.package === JW_LIBRARY_PACKAGE;

  status.message = !status.jwLibraryInstalled
    ? "JW Library não está instalada no dispositivo."
    : status.jwLibraryForeground
    ? "Tudo pronto: JW Library aberta em primeiro plano."
    : "JW Library instalada, mas não está em primeiro plano.";
  return status;
}

module.exports = { getDeviceStatus, parseDevices, parseInstalled, parseForeground };
