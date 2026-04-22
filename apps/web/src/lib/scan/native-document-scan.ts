"use client";

import { Capacitor } from "@capacitor/core";
import {
  DocumentScanner,
  ResponseType,
  ScanDocumentResponseStatus,
  ScannerMode,
} from "@capgo/capacitor-document-scanner";

/**
 * Error codes we want the caller (`useScanCapture`) to be able to distinguish so it
 * can render an actionable Czech message. Anything else bubbles as an unknown error.
 */
export type NativeScanErrorCode =
  | "cancelled"
  | "permission_denied"
  | "plugin_unavailable"
  | "ml_kit_unavailable"
  | "no_usable_files"
  | "unknown";

export class NativeScanError extends Error {
  code: NativeScanErrorCode;
  cause?: unknown;
  constructor(code: NativeScanErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "NativeScanError";
    this.code = code;
    this.cause = cause;
  }
}

/** iOS + Android native shell only (Capgo uses system document UI; web throws). */
export async function isNativeDocumentScannerUsable(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  return Capacitor.isNativePlatform();
}

function classifyScanError(e: unknown): NativeScanError {
  const raw = e instanceof Error ? e.message : String(e ?? "unknown");
  const msg = raw.toLowerCase();
  if (msg.includes("cancel")) {
    return new NativeScanError("cancelled", "Skenování zrušeno.", e);
  }
  if (msg.includes("permission") || msg.includes("denied") || msg.includes("nscamera")) {
    return new NativeScanError(
      "permission_denied",
      "Aplikace nemá povolený přístup ke kameře. Povolte ho v Nastavení a zkuste znovu.",
      e
    );
  }
  if (msg.includes("not available") || msg.includes("notimplemented") || msg.includes("unimplemented")) {
    return new NativeScanError(
      "plugin_unavailable",
      "Skener dokumentů není v této verzi aplikace dostupný. Použijte fotoaparát nebo galerii.",
      e
    );
  }
  if (msg.includes("play services") || msg.includes("ml kit") || msg.includes("mlkit")) {
    return new NativeScanError(
      "ml_kit_unavailable",
      "Zařízení nemá nainstalované Google Play služby potřebné pro skener. Použijte fotoaparát.",
      e
    );
  }
  return new NativeScanError("unknown", raw || "Skenování se nezdařilo.", e);
}

function toFetchableUrl(pathOrUrl: string): string {
  const p = pathOrUrl.trim();
  if (p.startsWith("http://") || p.startsWith("https://") || p.startsWith("blob:") || p.startsWith("data:")) {
    return p;
  }
  return Capacitor.convertFileSrc(p);
}

/**
 * Opens OS document scanner (crop / perspective). Returns one JPEG File per page.
 */
export async function scanDocumentsNative(maxPages: number): Promise<File[]> {
  const limit = Math.min(Math.max(maxPages, 1), 24);
  let result: Awaited<ReturnType<typeof DocumentScanner.scanDocument>>;
  try {
    result = await DocumentScanner.scanDocument({
      maxNumDocuments: limit,
      responseType: ResponseType.ImageFilePath,
      scannerMode: ScannerMode.Full,
      contrast: 1,
      brightness: 0,
    });
  } catch (e) {
    throw classifyScanError(e);
  }

  if (result.status === ScanDocumentResponseStatus.Cancel) {
    return [];
  }

  const uris = result.scannedImages ?? [];
  if (uris.length === 0) {
    return [];
  }

  const files: File[] = [];
  for (let i = 0; i < uris.length; i++) {
    const raw = uris[i];
    if (!raw) continue;
    const url = toFetchableUrl(raw);
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const blob = await response.blob();
      const mime = blob.type || "image/jpeg";
      files.push(
        new File([blob], `doc-scan-${Date.now()}-${i}.jpg`, {
          type: mime.startsWith("image/") ? mime : "image/jpeg",
          lastModified: Date.now(),
        })
      );
    } catch {
      continue;
    }
  }

  // B2.11 — scanner vrátil URI, ale fetch/blob zkonvertoval 0 použitelných souborů
  // (např. content:// denial na Androidu, expired cache path). Bez tohoto throwu
  // UI tiše vrátilo prázdné pole a uživatel nevěděl, proč se nic nenahraje.
  if (uris.length > 0 && files.length === 0) {
    throw new NativeScanError(
      "no_usable_files",
      "Skener dokument nasnímal, ale nepodařilo se ho otevřít. Zkuste znovu nebo použijte galerii.",
    );
  }

  return files;
}
