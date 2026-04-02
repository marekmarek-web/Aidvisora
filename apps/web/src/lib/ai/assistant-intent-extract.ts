import { createResponseStructured } from "@/lib/openai";
import {
  ASSISTANT_INTENT_JSON_SCHEMA,
  coerceAssistantIntent,
  heuristicIntentFlags,
  type AssistantIntent,
} from "./assistant-intent";

const INTENT_SYSTEM = `Jsi extraktor strukturovaného záměru pro interního asistenta poradce v CRM Aidvisora.
Vrať JSON přesně podle schématu.

Pravidla:
- switchClient nastav na true jen pokud uživatel explicitně chce pracovat s jiným klientem než dosud (např. „přepni klienta“, „jiný klient“).
- noEmail nastav na true pokud uživatel řekne že email neřeší / neposílat email / bez emailu.
- actions: přidej create_opportunity pokud má vzniknout obchod (případ, pipeline, hypotéka) a create_followup_task pokud má vzniknout úkol nebo follow-up s termínem.
- clientRef: celé jméno nebo část jména klienta ze zprávy, pokud je uvedeno.
- amount: částka v Kč jako číslo (např. 4000000).
- ltv: číslo 0–100.
- bank: zkratka nebo název banky (např. ČS, Česká spořitelna).
- rateGuess: úroková sazba jako desetinné číslo (např. 4.99).
- purpose: stručně účel (koupě, rekonstrukce) pokud je v textu.
- dueDateText: pokud uživatel zmiňuje relativní termín (příští úterý), zkopíruj krátký fragment textu.`;

function fallbackIntentFromHeuristics(
  message: string,
  flags: { switchClient: boolean; noEmail: boolean },
): AssistantIntent {
  const lower = message.toLowerCase();
  const wantsMortgageFlow =
    (/hypoték|obchod|pipeline|případ|opportunit/i.test(message) || /vytvoř|založ|zaeviduj/i.test(lower)) &&
    (/follow|úkol|follow-up|příští\s+úter/i.test(lower) || /follow-up/i.test(message));
  const nameMatch = message.match(
    /([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+)\s+([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+)/u,
  );
  const amountMatch = message.match(/(\d[\d\s]*)\s*(?:000|Kč|kč)/);
  const ltvMatch = message.match(/ltv\s*(\d{1,3})\s*%?/i);
  const rateMatch = message.match(/(\d+[.,]\d+)\s*%/);
  const bankMatch = message.match(/\b(ČS|ČSOB|KB|MONETA|UniCredit|Air\s*Bank)\b/i);

  let amount: number | null = null;
  if (amountMatch) {
    const digits = amountMatch[1].replace(/\s/g, "");
    amount = parseInt(digits, 10);
    if (/000/.test(message) && amount < 1000) amount = amount * 1000;
  }

  return {
    actions: wantsMortgageFlow ? ["create_opportunity", "create_followup_task", "general_chat"] : ["general_chat"],
    switchClient: flags.switchClient,
    clientRef: nameMatch ? `${nameMatch[1]} ${nameMatch[2]}` : null,
    amount,
    ltv: ltvMatch ? parseInt(ltvMatch[1], 10) : null,
    purpose: /koupě|rekonstrukce|byt/i.test(message) ? "koupě bytu + rekonstrukce" : null,
    bank: bankMatch ? bankMatch[1].replace(/\s+/g, " ") : null,
    rateGuess: rateMatch ? parseFloat(rateMatch[1].replace(",", ".")) : null,
    noEmail: flags.noEmail,
    dueDateText: /příští\s+úter/i.test(message) ? "příští úterý" : null,
  };
}

export async function extractAssistantIntent(message: string): Promise<AssistantIntent> {
  const flags = heuristicIntentFlags(message);
  try {
    const { parsed } = await createResponseStructured<Record<string, unknown>>(
      `${INTENT_SYSTEM}\n\nZpráva uživatele:\n${message}`,
      ASSISTANT_INTENT_JSON_SCHEMA,
      { schemaName: "assistant_intent", store: false },
    );
    const base = coerceAssistantIntent(parsed);
    return {
      ...base,
      switchClient: Boolean(base.switchClient || flags.switchClient),
      noEmail: Boolean(base.noEmail || flags.noEmail),
    };
  } catch {
    return fallbackIntentFromHeuristics(message, flags);
  }
}

