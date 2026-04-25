"use client";

import React from "react";
import {
  AlignLeft,
  Bell,
  Briefcase,
  Calendar,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  LayoutGrid,
  Link2,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Star,
  User,
  X,
} from "lucide-react";

import { LandingMockCanvas } from "./LandingMockCanvas";
import { LandingProductFrame } from "./LandingProductFrame";

type ActivityTypeId = "schuzka" | "telefonat" | "kafe" | "email" | "ukol" | "priorita";

type CalendarEvent = {
  id: string;
  day: number;
  start: number;
  duration: number;
  title: string;
  time: string;
  type: ActivityTypeId;
  color: string;
};

type DraftState = {
  type: ActivityTypeId;
  title: string;
  isAllDay: boolean;
  client: string;
  trade: string;
  location: string;
  link: string;
  note: string;
};

const ACTIVITY_TYPES = [
  {
    id: "schuzka",
    label: "Schůzka",
    icon: Calendar,
    activeClass: "bg-[#4388F0] text-white border-[#4388F0]",
    inactiveClass: "bg-blue-50/50 text-blue-600 border-blue-100/60 hover:bg-blue-50",
  },
  {
    id: "telefonat",
    label: "Telefonát",
    icon: Phone,
    activeClass: "bg-rose-500 text-white border-rose-500",
    inactiveClass: "bg-rose-50/30 text-rose-600 border-rose-100/60 hover:bg-rose-50",
  },
  {
    id: "kafe",
    label: "Kafe",
    icon: Coffee,
    activeClass: "bg-amber-700 text-white border-amber-700",
    inactiveClass: "bg-amber-50/50 text-amber-700 border-amber-100/60 hover:bg-amber-50",
  },
  {
    id: "email",
    label: "E-mail",
    icon: Mail,
    activeClass: "bg-[#9333EA] text-white border-[#9333EA]",
    inactiveClass: "bg-purple-50/30 text-purple-600 border-purple-100/60 hover:bg-purple-50",
  },
  {
    id: "ukol",
    label: "Úkol",
    icon: CheckSquare,
    activeClass: "bg-emerald-500 text-white border-emerald-500",
    inactiveClass: "bg-emerald-50/30 text-emerald-600 border-emerald-100/60 hover:bg-emerald-50",
  },
  {
    id: "priorita",
    label: "Priorita",
    icon: Star,
    activeClass: "bg-amber-400 text-white border-amber-400",
    inactiveClass: "bg-orange-50/30 text-orange-600 border-orange-100/60 hover:bg-orange-50",
    iconClass: "fill-current",
  },
] as const satisfies ReadonlyArray<{
  id: ActivityTypeId;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  activeClass: string;
  inactiveClass: string;
  iconClass?: string;
}>;

const WEEK_DAYS = [
  { date: "9", name: "PO" },
  { date: "10", name: "ÚT" },
  { date: "11", name: "ST" },
  { date: "12", name: "ČT" },
  { date: "13", name: "PÁ" },
  { date: "14", name: "SO" },
  { date: "15", name: "NE" },
] as const;

const TIME_SLOTS = ["8:00", "9:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"] as const;

