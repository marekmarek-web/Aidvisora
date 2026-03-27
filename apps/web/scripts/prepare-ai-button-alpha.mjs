/**
 * Ai button.png má černé pozadí — pro bílé chipy potřebujeme průhlednou čerň.
 * Výstup: public/logos/ai-button-alpha.png
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const input = path.join(webRoot, "public", "logos", "Ai button.png");
const output = path.join(webRoot, "public", "logos", "ai-button-alpha.png");

const threshold = 42;

async function main() {
  if (!existsSync(input)) {
    console.error("Missing:", input);
    process.exit(1);
  }
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (channels !== 4) {
    console.error("Expected RGBA");
    process.exit(1);
  }
  const pixels = Buffer.from(data);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    if (r <= threshold && g <= threshold && b <= threshold) {
      pixels[i + 3] = 0;
    }
  }
  await sharp(pixels, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(output);
  console.log("Wrote", output);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
