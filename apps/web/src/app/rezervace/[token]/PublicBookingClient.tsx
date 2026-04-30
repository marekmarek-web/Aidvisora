"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  Calendar,
  Phone,
  Video,
  Users,
  Home,
  Shield,
  TrendingUp,
  PieChart,
  UploadCloud,
  Check,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  MapPin,
  MessageSquare,
  ChevronRight,
  Loader2,
  FileText,
} from "lucide-react";

type Slot = { start: string; end: string };

type MetaResponseOk = {
  ok: true;
  timezone: string;
  advisorName: string;
  companyName: string;
  slotMinutes: number;
  slots: Slot[];
};

type MetaResponseErr = { ok: false; error?: string; message?: string };
type MetaResponse = MetaResponseOk | MetaResponseErr;

type ContactTypeId = "online" | "personal" | "phone";
type TopicId = "pojisteni" | "uvery" | "investice" | "plan" | "ostatni";

type ContactTypeDef = {
  id: ContactTypeId;
  label: string;
  icon: typeof Video;
  desc: string;
};

type TopicDef = {
  id: TopicId;
  label: string;
  icon: typeof Shield;
  color: string;
  bg: string;
  border: string;
  subtopics: string[];
};

const CONTACT_TYPES: ContactTypeDef[] = [
  { id: "online", label: "Online schůzka", icon: Video, desc: "Google Meet / Teams" },
  { id: "personal", label: "Osobní setkání", icon: Users, desc: "U poradce v kanceláři" },
  { id: "phone", label: "Telefonát", icon: Phone, desc: "Rychlá konzultace" },
];

const TOPICS: TopicDef[] = [
  {
    id: "pojisteni",
    label: "Pojištění",
    icon: Shield,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    subtopics: [
      "Životní a úrazové pojištění",
      "Pojištění majetku (dům/byt)",
      "Povinné ručení a havarijní",
      "Firemní pojištění",
      "Flotilové pojištění",
    ],
  },
  {
    id: "uvery",
    label: "Úvěry a Hypotéky",
    icon: Home,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    subtopics: [
      "Nová hypotéka na bydlení",
      "Refinancování hypotéky",
      "Spotřebitelský úvěr",
      "Konsolidace úvěrů",
      "Podnikatelský úvěr",
    ],
  },
  {
    id: "investice",
    label: "Penze a Investice",
    icon: TrendingUp,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    subtopics: [
      "Pravidelné investování",
      "Jednorázová investice",
      "Doplňkové penzijní spoření (DPS)",
      "Investice pro děti",
    ],
  },
  {
    id: "plan",
    label: "Finanční plán",
    icon: PieChart,
    color: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-200",
    subtopics: [
      "Tvorba komplexního finančního plánu",
      "Revize stávajícího portfolia a smluv",
      "Konzultace finančních cílů",
    ],
  },
  {
    id: "ostatni",
    label: "Ostatní požadavky",
    icon: MessageSquare,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    subtopics: [
      "Hlášení pojistné události",
      "Servis stávající smlouvy",
      "Administrativní změna",
      "Jiný dotaz",
    ],
  },
];

const CZ_DAY_SHORT = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];
const CZ_MONTH_LONG = [
  "Leden",
  "Únor",
  "Březen",
  "Duben",
  "Květen",
  "Červen",
  "Červenec",
  "Srpen",
  "Září",
  "Říjen",
  "Listopad",
  "Prosinec",
];

type PraguePartsCache = { ymd: string; time: string; dayName: string; dayNum: string; month: string };

function praguePartsFromIso(iso: string): PraguePartsCache {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(d);
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? "";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");
  const ymd = `${year}-${month}-${day}`;
  const time = `${hour}:${minute}`;

  const utcForDay = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0));
  const dayName = CZ_DAY_SHORT[utcForDay.getUTCDay()] ?? "";
  const dayNum = String(Number(day));
  const monthName = CZ_MONTH_LONG[Number(month) - 1] ?? "";

  return { ymd, time, dayName, dayNum, month: monthName };
}

type DayGroup = {
  ymd: string;
  dayName: string;
  dayNum: string;
  month: string;
  times: { time: string; slot: Slot }[];
};

