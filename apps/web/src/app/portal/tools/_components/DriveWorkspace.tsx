"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DriveUploadDialog } from "./DriveUploadDialog";
import { IntegrationConnectionGate } from "./IntegrationConnectionGate";

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  parents?: string[];
};

export function DriveWorkspace() {
  const [q, setQ] = useState("");
  const [folderId, setFolderId] = useState<string | undefined>(undefined);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [selected, setSelected] = useState<DriveFile | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [error, setError] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [shareEmail, setShareEmail] = useState("");

  const loadFiles = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (folderId) params.set("folderId", folderId);
    const res = await fetch(`/api/drive/files?${params.toString()}`);
    const data = (await res.json().catch(() => ({}))) as { files?: DriveFile[]; error?: string };
    if (!res.ok) {
      setError(data.error ?? "Načtení souborů selhalo.");
      return;
    }
    setFiles(data.files ?? []);
    if (selected) {
      const fresh = (data.files ?? []).find((f) => f.id === selected.id) ?? null;
      setSelected(fresh);
      setRenameValue(fresh?.name ?? "");
    }
  }, [folderId, q, selected]);

  useEffect(() => {
    loadFiles().catch(() => undefined);
  }, [loadFiles]);

  const breadcrumbs = useMemo(
    () => [{ id: "", name: "Můj disk" }, ...(folderId ? [{ id: folderId, name: "Složka" }] : [])],
    [folderId]
  );

  async function onDelete(fileId: string) {
    const res = await fetch(`/api/drive/files/${fileId}`, { method: "DELETE" });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Mazání selhalo.");
      return;
    }
    setSelected(null);
    await loadFiles();
  }

  async function onRename() {
    if (!selected || !renameValue.trim()) return;
    const res = await fetch(`/api/drive/files/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameValue.trim() }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Přejmenování selhalo.");
      return;
    }
    await loadFiles();
  }

  async function onShare() {
    if (!selected || !shareEmail.trim()) return;
    const res = await fetch(`/api/drive/files/${selected.id}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "user",
        role: "reader",
        emailAddress: shareEmail.trim(),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Sdílení selhalo.");
      return;
    }
    setShareEmail("");
  }

  return (
    <IntegrationConnectionGate provider="drive">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-black text-slate-900">Google Drive Workspace</h1>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setView((prev) => (prev === "grid" ? "list" : "grid"))}
              className="min-h-[44px] rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700"
            >
              {view === "grid" ? "Seznam" : "Mřížka"}
            </button>
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="min-h-[44px] rounded-xl bg-[#1a1c2e] px-4 py-2 text-sm font-bold text-white"
            >
              Nahrát / vytvořit
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
          {breadcrumbs.map((b, idx) => (
            <button
              key={`${b.id}-${idx}`}
              type="button"
              onClick={() => setFolderId(b.id || undefined)}
              className="min-h-[36px] rounded-lg bg-slate-100 px-3 text-xs font-bold text-slate-700"
            >
              {b.name}
            </button>
          ))}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadFiles()}
            placeholder="Hledat soubor…"
            className="min-h-[44px] flex-1 rounded-xl border border-slate-300 px-3 text-sm"
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(320px,1fr)_360px]">
          <section className={`rounded-2xl border border-slate-200 bg-white p-3 ${view === "grid" ? "grid gap-2 sm:grid-cols-2" : "space-y-2"}`}>
            {files.map((file) => {
              const isFolder = file.mimeType === "application/vnd.google-apps.folder";
              return (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => {
                    setSelected(file);
                    setRenameValue(file.name);
                    if (isFolder && view === "list") setFolderId(file.id);
                  }}
                  className={`rounded-xl border p-3 text-left ${
                    selected?.id === file.id ? "border-indigo-300 bg-indigo-50" : "border-slate-100 hover:bg-slate-50"
                  }`}
                >
                  <p className="truncate text-sm font-bold text-slate-900">{file.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{isFolder ? "Složka" : file.mimeType}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {file.modifiedTime ? new Date(file.modifiedTime).toLocaleString("cs-CZ") : ""}
                  </p>
                  {isFolder ? (
                    <span className="mt-2 inline-flex min-h-[28px] items-center rounded-lg bg-slate-100 px-2 text-xs font-bold text-slate-700">
                      Otevřít
                    </span>
                  ) : null}
                </button>
              );
            })}
            {!files.length ? <p className="p-2 text-sm text-slate-500">Složka je prázdná.</p> : null}
          </section>
          <aside className="rounded-2xl border border-slate-200 bg-white p-4">
            {selected ? (
              <div className="space-y-3">
                <p className="text-lg font-black text-slate-900">{selected.name}</p>
                <p className="text-xs text-slate-500">{selected.mimeType}</p>
                <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Přejmenovat</label>
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm"
                  />
                  <button
                    type="button"
                    onClick={onRename}
                    className="min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-700"
                  >
                    Uložit název
                  </button>
                </div>
                <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Sdílet e-mailem</label>
                  <input
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm"
                    placeholder="klient@firma.cz"
                  />
                  <button
                    type="button"
                    onClick={onShare}
                    className="min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-700"
                  >
                    Sdílet jako čtenář
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/api/drive/files/${selected.id}/download`}
                    className="min-h-[44px] rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700"
                  >
                    Stáhnout
                  </a>
                  {selected.webViewLink ? (
                    <a
                      href={selected.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[44px] rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700"
                    >
                      Náhled
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onDelete(selected.id)}
                    className="min-h-[44px] rounded-xl border border-rose-300 px-3 py-2 text-sm font-bold text-rose-700"
                  >
                    Smazat
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Vyberte soubor nebo složku.</p>
            )}
          </aside>
        </div>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>
      <DriveUploadDialog
        open={uploadOpen}
        folderId={folderId}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => loadFiles()}
      />
    </IntegrationConnectionGate>
  );
}
