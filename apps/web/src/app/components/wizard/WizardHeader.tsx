"use client";

import { X } from "lucide-react";

export function WizardHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="relative z-10 flex shrink-0 items-center justify-between border-b border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] px-8 py-6">
      <h2 id="wizard-title" className="text-xl font-black tracking-tight text-[color:var(--wp-text)]">
        {title}
      </h2>
      <button
        type="button"
        onClick={onClose}
        className="flex h-8 min-h-[44px] w-8 min-w-[44px] items-center justify-center rounded-full text-[color:var(--wp-text-tertiary)] transition-colors hover:bg-[color:var(--wp-surface-muted)] hover:text-[color:var(--wp-text)]"
        aria-label="Zavřít"
      >
        <X size={18} />
      </button>
    </div>
  );
}
