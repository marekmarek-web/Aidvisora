"use client";

import React from "react";
import {
  ArrowRight,
  Bell,
  Briefcase,
  CheckCircle2,
  CheckSquare,
  Clock,
  FileText,
  Filter,
  Home,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Reply,
  Search,
  Shield,
  Sparkles,
  X,
} from "lucide-react";

import { LandingMockCanvas } from "./LandingMockCanvas";
import { LandingProductFrame } from "./LandingProductFrame";
import { prefersReducedMotion, useInViewTrigger } from "./landing-in-view";

type CategoryId = "pojisteni" | "bydleni" | "servis";

type RequestItem = {
  id: number;
  client: string;
  category: CategoryId;
  categoryLabel: string;
  subject: string;
  message: string;
  date: string;
  unread: boolean;
  aiSummary: string;
  toastText: string;
};

type ToastItem = {
  /** Unikátní klíč instance (opakované spuštění animace může mít stejné requestId). */
  instanceKey: string;
  requestId: number;
  title: string;
  subtitle: string;
  text: string;
  color: "emerald" | "blue" | "amber";
  isExiting?: boolean;
};

const CATEGORIES = {
  pojisteni: { icon: Shield, color: "text-emerald-500", bg: "bg-emerald-50" },
  bydleni: { icon: Home, color: "text-blue-500", bg: "bg-blue-50" },
  servis: { icon: FileText, color: "text-amber-500", bg: "bg-amber-50" },
} as const;

const REQUESTS: readonly RequestItem[] = [
  {
    id: 1,
    client: "Marek Marek",
    category: "pojisteni",
    categoryLabel: "Pojištění",
    subject: "Životní pojištění pro dceru",
    message:
      "Dobrý den, narodila se nám dcera a rád bych pro ni založil nějaké životní pojištění, nebo úrazovku. Můžeme se na to podívat a poslat varianty?",
    date: "Dnes, 10:45",
    unread: true,
    aiSummary:
      "Klient poptává nové životní/úrazové pojištění pro novorozenou dceru. Doporučuji připravit modelace dětského pojištění a naplánovat online schůzku pro prezentaci.",
    toastText: "Nový dotaz k pojištění dítěte. Klient chce návrh variant a následnou konzultaci.",
  },
  {
    id: 2,
    client: "Tomáš Zíta",
    category: "bydleni",
    categoryLabel: "Bydlení a úvěry",
    subject: "Koupě bytu - hypotéka",
    message:
      "Zdravím, našel jsem byt za 7 milionů a potřeboval bych to začít řešit. Mám asi 1,5 mil. vlastních zdrojů. Jaké jsou teď sazby a co budete potřebovat za podklady?",
    date: "Včera, 15:20",
    unread: true,
    aiSummary:
      "Vysoce prioritní lead. Klient chce řešit hypotéku ve výši cca 5,5 mil. Kč. Ideální je rychlý telefonát, ověření příjmů a domluvení úvodní schůzky.",
    toastText: "Nový hypoteční lead z portálu. Klient má vlastní zdroje a chce řešit financování bytu.",
  },
  {
    id: 3,
    client: "Lucie Bílá",
    category: "servis",
    categoryLabel: "Servis smlouvy",
    subject: "Změna adresy na smlouvách",
    message:
      "Dobrý den, přestěhovali jsme se na novou adresu. Můžete to prosím propsat do všech mých smluv? Kdybyste potřebovali potvrzení nebo doplňující údaje, pošlu je obratem.",
    date: "Pondělí, 09:15",
    unread: false,
    aiSummary:
      "Administrativní požadavek. Klientka žádá o změnu korespondenční adresy. Bude nutné aktualizovat údaje v CRM a následně připravit změnové žádosti pro instituce.",
    toastText: "Nový servisní požadavek. Klientka potřebuje propsat změnu adresy do smluv.",
  },
];

