import Image from "next/image";
import s from "./AidvisoraLogoShimmerLoader.module.css";

export function AidvisoraLogoShimmerLoader() {
  return (
    <div className={s.wrap}>
      <div className={s.logoBox}>
        <Image
          src="/logos/Aidvisora%20logo%20new%20fav.png"
          alt=""
          width={120}
          height={120}
          className={s.logo}
          priority
        />
        <div className={s.shimmer} aria-hidden />
      </div>
      <p className={s.caption}>Načítám nástěnku…</p>
    </div>
  );
}
