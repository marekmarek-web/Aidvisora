"use client";

import { useState, useEffect } from "react";
import { seedDemoData } from "@/app/actions/seed-demo";
import { getQuickActionsConfig, setQuickActionsConfig } from "@/app/actions/preferences";
import {
  QUICK_ACTIONS_CATALOG,
  type QuickActionId,
} from "@/lib/quick-actions";
import { useToast } from "@/app/components/Toast";
import { ChevronUp, ChevronDown } from "lucide-react";

type IntegrationStatus = "connected" | "disconnected" | "coming_soon";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: IntegrationStatus;
  category: "calendar" | "ai" | "email" | "other";
  configFields?: { key: string; label: string; type: "text" | "password"; placeholder: string }[];
}

const INTEGRATIONS: Integration[] = [
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Synchronizujte schůzky a události z Aidvisora s Google Kalendářem. Obousměrná synchronizace.",
    icon: "📅",
    status: "disconnected",
    category: "calendar",
    configFields: [
      { key: "clientId", label: "Client ID", type: "text", placeholder: "Google OAuth Client ID" },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "Google OAuth Client Secret" },
    ],
  },
  {
    id: "openai-gpt",
    name: "OpenAI GPT Mini",
    description: "AI asistent pro sumarizaci schůzek, generování e-mailů a analýzu finančních dat klientů.",
    icon: "🤖",
    status: "disconnected",
    category: "ai",
    configFields: [
      { key: "apiKey", label: "API Key", type: "password", placeholder: "sk-..." },
      { key: "model", label: "Model", type: "text", placeholder: "gpt-4o-mini" },
    ],
  },
  {
    id: "resend",
    name: "Resend (E-mail)",
    description: "Odesílání transakčních a notifikačních e-mailů klientům. Servisní upozornění, platební instrukce.",
    icon: "✉️",
    status: "disconnected",
    category: "email",
    configFields: [
      { key: "apiKey", label: "API Key", type: "password", placeholder: "re_..." },
      { key: "fromEmail", label: "Odesílatel", type: "text", placeholder: "info@aidvisora.cz" },
    ],
  },
  {
    id: "smart-emailing",
    name: "SmartEmailing",
    description: "Hromadné e-mailové kampaně a newslettery pro vaše klienty. Automatizované sekvence.",
    icon: "📧",
    status: "coming_soon",
    category: "email",
  },
  {
    id: "google-sheets",
    name: "Google Sheets Export",
    description: "Automatický export dat do Google Sheets pro pokročilé reporty a analýzy.",
    icon: "📊",
    status: "coming_soon",
    category: "other",
  },
];

const STATUS_BADGES: Record<IntegrationStatus, { label: string; cls: string }> = {
  connected: { label: "Připojeno", cls: "bg-green-100 text-green-700" },
  disconnected: { label: "Odpojeno", cls: "bg-slate-100 text-slate-500" },
  coming_soon: { label: "Připravujeme", cls: "bg-blue-50 text-blue-500" },
};

