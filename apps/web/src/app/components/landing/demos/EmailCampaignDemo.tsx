"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  Bold,
  Calendar,
  Code,
  ExternalLink,
  Eye,
  Gift,
  Image as ImageIcon,
  Info,
  Italic,
  LayoutTemplate,
  Link2,
  List,
  ListOrdered,
  Mail,
  Monitor,
  Newspaper,
  Save,
  Send,
  Smartphone,
  TrendingUp,
} from "lucide-react";

import { LandingMockCanvas, LANDING_MOCK_CANVAS_HEIGHT } from "./LandingMockCanvas";
import { LandingProductFrame } from "./LandingProductFrame";

type TemplateId = "empty" | "newsletter" | "birthday" | "meeting";

type CampaignFormData = {
  internalName: string;
  segment: string;
  subject: string;
  bodyText: string;
};

const TEMPLATES: Array<{
  id: TemplateId;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  title: string;
  subtitle: string;
  iconColor: string;
}> = [
  { id: "empty", icon: Mail, title: "Prázdný e-mail", subtitle: "OD NULY", iconColor: "text-slate-500" },
  { id: "newsletter", icon: Newspaper, title: "Newsletter", subtitle: "PRAVIDELNÝ OBSAH", iconColor: "text-blue-500" },
  { id: "birthday", icon: Gift, title: "Přání k narozeninám", subtitle: "OSOBNÍ PŘÁNÍ", iconColor: "text-rose-500" },
  { id: "meeting", icon: Calendar, title: "Pozvánka na konzultaci", subtitle: "TERMÍN SCHŮZKY", iconColor: "text-emerald-500" },
];

const TEMPLATE_CONTENT: Record<TemplateId, CampaignFormData> = {
  empty: {
    internalName: "Např. Jarní newsletter 2026",
    segment: "Všichni klienti (0)",
    subject: "",
    bodyText: "Dobrý den,\n\n...\n\nS pozdravem,\nMartin Dvořák",
  },
  newsletter: {
    internalName: "Měsíční Newsletter - Duben 2026",
    segment: "Všichni klienti (0)",
    subject: "Novinky ze světa financí: Co se děje na trzích?",
    bodyText:
      "Dobrý den, {{jmeno}},\n\npřináším vám pravidelný přehled toho nejdůležitějšího, co se událo na trzích a co by mohlo zajímat vaše portfolio.\n\n[Trhy v tomto měsíci rostly]\nS&P 500 dosáhl nových historických maxim díky silným výsledkům technologického sektoru.",
  },
  birthday: {
    internalName: "Přání k narozeninám (Automatizace)",
    segment: "Narozeniny dnes (2)",
    subject: "Všechno nejlepší k narozeninám, {{jmeno}}!",
    bodyText:
      "Krásný den, {{jmeno}},\n\ndovolte mi popřát vám všechno nejlepší k vašim dnešním narozeninám. Hlavně hodně zdraví, spokojenosti a ať se vám daří v osobním i pracovním životě.",
  },
  meeting: {
    internalName: "Jarní servisní schůzky 2026",
    segment: "Klienti bez schůzky > 1 rok (45)",
    subject: "Čas na krátkou kontrolu vašich financí?",
    bodyText:
      "Dobrý den, {{jmeno}},\n\nrád/a bych si s vámi domluvil/a krátkou schůzku, kde si společně projdeme aktuální stav vaší smluvní dokumentace, případné změny a oblasti, které byste sám/sama chtěl/a probrat.",
  },
};

