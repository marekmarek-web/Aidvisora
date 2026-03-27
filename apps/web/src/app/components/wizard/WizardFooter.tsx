"use client";

import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import { CreateActionButton, portalPrimaryButtonClassName } from "@/app/components/ui/CreateActionButton";
import clsx from "clsx";

export function WizardFooter({
  onBack,
  onClose,
  onPrimary,
  primaryLabel,
  primaryDisabled,
  primaryLoading,
  isFirstStep,
  isLastStep,
}: {
  onBack: () => void;
  onClose: () => void;
  onPrimary: () => void;
  primaryLabel: string;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  isFirstStep: boolean;
  isLastStep: boolean;
}) {
  const handleBack = isFirstStep ? onClose : onBack;
  return (
    <div className="relative z-10 flex shrink-0 items-center justify-between border-t border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)] px-8 py-5">
      <button
        type="button"
        onClick={handleBack}
        className={`flex min-h-[44px] items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${
          isFirstStep
            ? "text-[color:var(--wp-text-tertiary)] hover:bg-[color:var(--wp-surface-raised)] hover:text-[color:var(--wp-text-secondary)]"
            : "border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] text-[color:var(--wp-text-secondary)] shadow-sm hover:bg-[color:var(--wp-surface-muted)]"
        }`}
      >
        {!isFirstStep && <ArrowLeft size={16} />}
        {isFirstStep ? "Zrušit" : "Zpět"}
      </button>
      {isLastStep ? (
        <CreateActionButton
          type="button"
          onClick={onPrimary}
          disabled={primaryDisabled}
          isLoading={primaryLoading}
          icon={Check}
          className="px-8 py-2.5"
        >
          {primaryLoading ? "Ukládám…" : primaryLabel}
        </CreateActionButton>
      ) : (
        <button
          type="button"
          onClick={onPrimary}
          disabled={primaryDisabled || primaryLoading}
          className={clsx(portalPrimaryButtonClassName, "px-8 py-2.5")}
        >
          {primaryLoading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Ukládám…
            </>
          ) : (
            <>
              {primaryLabel}
              <ArrowRight size={16} />
            </>
          )}
        </button>
      )}
    </div>
  );
}
