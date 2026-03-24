"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  MapPin,
  RefreshCw,
  User,
  Video,
  Clock,
  Plus,
  X,
  Phone,
  Coffee,
  Briefcase,
  ExternalLink,
} from "lucide-react";
import { listEvents, createEvent, type EventRow } from "@/app/actions/events";
import type { ContactRow } from "@/app/actions/contacts";
import {
  BottomSheet,
  EmptyState,
  ErrorState,
  FilterChips,
  FloatingActionButton,
  LoadingSkeleton,
  MobileCard,
  StatusBadge,
} from "@/app/shared/mobile-ui/primitives";
import { CustomDropdown } from "@/app/components/ui/CustomDropdown";
import type { DeviceClass } from "@/lib/ui/useDeviceClass";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

type RangeFilter = "today" | "week" | "month";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function formatDayHeading(d: Date, isToday: boolean) {
  const base = d.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long" });
  return isToday ? `Dnes — ${base}` : base;
}

function formatTimeRange(ev: EventRow) {
  const s = new Date(ev.startAt);
  const e = ev.endAt ? new Date(ev.endAt) : null;
  if (ev.allDay) return "Celý den";
  const t0 = s.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
  if (!e) return t0;
  const t1 = e.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
  return `${t0} – ${t1}`;
}

function getDuration(ev: EventRow): string | null {
  if (!ev.endAt || ev.allDay) return null;
  const mins = Math.round((new Date(ev.endAt).getTime() - new Date(ev.startAt).getTime()) / 60000);
  if (mins < 60) return `${mins} min`;
  return `${(mins / 60).toFixed(1).replace(".0", "")} hod`;
}

const EVENT_TYPE_CONFIG: Record<string, { label: string; border: string; bg: string; icon: React.ElementType }> = {
  schuzka: { label: "Schůzka", border: "border-l-indigo-500", bg: "bg-indigo-50/30", icon: Coffee },
  telefonat: { label: "Telefonát", border: "border-l-emerald-500", bg: "bg-emerald-50/30", icon: Phone },
  online: { label: "Online", border: "border-l-blue-500", bg: "bg-blue-50/30", icon: Video },
  obchod: { label: "Obchod", border: "border-l-amber-500", bg: "bg-amber-50/30", icon: Briefcase },
};

function getEventConfig(type: string | null) {
  return EVENT_TYPE_CONFIG[type ?? ""] ?? { label: type ?? "Událost", border: "border-l-slate-400", bg: "", icon: CalendarDays };
}

const EVENT_TYPES = [
  { id: "schuzka", label: "Schůzka" },
  { id: "telefonat", label: "Telefonát" },
  { id: "online", label: "Online" },
  { id: "obchod", label: "Obchod" },
];

/* ------------------------------------------------------------------ */
/*  Event Card                                                         */
/* ------------------------------------------------------------------ */

