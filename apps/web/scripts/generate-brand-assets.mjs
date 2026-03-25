/**
 * Builds Capacitor `assets/*` and web icons from repo root `logos/aidvisora-mark.png`.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const monorepoRoot = path.join(webRoot, "..", "..");
const sourcePath = path.join(monorepoRoot, "logos", "aidvisora-mark.png");
const assetsDir = path.join(webRoot, "assets");
const publicDir = path.join(webRoot, "public");

const black = { r: 0, g: 0, b: 0, alpha: 1 };

async function main() {
  await mkdir(assetsDir, { recursive: true });

  const iconSize = 1024;
  const logoMax = 880;
  const logoBuf = await sharp(sourcePath)
    .resize(logoMax, logoMax, { fit: "inside", withoutEnlargement: true })
    .toBuffer();

  await sharp({
    create: { width: iconSize, height: iconSize, channels: 4, background: black },
  })
    .composite([{ input: logoBuf, gravity: "center" }])
    .png()
    .toFile(path.join(assetsDir, "icon-only.png"));

  const splashSize = 2732;
  const splashSide = Math.round(splashSize * 0.35);
  const splashLogoBuf = await sharp(sourcePath)
    .resize(splashSide, splashSide, { fit: "inside", withoutEnlargement: true })
    .toBuffer();

  await sharp({
    create: { width: splashSize, height: splashSize, channels: 4, background: black },
  })
    .composite([{ input: splashLogoBuf, gravity: "center" }])
    .png()
    .toFile(path.join(assetsDir, "splash.png"));

  await sharp(path.join(assetsDir, "splash.png")).png().toFile(path.join(assetsDir, "splash-dark.png"));

  await sharp(path.join(assetsDir, "icon-only.png")).resize(512, 512).png().toFile(path.join(publicDir, "favicon.png"));

  await sharp(path.join(assetsDir, "icon-only.png")).resize(180, 180).png().toFile(path.join(publicDir, "apple-touch-icon.png"));

  console.log("Wrote assets/icon-only.png, splash.png, splash-dark.png, public/favicon.png, public/apple-touch-icon.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
