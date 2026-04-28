"use client";

import Image from "next/image";
import React from "react";
import {
  Archive,
  ArrowRight,
  Bell,
  Briefcase,
  ChevronDown,
  ChevronLeft,
  CreditCard,
  Clock,
  FileUp,
  LayoutGrid,
  LogOut,
  MessageSquare,
  Plus,
  QrCode,
  Shield,
  TrendingUp,
  X,
  Car,
} from "lucide-react";

import { resolveInstitutionLogo } from "@/lib/institutions/institution-logo";

import { INSTITUTION_BRANDS } from "./demo-data";
import { LandingMockCanvas } from "./LandingMockCanvas";
import { LandingProductFrame } from "./LandingProductFrame";

type PortalTab = "Můj přehled" | "Moje portfolio" | "Platby a příkazy" | "Moje požadavky";
type RequestStep = 1 | 2;

type PaymentItem = {
  id: number;
  type: string;
  status: string;
  provider: string;
  name: string;
  deadline: string;
  amount: string;
  freq: string;
  account: string;
  vs: string;
  ks?: string;
  ss?: string;
  isIban?: boolean;
  brand: keyof typeof INSTITUTION_BRANDS;
};

const CLIENT = {
  firstName: "Daniel",
  fullName: "Daniel Král",
  initials: "DK",
};

const MENU_ITEMS: Array<{ id: PortalTab; icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }> }> = [
  { id: "Můj přehled", icon: LayoutGrid },
  { id: "Moje portfolio", icon: Briefcase },
  { id: "Platby a příkazy", icon: CreditCard },
  { id: "Moje požadavky", icon: MessageSquare },
];

const PAYMENTS: PaymentItem[] = [
  {
    id: 1,
    type: "POJIŠTĚNÍ OSOB",
    status: "AKTIVNÍ SMLOUVA",
    provider: "UNIQA",
    name: "Životní pojištění",
    deadline: "1. 5. 2026",
    amount: "2 442 Kč",
    freq: "MĚSÍČNĚ",
    account: "1071001005/5500",
    vs: "8801965412",
    ks: "3558",
    brand: "uniqa",
  },
  {
    id: 2,
    type: "INVESTICE",
    status: "AKTIVNÍ SMLOUVA",
    provider: "ATRIS investiční společnost",
    name: "ATRIS SPORO",
    deadline: "21. 4. 2026",
    amount: "2 000 000 Kč",
    freq: "MĚSÍČNĚ",
    account: "626111626/0300",
    vs: "371748",
    brand: "atris",
  },
  {
    id: 3,
    type: "INVESTICE",
    status: "AKTIVNÍ SMLOUVA",
    provider: "iShares",
    name: "iShares Core S&P 500 UCITS ETF",
    deadline: "24. 4. 2026",
    amount: "2 000 000 Kč",
    freq: "JEDNORÁZOVĚ",
    account: "CZ27 0100 0000 0002 8756 1002",
    vs: "7710252946",
    ks: "0308",
    isIban: true,
    brand: "ishares",
  },
  {
    id: 4,
    type: "INVESTICE",
    status: "AKTIVNÍ SMLOUVA",
    provider: "Amundi",
    name: "Fondy a ETF (Amundi)",
    deadline: "22. 4. 2026",
    amount: "3 000 Kč",
    freq: "MĚSÍČNĚ",
    account: "1387691786/2700",
    vs: "7023398569",
    brand: "amundi",
  },
  {
    id: 5,
    type: "POJIŠTĚNÍ MAJETKU",
    status: "AKTIVNÍ SMLOUVA",
    provider: "ČSOB Pojišťovna, a. s.",
    name: "Návrh pojistné smlouvy NAŠE ODPOVĚDNOST",
    deadline: "21. 4. 2026",
    amount: "4 959 Kč",
    freq: "ROČNĚ",
    account: "187078376/0300",
    vs: "6200253364",
    brand: "csob",
  },
  {
    id: 6,
    type: "POJIŠTĚNÍ MAJETKU",
    status: "AKTIVNÍ SMLOUVA",
    provider: "ČSOB Pojišťovna, a. s.",
    name: "Pojištění odpovědnosti zaměstnance",
    deadline: "21. 4. 2026",
    amount: "413 Kč",
    freq: "MĚSÍČNĚ",
    account: "187078376/0300",
    vs: "6200253364",
    brand: "csob",
  },
];

