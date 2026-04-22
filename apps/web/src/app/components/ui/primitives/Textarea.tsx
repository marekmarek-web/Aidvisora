"use client";

import clsx from "clsx";
import { forwardRef } from "react";
import { inputBaseClassName } from "./Input";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ invalid, className, rows = 4, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        aria-invalid={invalid || undefined}
        className={clsx(
          inputBaseClassName,
          "py-2.5 text-sm resize-y min-h-[88px]",
          invalid && "!border-rose-400 focus:!ring-rose-300",
          className,
        )}
        {...rest}
      />
    );
  },
);
