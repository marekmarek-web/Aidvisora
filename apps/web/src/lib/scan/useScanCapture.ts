"use client";

import { useCallback, useMemo, useState } from "react";
import { useDocumentCapture } from "@/lib/upload/useDocumentCapture";
import { pickMultipleImagesFromGallery } from "@/lib/upload/webImagePick";
import { buildPdfFromImages } from "./pdfBuilder";
import { checkScanQuality, type ScanQualityResult, type ScanQualityIssue } from "./quality-checks";
import { normalizeScanImageForPdf, rotateScanImageFile } from "./normalize-page";
import { isNativeDocumentScannerUsable, scanDocumentsNative } from "./native-document-scan";

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

async function pipeNewPageFile(
  file: File,
  source: ScanPageCaptureSource
): Promise<{ file: File; quality: ScanQualityResult }> {
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
    try {
      const files = await scanDocumentsNative(remaining);
      if (files.length === 0) {
        const message = "Sken byl zrušen nebo neobsahuje stránky.";
        setError(message);
        return { ok: false, error: message };
      }

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
