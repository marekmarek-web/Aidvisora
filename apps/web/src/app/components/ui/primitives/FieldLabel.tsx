"use client";

import clsx from "clsx";

export interface FieldLabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  hint?: React.ReactNode;
}

export function FieldLabel({
  required,
  hint,
  className,
  children,
  ...rest
}: FieldLabelProps) {
  return (
    <label
      className={clsx(
        "mb-1.5 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide",
        "text-[color:var(--wp-text-secondary)]",
        className,
      )}
      {...rest}
    >
      <span>
        {children}
        {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
      </span>
      {hint ? (
        <span className="text-[10px] font-medium normal-case tracking-normal text-[color:var(--wp-text-tertiary)]">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
