import { redirect } from "next/navigation";
import { provisionWorkspaceIfNeeded } from "@/lib/auth/ensure-workspace";
import { RegisterCompleteError } from "./RegisterCompleteError";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function RegisterCompletePage({ searchParams }: Props) {
  const params = await searchParams;
  const rawNext = params.next;
  const next = typeof rawNext === "string" && rawNext.startsWith("/") ? rawNext : null;

  const result = await provisionWorkspaceIfNeeded();
  if (result.ok) {
    redirect(next ?? result.redirectTo);
  }
  if (result.redirectTo) {
    redirect(result.redirectTo);
  }
  return <RegisterCompleteError message={result.error} />;
}
