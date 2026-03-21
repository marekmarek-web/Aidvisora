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
    setAttachments(prev => [...prev, ...next]);
  }

  async function submit() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to, cc: cc || undefined, bcc: bcc || undefined, subject, body,
          threadId: initial?.threadId,
          replyToMessageId: initial?.replyToMessageId,
          attachments,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setError(data.error ?? "Odeslání selhalo."); return; }
      onSent();
      onClose();
    } catch { setError("Odeslání selhalo."); }
    finally { setSending(false); }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px",
    border: "1.5px solid #E2E8F0", borderRadius: 12,
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: "0.82rem", color: "#0D1F4E", outline: "none",
    transition: "border-color 0.15s",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(13,31,78,0.3)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{
        background: "#fff", borderRadius: 18,
        boxShadow: "0 16px 40px rgba(13,31,78,0.12)",
        display: "flex", flexDirection: "column",
        width: "90%", maxWidth: 640, maxHeight: "90vh",
        animation: "dialogIn 0.2s ease",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "1px solid #E2E8F0",
        }}>
          <h3 style={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontSize: "0.95rem", fontWeight: 700, color: "#0D1F4E", margin: 0,
          }}>
            {initial?.replyToMessageId ? "Odpovědět" : "Nový e-mail"}
          </h3>
          <button type="button" onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#94A3B8", padding: 4,
          }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <input value={to} onChange={e => setTo(e.target.value)} placeholder="Komu" style={inputStyle}
            onFocus={e => { e.target.style.borderColor = "#2563EB"; }}
            onBlur={e => { e.target.style.borderColor = "#E2E8F0"; }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input value={cc} onChange={e => setCc(e.target.value)} placeholder="Kopie" style={inputStyle}
              onFocus={e => { e.target.style.borderColor = "#2563EB"; }}
              onBlur={e => { e.target.style.borderColor = "#E2E8F0"; }} />
            <input value={bcc} onChange={e => setBcc(e.target.value)} placeholder="Skrytá kopie" style={inputStyle}
              onFocus={e => { e.target.style.borderColor = "#2563EB"; }}
              onBlur={e => { e.target.style.borderColor = "#E2E8F0"; }} />
          </div>

          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Předmět" style={inputStyle}
            onFocus={e => { e.target.style.borderColor = "#2563EB"; }}
            onBlur={e => { e.target.style.borderColor = "#E2E8F0"; }} />

          <textarea rows={8} value={body} onChange={e => setBody(e.target.value)}
            placeholder="Napište zprávu…"
            style={{
              ...inputStyle, minHeight: 120, resize: "vertical", lineHeight: 1.55,
            }}
            onFocus={e => { e.target.style.borderColor = "#2563EB"; }}
            onBlur={e => { e.target.style.borderColor = "#E2E8F0"; }} />

          <div style={{
            border: "1.5px solid #E2E8F0", borderRadius: 12, padding: 14,
          }}>
            <label style={{
              display: "block", fontSize: "0.65rem", fontWeight: 700,
              textTransform: "uppercase" as const, letterSpacing: "0.1em",
              color: "#94A3B8", marginBottom: 8,
            }}>Přílohy</label>
            <input type="file" multiple onChange={e => onPickFiles(e.target.files)}
              style={{ display: "block", width: "100%", fontSize: "0.82rem" }} />
            {attachments.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                {attachments.map((att, idx) => (
                  <div key={`${att.filename}-${idx}`} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "6px 10px", background: "#F1F4FA", borderRadius: 6,
                    fontSize: "0.75rem", color: "#475569",
                  }}>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2}>
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                    {att.filename} ({Math.round(att.size / 1024)} kB)
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div style={{
              padding: "10px 14px", background: "#FEF2F2",
              border: "1px solid rgba(220,38,38,0.15)", borderRadius: 8,
              fontSize: "0.78rem", color: "#991B1B",
            }}>{error}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10,
          padding: "14px 20px", borderTop: "1px solid #E2E8F0",
        }}>
          <button type="button" onClick={onClose} style={{
            padding: "8px 16px", borderRadius: 8,
            border: "1.5px solid #E2E8F0", background: "#fff",
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: "0.79rem", fontWeight: 600, color: "#475569",
            cursor: "pointer", transition: "all 0.15s",
          }}>Zrušit</button>
          <button type="button" onClick={submit} disabled={sending || !to || !body} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 18px", borderRadius: 8, border: "none",
            background: sending || !to || !body ? "#94A3B8" : "#2563EB",
            color: "#fff", cursor: sending || !to || !body ? "not-allowed" : "pointer",
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontSize: "0.8rem", fontWeight: 700, opacity: sending || !to || !body ? 0.6 : 1,
            transition: "all 0.15s",
          }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            {sending ? "Odesílám…" : "Odeslat"}
          </button>
        </div>
      </div>
    </div>
  );
}
