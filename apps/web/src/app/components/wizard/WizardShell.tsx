"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { MD_BREAKPOINT_PX } from "@/app/lib/breakpoints";

export interface WizardShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /**
   * When this changes (e.g. wizard step), move focus to the first meaningful field
   * (skips the close button). Include in deps: `isMobile` layout swap re-runs the effect.
   */
  focusContentKey?: string | number;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MD_BREAKPOINT_PX - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

export function WizardShell({
  open,
  onClose,
  title,
  children,
  focusContentKey,
}: WizardShellProps) {
  const ref = useRef<HTMLDivElement>(null);
  const previousActive = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!open) return;
    const active = document.activeElement as HTMLElement | null;
    previousActive.current = active;
    if (active && ref.current && !ref.current.contains(active)) active.blur();

    function onDocumentKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      document.removeEventListener("keydown", onDocumentKeyDown);
      previousActive.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open || !ref.current) return;
    const el = ref.current;

    function getTrapEndpoints() {
      const focusables = Array.from(
        el.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      const closeBtn = el.querySelector<HTMLElement>('[aria-label="Zavřít"]');
      const firstInContent =
        focusables.find((node) => node !== closeBtn) ?? focusables[0];
      const last = focusables[focusables.length - 1];
      return { firstInContent, last };
    }

    function moveFocusToFirstField() {
      requestAnimationFrame(() => {
        if (!el.isConnected) return;
        const { firstInContent } = getTrapEndpoints();
        firstInContent?.focus();
      });
    }

    if (focusContentKey !== undefined) {
      moveFocusToFirstField();
    } else if (!el.contains(document.activeElement)) {
      moveFocusToFirstField();
    }

    function trap(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const { firstInContent, last } = getTrapEndpoints();
      if (!firstInContent || !last) return;
      if (e.shiftKey) {
        if (document.activeElement === firstInContent) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        firstInContent.focus();
      }
    }
    el.addEventListener("keydown", trap);
    return () => el.removeEventListener("keydown", trap);
  }, [open, isMobile, focusContentKey]);

  const [backdropTarget, setBackdropTarget] = useState<EventTarget | null>(null);
  const handleBackdropMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) setBackdropTarget(e.target);
  }, []);
  const handleBackdropMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (
        !isMobile &&
        e.target === e.currentTarget &&
        e.currentTarget === backdropTarget
      )
        onClose();
      setBackdropTarget(null);
    },
    [onClose, backdropTarget, isMobile],
  );

  if (!open) return null;

  const backdropClass =
    "fixed inset-0 z-modal flex items-center justify-center p-4 bg-[color:var(--wp-overlay-scrim)]";
  const mobileBackdropClass =
    "fixed inset-0 z-modal flex flex-col p-0 bg-[color:var(--wp-surface-card)]";

  const panelBase =
    "w-full max-w-[640px] bg-[color:var(--wp-surface-card)] rounded-[24px] shadow-2xl shadow-indigo-900/10 dark:shadow-black/40 border border-[color:var(--wp-surface-card-border)] flex flex-col overflow-hidden relative max-h-[90vh]";
  const panelMobile = "rounded-none min-h-full max-h-full border-0 shadow-none";

  return (
    <div
      className={isMobile ? mobileBackdropClass : backdropClass}
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-title"
    >
      {isMobile && (
        <div
          className="flex-1 min-h-0 overflow-hidden flex items-center justify-center p-4"
          role="presentation"
        >
          <div
            ref={ref}
            className={`${panelBase} ${isMobile ? panelMobile : ""} w-full`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glow blob */}
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-indigo-500/[0.08] opacity-90 blur-3xl pointer-events-none dark:bg-indigo-400/10" />
            {children}
          </div>
        </div>
      )}
      {!isMobile && (
        <div
          ref={ref}
          className={`${panelBase}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-indigo-500/[0.08] opacity-90 blur-3xl pointer-events-none dark:bg-indigo-400/10" />
          {children}
        </div>
      )}
    </div>
  );
}
