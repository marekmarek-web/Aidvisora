"use client";

import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button, ButtonLink } from "./Button";

/**
 * SF3 – Sdílený `EmptyState` primitiv.
 *
 * Místo tří různých patternů v appce (dashed karta, plná karta, inline `<p>`)
 * jednotný kontejner s ikonou, nadpisem, popisem a 1–2 CTA.
 *
 * Výchozí vzhled drží se vzoru `contracts/review/page.tsx:418` (plná karta).
 */

export interface EmptyStateCta {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  variant?: "primary" | "secondary" | "link";
}

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  primaryAction?: EmptyStateCta;
  secondaryAction?: EmptyStateCta;
  /** Komprimovaná varianta (pro widgety v dashboardu). */
  size?: "sm" | "md" | "lg";
  /** Styl rámečku. */
  tone?: "card" | "dashed" | "plain";
  className?: string;
}

const SIZE_CLASSES = {
  sm: "py-6 px-4",
  md: "py-10 px-6",
  lg: "py-16 px-8",
} as const;

const ICON_WRAP_CLASSES = {
  sm: "w-10 h-10",
  md: "w-12 h-12",
  lg: "w-14 h-14",
} as const;

const ICON_SIZE = {
  sm: 18,
  md: 22,
  lg: 26,
} as const;

const TITLE_CLASSES = {
  sm: "text-sm font-bold",
  md: "text-base font-bold",
  lg: "text-lg font-bold",
} as const;

const DESC_CLASSES = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-sm",
} as const;

const TONE_CLASSES = {
  card: "rounded-[24px] border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)]",
  dashed:
    "rounded-[24px] border border-dashed border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)]/40",
  plain: "",
} as const;

function renderCta(cta: EmptyStateCta, kind: "primary" | "secondary") {
  const variant: "primary" | "secondary" | "link" =
    cta.variant ?? (kind === "primary" ? "primary" : "secondary");
  if (cta.href) {
    return (
      <ButtonLink href={cta.href} variant={variant} size="md" icon={cta.icon}>
        {cta.label}
      </ButtonLink>
    );
  }
  return (
    <Button
      type="button"
      onClick={cta.onClick}
      variant={variant}
      size="md"
      icon={cta.icon}
    >
      {cta.label}
    </Button>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  size = "md",
  tone = "card",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center text-center",
        TONE_CLASSES[tone],
        SIZE_CLASSES[size],
        className,
      )}
    >
      {Icon ? (
        <div
          className={clsx(
            "grid place-items-center rounded-2xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)] text-[color:var(--wp-text-tertiary)] mb-3",
            ICON_WRAP_CLASSES[size],
          )}
        >
          <Icon size={ICON_SIZE[size]} aria-hidden />
        </div>
      ) : null}
      <h3
        className={clsx(
          "text-[color:var(--wp-text)]",
          TITLE_CLASSES[size],
        )}
      >
        {title}
      </h3>
      {description ? (
        <p
          className={clsx(
            "mt-1 max-w-md text-[color:var(--wp-text-secondary)]",
            DESC_CLASSES[size],
          )}
        >
          {description}
        </p>
      ) : null}
      {primaryAction || secondaryAction ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {primaryAction ? renderCta(primaryAction, "primary") : null}
          {secondaryAction ? renderCta(secondaryAction, "secondary") : null}
        </div>
      ) : null}
    </div>
  );
}
