import clsx from "clsx";
import Image from "next/image";
import s from "./AidvisoraLogoShimmerLoader.module.css";

const DEFAULT_FAVICON_SRC = "/logos/Aidvisora%20logo%20new%20fav.png";

export type AidvisoraLogoShimmerLoaderProps = {
  /** Text pod logem */
  caption?: string;
  logoSrc?: string;
  logoWidth?: number;
  logoHeight?: number;
  className?: string;
  /**
   * Tmavé pozadí stránky — světlý podpis a silnější shimmer (wordmark na černé).
   */
  darkSurface?: boolean;
  /** Širší wordmark (větší box, width:100 % obrázku) */
  wideLogo?: boolean;
};

export function AidvisoraLogoShimmerLoader({
  caption = "Načítám nástěnku…",
  logoSrc = DEFAULT_FAVICON_SRC,
  logoWidth = 120,
  logoHeight = 120,
  className,
  darkSurface = false,
  wideLogo = false,
}: AidvisoraLogoShimmerLoaderProps = {}) {
  return (
    <div className={clsx(s.wrap, darkSurface && s.wrapDark, className)}>
      <div className={clsx(s.logoBox, wideLogo && s.logoBoxWide)}>
        <Image
          src={logoSrc}
          alt=""
          width={logoWidth}
          height={logoHeight}
          className={clsx(s.logo, wideLogo && s.logoWide)}
          priority
        />
        <div className={s.shimmer} aria-hidden />
      </div>
      <p className={s.caption}>{caption}</p>
    </div>
  );
}
