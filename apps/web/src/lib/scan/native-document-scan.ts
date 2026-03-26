"use client";

import { Capacitor } from "@capacitor/core";
import {
  DocumentScanner,
  ResponseType,
  ScanDocumentResponseStatus,
  ScannerMode,
} from "@capgo/capacitor-document-scanner";

/** iOS + Android native shell only (Capgo uses system document UI; web throws). */
export async function isNativeDocumentScannerUsable(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  return Capacitor.isNativePlatform();
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
  const result = await DocumentScanner.scanDocument({
    maxNumDocuments: limit,
    responseType: ResponseType.ImageFilePath,
    scannerMode: ScannerMode.Full,
    contrast: 1,
    brightness: 0,
  });

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
  return files;
}
