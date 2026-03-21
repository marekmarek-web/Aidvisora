"use client";

import { useState } from "react";

type AttachmentDraft = {
  filename: string;
  mimeType: string;
  dataBase64: string;
  size: number;
};

export type ComposeInitial = {
  to?: string;
  subject?: string;
  body?: string;
  threadId?: string;
  replyToMessageId?: string;
};

export function GmailComposeSheet({
  open,
  onClose,
  onSent,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
  initial?: ComposeInitial;
}) {
  const [to, setTo] = useState(initial?.to ?? "");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function arrayBufferToBase64(arr: ArrayBuffer): string {
    let binary = "";
    const bytes = new Uint8Array(arr);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    const next = await Promise.all(
      Array.from(files).map(async (file) => {
        const arr = await file.arrayBuffer();
        return {
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          dataBase64: arrayBufferToBase64(arr),
          size: file.size,
        } satisfies AttachmentDraft;
      })
    );
    setAttachments((prev) => [...prev, ...next]);
  }

  async function submit() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          cc: cc || undefined,
          bcc: bcc || undefined,
          subject,
          body,
          threadId: initial?.threadId,
          replyToMessageId: initial?.replyToMessageId,
          attachments,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Odeslání selhalo.");
        return;
      }
      onSent();
      onClose();
    } catch {
      setError("Odeslání selhalo.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 p-3 sm:p-6">
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-base font-bold text-slate-900">Nový e-mail</h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-lg px-3 text-sm font-bold text-slate-600"
          >
            Zavřít
          </button>
        </div>
        <div className="space-y-3 overflow-y-auto p-4">
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Komu"
            className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="Kopie"
              className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm"
            />
            <input
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              placeholder="Skrytá kopie"
              className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm"
            />
          </div>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Předmět"
            className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm"
          />
          <textarea
            rows={10}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Napište zprávu…"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="rounded-xl border border-slate-200 p-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              Přílohy
            </label>
            <input
              type="file"
              multiple
              onChange={(e) => onPickFiles(e.target.files)}
              className="mt-2 block w-full text-sm"
            />
            <div className="mt-2 space-y-1">
              {attachments.map((att, idx) => (
                <div key={`${att.filename}-${idx}`} className="text-xs text-slate-600">
                  {att.filename} ({Math.round(att.size / 1024)} kB)
                </div>
              ))}
            </div>
          </div>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 p-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700"
          >
            Zrušit
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={sending || !to || !body}
            className="min-h-[44px] rounded-xl bg-[#1a1c2e] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {sending ? "Odesílám…" : "Odeslat"}
          </button>
        </div>
      </div>
    </div>
  );
}
