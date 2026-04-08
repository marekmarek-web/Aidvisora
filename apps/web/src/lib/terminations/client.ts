/**
 * Pouze pro "use client" komponenty.
 * Neimportovat z `@/lib/terminations` (index) — ten re-exportuje catalog/rules-engine s `server-only` a DB.
 */
export { modeToReasonCode } from "./mode-to-reason-code";
export {
  terminationDeliveryChannelLabel,
  terminationDispatchStatusLabel,
} from "./termination-delivery-labels";