function DummyQRCode() {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="h-full w-full fill-current text-[#0B1021]">
      <rect width="200" height="200" fill="white" />
      <path d="M10 10h40v40H10zM20 20h20v20H20zM25 25h10v10H25zM150 10h40v40h-40zM160 20h20v20h-20zM165 25h10v10h-10zM10 150h40v40H10zM20 160h20v20H20zM25 165h10v10H25z" fillRule="evenodd" />
      <path d="M60 10h10v10H60zM80 20h20v10H80zM120 10h10v20h-10zM60 60h80v80H60zM70 70h60v60H70zM80 80h40v40H80z" fillRule="evenodd" />
      <path d="M10 70h20v10H10zM40 90h10v30H40zM150 80h30v10h-30zM160 110h20v20h-20zM70 160h30v10H70zM110 150h10v40h-10zM140 170h20v20h-20zM180 160h10v30h-10zM100 10h10v20h-10zM10 120h20v20H10zM130 30h20v10h-20zM30 60h20v20H30z" fillRule="evenodd" />
    </svg>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2.5 last:border-0">
      <div>
        <p className="mb-0.5 text-[10px] font-jakarta font-extrabold uppercase tracking-widest text-slate-400">{label}</p>
        <p className="font-jakarta text-[13px] font-bold text-[#0B1021]">{value}</p>
      </div>
      <button className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-jakarta font-extrabold uppercase tracking-widest text-slate-500 shadow-sm transition-colors hover:bg-slate-100 hover:text-[#0B1021]">
        Kopírovat
      </button>
    </div>
  );
}

function PortalInstitutionLogo({
  institution,
  brand,
  className = "",
}: {
  institution: string;
  brand: keyof typeof INSTITUTION_BRANDS;
  className?: string;
}) {
  const logo = resolveInstitutionLogo(institution);
  const fallback = INSTITUTION_BRANDS[brand];

  return (
    <div className={`flex items-center justify-center ${className}`}>
      {logo ? (
        <Image src={logo.src} alt={logo.alt} width={64} height={28} className="h-7 w-auto max-w-[64px] object-contain" unoptimized />
      ) : (
        <span className={`font-jakarta text-sm font-black ${fallback.fg}`}>{fallback.label}</span>
      )}
    </div>
  );
}

