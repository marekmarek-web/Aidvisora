/**
 * Spustí Android emulátor BEZ hypervisoru (-no-accel).
 * Použij když ti Android Studio hází "hypervisor driver is not installed".
 * Po spuštění emulátoru v Android Studiu zvol toto zařízení a klikni Run.
 */
const { execSync, spawn } = require("child_process");
const path = require("path");
const os = require("os");

const isWin = os.platform() === "win32";
const localAppData = process.env.LOCALAPPDATA || process.env.HOME;
const sdkRoot =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  path.join(localAppData, "Android", "Sdk");
const emulatorPath = path.join(sdkRoot, "emulator", isWin ? "emulator.exe" : "emulator");

function listAvds() {
  try {
    const out = execSync(`"${emulatorPath}" -list-avds`, {
      encoding: "utf8",
      timeout: 10000,
    });
    return out
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);
  } catch (e) {
    console.error("Nepodařilo se načíst AVD. Je v PATH Android SDK?", sdkRoot);
    console.error(e.message);
    process.exit(1);
  }
}

const avds = listAvds();
if (avds.length === 0) {
  console.error("Žádný AVD nenalezen. Vytvoř emulátor v Android Studio (Device Manager).");
  process.exit(1);
}

// Preferuj API 34 (stabilnější), jinak první
const preferred = avds.find((a) => a.includes("34") || a.toLowerCase().includes("api 34"));
const avd = preferred || avds[0];

console.log("Spouštím emulátor (bez akcelerace, může být pomalejší):", avd);
console.log("Až se spustí, v Android Studiu zvol toto zařízení a klikni Run.\n");

const child = spawn(emulatorPath, ["-avd", avd, "-no-accel"], {
  stdio: "inherit",
  detached: true,
  windowsHide: false,
});
child.unref();
