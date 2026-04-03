/**
 * Canonical registry of advisor in-app notification types.
 * Badge, Bell, Toast, and dropdown all use this single source of truth.
 */
export const ADVISOR_NOTIFICATION_TYPES = [
  "client_portal_request",
  "client_material_response",
  "client_trezor_upload",
  "client_household_update",
] as const;

export type AdvisorNotificationType = (typeof ADVISOR_NOTIFICATION_TYPES)[number];

export const ADVISOR_NOTIFICATION_TYPES_CSV = ADVISOR_NOTIFICATION_TYPES.join(",");
