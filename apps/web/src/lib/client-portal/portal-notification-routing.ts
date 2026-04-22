/**
 * Phase 5H — single deep-link map for portal notifications (web list, dashboard CTA, mobile).
 * Keep in sync with acceptance: bell / dashboard / notifications page must route identically.
 *
 * B1.7: Musí existovat bezpečný fallback — neznámý typ vede na seznam notifikací,
 * ne na `null` (nechce se, aby klik na notifikaci neudělal nic).
 */
export function getPortalNotificationDeepLink(
  n: { type?: string | null; relatedEntityId?: string | null } | null
): string | null {
  if (!n?.type) return null;
  if (n.type === "new_message") return "/client/messages";
  if (n.type === "new_document") return "/client/documents";
  if (n.type === "advisor_material_request") {
    return n.relatedEntityId
      ? `/client/pozadavky-poradce/${n.relatedEntityId}`
      : "/client/pozadavky-poradce";
  }
  if (n.type === "request_status_change") return "/client/requests";
  if (n.type === "important_date") return "/client/portfolio";
  if (n.type === "new_advisor_proposal" || n.type === "advisor_proposal") {
    return n.relatedEntityId ? `/client/navrhy/${n.relatedEntityId}` : "/client/navrhy";
  }
  if (n.type === "payment_reminder" || n.type === "payment_due") return "/client/payments";
  return null;
}

/**
 * Kompletní route s fallbackem — nikdy nevrací `null`. Použij v UI tam, kde se
 * uživatel dotkne notifikace a očekává se navigace. Pro neznámé typy otevře
 * stránku oznámení, nikoli dead click.
 */
export function getPortalNotificationDeepLinkWithFallback(
  n: { type?: string | null; relatedEntityId?: string | null } | null
): { route: string; known: boolean } {
  const route = getPortalNotificationDeepLink(n);
  if (route) return { route, known: true };
  return { route: "/client/notifications", known: false };
}
