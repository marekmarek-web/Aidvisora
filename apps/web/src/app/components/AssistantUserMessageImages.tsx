"use client";

import type { ImageAssetPayload } from "@/lib/ai/assistant-chat-request";

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
      {imageAssets.map((a, i) => (
        <a
          key={`${i}-${a.url.slice(0, 48)}`}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg overflow-hidden border border-white/35 bg-black/10 max-h-36 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={a.url}
            alt={a.filename?.trim() ? a.filename : `Obrázek ${i + 1}`}
            className="max-h-36 max-w-[160px] object-contain"
          />
        </a>
      ))}
      {truncatedNote ? (
        <p className="w-full text-[11px] opacity-90 mt-1 leading-snug">{truncatedNote}</p>
      ) : null}
    </div>
  );
}
