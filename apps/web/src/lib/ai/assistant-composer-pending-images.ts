import type { ImageAssetPayload } from "@/lib/ai/assistant-chat-client";

/** Max images queued in composer before Send (drawer + mobile). */
export const MAX_ASSISTANT_COMPOSER_PENDING_IMAGES = 4;

export type MergePendingImageAssetsResult = {
  next: ImageAssetPayload[];
  /** True when some incoming items were dropped because the queue is full or would exceed max. */
  truncatedFromIncoming: boolean;
};

/**
 * Append incoming image payloads to the existing pending list, capped at `max`.
 */
export function mergePendingImageAssets(
  existing: ImageAssetPayload[],
  incoming: ImageAssetPayload[],
  max = MAX_ASSISTANT_COMPOSER_PENDING_IMAGES,
): MergePendingImageAssetsResult {
  if (incoming.length === 0) {
    return { next: existing, truncatedFromIncoming: false };
  }
  const space = max - existing.length;
  if (space <= 0) {
    return { next: existing, truncatedFromIncoming: true };
  }
  const take = incoming.slice(0, space);
  const truncatedFromIncoming = incoming.length > take.length;
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
