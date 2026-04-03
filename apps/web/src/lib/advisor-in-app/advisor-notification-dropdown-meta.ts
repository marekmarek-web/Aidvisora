import {
  CircleHelp,
  FileText,
  Home,
  Shield,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { parseClientPortalNotificationBody } from "@/lib/advisor-in-app/parse-client-portal-notification-body";
import { caseTypeToLabel } from "@/lib/client-portal/case-type-labels";

export type AdvisorNotificationDropdownAccent =
  | "blue"
  | "emerald"
  | "violet"
  | "amber"
  | "rose"
  | "slate";

export type AdvisorNotificationDropdownRow = {
  type: string;
  title: string;
  body: string | null;
};

function accentForCaseType(caseType: string): AdvisorNotificationDropdownAccent {
  const n = caseType?.toLowerCase().trim() ?? "";
  if (n.includes("hypot") || n === "úvěr") return "blue";
  if (n.includes("pojist")) return "emerald";
  if (n.includes("invest")) return "violet";
  if (n.includes("servis")) return "amber";
  if (n.includes("změna") || n.includes("situace")) return "rose";
  return "slate";
}

function iconForCaseType(caseType: string): LucideIcon {
  const n = caseType?.toLowerCase().trim() ?? "";
  if (n.includes("hypot") || n === "úvěr") return Home;
  if (n.includes("pojist")) return Shield;
  if (n.includes("invest")) return TrendingUp;
  if (n.includes("servis")) return FileText;
  if (n.includes("změna") || n.includes("situace")) return Users;
  return CircleHelp;
}

/** Extrahuje `preview` z JSON těla (client_material_response, trezor, domácnost). */
function jsonPreviewString(body: string | null): string {
  if (!body?.trim()) return "";
  try {
    const j = JSON.parse(body) as { preview?: unknown };
    return typeof j.preview === "string" ? j.preview.trim() : "";
  } catch {
    return "";
  }
}

function fallbackPreview(title: string, body: string | null): string {
  const fromJson = jsonPreviewString(body);
  if (fromJson) return fromJson;
  const t = title?.trim() ?? "";
  if (t) return t;
  return "Detail v portálu";
}

export function getAdvisorNotificationDropdownMeta(n: AdvisorNotificationDropdownRow): {
  accent: AdvisorNotificationDropdownAccent;
  Icon: LucideIcon;
  categoryLabel: string;
  preview: string;
} {
  const title = n.title?.trim() ?? "";

  if (n.type === "client_portal_request") {
    const { caseType, caseTypeLabel, preview } = parseClientPortalNotificationBody(n.body);
    const accent = accentForCaseType(caseType);
    const Icon = iconForCaseType(caseType);
    const categoryLabel = caseTypeLabel || caseTypeToLabel(caseType);
    return { accent, Icon, categoryLabel, preview: preview || title };
  }

  if (n.type === "client_material_response") {
    const preview = jsonPreviewString(n.body) || title;
    return {
      accent: "emerald",
      Icon: FileText,
      categoryLabel: "Odpověď na požadavek",
      preview,
    };
  }

  if (n.type === "client_trezor_upload") {
    const preview = jsonPreviewString(n.body) || title;
    return {
      accent: "violet",
      Icon: FileText,
      categoryLabel: "Nahrání do trezoru",
      preview,
    };
  }

  if (n.type === "client_household_update") {
    const preview = jsonPreviewString(n.body) || title;
    return {
      accent: "amber",
      Icon: Users,
      categoryLabel: "Úprava domácnosti",
      preview,
    };
  }

  return {
    accent: "slate",
    Icon: CircleHelp,
    categoryLabel: "Oznámení",
    preview: fallbackPreview(title, n.body),
  };
}
