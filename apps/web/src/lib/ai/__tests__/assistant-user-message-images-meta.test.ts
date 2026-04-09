import { describe, it, expect } from "vitest";
import {
  ASSISTANT_USER_MESSAGE_IMAGES_META_MAX_JSON_CHARS,
  buildImageAssetsForUserMessageMeta,
  parseImageAssetsFromMessageMeta,
} from "../assistant-user-message-images-meta";

describe("buildImageAssetsForUserMessageMeta", () => {
  it("keeps small payloads", () => {
    const r = buildImageAssetsForUserMessageMeta([
      {
        url: "https://example.com/a.png",
        mimeType: "image/png",
        filename: "a.png",
        sizeBytes: 100,
      },
    ]);
    expect(r.imageAssets).toHaveLength(1);
    expect(r.chatImagesTruncatedForStorage).toBe(false);
  });

  it("returns empty when a single payload exceeds the meta limit", () => {
    const chunk = "x".repeat(ASSISTANT_USER_MESSAGE_IMAGES_META_MAX_JSON_CHARS + 50);
    const r = buildImageAssetsForUserMessageMeta([{ url: `data:,${chunk}`, mimeType: "image/png" }]);
    expect(r.imageAssets).toHaveLength(0);
    expect(r.chatImagesTruncatedForStorage).toBe(true);
  });
});

describe("parseImageAssetsFromMessageMeta", () => {
  it("reads imageAssets and truncated flag", () => {
    const r = parseImageAssetsFromMessageMeta({
      imageAssets: [{ url: "https://x/y", mimeType: "image/jpeg", filename: "f.jpg" }],
      chatImagesTruncatedForStorage: true,
    });
    expect(r.imageAssets).toHaveLength(1);
    expect(r.truncatedFlag).toBe(true);
  });
});
