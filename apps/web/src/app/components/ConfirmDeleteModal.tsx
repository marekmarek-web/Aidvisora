"use client";

import { useEffect, useRef } from "react";
import { BaseModal } from "./BaseModal";
import { Button } from "./ui/primitives";

interface ConfirmDeleteModalProps {
  open: boolean;
  title?: string;
  message?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDeleteModal({
  open,
  title = "Opravdu smazat?",
  message,
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDeleteModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <BaseModal open={open} onClose={onCancel} title={title} maxWidth="sm" mobileVariant="sheet">
      <div className="p-4">
        {message && <p className="text-slate-600 text-sm mt-1">{message}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <Button
            ref={cancelRef}
            variant="ghost"
            size="lg"
            onClick={onCancel}
          >
            Zrušit
          </Button>
          <Button
            variant="destructive"
            size="lg"
            onClick={onConfirm}
            loading={loading}
          >
            {loading ? "Mažu…" : "Smazat"}
          </Button>
        </div>
      </div>
    </BaseModal>
  );
}
