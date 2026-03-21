"use client";

import { useState } from "react";

export function DriveUploadDialog({
  open,
  folderId,
  onClose,
  onUploaded,
}: {
  open: boolean;
  folderId?: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [folderName, setFolderName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState(0);

  if (!open) return null;

  async function uploadFile() {
    if (!file) return;
    setUploading(true);
    setError(null);
    setUploadPct(0);
    try {
      const form = new FormData();
      form.set("file", file);
      if (folderId) form.set("folderId", folderId);

      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100));
      });

      await new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            onUploaded();
            onClose();
            resolve();
          } else {
            try {
              const data = JSON.parse(xhr.responseText);
              setError(data.error ?? "Nahrání selhalo.");
            } catch { setError("Nahrání selhalo."); }
            reject();
          }
        };
        xhr.onerror = () => { setError("Nahrání selhalo."); reject(); };
        xhr.open("POST", "/api/drive/files");
        xhr.send(form);
      });
    } catch {
      /* handled in xhr callbacks */
    } finally {
      setUploading(false);
      setUploadPct(0);
    }
  }

  async function createFolder() {
    if (!folderName.trim()) return;
    setUploading(true);
    setError(null);
    try {
      const res = await fetch("/api/drive/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "folder", name: folderName.trim(), folderId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setError(data.error ?? "Vytvoření složky selhalo."); return; }
      onUploaded();
      onClose();
    } catch { setError("Vytvoření složky selhalo."); }
    finally { setUploading(false); }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 250,
      background: "rgba(13,31,78,0.25)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', system-ui, sans-serif",
    }} onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 18, boxShadow: "0 12px 36px rgba(13,31,78,0.13)",
        padding: 24, minWidth: 380, maxWidth: 480, width: "90%",
        animation: "dialogIn 0.2s ease",
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          fontSize: "0.95rem", fontWeight: 700, color: "#0D1F4E", marginBottom: 20,
        }}>
          Nahrát do Google Drive
        </h3>

        <div style={{
          border: "1.5px solid #E2E8F0", borderRadius: 12, padding: 16, marginBottom: 16,
        }}>
          <label style={{
            display: "block", fontSize: "0.65rem", fontWeight: 700,
            textTransform: "uppercase" as const, letterSpacing: "0.1em",
            color: "#94A3B8", marginBottom: 8,
          }}>Soubor</label>
          <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)}
            style={{ display: "block", width: "100%", fontSize: "0.82rem" }} />
          {file && (
            <p style={{ fontSize: "0.75rem", color: "#475569", marginTop: 8 }}>
              {file.name} ({Math.round(file.size / 1024)} kB)
            </p>
          )}
          {uploading && uploadPct > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ height: 4, background: "#E2E8F0", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${uploadPct}%`,
                  background: "linear-gradient(90deg,#3B82F6,#38BDF8)",
                  borderRadius: 2, transition: "width 0.2s",
                }} />
              </div>
              <p style={{ fontSize: "0.68rem", color: "#94A3B8", marginTop: 4 }}>{uploadPct} %</p>
            </div>
          )}
          <button type="button" onClick={uploadFile} disabled={uploading || !file}
            style={{
              marginTop: 12, padding: "8px 16px", borderRadius: 8, border: "none",
              background: uploading ? "#94A3B8" : "#2563EB", color: "#fff", cursor: !file || uploading ? "not-allowed" : "pointer",
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              fontSize: "0.79rem", fontWeight: 700, opacity: !file || uploading ? 0.6 : 1,
              transition: "all 0.15s",
            }}>
            {uploading ? "Nahrávám…" : "Nahrát soubor"}
          </button>
        </div>

        <div style={{
          border: "1.5px solid #E2E8F0", borderRadius: 12, padding: 16, marginBottom: 16,
        }}>
          <label style={{
            display: "block", fontSize: "0.65rem", fontWeight: 700,
            textTransform: "uppercase" as const, letterSpacing: "0.1em",
            color: "#94A3B8", marginBottom: 8,
          }}>Nová složka</label>
          <input value={folderName} onChange={e => setFolderName(e.target.value)}
            placeholder="Název složky"
            style={{
              width: "100%", padding: "10px 14px", border: "1.5px solid #E2E8F0",
              borderRadius: 12, fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: "0.82rem", color: "#0D1F4E", outline: "none",
            }}
            onFocus={e => { e.target.style.borderColor = "#2563EB"; }}
            onBlur={e => { e.target.style.borderColor = "#E2E8F0"; }}
          />
          <button type="button" onClick={createFolder} disabled={uploading || !folderName.trim()}
            style={{
              marginTop: 12, padding: "8px 16px", borderRadius: 8,
              border: "1.5px solid #E2E8F0", background: "#fff", color: "#475569",
              cursor: !folderName.trim() || uploading ? "not-allowed" : "pointer",
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: "0.79rem", fontWeight: 600, opacity: !folderName.trim() || uploading ? 0.6 : 1,
              transition: "all 0.15s",
            }}>
            Vytvořit složku
          </button>
        </div>

        {error && (
          <div style={{
            padding: "10px 14px", background: "#FEF2F2",
            border: "1px solid rgba(220,38,38,0.15)", borderRadius: 8,
            fontSize: "0.78rem", color: "#991B1B", marginBottom: 12,
          }}>{error}</div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose}
            style={{
              padding: "8px 16px", borderRadius: 8,
              border: "1.5px solid #E2E8F0", background: "#fff",
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: "0.79rem", fontWeight: 600, color: "#475569",
              cursor: "pointer", transition: "all 0.15s",
            }}>
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
}
