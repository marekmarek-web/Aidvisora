"use client";

import { useFinancialAnalysisStore } from "@/lib/analyses/financial/store";
import { getStepTitles } from "@/lib/analyses/financial/constants";
import { Check } from "lucide-react";
import clsx from "clsx";

export function FinancialAnalysisStepper() {
  const currentStep = useFinancialAnalysisStore((s) => s.currentStep);
  const totalSteps = useFinancialAnalysisStore((s) => s.totalSteps);
  const includeCompany = useFinancialAnalysisStore((s) => s.data.includeCompany ?? false);
  const goToStep = useFinancialAnalysisStore((s) => s.goToStep);
  const stepTitles = getStepTitles(includeCompany);

  return (
    <div className="w-full max-w-4xl mb-8 relative z-10 overflow-x-auto">
      <div className="flex justify-between items-center relative min-w-0">
        {stepTitles.map((title, i) => {
          const stepNum = i + 1;
          const isActive = currentStep === stepNum;
          const isCompleted = currentStep > stepNum;
          return (
            <button
              key={stepNum}
              type="button"
              onClick={() => goToStep(stepNum)}
              className={clsx(
                "stepper-item flex-1 flex flex-col items-center min-w-0 sm:min-w-[60px]",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 rounded-lg"
              )}
              aria-current={isActive ? "step" : undefined}
              aria-label={`Krok ${stepNum}: ${title}`}
            >
              <div
                className={clsx(
                  "w-10 h-10 sm:w-11 sm:h-11 min-w-[40px] sm:min-w-[44px] rounded-full flex items-center justify-center font-semibold text-base border-2 transition-all",
                  isActive && "border-indigo-500 text-indigo-600 bg-[color:var(--wp-surface-card)] shadow-[0_0_0_4px_rgba(99,102,241,0.2)]",
                  isCompleted && "bg-indigo-500 border-indigo-500 text-white",
                  !isActive && !isCompleted && "border-[color:var(--wp-border-strong)] text-[color:var(--wp-text-secondary)] bg-[color:var(--wp-surface-card)]"
                )}
              >
                {isCompleted ? <Check className="w-5 h-5" /> : stepNum}
              </div>
              <span
                className={clsx(
                  "text-[9px] sm:text-xs font-bold uppercase tracking-tight sm:tracking-wider mt-1.5 sm:mt-2 text-center leading-tight max-w-[3.25rem] sm:max-w-[5.5rem] line-clamp-2 sm:line-clamp-3",
                  isActive ? "text-[color:var(--wp-text)]" : "text-[color:var(--wp-text-tertiary)]"
                )}
              >
                {title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
