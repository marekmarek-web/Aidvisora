"use client";

import Image from "next/image";
import React from "react";
import {
  Activity,
  AlignLeft,
  Briefcase,
  Calendar,
  Car,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit2,
  FileText,
  Mail,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Phone,
  Plus,
  Shield,
  TrendingUp,
  Zap,
} from "lucide-react";

import { resolveInstitutionLogo } from "@/lib/institutions/institution-logo";

import { INSTITUTION_BRANDS } from "./demo-data";
import { LandingMockCanvas } from "./LandingMockCanvas";
import { LandingProductFrame } from "./LandingProductFrame";

type Product = {
  id: string;
  name: string;
  category: string;
  provider: string;
  brand: keyof typeof INSTITUTION_BRANDS;
  status: string;
  statusColor: string;
  payment: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  logoTone: string;
  hasAiBadge?: boolean;
  expandable?: boolean;
  details?: {
    type: string;
    institution: string;
    strategy: string;
    regularAmount: string;
    targetAmount: string;
    internalNote: string;
  };
  contractNumber?: string;
  startDate?: string;
};

const CLIENT = {
  name: "David Kovář",
  initials: "DK",
  email: "david.kovar.test@email.cz",
  phone: "777 123 456",
  address: "Slunečná 45, 120 00 Praha 2",
  dob: "15. 8. 1985",
  kpis: {
    monthlyInvest: "5 000 Kč",
    aum: "2 450 000 Kč",
    monthlyInsurance: "1 850 Kč",
    yearlyInsurance: "22 200 Kč",
  },
};

const PRODUCTS: {
  zivotni: Product[];
  investice: Product[];
  auto: Product[];
} = {
  zivotni: [
    {
      id: "z1",
      name: "Životní plán Plus",
      category: "Životní pojištění",
      provider: "UNIQA pojišťovna",
      brand: "uniqa",
      status: "AKTIVNÍ",
      statusColor: "text-emerald-600 bg-emerald-50",
      payment: "1 850 Kč / měs",
      icon: Shield,
      logoTone: "text-blue-600 bg-blue-50 border-blue-100",
    },
  ],
  investice: [
    {
      id: "i1",
      name: "ETF portfolio Global",
      category: "Investice",
      provider: "Amundi",
      brand: "amundi",
      status: "AKTIVNÍ",
      statusColor: "text-emerald-600 bg-emerald-50",
      payment: "5 000 Kč / měs",
      icon: TrendingUp,
      logoTone: "text-blue-600 bg-blue-50 border-blue-100",
      expandable: true,
      contractNumber: "8541258744",
      startDate: "10. 05. 2024",
      details: {
        type: "Investice",
        institution: "Amundi ETF Portfolio",
        strategy: "Pravidelné investování - Dynamická",
        regularAmount: "5 000 Kč / měsíc",
        targetAmount: "2 500 000 CZK",
        internalNote:
          "Klient chce využít dlouhého horizontu pro agresivnější růst. Pravidelná revize jednou za 12 měsíců.",
      },
    },
    {
      id: "i2",
      name: "Realitní fond CEE",
      category: "Investice",
      provider: "Nemovitostní fond Atris",
      brand: "atris",
      status: "V EVIDENCI",
      statusColor: "text-amber-600 bg-amber-50",
      payment: "500 000 Kč jednorázově",
      icon: Activity,
      logoTone: "text-emerald-600 bg-emerald-50 border-emerald-100",
      hasAiBadge: true,
    },
  ],
  auto: [
    {
      id: "a1",
      name: "Komplexní pojištění vozidla",
      category: "Auto pojištění",
      provider: "Kooperativa",
      brand: "kooperativa",
      status: "AKTIVNÍ",
      statusColor: "text-emerald-600 bg-emerald-50",
      payment: "12 500 Kč / rok",
      icon: Car,
      logoTone: "text-indigo-600 bg-indigo-50 border-indigo-100",
    },
  ],
};

const TABS = ["PŘEHLED", "DETAIL", "ČASOVÁ OSA", "DOKUMENTY", "ZÁPISKY", "POŽADAVKY NA PODKLADY", "BRIEFING"] as const;

const BADGE_ICON = {
  invest: TrendingUp,
  aum: Briefcase,
  insured: Shield,
  yearly: Calendar,
} as const;