export function ClientPortalDemo() {
  const [activeTab, setActiveTab] = React.useState<PortalTab>("Můj přehled");
  const [isRequestModalOpen, setIsRequestModalOpen] = React.useState(false);
  const [requestStep, setRequestStep] = React.useState<RequestStep>(1);
  const [requestCategory, setRequestCategory] = React.useState("");
  const [activeQrPayment, setActiveQrPayment] = React.useState<PaymentItem | null>(null);

  return (
    <LandingProductFrame label="Klientský portál · klientský pohled" status="živý portál" statusTone="emerald">
      <LandingMockCanvas className="bg-[#F4F6FB]">
        <div className="flex h-full w-full overflow-hidden bg-[#F4F6FB] font-inter text-slate-800">
          <style>{`
            .font-jakarta { font-family: var(--font-jakarta), var(--font-primary), -apple-system, BlinkMacSystemFont, sans-serif; }
            .font-inter { font-family: var(--font-primary), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
            .custom-dots {
              background-image: radial-gradient(#CBD5E1 1px, transparent 1px);
              background-size: 32px 32px;
              background-position: -16px -16px;
            }
            .hide-scroll::-webkit-scrollbar { display: none; }
            .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
            .portal-card {
              background: #ffffff;
              border: 1px solid #E2E8F0;
              border-radius: 16px;
              box-shadow: 0 2px 10px -2px rgba(15, 23, 42, 0.02);
            }
          `}</style>

          <aside className="z-20 flex h-full w-[260px] shrink-0 flex-col border-r border-slate-200 bg-white shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
            <div className="flex h-20 shrink-0 items-center px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 text-lg font-jakarta font-extrabold text-white shadow-md shadow-emerald-200/50">
                  C
                </div>
                <span className="font-jakarta text-lg font-extrabold tracking-tight text-[#0B1021]">
                  Klientská <span className="text-emerald-500">Zóna</span>
                </span>
              </div>
            </div>

            <div className="hide-scroll flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-4">
              <span className="mb-2 px-4 text-[10px] font-jakarta font-extrabold uppercase tracking-widest text-slate-400">Menu</span>
              {MENU_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 transition-all duration-200 ${
                      isActive ? "bg-[#0B1021] text-white shadow-lg shadow-slate-900/10" : "text-slate-600 hover:bg-slate-50 hover:text-[#0B1021]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} className={isActive ? "text-white" : "text-slate-400"} strokeWidth={isActive ? 2.5 : 2} />
                      <span className="text-sm font-jakarta font-bold">{item.id}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="shrink-0 border-t border-slate-100 p-6">
              <p className="mb-3 text-[10px] font-jakarta font-extrabold uppercase tracking-widest text-slate-400">Váš osobní poradce</p>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-jakarta font-extrabold text-indigo-600 shadow-sm">
                    MM
                  </div>
                  <div>
                    <p className="leading-tight font-jakarta text-sm font-bold text-[#0B1021]">Marek Marek</p>
                    <p className="text-[10px] font-medium text-slate-500">mfragy@gmail.com</p>
                  </div>
                </div>
                <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-100 bg-white py-2 text-xs font-jakarta font-bold text-indigo-600 shadow-sm transition-colors hover:bg-indigo-50">
                  <MessageSquare size={14} /> NAPSAT ZPRÁVU
                </button>
              </div>
              <button className="mt-4 flex items-center gap-2 px-2 text-xs font-semibold text-slate-400 transition-colors hover:text-slate-700">
                <LogOut size={14} /> Odhlásit se
              </button>
            </div>
          </aside>

          <main className="custom-dots relative z-10 flex h-full min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-30 flex h-20 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-10">
              <h2 className="font-jakarta text-xl font-extrabold text-[#0B1021]">{activeTab}</h2>
              <div className="flex items-center gap-6">
                <button className="relative text-slate-400 transition-colors hover:text-[#0B1021]">
                  <Bell size={20} />
                  <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-rose-500" />
                </button>
                <div className="flex cursor-pointer items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-1.5 pr-4 shadow-sm transition-colors hover:bg-slate-100">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0B1021] text-xs font-jakarta font-bold text-white">
                    {CLIENT.initials}
                  </div>
                  <span className="text-sm font-semibold text-slate-700">{CLIENT.fullName}</span>
                </div>
              </div>
            </header>

            <div className="hide-scroll flex-1 overflow-y-auto px-6 py-8">
              <div className="w-full">
                {activeTab === "Můj přehled" ? (
                  <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-500">
                    <div className="mb-8 flex items-center justify-between">
                      <div>
                        <h1 className="text-[32px] font-jakarta font-extrabold tracking-tight text-[#0B1021]">Dobrý den, {CLIENT.firstName}</h1>
                        <p className="font-medium text-slate-500">Vítejte ve svém osobním finančním portálu.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("Moje požadavky");
                          setIsRequestModalOpen(true);
                        }}
                        className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-jakarta font-bold text-white shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-600"
                      >
                        <Plus size={18} strokeWidth={3} /> Nový požadavek
                      </button>
                    </div>

                    <div className="mb-8 grid grid-cols-3 gap-6">
                      <SummaryCard icon={Clock} tone="text-[#5A4BFF]" label="Spravovaný majetek" value="26 036 000 Kč" />
                      <SummaryCard icon={TrendingUp} tone="text-emerald-500" label="Měsíční investice" value="2 003 000 Kč" />
                      <SummaryCard icon={Shield} tone="text-amber-500" label="Měsíční pojistné" value="5 710 Kč">
                        <p className="mt-1 text-[10px] font-medium text-slate-400">Aktivních položek v přehledu: 7</p>
                      </SummaryCard>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="relative overflow-hidden rounded-[24px] bg-[#0B1021] p-10 text-white shadow-2xl shadow-slate-900/10">
                        <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-[#5A4BFF]/20 blur-[60px]" />
                        <div className="relative z-10">
                          <div className="mb-6 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/5 bg-white/10 text-slate-300">
                              <Bell size={18} />
                            </div>
                            <span className="text-[10px] font-jakarta font-extrabold uppercase tracking-widest text-slate-400">Aktuálně k řešení</span>
                          </div>
                          <h3 className="mb-4 font-jakarta text-3xl font-extrabold leading-tight">Dokument je dostupný v portálu</h3>
                          <p className="mb-10 text-sm font-medium leading-relaxed text-slate-300">
                            Soubor „Navrh_pojistne_smlouvy (2).pdf“ je nyní viditelný ve vašem portálu.
                          </p>
                          <div className="flex gap-3">
                            <button className="flex items-center gap-2 rounded-xl bg-[#5A4BFF] px-6 py-3.5 text-sm font-jakarta font-bold shadow-lg shadow-indigo-500/30 transition-all hover:bg-[#4A3DE0]">
                              Zobrazit dokumenty <ArrowRight size={16} />
                            </button>
                            <button className="rounded-xl border border-white/10 bg-white/10 px-6 py-3.5 text-sm font-jakarta font-bold transition-all hover:bg-white/20">
                              Napsat zprávu
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { title: "Moje portfolio", sub: "7 položek", icon: Briefcase, color: "text-indigo-500 bg-indigo-50", link: "Moje portfolio" as PortalTab },
                          { title: "Platby a QR", sub: "6 instrukcí", icon: CreditCard, color: "text-emerald-500 bg-emerald-50", link: "Platby a příkazy" as PortalTab },
                          { title: "Trezor dokumentů", sub: "5 dokumentů", icon: Archive, color: "text-amber-500 bg-amber-50" },
                          { title: "Moje požadavky", sub: "2 požadavky", icon: MessageSquare, color: "text-blue-500 bg-blue-50", link: "Moje požadavky" as PortalTab },
                        ].map((tile) => (
                          <div
                            key={tile.title}
                            onClick={() => (tile.link ? setActiveTab(tile.link) : undefined)}
                            className="portal-card group flex cursor-pointer flex-col items-center justify-center p-6 text-center transition-all hover:border-slate-300 hover:shadow-md"
                          >
                            <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${tile.color}`}>
                              <tile.icon size={20} />
                            </div>
                            <h4 className="mb-1 text-sm font-jakarta font-extrabold text-[#0B1021]">{tile.title}</h4>
                            <p className="text-[10px] font-medium text-slate-500">{tile.sub}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeTab === "Moje portfolio" ? (
                  <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-500">
                    <p className="mb-6 font-medium text-slate-500">
                      Přehled produktů evidovaných vaším poradcem. Údaje odpovídají stavu smluv - žádné ukázkové hodnoty.
                    </p>

                    <div className="mb-8 grid grid-cols-4 gap-4">
                      <PortfolioSummaryCard icon={TrendingUp} tone="text-emerald-500" label="Tvorba rezerv" value="2 003 000 Kč" hint="měsíčně" />
                      <PortfolioSummaryCard icon={Shield} tone="text-purple-500" label="Ochrana" value="5 710 Kč" hint="měsíční pojistné" />
                      <PortfolioSummaryCard icon={Shield} tone="text-purple-500" label="Roční pojistné" value="68 520 Kč" hint="ročně" />
                      <PortfolioSummaryCard icon={Briefcase} tone="text-slate-500" label="Položky" value="7" hint="v přehledu" />
                    </div>

                    <p className="mb-4 text-[10px] font-medium text-slate-400">
                      Souhrn vychází z aktivních smluv. Ukončené smlouvy jsou zobrazeny v přehledu níže.
                    </p>

                    <div className="hide-scroll mb-8 flex gap-3 overflow-x-auto">
                      <span className="whitespace-nowrap rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-jakarta font-bold text-emerald-700 shadow-sm">
                        <TrendingUp size={14} className="mr-2 inline-block" /> Investice a penze <span className="ml-2 rounded bg-emerald-100 px-1.5 text-[10px]">3</span>
                      </span>
                      <span className="whitespace-nowrap rounded-full border border-purple-200 bg-white px-4 py-2 text-xs font-jakarta font-bold text-purple-700 shadow-sm">
                        <Shield size={14} className="mr-2 inline-block" /> Zajištění příjmů a životní pojištění <span className="ml-2 rounded bg-purple-100 px-1.5 text-[10px]">2</span>
                      </span>
                      <span className="whitespace-nowrap rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-jakarta font-bold text-blue-700 shadow-sm">
                        <Car size={14} className="mr-2 inline-block" /> Majetek a odpovědnost <span className="ml-2 rounded bg-blue-100 px-1.5 text-[10px]">2</span>
                      </span>
                    </div>

                    <div className="mb-10">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-[10px] font-jakarta font-extrabold uppercase tracking-widest text-slate-400">Přehled evidovaných oblastí</h3>
                        <span className="text-[10px] font-medium text-slate-400">Pouze informativní - odráží stav v evidenci poradce</span>
                      </div>
                      <div className="grid grid-cols-4 gap-4">
                        <AreaCard icon={TrendingUp} color="border-l-emerald-400 bg-emerald-50 text-emerald-500" title="Investice a penze" contracts="3 smluv" />
                        <AreaCard icon={Shield} color="border-l-purple-400 bg-purple-50 text-purple-500" title="Zajištění příjmů ..." contracts="2 smluv" />
                        <AreaCard icon={Car} color="border-l-blue-400 bg-blue-50 text-blue-500" title="Majetek a odpovědnost" contracts="2 smluv" />
                        <div className="portal-card border border-dashed border-slate-200 p-5 opacity-60">
                          <p className="text-sm font-jakarta font-bold text-slate-600">Vozidla / Hypotéky</p>
                          <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Bez evidence</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <PortfolioSection title="Investice a penze" count="3 produkty" icon={TrendingUp} tone="bg-emerald-50 text-emerald-500">
                        {[
                          { institution: "ATRIS SPORO", provider: "ATRIS investiční společnost", date: "21.04.2026", status: "V evidenci", amount: "2 000 000 Kč / měsíc", brand: "atris" as const },
                          { institution: "Fondy a ETF (Amundi)", provider: "Amundi", date: "22.04.2026", status: "V evidenci", amount: "3 000 Kč / měsíc", brand: "amundi" as const },
                          { institution: "iShares Core S&P 500 UCITS ETF", provider: "iShares", date: "24.04.2026", status: "V evidenci", amount: "2 000 000 Kč jednorázově", brand: "ishares" as const },
                        ].map((item) => (
                          <PortfolioRow key={item.institution} {...item} category="Investice" />
                        ))}
                      </PortfolioSection>

                      <div className="pt-4">
                        <PortfolioSection
                          title="Zajištění příjmů a životní pojištění"
                          count="2 produkty"
                          icon={Shield}
                          tone="bg-purple-50 text-purple-500"
                        >
                          <PortfolioRow
                            institution="Život & Radost"
                            provider="UNIQA"
                            date="01.05.2026"
                            status="Aktivní"
                            amount="29 304 Kč / rok"
                            brand="uniqa"
                            category="Životní pojištění"
                            active
                          />
                        </PortfolioSection>
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeTab === "Platby a příkazy" ? (
                  <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-500">
                    <p className="mb-8 font-medium text-slate-500">
                      Přehled platebních údajů napojených na smlouvy, které máte v portálu zveřejněné od poradce.
                    </p>

                    <div className="grid grid-cols-3 items-stretch gap-5">
                      {PAYMENTS.map((item) => (
                        <div key={item.id} className="portal-card flex h-full min-h-0 flex-col border border-slate-200 p-6 shadow-sm">
                          <div className="mb-6 flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-4">
                              <PortalInstitutionLogo institution={item.provider} brand={item.brand} className="h-7 min-w-[52px] shrink-0 justify-start" />
                              <div className="min-w-0">
                                <p className={`mb-0.5 text-[10px] font-jakarta font-extrabold uppercase tracking-widest ${item.type.includes("INVESTICE") ? "text-purple-600" : "text-rose-500"}`}>
                                  {item.type}
                                </p>
                                <h4 className="mb-1 line-clamp-2 text-sm font-jakarta font-bold leading-tight text-[#0B1021]">{item.name}</h4>
                                <p className="text-[11px] font-medium text-slate-500">{item.provider}</p>
                                <p className="mt-2 inline-block rounded bg-amber-50 px-2 py-0.5 text-[10px] font-jakarta font-bold uppercase tracking-widest text-amber-500">
                                  První platba do {item.deadline}
                                </p>
                              </div>
                            </div>
                            <span className="shrink-0 whitespace-nowrap rounded-md bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-600">
                              {item.status}
                            </span>
                          </div>

                          <div className="mb-5 flex min-h-0 flex-1 flex-col border-t border-slate-100 pt-5">
                            <div className="mb-5 flex items-end justify-between gap-2">
                              <div className="min-w-0">
                                <p className="mb-1 text-[10px] font-jakarta font-extrabold uppercase tracking-widest text-slate-400">Částka k úhradě</p>
                                <p className="whitespace-nowrap font-jakarta text-[28px] font-black leading-none text-[#0B1021]">{item.amount}</p>
                              </div>
                              <p className="shrink-0 pb-1 text-right text-[10px] font-jakarta font-extrabold uppercase tracking-widest text-slate-400">{item.freq}</p>
                            </div>

                            <div className="min-h-0 flex-1 space-y-1">
                              <CopyRow label={item.isIban ? "IBAN" : "Účet"} value={item.account} />
                              <CopyRow label="Variabilní symbol" value={item.vs} />
                              {item.ks ? <CopyRow label="Konstantní symbol" value={item.ks} /> : null}
                              {item.ss ? <CopyRow label="Specifický symbol" value={item.ss} /> : null}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setActiveQrPayment(item)}
                            className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-3.5 text-xs font-jakarta font-bold uppercase tracking-widest text-slate-600 shadow-sm transition-colors hover:bg-slate-100"
                          >
                            <QrCode size={16} /> Zobrazit QR kód
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {activeTab === "Moje požadavky" ? (
                  <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-500">
                    <div className="mb-8 flex items-center justify-between">
                      <p className="font-medium text-slate-500">Vaše požadavky na poradce a podklady, které poradce potřebuje od vás.</p>
                      <button
                        type="button"
                        onClick={() => setIsRequestModalOpen(true)}
                        className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-jakarta font-bold text-white shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-600"
                      >
                        <Plus size={18} strokeWidth={3} /> Nový požadavek
                      </button>
                    </div>

                    <div className="mx-auto max-w-4xl space-y-4">
                      {[
                        {
                          title: "Požadavek z portálu: Pojištění",
                          desc: "Životní pojištění Prosím o životní pojištění pro dceru",
                          date: "1. 4. 2026",
                        },
                        {
                          title: "Požadavek z portálu: Pojištění",
                          desc: "Životní pojištění Potřebuji životní pojištění upravit",
                          date: "1. 4. 2026",
                        },
                      ].map((req) => (
                        <div key={req.title + req.desc} className="portal-card flex items-start gap-4 p-6">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-500">
                            <Clock size={20} strokeWidth={2.5} />
                          </div>
                          <div>
                            <p className="mb-1 text-[10px] font-jakarta font-extrabold uppercase tracking-widest text-amber-500">Přijato</p>
                            <h4 className="mb-1 text-base font-jakarta font-bold text-[#0B1021]">{req.title}</h4>
                            <p className="mb-1 text-xs font-medium text-slate-500">Pojištění</p>
                            <p className="mb-2 text-sm text-slate-600">{req.desc}</p>
                            <p className="text-[10px] font-medium text-slate-400">Aktualizováno {req.date}</p>
                          </div>
                        </div>
                      ))}
                      <button className="mt-4 flex items-center gap-1 text-sm font-jakarta font-bold text-indigo-600 hover:text-indigo-800">
                        <Plus size={16} /> Potřebujete detail? Napište poradci
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </main>

          {isRequestModalOpen ? (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity"
                onClick={() => {
                  setIsRequestModalOpen(false);
                  setRequestStep(1);
                }}
              />

              <div className="relative w-full max-w-[640px] rounded-[32px] bg-white p-10 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.4)] animate-in fade-in zoom-in-95 duration-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsRequestModalOpen(false);
                    setRequestStep(1);
                  }}
                  className="absolute right-8 top-8 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#0B1021]"
                >
                  <X size={20} strokeWidth={2.5} />
                </button>

                <h2 className="mb-8 text-2xl font-jakarta font-extrabold text-[#0B1021]">Nový požadavek na poradce</h2>

                {requestStep === 1 ? (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                    <p className="mb-4 text-[11px] font-jakarta font-extrabold uppercase tracking-widest text-slate-400">1. Co potřebujete vyřešit?</p>
                    <div className="grid grid-cols-2 gap-4">
                      {["Bydlení a úvěry", "Pojištění", "Investice a Penze", "Změna životní situace", "Servis smlouvy", "Ostatní"].map((category) => (
                        <button
                          key={category}
                          type="button"
                          onClick={() => {
                            setRequestCategory(category);
                            setRequestStep(2);
                          }}
                          className="group rounded-2xl border border-slate-200 p-5 text-left font-jakarta font-bold text-[#0B1021] transition-all hover:border-indigo-500 hover:shadow-md"
                        >
                          <span className="transition-colors group-hover:text-indigo-600">{category}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                    <button type="button" onClick={() => setRequestStep(1)} className="mb-6 flex items-center gap-1 text-xs font-jakarta font-bold text-indigo-600 transition-colors hover:text-indigo-800">
                      <ChevronLeft size={16} /> Zpět na výběr
                    </button>
                    <p className="mb-4 text-[11px] font-jakarta font-extrabold uppercase tracking-widest text-slate-400">3. Detaily požadavku</p>

                    <div className="space-y-6">
                      <div>
                        <label className="ml-1 mb-2 block text-[11px] font-jakarta font-bold text-[#0B1021]">Název požadavku</label>
                        <input
                          type="text"
                          defaultValue={requestCategory}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-medium text-[#0B1021] outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                        />
                      </div>
                      <div>
                        <label className="ml-1 mb-2 block text-[11px] font-jakarta font-bold text-[#0B1021]">Detailní popis</label>
                        <textarea
                          placeholder="Upřesněte částku, termín nebo další kontext..."
                          className="h-32 w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-medium text-[#0B1021] outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                        />
                      </div>

                      <button className="flex w-max items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-5 py-2.5 text-xs font-jakarta font-bold text-[#0B1021] shadow-sm transition-colors hover:bg-slate-100">
                        <FileUp size={16} className="text-slate-400" /> PŘILOŽIT SOUBOR
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsRequestModalOpen(false);
                          setRequestStep(1);
                        }}
                        className="mt-4 w-full rounded-xl bg-[#5A4BFF] py-4 text-sm font-jakarta font-extrabold text-white shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 hover:bg-[#4A3DE0] active:translate-y-0"
                      >
                        ODESLAT PORADCI
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {activeQrPayment ? (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity" onClick={() => setActiveQrPayment(null)} />

              <div className="relative flex w-full max-w-[420px] flex-col overflow-hidden rounded-[32px] bg-white shadow-[0_24px_80px_-12px_rgba(0,0,0,0.4)] animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between px-6 pb-4 pt-6">
                  <h2 className="text-xl font-jakarta font-extrabold text-[#0B1021]">QR Platba</h2>
                  <button
                    type="button"
                    onClick={() => setActiveQrPayment(null)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-[#0B1021]"
                  >
                    <X size={20} strokeWidth={2} />
                  </button>
                </div>

                <div className="flex flex-1 flex-col border-t border-slate-100 bg-white px-6 pb-8 pt-6">
                  <h3 className="mb-6 text-center text-sm font-jakarta font-extrabold uppercase tracking-wider text-[#0B1021]">
                    {activeQrPayment.provider}
                  </h3>

                  <div className="mx-auto mb-6 flex aspect-square w-full max-w-[280px] items-center justify-center rounded-[24px] border border-slate-100 bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                    <DummyQRCode />
                  </div>

                  <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
                    <div className="flex items-center text-[13px]">
                      <span className="w-16 font-semibold text-slate-500">Účet:</span>
                      <span className="font-jakarta font-bold text-[#0B1021]">{activeQrPayment.account}</span>
                    </div>
                    <div className="flex items-center text-[13px]">
                      <span className="w-16 font-semibold text-slate-500">Částka:</span>
                      <span className="whitespace-nowrap font-jakarta font-bold text-[#0B1021]">{activeQrPayment.amount}</span>
                    </div>
                    <div className="flex items-center text-[13px]">
                      <span className="w-16 font-semibold text-slate-500">VS:</span>
                      <span className="font-jakarta font-bold text-[#0B1021]">{activeQrPayment.vs}</span>
                    </div>
                    {activeQrPayment.ks ? (
                      <div className="flex items-center text-[13px]">
                        <span className="w-16 font-semibold text-slate-500">KS:</span>
                        <span className="font-jakarta font-bold text-[#0B1021]">{activeQrPayment.ks}</span>
                      </div>
                    ) : null}
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

function SummaryCard({
  icon: Icon,
  tone,
  label,
  value,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: string;
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="portal-card flex flex-col justify-center p-6">
      <div className="mb-2 flex items-center gap-2">
        <Icon size={16} className={tone} />
        <p className={`text-[10px] font-jakarta font-extrabold uppercase tracking-widest ${tone}`}>{label}</p>
      </div>
      <h3 className="whitespace-nowrap text-3xl font-jakarta font-black text-[#0B1021]">{value}</h3>
      {children}
    </div>
  );
}

function PortfolioSummaryCard({
  icon: Icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: string;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="portal-card p-5">
      <p className={`mb-2 flex items-center gap-1.5 text-[10px] font-jakarta font-extrabold uppercase tracking-widest ${tone}`}>
        <Icon size={12} /> {label}
      </p>
      <h3 className="whitespace-nowrap text-2xl font-jakarta font-black text-[#0B1021]">{value}</h3>
      <p className="mt-1 text-[10px] font-medium text-slate-400">{hint}</p>
    </div>
  );
}

function AreaCard({
  icon: Icon,
  color,
  title,
  contracts,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  title: string;
  contracts: string;
}) {
  const [borderClass, bgClass, textClass] = color.split(" ");
  return (
    <div className={`portal-card border-l-4 p-5 ${borderClass}`}>
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-1.5 ${bgClass} ${textClass}`}>
          <Icon size={16} />
        </div>
        <div>
          <p className="text-sm font-jakarta font-bold text-[#0B1021]">{title}</p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-emerald-600">V evidenci</p>
          <p className="mt-0.5 text-xs text-slate-500">{contracts}</p>
        </div>
      </div>
    </div>
  );
}

function PortfolioSection({
  title,
  count,
  icon: Icon,
  tone,
  children,
}: {
  title: string;
  count: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-4 flex items-center gap-2 text-sm font-jakarta font-bold text-[#0B1021]">
        <div className={`rounded-lg p-1.5 ${tone}`}>
          <Icon size={16} />
        </div>
        {title} <span className="text-xs font-medium text-slate-400">{count}</span>
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function PortfolioRow({
  institution,
  provider,
  date,
  status,
  amount,
  brand,
  category,
  active = false,
}: {
  institution: string;
  provider: string;
  date: string;
  status: string;
  amount: string;
  brand: keyof typeof INSTITUTION_BRANDS;
  category: string;
  active?: boolean;
}) {
  return (
    <div className={`portal-card flex cursor-pointer items-center justify-between p-5 transition-shadow hover:shadow-md ${active ? "border-l-4 border-l-emerald-400" : ""}`}>
      <div className="flex items-center gap-4">
        <PortalInstitutionLogo institution={provider} brand={brand} className="h-7 min-w-[64px] justify-start" />
        <div>
          <h4 className="text-sm font-jakarta font-bold text-[#0B1021]">{institution}</h4>
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500">{category}</span>
            <span className="text-[10px] text-slate-400">od {date}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 text-right">
        <div>
          <span className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-widest ${active ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
            {status}
          </span>
          <p className="mt-1 whitespace-nowrap text-lg font-jakarta font-bold text-[#0B1021]">{amount}</p>
        </div>
        <ChevronDown size={20} className="text-slate-400" />
      </div>
    </div>
  );
}

export default ClientPortalDemo;
