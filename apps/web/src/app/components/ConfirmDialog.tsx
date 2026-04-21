"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "./ui/primitives";

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
};

type Pending = ConfirmOptions & { resolve: (value: boolean) => void };

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const close = useCallback((value: boolean) => {
    setPending((p) => {
      if (p) p.resolve(value);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, close]);

  useEffect(() => {
    if (pending) {
      const t = window.setTimeout(() => confirmButtonRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
  }, [pending]);

  const title = pending?.title ?? "Potvrzení";
  const message = pending?.message ?? "";
  const confirmLabel = pending?.confirmLabel ?? "Potvrdit";
  const cancelLabel = pending?.cancelLabel ?? "Zrušit";
  const variant = pending?.variant ?? "default";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
            aria-label="Zavřít"
            onClick={() => close(false)}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-desc"
            className="relative z-[201] w-full max-w-md rounded-2xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] p-5 shadow-xl dark:shadow-black/40"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="confirm-dialog-title"
              className="text-lg font-bold text-[color:var(--wp-text)] [font-family:var(--font-jakarta),var(--font-primary),system-ui,sans-serif]"
            >
              {title}
            </h2>
            <p
              id="confirm-dialog-desc"
              className="mt-3 text-sm font-medium leading-relaxed text-[color:var(--wp-text-secondary)]"
            >
              {message}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <Button
                variant="secondary"
                size="lg"
                onClick={() => close(false)}
              >
                {cancelLabel}
              </Button>
              <Button
                ref={confirmButtonRef}
                variant={variant === "destructive" ? "destructive" : "primary"}
                size="lg"
                onClick={() => close(true)}
              >
                {confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
