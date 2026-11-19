const test = require("node:test");
const assert = require("node:assert");
const { parseDevices, parseInstalled, parseForeground } = require("../src/android/status");

test("parseDevices: autorizado, não autorizado, vazio", () => {
  const out = "List of devices attached\n* daemon started successfully\nRQCRB00CXHM\tdevice\nXYZ\tunauthorized\n\n";
  assert.deepStrictEqual(parseDevices(out), [
    { serial: "RQCRB00CXHM", state: "device" },
    { serial: "XYZ", state: "unauthorized" },
  ]);
  assert.deepStrictEqual(parseDevices("List of devices attached\n\n"), []);
});

test("parseInstalled: correspondência exata", () => {
  assert.ok(parseInstalled("package:org.jw.jwlibrary.mobile\n", "org.jw.jwlibrary.mobile"));
  assert.ok(!parseInstalled("package:org.jw.jwlibrary.mobile.beta\n", "org.jw.jwlibrary.mobile"));
  assert.ok(!parseInstalled("", "org.jw.jwlibrary.mobile"));
});

test("parseForeground: mCurrentFocus", () => {
  const d = "  mCurrentFocus=Window{1a2b u0 org.jw.jwlibrary.mobile/org.jw.jwlibrary.mobile.activity.SiloContainer}\n  mFocusedApp=null";
  assert.deepStrictEqual(parseForeground(d), {
    package: "org.jw.jwlibrary.mobile",
    activity: "org.jw.jwlibrary.mobile.activity.SiloContainer",
  });
});

test("parseForeground: fallback mFocusedApp e outra app", () => {
  const d = "  mCurrentFocus=null\n  mFocusedApp=ActivityRecord{abc u0 com.android.launcher/.Launcher t5}";
  assert.strictEqual(parseForeground(d).package, "com.android.launcher");
  assert.strictEqual(parseForeground("nada"), null);
});
