"use client";

import clsx from "clsx";
import { forwardRef } from "react";
import { inputBaseClassName } from "./Input";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  selectSize?: "sm" | "md" | "lg";
}

const SIZE_CLASSES: Record<NonNullable<SelectProps["selectSize"]>, string> = {
  sm: "min-h-[36px] px-3 text-xs",
  md: "min-h-[40px] px-3.5 text-sm",
  lg: "min-h-[44px] px-4 text-sm",
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, className, selectSize = "lg", children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={clsx(
        inputBaseClassName,
        SIZE_CLASSES[selectSize],
        "pr-9 appearance-none bg-[position:right_0.75rem_center] bg-no-repeat",
        "bg-[length:16px_16px]",
        invalid && "!border-rose-400 focus:!ring-rose-300",
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
      }}
      {...rest}
    >
      {children}
    </select>
  );
});