function EmailPreviewContent({
  activeTemplate,
  formData,
}: {
  activeTemplate: TemplateId;
  formData: CampaignFormData;
}) {
  switch (activeTemplate) {
    case "newsletter":
      return (
        <div className="mx-auto max-w-[600px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-6">
            <span className="font-jakarta text-xl font-black tracking-tight text-indigo-600">
              Aidvisora<span className="text-slate-800">.</span>
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Duben 2026</span>
          </div>
          <div className="p-8 font-inter text-[15px] leading-relaxed text-slate-700">
            <h2 className="mb-5 font-jakarta text-2xl font-extrabold leading-tight text-[#0B1021]">Novinky ze světa financí: Co se děje na trzích?</h2>
            <p className="mb-4">Dobrý den, Jan,</p>
            <p className="mb-8">
              přináším vám pravidelný přehled toho nejdůležitějšího, co se událo na trzích a co by mohlo mít pozitivní vliv na vaše
              portfolio.
            </p>
            <div className="mb-8 rounded-2xl border border-indigo-100 bg-indigo-50/80 p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                <TrendingUp size={20} />
              </div>
              <h4 className="mb-2 font-jakarta text-lg font-bold text-indigo-900">Trhy v tomto měsíci rostly</h4>
              <p className="text-sm leading-relaxed text-indigo-800/80">
                Index S&amp;P 500 dosáhl nových historických maxim především díky silným hospodářským výsledkům technologického sektoru a
                stabilizaci úrokových sazeb.
              </p>
            </div>
            <button
              type="button"
              className="w-full rounded-xl bg-[#0B1021] px-6 py-3.5 text-center text-sm font-jakarta font-bold text-white shadow-md transition-colors hover:bg-slate-800 sm:w-auto"
            >
              Přečíst celý článek
            </button>
            <div className="mt-10 border-t border-slate-100 pt-6 text-xs text-slate-400">
              <p>Odesláno prostřednictvím platformy Aidvisora.</p>
              <p className="mt-1">
                <a href="#" className="underline hover:text-slate-600">
                  Odhlásit se z odběru
                </a>
              </p>
            </div>
          </div>
        </div>
      );
    case "birthday":
      return (
        <div className="mx-auto max-w-[600px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="relative overflow-hidden bg-gradient-to-br from-rose-400 to-pink-600 p-12 text-center text-white">
            <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
            <div className="relative z-10 mb-6 text-5xl drop-shadow-md">🎂</div>
            <h2 className="relative z-10 mb-2 font-jakarta text-3xl font-extrabold">Vše nejlepší, Jan!</h2>
            <p className="relative z-10 font-medium text-rose-100">Dnešek patří jenom vám</p>
          </div>
          <div className="p-8 font-inter text-[15px] leading-relaxed text-slate-700 md:p-10">
            <p className="mb-4">Krásný den, Jan,</p>
            <p>
              dovolte mi popřát vám všechno nejlepší k vašim dnešním narozeninám. Hlavně hodně zdraví, spokojenosti a ať se vám daří v
              osobním i pracovním životě.
            </p>
            <p className="mt-8 font-jakarta font-bold text-[#0B1021]">Marek Marek</p>
            <p className="text-sm text-slate-400">Váš finanční poradce</p>
          </div>
        </div>
      );
    case "meeting":
      return (
        <div className="mx-auto max-w-[600px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-t-8 border-emerald-500 p-8 md:p-10">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-600">
              <Calendar size={24} strokeWidth={2.5} />
            </div>
            <h2 className="mb-3 font-jakarta text-2xl font-extrabold leading-tight text-[#0B1021]">Čas na krátkou kontrolu vašich financí?</h2>
            <p className="mb-8 text-sm font-bold uppercase tracking-widest text-emerald-600">Pozvánka na schůzku</p>
            <div className="space-y-4 font-inter text-[15px] leading-relaxed text-slate-700">
              <p>Dobrý den, Jan,</p>
              <p>
                rád bych si s vámi domluvil krátkou schůzku, kde si společně projdeme aktuální stav vaší smluvní dokumentace, případné
                změny a oblasti, které byste vy sám chtěl probrat.
              </p>
              <div className="my-6 rounded-xl border border-slate-100 bg-slate-50 p-5">
                <p className="mb-3 text-sm font-medium text-slate-600">
                  Vyberte si termín, který vám nejvíce vyhovuje, přímo v mém kalendáři:
                </p>
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-jakarta font-bold text-white transition-colors hover:bg-emerald-600"
                >
                  <ExternalLink size={16} /> Vybrat termín online
                </button>
              </div>
              <p>Budu se těšit na setkání.</p>
            </div>
          </div>
        </div>
      );
    default:
      return (
        <div className="mx-auto min-h-[300px] max-w-[600px] rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="whitespace-pre-wrap font-inter text-[15px] leading-relaxed text-slate-700">{formData.bodyText}</div>
        </div>
      );
  }
}

