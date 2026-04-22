"use client";

import { useCallback, useMemo, useState } from "react";
import { useDocumentCapture } from "@/lib/upload/useDocumentCapture";
import { pickMultipleImagesFromGallery } from "@/lib/upload/webImagePick";
import { buildPdfFromImages } from "./pdfBuilder";
import { checkScanQuality, type ScanQualityResult, type ScanQualityIssue } from "./quality-checks";
import { normalizeScanImageForPdf, rotateScanImageFile } from "./normalize-page";
import { isNativeDocumentScannerUsable, scanDocumentsNative, NativeScanError } from "./native-document-scan";
import {
  breadcrumbNativeScanAttempt,
  breadcrumbNativeScanSuccess,
  captureNativeScanError,
  type ScanPlatform,
} from "@/lib/observability/scan-sentry";
import { Capacitor } from "@capacitor/core";

function resolveScanPlatform(): ScanPlatform {
  try {
    const p = Capacitor.getPlatform();
    if (p === "ios" || p === "android" || p === "web") return p;
    return "unknown";
  } catch {
    return "unknown";
  }
}

export type ScanCaptureResult = {
  ok: boolean;
  error?: string;
  qualityResult?: ScanQualityResult;
};

/** `native_scanner` = OS document UI (Capgo); already cropped — light post-process only. */
export type ScanPageCaptureSource = "camera" | "gallery" | "native_scanner";

export type ScanPage = {
  id: string;
  file: File;
  quality?: ScanQualityResult;
  captureSource?: ScanPageCaptureSource;
};

let _pageIdCounter = 0;
function nextPageId(): string {
  return `scan-page-${Date.now()}-${++_pageIdCounter}`;
}

/**
 * S2-C1: HEIC/HEIF detekce na web multi-page scan.
 *
 * iPhone default fotí v HEIC; Chrome/Firefox/Edge/Samsung Internet tento formát
 * neumí dekódovat přes `createImageBitmap`. Bez této detekce dostával uživatel
 * obecný "Zpracování stránky selhalo" nebo dokonce prázdný bitmap → černá stránka
 * v PDF. Safari HEIC dekóduje, takže tam propouštíme (lze stále selhat při
 * exotických HEIC variantách — chytneme to downstream).
 *
 * Cíl: vrátit konkrétní, akční chybovou hlášku HNED, aby poradce věděl, že má
 * buď (a) použít nativní Aidvisora aplikaci, nebo (b) přepnout iPhone na JPEG.
 */
function isHeicOrHeif(file: File): boolean {
  const mime = (file.type ?? "").toLowerCase();
  if (mime === "image/heic" || mime === "image/heif") return true;
  const name = (file.name ?? "").toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif");
}

function isSafariLike(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent ?? "";
  if (!/Safari/i.test(ua)) return false;
  // Chrome, Edge, Opera a většina Chromium browserů také obsahují "Safari" v UA,
  // ale Safari samotný NEmá "Chrome" / "Chromium" / "Edg" / "OPR".
  return !/Chrome|Chromium|CriOS|FxiOS|Edg|EdgiOS|OPR|OPT/i.test(ua);
}

const HEIC_REJECTION_MESSAGE =
  "HEIC/HEIF formát z iPhonu — prohlížeč ho neumí zobrazit. " +
  "Buď použijte mobilní aplikaci Aidvisora (tam HEIC funguje), nebo v telefonu " +
  "Nastavení → Fotoaparát → Formát → Nejkompatibilnější (uloží rovnou JPEG).";

async function pipeNewPageFile(
  file: File,
  source: ScanPageCaptureSource
): Promise<{ file: File; quality: ScanQualityResult }> {
  // S2-C1: HEIC hard-block na non-Safari prohlížečích. Bez tohoto guardu skončí
  // soubor v prázdném canvas → PDF stránka je černá, nebo selže `createImageBitmap`
  // s málo informativní chybou.
  if (isHeicOrHeif(file) && !isSafariLike()) {
    throw new Error(HEIC_REJECTION_MESSAGE);
  }
  const normalized = await normalizeScanImageForPdf(file, {
    enhanceContrast: source !== "native_scanner",
  });
  const quality = await checkScanQuality(normalized);
  return { file: normalized, quality };
}

