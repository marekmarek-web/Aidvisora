"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { confirmContractPendingFieldAction } from "@/app/actions/contracts";
import type { ContractAiProvenanceResult } from "@/app/actions/contracts";
import {
  resolveContractPendingFields,
} from "./contract-pending-fields-logic";

type Props = {
  contractId: string;
  provenance: ContractAiProvenanceResult;
};

/**
 * Fáze 16: Inline pending confirm pro contract/payment pole přímo z detailu smlouvy.
 * Zobrazuje se jen pokud existují pending AI pole.
 * Supporting docs nesmí generovat CTA — guard je tvrdý v resolveContractPendingFields.
 */
export function ContractPendingFieldsGuard({ provenance }: Props) {
  const router = useRouter();
  const [confirmingFields, setConfirmingFields] = useState<Record<string, boolean>>({});
  const [confirmedLocally, setConfirmedLocally] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const allPending = resolveContractPendingFields(provenance);
  const visible = allPending.filter((f) => !confirmedLocally[f.key]);

  if (visible.length === 0) return null;

  const pendingAiFields = visible.filter((f) => f.status === "pending_ai");
  const manualFields = visible.filter((f) => f.status === "manual");

  async function handleConfirm(fieldKey: string, scope: "contract" | "payment") {
    if (!provenance?.reviewId) return;
    if (confirmingFields[fieldKey]) return;

    setConfirmingFields((prev) => ({ ...prev, [fieldKey]: true }));
    setErrors((prev) => ({ ...prev, [fieldKey]: "" }));

    try {
      const result = await confirmContractPendingFieldAction(provenance.reviewId, fieldKey, scope);
      if (result.ok) {
        setConfirmedLocally((prev) => ({ ...prev, [fieldKey]: true }));
        router.refresh();
      } else {
        setErrors((prev) => ({ ...prev, [fieldKey]: result.error }));
      }
    } catch {
      setErrors((prev) => ({ ...prev, [fieldKey]: "Potvrzení selhalo. Zkuste to znovu." }));
    } finally {
      setConfirmingFields((prev) => ({ ...prev, [fieldKey]: false }));
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm flex flex-col gap-3 mt-2">
      <div className="flex items-start gap-2">
        <AlertCircle size={15} className="text-amber-500 shrink-0 mt-0.5" aria-hidden />
        <span className="font-semibold text-amber-900">
          {pendingAiFields.length > 0
            ? "Tato smlouva má pole čekající na potvrzení z AI Review."
            : "Tato smlouva má pole vyžadující ruční doplnění."}
        </span>
      </div>

      {/* Pending AI pole — inline confirm buttons */}
      {pendingAiFields.length > 0 && provenance?.reviewId && (
        <div className="flex flex-wrap gap-2 pl-5">
          {pendingAiFields.map((field) => {
            const isLoading = confirmingFields[field.key];
            const fieldError = errors[field.key];
            return (
              <div key={`${field.scope}-${field.key}`} className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => void handleConfirm(field.key, field.scope)}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition-colors min-h-[32px] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={12} className="animate-spin" aria-hidden />
                      Potvrzuji…
                    </>
                  ) : (
                    <>
                      <CheckCircle size={12} aria-hidden />
                      Potvrdit z AI Review — {field.label}
                    </>
                  )}
                </button>
                {fieldError && (
                  <span className="text-xs text-red-600 pl-1">{fieldError}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Fallback pokud reviewId chybí */}
      {pendingAiFields.length > 0 && !provenance?.reviewId && (
        <p className="pl-5 text-xs text-amber-700">
          Potvrzení vyžaduje přístup k AI Review.
        </p>
      )}

      {/* Manual pole — informativní text */}
      {manualFields.length > 0 && (
        <p className="pl-5 text-xs text-amber-800">
          Vyžaduje ruční doplnění:{" "}
          {manualFields.map((f) => f.label).join(", ")}.
        </p>
      )}
    </div>
  );
}
