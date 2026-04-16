"use client";

import { useState, useTransition } from "react";
import { Sparkles, RefreshCw, Loader2, CheckCircle2, AlertTriangle, TrendingUp, ClipboardList, HelpCircle, Plus } from "lucide-react";
import {
  generateClientSummaryAction,
  getLatestClientGenerations,
  type ClientGenerationItem,
} from "@/app/actions/ai-generations";
import { createTask } from "@/app/actions/tasks";
import { AdvisorAiOutputNotice } from "@/app/components/ai/AdvisorAiOutputNotice";
import { useRouter } from "next/navigation";

/** Parsuje AI výstup do strukturovaných sekcí. */
function parseSummaryText(text: string): Record<string, string[]> {
  const sections: Record<string, string[]> = {
    "Co klient má": [],
    "Co je důležité": [],
    "Co chybí": [],
    "Doporučený další krok": [],
    "Chybějící data": [],
  };

  // Hledáme sekce podle klíčových slov — flexibilní matching
  const SECTION_PATTERNS: Array<{ key: keyof typeof sections; patterns: RegExp[] }> = [
    {
      key: "Co klient má",
      patterns: [/co\s+klient\s+m[áa]/i, /sjednan[éye]/i, /portfolio/i, /produkty/i, /smlouvy/i],
    },
    {
      key: "Co je důležité",
      patterns: [/d[uů]le[žz]it[éey]/i, /upozorn[eě]n[íi]/i, /pozor/i, /riziko/i, /termín/i],
    },
    {
      key: "Co chybí",
      patterns: [/chyb[íi]/i, /mezery/i, /nen[íi]\s+pokry/i, /absence/i, /schází/i, /nezji[šs]t[ěe]/i],
    },
    {
      key: "Doporučený další krok",
      patterns: [/dal[šs][íi]\s+krok/i, /doporu[čc]en[ýy]/i, /doporu[čc][íi]me/i, /n[áa]vrh/i, /akce/i, /schůzka/i],
    },
    {
      key: "Chybějící data",
      patterns: [/chyb[ěe]j[íi]c[íi]\s+data/i, /neznámé/i, /neúplné/i, /doplnit/i],
    },
  ];

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let currentSection: keyof typeof sections | null = null;

  for (const line of lines) {
    // Detekuj nadpis sekce
    const foundSection = SECTION_PATTERNS.find(({ patterns }) =>
      patterns.some((p) => p.test(line))
    );

    if (foundSection && (line.length < 60 || line.endsWith(":"))) {
      currentSection = foundSection.key;
      continue;
    }

    // Čistíme bullet prefix
    const cleaned = line.replace(/^[-•*·]\s*/, "").replace(/^\d+\.\s*/, "").trim();
    if (!cleaned) continue;

    if (currentSection) {
      sections[currentSection].push(cleaned);
    } else {
      // Fallback: přiřadíme podle obsahu
      const match = SECTION_PATTERNS.find(({ patterns }) => patterns.some((p) => p.test(cleaned)));
      if (match) {
        sections[match.key].push(cleaned);
      } else {
        // Před první sekcí = Co klient má
        sections["Co klient má"].push(cleaned);
      }
    }
  }

  return sections;
}

type SectionConfig = {
  key: string;
  icon: React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean | "true" }>;
  iconClass: string;
  labelClass: string;
  bulletClass: string;
};

const SECTION_CONFIG: SectionConfig[] = [
  {
    key: "Co klient má",
    icon: CheckCircle2,
    iconClass: "text-emerald-500",
    labelClass: "text-emerald-700 dark:text-emerald-400",
    bulletClass: "bg-emerald-500",
  },
  {
    key: "Co je důležité",
    icon: AlertTriangle,
    iconClass: "text-amber-500",
    labelClass: "text-amber-700 dark:text-amber-400",
    bulletClass: "bg-amber-500",
  },
  {
    key: "Co chybí",
    icon: TrendingUp,
    iconClass: "text-rose-400",
    labelClass: "text-rose-700 dark:text-rose-400",
    bulletClass: "bg-rose-400",
  },
  {
    key: "Doporučený další krok",
    icon: ClipboardList,
    iconClass: "text-indigo-500",
    labelClass: "text-indigo-700 dark:text-indigo-400",
    bulletClass: "bg-indigo-500",
  },
  {
    key: "Chybějící data",
    icon: HelpCircle,
    iconClass: "text-[color:var(--wp-text-muted)]",
    labelClass: "text-[color:var(--wp-text-tertiary)]",
    bulletClass: "bg-[color:var(--wp-text-muted)]",
  },
];

