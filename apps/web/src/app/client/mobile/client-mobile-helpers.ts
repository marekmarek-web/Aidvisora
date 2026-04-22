/**
 * B3.4 — Prvn\u00ed kroky rozbit\u00ed monolitick\u00e9ho `ClientMobileClient.tsx` (PHASE4
 * doporu\u010den\u00ed). Tady \u017eij\u00ed \u010dist\u00e9 helper funkce — form\u00e1tov\u00e1n\u00ed, routing
 * rozlou\u010den\u00ed, grouping zpr\u00e1v a tab resolution — aby byly snadno
 * testovateln\u00e9 bez renderu React stromu.
 *
 * Z\u00e1mysl: postupn\u011b sem p\u0159esouvat dal\u0161\u00ed \u010d\u00e1sti (Dashboard/Portfolio screens)
 * v n\u00e1sleduj\u00edc\u00edch refactoringov\u00fdch kolech. Tato zm\u011bna je zp\u011btn\u011b
 * kompatibiln\u00ed — API helperu = p\u016fvodn\u00ed chov\u00e1n\u00ed.
 */

import {
  Bell,
  Calendar,
  CheckCircle2,
  ClipboardList,
  FileText,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import { getPortalNotificationDeepLinkWithFallback } from "@/lib/client-portal/portal-notification-routing";

export type MobileTabId = "home" | "messages" | "documents" | "requests" | "menu";

/** Form\u00e1tuje \u010c\u00e1stku v CZK do lok\u00e1ln\u00edho form\u00e1tu. */
export function fmtMoney(v: number): string {
  return `${v.toLocaleString("cs-CZ")} K\u010d`;
}

/** P\u0159eklad stavu po\u017eadavku na t\u00f3n badge. */
export function materialRequestStatusTone(status: string): "success" | "warning" | "info" {
  if (status === "done" || status === "closed") return "success";
  if (status === "needs_more") return "warning";
  return "info";
}

/**
 * Jedin\u00fd zdroj pravdy pro routing notifikac\u00ed v mobiln\u00edm shellu.
 * Sd\u00edl\u00ed funkci s desktopem — viz B1.11.
 */
export function notificationRouteResolved(n: {
  type: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
}) {
  return getPortalNotificationDeepLinkWithFallback(n);
}

/** Mapov\u00e1n\u00ed typu notifikace na ikonu. */
export function notificationIcon(type: string): LucideIcon {
  if (type === "new_message") return MessageSquare;
  if (type === "new_document") return FileText;
  if (type === "advisor_material_request") return ClipboardList;
  if (type === "request_status_change") return CheckCircle2;
  if (type === "important_date") return Calendar;
  return Bell;
}

/** Uzensk\u00e1 lidsk\u00e1 reprezentace kalend\u00e1\u0159n\u00edho data pro header chat skupin. */
export function formatMessageDate(date: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Dnes";
  if (date.toDateString() === yesterday.toDateString()) return "V\u010dera";
  return date.toLocaleDateString("cs-CZ", { day: "numeric", month: "long" });
}

/**
 * Seskup\u00ed zpr\u00e1vy podle datov\u00e9 skupiny (Dnes/V\u010dera/konkr\u00e9tn\u00ed datum).
 * Genericky nad typem s `createdAt`, aby byl helper testovateln\u00fd a
 * znovupou\u017eiteln\u00fd (nepot\u0159ebuje MessageRow typ z actions).
 */
export function groupMessagesByDate<T extends { createdAt: string | Date }>(
  msgs: T[]
): Array<{ date: string; msgs: T[] }> {
  const groups: Array<{ date: string; msgs: T[] }> = [];
  let current: { date: string; msgs: T[] } | null = null;
  for (const msg of msgs) {
    const d = formatMessageDate(new Date(msg.createdAt));
    if (!current || current.date !== d) {
      current = { date: d, msgs: [] };
      groups.push(current);
    }
    current.msgs.push(msg);
  }
  return groups;
}

/** URL \u2192 aktivn\u00ed tab id v bottom navigaci. */
export function toTab(pathname: string): MobileTabId {
  if (pathname.startsWith("/client/messages")) return "messages";
  if (pathname.startsWith("/client/documents")) return "documents";
  if (pathname.startsWith("/client/requests")) return "requests";
  if (
    pathname.startsWith("/client/profile") ||
    pathname.startsWith("/client/notifications") ||
    pathname.startsWith("/client/portfolio") ||
    pathname.startsWith("/client/contracts") ||
    pathname.startsWith("/client/payments")
  ) {
    return "menu";
  }
  return pathname.startsWith("/client") ? "home" : "menu";
}
