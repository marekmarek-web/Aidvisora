/** Doporučený krok v asistentovi — rozlišuje odeslání zprávy vs. pouze UX akci. */
export type SuggestedNextStepItemKind = "send_message" | "focus_composer" | "hint";

export type SuggestedNextStepItem = {
  label: string;
  kind: SuggestedNextStepItemKind;
};
