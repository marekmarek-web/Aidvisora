import { redirect } from "next/navigation";
import { provisionWorkspaceIfNeeded } from "@/lib/auth/ensure-workspace";
import { finalizePendingStaffInvitation } from "@/app/actions/team";
import { RegisterCompleteError } from "./RegisterCompleteError";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function pickString(v: string | string[] | undefined): string | null {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return null;
}

export default async function RegisterCompletePage({ searchParams }: Props) {
  const params = await searchParams;
  const rawNext = params.next;
  const next = typeof rawNext === "string" && rawNext.startsWith("/") ? rawNext : null;

  const staffRaw = pickString(params.staff_invite);
  if (staffRaw?.trim()) {
    const fin = await finalizePendingStaffInvitation(staffRaw.trim().toLowerCase());
    if (fin.ok) {
      redirect(next ?? "/portal/today");
    }
    return <RegisterCompleteError message={fin.error} />;
  }

  const result = await provisionWorkspaceIfNeeded();
  if (result.ok) {
    redirect(next ?? result.redirectTo);
  }
  if (result.redirectTo) {
    redirect(result.redirectTo);
  }
  return <RegisterCompleteError message={result.error} />;
}