export default function SetupPage() {
  const toast = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [configs, setConfigs] = useState<Record<string, Record<string, string>>>({});
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [quickOrder, setQuickOrder] = useState<QuickActionId[]>([]);
  const [quickVisible, setQuickVisible] = useState<Record<string, boolean>>({});
  const [quickLoading, setQuickLoading] = useState(true);
  const [quickSaving, setQuickSaving] = useState(false);

  useEffect(() => {
    getQuickActionsConfig().then((c) => {
      const catalogIds = QUICK_ACTIONS_CATALOG.map((a) => a.id);
      const order = (c.order.length ? c.order.filter((id) => catalogIds.includes(id as QuickActionId)) : [...catalogIds]) as QuickActionId[];
      const missing = catalogIds.filter((id) => !order.includes(id));
      setQuickOrder([...order, ...missing]);
      setQuickVisible(
        catalogIds.reduce<Record<string, boolean>>((acc, id) => {
          acc[id] = c.visible[id] !== false;
          return acc;
        }, {})
      );
      setQuickLoading(false);
    });
  }, []);

  function handleSave(integrationId: string) {
    toast.showToast("Konfigurace uložena");
  }

  return (
    <div className="wp-page wp-fade-in p-5 space-y-6 max-w-[900px] mx-auto">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--wp-text)" }}>Nastavení & Integrace</h1>
        <p className="text-sm mt-1" style={{ color: "var(--wp-text-muted)" }}>
          Propojte Aidvisora s externími službami. Konfigurace se ukládá zabezpečeně.
        </p>
      </div>

      {/* Jak to funguje – accordion */}
      <div className="wp-card overflow-hidden">
        <button
          type="button"
          onClick={() => setHowItWorksOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
          aria-expanded={howItWorksOpen}
        >
          <span className="font-semibold text-slate-700">Jak to funguje</span>
          <svg
            className={`w-5 h-5 text-slate-400 transition-transform shrink-0 ${howItWorksOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {howItWorksOpen && (
          <div className="border-t border-slate-100 px-5 py-4 bg-slate-50/50 text-sm text-slate-600 space-y-2">
            <p>Integrace propojují Aidvisora s kalendáři, e-maily a AI nástroji. Po vyplnění údajů (API klíče, OAuth) a uložení je služba připojena.</p>
            <p>Připojení a odpojení potvrzujte v kartě dané integrace. Konfigurace se ukládá šifrovaně na serveru.</p>
          </div>
        )}
      </div>

      {/* Demo data */}
      <div className="rounded-[var(--wp-radius-sm)] border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-amber-800 text-sm flex items-center gap-1.5">
              <span>🎲</span> Demo data
            </h3>
            <p className="text-xs text-amber-600 mt-0.5">
              Vložte ukázková data (kontakty, smlouvy, schůzky, úkoly, pipeline) pro testování.
            </p>
          </div>
          <button
            type="button"
            disabled={seedingDemo}
            onClick={async () => {
              setSeedingDemo(true);
              setSeedMsg("");
              try {
                const result = await seedDemoData();
                setSeedMsg(result.message);
              } catch (e) {
                setSeedMsg(e instanceof Error ? e.message : "Chyba");
              } finally {
                setSeedingDemo(false);
              }
            }}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-amber-800 bg-amber-200 hover:bg-amber-300 disabled:opacity-50"
          >
            {seedingDemo ? "Vkládám…" : "Vložit demo data"}
          </button>
        </div>
        {seedMsg && (
          <p className="text-xs text-amber-700 mt-2 bg-amber-100 rounded-[var(--wp-radius-sm)] px-3 py-2">{seedMsg}</p>
        )}
      </div>

      {/* Nastavení rychlého tlačítka */}
      <div className="wp-card overflow-hidden">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 px-5 pt-5 pb-2">
          Rychlé tlačítko „+ Nový“
        </h2>
        <p className="text-sm text-slate-600 px-5 pb-4">
          Vyberte položky a pořadí v menu „+ Nový“ v horní liště aplikace. Skryté položky se v menu nezobrazí.
        </p>
        {quickLoading ? (
          <div className="px-5 pb-5 text-sm text-slate-500">Načítám…</div>
        ) : (
          <div className="border-t border-slate-100 px-5 py-4 space-y-2">
            {quickOrder.map((id, index) => {
              const item = QUICK_ACTIONS_CATALOG.find((a) => a.id === id);
              if (!item) return null;
              const visible = quickVisible[id] !== false;
              return (
                <div
                  key={id}
                  className="flex items-center gap-3 py-2 min-h-[44px] rounded-[var(--wp-radius-sm)] hover:bg-slate-50 px-2 -mx-2"
                >
                  <div className="flex flex-col gap-0 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (index === 0) return;
                        const next = [...quickOrder];
                        [next[index - 1], next[index]] = [next[index], next[index - 1]];
                        setQuickOrder(next);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                      disabled={index === 0}
                      aria-label="Posunout nahoru"
                    >
                      <ChevronUp size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (index === quickOrder.length - 1) return;
                        const next = [...quickOrder];
                        [next[index], next[index + 1]] = [next[index + 1], next[index]];
                        setQuickOrder(next);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                      disabled={index === quickOrder.length - 1}
                      aria-label="Posunout dolů"
                    >
                      <ChevronDown size={18} />
                    </button>
                  </div>
                  <label className="flex-1 flex items-center gap-3 cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={(e) =>
                        setQuickVisible((prev) => ({ ...prev, [id]: e.target.checked }))
                      }
                      className="rounded border-slate-300 text-[var(--wp-accent)] focus:ring-[var(--wp-accent)]"
                    />
                    <span className="text-sm font-medium text-slate-700">{item.label}</span>
                  </label>
                </div>
              );
            })}
            <button
              type="button"
              disabled={quickSaving}
              onClick={async () => {
                setQuickSaving(true);
                try {
                  await setQuickActionsConfig(
                    quickOrder,
                    QUICK_ACTIONS_CATALOG.reduce<Record<string, boolean>>(
                      (acc, a) => {
                        acc[a.id] = quickVisible[a.id] !== false;
                        return acc;
                      },
                      {}
                    )
                  );
                  toast.showToast("Nastavení rychlého tlačítka uloženo");
                } catch (e) {
                  toast.showToast(e instanceof Error ? e.message : "Chyba při ukládání");
                } finally {
                  setQuickSaving(false);
                }
              }}
              className="wp-btn wp-btn-primary mt-4"
            >
              {quickSaving ? "Ukládám…" : "Uložit"}
            </button>
          </div>
        )}
      </div>

      {/* Categories */}
      {(["calendar", "ai", "email", "other"] as const).map((cat) => {
        const items = INTEGRATIONS.filter((i) => i.category === cat);
        if (items.length === 0) return null;
        const catLabels = {
          calendar: { label: "Kalendář", icon: "📅" },
          ai: { label: "AI & Asistenti", icon: "🤖" },
          email: { label: "E-mail & Komunikace", icon: "✉️" },
          other: { label: "Ostatní", icon: "🔌" },
        };
        const { label, icon } = catLabels[cat];
        return (
          <div key={cat}>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-3">
              <span>{icon}</span> {label}
            </h2>
            <div className="space-y-3">
              {items.map((integration) => {
                const expanded = expandedId === integration.id;
                const badge = STATUS_BADGES[integration.status];
                const config = configs[integration.id] ?? {};
                return (
                  <div
                    key={integration.id}
                    className="wp-card overflow-hidden"
                  >
                    <div
                      className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => setExpandedId(expanded ? null : integration.id)}
                    >
                      <span className="text-2xl">{integration.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-700">{integration.name}</span>
                          <span className={`wp-pill ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{integration.description}</p>
                      </div>
                      <svg
                        className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>

                    {expanded && (
                      <div className="border-t border-slate-100 px-5 py-4 bg-slate-50/50">
                        <p className="text-sm text-slate-600 mb-4">{integration.description}</p>
                        {integration.status === "coming_soon" ? (
                          <p className="text-sm text-blue-500 font-medium">
                            Tato integrace bude dostupná v příští verzi. Sledujte novinky.
                          </p>
                        ) : integration.configFields ? (
                          <div className="space-y-3">
                            {integration.configFields.map((field) => (
                              <div key={field.key}>
                                <label className="block text-xs font-medium text-slate-500 mb-1">{field.label}</label>
                                <input
                                  type={field.type}
                                  placeholder={field.placeholder}
                                  value={config[field.key] ?? ""}
                                  onChange={(e) =>
                                    setConfigs((prev) => ({
                                      ...prev,
                                      [integration.id]: { ...prev[integration.id], [field.key]: e.target.value },
                                    }))
                                  }
                                  className="wp-input w-full"
                                />
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => handleSave(integration.id)}
                              className="wp-btn wp-btn-primary mt-2"
                            >
                              Uložit konfiguraci
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
