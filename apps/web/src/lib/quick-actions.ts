/**
 * Katalog rychlých akcí pro tlačítko „+ Nový“ v headeru.
 * Jediný zdroj pravdy – sdílený mezi PortalShell a stránkou Nastavení.
 */
export type QuickActionId =
  | "new_task"
  | "new_meeting"
  | "new_contact"
  | "new_deal"
  | "calendar"
  | "mindmap"
  | "note"
  | "document"
  | "household";

export type QuickActionItem = {
  id: QuickActionId;
  label: string;
  href: string;
};

export const QUICK_ACTIONS_CATALOG: QuickActionItem[] = [
  { id: "new_task", label: "Nový úkol", href: "/portal/tasks#new-task-form" },
  { id: "new_meeting", label: "Nová schůzka", href: "/portal/calendar?new=1" },
  { id: "new_contact", label: "Nový kontakt", href: "/portal/contacts/new" },
  { id: "new_deal", label: "Nový obchod", href: "/portal/pipeline" },
  { id: "calendar", label: "Kalendář", href: "/portal/calendar" },
  { id: "mindmap", label: "Strategická mapa", href: "/portal/mindmap" },
  { id: "note", label: "Poznámka", href: "/portal/notes" },
  { id: "document", label: "Dokument", href: "/portal/contacts" },
  { id: "household", label: "Domácnost", href: "/portal/households" },
];

export const DEFAULT_QUICK_ACTIONS_ORDER: QuickActionId[] = QUICK_ACTIONS_CATALOG.map(
  (a) => a.id
);

export function getDefaultQuickActionsConfig(): {
  order: string[];
  visible: Record<string, boolean>;
} {
  const order = [...DEFAULT_QUICK_ACTIONS_ORDER];
  const visible: Record<string, boolean> = {};
  QUICK_ACTIONS_CATALOG.forEach((a) => {
    visible[a.id] = true;
  });
  return { order, visible };
}
