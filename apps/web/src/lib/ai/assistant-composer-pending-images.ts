import type { ImageAssetPayload } from "@/lib/ai/assistant-chat-client";

/** Max images queued in composer before Send (drawer + mobile). */
export const MAX_ASSISTANT_COMPOSER_PENDING_IMAGES = 4;

export type MergePendingImageAssetsResult = {
  next: ImageAssetPayload[];
  /** True when some incoming items were dropped because the queue is full or would exceed max. */
  truncatedFromIncoming: boolean;
};

/**
 * M27: stable content key for deduping composer images. Uses the data-URL
 * payload when available (content-addressed), otherwise falls back to the
 * legacy name+size+type tuple. Filesystem-level `File` objects are normalized
 * to payloads before hitting this merger, so the URL is available in practice.
 */
function contentKey(asset: ImageAssetPayload): string {
  if (typeof asset.url === "string" && asset.url.length > 0) {
    return asset.url;
  }
  return `${asset.filename ?? ""}:${asset.sizeBytes ?? ""}:${asset.mimeType ?? ""}`;
}

/**
 * Append incoming image payloads to the existing pending list, capped at `max`.
 * Dedups by content hash (see `contentKey`) — M27.
 */
export function mergePendingImageAssets(
  existing: ImageAssetPayload[],
  incoming: ImageAssetPayload[],
  max = MAX_ASSISTANT_COMPOSER_PENDING_IMAGES,
): MergePendingImageAssetsResult {
  if (incoming.length === 0) {
    return { next: existing, truncatedFromIncoming: false };
  }
  const seen = new Set(existing.map(contentKey));
  const uniqueIncoming: ImageAssetPayload[] = [];
  for (const a of incoming) {
    const k = contentKey(a);
    if (seen.has(k)) continue;
    seen.add(k);
    uniqueIncoming.push(a);
  }
  const space = max - existing.length;
  if (space <= 0) {
    return { next: existing, truncatedFromIncoming: uniqueIncoming.length > 0 };
  }
  const take = uniqueIncoming.slice(0, space);
  const truncatedFromIncoming = uniqueIncoming.length > take.length;
  return {
    next: [...existing, ...take],
    truncatedFromIncoming,
  };
}

export function removePendingImageAssetAt(
  assets: ImageAssetPayload[],
  index: number,
): ImageAssetPayload[] {
  if (index < 0 || index >= assets.length) return assets;
  return assets.filter((_, i) => i !== index);
}

export type AssistantComposerSendPayload =
  | { ok: false; reason: "empty" }
  | {
      ok: true;
      message: string;
      imageAssets: ImageAssetPayload[] | undefined;
      displayUserLine: string;
    };

/** Pure check for “can send” and how the user bubble should read (tests + parity with UI). */
export function buildAssistantComposerSendPayload(
  trimmedText: string,
  pendingImages: ImageAssetPayload[],
): AssistantComposerSendPayload {
  const hasText = trimmedText.length > 0;
  const hasImages = pendingImages.length > 0;
  if (!hasText && !hasImages) return { ok: false, reason: "empty" };
  return {
    ok: true,
    message: trimmedText,
    imageAssets: hasImages ? pendingImages : undefined,
    displayUserLine: hasText ? trimmedText : "📎 obrázek",
  };
}
