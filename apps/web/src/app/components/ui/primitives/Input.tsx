"use client";

import clsx from "clsx";
import { forwardRef } from "react";

/**
 * Sdílený `Input` primitiv pro portál i klientskou zónu.
 *
 * Výchozí vzhled odpovídá design systému (viz `docs/DESIGN_SYSTEM.md`):
 * - border z `--wp-surface-card-border`
 * - focus ring z `--wp-focus-ring-color`
 * - min-h 44px (mobile touch target)
 * - rounded-xl (8px ≈ --wp-pill-radius × 2)
 *
 * Ne `bg-slate-*` / `#hex` — vše přes tokeny.
 */

export type InputSize = "sm" | "md" | "lg";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  inputSize?: InputSize;
  /** Zobrazí chybový stav (červený border). */
  invalid?: boolean;
  /** Dodatečné utility třídy. */
  className?: string;
}

const SIZE_CLASSES: Record<InputSize, string> = {
  sm: "min-h-[36px] px-3 text-xs",
  md: "min-h-[40px] px-3.5 text-sm",
  lg: "min-h-[44px] px-4 text-sm",
};

export const inputBaseClassName = clsx(
  "block w-full rounded-xl",
  "bg-[color:var(--wp-surface-card)] text-[color:var(--wp-text)]",
  "border border-[color:var(--wp-surface-card-border)]",
  "placeholder:text-[color:var(--wp-text-tertiary)]",
  "transition-colors duration-150",
  "focus:outline-none focus:ring-2 focus:ring-[color:var(--wp-focus-ring-color)] focus:border-transparent",
  "disabled:opacity-60 disabled:cursor-not-allowed",
);

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { inputSize = "lg", invalid, className, type = "text", ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={clsx(
        inputBaseClassName,
        SIZE_CLASSES[inputSize],
        invalid && "!border-rose-400 focus:!ring-rose-300",
        className,
      )}
      {...rest}
    />
  );
});
