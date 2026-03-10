import { redirect } from "next/navigation";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** /login nikdy neobsluhujeme – vždy přesměrovat na úvodní stránku (nový design). */
export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = new URLSearchParams();
  if (params?.next && typeof params.next === "string") q.set("next", params.next);
  if (params?.error && typeof params.error === "string") q.set("error", params.error);
  redirect("/" + (q.toString() ? "?" + q.toString() : ""));
}
