"use client";

import Image from "next/image";

import { resolveInstitutionLogo } from "@/lib/institutions/institution-logo";

import { INSTITUTION_BRANDS } from "./demo-data";

type BrandKey = keyof typeof INSTITUTION_BRANDS;

export function LandingInstitutionLogo({
  institution,
  brand,
  size = "md",
  className = "",
}: {
  institution: string;
  brand: BrandKey;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims =
    size === "lg"
      ? { box: "h-11 w-11 rounded-xl", px: 44, text: "text-[12px]" }
      : size === "sm"
        ? { box: "h-7 w-7 rounded-md", px: 28, text: "text-[9px]" }
        : { box: "h-9 w-9 rounded-lg", px: 36, text: "text-[10px]" };

  const logo = resolveInstitutionLogo(institution);
  if (logo) {
    return (
      <div className={`flex items-center justify-center overflow-hidden bg-white ring-1 ring-black/5 ${dims.box} ${className}`}>
        <Image
          src={logo.src}
          alt={logo.alt}
          width={dims.px}
          height={dims.px}
          className="h-full w-full object-contain p-1.5"
          unoptimized
        />
      </div>
    );
  }

  const fallback = INSTITUTION_BRANDS[brand];
  return (
    <div
      className={`flex items-center justify-center font-black tracking-tight shadow-sm ${dims.box} ${dims.text} ${fallback.bg} ${fallback.fg} ${className}`}
      aria-hidden
    >
      {fallback.label}
    </div>
  );
}
