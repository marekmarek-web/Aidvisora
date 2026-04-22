"use client";

import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";

/**
 * Perf — Vimeo iframe = ~800 KB JavaScript + WebGL player pro každé video.
 * Dříve byly 4× Vimeo iframe vloženy do DOM už v initial HTML; přehrávač
 * player.vimeo.com začal stahovat svoje assety okamžitě po hydrataci, i když
 * uživatel na video nikdy neklikl.
 *
 * Teď vykreslíme jen statický <img> poster (Vimeo vystavuje `vumbnail.com` URL
 * s thumbnail přímo, bez JSON API), přes něj Play button. Teprve na klik
 * mountneme plný `<iframe>` s `autoplay=1`.
 *
 * Vimeo thumbnails URL pattern:
 *   https://vumbnail.com/{vimeoId}.jpg         (default, 640px)
 *   https://vumbnail.com/{vimeoId}_large.jpg   (640px)
 *   https://vumbnail.com/{vimeoId}_medium.jpg  (200px)
 *   https://vumbnail.com/{vimeoId}_small.jpg   (100px)
 *
 * Pozn.: preconnect pro `player.vimeo.com` a `i.vimeocdn.com` je v root layoutu.
 */
export function VimeoFacade({
  vimeoId,
  hash,
  title,
  thumbnailUrl,
  className = "",
}: {
  vimeoId: string;
  hash: string;
  title: string;
  thumbnailUrl?: string;
  className?: string;
}) {
  const [activated, setActivated] = useState(false);
  const poster = thumbnailUrl ?? `https://vumbnail.com/${vimeoId}.jpg`;

  if (activated) {
    return (
      <div className={`relative aspect-video bg-black ${className}`}>
        <iframe
          title={`Aidvisora — ${title}`}
          src={`https://player.vimeo.com/video/${vimeoId}?h=${hash}&dnt=1&autoplay=1`}
          className="absolute inset-0 w-full h-full"
          frameBorder={0}
          referrerPolicy="strict-origin-when-cross-origin"
          allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label={`Přehrát video: ${title}`}
      onClick={() => setActivated(true)}
      className={`group relative aspect-video w-full bg-black overflow-hidden cursor-pointer ${className}`}
    >
      {/*
        Perf — `unoptimized` = Vimeo thumbnail servírujeme tak jak je (vumbnail.com
        neprochází přes Next image optimizer, proxování by zvedlo build / runtime
        cost). Posters jsou už JPG ~30-60 KB, takže další optimalizace není nutná.
      */}
      <Image
        src={poster}
        alt={title}
        fill
        sizes="(max-width: 768px) 100vw, 50vw"
        className="object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
        loading="lazy"
        unoptimized
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          aria-hidden="true"
          className="flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 group-hover:bg-white/20 group-hover:scale-110 transition-all duration-300"
        >
          <Play className="w-7 h-7 md:w-9 md:h-9 text-white ml-1" fill="currentColor" />
        </span>
      </div>
    </button>
  );
}
