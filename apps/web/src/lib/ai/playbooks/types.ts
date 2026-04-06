import type { ProductDomain, CanonicalIntent, CanonicalIntentType } from "../assistant-domain-model";

/**
 * 3G: Canonical playbook IDs.
 * `investice_dip_dps` was split into `investice` + `dip_dps` for per-domain guidance.
 * `material_request` covers create_material_request / create_client_request follow-up workflow.
 */
export type AssistantPlaybookId =
  | "hypo_uver"
  | "leasing"
  | "stavebni_sporeni"
  | "investice"
  | "dip_dps"
  | "zivotni_riziko"
  | "majetek_odpovednost_auto"
  | "firma_pojisteni"
  | "servis_vyroci"
  | "schuzka_ukol_zapis"
  | "material_request";

export type AssistantPlaybook = {
  id: AssistantPlaybookId;
  label: string;
  /** Heuristická detekce z textu + intentu */
  matches: (messageLower: string, intent: CanonicalIntent) => boolean;
  defaultProductDomain: ProductDomain | null;
  /** Doporučená pole k doplnění před provedením zápisu */
  priorityMissingHints: string[];
  /** Krátké návrhy dalších kroků (copy pro UI / odpověď) */
  nextStepSuggestions: string[];
  /** Deterministický bundle akcí pro případ, že uživatel popisuje nový případ bez explicitních kroků. */
  defaultRequestedActions?: CanonicalIntentType[];
  /**
   * 3G: Volitelný seznam intentů, pro které se tento playbook surfacuje přednostně.
   * Pokud je vyplněno, enricher surfacuje hints i pro tuto sadu intentů navíc
   * ke globálnímu PLAYBOOK_HINT_INTENTS setu.
   */
  supportedIntents?: CanonicalIntentType[];
};
