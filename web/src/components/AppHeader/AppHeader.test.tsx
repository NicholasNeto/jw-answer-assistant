import { render, screen } from "@testing-library/react";
import AppHeader from "./AppHeader";
import { getAiChip, getDeviceChip } from "./chips";
import type { AppConfig, DeviceStatus } from "../../types/api";

const realConfig: AppConfig = { aiProvider: "gemini", deviceMock: false };
const okStatus: DeviceStatus = {
  adbAvailable: true,
  adbPath: "adb",
  device: "ABC123",
  deviceAuthorized: true,
  jwLibraryInstalled: true,
  jwLibraryForeground: true,
  foregroundPackage: "org.jw.jwlibrary.mobile",
  message: "Tudo pronto",
};

describe("getAiChip", () => {
  it("avisa quando a IA é simulada", () => {
    expect(getAiChip({ aiProvider: "mock", deviceMock: false })).toMatchObject({
      label: "IA simulada",
      tone: "warn",
    });
  });

  it("mostra 'IA real' para outros fornecedores", () => {
    expect(getAiChip(realConfig)).toMatchObject({ label: "IA real", tone: "ok" });
  });

  it("fica neutro enquanto a config não chega", () => {
    expect(getAiChip(null).tone).toBe("neutral");
  });
});

describe("getDeviceChip", () => {
  it("ignora o status em modo de telemóvel simulado", () => {
    const chip = getDeviceChip({ aiProvider: "mock", deviceMock: true }, null, null);
    expect(chip).toMatchObject({ label: "Telemóvel simulado", tone: "warn" });
  });

  it("indica servidor indisponível quando o fetch falha", () => {
    expect(getDeviceChip(realConfig, null, "Failed to fetch").tone).toBe("err");
  });

  it("indica desligado sem ADB ou sem autorização", () => {
    expect(getDeviceChip(realConfig, { ...okStatus, adbAvailable: false }, null).label).toBe(
      "Telemóvel desligado",
    );
    expect(getDeviceChip(realConfig, { ...okStatus, deviceAuthorized: false }, null).label).toBe(
      "Telemóvel desligado",
    );
  });

  it("pede para abrir a JW Library quando não está em primeiro plano", () => {
    const chip = getDeviceChip(realConfig, { ...okStatus, jwLibraryForeground: false }, null);
    expect(chip).toMatchObject({ label: "Abra a JW Library", tone: "warn" });
  });

  it("mostra ligado quando está tudo certo", () => {
    expect(getDeviceChip(realConfig, okStatus, null)).toMatchObject({
      label: "Telemóvel ligado",
      tone: "ok",
    });
  });
});

describe("AppHeader", () => {
  it("mostra o título e os dois chips", () => {
    render(
      <AppHeader config={{ aiProvider: "mock", deviceMock: false }} deviceStatus={okStatus} />,
    );
    expect(screen.getByText("JW Answer Assistant")).toBeInTheDocument();
    expect(screen.getByText("IA simulada")).toBeInTheDocument();
    expect(screen.getByText("Telemóvel ligado")).toBeInTheDocument();
  });

  it("aceita um título personalizado", () => {
    render(<AppHeader title="Outro" config={null} deviceStatus={null} />);
    expect(screen.getByText("Outro")).toBeInTheDocument();
  });
});
