"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GmailComposeSheet } from "./GmailComposeSheet";
import { IntegrationConnectionGate } from "./IntegrationConnectionGate";
import s from "./GmailWorkspace.module.css";

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

const SYSTEM_LABEL_ORDER = ["INBOX", "STARRED", "SENT", "DRAFT", "TRASH", "SPAM"];

function getInitials(name: string): string {
  const parts = name.replace(/<[^>]+>/g, "").trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    "linear-gradient(135deg,#FF6B00,#FF8C40)",
    "linear-gradient(135deg,#000,#333)",
    "linear-gradient(135deg,#0068FF,#0057D9)",
    "linear-gradient(135deg,#1A73E8,#0D47A1)",
    "linear-gradient(135deg,#CC0000,#990000)",
    "linear-gradient(135deg,#3ECF8E,#20B070)",
    "linear-gradient(135deg,#FF6750,#E53935)",
    "linear-gradient(135deg,#8B5CF6,#6D28D9)",
    "linear-gradient(135deg,#E91E63,#C2185B)",
    "linear-gradient(135deg,#F59E0B,#D97706)",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function formatEmailDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return `${d.getDate()}. ${d.getMonth() + 1}.`;
  } catch { return ""; }
}

function formatFullDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function extractSenderName(from?: string): string {
  if (!from) return "Neznámý";
  const match = from.match(/^([^<]+)/);
  return match ? match[1].trim().replace(/"/g, "") : from.split("@")[0];
}

function extractSenderEmail(from?: string): string {
  if (!from) return "";
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from;
}

function getEmailTag(labels?: string[]): { label: string; type: string } | null {
  if (!labels) return null;
  if (labels.includes("CATEGORY_PROMOTIONS")) return { label: "Promo", type: "promo" };
  if (labels.includes("CATEGORY_UPDATES")) return { label: "Update", type: "client" };
  if (labels.includes("CATEGORY_SOCIAL")) return { label: "Social", type: "system" };
  return null;
}

/* Sidebar label icon helper */
function LabelIcon({ labelId }: { labelId: string }) {
  const props = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 };
  switch (labelId) {
    case "INBOX": return <svg {...props} fill="currentColor" stroke="none"><path d="M4 4h16v2H4z" /><path d="M4 8l8 5 8-5v10H4V8z" /></svg>;
    case "STARRED": return <svg {...props}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>;
    case "SENT": return <svg {...props}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>;
    case "DRAFT": return <svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>;
    case "TRASH": return <svg {...props}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>;
    case "SPAM": return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
    default: return <svg {...props} fill="currentColor" stroke="none"><circle cx="12" cy="12" r="4" /></svg>;
  }
}

function getLabelDisplayName(label: GmailLabel): string {
  const map: Record<string, string> = {
    INBOX: "Doručená pošta", STARRED: "Důležité", SENT: "Odeslané",
    DRAFT: "Koncepty", TRASH: "Koš", SPAM: "Spam",
    CATEGORY_PRIMARY: "Primární", CATEGORY_PROMOTIONS: "Propagace",
    CATEGORY_SOCIAL: "Sociální sítě", CATEGORY_UPDATES: "Aktualizace",
    CATEGORY_FORUMS: "Fóra",
  };
  return map[label.id] || label.name;
}

function Badge({ count, type }: { count?: number | null; type?: string }) {
  if (!count) return null;
  return <span className={`${s.navBadge} ${type ? s[`badge_${type}`] : ""}`}>{count > 999 ? "999+" : count}</span>;
}

function Avatar({ initials, color, size = 34 }: { initials: string; color: string; size?: number }) {
  return (
    <div className={s.avatar} style={{ background: color, width: size, height: size, fontSize: size < 36 ? "0.72rem" : "0.8rem" }}>
      {initials}
    </div>
  );
}