const BASE_EVENTS: readonly CalendarEvent[] = [
  { id: "e1", day: 0, start: 8, duration: 1, title: "P.N.", time: "08:00 - 09:00", type: "schuzka", color: "bg-[#38bdf8] text-white border-[#0284c7]" },
  { id: "e2", day: 0, start: 9, duration: 1, title: "Jana Veselá", time: "09:00 - 10:00", type: "ukol", color: "bg-[#6ee7b7] text-slate-800 border-[#059669]" },
  { id: "e3", day: 0, start: 10, duration: 1, title: "Karel Horák", time: "10:00 - 11:00", type: "email", color: "bg-[#c084fc] text-white border-[#7e22ce]" },
  { id: "e4", day: 0, start: 11, duration: 1, title: "Bartoš", time: "11:00 - 12:00", type: "priorita", color: "bg-[#fbbf24] text-slate-800 border-[#b45309]" },
  { id: "e5", day: 1, start: 13, duration: 1, title: "Petra Svobodová", time: "13:00 - 14:00", type: "schuzka", color: "bg-[#38bdf8] text-white border-[#0284c7]" },
  { id: "e6", day: 2, start: 8, duration: 1, title: "Lukáš Dvořák", time: "08:00 - 09:00", type: "priorita", color: "bg-[#fbbf24] text-slate-800 border-[#b45309]" },
  { id: "e7", day: 2, start: 9, duration: 1, title: "Michal Černý", time: "09:00 - 10:00", type: "schuzka", color: "bg-[#38bdf8] text-white border-[#0284c7]" },
  { id: "e8", day: 3, start: 10, duration: 1, title: "David Zelený", time: "10:00 - 11:00", type: "telefonat", color: "bg-[#fb923c] text-white border-[#c2410c]" },
  { id: "e9", day: 3, start: 13, duration: 1, title: "Ondřej Kříž", time: "13:00 - 14:00", type: "schuzka", color: "bg-[#38bdf8] text-white border-[#0284c7]" },
  { id: "e10", day: 4, start: 8, duration: 1, title: "Martin Bílý", time: "08:00 - 09:00", type: "ukol", color: "bg-[#6ee7b7] text-slate-800 border-[#059669]" },
  { id: "e11", day: 4, start: 10, duration: 1, title: "Alena Modrá", time: "10:00 - 11:00", type: "schuzka", color: "bg-[#38bdf8] text-white border-[#0284c7]" },
  { id: "e12", day: 4, start: 13, duration: 1, title: "Simona Nová", time: "13:00 - 14:00", type: "schuzka", color: "bg-[#38bdf8] text-white border-[#0284c7]" },
  { id: "e13", day: 4, start: 15.5, duration: 1, title: "Jan Procházka...", time: "15:30 - 16:30", type: "telefonat", color: "bg-[#fb7185] text-white border-[#be123c]" },
] as const;

const CLIENT_OPTIONS = [
  "Marek Marek",
  "Jana Veselá",
  "Karel Horák",
  "Lucie Bílá",
  "Tomáš Zíta",
] as const;

const TRADE_OPTIONS = ["- žádný -", "Hypotéka - Novák", "Revize portfolia - Marek", "Životní pojištění - Veselá"] as const;

const LOCATION_OPTIONS = [
  "Kancelář Brno, Veveří 102",
  "Online schůzka",
  "Klientská zóna Praha 4",
  "Kavárna Indigo, Brno",
] as const;

const LINK_OPTIONS = [
  "https://meet.google.com/aidvisora-demo",
  "https://teams.microsoft.com/l/meetup-join/demo",
  "https://cal.com/aidvisora/revize",
] as const;

const DEFAULT_DRAFT: DraftState = {
  type: "schuzka",
  title: "Revize finančního plánu",
  isAllDay: false,
  client: CLIENT_OPTIONS[0],
  trade: TRADE_OPTIONS[2],
  location: LOCATION_OPTIONS[0],
  link: LINK_OPTIONS[0],
  note: "Klient chce projít investice, životní pojištění a navázat další schůzku.",
};

const TYPE_EVENT_COLORS: Record<ActivityTypeId, string> = {
  schuzka: "bg-[#38bdf8] text-white border-[#0284c7]",
  telefonat: "bg-[#fb7185] text-white border-[#be123c]",
  kafe: "bg-[#fbbf24] text-slate-800 border-[#b45309]",
  email: "bg-[#c084fc] text-white border-[#7e22ce]",
  ukol: "bg-[#6ee7b7] text-slate-800 border-[#059669]",
  priorita: "bg-[#fb923c] text-white border-[#c2410c]",
};

function formatEventTime(start: number, duration: number, isAllDay: boolean) {
  if (isAllDay) return "Celý den";
  const startHour = Math.floor(start);
  const startMinutes = start % 1 === 0.5 ? "30" : "00";
  const endDecimal = start + duration;
  const endHour = Math.floor(endDecimal);
  const endMinutes = endDecimal % 1 === 0.5 ? "30" : "00";
  return `${startHour.toString().padStart(2, "0")}:${startMinutes} - ${endHour
    .toString()
    .padStart(2, "0")}:${endMinutes}`;
}