function StructuredSummary({
  sections,
  contactId,
  nextStep,
}: {
  sections: Record<string, string[]>;
  contactId: string;
  nextStep: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [taskCreated, setTaskCreated] = useState(false);

  function handleCreateTask() {
    if (!nextStep) return;
    startTransition(async () => {
      try {
        await createTask({
          title: nextStep.slice(0, 120),
          contactId,
          description: `Automaticky vytvořeno z AI shrnutí: ${nextStep}`,
        });
        setTaskCreated(true);
        router.refresh();
      } catch {
        // silent — task creation failure non-blocking
      }
    });
  }

  const hasSomeContent = Object.values(sections).some((v) => v.length > 0);

  if (!hasSomeContent) return null;

  return (
    <div className="space-y-3">
      {SECTION_CONFIG.map(({ key, icon: Icon, iconClass, labelClass, bulletClass }) => {
        const items = sections[key];
        if (!items?.length) return null;
        return (
          <div key={key} className="flex gap-3">
            <span className="mt-0.5 shrink-0">
              <Icon size={14} className={iconClass} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-[11px] font-black uppercase tracking-widest mb-1 ${labelClass}`}>{key}</p>
              <ul className="space-y-1">
                {items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[color:var(--wp-text-secondary)]">
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${bulletClass} opacity-60`} aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}

      {nextStep && (
        <div className="pt-2 border-t border-[color:var(--wp-surface-card-border)]/60">
          {taskCreated ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-bold">
              <CheckCircle2 size={13} aria-hidden />
              Úkol vytvořen
            </span>
          ) : (
            <button
              type="button"
              onClick={handleCreateTask}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors disabled:opacity-50 min-h-[36px]"
            >
              {isPending ? (
                <Loader2 size={12} className="animate-spin" aria-hidden />
              ) : (
                <Plus size={12} aria-hidden />
              )}
              Vytvořit úkol z doporučeného kroku
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function AiClientSummaryBlock({
  contactId,
  initialSummary,
}: {
  contactId: string;
  initialSummary: ClientGenerationItem | null;
}) {
  const [output, setOutput] = useState<ClientGenerationItem | null>(initialSummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const result = await generateClientSummaryAction(contactId);
      if (result.ok) {
        const latest = await getLatestClientGenerations(contactId);
        setOutput(latest.clientSummary);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Nepodařilo se vygenerovat shrnutí.");
    } finally {
      setLoading(false);
    }
  }

  const parsedSections = output?.outputText ? parseSummaryText(output.outputText) : null;
  const nextStep = parsedSections?.["Doporučený další krok"]?.[0] ?? null;

  return (
    <div className="bg-[color:var(--wp-surface-card)] rounded-[24px] border border-[color:var(--wp-surface-card-border)] shadow-sm overflow-hidden">
      <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-[color:var(--wp-surface-card-border)]/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-100 shrink-0">
            <Sparkles size={16} className="text-indigo-600" aria-hidden />
          </div>
          <h2 className="text-base font-black text-[color:var(--wp-text)]">AI shrnutí klienta</h2>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-[color:var(--wp-surface-card-border)] text-[color:var(--wp-text-secondary)] hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-colors disabled:opacity-50 min-h-[36px]"
        >
          {loading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
          {loading ? "Generuji…" : output ? "Přegenerovat" : "Vygenerovat"}
        </button>
      </div>
      <div className="p-5 sm:p-6">
        <AdvisorAiOutputNotice className="mb-4" variant="compact" />
        {error && (
          <p className="text-xs text-rose-600 mb-3" role="alert">
            {error}
          </p>
        )}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-[color:var(--wp-text-tertiary)]">
            <Loader2 size={14} className="animate-spin" aria-hidden />
            <span>Generuji shrnutí…</span>
          </div>
        )}
        {!loading && parsedSections && (
          <StructuredSummary
            sections={parsedSections}
            contactId={contactId}
            nextStep={nextStep}
          />
        )}
        {!loading && !output && (
          <p className="text-xs text-[color:var(--wp-text-tertiary)] italic">
            Klikněte na Vygenerovat pro interní shrnutí — co klient má, co je důležité, co chybí a doporučený další krok.
          </p>
        )}
      </div>
    </div>
  );
}
