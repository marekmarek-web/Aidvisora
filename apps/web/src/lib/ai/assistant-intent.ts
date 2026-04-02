/**
 * Structured intent for CRM assistant (Zod + JSON Schema for OpenAI Responses API).
 */

import { z } from "zod";
import { nextTuesday } from "date-fns";
import { toZonedTime, formatInTimeZone } from "date-fns-tz";

export const ASSISTANT_INTENT_ACTIONS = [
  "create_opportunity",
  "create_followup_task",
  "dashboard_summary",
  "general_chat",
  "search_contacts",
] as const;

export type AssistantIntentAction = (typeof ASSISTANT_INTENT_ACTIONS)[number];

export const assistantIntentSchema = z.object({
  actions: z.array(z.enum(ASSISTANT_INTENT_ACTIONS)).default(["general_chat"]),
  switchClient: z.boolean().optional().default(false),
  clientRef: z.string().nullable().optional(),
  amount: z.number().nullable().optional(),
  ltv: z.number().nullable().optional(),
  purpose: z.string().nullable().optional(),
  bank: z.string().nullable().optional(),
  rateGuess: z.number().nullable().optional(),
  noEmail: z.boolean().optional().default(false),
  dueDateText: z.string().nullable().optional(),
});

export type AssistantIntent = z.infer<typeof assistantIntentSchema>;

/** JSON Schema for OpenAI responses.create structured output. */
export const ASSISTANT_INTENT_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    actions: {
      type: "array",
      items: {
        type: "string",
        enum: [...ASSISTANT_INTENT_ACTIONS],
      },
    },
    switchClient: { type: "boolean" },
    clientRef: { type: ["string", "null"] },
    amount: { type: ["number", "null"] },
    ltv: { type: ["number", "null"] },
    purpose: { type: ["string", "null"] },
    bank: { type: ["string", "null"] },
    rateGuess: { type: ["number", "null"] },
    noEmail: { type: "boolean" },
    dueDateText: { type: ["string", "null"] },
  },
  required: [
    "actions",
    "switchClient",
    "clientRef",
    "amount",
    "ltv",
    "purpose",
    "bank",
    "rateGuess",
    "noEmail",
    "dueDateText",
  ],
};

const PRAGUE = "Europe/Prague";

export function computeNextTuesdayDatePrague(ref: Date = new Date()): string {
  const z = toZonedTime(ref, PRAGUE);
  const nt = nextTuesday(z);
  return formatInTimeZone(nt, PRAGUE, "yyyy-MM-dd");
}

export function heuristicIntentFlags(message: string): { switchClient: boolean; noEmail: boolean } {
  const lower = message.toLowerCase();
  const switchClient =
    /\bpřepni\s+klienta\b/u.test(message) ||
    /\bpřepnout\s+klienta\b/u.test(lower) ||
    /\bswitch\s+client\b/u.test(lower);
  const noEmail =
    /\bemail\s+neřeš/u.test(lower) ||
    /\bneřeš(uji)?\s+email/u.test(lower) ||
    /\bžádný\s+email/u.test(lower) ||
    /\bbez\s+emailu/u.test(lower);
  return { switchClient, noEmail };
}

export function coerceAssistantIntent(raw: unknown): AssistantIntent {
  const parsed = assistantIntentSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return {
    actions: ["general_chat"],
    switchClient: false,
    clientRef: null,
    amount: null,
    ltv: null,
    purpose: null,
    bank: null,
    rateGuess: null,
    noEmail: false,
    dueDateText: null,
  };
}

export function intentWantsCrmWrites(intent: AssistantIntent): boolean {
  return (
    intent.actions.includes("create_opportunity") || intent.actions.includes("create_followup_task")
  );
}

export function intentWantsDashboard(intent: AssistantIntent): boolean {
  return intent.actions.includes("dashboard_summary");
}