function AiVerifiedBadge({ date }: { date: string }) {
  return (
    <div className="mt-1 flex items-center gap-1 text-[10px] font-medium text-emerald-600">
      <CheckCircle2 size={12} className="fill-emerald-100" />
      <span>Potvrzeno z AI Review · {date}</span>
    </div>
  );
}

function ProductLogo({
  institution,
  brand,
  tone: _tone,
  icon: Icon,
}: {
  institution: string;
  brand: keyof typeof INSTITUTION_BRANDS;
  tone: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  const logo = resolveInstitutionLogo(institution);
  const fallback = INSTITUTION_BRANDS[brand];

  const isKooperativa = brand === "kooperativa";
  return (
    <div className={`flex items-center justify-center ${isKooperativa ? "h-12 min-w-[100px]" : "h-10 w-24"}`}>
      {logo ? (
        <Image
          src={logo.src}
          alt={logo.alt}
          width={isKooperativa ? 120 : 96}
          height={isKooperativa ? 40 : 32}
          className={`w-auto object-contain ${isKooperativa ? "h-9 max-w-[120px]" : "h-7 max-w-[96px]"}`}
          unoptimized
        />
      ) : (
        <span className={`font-jakarta text-xs font-bold uppercase tracking-wider ${fallback.fg}`}>{fallback.label}</span>
      )}
    </div>
  );
}

export function ClientDetailDemo() {
  const [expandedProduct, setExpandedProduct] = React.useState<string | null>("i1");
  const [activeTab, setActiveTab] = React.useState<(typeof TABS)[number]>("PŘEHLED");

  const toggleExpand = (id: string) => {
    setExpandedProduct((current) => (current === id ? null : id));
  };

  return (
    <LandingProductFrame label="Detail klienta · přehled vztahu" status="4 aktivní produkty" statusTone="indigo">
      <LandingMockCanvas className="bg-[#F4F6FB]">
        <div className="custom-dots h-full overflow-hidden bg-[#F4F6FB] font-inter text-slate-800">
          <style>{`
            .font-jakarta { font-family: var(--font-jakarta), var(--font-primary), -apple-system, BlinkMacSystemFont, sans-serif; }
            .font-inter { font-family: var(--font-primary), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
            .custom-dots {
              background-image: radial-gradient(#CBD5E1 1px, transparent 1px);
              background-size: 32px 32px;
              background-position: -16px -16px;
            }
            .client-card {
              background: #ffffff;
              border: 1px solid #E2E8F0;
              border-radius: 24px;
              box-shadow: 0 4px 24px -6px rgba(15, 23, 42, 0.03);
            }
          `}</style>

          <div className="h-full w-full overflow-y-auto px-6 pb-6 pt-6">
            <div className="space-y-5">
              <div className="client-card relative overflow-hidden p-6">
                <div className="flex flex-col justify-between gap-6 lg:flex-row">
                  <div className="flex gap-5">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[20px] bg-[#0B1021] text-3xl font-jakarta font-bold text-white shadow-lg">
                      {CLIENT.initials}
                    </div>

                    <div className="flex flex-col justify-center">
                      <div className="mb-3 flex items-center gap-3">
                        <h1 className="text-3xl font-jakarta font-extrabold tracking-tight text-[#0B1021]">{CLIENT.name}</h1>
                        <button className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-500 transition-colors hover:bg-slate-100">
                          Přidat štítek
                        </button>
                        <button className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-[11px] font-bold text-[#5A4BFF] transition-colors hover:bg-indigo-100">
                          Přidat
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-x-10 gap-y-3 md:grid-cols-2">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <Mail size={16} className="text-slate-400" /> {CLIENT.email}
                          </div>
                          <AiVerifiedBadge date="dnes" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <Phone size={16} className="text-slate-400" /> {CLIENT.phone}
                          </div>
                          <AiVerifiedBadge date="dnes" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <MapPin size={16} className="shrink-0 text-slate-400" /> {CLIENT.address}
                          </div>
                          <AiVerifiedBadge date="dnes" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <Calendar size={16} className="text-slate-400" /> {CLIENT.dob}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex min-w-[200px] flex-col gap-2">
                    <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-jakarta font-bold text-emerald-700 transition-colors hover:bg-emerald-100">
                      <Phone size={16} /> Zavolat
                    </button>
                    <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-50 px-4 py-2.5 text-sm font-jakarta font-bold text-indigo-700 transition-colors hover:bg-indigo-100">
                      <MessageSquare size={16} /> Zpráva
                    </button>
                    <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-jakarta font-bold text-amber-700 transition-colors hover:bg-amber-100">
                      <Briefcase size={16} /> Nový obchod
                    </button>

                    <div className="mt-1 flex items-center justify-center gap-2 text-[10px] font-medium text-slate-500">
                      <span className="rounded bg-emerald-50 px-2 py-0.5 font-bold uppercase tracking-wider text-emerald-600">Aktivní přístup</span>
                      Klient má přístup.
                    </div>
                  </div>
                </div>
              </div>

              <div className="hide-scroll flex items-center gap-8 overflow-x-auto border-b border-slate-200/60 px-2 pb-px">
                {TABS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`relative whitespace-nowrap py-3 text-[11px] font-jakarta font-extrabold uppercase tracking-widest transition-all ${
                      activeTab === tab ? "text-[#5A4BFF]" : "text-slate-400 hover:text-slate-700"
                    }`}
                  >
                    {tab}
                    {activeTab === tab ? <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-[#5A4BFF] shadow-[0_-2px_8px_rgba(90,75,255,0.4)]" /> : null}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[
                  { key: "invest", label: "Měsíční investice", value: CLIENT.kpis.monthlyInvest, tone: "text-[#5A4BFF] bg-indigo-50", icon: BADGE_ICON.invest },
                  { key: "aum", label: "Osobní AUM", value: CLIENT.kpis.aum, tone: "text-[#0B1021] bg-slate-100", icon: BADGE_ICON.aum },
                  { key: "insured", label: "Měsíční pojistné", value: CLIENT.kpis.monthlyInsurance, tone: "text-emerald-600 bg-emerald-50", icon: BADGE_ICON.insured },
                  { key: "yearly", label: "Roční pojistné", value: CLIENT.kpis.yearlyInsurance, tone: "text-[#0B1021] bg-slate-100", icon: BADGE_ICON.yearly },
                ].map((item) => (
                  <div key={item.key} className="client-card p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <div className={`rounded-lg p-1.5 ${item.tone}`}>
                        <item.icon size={14} />
                      </div>
                      <span className="text-[10px] font-jakarta font-extrabold uppercase tracking-widest text-slate-400">{item.label}</span>
                    </div>
                    <div className={`text-2xl font-jakarta font-black ${item.key === "invest" ? "text-[#5A4BFF]" : item.key === "insured" ? "text-emerald-600" : "text-[#0B1021]"}`}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="client-card overflow-hidden">
                <div className="flex flex-col justify-between gap-4 border-b border-slate-100 bg-white px-6 py-5 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="flex items-center gap-2 text-lg font-jakarta font-extrabold text-[#0B1021]">
                      <Briefcase size={20} className="text-[#5A4BFF]" /> Sjednané a rozjednané produkty
                    </h2>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      Klikněte na produkt pro zobrazení detailu, poznámek a platebních údajů.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-jakarta font-bold text-[#0B1021] transition-colors hover:bg-slate-50">
                      <FileText size={14} /> Doplnit platební instrukci
                    </button>
                    <button className="flex items-center gap-2 rounded-xl bg-[#5A4BFF] px-4 py-2 text-xs font-jakarta font-bold text-white shadow-sm shadow-indigo-200 transition-colors hover:bg-[#4A3DE0]">
                      <Plus size={16} strokeWidth={2.5} /> Přidat produkt
                    </button>
                  </div>
                </div>

                <div className="space-y-8 bg-slate-50/30 p-6">
                  <ProductGroup title="Životní pojištění" count={PRODUCTS.zivotni.length}>
                    {PRODUCTS.zivotni.map((product) => (
                      <ProductRow key={product.id} product={product} />
                    ))}
                  </ProductGroup>

                  <ProductGroup title="Investice" count={PRODUCTS.investice.length}>
                    {PRODUCTS.investice.map((product) => (
                      <ProductRow
                        key={product.id}
                        product={product}
                        expanded={expandedProduct === product.id}
                        onToggle={product.expandable ? () => toggleExpand(product.id) : undefined}
                      />
                    ))}
                  </ProductGroup>

                  <ProductGroup title="Auto pojištění" count={PRODUCTS.auto.length}>
                    {PRODUCTS.auto.map((product) => (
                      <ProductRow key={product.id} product={product} />
                    ))}
                  </ProductGroup>
                </div>
              </div>
            </div>
          </div>
        </div>
      </LandingMockCanvas>
    </LandingProductFrame>
  );
}

function ProductGroup({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-4 ml-2 flex items-center gap-2">
        <h3 className="text-[11px] font-jakarta font-extrabold uppercase tracking-widest text-slate-500">{title}</h3>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">{count}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ProductRow({
  product,
  expanded = false,
  onToggle,
}: {
  product: Product;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div
      className={`overflow-hidden border bg-white transition-all duration-300 ${
        expanded ? "rounded-3xl border-[#5A4BFF] shadow-lg" : "group rounded-2xl border-slate-200 hover:border-indigo-200 hover:shadow-sm"
      }`}
    >
      <div className={`flex items-center justify-between p-4 ${expanded ? "border-b border-slate-100 bg-indigo-50/30" : ""}`}>
        <div className="flex items-center gap-4">
          <ProductLogo institution={product.provider} brand={product.brand} tone={product.logoTone} icon={product.icon} />
          <div>
            <h4 className={`font-jakarta text-sm font-extrabold ${expanded ? "text-[#5A4BFF]" : "text-[#0B1021]"}`}>{product.name}</h4>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{product.category}</span>
              <span className="text-[10px] font-bold text-slate-800">{product.provider}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {product.hasAiBadge ? (
            <span className="flex items-center gap-1 rounded px-2 py-1 text-[9px] font-bold tracking-widest text-white shadow-sm bg-slate-800">
              <Zap size={10} className="fill-amber-400 text-amber-400" /> AI Asistent
            </span>
          ) : null}
          <span className={`rounded px-2 py-1 text-[9px] font-black uppercase tracking-widest ${product.statusColor}`}>{product.status}</span>
          <div className="text-right">
            <p className="mb-0.5 text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Platba / Pojistné / Splátka</p>
            <p className="font-jakarta text-sm font-bold text-[#0B1021]">{product.payment}</p>
          </div>
          <div className={`flex items-center gap-1 transition-opacity ${expanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
            <button className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600">
              <Edit2 size={16} />
            </button>
            <button className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600">
              <MoreHorizontal size={16} />
            </button>
            {onToggle ? (
              <button
                type="button"
                onClick={onToggle}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                  expanded ? "bg-[#5A4BFF] text-white shadow-md" : "text-slate-400 hover:bg-slate-100"
                }`}
              >
                {expanded ? <ChevronUp size={18} /> : <ChevronDown size={20} />}
              </button>
            ) : (
              <button className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100">
                <ChevronDown size={20} />
              </button>
            )}
          </div>
        </div>
      </div>

      {expanded && product.details ? (
        <div className="animate-in slide-in-from-top-4 fade-in p-6 duration-300">
          <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Platba / Pojistné / Splátka</p>
              <p className="font-jakarta text-lg font-bold text-[#0B1021]">{product.payment}</p>
            </div>
            <div>
              <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Číslo smlouvy</p>
              <p className="w-max rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 font-jakarta font-bold text-[#0B1021]">
                {product.contractNumber}
              </p>
            </div>
            <div>
              <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Počátek</p>
              <p className="font-jakarta font-bold text-[#0B1021]">{product.startDate}</p>
            </div>
          </div>

          <div className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex cursor-pointer items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-4">
              <h4 className="flex items-center gap-2 text-sm font-jakarta font-bold text-[#5A4BFF]">
                <AlignLeft size={16} /> Poznámky k produktu
              </h4>
              <ChevronDown size={18} className="text-slate-400" />
            </div>
            <div className="space-y-1 p-5 text-sm font-medium leading-relaxed text-slate-600">
              <p>Typ produktu: {product.details.type}</p>
              <p>Instituce: {product.details.institution}</p>
              <p>Strategie: {product.details.strategy}</p>
              <p>Pravidelná částka: {product.details.regularAmount}</p>
              <p>Cílová částka: {product.details.targetAmount}</p>
              <div className="mt-4 border-t border-slate-100 pt-4 text-slate-500">
                <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest">Interní poznámka poradce</p>
                <p>{product.details.internalNote}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 border-t border-slate-100 pt-4 text-[10px] font-bold text-emerald-600">
            <FileText size={12} className="text-slate-400" />
            <CheckCircle size={12} className="ml-1" /> Z AI kontroly · 15. 5. 2026
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ClientDetailDemo;
