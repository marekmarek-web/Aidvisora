/**
 * Spustí Android emulátor (preferuje Pixel / API 34–35).
 * S akcelerací (rychlejší). Pro vypnutí: set CAP_EMU_NO_ACCEL=1 (nebo použij -no-accel při problémech).
 * Po spuštění v Android Studiu zvol toto zařízení a klikni Run.
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

// Vynech API 36 (Baklava – vyžaduje VulkanVirtualQueue, často problémy). Preferuj 34, pak 35.
const no36 = (name) => !/36|API_36|Baklava/i.test(name);
const avdsStable = avds.filter(no36);
const list = avdsStable.length ? avdsStable : avds;
const pixel34 = list.find((a) => /pixel/i.test(a) && (/34|API_34/i.test(a)));
const any34 = list.find((a) => /34|API_34/i.test(a));
const any35 = list.find((a) => /35|API_35/i.test(a));
const avd = pixel34 || any34 || any35 || list[0];
const useAccel = process.env.CAP_EMU_ACCEL === "1" || process.env.CAP_EMU_ACCEL === "true";
const args = ["-avd", avd];
if (!useAccel) {
  args.push("-no-accel");
  console.log("Spouštím emulátor (bez CPU akcelerace, může být pomalejší):", avd);
} else {
  console.log("Spouštím emulátor (s akcelerací):", avd);
}
console.log("Až se spustí, v Android Studiu zvol toto zařízení a klikni Run.\n");

const child = spawn(emulatorPath, args, {
  stdio: "inherit",
  detached: true,
  windowsHide: false,
});
child.unref();
