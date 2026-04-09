/**
 * Ukládání náhledů obrázků z asistenta do assistant_messages.meta (data URL / storage URL).
 * Omezí velikost JSON, aby meta zůstala rozumná pro Postgres a serializaci.
 */

import type { ImageAssetPayload } from "./assistant-chat-request";
import type { ImageAssetInput } from "./image-intake/image-asset-input";

/** Horní odhad velikosti pole imageAssets v JSON (znaky). */
export const ASSISTANT_USER_MESSAGE_IMAGES_META_MAX_JSON_CHARS = 1_800_000;

function payloadFromInput(a: ImageAssetInput): ImageAssetPayload {
  return {
    url: a.url,
    mimeType: a.mimeType || "application/octet-stream",
    filename: a.filename ?? null,
    sizeBytes: typeof a.sizeBytes === "number" ? a.sizeBytes : undefined,
  };
}

/**
 * Vrátí podmnožinu obrázků, která se vejde do limitu (od konce odebírá, pokud je potřeba).
 */
export function buildImageAssetsForUserMessageMeta(assets: ImageAssetInput[]): {
  imageAssets: ImageAssetPayload[];
  chatImagesTruncatedForStorage: boolean;
} {
  if (!assets.length) {
    return { imageAssets: [], chatImagesTruncatedForStorage: false };
  }
  const payloads = assets.map(payloadFromInput).filter((p) => p.url.length > 0);
  if (!payloads.length) {
    return { imageAssets: [], chatImagesTruncatedForStorage: false };
  }
  let kept = [...payloads];
  let truncated = false;
  while (kept.length > 0) {
    if (JSON.stringify(kept).length <= ASSISTANT_USER_MESSAGE_IMAGES_META_MAX_JSON_CHARS) {
      return {
        imageAssets: kept,
        chatImagesTruncatedForStorage: truncated || kept.length < payloads.length,
      };
    }
    truncated = true;
    kept = kept.slice(0, -1);
  }
  return { imageAssets: [], chatImagesTruncatedForStorage: true };
}

export function parseImageAssetsFromMessageMeta(meta: Record<string, unknown> | null | undefined): {
  imageAssets: ImageAssetPayload[];
  truncatedFlag: boolean;
} {
  if (!meta) return { imageAssets: [], truncatedFlag: false };
  const ia = meta.imageAssets;
  const truncatedFlag = meta.chatImagesTruncatedForStorage === true;
  if (!Array.isArray(ia)) return { imageAssets: [], truncatedFlag };
  const imageAssets = ia
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .map((x) => ({
      url: typeof x.url === "string" ? x.url : "",
      mimeType: typeof x.mimeType === "string" ? x.mimeType : "application/octet-stream",
      filename: typeof x.filename === "string" ? x.filename : null,
      sizeBytes: typeof x.sizeBytes === "number" ? x.sizeBytes : undefined,
    }))
    .filter((x) => x.url.length > 0);
  return { imageAssets, truncatedFlag };
}
