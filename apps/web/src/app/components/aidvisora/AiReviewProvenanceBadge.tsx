"use client";

import Link from "next/link";
import { Sparkles, CheckCircle2, Clock, PenLine } from "lucide-react";
import type { AiProvenanceKind } from "@/lib/portal/ai-review-provenance";

export type { AiProvenanceKind } from "@/lib/portal/ai-review-provenance";

export type AiReviewProvenanceBadgeProps = {
  /**
   * confirmed     = poradce explicitně potvrdil pole
   * auto_applied  = zapsáno automaticky z AI Review
   * pending_review = čeká na potvrzení poradcem
   * manual        = vyžaduje ruční doplnění
   */
  kind: AiProvenanceKind;
  /** ID AI Review, pro odkaz na detail */
  reviewId?: string | null;
  /** Datum potvrzení poradcem (ISO string nebo Date) */
  confirmedAt?: string | Date | null;
  /** Extra CSS třídy pro wrapping span */
  className?: string;
};

const BADGE_CONFIG: Record<
  AiProvenanceKind,
  { label: string; icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>; iconColor: string; textColor: string }
> = {
  confirmed: {
    label: "Potvrzeno z AI Review",
    icon: CheckCircle2,
    iconColor: "text-emerald-500",
    textColor: "text-[color:var(--wp-text-tertiary)]",
  },
  auto_applied: {
    label: "Převzato z AI Review",
    icon: Sparkles,
    iconColor: "text-indigo-400",
    textColor: "text-[color:var(--wp-text-tertiary)]",
  },
  pending_review: {
    label: "Čeká na potvrzení",
    icon: Clock,
    iconColor: "text-amber-500",
    textColor: "text-amber-700",
  },
  manual: {
    label: "Vyžaduje ruční doplnění",
    icon: PenLine,
    iconColor: "text-slate-400",
    textColor: "text-slate-500",
  },
};

/**
 * Vizuální provenance badge pro pole kontaktu/smlouvy.
 *
 * confirmed      → "Potvrzeno z AI Review"      (zelená)
 * auto_applied   → "Převzato z AI Review"        (indigo)
 * pending_review → "Čeká na potvrzení"           (jantarová)
 * manual         → "Vyžaduje ruční doplnění"     (šedá)
 */
export function AiReviewProvenanceBadge({
  kind,
  reviewId,
  confirmedAt,
  className = "",
}: AiReviewProvenanceBadgeProps) {
  const { label, icon: Icon, iconColor, textColor } = BADGE_CONFIG[kind];

  const dateStr = confirmedAt
    ? new Date(confirmedAt).toLocaleDateString("cs-CZ", {
        day: "numeric",
        month: "numeric",
        year: "numeric",
      })
    : null;

  const showLink = reviewId && (kind === "confirmed" || kind === "auto_applied" || kind === "pending_review");

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] leading-none ${textColor} ${className}`}
    >
      <Icon className={`w-3 h-3 shrink-0 ${iconColor}`} aria-hidden />
      {showLink ? (
        <Link
          href={`/portal/contracts/review/${reviewId}`}
          className="hover:text-indigo-600 transition-colors underline-offset-2 hover:underline"
          title="Zobrazit AI Review"
        >
          {label}
        </Link>
      ) : (
        <span>{label}</span>
      )}
      {dateStr ? (
        <span className="opacity-70">· {dateStr}</span>
      ) : null}
    </span>
  );
}
