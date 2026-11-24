import type { ChipTone } from "../StatusChip";
import type { AppConfig, DeviceStatus } from "../../types/api";

export type ChipInfo = { label: string; tone: ChipTone; title?: string };

// Lógica pura (sem React): fácil de testar.
export function getAiChip(config: AppConfig | null): ChipInfo {
  if (!config) return { label: "IA…", tone: "neutral" };
  return config.aiProvider === "mock"
    ? { label: "IA simulada", tone: "warn", title: "As respostas são de teste, não vêm do Gemini." }
    : { label: "IA real", tone: "ok" };
}

export function getDeviceChip(
  config: AppConfig | null,
  status: DeviceStatus | null,
  statusError: string | null,
): ChipInfo {
  // Em modo simulado o /api/device/status ainda usa o ADB real, por isso ignora-se.
  if (config?.deviceMock) {
    return { label: "Telemóvel simulado", tone: "warn", title: "Nenhum telemóvel real é usado." };
  }
  if (statusError && !status) {
    return { label: "Servidor indisponível", tone: "err", title: statusError };
  }
  if (!status) return { label: "A verificar telemóvel…", tone: "neutral" };

  if (!status.adbAvailable || !status.deviceAuthorized) {
    return { label: "Telemóvel desligado", tone: "err", title: status.message };
  }
  if (!status.jwLibraryInstalled) {
    return { label: "JW Library não instalada", tone: "err", title: status.message };
  }
  if (!status.jwLibraryForeground) {
    return { label: "Abra a JW Library", tone: "warn", title: status.message };
  }
  return { label: "Telemóvel ligado", tone: "ok", title: status.message };
}