function groupSlotsByDay(slots: Slot[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const s of slots) {
    const p = praguePartsFromIso(s.start);
    let g = map.get(p.ymd);
    if (!g) {
      g = { ymd: p.ymd, dayName: p.dayName, dayNum: p.dayNum, month: p.month, times: [] };
      map.set(p.ymd, g);
    }
    g.times.push({ time: p.time, slot: s });
  }
  const arr = Array.from(map.values());
  arr.sort((a, b) => a.ymd.localeCompare(b.ymd));
  for (const g of arr) g.times.sort((a, b) => a.time.localeCompare(b.time));
  return arr;
}

/** Klientský mobilní shell lockuje scroll na document — při odkazu ze zpráv musí rezervace scrollovat. */
const MOBILE_PORTAL_VIEWPORT_LOCK_CLASS = "aidv-mobile-portal-viewport-lock";

function formatDayHumanLong(ymd: string, time: string): string {
  const [y, m, d] = ymd.split("-");
  const utcForDay = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12, 0, 0));
  const dayName = CZ_DAY_SHORT[utcForDay.getUTCDay()] ?? "";
  const monthName = CZ_MONTH_LONG[Number(m) - 1] ?? "";
  return `${dayName} ${Number(d)}. ${monthName}, ${time}`;
}