function EventCard({
  ev,
  onClick,
}: {
  ev: EventRow;
  onClick: () => void;
}) {
  const cfg = getEventConfig(ev.eventType);
  const Icon = cfg.icon;
  const duration = getDuration(ev);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "w-full text-left border border-slate-200 rounded-xl overflow-hidden border-l-4",
        cfg.border,
        cfg.bg
      )}
    >
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5 min-w-0">
            <Icon size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{ev.title}</p>
              {ev.contactName ? (
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                  <User size={10} /> {ev.contactName}
                </p>
              ) : null}
              {ev.location ? (
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                  <MapPin size={10} /> {ev.location}
                </p>
              ) : null}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs font-black text-indigo-700">{formatTimeRange(ev)}</p>
            {duration ? (
              <p className="text-[10px] text-slate-400 mt-0.5">{duration}</p>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Event Detail Sheet                                                 */
/* ------------------------------------------------------------------ */

function EventDetailSheet({
  ev,
  onClose,
  onOpenContact,
}: {
  ev: EventRow;
  onClose: () => void;
  onOpenContact: (id: string) => void;
}) {
  const cfg = getEventConfig(ev.eventType);

  return (
    <BottomSheet open onClose={onClose} title={ev.title}>
      <div className="space-y-3">
        {/* Meta */}
        <MobileCard className="divide-y divide-slate-100 py-0 px-4">
          <div className="flex items-center gap-3 py-3">
            <Clock size={15} className="text-slate-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-slate-900">{formatTimeRange(ev)}</p>
              {getDuration(ev) ? (
                <p className="text-xs text-slate-500">{getDuration(ev)}</p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-3 py-3">
            <cfg.icon size={15} className="text-slate-400 flex-shrink-0" />
            <StatusBadge tone="info">{cfg.label}</StatusBadge>
          </div>
          {ev.contactName && ev.contactId ? (
            <div className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3">
                <User size={15} className="text-slate-400 flex-shrink-0" />
                <p className="text-sm font-bold text-slate-900">{ev.contactName}</p>
              </div>
              <button
                type="button"
                onClick={() => { onOpenContact(ev.contactId!); onClose(); }}
                className="flex items-center gap-1 text-xs font-bold text-indigo-600 min-h-[32px] px-2"
              >
                Profil <ExternalLink size={11} />
              </button>
            </div>
          ) : null}
          {ev.location ? (
            <div className="flex items-center gap-3 py-3">
              <MapPin size={15} className="text-slate-400 flex-shrink-0" />
              <p className="text-sm text-slate-700">{ev.location}</p>
            </div>
          ) : null}
          {ev.meetingLink ? (
            <div className="flex items-center gap-3 py-3">
              <Video size={15} className="text-slate-400 flex-shrink-0" />
              <a
                href={ev.meetingLink}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-bold text-indigo-600 truncate"
              >
                Připojit se online
              </a>
            </div>
          ) : null}
        </MobileCard>

        {ev.notes ? (
          <MobileCard className="p-3.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
              Poznámky
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">{ev.notes}</p>
          </MobileCard>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="w-full min-h-[44px] rounded-xl border border-slate-200 text-sm font-bold text-slate-600"
        >
          Zavřít
        </button>
      </div>
    </BottomSheet>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Screen                                                        */
/* ------------------------------------------------------------------ */

export function CalendarMobileScreen({
  contacts,
  deviceClass = "phone",
}: {
  contacts: ContactRow[];
  deviceClass?: DeviceClass;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("week");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventRow | null>(null);

  const [draftTitle, setDraftTitle] = useState("");
  const [draftType, setDraftType] = useState("schuzka");
  const [draftStart, setDraftStart] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - (now.getMinutes() % 15));
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });
  const [draftContactId, setDraftContactId] = useState("");
  const [draftLocation, setDraftLocation] = useState("");

  const load = useCallback(() => {
    startTransition(async () => {
      setError(null);
      try {
        const start = startOfDay(new Date()).toISOString();
        const end = addDays(new Date(), 62).toISOString();
        const rows = await listEvents({ start, end });
        setEvents(rows);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Kalendář se nepodařilo načíst.");
        setEvents([]);
      }
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => startOfDay(now).toISOString().slice(0, 10), [now]);

  const filtered = useMemo(() => {
    const startToday = startOfDay(now).getTime();
    const endToday = addDays(startOfDay(now), 1).getTime();
    const endWeek = addDays(startOfDay(now), 7).getTime();
    return events.filter((ev) => {
      const t = new Date(ev.startAt).getTime();
      if (rangeFilter === "today") return t >= startToday && t < endToday;
      if (rangeFilter === "week") return t >= startToday && t < endWeek;
      return true;
    });
  }, [events, rangeFilter, now]);

  const grouped = useMemo(() => {
    const map = new Map<string, EventRow[]>();
    for (const ev of filtered) {
      const d = startOfDay(new Date(ev.startAt));
      const key = d.toISOString().slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    }
    const keys = [...map.keys()].sort();
    return keys.map((key) => ({
      key,
      isToday: key === todayStr,
      date: new Date(`${key}T12:00:00`),
      items: (map.get(key) ?? []).sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
      ),
    }));
  }, [filtered, todayStr]);

  const todayCount = events.filter(
    (ev) => startOfDay(new Date(ev.startAt)).toISOString().slice(0, 10) === todayStr
  ).length;

  async function onCreateEvent() {
    if (!draftTitle.trim()) return;
    startTransition(async () => {
      setError(null);
      try {
        const startAt = new Date(draftStart).toISOString();
        const end = new Date(new Date(draftStart).getTime() + 60 * 60 * 1000).toISOString();
        await createEvent({
          title: draftTitle.trim(),
          eventType: draftType,
          startAt,
          endAt: end,
          contactId: draftContactId || undefined,
          location: draftLocation || undefined,
        });
        setCreateOpen(false);
        setDraftTitle("");
        setDraftLocation("");
        setDraftContactId("");
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Událost se nepodařilo vytvořit.");
      }
    });
  }

  return (
    <div className="pb-20">
      {error ? <ErrorState title={error} onRetry={load} /> : null}

      {/* Header / filters */}
      <div className="px-4 py-3 bg-white border-b border-slate-100 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-indigo-600" />
            <h2 className="text-base font-black text-slate-900">Kalendář</h2>
            {todayCount > 0 ? (
              <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-lg">
                Dnes: {todayCount}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={load}
            disabled={busy}
            className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center"
          >
            <RefreshCw size={14} className={cx("text-slate-500", busy && "animate-spin")} />
          </button>
        </div>
        <FilterChips
          value={rangeFilter}
          onChange={(id) => setRangeFilter(id as RangeFilter)}
          options={[
            { id: "today", label: "Dnes", badge: todayCount },
            {
              id: "week",
              label: "7 dní",
              badge: events.filter((ev) => {
                const t = new Date(ev.startAt).getTime();
                return t >= startOfDay(now).getTime() && t < addDays(startOfDay(now), 7).getTime();
              }).length,
            },
            { id: "month", label: "2 měsíce", badge: events.length },
          ]}
        />
      </div>

      {busy && events.length === 0 ? <LoadingSkeleton rows={4} /> : null}

      {!busy && !error && grouped.length === 0 ? (
        <div className="px-4 pt-8">
          <EmptyState
            title="Žádné události"
            description="Vytvořte první schůzku přes + tlačítko."
          />
        </div>
      ) : null}

      {/* Event groups */}
      <div className="space-y-0">
        {grouped.map((group) => (
          <section key={group.key} className="px-4 py-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2
                className={cx(
                  "text-xs uppercase tracking-wider font-black",
                  group.isToday ? "text-indigo-700" : "text-slate-500"
                )}
              >
                {group.isToday ? "📅 " : ""}
                {formatDayHeading(group.date, group.isToday)}
                <span className="ml-1.5 font-normal text-[10px] bg-slate-100 rounded-md px-1.5 py-0.5">
                  {group.items.length}
                </span>
              </h2>
            </div>
            <div className="space-y-2">
              {group.items.map((ev) => (
                <EventCard key={ev.id} ev={ev} onClick={() => setSelectedEvent(ev)} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* FAB */}
      <FloatingActionButton onClick={() => setCreateOpen(true)} label="Nová schůzka" />

      {/* Event detail sheet */}
      {selectedEvent ? (
        <EventDetailSheet
          ev={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onOpenContact={(id) => router.push(`/portal/contacts/${id}`)}
        />
      ) : null}

      {/* Create sheet */}
      <BottomSheet open={createOpen} onClose={() => setCreateOpen(false)} title="Nová událost">
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">
              Typ události
            </label>
            <FilterChips
              value={draftType}
              onChange={setDraftType}
              options={EVENT_TYPES.map((t) => ({ id: t.id, label: t.label }))}
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">
              Název *
            </label>
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm"
              placeholder="Např. Schůzka s Novákem"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">
              Začátek
            </label>
            <input
              type="datetime-local"
              value={draftStart}
              onChange={(e) => setDraftStart(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">
              Místo (volitelně)
            </label>
            <input
              value={draftLocation}
              onChange={(e) => setDraftLocation(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm"
              placeholder="Adresa nebo odkaz"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">
              Klient (volitelně)
            </label>
            <CustomDropdown
              value={draftContactId}
              onChange={setDraftContactId}
              placeholder="— Bez klienta —"
              options={[
                { id: "", label: "— Bez klienta —" },
                ...contacts.map((c) => ({
                  id: c.id,
                  label: `${c.firstName} ${c.lastName}`,
                })),
              ]}
            />
          </div>
          <button
            type="button"
            onClick={onCreateEvent}
            disabled={busy || !draftTitle.trim()}
            className="w-full min-h-[48px] rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-60"
          >
            Uložit událost
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
