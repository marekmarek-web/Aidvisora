import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

/**
 * SF2 – Sdílené `Badge` a `StatusPill` primitivy.
 *
 * Cíl: jediný slovník tónů pro pills/chips/statusy napříč aplikací.
 *
 * - `<Badge variant="tag" />`     – neutrální krátký štítek (např. segment, doména)
 * - `<Badge variant="count" />`   – malý číselný pill
 * - `<Badge variant="metric" />`  – barevný výrazný pill (např. počet dní)
 * - `<StatusPill tone="..." />`   – sémantický stavový pill (intake, completed, …)
 */

export type BadgeTone =
  | "neutral"
  | "amber"
  | "blue"
  | "violet"
  | "emerald"
  | "rose"
  | "indigo";

export type BadgeSize = "xs" | "sm";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

const TONE_SOLID_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-800",
  amber: "bg-amber-100 text-amber-800",
  blue: "bg-blue-100 text-blue-800",
  violet: "bg-violet-100 text-violet-800",
  emerald: "bg-emerald-100 text-emerald-800",
  rose: "bg-rose-100 text-rose-800",
  indigo: "bg-indigo-100 text-indigo-800",
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  xs: "text-[10px] px-1.5 py-0.5",
  sm: "text-xs px-2 py-0.5",
};

const ICON_SIZE: Record<BadgeSize, number> = {
  xs: 10,
  sm: 12,
};

export type BadgeVariant = "tag" | "count" | "metric" | "status";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: BadgeSize;
  variant?: BadgeVariant;
  icon?: LucideIcon;
  children?: React.ReactNode;
}

export function Badge({
  tone = "neutral",
  size = "sm",
  variant = "tag",
  icon: Icon,
  className,
  children,
  ...rest
}: BadgeProps) {
  const isSolid = variant === "status" || variant === "metric";
  const base = clsx(
    "inline-flex items-center gap-1 font-bold leading-none",
    "uppercase tracking-wide",
    variant === "count" ? "rounded-md" : "rounded-full",
    SIZE_CLASSES[size],
    isSolid ? TONE_SOLID_CLASSES[tone] : TONE_CLASSES[tone],
    variant === "tag" && "border",
    className,
  );
  const iconSize = ICON_SIZE[size];
  return (
    <span className={base} {...rest}>
      {Icon ? <Icon size={iconSize} className="shrink-0" aria-hidden /> : null}
      {children}
    </span>
  );
}

export interface StatusPillProps
  extends Omit<BadgeProps, "variant" | "tone"> {
  tone: BadgeTone;
}

/**
 * Tenký wrapper nad `Badge` specificky pro stavy (variant="status", solid tón).
 */
export function StatusPill({ tone, size = "sm", ...rest }: StatusPillProps) {
  return <Badge {...rest} variant="status" tone={tone} size={size} />;
}
