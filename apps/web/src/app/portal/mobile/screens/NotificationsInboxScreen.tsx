"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  MessageSquare,
  Bell,
  Mail,
  Smartphone,
  MessageCircle,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  CheckCheck,
} from "lucide-react";
import {
  getConversationsList,
  getUnreadConversationsCount,
  markMessagesRead,
  type ConversationListItem,
} from "@/app/actions/messages";
import {
  getNotificationBadgeCount,
  getNotificationLog,
  type NotificationRow,
} from "@/app/actions/notification-log";
import {
  EmptyState,
  ErrorState,
  FilterChips,
  LoadingSkeleton,
  MobileCard,
  MobileSection,
  SearchBar,
} from "@/app/shared/mobile-ui/primitives";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type View = "inbox" | "log";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getAvatarColor(name: string): string {
  const palette = [
    "bg-indigo-500",
    "bg-purple-500",
    "bg-emerald-500",
    "bg-blue-500",
    "bg-rose-500",
    "bg-amber-500",
    "bg-teal-500",
    "bg-violet-500",
  ];
  const idx = Array.from(name).reduce((s, c) => s + c.charCodeAt(0), 0) % palette.length;
  return palette[idx];
}

function formatRelativeTime(date: Date): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return "Právě teď";
  if (diff < 3600) return `Před ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Před ${Math.floor(diff / 3600)} hod`;
  if (diff < 172800) return "Včera";
  return new Date(date).toLocaleDateString("cs-CZ", { day: "numeric", month: "short" });
}

function getChannelIcon(channel: string) {
  switch (channel) {
    case "email": return <Mail size={14} className="text-blue-500" />;
    case "push": return <Smartphone size={14} className="text-indigo-500" />;
    case "sms": return <MessageCircle size={14} className="text-emerald-500" />;
    default: return <Bell size={14} className="text-[color:var(--wp-text-tertiary)]" />;
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "sent":
    case "delivered":
      return <CheckCircle2 size={14} className="text-emerald-500" />;
    case "failed":
      return <XCircle size={14} className="text-rose-500" />;
    case "pending":
      return <Clock size={14} className="text-amber-500" />;
    default:
      return <CheckCircle2 size={14} className="text-[color:var(--wp-text-tertiary)]" />;
  }
}

/* ------------------------------------------------------------------ */
/*  Conversation Card                                                  */
/* ------------------------------------------------------------------ */

