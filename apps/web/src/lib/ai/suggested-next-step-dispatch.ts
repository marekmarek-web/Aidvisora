import type { SuggestedNextStepItem } from "./suggested-next-step-types";

/** Čistá logika kliknutí na strukturovaný doporučený krok (testovatelná bez Reactu). */
export function dispatchSuggestedNextStepItem(
  item: SuggestedNextStepItem,
  handlers: { onSend?: (msg: string) => void; onFocusComposer?: () => void },
): void {
  switch (item.kind) {
    case "send_message":
      handlers.onSend?.(item.label);
      return;
    case "focus_composer":
      handlers.onFocusComposer?.();
      return;
    case "hint":
      return;
  }
}
