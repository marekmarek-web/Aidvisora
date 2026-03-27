"use client";

import Link from "next/link";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Tailwind pro obal labelu (web vs. mobil). */
  className?: string;
  /** Tailwind pro text uvnitř (odkazy mohou dědit barvu). */
  textClassName?: string;
  linkClassName: string;
  inputClassName?: string;
};

/**
 * Povinný souhlas při registraci poradce (e-mail/OAuth) a vizuálně sladěné odkazy na právní dokumenty.
 */
export function AdvisorLegalConsentLabel({
  checked,
  onChange,
  className = "flex items-start gap-3 text-sm",
  textClassName = "",
  linkClassName,
  inputClassName = "mt-1 h-5 w-5 shrink-0 rounded border-white/20 accent-indigo-500",
}: Props) {
  return (
    <label className={`${className}`.trim()}>
      <input
        type="checkbox"
        required
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={inputClassName}
      />
      <span className={`leading-relaxed ${textClassName}`.trim()}>
        Potvrzuji, že jsem se seznámil(a) s{" "}
        <Link href="/terms" target="_blank" rel="noopener noreferrer" className={linkClassName}>
          obchodními podmínkami
        </Link>
        {", "}
        <Link href="/privacy" target="_blank" rel="noopener noreferrer" className={linkClassName}>
          zásadami zpracování osobních údajů
        </Link>
        {" a "}
        <Link
          href="/legal/zpracovatelska-smlouva"
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
        >
          zpracovatelskou smlouvou (DPA)
        </Link>
        {" a beru na vědomí "}
        <Link href="/legal/ai-disclaimer" target="_blank" rel="noopener noreferrer" className={linkClassName}>
          informace o AI režimu
        </Link>
        {" uvedené na webu."}
      </span>
    </label>
  );
}
