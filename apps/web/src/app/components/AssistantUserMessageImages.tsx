"use client";

import type { ImageAssetPayload } from "@/lib/ai/assistant-chat-request";

const previewThumbClass =
  "block rounded-lg overflow-hidden border border-white/35 bg-black/10 max-h-36 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80";

/**
 * Prohlížeče často nezvládnou navigaci na velmi dlouhé `data:` URL (prázdný tab), zatímco `<img src>` funguje.
 * Otevření přes krátký blob: URL obejde limit délky adresního řádku.
 */
function openImageUrlInNewTab(url: string): void {
  if (url.startsWith("data:")) {
    try {
      const comma = url.indexOf(",");
      if (comma < 0) return;
      const header = url.slice(0, comma);
      const body = url.slice(comma + 1);
      const mimeMatch = /^data:([^;,]+)/i.exec(header);
      const mime = mimeMatch?.[1]?.split(";")[0]?.trim() || "application/octet-stream";
      const isBase64 = /;base64/i.test(header);
      const bytes = isBase64
        ? Uint8Array.from(atob(body.replace(/\s/g, "")), (c) => c.charCodeAt(0))
        : new TextEncoder().encode(decodeURIComponent(body));
      const blob = new Blob([bytes], { type: mime });
      const objectUrl = URL.createObjectURL(blob);
      const w = window.open(objectUrl, "_blank", "noopener,noreferrer");
      if (w) {
        setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
      } else {
        URL.revokeObjectURL(objectUrl);
      }
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

type Props = {
  imageAssets: ImageAssetPayload[];
  /** Zpráva pod náhledy (např. část obrázků se nevešla do úložiště). */
  truncatedNote?: string | null;
  /** Tailwind pro obal náhledů (drawer vs mobile). */
  className?: string;
};

/**
 * Náhledy obrázků v uživatelské bublině asistenta (data URL nebo HTTPS).
 */
export function AssistantUserMessageImages({
  imageAssets,
  truncatedNote,
  className = "flex flex-wrap gap-1.5 mt-2",
}: Props) {
  if (!imageAssets.length && !truncatedNote) return null;
  return (
    <div className={className}>
      {imageAssets.map((a, i) =>
        a.url.startsWith("data:") ? (
          <button
            key={`${i}-${a.url.slice(0, 48)}`}
            type="button"
            onClick={() => openImageUrlInNewTab(a.url)}
            title="Otevřít v novém panelu"
            className={`${previewThumbClass} cursor-pointer p-0`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.url}
              alt={a.filename?.trim() ? a.filename : `Obrázek ${i + 1}`}
              className="max-h-36 max-w-[160px] object-contain"
            />
          </button>
        ) : (
          <a
            key={`${i}-${a.url.slice(0, 48)}`}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Otevřít v novém panelu"
            className={previewThumbClass}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.url}
              alt={a.filename?.trim() ? a.filename : `Obrázek ${i + 1}`}
              className="max-h-36 max-w-[160px] object-contain"
            />
          </a>
        ),
      )}
      {truncatedNote ? (
        <p className="w-full text-[11px] opacity-90 mt-1 leading-snug">{truncatedNote}</p>
      ) : null}
    </div>
  );
}
