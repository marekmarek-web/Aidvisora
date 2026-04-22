"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function DeadLetterRowActions({ id }: { id: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function call(action: "retry" | "discard") {
    setErr(null);
    try {
      const res = await fetch("/api/admin/ops/dead-letter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, id }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Akce selhala.");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void call("retry")}
        disabled={isPending}
        className="min-h-[36px] rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        Retry
      </button>
      <button
        type="button"
        onClick={() => void call("discard")}
        disabled={isPending}
        className="min-h-[36px] rounded-md bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
      >
        Discard
      </button>
      {err ? <span className="text-xs text-rose-700">{err}</span> : null}
    </div>
  );
}
