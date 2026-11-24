import AppHeader from "./components/AppHeader";
import "./App.css";
import ArticleLoader from "./components/ArticleLoader";
import { useApi } from "./hooks/useApi";
import type { AppConfig, DeviceStatus } from "./types/api";

export default function App() {
  const config = useApi<AppConfig>("/api/config");
  const device = useApi<DeviceStatus>("/api/device/status", 5000);

  return (
    <>
      <AppHeader
        config={config.data}
        deviceStatus={device.data}
        deviceStatusError={device.error}
      />

      <div className="layout">
        <main className="layout__main">
          <ArticleLoader
            onLoad={(url) => console.log(url)}
            article={{ title: "Sample Article", week: "Week 1", questions: 5 }}
          ></ArticleLoader>
          <p>Aqui vão as páginas e componentes.</p>
        </main>

        <aside className="layout__side"></aside>
      </div>
    </>
  );
}
