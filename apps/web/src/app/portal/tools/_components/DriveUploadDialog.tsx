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

  if (!open) return null;

  async function uploadFile() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      if (folderId) form.set("folderId", folderId);
      const res = await fetch("/api/drive/files", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Nahrání selhalo.");
        return;
      }
      onUploaded();
      onClose();
    } catch {
      setError("Nahrání selhalo.");
    } finally {
      setUploading(false);
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
        body: JSON.stringify({
          type: "folder",
          name: folderName.trim(),
          folderId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Vytvoření složky selhalo.");
        return;
      }
      onUploaded();
      onClose();
    } catch {
      setError("Vytvoření složky selhalo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 p-4">
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-4 shadow-xl">
        <h3 className="text-base font-bold text-slate-900">Nahrát do Google Drive</h3>
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-slate-200 p-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Soubor
            </label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-2 block w-full text-sm"
            />
            <button
              type="button"
              onClick={uploadFile}
              disabled={uploading || !file}
              className="mt-3 min-h-[44px] rounded-xl bg-[#1a1c2e] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {uploading ? "Nahrávám…" : "Nahrát soubor"}
            </button>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Nová složka
            </label>
            <input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Název složky"
              className="mt-2 min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm"
            />
            <button
              type="button"
              onClick={createFolder}
              disabled={uploading || !folderName.trim()}
              className="mt-3 min-h-[44px] rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-60"
            >
              Vytvořit složku
            </button>
          </div>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700"
            >
              Zavřít
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