export function ClientRequestDemo() {
  const { ref, inView } = useInViewTrigger<HTMLDivElement>();
  const [inbox, setInbox] = React.useState<RequestItem[]>(() => [REQUESTS[0]]);
  const [activeRequestId, setActiveRequestId] = React.useState<number>(REQUESTS[0].id);
  const [filter, setFilter] = React.useState<"all" | "unread">("all");
  const [replyText, setReplyText] = React.useState("");
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const startedRef = React.useRef(false);
  const toastInstanceRef = React.useRef(0);

  const revealRequest = React.useCallback((request: RequestItem) => {
    setInbox((prev) => (prev.some((item) => item.id === request.id) ? prev : [...prev, request]));

    const instanceKey = `t-${++toastInstanceRef.current}-${request.id}`;
    const toast: ToastItem = {
      instanceKey,
      requestId: request.id,
      title: request.client,
      subtitle: request.subject,
      text: request.toastText,
      color: request.category === "bydleni" ? "blue" : request.category === "servis" ? "amber" : "emerald",
    };

    setToasts((prev) => [...prev, toast]);

    window.setTimeout(() => {
      setToasts((prev) =>
        prev.map((item) => (item.instanceKey === instanceKey ? { ...item, isExiting: true } : item)),
      );
    }, 5200);

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.instanceKey !== instanceKey));
    }, 5600);
  }, []);

  React.useEffect(() => {
    if (!inView || startedRef.current) return;
    startedRef.current = true;

    if (prefersReducedMotion()) {
      setInbox([REQUESTS[0], REQUESTS[1], REQUESTS[2]]);
      return;
    }

    const scheduleToasts = () => [
      window.setTimeout(() => revealRequest(REQUESTS[1]), 700),
      window.setTimeout(() => revealRequest(REQUESTS[2]), 3900),
    ];

    const timers = scheduleToasts();
    const replayTimer = window.setInterval(() => {
      scheduleToasts();
    }, 10000);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearInterval(replayTimer);
    };
  }, [inView, revealRequest]);

  const activeRequest = inbox.find((item) => item.id === activeRequestId) ?? inbox[0];
  const filteredRequests = inbox.filter((item) => filter === "all" || item.unread);
  const unreadCount = inbox.filter((item) => item.unread).length;

  return (
    <div ref={ref}>
      <LandingProductFrame label="Klientské požadavky · inbox" status={`${inbox.length} zprávy`} statusTone="indigo">
        <LandingMockCanvas className="bg-[#f4f6fb]">
          <div className="relative h-full overflow-hidden bg-[#f4f6fb] text-slate-800">
            <style>{`
              @keyframes aidv-toast-in {
                0% { transform: translateX(120%) scale(0.92); opacity: 0; }
                60% { transform: translateX(-5%) scale(1.02); opacity: 1; }
                80% { transform: translateX(2%) scale(0.99); opacity: 1; }
                100% { transform: translateX(0) scale(1); opacity: 1; }
              }
              @keyframes aidv-toast-out {
                0% { transform: translateX(0) scale(1); opacity: 1; }
                100% { transform: translateX(120%) scale(0.92); opacity: 0; }
              }
              @keyframes aidv-progress {
                0% { width: 100%; }
                100% { width: 0%; }
              }
            `}</style>

            <div
              className="absolute inset-0"
              style={{
                backgroundImage: "radial-gradient(#CBD5E1 1px, transparent 1px)",
                backgroundSize: "32px 32px",
                backgroundPosition: "-16px -16px",
              }}
              aria-hidden
            />

            <div className="relative z-10 flex h-full flex-col p-6">
              <header className="mb-6 flex items-end justify-between gap-5">
                <div>
                  <div className="mb-2 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5A4BFF] to-purple-500 text-white shadow-lg shadow-indigo-200">
                      <Bell size={22} />
                    </div>
                    <h3 className="font-jakarta text-3xl font-extrabold tracking-tight text-[#0B1021]">Klientské požadavky</h3>
                  </div>
                  <p className="text-sm font-medium text-slate-500">Zpracujte zprávy a notifikace přímo z klientského portálu.</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      readOnly
                      placeholder="Hledat klienta..."
                      className="w-64 rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-medium outline-none shadow-sm"
                    />
                  </div>
                  <button className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500 shadow-sm transition-colors hover:bg-indigo-50 hover:text-indigo-600">
                    <Filter size={20} />
                  </button>
                </div>
              </header>

              <div className="flex min-h-0 flex-1 gap-6">
                <div className="flex w-[420px] shrink-0 flex-col">
                  <div className="mb-6 flex rounded-2xl bg-slate-200/50 p-1.5">
                    <button
                      type="button"
                      onClick={() => setFilter("all")}
                      className={`flex-1 rounded-xl py-2.5 text-sm font-jakarta font-bold transition-all ${
                        filter === "all" ? "bg-white text-[#0B1021] shadow-sm" : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Všechny ({inbox.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilter("unread")}
                      className={`flex-1 rounded-xl py-2.5 text-sm font-jakarta font-bold transition-all ${
                        filter === "unread" ? "bg-white text-[#0B1021] shadow-sm" : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Nepřečtené ({unreadCount})
                    </button>
                  </div>

                  <div className="space-y-3">
                    {filteredRequests.map((request) => {
                      const CatIcon = CATEGORIES[request.category].icon;
                      const catTheme = CATEGORIES[request.category];
                      const isActive = activeRequest?.id === request.id;

                      return (
                        <button
                          key={request.id}
                          type="button"
                          onClick={() => setActiveRequestId(request.id)}
                          className={`relative w-full overflow-hidden rounded-3xl border p-5 text-left transition-all duration-300 ${
                            isActive ? "border-[#0B1021] bg-[#0B1021] shadow-xl shadow-slate-900/10" : "border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md"
                          }`}
                        >
                          {request.unread && !isActive ? (
                            <div className="absolute right-5 top-6 h-2.5 w-2.5 rounded-full bg-[#5A4BFF] shadow-[0_0_8px_rgba(90,75,255,0.6)]" />
                          ) : null}

                          <div className="flex items-start gap-4">
                            <div
                              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                                isActive ? "bg-white/10 text-white" : `${catTheme.bg} ${catTheme.color}`
                              }`}
                            >
                              <CatIcon size={20} strokeWidth={2.5} />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex items-center gap-2">
                                <h4 className={`truncate font-jakarta text-sm font-bold ${isActive ? "text-white" : "text-[#0B1021]"}`}>
                                  {request.client}
                                </h4>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                  {request.date.split(",")[0]}
                                </span>
                              </div>
                              <p className={`mb-1.5 truncate font-jakarta text-xs font-bold ${isActive ? "text-indigo-300" : "text-slate-600"}`}>
                                {request.subject}
                              </p>
                              <p className={`line-clamp-2 text-xs leading-relaxed ${isActive ? "text-slate-400" : "text-slate-500"}`}>
                                {request.message}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)]">
                  {activeRequest ? (
                    <>
                      <div className="flex items-center justify-between border-b border-slate-100 bg-white px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-lg font-jakarta font-bold text-slate-600 shadow-sm">
                              {activeRequest.client
                                .split(" ")
                                .map((part) => part[0])
                                .join("")}
                            </div>
                            <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-white">
                              <CheckCircle2 size={11} />
                            </div>
                          </div>

                          <div>
                            <h4 className="mb-1 font-jakarta text-2xl font-extrabold text-[#0B1021]">{activeRequest.client}</h4>
                            <div className="flex items-center gap-3">
                              <span className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${CATEGORIES[activeRequest.category].bg} ${CATEGORIES[activeRequest.category].color}`}>
                                {activeRequest.categoryLabel}
                              </span>
                              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                                <Clock size={12} /> {activeRequest.date}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition-colors hover:bg-slate-100">
                            <ArrowRight size={20} className="-rotate-45" />
                          </button>
                          <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition-colors hover:bg-slate-100">
                            <MoreHorizontal size={20} />
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto bg-slate-50/30 px-8 py-6">
                        <div className="relative mb-8 rounded-[24px] bg-gradient-to-br from-[#5A4BFF] via-purple-500 to-amber-500 p-[2px] shadow-lg shadow-indigo-200/50">
                          <div className="relative h-full overflow-hidden rounded-[22px] bg-white p-6">
                            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-[#5A4BFF]/5 blur-3xl" />
                            <h5 className="mb-3 flex items-center gap-2 font-jakarta text-sm font-bold text-[#5A4BFF]">
                              <Sparkles size={16} /> AI Asistent navrhuje
                            </h5>
                            <p className="text-[15px] font-medium leading-relaxed text-slate-700">{activeRequest.aiSummary}</p>

                            <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-5">
                              <button className="flex items-center gap-2 rounded-xl bg-[#5A4BFF] px-4 py-2 text-xs font-jakarta font-bold text-white transition-colors hover:bg-[#4A3DE0]">
                                <CheckSquare size={14} /> Převést na úkol
                              </button>
                              <button className="flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2 text-xs font-jakarta font-bold text-indigo-700 transition-colors hover:bg-indigo-100">
                                <Briefcase size={14} /> Založit obchod
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                          <div className="mb-5 flex items-center justify-between">
                            <h5 className="font-jakarta text-lg font-extrabold text-[#0B1021]">{activeRequest.subject}</h5>
                            <span className="rounded-lg bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                              Z portálu
                            </span>
                          </div>

                          <p className="text-[15px] leading-relaxed text-slate-700">{activeRequest.message}</p>

                          <div className="mt-8 border-t border-slate-100 pt-6">
                            <h6 className="mb-3 font-jakarta text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Přílohy</h6>
                            <p className="text-sm font-medium text-slate-500">Klient nepřiložil žádné soubory.</p>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 bg-white p-5">
                        <div className="rounded-[20px] border border-slate-200 bg-[#F8FAFC] p-2 transition-all focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-50">
                          <textarea
                            value={replyText}
                            onChange={(event) => setReplyText(event.target.value)}
                            placeholder={`Odpovědět klientovi ${activeRequest.client.split(" ")[0]} přímo do klientské zóny...`}
                            className="h-20 w-full resize-none bg-transparent p-3 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                          />
                          <div className="flex items-center justify-between px-3 pb-2 pt-1">
                            <div className="flex items-center gap-2 text-slate-400">
                              <button className="rounded-lg p-1.5 transition-colors hover:bg-indigo-50 hover:text-[#5A4BFF]">
                                <FileText size={18} />
                              </button>
                              <button className="rounded-lg p-1.5 transition-colors hover:bg-indigo-50 hover:text-[#5A4BFF]">
                                <Mail size={18} />
                              </button>
                            </div>
                            <button className="flex items-center gap-2 rounded-xl bg-[#0B1021] px-6 py-2.5 text-sm font-jakarta font-bold text-white shadow-md transition-colors hover:bg-black">
                              <Reply size={16} /> Odeslat do portálu
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center text-slate-400">
                      <MessageCircle size={48} className="mb-4 text-slate-200" strokeWidth={1} />
                      <p className="text-lg font-medium">Vyberte požadavek ze seznamu vlevo</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pointer-events-none absolute bottom-4 right-4 z-20 flex w-full max-w-[400px] flex-col gap-4">
              {toasts.map((toast) => {
                const isBlue = toast.color === "blue";
                const isAmber = toast.color === "amber";
                return (
                  <div
                    key={toast.instanceKey}
                    className="pointer-events-auto relative w-full overflow-hidden rounded-[24px] border border-white bg-white/95 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.15)] ring-1 ring-slate-900/5 backdrop-blur-2xl"
                    style={{
                      animation: `${toast.isExiting ? "aidv-toast-out" : "aidv-toast-in"} ${toast.isExiting ? "0.4s" : "0.6s"} cubic-bezier(0.16, 1, 0.3, 1) forwards`,
                    }}
                  >
                    <div
                      className={`absolute left-0 right-0 top-0 h-1.5 ${
                        isBlue
                          ? "bg-gradient-to-r from-blue-400 to-blue-600"
                          : isAmber
                            ? "bg-gradient-to-r from-amber-400 to-amber-600"
                            : "bg-gradient-to-r from-emerald-400 to-emerald-600"
                      }`}
                    />

                    <div className="flex items-start gap-4 p-5">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border shadow-sm ${
                          isBlue
                            ? "border-blue-100/50 bg-blue-50 text-blue-600"
                            : isAmber
                              ? "border-amber-100/50 bg-amber-50 text-amber-600"
                              : "border-emerald-100/50 bg-emerald-50 text-emerald-600"
                        }`}
                      >
                        <Bell size={20} strokeWidth={2.5} />
                      </div>

                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <p className="truncate font-jakarta text-[15px] font-extrabold text-[#0B1021]">{toast.title}</p>
                          <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            <Clock size={10} /> právě teď
                          </span>
                        </div>

                        <p className={`mb-1.5 text-xs font-jakarta font-bold ${isBlue ? "text-blue-600" : isAmber ? "text-amber-600" : "text-emerald-600"}`}>
                          {toast.subtitle}
                        </p>
                        <p className="line-clamp-2 text-[13px] font-medium leading-relaxed text-slate-500">{toast.text}</p>

                        <div className="mt-4 flex items-center gap-2">
                          <button className="flex items-center gap-1.5 rounded-[10px] bg-[#0B1021] px-4 py-2.5 text-xs font-jakarta font-bold text-white transition-all hover:bg-black">
                            Zobrazit <ArrowRight size={14} />
                          </button>
                          <button className="flex items-center gap-1.5 rounded-[10px] bg-indigo-50 px-4 py-2.5 text-xs font-jakarta font-bold text-indigo-700 transition-colors hover:bg-indigo-100">
                            <Sparkles size={14} /> AI Odpověď
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setToasts((prev) =>
                            prev.map((item) => (item.instanceKey === toast.instanceKey ? { ...item, isExiting: true } : item)),
                          )
                        }
                        className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="absolute bottom-0 left-0 h-1 w-full bg-slate-100">
                      <div
                        className={`${isBlue ? "bg-blue-500/20" : isAmber ? "bg-amber-500/20" : "bg-emerald-500/20"} h-full`}
                        style={{ animation: "aidv-progress 5.2s linear forwards" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </LandingMockCanvas>
      </LandingProductFrame>
    </div>
  );
}

export default ClientRequestDemo;
