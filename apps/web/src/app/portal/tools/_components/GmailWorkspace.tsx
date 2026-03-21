"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GmailComposeSheet } from "./GmailComposeSheet";
import { IntegrationConnectionGate } from "./IntegrationConnectionGate";

type GmailListItem = {
  id: string;
  threadId: string;
  snippet?: string;
  from?: string;
  to?: string;
  subject?: string;
  date?: string;
  labelIds?: string[];
  isUnread?: boolean;
};

type GmailLabel = { id: string; name: string; type?: "system" | "user" };

type GmailDetail = {
  id: string;
  threadId: string;
  snippet: string;
  bodyHtml: string;
  headers: {
    from?: string;
    to?: string;
    cc?: string;
    subject?: string;
    date?: string;
    messageId?: string;
  };
  labelIds: string[];
};

type GmailThreadMessage = {
  id: string;
  bodyHtml: string;
  snippet: string;
  headers: {
    from?: string;
    to?: string;
    subject?: string;
    date?: string;
    messageId?: string;
  };
  labelIds: string[];
};

export function GmailWorkspace() {
  const [q, setQ] = useState("");
  const [labels, setLabels] = useState<GmailLabel[]>([]);
  const [activeLabel, setActiveLabel] = useState("INBOX");
  const [messages, setMessages] = useState<GmailListItem[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<GmailDetail | null>(null);
  const [thread, setThread] = useState<GmailThreadMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [mobileListMode, setMobileListMode] = useState(true);

  const loadLabels = useCallback(async () => {
    const res = await fetch("/api/gmail/labels");
    const data = (await res.json().catch(() => ({}))) as { labels?: GmailLabel[] };
    setLabels(data.labels ?? []);
  }, []);

  const loadMessages = useCallback(
    async (pageToken?: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (activeLabel) params.set("labelId", activeLabel);
        if (pageToken) params.set("pageToken", pageToken);
        const res = await fetch(`/api/gmail/messages?${params.toString()}`);
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          messages?: GmailListItem[];
          nextPageToken?: string;
        };
        if (!res.ok) {
          setError(data.error ?? "Načtení e-mailů selhalo.");
          return;
        }
        setMessages((prev) => (pageToken ? [...prev, ...(data.messages ?? [])] : (data.messages ?? [])));
        setNextPageToken(data.nextPageToken ?? null);
      } catch {
        setError("Načtení e-mailů selhalo.");
      } finally {
        setLoading(false);
      }
    },
    [activeLabel, q]
  );

  const loadMessage = useCallback(async (id: string) => {
    const res = await fetch(`/api/gmail/messages/${id}`);
    const data = (await res.json().catch(() => ({}))) as GmailDetail & { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Načtení detailu selhalo.");
      return;
    }
    setSelected(data);
    setSelectedId(id);
    setMobileListMode(false);
    const threadRes = await fetch(`/api/gmail/threads/${data.threadId}`);
    const threadData = (await threadRes.json().catch(() => ({}))) as { messages?: GmailThreadMessage[] };
    setThread(threadData.messages ?? []);
  }, []);

  useEffect(() => {
    loadLabels().catch(() => undefined);
  }, [loadLabels]);

  useEffect(() => {
    loadMessages().catch(() => undefined);
  }, [loadMessages]);

  const systemLabels = useMemo(
    () => labels.filter((l) => l.type === "system" || ["INBOX", "SENT", "DRAFT", "TRASH"].includes(l.id)),
    [labels]
  );

  async function messageAction(endpoint: string, body?: unknown) {
    if (!selectedId) return;
    const res = await fetch(`/api/gmail/messages/${selectedId}/${endpoint}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Akce selhala.");
      return;
    }
    await loadMessages();
    if (endpoint === "delete" || endpoint === "trash") {
      setSelected(null);
      setSelectedId(null);
      setThread([]);
    } else if (selectedId) {
      await loadMessage(selectedId);
    }
  }

  return (
    <IntegrationConnectionGate provider="gmail">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-black text-slate-900">Gmail Workspace</h1>
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="min-h-[44px] rounded-xl bg-[#1a1c2e] px-4 py-2.5 text-sm font-bold text-white"
          >
            Napsat e-mail
          </button>
        </div>
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(300px,1fr)_minmax(340px,1.2fr)]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadMessages()}
              placeholder="Hledat e-mail…"
              className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm"
            />
            <div className="mt-3 space-y-1">
              {systemLabels.map((label) => (
                <button
                  key={label.id}
                  type="button"
                  onClick={() => {
                    setActiveLabel(label.id);
                    setSelected(null);
                    setSelectedId(null);
                  }}
                  className={`flex min-h-[44px] w-full items-center rounded-xl px-3 text-left text-sm font-bold ${
                    activeLabel === label.id ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {label.name}
                </button>
              ))}
            </div>
          </aside>

          <section className={`rounded-2xl border border-slate-200 bg-white p-2 ${!mobileListMode ? "hidden md:block" : ""}`}>
            <div className="max-h-[72vh] overflow-y-auto">
              {messages.map((msg) => (
                <button
                  key={msg.id}
                  type="button"
                  onClick={() => loadMessage(msg.id)}
                  className={`w-full rounded-xl border p-3 text-left ${
                    msg.id === selectedId ? "border-indigo-300 bg-indigo-50" : "border-slate-100 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-sm ${msg.isUnread ? "font-black text-slate-900" : "font-semibold text-slate-700"}`}>
                      {msg.from || msg.to || "Neznámý odesílatel"}
                    </p>
                    <span className="text-xs text-slate-500">{msg.date ? new Date(msg.date).toLocaleDateString("cs-CZ") : ""}</span>
                  </div>
                  <p className="mt-1 truncate text-sm font-bold text-slate-800">{msg.subject || "(bez předmětu)"}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{msg.snippet}</p>
                </button>
              ))}
              {!messages.length && !loading ? (
                <p className="p-4 text-sm text-slate-500">Žádné zprávy pro tento filtr.</p>
              ) : null}
            </div>
            <div className="mt-2">
              {nextPageToken ? (
                <button
                  type="button"
                  onClick={() => loadMessages(nextPageToken)}
                  className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700"
                >
                  Načíst další
                </button>
              ) : null}
            </div>
          </section>

          <section className={`rounded-2xl border border-slate-200 bg-white p-4 ${mobileListMode ? "hidden md:block" : ""}`}>
            {selected ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setComposeOpen(true)}
                    className="min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-700"
                  >
                    Odpovědět
                  </button>
                  <button
                    type="button"
                    onClick={() => messageAction("modify", { removeLabelIds: ["INBOX"] })}
                    className="min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-700"
                  >
                    Archivovat
                  </button>
                  <button
                    type="button"
                    onClick={() => messageAction("trash")}
                    className="min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-700"
                  >
                    Koš
                  </button>
                  <button
                    type="button"
                    onClick={() => messageAction("delete")}
                    className="min-h-[44px] rounded-xl border border-rose-300 px-3 text-sm font-bold text-rose-700"
                  >
                    Smazat trvale
                  </button>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-lg font-black text-slate-900">{selected.headers.subject || "(bez předmětu)"}</p>
                  <p className="mt-1 text-xs text-slate-500">Od: {selected.headers.from || "—"}</p>
                  <p className="text-xs text-slate-500">Komu: {selected.headers.to || "—"}</p>
                </div>
                <article
                  className="prose prose-sm max-w-none rounded-xl border border-slate-200 p-3"
                  dangerouslySetInnerHTML={{ __html: selected.bodyHtml || `<p>${selected.snippet}</p>` }}
                />
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-bold text-slate-800">Vlákno ({thread.length})</p>
                  <div className="mt-2 space-y-2">
                    {thread.map((msg) => (
                      <div key={msg.id} className="rounded-lg border border-slate-100 p-2">
                        <p className="text-xs font-bold text-slate-700">{msg.headers.from || "—"}</p>
                        <p className="text-xs text-slate-500">{msg.headers.subject || "(bez předmětu)"}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileListMode(true)}
                  className="min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-700 md:hidden"
                >
                  Zpět na seznam
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Vyberte e-mail ze seznamu.</p>
            )}
          </section>
        </div>
        {loading ? <p className="text-sm text-slate-500">Načítám…</p> : null}
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>
      <GmailComposeSheet
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSent={() => loadMessages()}
        initial={
          selected
            ? {
                to: selected.headers.from,
                subject: selected.headers.subject?.startsWith("Re:")
                  ? selected.headers.subject
                  : `Re: ${selected.headers.subject || ""}`,
                body: `<p><br/></p><hr/><p>${selected.headers.from || ""}</p>`,
                threadId: selected.threadId,
                replyToMessageId: selected.headers.messageId,
              }
            : undefined
        }
      />
    </IntegrationConnectionGate>
  );
}
