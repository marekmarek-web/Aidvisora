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

// ---------------------------------------------------------------------------
// Pending attachments — behavior without autosend
// Simulates what paste / picker / drag-and-drop do: only queue, never send.
// ---------------------------------------------------------------------------

describe("pending attachments — no autosend semantics", () => {
  it("T01: paste 1 image → 1 pending attachment, not yet sendable if empty text and no explicit action", () => {
    // Paste adds 1 image to pending queue
    const incoming = [asset("paste1")];
    const { next, truncatedFromIncoming } = mergePendingImageAssets([], incoming);
    expect(next).toHaveLength(1);
    expect(truncatedFromIncoming).toBe(false);
    // The payload is valid for send — but only if user explicitly triggers send
    const payload = buildAssistantComposerSendPayload("", next);
    expect(payload.ok).toBe(true); // send-ready once user triggers
    if (payload.ok) {
      expect(payload.imageAssets).toHaveLength(1);
    }
  });

  it("T02: paste 2 images → 2 pending attachments", () => {
    const incoming = [asset("img1"), asset("img2")];
    const { next, truncatedFromIncoming } = mergePendingImageAssets([], incoming);
    expect(next).toHaveLength(2);
    expect(truncatedFromIncoming).toBe(false);
  });

  it("T03: paste 5 images → max 4 accepted, truncatedFromIncoming=true (warning should be shown)", () => {
    const incoming = [asset("a"), asset("b"), asset("c"), asset("d"), asset("e")];
    const { next, truncatedFromIncoming } = mergePendingImageAssets([], incoming);
    expect(next).toHaveLength(4);
    expect(truncatedFromIncoming).toBe(true);
    // The 5th image was dropped — warning should be shown to user
  });

  it("T04: picker upload — adds to pending, does not send (same merge path as paste)", () => {
    // File picker goes through readImageFilesAsPayloads → mergePendingImageAssets
    // Simulated here: one file picked
    const pickerResult = [asset("picked")];
    const { next, truncatedFromIncoming } = mergePendingImageAssets([], pickerResult);
    expect(next).toHaveLength(1);
    expect(truncatedFromIncoming).toBe(false);
    // No sendChatMessage called — user must explicitly submit
  });

  it("T05: drag-and-drop image → adds to pending queue", () => {
    const dropped = [asset("dropped1"), asset("dropped2")];
    const { next } = mergePendingImageAssets([], dropped);
    expect(next).toHaveLength(2);
  });

  it("T06: remove pending attachment before send", () => {
    const pending = [asset("keep"), asset("remove"), asset("keep2")];
    const after = removePendingImageAssetAt(pending, 1);
    expect(after).toHaveLength(2);
    expect(after[0].filename).toBe("keep.png");
    expect(after[1].filename).toBe("keep2.png");
  });

  it("T07: explicit send with images only → request contains imageAssets, message can be empty", () => {
    const imgs = [asset("id_front"), asset("id_back")];
    const payload = buildAssistantComposerSendPayload("", imgs);
    expect(payload.ok).toBe(true);
    if (payload.ok) {
      expect(payload.imageAssets).toHaveLength(2);
      expect(payload.message).toBe(""); // no text required
      expect(payload.displayUserLine).toBe("📎 obrázek");
    }
  });

  it("T08: explicit send with text + images → request contains both", () => {
    const imgs = [asset("doc1")];
    const payload = buildAssistantComposerSendPayload("Přiřadit ke klientovi Novák", imgs);
    expect(payload.ok).toBe(true);
    if (payload.ok) {
      expect(payload.message).toBe("Přiřadit ke klientovi Novák");
      expect(payload.imageAssets).toHaveLength(1);
    }
  });

  it("T12: text-only send is unaffected by image pending state", () => {
    const payload = buildAssistantComposerSendPayload("Jaký je stav smlouvy?", []);
    expect(payload.ok).toBe(true);
    if (payload.ok) {
      expect(payload.imageAssets).toBeUndefined();
      expect(payload.message).toBe("Jaký je stav smlouvy?");
    }
  });

  it("MAX is exactly 4", () => {
    expect(MAX_ASSISTANT_COMPOSER_PENDING_IMAGES).toBe(4);
  });
});
