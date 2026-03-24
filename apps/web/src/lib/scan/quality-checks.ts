/**
 * Client-side quality checks for scanned document images.
 * Runs lightweight heuristics on captured photos before upload
 * to catch common issues (blur, darkness, poor crop) early.
 */

export type ScanQualityIssue = {
  code: "too_dark" | "too_bright" | "low_resolution" | "likely_blurry" | "small_area" | "aspect_ratio_unusual";
  severity: "warning" | "error";
  message: string;
};

export type ScanQualityResult = {
  ok: boolean;
  score: number;
  issues: ScanQualityIssue[];
};

const MIN_DIMENSION = 800;
const MIN_AREA = 800 * 600;
const DARKNESS_THRESHOLD = 60;
const BRIGHTNESS_THRESHOLD = 230;
const BLUR_LAPLACIAN_THRESHOLD = 15;

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for quality check"));
    };
    img.src = url;
  });
}

function getImageData(img: HTMLImageElement, maxDim = 512): ImageData {
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function computeBrightness(imageData: ImageData): { mean: number; std: number } {
  const { data } = imageData;
  let sum = 0;
  let sumSq = 0;
  const pixelCount = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sum += lum;
    sumSq += lum * lum;
  }
  const mean = sum / pixelCount;
  const std = Math.sqrt(sumSq / pixelCount - mean * mean);
  return { mean, std };
}

/**
 * Approximate Laplacian variance as a blur metric.
 * Lower values indicate a blurrier image.
 */
function computeLaplacianVariance(imageData: ImageData): number {
  const { data, width, height } = imageData;
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }

  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const lap =
        -4 * gray[idx] +
        gray[idx - 1] +
        gray[idx + 1] +
        gray[idx - width] +
        gray[idx + width];
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  if (count === 0) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

export async function checkScanQuality(file: File): Promise<ScanQualityResult> {
  const issues: ScanQualityIssue[] = [];

  try {
    const img = await loadImageFromFile(file);
    const { width, height } = img;
    const area = width * height;

    if (width < MIN_DIMENSION && height < MIN_DIMENSION) {
      issues.push({
        code: "low_resolution",
        severity: "error",
        message: "Rozlišení fotografie je příliš nízké. Zkuste fotit z kratší vzdálenosti.",
      });
    }

    if (area < MIN_AREA) {
      issues.push({
        code: "small_area",
        severity: "warning",
        message: "Fotografie je velmi malá. Text nemusí být čitelný.",
      });
    }

    const aspectRatio = Math.max(width, height) / Math.min(width, height);
    if (aspectRatio > 3) {
      issues.push({
        code: "aspect_ratio_unusual",
        severity: "warning",
        message: "Poměr stran je neobvyklý. Zkontrolujte, zda je vyfocen celý dokument.",
      });
    }

    const imageData = getImageData(img);
    const { mean: brightness } = computeBrightness(imageData);

    if (brightness < DARKNESS_THRESHOLD) {
      issues.push({
        code: "too_dark",
        severity: "error",
        message: "Fotografie je příliš tmavá. Foťte na dobře osvětleném místě.",
      });
    }

    if (brightness > BRIGHTNESS_THRESHOLD) {
      issues.push({
        code: "too_bright",
        severity: "warning",
        message: "Fotografie je přesvětlená. Vyhněte se přímému světlu na dokument.",
      });
    }

    const laplacianVar = computeLaplacianVariance(imageData);
    if (laplacianVar < BLUR_LAPLACIAN_THRESHOLD) {
      issues.push({
        code: "likely_blurry",
        severity: "error",
        message: "Fotografie je pravděpodobně rozmazaná. Držte telefon pevně a počkejte na zaostření.",
      });
    }

    const errorCount = issues.filter((i) => i.severity === "error").length;
    const warningCount = issues.filter((i) => i.severity === "warning").length;
    const score = Math.max(0, 100 - errorCount * 30 - warningCount * 10);

    return { ok: errorCount === 0, score, issues };
  } catch {
    return { ok: true, score: 50, issues: [] };
  }
}

export function formatQualityIssues(issues: ScanQualityIssue[]): string {
  return issues.map((i) => `${i.severity === "error" ? "⚠" : "ℹ"} ${i.message}`).join("\n");
}
