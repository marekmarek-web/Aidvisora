import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, "..", "icons");
const dest = path.join(__dirname, "..", "public", "icons");

if (!fs.existsSync(src)) {
  console.warn("No apps/web/icons — run `npx capacitor-assets generate` first.");
  process.exit(0);
}

fs.mkdirSync(dest, { recursive: true });
for (const f of fs.readdirSync(src)) {
  if (f.endsWith(".webp")) {
    fs.copyFileSync(path.join(src, f), path.join(dest, f));
  }
}
console.log("Copied PWA webp icons to public/icons/");