export function useScanCapture() {
  const { captureFromCamera, isAvailable } = useDocumentCapture();
  const [scanPages, setScanPages] = useState<ScanPage[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isBuildingPdf, setIsBuildingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qualityWarnings, setQualityWarnings] = useState<ScanQualityIssue[]>([]);
  const [didManualRotate, setDidManualRotate] = useState(false);

  const pages = useMemo(() => scanPages.map((p) => p.file), [scanPages]);
  const pageIds = useMemo(() => scanPages.map((p) => p.id), [scanPages]);

  const capturePage = useCallback(async (): Promise<ScanCaptureResult> => {
    if (isCapturing) return { ok: false, error: "Fotoaparát se právě otevírá." };
    setIsCapturing(true);
    setQualityWarnings([]);
    try {
      const result = await captureFromCamera();
      if (!result.file) {
        const message = result.error ?? "Pořízení fotografie selhalo.";
        setError(message);
        return { ok: false, error: message };
      }

      const { file, quality } = await pipeNewPageFile(result.file, "camera");
      if (quality.issues.length > 0) {
        setQualityWarnings(quality.issues);
      }

      setScanPages((prev) => [...prev, { id: nextPageId(), file, quality, captureSource: "camera" }]);
      setError(null);
      return { ok: true, qualityResult: quality };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Zpracování stránky selhalo.";
      setError(message);
      return { ok: false, error: message };
    } finally {
      setIsCapturing(false);
    }
  }, [captureFromCamera, isCapturing]);

  const retakePage = useCallback(
    async (index: number): Promise<ScanCaptureResult> => {
      if (index < 0 || index >= scanPages.length) {
        return { ok: false, error: "Stránka pro přefocení nebyla nalezena." };
      }
      if (isCapturing) return { ok: false, error: "Fotoaparát se právě otevírá." };

      setIsCapturing(true);
      setQualityWarnings([]);
      try {
        const result = await captureFromCamera();
        if (!result.file) {
          const message = result.error ?? "Přefocení stránky selhalo.";
          setError(message);
          return { ok: false, error: message };
        }

        const { file, quality } = await pipeNewPageFile(result.file, "camera");
        if (quality.issues.length > 0) {
          setQualityWarnings(quality.issues);
        }

        setScanPages((prev) =>
          prev.map((page, pageIndex) =>
            pageIndex === index ? { ...page, file, quality, captureSource: "camera" } : page
          )
        );
        setError(null);
        return { ok: true, qualityResult: quality };
      } catch (e) {
        const message = e instanceof Error ? e.message : "Zpracování stránky selhalo.";
        setError(message);
        return { ok: false, error: message };
      } finally {
        setIsCapturing(false);
      }
    },
    [captureFromCamera, isCapturing, scanPages.length]
  );

  const removePage = useCallback((index: number) => {
    setScanPages((prev) => prev.filter((_, pageIndex) => pageIndex !== index));
  }, []);

  const reorderPages = useCallback((fromIndex: number, toIndex: number) => {
    setScanPages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const rotatePage = useCallback(
    async (index: number, direction: 1 | -1): Promise<ScanCaptureResult> => {
      if (index < 0 || index >= scanPages.length) {
        return { ok: false, error: "Stránka nebyla nalezena." };
      }
      setIsCapturing(true);
      setQualityWarnings([]);
      try {
        const prev = scanPages[index]!;
        const rotated = await rotateScanImageFile(prev.file, direction);
        const source = prev.captureSource ?? "camera";
        const normalized = await normalizeScanImageForPdf(rotated, {
          enhanceContrast: source !== "native_scanner",
        });
        const quality = await checkScanQuality(normalized);
        if (quality.issues.length > 0) {
          setQualityWarnings(quality.issues);
        }
        setScanPages((p) =>
          p.map((page, i) => (i === index ? { ...page, file: normalized, quality } : page))
        );
        setDidManualRotate(true);
        setError(null);
        return { ok: true, qualityResult: quality };
      } catch (e) {
        const message = e instanceof Error ? e.message : "Otočení selhalo.";
        setError(message);
        return { ok: false, error: message };
      } finally {
        setIsCapturing(false);
      }
    },
    [scanPages]
  );

  const clearPages = useCallback(() => {
    setScanPages([]);
    setError(null);
    setDidManualRotate(false);
  }, []);

  const addPagesFromGalleryBatch = useCallback(async (): Promise<ScanCaptureResult> => {
    if (isCapturing) return { ok: false, error: "Probíhá výběr souborů." };
    const remaining = 20 - scanPages.length;
    if (remaining <= 0) return { ok: false, error: "Limit 20 stran." };

    setIsCapturing(true);
    setQualityWarnings([]);
    try {
      const files = await pickMultipleImagesFromGallery(remaining);
      if (files.length === 0) {
        const message = "Výběr byl zrušen.";
        setError(message);
        return { ok: false, error: message };
      }

      const newPages: ScanPage[] = [];
      let lastQuality: ScanQualityResult | undefined;
      for (const file of files) {
        const { file: normalized, quality } = await pipeNewPageFile(file, "gallery");
        lastQuality = quality;
        newPages.push({ id: nextPageId(), file: normalized, quality, captureSource: "gallery" });
      }
      if (lastQuality && lastQuality.issues.length > 0) {
        setQualityWarnings(lastQuality.issues);
      }

      setScanPages((prev) => [...prev, ...newPages]);
      setError(null);
      return { ok: true, qualityResult: lastQuality };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Import selhal.";
      setError(message);
      return { ok: false, error: message };
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, scanPages.length]);

  const addPagesFromDocumentScanner = useCallback(async (): Promise<ScanCaptureResult> => {
    if (isCapturing) return { ok: false, error: "Sken probíhá." };
    const remaining = 20 - scanPages.length;
    if (remaining <= 0) return { ok: false, error: "Limit 20 stran." };

    const usable = await isNativeDocumentScannerUsable();
    if (!usable) {
      return { ok: false, error: "Skener dokumentů je dostupný jen v mobilní aplikaci Aidvisora." };
    }

    setIsCapturing(true);
    setQualityWarnings([]);
    const platform = resolveScanPlatform();
    const startedAt = Date.now();
    breadcrumbNativeScanAttempt({ tier: "native_capacitor", platform, maxPages: remaining });
    try {
      let files: File[];
      try {
        files = await scanDocumentsNative(remaining);
      } catch (nativeErr) {
        if (nativeErr instanceof NativeScanError) {
          captureNativeScanError({
            code: nativeErr.code,
            platform,
            tier: "native_capacitor",
            message: nativeErr.message,
          });
          if (nativeErr.code === "cancelled") {
            // User tapped Cancel — keep previously captured pages, clear error silently.
            setError(null);
            return { ok: false, error: nativeErr.message };
          }
          setError(nativeErr.message);
          return { ok: false, error: nativeErr.message };
        }
        captureNativeScanError({
          code: "unknown",
          platform,
          tier: "native_capacitor",
          message: nativeErr instanceof Error ? nativeErr.message : String(nativeErr),
        });
        throw nativeErr;
      }
      if (files.length === 0) {
        // `cancelled` path now handled above — this branch means zero-page success.
        const message = "Sken neobsahuje žádné stránky. Zkuste to znovu.";
        setError(null);
        return { ok: false, error: message };
      }
      breadcrumbNativeScanSuccess({
        tier: "native_capacitor",
        platform,
        pageCount: files.length,
        elapsedMs: Date.now() - startedAt,
      });

      const newPages: ScanPage[] = [];
      let lastQuality: ScanQualityResult | undefined;
      for (const file of files) {
        const { file: normalized, quality } = await pipeNewPageFile(file, "native_scanner");
        lastQuality = quality;
        newPages.push({ id: nextPageId(), file: normalized, quality, captureSource: "native_scanner" });
      }
      if (lastQuality && lastQuality.issues.length > 0) {
        setQualityWarnings(lastQuality.issues);
      }

      setScanPages((prev) => [...prev, ...newPages]);
      setError(null);
      return { ok: true, qualityResult: lastQuality };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sken dokumentu selhal.";
      setError(message);
      return { ok: false, error: message };
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, scanPages.length]);

  const buildPdf = useCallback(
    async (documentName?: string): Promise<File | null> => {
      if (scanPages.length === 0) return null;
      setIsBuildingPdf(true);
      try {
        const pdf = await buildPdfFromImages(
          scanPages.map((p) => p.file),
          { documentName }
        );
        return pdf;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Vytvoření PDF selhalo.";
        setError(message);
        return null;
      } finally {
        setIsBuildingPdf(false);
      }
    },
    [scanPages]
  );

  const canAddMore = useMemo(() => scanPages.length < 20, [scanPages.length]);

  const hasQualityIssues = useMemo(
    () => scanPages.some((p) => p.quality && !p.quality.ok),
    [scanPages]
  );

  // Unified scan-quality score (Batch 3 — release gate hint).
  // `aggregateQualityScore` = průměr přes stránky s vyhodnocenou kvalitou (0–100).
  // `worstQualityScore` = nejhorší kvalita jedné stránky — to je typicky to,
  // co zhorší OCR výsledek celého PDF.
  const { aggregateQualityScore, worstQualityScore } = useMemo(() => {
    const scored = scanPages
      .map((p) => p.quality?.score)
      .filter((s): s is number => typeof s === "number");
    if (scored.length === 0) {
      return { aggregateQualityScore: null as number | null, worstQualityScore: null as number | null };
    }
    const sum = scored.reduce((acc, s) => acc + s, 0);
    const avg = Math.round(sum / scored.length);
    const worst = scored.reduce((acc, s) => Math.min(acc, s), scored[0]);
    return { aggregateQualityScore: avg, worstQualityScore: worst };
  }, [scanPages]);

  return {
    pages,
    scanPages,
    pageIds,
    isAvailable,
    isCapturing,
    isBuildingPdf,
    error,
    canAddMore,
    qualityWarnings,
    hasQualityIssues,
    aggregateQualityScore,
    worstQualityScore,
    didManualRotate,
    setError,
    capturePage,
    addPagesFromGalleryBatch,
    addPagesFromDocumentScanner,
    retakePage,
    removePage,
    reorderPages,
    rotatePage,
    clearPages,
    buildPdf,
  };
}
