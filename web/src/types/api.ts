export type AppConfig = {
  aiProvider: "mock" | "gemini" | string;
  deviceMock: boolean;
};

export type DeviceStatus = {
  adbAvailable: boolean;
  adbPath: string;
  device: string | null;
  deviceAuthorized: boolean;
  jwLibraryInstalled: boolean;
  jwLibraryForeground: boolean;
  foregroundPackage: string | null;
  message: string;
};
