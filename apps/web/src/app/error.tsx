"use client";

import { useEffect } from "react";

import clsx from "clsx";
import { portalPrimaryButtonClassName } from "@/lib/ui/create-action-button-styles";
import {
  captureAppError,
  getPortalFriendlyErrorMessage,
} from "@/lib/observability/production-error-ui";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isProd = process.env.NODE_ENV === "production";
  const displayMessage = getPortalFriendlyErrorMessage(error);
  const shortDigest = error.digest ? String(error.digest).slice(0, 12) : "";

  useEffect(() => {
    const route = typeof window !== "undefined" ? window.location.pathname : undefined;
    captureAppError(error, {
      boundary: "root",
      route,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md w-full rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <span className="text-red-500 text-xl font-bold">!</span>
        </div>
        <h1 className="text-lg font-semibold text-slate-800 mb-2">Něco se pokazilo</h1>
        <p className="text-sm text-slate-600 mb-4">{displayMessage}</p>
        {shortDigest ? (
          <p className="text-[11px] text-slate-400 font-mono mb-6">
            Kód chyby: {shortDigest}
          </p>
        ) : (
          <div className="mb-6" />
        )}
        {!isProd && error.message ? (
          <pre className="text-left text-xs bg-slate-100 text-slate-700 rounded-md p-3 mb-4 overflow-auto max-h-48">
            {error.message}
          </pre>
        ) : null}
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
            type="button"
            onClick={reset}
            className={clsx(portalPrimaryButtonClassName, "px-4 py-2.5 font-semibold")}
          >
            Zkusit znovu
          </button>
          <a
            href="/"
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 inline-flex items-center justify-center"
          >
            Úvodní stránka
          </a>
        </div>
      </div>
    </div>
  );
}