export function PublicBookingClient({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [meta, setMeta] = useState<MetaResponseOk | null>(null);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [contactType, setContactType] = useState<ContactTypeId | null>(null);
  const [topicId, setTopicId] = useState<TopicId | null>(null);
  const [subtopic, setSubtopic] = useState<string | null>(null);
  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [gdpr, setGdpr] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/public/booking/${encodeURIComponent(token)}?days=21`, {
        cache: "no-store",
      });
      const data = (await res.json()) as MetaResponse;
      if (!res.ok || !data.ok) {
        const errBody = data as MetaResponseErr;
        setFetchError(
          typeof errBody.message === "string"
            ? errBody.message
            : "Tento odkaz není platný nebo rezervace není aktivní.",
        );
        setMeta(null);
        return;
      }
      setMeta(data);
    } catch {
      setFetchError("Nepodařilo se načíst dostupné termíny. Zkuste to prosím znovu.");
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useLayoutEffect(() => {
    document.documentElement.classList.remove(MOBILE_PORTAL_VIEWPORT_LOCK_CLASS);
  }, []);

  const dayGroups = useMemo<DayGroup[]>(
    () => (meta ? groupSlotsByDay(meta.slots) : []),
    [meta],
  );
  const selectedDay = useMemo<DayGroup | null>(
    () => (selectedYmd ? (dayGroups.find((d) => d.ymd === selectedYmd) ?? null) : null),
    [dayGroups, selectedYmd],
  );

  const selectedTopic = useMemo<TopicDef | null>(
    () => (topicId ? (TOPICS.find((t) => t.id === topicId) ?? null) : null),
    [topicId],
  );

  const selectedContact = useMemo<ContactTypeDef | null>(
    () => (contactType ? (CONTACT_TYPES.find((c) => c.id === contactType) ?? null) : null),
    [contactType],
  );

  const isStep1Valid = !!contactType && !!topicId && !!subtopic;
  const isStep2Valid = !!selectedYmd && !!selectedSlot;
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isStep3Valid =
    name.trim().length > 0 &&
    emailRe.test(email.trim()) &&
    phone.trim().length > 0 &&
    gdpr;

  const handleNext = () => {
    if (step === 1 && !isStep1Valid) return;
    if (step === 2 && !isStep2Valid) return;
    if (step < 3) setStep(((step + 1) as 2 | 3));
  };
  const handlePrev = () => {
    if (step === 1) return;
    setStep(((step - 1) as 1 | 2));
  };

  const handleTopicSelect = (id: TopicId) => {
    if (topicId !== id) {
      setTopicId(id);
      setSubtopic(null);
    }
  };

  const handleSubmit = async () => {
    if (!selectedSlot || !isStep3Valid) return;
    setSubmitting(true);
    setSubmitErr(null);
    try {
      const res = await fetch(`/api/public/booking/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: selectedSlot.start,
          end: selectedSlot.end,
          clientName: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          note: note.trim(),
          contactType,
          topic: topicId,
          subtopic,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setSubmitErr(
          typeof data.message === "string"
            ? data.message
            : "Odeslání se nezdařilo. Zkuste jiný termín.",
        );
        if (res.status === 409) void load();
        return;
      }
      setStep(4);
    } catch {
      setSubmitErr("Síťová chyba. Zkuste to znovu.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" aria-hidden />
        <p className="text-sm text-slate-600">Načítám volné termíny…</p>
      </div>
    );
  }

  if (fetchError || !meta) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center px-4 max-w-md mx-auto text-center">
        <p className="text-slate-800 font-semibold mb-2">Rezervace není k dispozici</p>
        <p className="text-sm text-slate-600">{fetchError}</p>
      </div>
    );
  }

  const advisorInitials = (meta.advisorName || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#f4f7f9] font-lato text-slate-800 selection:bg-indigo-500 selection:text-white lg:min-h-screen">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&family=Plus+Jakarta+Sans:wght@500;700;800;900&display=swap');
        .font-lato { font-family: 'Lato', sans-serif; }
        .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-check {
          appearance: none; width: 22px; height: 22px; border: 2px solid #cbd5e1;
          border-radius: 6px; background-color: white; cursor: pointer;
          position: relative; transition: all 0.2s ease; flex-shrink: 0;
        }
        .custom-check:checked { background-color: #4f46e5; border-color: #4f46e5; }
        .custom-check:checked::after {
          content: ''; position: absolute; left: 6px; top: 2px; width: 6px; height: 12px;
          border: solid white; border-width: 0 2.5px 2.5px 0; transform: rotate(45deg);
        }
      `}</style>

      <header className="shrink-0 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xs shrink-0">
            {advisorInitials || "A"}
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-display font-black text-slate-900 leading-tight truncate">
              {meta.advisorName}
            </h1>
            {meta.companyName ? (
              <p className="text-[10px] sm:text-[11px] font-bold text-indigo-600 uppercase tracking-widest truncate">
                {meta.companyName}
              </p>
            ) : null}
          </div>
        </div>
        <span className="ml-2 pl-3 border-l border-slate-200 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-400 hidden sm:block">
          Rezervační systém
        </span>
      </header>

      <main className="max-w-[1200px] mx-auto w-full flex-1 min-h-0 overflow-y-auto overscroll-y-contain p-4 sm:p-8 pb-28 lg:flex-none lg:overflow-visible lg:pb-8">
        {step < 4 ? (
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
            {/* Wizard column */}
            <div className="w-full lg:w-2/3">
              {/* Stepper */}
              <div className="mb-5 sm:mb-8 flex items-center gap-2 overflow-x-auto hide-scrollbar pb-2">
                {[
                  { id: 1 as const, label: "Téma" },
                  { id: 2 as const, label: "Termín" },
                  { id: 3 as const, label: "Údaje" },
                ].map((s) => (
                  <div key={s.id} className="flex items-center gap-2 shrink-0">
                    <div
                      className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-full text-xs font-bold transition-all ${
                        step === s.id
                          ? "bg-indigo-600 text-white shadow-md"
                          : step > s.id
                            ? "bg-indigo-50 text-indigo-700"
                            : "bg-white text-slate-400 border border-slate-200"
                      }`}
                    >
                      {step > s.id ? <Check size={14} strokeWidth={3} /> : s.id}
                      <span className={step === s.id ? "inline-block" : "hidden sm:inline-block"}>
                        {s.label}
                      </span>
                    </div>
                    {s.id < 3 && (
                      <div
                        className={`w-4 sm:w-12 h-0.5 rounded-full ${
                          step > s.id ? "bg-indigo-600" : "bg-slate-200"
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Step card */}
              <div className="bg-white rounded-[24px] sm:rounded-[32px] border border-slate-100 shadow-sm p-5 sm:p-10 relative sm:min-h-[500px]">
                {step === 1 && (
                  <div>
                    <h2 className="text-xl sm:text-2xl font-display font-black text-slate-900 mb-2">
                      Jak se spojíme?
                    </h2>
                    <p className="text-sm font-medium text-slate-500 mb-6">
                      Vyberte preferovaný způsob naší schůzky.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-10">
                      {CONTACT_TYPES.map((type) => {
                        const Icon = type.icon;
                        const isActive = contactType === type.id;
                        return (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() => setContactType(type.id)}
                            className={`p-4 sm:p-5 rounded-2xl border-2 text-left transition-all ${
                              isActive
                                ? "border-indigo-500 bg-indigo-50/50 shadow-md ring-2 ring-indigo-500/20"
                                : "border-slate-100 hover:border-indigo-200 hover:bg-slate-50"
                            }`}
                          >
                            <Icon
                              size={24}
                              className={`mb-3 ${isActive ? "text-indigo-600" : "text-slate-400"}`}
                            />
                            <h3
                              className={`font-bold text-sm mb-1 ${
                                isActive ? "text-slate-900" : "text-slate-700"
                              }`}
                            >
                              {type.label}
                            </h3>
                            <p className="text-[11px] font-medium text-slate-500">{type.desc}</p>
                          </button>
                        );
                      })}
                    </div>

                    <h2 className="text-xl sm:text-2xl font-display font-black text-slate-900 mb-2">
                      Co budeme řešit?
                    </h2>
                    <p className="text-sm font-medium text-slate-500 mb-6">
                      Informativní pomoc poradci s přípravou na schůzku.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
                      {TOPICS.map((topic) => {
                        const Icon = topic.icon;
                        const isActive = topicId === topic.id;
                        return (
                          <button
                            key={topic.id}
                            type="button"
                            onClick={() => handleTopicSelect(topic.id)}
                            className={`p-4 rounded-2xl border-2 flex items-center gap-3 sm:gap-4 transition-all text-left ${
                              isActive
                                ? "border-indigo-500 bg-indigo-50/50 shadow-md"
                                : "border-slate-100 hover:border-indigo-200 hover:bg-slate-50"
                            }`}
                          >
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-sm transition-colors ${
                                isActive
                                  ? "bg-white border-indigo-200 text-indigo-600"
                                  : `${topic.bg} ${topic.color} ${topic.border}`
                              }`}
                            >
                              <Icon size={20} />
                            </div>
                            <span
                              className={`font-bold text-sm ${
                                isActive ? "text-slate-900" : "text-slate-700"
                              }`}
                            >
                              {topic.label}
                            </span>
                            {isActive && (
                              <CheckCircle2
                                size={18}
                                className="ml-auto text-indigo-600 shrink-0"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {selectedTopic && (
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 sm:p-6">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                          <ChevronRight size={14} className="text-indigo-500" />
                          Upřesněte váš požadavek
                        </h3>
                        <div className="flex flex-wrap gap-2 sm:gap-3">
                          {selectedTopic.subtopics.map((sub) => {
                            const isSubActive = subtopic === sub;
                            return (
                              <button
                                key={sub}
                                type="button"
                                onClick={() => setSubtopic(sub)}
                                className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-all text-left ${
                                  isSubActive
                                    ? "bg-indigo-600 border-indigo-600 text-white shadow-md"
                                    : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                                }`}
                              >
                                {sub}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {step === 2 && (
                  <div className="h-full flex flex-col">
                    <h2 className="text-xl sm:text-2xl font-display font-black text-slate-900 mb-2">
                      Kdy se vám to hodí?
                    </h2>
                    <p className="text-sm font-medium text-slate-500 mb-8">
                      Zvolte datum a následně dostupný čas. Časy v {meta.timezone} · {meta.slotMinutes} min.
                    </p>

                    {dayGroups.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 mt-6">
                        <Calendar size={48} className="mb-4 opacity-20" />
                        <p className="font-medium text-sm text-center max-w-xs">
                          V nejbližším období nejsou k dispozici volné termíny. Zkuste to prosím
                          později.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto hide-scrollbar pb-4 mb-6 border-b border-slate-100 -mx-5 px-5 sm:mx-0 sm:px-0">
                          {dayGroups.map((d) => {
                            const isActive = selectedYmd === d.ymd;
                            return (
                              <button
                                key={d.ymd}
                                type="button"
                                onClick={() => {
                                  setSelectedYmd(d.ymd);
                                  setSelectedSlot(null);
                                }}
                                className={`flex flex-col items-center min-w-[70px] sm:min-w-[80px] p-3 sm:p-4 rounded-2xl border-2 transition-all shrink-0 ${
                                  isActive
                                    ? "border-indigo-500 bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 scale-105"
                                    : "border-slate-100 bg-white hover:border-indigo-300 text-slate-600"
                                }`}
                              >
                                <span
                                  className={`text-[10px] font-black uppercase tracking-widest mb-1 ${
                                    isActive ? "text-indigo-200" : "text-slate-400"
                                  }`}
                                >
                                  {d.dayName}
                                </span>
                                <span className="text-xl sm:text-2xl font-display font-black leading-none mb-1">
                                  {d.dayNum}
                                </span>
                                <span
                                  className={`text-[10px] font-bold ${
                                    isActive ? "text-indigo-100" : "text-slate-500"
                                  }`}
                                >
                                  {d.month}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {selectedDay ? (
                          <div>
                            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4">
                              Dostupné časy pro vybraný den
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {selectedDay.times.map((t) => {
                                const isActive =
                                  selectedSlot?.start === t.slot.start &&
                                  selectedSlot?.end === t.slot.end;
                                return (
                                  <button
                                    key={t.slot.start}
                                    type="button"
                                    onClick={() => setSelectedSlot(t.slot)}
                                    className={`py-3 rounded-xl border text-sm font-bold transition-all ${
                                      isActive
                                        ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm ring-2 ring-indigo-100"
                                        : "bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-slate-50"
                                    }`}
                                  >
                                    {t.time}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 mt-10">
                            <Calendar size={48} className="mb-4 opacity-20" />
                            <p className="font-medium text-sm text-center">
                              Nejprve vyberte datum v horní liště.
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {step === 3 && (
                  <div>
                    <h2 className="text-xl sm:text-2xl font-display font-black text-slate-900 mb-2">
                      Poslední krok
                    </h2>
                    <p className="text-sm font-medium text-slate-500 mb-8">
                      Zanechte na sebe kontakt, poradce se vám ozve pro potvrzení.
                    </p>

                    <div className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                            Jméno a příjmení *
                          </label>
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Např. Jan Novák"
                            autoComplete="name"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                            Telefon *
                          </label>
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+420 777 123 456"
                            autoComplete="tel"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all text-slate-800"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                          E-mail *
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="jan@email.cz"
                          autoComplete="email"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                          Poznámka pro poradce (Volitelné)
                        </label>
                        <textarea
                          rows={2}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Můžete upřesnit detaily vašeho požadavku…"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all text-slate-800 resize-none"
                        />
                      </div>

                      <div className="bg-blue-50/50 border border-blue-100 rounded-[20px] p-5">
                        <div className="block text-[10px] font-black uppercase tracking-widest text-blue-800 mb-3 flex items-center gap-2">
                          <Shield size={14} className="text-blue-500" />
                          Bezpečné podklady
                        </div>
                        <div className="border-2 border-dashed border-blue-200 rounded-[16px] p-6 flex flex-col items-center justify-center text-slate-500 bg-white/50">
                          <UploadCloud size={28} className="mb-3 text-blue-400" />
                          <p className="text-sm font-bold text-slate-700 mb-1 text-center">
                            Nahrávání podkladů bude dostupné po potvrzení rezervace.
                          </p>
                          <p className="text-[11px] font-medium text-center px-4">
                            Po potvrzení dostanete e-mailem přístup do Klientské zóny, kde můžete
                            bezpečně sdílet dokumenty s poradcem.
                          </p>
                        </div>
                      </div>

                      <div className="pt-2">
                        <label className="flex items-start gap-3 sm:gap-4 cursor-pointer group bg-slate-50 border border-slate-100 p-4 rounded-xl hover:border-indigo-200 transition-colors">
                          <input
                            type="checkbox"
                            checked={gdpr}
                            onChange={() => setGdpr((v) => !v)}
                            className="custom-check mt-0.5"
                          />
                          <span className="text-xs text-slate-600 font-medium leading-relaxed group-hover:text-slate-800 transition-colors">
                            <strong>Souhlasím se zpracováním osobních údajů.</strong> Beru na
                            vědomí, že zadané informace slouží výhradně k administrativní domluvě
                            termínu a interní přípravě poradce na schůzku. Nejde o investiční
                            doporučení.
                          </span>
                        </label>
                      </div>

                      {submitErr && (
                        <p className="text-sm text-rose-600 font-semibold">{submitErr}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Wizard navigation (desktop + tablet inside card, mobile uses sticky bottom) */}
                <div className="mt-8 sm:mt-10 pt-6 border-t border-slate-100 hidden sm:flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={handlePrev}
                    disabled={step === 1}
                    className={`w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 ${
                      step === 1
                        ? "opacity-0 pointer-events-none hidden sm:flex"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <ArrowLeft size={16} /> Zpět
                  </button>

                  {step < 3 ? (
                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={(step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid)}
                      className="w-full sm:w-auto px-8 py-3.5 sm:py-3 bg-indigo-600 text-white rounded-xl font-black text-sm tracking-wide shadow-md shadow-indigo-600/20 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95"
                    >
                      Pokračovat na krok {step + 1} <ArrowRight size={16} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!isStep3Valid || submitting}
                      className="w-full sm:w-auto px-8 py-3.5 sm:py-3 bg-[#1a1c2e] text-white rounded-xl font-black text-sm tracking-wide shadow-lg shadow-slate-900/20 hover:bg-[#2a2d4a] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95"
                    >
                      {submitting ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Check size={18} strokeWidth={2.5} />
                      )}
                      {submitting ? "Odesílám…" : "Potvrdit rezervaci"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Summary (desktop only) */}
            <div className="hidden lg:block w-1/3">
              <SummaryPanel
                advisorName={meta.advisorName}
                companyName={meta.companyName}
                contact={selectedContact}
                topic={selectedTopic}
                subtopic={subtopic}
                selectedSlotLabel={
                  selectedYmd && selectedSlot
                    ? formatDayHumanLong(
                        selectedYmd,
                        praguePartsFromIso(selectedSlot.start).time,
                      )
                    : null
                }
              />
            </div>
          </div>
        ) : (
          <SuccessCard
            advisorName={meta.advisorName}
            topicLabel={selectedTopic?.label ?? null}
            subtopic={subtopic}
            slotLabel={
              selectedYmd && selectedSlot
                ? formatDayHumanLong(selectedYmd, praguePartsFromIso(selectedSlot.start).time)
                : null
            }
          />
        )}
      </main>

      {/* Mobile sticky action bar */}
      {step < 4 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] z-40 sm:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrev}
              disabled={step === 1}
              className={`px-4 py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center border shrink-0 ${
                step === 1
                  ? "opacity-40 border-slate-200 text-slate-400 bg-slate-50"
                  : "text-slate-700 bg-white border-slate-200 shadow-sm"
              }`}
              aria-label="Zpět"
            >
              <ArrowLeft size={18} />
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={(step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid)}
                className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl font-black text-sm tracking-wide shadow-md shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                Další krok <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!isStep3Valid || submitting}
                className="flex-1 py-3.5 bg-[#1a1c2e] text-white rounded-xl font-black text-sm tracking-wide shadow-lg shadow-slate-900/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check size={18} strokeWidth={2.5} />
                )}
                {submitting ? "Odesílám…" : "Potvrdit"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryPanel({
  advisorName,
  companyName,
  contact,
  topic,
  subtopic,
  selectedSlotLabel,
}: {
  advisorName: string;
  companyName: string;
  contact: ContactTypeDef | null;
  topic: TopicDef | null;
  subtopic: string | null;
  selectedSlotLabel: string | null;
}) {
  const initials = (advisorName || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");

  return (
    <div className="bg-white rounded-[32px] p-7 border border-slate-100 shadow-xl shadow-slate-200/50 sticky top-[104px]">
      <div className="mb-6 pb-6 border-b border-slate-100 flex flex-col items-center text-center">
        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-display font-black text-lg mb-3">
          {initials || "A"}
        </div>
        <h3 className="font-display font-black text-xl text-slate-900 leading-tight">
          {advisorName}
        </h3>
        {companyName ? (
          <p className="text-xs font-bold text-indigo-600 mt-1 uppercase tracking-widest">
            {companyName}
          </p>
        ) : null}
      </div>

      <div className="space-y-6">
        <div>
          <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
            Předmět schůzky
          </span>
          {topic && subtopic ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                {contact ? (
                  <>
                    <span className="text-indigo-600">{contact.label}</span>
                    <span className="text-slate-300">•</span>
                  </>
                ) : null}
                <span>{topic.label}</span>
              </div>
              <span className="text-xs font-medium text-slate-500 border-l-2 border-indigo-200 pl-2 ml-1 mt-1">
                {subtopic}
              </span>
            </div>
          ) : (
            <span className="text-sm font-medium text-slate-400 italic">
              Zatím nevybráno kompletně
            </span>
          )}
        </div>

        <div>
          <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
            Termín
          </span>
          {selectedSlotLabel ? (
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <Calendar size={16} className="text-indigo-500" />
              {selectedSlotLabel}
            </div>
          ) : (
            <span className="text-sm font-medium text-slate-400 italic">Zatím nevybráno</span>
          )}
        </div>

        {contact ? (
          <div>
            <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Místo konání
            </span>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              {contact.id === "personal" && (
                <>
                  <MapPin size={16} className="text-slate-400" /> Kancelář poradce
                </>
              )}
              {contact.id === "online" && (
                <>
                  <Video size={16} className="text-slate-400" /> Odkaz obdržíte v e-mailu
                </>
              )}
              {contact.id === "phone" && (
                <>
                  <Phone size={16} className="text-slate-400" /> Poradce vám zavolá
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SuccessCard({
  advisorName,
  topicLabel,
  subtopic,
  slotLabel,
}: {
  advisorName: string;
  topicLabel: string | null;
  subtopic: string | null;
  slotLabel: string | null;
}) {
  return (
    <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/50 max-w-2xl mx-auto overflow-hidden">
      <div className="h-32 bg-emerald-500 relative flex items-end justify-center pb-6">
        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-xl absolute -bottom-10">
          <CheckCircle2 size={48} className="text-emerald-500" />
        </div>
      </div>

      <div className="pt-16 p-6 sm:p-10 text-center">
        <h1 className="text-2xl sm:text-3xl font-display font-black text-slate-900 mb-2">
          Rezervace potvrzena!
        </h1>
        <p className="text-slate-500 font-medium mb-10 text-sm sm:text-base">
          Těšíme se na naše setkání. Potvrzení jsme vám právě odeslali na e-mail. Schůzka je
          zapsaná v kalendáři poradce.
        </p>

        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 sm:p-6 text-left max-w-md mx-auto mb-6">
          {slotLabel && (
            <div className="flex justify-between items-center pb-3 border-b border-slate-200/60 mb-3 gap-3">
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest">
                Termín
              </span>
              <span className="text-sm sm:text-base font-bold text-slate-900 text-right">
                {slotLabel}
              </span>
            </div>
          )}
          {(topicLabel || subtopic) && (
            <div className="flex justify-between items-center pb-3 border-b border-slate-200/60 mb-3 gap-3">
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest">
                Téma
              </span>
              <span className="text-sm sm:text-base font-bold text-slate-900 text-right">
                {topicLabel}
                {subtopic ? (
                  <span className="block text-xs font-medium text-slate-500 mt-0.5">
                    {subtopic}
                  </span>
                ) : null}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center gap-3">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest">
              Poradce
            </span>
            <span className="text-sm sm:text-base font-bold text-slate-900 text-right">
              {advisorName}
            </span>
          </div>
        </div>

        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 sm:p-6 text-center max-w-md mx-auto">
          <FileText size={24} className="text-indigo-500 mx-auto mb-3" />
          <h4 className="font-bold text-indigo-900 mb-2 text-sm sm:text-base">
            Co bude následovat?
          </h4>
          <p className="text-xs text-indigo-700/80 font-medium leading-relaxed">
            Poradce obdrží e-mail s detaily vaší rezervace a schůzka je zapsaná v jeho
            kalendáři. Na uvedený e-mail dostanete potvrzení s dalšími pokyny.
          </p>
        </div>
      </div>
    </div>
  );
}
