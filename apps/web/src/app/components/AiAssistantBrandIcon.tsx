"use client";

import clsx from "clsx";

export const AI_ASSISTANT_BRAND_LOGO_SRC = "/logos/Ai%20button.png";

type Props = {
  /** CSS pixel size (width & height of the icon box) */
  size?: number;
  className?: string;
  /** Lucide-compatible; ignored — for drop-in nav items */
  strokeWidth?: number;
};

/**
 * Brand mark „Ai“ pro AI asistenta / AI Review (nahrazuje Sparkles).
 */
export function AiAssistantBrandIcon({ size = 24, className }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small static brand asset
    <img
      src={AI_ASSISTANT_BRAND_LOGO_SRC}
      alt=""
      width={size}
      height={size}
      className={clsx("object-contain shrink-0", className)}
      aria-hidden
    />
  );
}