/* ================================================================
   MAIN COMPONENT
   ================================================================ */
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
  const [mobileDetailVisible, setMobileDetailVisible] = useState(false);
  const [filterTab, setFilterTab] = useState(0);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const replyRef = useRef<HTMLTextAreaElement>(null);

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
          error?: string; messages?: GmailListItem[]; nextPageToken?: string;
        };
        if (!res.ok) { setError(data.error ?? "Načtení e-mailů selhalo."); return; }
        setMessages(prev => pageToken ? [...prev, ...(data.messages ?? [])] : (data.messages ?? []));
        setNextPageToken(data.nextPageToken ?? null);
      } catch { setError("Načtení e-mailů selhalo."); }
      finally { setLoading(false); }
    },
    [activeLabel, q]
  );

  const loadMessage = useCallback(async (id: string) => {
    const res = await fetch(`/api/gmail/messages/${id}`);
    const data = (await res.json().catch(() => ({}))) as GmailDetail & { error?: string };
    if (!res.ok) { setError(data.error ?? "Načtení detailu selhalo."); return; }
    setSelected(data);
    setSelectedId(id);
    setMobileDetailVisible(true);
    setReplyOpen(false);
    setReplyText("");
    const threadRes = await fetch(`/api/gmail/threads/${data.threadId}`);
    const threadData = (await threadRes.json().catch(() => ({}))) as { messages?: GmailThreadMessage[] };
    setThread(threadData.messages ?? []);
  }, []);

  useEffect(() => { loadLabels().catch(() => undefined); }, [loadLabels]);
  useEffect(() => { loadMessages().catch(() => undefined); }, [loadMessages]);

  const systemLabels = useMemo(
    () => labels
      .filter(l => SYSTEM_LABEL_ORDER.includes(l.id))
      .sort((a, b) => SYSTEM_LABEL_ORDER.indexOf(a.id) - SYSTEM_LABEL_ORDER.indexOf(b.id)),
    [labels]
  );

  const categoryLabels = useMemo(
    () => labels.filter(l => l.id.startsWith("CATEGORY_")),
    [labels]
  );

  const filteredMessages = useMemo(() => {
    let msgs = messages;
    if (filterTab === 1) msgs = msgs.filter(m => m.isUnread);
    if (q.trim()) {
      const lq = q.toLowerCase();
      msgs = msgs.filter(m =>
        m.subject?.toLowerCase().includes(lq) ||
        m.from?.toLowerCase().includes(lq) ||
        m.snippet?.toLowerCase().includes(lq)
      );
    }
    return msgs;
  }, [messages, filterTab, q]);

  const unreadCount = useMemo(() => messages.filter(m => m.isUnread).length, [messages]);

  async function messageAction(endpoint: string, body?: unknown) {
    if (!selectedId) return;
    const res = await fetch(`/api/gmail/messages/${selectedId}/${endpoint}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) { setError(data.error ?? "Akce selhala."); return; }
    await loadMessages();
    if (endpoint === "delete" || endpoint === "trash") {
      setSelected(null); setSelectedId(null); setThread([]); setMobileDetailVisible(false);
    } else if (selectedId) {
      await loadMessage(selectedId);
    }
  }

  const handleLabelClick = (labelId: string) => {
    setActiveLabel(labelId);
    setSelected(null);
    setSelectedId(null);
    setThread([]);
    setMobileDetailVisible(false);
  };

  const handleReply = () => {
    setReplyOpen(v => !v);
    if (!replyOpen) setTimeout(() => replyRef.current?.focus(), 50);
  };

  const getCategoryColor = (labelId: string): string => {
    const map: Record<string, string> = {
      CATEGORY_PRIMARY: "#8B5CF6", CATEGORY_UPDATES: "#F59E0B",
      CATEGORY_PROMOTIONS: "#10B981", CATEGORY_SOCIAL: "#3B82F6",
      CATEGORY_FORUMS: "#EC4899",
    };
    return map[labelId] || "#64748B";
  };

  return (
    <IntegrationConnectionGate provider="gmail">
      <div className={s.workspace}>

        {/* ====== SIDEBAR ====== */}
        <aside className={s.sidebar}>
          <div className={s.sidebarHeader}>
            <div className={s.sidebarBrand}>
              <div className={s.sidebarLogo}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}>
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <span className={s.sidebarBrandName}>Gmail</span>
            </div>
            <button className={s.composeBtn} onClick={() => setComposeOpen(true)}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Napsat e-mail
            </button>
          </div>

          <nav className={s.sidebarNav}>
            <span className={s.navSectionLabel}>Složky</span>

            {systemLabels.map(label => (
              <div key={label.id}
                className={`${s.navItem} ${activeLabel === label.id ? s.navItemActive : ""}`}
                onClick={() => handleLabelClick(label.id)}
              >
                <div className={s.navIcon}><LabelIcon labelId={label.id} /></div>
                {getLabelDisplayName(label)}
                {label.id === "INBOX" && unreadCount > 0 && <Badge count={unreadCount} type="accent" />}
              </div>
            ))}

            {categoryLabels.length > 0 && (
              <>
                <span className={s.navSectionLabel} style={{ marginTop: 8 }}>Kategorie</span>
                {categoryLabels.map(label => (
                  <div key={label.id}
                    className={`${s.navItem} ${activeLabel === label.id ? s.navItemActive : ""}`}
                    onClick={() => handleLabelClick(label.id)}
                  >
                    <div className={s.navIcon} style={{ color: getCategoryColor(label.id) }}>
                      <svg width={10} height={10} viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="12" /></svg>
                    </div>
                    {getLabelDisplayName(label)}
                  </div>
                ))}
              </>
            )}
          </nav>

          <div className={s.sidebarFooter}>
            <div className={s.storageBarLabel}>
              <span>Úložiště</span>
              <span>Gmail</span>
            </div>
            <div className={s.storageBar}><div className={s.storageBarFill} /></div>
          </div>
        </aside>

        {/* ====== EMAIL LIST ====== */}
        <div className={s.emailListPanel}>
          <div className={s.listToolbar}>
            <div className={s.searchBox}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input type="text" placeholder="Hledat e-maily, kontakty..."
                value={q} onChange={e => setQ(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") loadMessages(); }} />
            </div>
            <button className={s.toolbarBtn} title="Filtrovat">
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
            </button>
            <button className={s.toolbarBtn} title="Obnovit" onClick={() => loadMessages()}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
            </button>
          </div>

          <div className={s.filterTabs}>
            {["Vše", "Nepřečtené", "S hvězdičkou", "Přílohy"].map((t, i) => (
              <div key={i}
                className={`${s.filterTab} ${filterTab === i ? s.filterTabActive : ""}`}
                onClick={() => setFilterTab(i)}
              >
                {t}
                {i === 1 && unreadCount > 0 && <span className={s.filterTabCount}>{unreadCount}</span>}
              </div>
            ))}
          </div>

          {error && <div className={s.errorBanner}>{error}</div>}

          <div className={s.emailList}>
            {loading && !messages.length ? (
              <div className={s.loadingState}>
                <div className={s.spinner} />
                <span style={{ fontSize: "0.82rem" }}>Načítám e-maily…</span>
              </div>
            ) : (
              <>
                {filteredMessages.map((msg, i) => {
                  const senderName = extractSenderName(msg.from || msg.to);
                  const tag = getEmailTag(msg.labelIds);
                  return (
                    <div key={msg.id}
                      className={`${s.emailItem} ${msg.isUnread ? s.emailUnread : ""} ${selectedId === msg.id ? s.emailActive : ""}`}
                      onClick={() => loadMessage(msg.id)}
                      style={{ animationDelay: `${i * 0.02}s` }}
                    >
                      <Avatar
                        initials={getInitials(senderName)}
                        color={getAvatarColor(senderName)}
                        size={34}
                      />
                      <div className={s.emailBody}>
                        <div className={`${s.emailSender} ${!msg.isUnread ? s.emailSenderRead : ""}`}>
                          {senderName}
                        </div>
                        <div className={`${s.emailSubject} ${!msg.isUnread ? s.emailSubjectRead : ""}`}>
                          {msg.subject || "(bez předmětu)"}
                        </div>
                        <div className={s.emailPreview}>{msg.snippet}</div>
                      </div>
                      <div className={s.emailMeta}>
                        <span className={`${s.emailDate} ${msg.isUnread ? s.emailDateUnread : ""}`}>
                          {formatEmailDate(msg.date)}
                        </span>
                        {tag && <span className={`${s.emailTag} ${s[`tag_${tag.type}`]}`}>{tag.label}</span>}
                      </div>
                    </div>
                  );
                })}
                {!filteredMessages.length && !loading && (
                  <div className={s.emptyPlaceholder}>
                    <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth={1.5}>
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    <div className={s.emptyTitle}>Žádné zprávy</div>
                    <div className={s.emptySub}>Pro tento filtr nebyly nalezeny žádné zprávy.</div>
                  </div>
                )}
              </>
            )}
          </div>

          {nextPageToken && (
            <button className={s.listLoadMore} onClick={() => loadMessages(nextPageToken)}>
              {loading ? "Načítám…" : "Načíst další →"}
            </button>
          )}
        </div>

        {/* ====== EMAIL DETAIL ====== */}
        <div className={`${s.emailDetail} ${mobileDetailVisible ? s.mobileDetailVisible : ""}`}>
          {selected ? (
            <>
              <div className={s.detailToolbar}>
                <button className={s.mobileBackBtn} onClick={() => setMobileDetailVisible(false)}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="15 18 9 12 15 6" /></svg>
                  Zpět
                </button>
                <button className={s.detailActionBtn} onClick={handleReply}>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></svg>
                  Odpovědět
                </button>
                <button className={s.detailActionBtn} onClick={() => setComposeOpen(true)}>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="15 17 20 12 15 7" /><path d="M4 18v-2a4 4 0 0 1 4-4h12" /></svg>
                  Přeposlat
                </button>
                <button className={s.detailActionBtn} onClick={() => messageAction("modify", { removeLabelIds: ["INBOX"] })}>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M20 9v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9" /><path d="M9 22V12h6v10M2 10.5L12 2l10 8.5" /></svg>
                  Archivovat
                </button>
                <button className={`${s.detailActionBtn} ${s.detailActionDanger}`} style={{ marginLeft: "auto" }}
                  onClick={() => messageAction("trash")}>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                  Smazat
                </button>
              </div>

              <div className={s.detailScroll}>
                <div className={s.detailContent}>
                  <div className={s.detailSubject}>{selected.headers.subject || "(bez předmětu)"}</div>

                  <div className={s.detailMeta}>
                    <Avatar
                      initials={getInitials(extractSenderName(selected.headers.from))}
                      color={getAvatarColor(extractSenderName(selected.headers.from))}
                      size={38}
                    />
                    <div className={s.detailMetaText}>
                      <div className={s.detailFrom}>
                        {extractSenderName(selected.headers.from)}{" "}
                        <span className={s.detailFromEmail}>&lt;{extractSenderEmail(selected.headers.from)}&gt;</span>
                      </div>
                      <div className={s.detailTo}>Komu: {selected.headers.to || "—"}</div>
                    </div>
                    <div className={s.detailTimestamp}>{formatFullDate(selected.headers.date)}</div>
                  </div>

                  <div className={s.detailBody}
                    dangerouslySetInnerHTML={{ __html: selected.bodyHtml || `<p>${selected.snippet}</p>` }} />

                  {thread.length > 1 && (
                    <div className={s.threadSection}>
                      <div className={s.threadTitle}>
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                        Vlákno ({thread.length})
                      </div>
                      {thread.map(msg => (
                        <div key={msg.id} className={s.threadMsg} onClick={() => loadMessage(msg.id)}>
                          <div className={s.threadMsgFrom}>{extractSenderName(msg.headers.from)}</div>
                          <div className={s.threadMsgSubject}>{msg.headers.subject || msg.snippet?.slice(0, 60)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {replyOpen && (
                <div className={s.replyComposer}>
                  <div className={s.replyHeader}>
                    <span className={s.replyLabel}>Odpověď</span>
                    <span className={s.replyTo}>{extractSenderEmail(selected.headers.from)}</span>
                  </div>
                  <textarea ref={replyRef} className={s.replyTextarea}
                    placeholder="Napište odpověď..." rows={3}
                    value={replyText} onChange={e => setReplyText(e.target.value)} />
                  <div className={s.replyActions}>
                    <div className={s.replyBtnGroup}>
                      <button className={s.replyIconBtn} title="Příloha">
                        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                      </button>
                      <button className={s.replyIconBtn} title="Zavřít" onClick={() => setReplyOpen(false)}>
                        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </div>
                    <button className={s.replySendBtn} onClick={() => { setComposeOpen(true); setReplyOpen(false); }}>
                      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                      Odeslat
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className={s.emptyPlaceholder}>
              <svg width={52} height={52} viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth={1.5}>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <div className={s.emptyTitle}>Vyberte e-mail</div>
              <div className={s.emptySub}>Klikněte na zprávu v seznamu pro zobrazení detailu.</div>
            </div>
          )}
        </div>
      </div>

      <GmailComposeSheet
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSent={() => loadMessages()}
        initial={selected ? {
          to: selected.headers.from,
          subject: selected.headers.subject?.startsWith("Re:") ? selected.headers.subject : `Re: ${selected.headers.subject || ""}`,
          body: `<p><br/></p><hr/><p>${selected.headers.from || ""}</p>`,
          threadId: selected.threadId,
          replyToMessageId: selected.headers.messageId,
        } : undefined}
      />
    </IntegrationConnectionGate>
  );
}
