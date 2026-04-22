"use client";

import clsx from "clsx";

/**
 * Sdílená karta / panel pro portál.
 *
 * Design tokeny:
 * - radius: `--wp-radius-card` (24px)
 * - bg: `--wp-surface-card`
 * - border: `--wp-surface-card-border`
 * - shadow: `shadow-sm` (běžné) / `shadow-[var(--wp-shadow-card)]` (hero)
 *
 * Použití:
 * ```tsx
 * <SectionCard>
 *   <SectionCardHeader title="Přehled" description="Klíčové metriky" actions={<Button .../>} />
 *   ...obsah
 * </SectionCard>
 * ```
 */

export type SectionCardTone = "default" | "muted" | "elevated";
export type SectionCardPadding = "none" | "sm" | "md" | "lg";

export interface SectionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: SectionCardTone;
  padding?: SectionCardPadding;
  as?: "div" | "section" | "article";
}

const TONE_CLASSES: Record<SectionCardTone, string> = {
  default: "bg-[color:var(--wp-surface-card)] border border-[color:var(--wp-surface-card-border)] shadow-sm",
  muted: "bg-[color:var(--wp-surface-muted)] border border-[color:var(--wp-surface-card-border)]",
  elevated: "bg-[color:var(--wp-surface-card)] border border-[color:var(--wp-surface-card-border)] shadow-[var(--wp-shadow-card)]",
};

const PADDING_CLASSES: Record<SectionCardPadding, string> = {
  none: "",
  sm: "p-3 md:p-4",
  md: "p-4 md:p-6",
  lg: "p-6 md:p-8",
};

export function SectionCard({
  tone = "default",
  padding = "md",
  as: Component = "div",
  className,
  children,
  ...rest
}: SectionCardProps) {
  return (
    <Component
      className={clsx(
        "rounded-[var(--wp-radius-card,24px)]",
        TONE_CLASSES[tone],
        PADDING_CLASSES[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}

export interface SectionCardHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  /** Velikost titulku. Default `md`. */
  size?: "sm" | "md" | "lg";
}

const TITLE_SIZE: Record<NonNullable<SectionCardHeaderProps["size"]>, string> = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
};

export function SectionCardHeader({
  title,
  description,
  actions,
  icon,
  className,
  size = "md",
}: SectionCardHeaderProps) {
  return (
    <div
      className={clsx(
        "mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        {icon ? <div className="shrink-0 mt-0.5">{icon}</div> : null}
        <div className="min-w-0">
          <h3
            className={clsx(
              "font-black tracking-tight text-[color:var(--wp-text)]",
              TITLE_SIZE[size],
            )}
          >
            {title}
          </h3>
          {description ? (
            <p className="mt-1 text-sm text-[color:var(--wp-text-secondary)]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
