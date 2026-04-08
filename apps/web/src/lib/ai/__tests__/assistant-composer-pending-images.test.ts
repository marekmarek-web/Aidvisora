import { describe, it, expect } from "vitest";
import {
  mergePendingImageAssets,
  removePendingImageAssetAt,
  MAX_ASSISTANT_COMPOSER_PENDING_IMAGES,
  buildAssistantComposerSendPayload,
} from "@/lib/ai/assistant-composer-pending-images";
import type { ImageAssetPayload } from "@/lib/ai/assistant-chat-client";

function asset(id: string): ImageAssetPayload {
  return {
    url: `data:image/png;base64,${id}`,
    mimeType: "image/png",
    filename: `${id}.png`,
    sizeBytes: 10,
  };
}

describe("mergePendingImageAssets", () => {
  it("merges up to max total", () => {
    const a = [asset("a")];
    const b = [asset("b"), asset("c"), asset("d"), asset("e")];
    const { next, truncatedFromIncoming } = mergePendingImageAssets(a, b);
    expect(next.length).toBe(MAX_ASSISTANT_COMPOSER_PENDING_IMAGES);
    expect(truncatedFromIncoming).toBe(true);
  });

  it("returns unchanged when queue full", () => {
    const full = [asset("1"), asset("2"), asset("3"), asset("4")];
    const { next, truncatedFromIncoming } = mergePendingImageAssets(full, [asset("x")]);
    expect(next).toEqual(full);
    expect(truncatedFromIncoming).toBe(true);
  });
});

describe("removePendingImageAssetAt", () => {
  it("removes by index", () => {
    const list = [asset("a"), asset("b")];
    expect(removePendingImageAssetAt(list, 0)).toEqual([asset("b")]);
  });
});

describe("buildAssistantComposerSendPayload", () => {
  it("rejects empty", () => {
    expect(buildAssistantComposerSendPayload("", [])).toEqual({ ok: false, reason: "empty" });
  });

  it("text-only has no imageAssets", () => {
    const p = buildAssistantComposerSendPayload("hello", []);
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.message).toBe("hello");
      expect(p.imageAssets).toBeUndefined();
      expect(p.displayUserLine).toBe("hello");
    }
  });

  it("image-only is valid", () => {
    const imgs = [asset("z")];
    const p = buildAssistantComposerSendPayload("", imgs);
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.message).toBe("");
      expect(p.imageAssets).toEqual(imgs);
      expect(p.displayUserLine).toBe("📎 obrázek");
    }
  });
});
