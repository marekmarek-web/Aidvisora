"use client";

import clsx from "clsx";
import Link from "next/link";
import { forwardRef } from "react";
import type { LucideIcon } from "lucide-react";
import {
  portalPrimaryGradientBaseClassName,
} from "@/lib/ui/create-action-button-styles";

/**
 * SF1 – Sdílený `Button` primitiv pro celou appku (portál i klientská zóna).
 *
 * Velikosti:
 *   - `sm`  → min-h 36px (inline/toolbar akce)
 *   - `md`  → min-h 40px (default)
 *   - `lg`  → min-h 44px (mobile touch target, hlavní CTA)
 *
 * Varianty:
 *   - `primary`      → aidv gradient (viz `createActionButtonSurfaceClassName`)
 *   - `secondary`    → wp border + neutral
 *   - `destructive`  → rose (delete, zamítnout, odstranit)
 *   - `ghost`        → transparentní, hover muted
 *   - `link`         → jen text, bez padding boxu
 *
 * Používat místo ad-hoc `bg-indigo-600` / `bg-emerald-600` / `bg-rose-600`
 * tlačítek – jediný zdroj pravdy pro barvy, výšky a radius.
 */

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "destructive"
  | "ghost"
  | "link";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonBaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Ikona vlevo (z lucide-react). */
  icon?: LucideIcon;
  /** Ikona vpravo. */
  iconRight?: LucideIcon;
  /** Zobrazí spinner; button je automaticky disabled. */
  loading?: boolean;
  /** Blokové tlačítko (100% šířky rodiče). */
  fullWidth?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export interface ButtonProps
  extends ButtonBaseProps,
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonBaseProps> {}

export interface ButtonLinkProps
  extends ButtonBaseProps,
    Omit<
      React.AnchorHTMLAttributes<HTMLAnchorElement>,
      keyof ButtonBaseProps | "href"
    > {
  href: string;
  /** Pokud je `true`, použije `<a>` místo `next/link` (např. externí). */
  external?: boolean;
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "min-h-[36px] px-3 text-xs",
  md: "min-h-[40px] px-4 text-sm",
  lg: "min-h-[44px] px-5 text-sm",
};

const ICON_SIZE: Record<ButtonSize, number> = {
  sm: 14,
  md: 16,
  lg: 16,
};

const BASE_CLASSES = clsx(
  "inline-flex items-center justify-center gap-2",
  "rounded-xl font-bold",
  "transition-colors duration-150",
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
  "disabled:opacity-60 disabled:cursor-not-allowed",
  "no-underline",
);

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: clsx(
    portalPrimaryGradientBaseClassName,
    "rounded-xl font-bold no-underline",
  ),
  secondary: clsx(
    "bg-[color:var(--wp-surface-card)] text-[color:var(--wp-text)]",
    "border border-[color:var(--wp-surface-card-border)]",
    "hover:bg-[color:var(--wp-surface-muted)]",
    "focus-visible:ring-slate-400",
  ),
  destructive: clsx(
    "bg-rose-600 text-white border border-rose-600",
    "hover:bg-rose-700 hover:border-rose-700",
    "focus-visible:ring-rose-400",
    "shadow-sm",
  ),
  ghost: clsx(
    "bg-transparent text-[color:var(--wp-text-secondary)]",
    "hover:bg-[color:var(--wp-surface-muted)] hover:text-[color:var(--wp-text)]",
    "focus-visible:ring-slate-400",
  ),
  link: clsx(
    "bg-transparent text-indigo-600 dark:text-indigo-400",
    "hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline",
    "!px-0 !min-h-0 !py-0",
    "focus-visible:ring-indigo-400",
  ),
};

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg
      className="animate-spin"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        className="opacity-25"
      />
      <path
        d="M4 12a8 8 0 018-8"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        className="opacity-75"
      />
    </svg>
  );
}

function buildButtonClassName(props: {
  variant: ButtonVariant;
  size: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}): string {
  const { variant, size, fullWidth, className } = props;
  return clsx(
    BASE_CLASSES,
    VARIANT_CLASSES[variant],
    variant !== "link" && SIZE_CLASSES[size],
    fullWidth && "w-full",
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    icon: Icon,
    iconRight: IconRight,
    loading = false,
    fullWidth,
    className,
    disabled,
    type = "button",
    children,
    ...rest
  },
  ref,
) {
  const iconSize = ICON_SIZE[size];
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={buildButtonClassName({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading ? (
        <Spinner size={iconSize} />
      ) : Icon ? (
        <Icon size={iconSize} aria-hidden />
      ) : null}
      {children}
      {!loading && IconRight ? <IconRight size={iconSize} aria-hidden /> : null}
    </button>
  );
});

export function ButtonLink({
  variant = "secondary",
  size = "md",
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  fullWidth,
  className,
  children,
  href,
  external,
  ...rest
}: ButtonLinkProps) {
  const iconSize = ICON_SIZE[size];
  const finalClassName = buildButtonClassName({ variant, size, fullWidth, className });
  const content = (
    <>
      {loading ? (
        <Spinner size={iconSize} />
      ) : Icon ? (
        <Icon size={iconSize} aria-hidden />
      ) : null}
      {children}
      {!loading && IconRight ? <IconRight size={iconSize} aria-hidden /> : null}
    </>
  );
  if (external) {
    return (
      <a
        href={href}
        className={finalClassName}
        target="_blank"
        rel="noopener noreferrer"
        {...rest}
      >
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={finalClassName} {...rest}>
      {content}
    </Link>
  );
}