function ConversationCard({
  item,
  onMarkRead,
}: {
  item: ConversationListItem;
  onMarkRead: () => void;
}) {
  const initials = getInitials(item.contactName);
  const avatarColor = getAvatarColor(item.contactName);

  return (
    <MobileCard className={cx("p-0 overflow-hidden", item.unread && "border-indigo-200")}>
      <div className="flex items-start gap-3 p-3.5">
        {/* Avatar */}
        <div
          className={cx(
            "w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black flex-shrink-0",
            avatarColor
          )}
        >
          {initials}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={cx("text-sm font-bold truncate", item.unread ? "text-[color:var(--wp-text)]" : "text-[color:var(--wp-text-secondary)]")}>
              {item.contactName}
            </p>
            <span className="text-[11px] text-[color:var(--wp-text-tertiary)] flex-shrink-0">
              {formatRelativeTime(item.lastMessageAt)}
            </span>
          </div>
          <p className="text-xs text-[color:var(--wp-text-secondary)] mt-0.5 truncate leading-relaxed">
            {item.lastMessage || "Bez obsahu"}
          </p>

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              {item.unread ? (
                <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-600" />
                  {item.unreadCount > 1 ? `${item.unreadCount} nových` : "Nová"}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-[color:var(--wp-text-tertiary)] font-bold">
                  <CheckCheck size={12} /> Přečteno
                </span>
              )}
            </div>
            {item.unread ? (
              <button
                type="button"
                onClick={onMarkRead}
                className="text-[11px] font-bold text-indigo-600 min-h-[32px] px-2.5 rounded-lg border border-indigo-200 bg-indigo-50"
              >
                Označit přečtené
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </MobileCard>
  );
}

/* ------------------------------------------------------------------ */
/*  Notification Log Card                                              */
/* ------------------------------------------------------------------ */

function NotificationLogCard({ item }: { item: NotificationRow }) {
  return (
    <MobileCard className="p-3.5">
      <div className="flex items-start gap-3">
        {/* Channel icon bubble */}
        <div className="w-9 h-9 rounded-xl bg-[color:var(--wp-surface-muted)] border border-[color:var(--wp-surface-card-border)] flex items-center justify-center flex-shrink-0">
          {getChannelIcon(item.channel)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-[color:var(--wp-text)] truncate leading-snug">
              {item.subject || item.template || "Notifikace"}
            </p>
            {getStatusIcon(item.status)}
          </div>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[11px] text-[color:var(--wp-text-secondary)] font-bold">
              {item.recipient ?? "—"}
            </span>
            {item.contactName ? (
              <span className="text-[11px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded">
                {item.contactName}
              </span>
            ) : null}
          </div>

          <div className="flex items-center justify-between mt-1.5">
            <span
              className={cx(
                "text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded",
                item.status === "failed"
                  ? "bg-rose-50 text-rose-600"
                  : item.status === "pending"
                    ? "bg-amber-50 text-amber-600"
                    : "bg-emerald-50 text-emerald-600"
              )}
            >
              {item.status}
            </span>
            <span className="text-[11px] text-[color:var(--wp-text-tertiary)]">
              {formatRelativeTime(item.sentAt)}
            </span>
          </div>
        </div>
      </div>
    </MobileCard>
  );
}

/* ------------------------------------------------------------------ */
/*  Main screen                                                        */
/* ------------------------------------------------------------------ */

export function NotificationsInboxScreen({
  onBadgeCountChange,
}: {
  onBadgeCountChange?: (count: number) => void;
}) {
  const [view, setView] = useState<View>("inbox");
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [notificationLog, setNotificationLog] = useState<NotificationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      setError(null);
      try {
        const [list, log, unreadConversations, logBadge] = await Promise.all([
          getConversationsList(),
          getNotificationLog(80),
          getUnreadConversationsCount(),
          getNotificationBadgeCount(),
        ]);
        setConversations(list);
        setNotificationLog(log);
        onBadgeCountChange?.(unreadConversations + logBadge);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Inbox se nepodařilo načíst.");
      }
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredConversations = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.trim().toLowerCase();
    return conversations.filter(
      (item) =>
        item.contactName.toLowerCase().includes(q) ||
        item.lastMessage.toLowerCase().includes(q)
    );
  }, [conversations, search]);

  const filteredLog = useMemo(() => {
    if (!search.trim()) return notificationLog;
    const q = search.trim().toLowerCase();
    return notificationLog.filter((item) =>
      `${item.recipient ?? ""} ${item.subject ?? ""} ${item.contactName ?? ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [notificationLog, search]);

  async function markConversationRead(contactId: string) {
    startTransition(async () => {
      try {
        await markMessagesRead(contactId);
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Konverzaci se nepodařilo označit.");
      }
    });
  }

  const unreadCount = conversations.filter((c) => c.unread).length;

  return (
    <>
      {error ? <ErrorState title={error} onRetry={load} /> : null}

      {/* Tabs + search — always visible during initial load */}
      <MobileSection>
        <FilterChips
          value={view}
          onChange={(id) => setView(id as View)}
          options={[
            {
              id: "inbox",
              label: "Zprávy",
              badge: unreadCount,
              tone: unreadCount > 0 ? "warning" : "neutral",
            },
            { id: "log", label: "Log notifikací", badge: notificationLog.length },
          ]}
        />
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder={view === "inbox" ? "Hledat konverzaci…" : "Hledat notifikaci…"}
        />
      </MobileSection>

      {pending && conversations.length === 0 && notificationLog.length === 0 ? (
        <LoadingSkeleton rows={3} />
      ) : null}

      {/* Inbox view */}
      {view === "inbox" ? (
        <>
          {/* Header with count + mark-all */}
          {unreadCount > 0 ? (
            <MobileCard className="border-indigo-200 bg-indigo-50/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <MessageSquare size={16} className="text-indigo-600" />
                  <p className="text-sm font-bold text-indigo-800">
                    {unreadCount} {unreadCount === 1 ? "nepřečtená zpráva" : unreadCount < 5 ? "nepřečtené zprávy" : "nepřečtených zpráv"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await Promise.all(
                          conversations
                            .filter((c) => c.unread)
                            .map((c) => markMessagesRead(c.contactId))
                        );
                        load();
                      } catch {
                        // noop
                      }
                    });
                  }}
                  className="text-[11px] font-bold text-indigo-700 min-h-[32px] px-2.5 rounded-lg border border-indigo-200 bg-[color:var(--wp-surface-card)] flex items-center gap-1 shrink-0"
                >
                  <RefreshCw size={11} /> Označit vše
                </button>
              </div>
            </MobileCard>
          ) : null}

          <MobileSection title={`Konverzace (${filteredConversations.length})`}>
            {filteredConversations.length === 0 ? (
              <EmptyState
                title="Inbox je prázdný"
                description="Zatím nejsou žádné klientské konverzace."
              />
            ) : (
              filteredConversations.map((item) => (
                <ConversationCard
                  key={item.contactId}
                  item={item}
                  onMarkRead={() => markConversationRead(item.contactId)}
                />
              ))
            )}
          </MobileSection>
        </>
      ) : (
        /* Log view */
        <MobileSection title={`Odeslaných notifikací (${filteredLog.length})`}>
          {filteredLog.length === 0 ? (
            <EmptyState
              title="Bez notifikací"
              description="Historie odeslaných notifikací je prázdná."
            />
          ) : (
            filteredLog.map((item) => (
              <NotificationLogCard key={item.id} item={item} />
            ))
          )}
        </MobileSection>
      )}
    </>
  );
}
