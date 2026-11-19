const path = require("path");
const fs = require("fs");

const envFile = path.join(__dirname, "..", ".env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const express = require("express");
const { getDeviceStatus } = require("./android/status");
const { copyToClipboard } = require("./clipboard");

const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/device/status", async (_req, res) => {
  try {
    res.json(await getDeviceStatus());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/clipboard", async (req, res) => {
  try {
    await copyToClipboard(req.body && req.body.text);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, "127.0.0.1", () => {
  console.log(`JW Answer Assistant em http://localhost:${port}`);
});