export function EmailCampaignDemo() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<TemplateId>("newsletter");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [editorMode, setEditorMode] = useState<"visual" | "html">("visual");
  const [formData, setFormData] = useState<CampaignFormData>(TEMPLATE_CONTENT.newsletter);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const handleTemplateChange = (id: TemplateId) => {
    setActiveTemplate(id);
    if (TEMPLATE_CONTENT[id]) {
      setFormData({ ...TEMPLATE_CONTENT[id] });
    }
  };

  return (
    <LandingProductFrame label="E-mailové kampaně · editor a náhled" status="MVP" statusTone="emerald">
      <LandingMockCanvas className="bg-[#F4F6FB]">
        <div
          className="relative w-full min-h-0"
          style={{ height: LANDING_MOCK_CANVAS_HEIGHT }}
        >
          <div
            className={`custom-dots absolute inset-0 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-y-contain bg-[#F4F6FB] pb-24 font-inter text-slate-800 transition-opacity duration-1000 ${
              isLoaded ? "opacity-100" : "opacity-0"
            }`}
          >
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
            .segmented-control {
              background: #F1F5F9;
              padding: 4px;
              border-radius: 12px;
              display: flex;
              position: relative;
            }
            .segmented-btn {
              position: relative;
              z-index: 10;
              padding: 6px 16px;
              border-radius: 8px;
              font-weight: 700;
              font-size: 12px;
              font-family: var(--font-jakarta), var(--font-primary), sans-serif;
              transition: color 0.3s ease;
            }
            .segmented-btn.active { color: #0B1021; }
            .segmented-btn.inactive { color: #64748B; }
            .segmented-bg {
              position: absolute;
              top: 4px;
              bottom: 4px;
              left: 4px;
              width: 76px;
              background: white;
              border-radius: 8px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
              transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
              z-index: 1;
            }
          `}</style>

          <div className="mx-auto max-w-[1600px] space-y-8 px-6 pb-16 pt-8 lg:px-10">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h1 className="flex items-center gap-3 font-jakarta text-[32px] font-extrabold tracking-tight text-[#0B1021]">
                  <Mail className="text-[#5A4BFF]" size={32} /> E-mailové kampaně
                </h1>
                <p className="mt-1 font-medium text-slate-500">Hromadné a personalizované oslovení vašich klientů.</p>
              </div>
              <button
                type="button"
                className="flex w-max items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-jakarta font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
              >
                Zdroje obsahu <ArrowRight size={16} />
              </button>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-amber-200/60 bg-amber-50 p-4 shadow-sm">
              <Info className="mt-0.5 shrink-0 text-amber-500" size={18} />
              <p className="text-sm font-medium text-amber-800">
                <strong>MVP fáze:</strong> Základní rozesílka s personalizací je funkční. Pokročilé sledování otevření a proklik zatím není
                k dispozici.
              </p>
            </div>

            <div>
              <h3 className="mb-4 text-[11px] font-jakarta font-extrabold uppercase tracking-[0.15em] text-slate-400">Rychlý výběr šablony</h3>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {TEMPLATES.map((tpl) => {
                  const Icon = tpl.icon;
                  return (
                    <div
                      key={tpl.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleTemplateChange(tpl.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") handleTemplateChange(tpl.id);
                      }}
                      className={`flex cursor-pointer flex-col items-start rounded-[20px] border-2 p-5 transition-all duration-300 ${
                        activeTemplate === tpl.id
                          ? "scale-[1.02] border-[#5A4BFF] bg-white shadow-[0_8px_24px_-8px_rgba(90,75,255,0.25)]"
                          : "border-transparent bg-white shadow-sm hover:border-slate-200 hover:shadow-md"
                      }`}
                    >
                      <div
                        className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${
                          activeTemplate === tpl.id ? "bg-indigo-50" : "bg-slate-50"
                        }`}
                      >
                        <Icon size={22} strokeWidth={2.5} className={tpl.iconColor} />
                      </div>
                      <h4
                        className={`mb-1 font-jakarta text-base font-bold transition-colors ${
                          activeTemplate === tpl.id ? "text-[#5A4BFF]" : "text-[#0B1021]"
                        }`}
                      >
                        {tpl.title}
                      </h4>
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">{tpl.subtitle}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 pt-4 lg:grid-cols-12">
              <div className="flex flex-col rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_4px_24px_-6px_rgba(15,23,42,0.03)] lg:col-span-7">
                <h2 className="mb-8 font-jakarta text-2xl font-extrabold text-[#0B1021]">Nastavení kampaně</h2>

                <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <label className="ml-1 mb-2 block text-[11px] font-jakarta font-extrabold uppercase tracking-widest text-slate-500">
                      Název (interní)
                    </label>
                    <input
                      type="text"
                      value={formData.internalName}
                      onChange={(e) => setFormData({ ...formData, internalName: e.target.value })}
                      className="w-full rounded-xl border border-transparent bg-[#F8FAFC] px-5 py-3.5 text-sm font-bold text-[#0B1021] outline-none transition-all hover:border-slate-200 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                    />
                  </div>
                  <div>
                    <label className="ml-1 mb-2 block text-[11px] font-jakarta font-extrabold uppercase tracking-widest text-slate-500">
                      Segment klientů
                    </label>
                    <select className="w-full cursor-pointer appearance-none rounded-xl border border-transparent bg-[#F8FAFC] px-5 py-3.5 text-sm font-bold text-[#0B1021] outline-none transition-all hover:border-slate-200 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50">
                      <option>{formData.segment}</option>
                      <option>Všichni klienti</option>
                      <option>VIP Klienti</option>
                    </select>
                  </div>
                </div>

                <div className="mb-8">
                  <label className="ml-1 mb-2 block text-[11px] font-jakarta font-extrabold uppercase tracking-widest text-slate-500">
                    Předmět e-mailu
                  </label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="Lákavý předmět..."
                    className="w-full rounded-xl border border-transparent bg-[#F8FAFC] px-5 py-4 text-base font-bold text-[#0B1021] outline-none transition-all hover:border-slate-200 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                  />
                </div>

                <div className="mb-3 flex items-center justify-between">
                  <label className="ml-1 block text-[11px] font-jakarta font-extrabold uppercase tracking-widest text-slate-500">
                    Tělo e-mailu
                  </label>
                  <div className="flex rounded-lg bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => setEditorMode("visual")}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-jakarta font-bold transition-all ${
                        editorMode === "visual" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <LayoutTemplate size={14} /> Vizuálně
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorMode("html")}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-jakarta font-bold transition-all ${
                        editorMode === "html" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <Code size={14} /> HTML
                    </button>
                  </div>
                </div>

                <div className="mb-8 flex min-h-[320px] flex-col overflow-hidden rounded-[20px] border border-slate-200 shadow-sm transition-all focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-50">
                  <div className="hide-scroll flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50/80 px-3 py-2">
                    <button type="button" className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-600">
                      <Bold size={16} />
                    </button>
                    <button type="button" className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-600">
                      <Italic size={16} />
                    </button>
                    <div className="mx-2 h-5 w-px bg-slate-200" />
                    <button type="button" className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-600">
                      <List size={16} />
                    </button>
                    <button type="button" className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-600">
                      <ListOrdered size={16} />
                    </button>
                    <div className="mx-2 h-5 w-px bg-slate-200" />
                    <button type="button" className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-600">
                      <Link2 size={16} />
                    </button>
                    <button type="button" className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-600">
                      <ImageIcon size={16} />
                    </button>
                  </div>
                  <textarea
                    value={formData.bodyText}
                    onChange={(e) => setFormData({ ...formData, bodyText: e.target.value })}
                    className={`w-full flex-1 resize-none bg-white p-6 font-inter text-[15px] leading-relaxed text-slate-700 outline-none ${
                      editorMode === "html" ? "font-mono text-sm" : ""
                    }`}
                    placeholder="Začněte psát obsah..."
                  />
                </div>

                <div className="mb-10 rounded-2xl border border-slate-100 bg-slate-50 p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                    <span className="text-[11px] font-jakarta font-extrabold uppercase tracking-widest text-[#0B1021]">Proměnné</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 font-mono text-xs font-bold text-indigo-600 transition-all hover:border-indigo-300 hover:shadow-sm"
                      >
                        {"{{jmeno}}"}
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 font-mono text-xs font-bold text-indigo-600 transition-all hover:border-indigo-300 hover:shadow-sm"
                      >
                        {"{{cele_jmeno}}"}
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 font-mono text-xs font-bold text-slate-500 transition-all hover:border-slate-300 hover:text-slate-800"
                      >
                        {"{{odhlasit_url}}"}
                      </button>
                    </div>
                  </div>
                  <p className="flex items-start gap-2 text-xs font-medium text-slate-500">
                    <Info size={14} className="mt-0.5 shrink-0 text-slate-400" />
                    Kliknutím zkopírujete proměnnou a vložíte ji kamkoliv do textu. Při reálné rozesílce se tagy nahradí daty klienta.
                  </p>
                </div>

                <div className="mt-auto flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-6 lg:flex-row">
                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-6 py-3.5 text-sm font-jakarta font-bold text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 lg:w-auto"
                  >
                    <Save size={16} /> Koncept
                  </button>
                  <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-6 py-3.5 text-sm font-jakarta font-bold text-slate-700 transition-colors hover:bg-slate-200 sm:w-auto"
                    >
                      <Eye size={16} /> Poslat test
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B1021] px-8 py-3.5 text-sm font-jakarta font-extrabold text-white shadow-[0_8px_20px_-6px_rgba(0,0,0,0.4)] transition-all hover:-translate-y-0.5 hover:bg-black sm:w-auto"
                    >
                      <Send size={16} /> ODESLAT KAMPAŇ
                    </button>
                  </div>
                </div>
              </div>

              <div className="relative flex flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-slate-100/50 p-8 lg:col-span-5">
                <div className="pointer-events-none absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-indigo-500/5 blur-[80px]" />
                <div className="relative z-10 mb-8 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-jakarta font-extrabold text-[#0B1021]">Živý náhled</h3>
                  <div className="segmented-control w-[160px]">
                    <div
                      className="segmented-bg"
                      style={{ transform: previewMode === "mobile" ? "translateX(76px)" : "translateX(0)" }}
                    />
                    <button
                      type="button"
                      onClick={() => setPreviewMode("desktop")}
                      className={`segmented-btn flex flex-1 items-center justify-center gap-1.5 ${previewMode === "desktop" ? "active" : "inactive"}`}
                    >
                      <Monitor size={14} /> PC
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode("mobile")}
                      className={`segmented-btn flex flex-1 items-center justify-center gap-1.5 ${previewMode === "mobile" ? "active" : "inactive"}`}
                    >
                      <Smartphone size={14} /> Mobil
                    </button>
                  </div>
                </div>

                <div className="relative z-10 flex w-full flex-1 items-start justify-center">
                  <div
                    className={`flex w-full flex-col overflow-hidden bg-white shadow-[0_8px_30px_-12px_rgba(0,0,0,0.1)] transition-all duration-500 ${
                      previewMode === "mobile"
                        ? "h-[min(640px,70vh)] max-w-[360px] rounded-[2.5rem] border-[10px] border-slate-800"
                        : "min-h-[520px] max-w-full rounded-2xl border border-slate-200"
                    }`}
                  >
                    <div className="relative z-20 shrink-0 border-b border-slate-100 bg-white p-5">
                      <div className="mb-3 grid grid-cols-[50px_1fr] gap-y-2 text-sm">
                        <span className="font-semibold text-slate-400">Od:</span>
                        <span className="font-jakarta font-bold text-[#0B1021]">Marek Marek</span>
                        <span className="font-semibold text-slate-400">Komu:</span>
                        <span className="w-max rounded bg-slate-50 px-2 py-0.5 font-medium text-slate-600">jan.novak@email.cz</span>
                      </div>
                      <div className="flex flex-col gap-1 border-t border-slate-50 pt-3">
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Předmět</span>
                        <span
                          className={`text-[15px] font-jakarta font-bold ${formData.subject ? "text-[#0B1021]" : "text-slate-300 italic"}`}
                        >
                          {formData.subject || "Zadejte předmět..."}
                        </span>
                      </div>
                    </div>
                    <div className="custom-scrollbar relative z-10 flex-1 overflow-y-auto bg-slate-50/30 p-4 md:p-6">
                      <EmailPreviewContent activeTemplate={activeTemplate} formData={formData} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </LandingMockCanvas>
    </LandingProductFrame>
  );
}

export default EmailCampaignDemo;
