import "./AppHeader.css";
import StatusChip from "../StatusChip";
import { getAiChip, getDeviceChip } from "./chips";
import type { AppConfig, DeviceStatus } from "../../types/api";

type AppHeaderProps = {
  title?: string;
  config: AppConfig | null;
  deviceStatus: DeviceStatus | null;
  deviceStatusError?: string | null;
};

// Componente de apresentação: recebe dados por props; quem faz o fetch é o App.
export default function AppHeader({
  title = "JW Answer Assistant",
  config,
  deviceStatus,
  deviceStatusError = null,
}: AppHeaderProps) {
  const ai = getAiChip(config);
  const device = getDeviceChip(config, deviceStatus, deviceStatusError);

  return (
    <header className="app-header">
      <div className="app-header__brand">{title}</div>
      <div className="app-header__chips">
        <StatusChip {...ai} />
        <StatusChip {...device} />
      </div>
    </header>
  );
}