export function CalendarDemo() {
  const [events, setEvents] = React.useState<CalendarEvent[]>(() => [...BASE_EVENTS]);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [activeType, setActiveType] = React.useState<ActivityTypeId>("schuzka");
  const [isAllDay, setIsAllDay] = React.useState(false);
  const [draft, setDraft] = React.useState<DraftState>(DEFAULT_DRAFT);
  const [selectedDay, setSelectedDay] = React.useState(4);
  const [selectedStart, setSelectedStart] = React.useState(9);

  const openModal = React.useCallback((day = 4, start = 9) => {
    setSelectedDay(day);
    setSelectedStart(start);
    setActiveType(DEFAULT_DRAFT.type);
    setIsAllDay(DEFAULT_DRAFT.isAllDay);
    setDraft(DEFAULT_DRAFT);
    setIsModalOpen(true);
  }, []);

  const closeModal = React.useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const saveEvent = React.useCallback(() => {
    const newEvent: CalendarEvent = {
      id: `session-${Date.now()}`,
      day: selectedDay,
      start: selectedStart,
      duration: 1,
      title: draft.title.trim() || draft.client,
      time: formatEventTime(selectedStart, 1, isAllDay),
      type: activeType,
      color: TYPE_EVENT_COLORS[activeType],
    };

    setEvents((prev) => [...prev, newEvent]);
    setIsModalOpen(false);
  }, [activeType, draft.client, draft.title, isAllDay, selectedDay, selectedStart]);

  return (
    <LandingProductFrame label="Kalendář · Týdenní přehled" status="pracovní týden" statusTone="indigo">
      <LandingMockCanvas className="bg-white">
        <div className="relative flex h-full w-full flex-col overflow-hidden bg-white font-inter text-slate-800">
          <style>{`
            .font-jakarta { font-family: var(--font-jakarta), var(--font-primary), -apple-system, BlinkMacSystemFont, sans-serif; }
            .font-inter { font-family: var(--font-primary), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
            .mock-calendar-grid {
              background-image:
                linear-gradient(to right, #F1F5F9 1px, transparent 1px),
                linear-gradient(to bottom, #F1F5F9 1px, transparent 1px);
              background-size: calc(100% / 7) 60px;
            }
            .input-calendar {
              background-color: #F1F5F9;
              border: 1px solid transparent;
              transition: all 0.2s ease;
            }
            .input-calendar:focus-within {
              background-color: #FFFFFF;
              border-color: #CBD5E1;
              box-shadow: 0 0 0 3px rgba(241, 245, 249, 0.8);
            }
            .hide-scroll::-webkit-scrollbar {
              display: none;
            }
          `}</style>

          <header className="z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-200">
                  Dnes
                </button>
                <button className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
                  <ChevronLeft size={16} />
                </button>
                <button className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
                  <ChevronRight size={16} />
                </button>
              </div>
              <h2 className="font-jakarta text-xl font-extrabold text-[#0B1021] lg:text-2xl">
                Únor 2026
                <span className="ml-2 text-sm font-semibold text-slate-400">7. týden</span>
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden rounded-xl bg-slate-100 p-1 md:flex">
                <button className="px-4 py-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700">
                  Pracovní
                </button>
                <button className="rounded-lg bg-white px-4 py-1.5 text-sm font-jakarta font-bold text-[#0B1021] shadow-sm">
                  Týden
                </button>
                <button className="px-4 py-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700">
                  Měsíc
                </button>
              </div>
              <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-colors hover:bg-indigo-100">
                <LayoutGrid size={18} />
              </button>
              <button className="hidden items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 sm:flex">
                <RefreshCw size={16} /> Sync s Google
              </button>
              <button
                type="button"
                onClick={() => openModal()}
                className="flex items-center gap-2 rounded-xl bg-[#0F172A] px-6 py-2.5 text-sm font-jakarta font-bold text-white shadow-md transition-all hover:bg-black hover:shadow-lg"
              >
                <Plus size={18} strokeWidth={2.5} /> VYTVOŘIT
              </button>
            </div>
          </header>

          <div className="z-10 flex shrink-0 border-b border-slate-200 bg-white">
            <div className="w-16 shrink-0 border-r border-slate-200" />
            {WEEK_DAYS.map((day, i) => (
              <div
                key={day.name}
                className={`flex flex-1 flex-col items-center justify-center border-r border-slate-200 py-4 ${
                  i === 0 ? "bg-indigo-50/40" : ""
                }`}
              >
                <span className={`mb-1.5 text-xs font-bold ${i === 0 ? "text-indigo-600" : "text-slate-400"}`}>{day.name}</span>
                <span className={`text-2xl ${i === 0 ? "font-bold text-indigo-600" : "text-slate-800"}`}>{day.date}</span>
              </div>
            ))}
          </div>

          <div className="hide-scroll relative flex-1 overflow-y-auto">
            <div className="relative flex" style={{ height: `${TIME_SLOTS.length * 60}px` }}>
              <div className="relative z-20 flex w-16 shrink-0 flex-col border-r border-slate-200 bg-white">
                {TIME_SLOTS.map((time) => (
                  <div key={time} className="relative h-[60px]">
                    <span className="absolute -top-2.5 right-3 text-[11px] font-medium text-slate-400">{time}</span>
                  </div>
                ))}
              </div>

              <div className="mock-calendar-grid relative flex-1">
                <div className="pointer-events-none absolute left-0 top-[180px] z-10 h-px w-full bg-rose-400">
                  <div className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-rose-400" />
                </div>

                {WEEK_DAYS.map((_, dayIndex) => (
                  <button
                    key={`overlay-${dayIndex}`}
                    type="button"
                    onClick={() => openModal(dayIndex, 9)}
                    className="absolute bottom-0 top-0 z-0 border-r border-transparent transition-colors hover:bg-slate-50/50"
                    style={{
                      left: `${(dayIndex / WEEK_DAYS.length) * 100}%`,
                      width: `calc(100% / ${WEEK_DAYS.length})`,
                    }}
                    aria-label={`Vytvořit aktivitu pro den ${dayIndex + 1}`}
                  />
                ))}

                {events.map((event) => {
                  const top = (event.start - 8) * 60;
                  const height = Math.max(event.duration * 60 - 4, 56);
                  const left = `${(event.day / WEEK_DAYS.length) * 100}%`;
                  const width = `calc(100% / ${WEEK_DAYS.length} - 16px)`;

                  return (
                    <div
                      key={event.id}
                      className={`absolute z-20 cursor-pointer rounded-xl border border-black/5 p-3 shadow-sm transition-shadow hover:shadow-md ${event.color}`}
                      style={{
                        top: `${top + 2}px`,
                        left: `calc(${left} + 8px)`,
                        height: `${height}px`,
                        width,
                      }}
                    >
                      <p className="truncate font-jakarta text-sm font-bold leading-tight">{event.title}</p>
                      <p className="mt-1 text-[11px] font-medium opacity-90">{event.time}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {isModalOpen ? (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-3">
              <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px] transition-opacity" onClick={closeModal} />

              <div className="relative flex max-h-[calc(100%-24px)] w-full max-w-[540px] flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_24px_80px_-12px_rgba(0,0,0,0.2)] animate-in fade-in zoom-in-95 duration-200">
                <div className="flex shrink-0 items-center justify-between px-6 pb-3 pt-6">
                  <h2 className="font-jakarta text-lg font-extrabold text-[#0B1021]">Nová aktivita v kalendáři</h2>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800"
                  >
                    <X size={18} strokeWidth={2.5} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 pb-6">
                  <div className="mb-6 grid grid-cols-3 gap-2.5">
                    {ACTIVITY_TYPES.map((activity) => {
                      const Icon = activity.icon;
                      const isActive = activeType === activity.id;

                      return (
                        <button
                          key={activity.id}
                          type="button"
                          onClick={() => {
                            setActiveType(activity.id);
                            setDraft((prev) => ({ ...prev, type: activity.id }));
                          }}
                          className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-jakarta font-bold transition-all duration-200 ${
                            isActive ? `${activity.activeClass} shadow-md` : activity.inactiveClass
                          }`}
                        >
                          <Icon size={16} strokeWidth={2.5} className={"iconClass" in activity ? activity.iconClass : ""} />
                          {activity.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="group relative mb-6">
                    <input
                      type="text"
                      value={draft.title}
                      onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="Název aktivity..."
                      className="w-full bg-transparent pb-2 text-[32px] font-jakarta font-bold text-[#0B1021] outline-none placeholder:text-slate-400"
                    />
                    <div className="absolute bottom-0 left-0 h-[2px] w-full bg-[#5A4BFF]" />
                  </div>

                  <div className="mb-6 rounded-[24px] border border-slate-100 bg-[#F8FAFC] p-5">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-slate-400" />
                        <span className="text-[11px] font-jakarta font-extrabold uppercase tracking-widest text-slate-500">
                          Kdy se to koná?
                        </span>
                      </div>

                      <label className="group flex w-max cursor-pointer items-center gap-3">
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                            isAllDay ? "border-[#0B1021] bg-[#0B1021]" : "border-slate-300 bg-white group-hover:border-slate-400"
                          }`}
                        >
                          <Check size={14} strokeWidth={3} className={isAllDay ? "scale-100 text-white" : "scale-0"} />
                        </div>
                        <span className="text-sm font-jakarta font-bold text-[#0B1021]">Celý den</span>
                        <input
                          type="checkbox"
                          checked={isAllDay}
                          onChange={() => setIsAllDay((prev) => !prev)}
                          className="hidden"
                        />
                      </label>

                      <div className="flex flex-col gap-1 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
                        <p className="text-base font-jakarta font-bold text-[#0B1021]">
                          pátek 24. dubna 2026 {isAllDay ? "· celý den" : `${selectedStart.toString().padStart(2, "0")}:00 - ${(selectedStart + 1)
                            .toString()
                            .padStart(2, "0")}:00`}
                        </p>
                        <button className="flex w-max items-center gap-1 text-xs font-jakarta font-bold text-[#5A4BFF] transition-colors hover:text-indigo-700">
                          <ChevronDown size={14} /> Změnit datum a čas
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6 grid grid-cols-2 gap-x-4 gap-y-4">
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-1.5 text-[10px] font-jakarta font-extrabold uppercase tracking-widest text-slate-500">
                        <User size={14} /> Klient
                      </label>
                      <div className="input-calendar rounded-xl">
                        <select
                          value={draft.client}
                          onChange={(event) => setDraft((prev) => ({ ...prev, client: event.target.value }))}
                          className="w-full appearance-none bg-transparent p-2.5 font-inter font-medium text-[#0B1021] outline-none"
                        >
                          {CLIENT_OPTIONS.map((client) => (
                            <option key={client}>{client}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-1.5 text-[10px] font-jakarta font-extrabold uppercase tracking-widest text-slate-500">
                        <Briefcase size={14} /> Obchod
                      </label>
                      <div className="input-calendar relative rounded-xl">
                        <select
                          value={draft.trade}
                          onChange={(event) => setDraft((prev) => ({ ...prev, trade: event.target.value }))}
                          className="w-full appearance-none bg-transparent p-2.5 font-inter font-bold text-slate-500 outline-none"
                        >
                          {TRADE_OPTIONS.map((trade) => (
                            <option key={trade}>{trade}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-1.5 text-[10px] font-jakarta font-extrabold uppercase tracking-widest text-slate-500">
                        <MapPin size={14} /> Místo
                      </label>
                      <div className="input-calendar rounded-xl">
                        <input
                          type="text"
                          value={draft.location}
                          onChange={(event) => setDraft((prev) => ({ ...prev, location: event.target.value }))}
                          className="w-full bg-transparent p-2.5 font-inter font-medium text-[#0B1021] outline-none placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-1.5 text-[10px] font-jakarta font-extrabold uppercase tracking-widest text-slate-500">
                        <Link2 size={14} /> Online odkaz
                      </label>
                      <div className="input-calendar rounded-xl">
                        <input
                          type="text"
                          value={draft.link}
                          onChange={(event) => setDraft((prev) => ({ ...prev, link: event.target.value }))}
                          className="w-full bg-transparent p-2.5 font-inter font-medium text-[#0B1021] outline-none placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-1.5 text-[10px] font-jakarta font-extrabold uppercase tracking-widest text-slate-500">
                      <AlignLeft size={14} /> Poznámka
                    </label>
                    <div className="input-calendar rounded-xl">
                      <textarea
                        value={draft.note}
                        onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))}
                        className="h-20 w-full resize-none bg-transparent p-2.5 font-inter font-medium text-[#0B1021] outline-none placeholder:text-slate-500"
                        placeholder="Poznámky k události..."
                      />
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-[#F1F5F9] px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-jakarta font-extrabold uppercase tracking-widest text-slate-500">Připomenutí</span>
                    <button className="flex items-center gap-1.5 rounded-xl bg-indigo-100/70 px-3 py-1.5 text-sm font-jakarta font-bold text-indigo-700 transition-colors hover:bg-indigo-200/70">
                      <Bell size={14} /> 30 min před <ChevronDown size={14} className="ml-1 opacity-70" />
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="text-[15px] font-jakarta font-bold text-slate-600 transition-colors hover:text-[#0B1021]"
                    >
                      Zrušit
                    </button>
                    <button
                      type="button"
                      onClick={saveEvent}
                      className="flex items-center gap-2 rounded-xl bg-[#475569] px-6 py-3 text-sm font-jakarta font-bold text-white shadow-md transition-colors hover:bg-[#334155]"
                    >
                      <Check size={18} strokeWidth={3} /> VYTVOŘIT
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </LandingMockCanvas>
    </LandingProductFrame>
  );
}

export default CalendarDemo;
