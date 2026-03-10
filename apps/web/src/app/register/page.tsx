import { redirect } from "next/navigation";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** /register nikdy neobsluhujeme – vždy přesměrovat na úvodní stránku (nový design, ?register=1&token=…). */
export default async function RegisterPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = new URLSearchParams();
  q.set("register", "1");
  if (params?.token && typeof params.token === "string") q.set("token", params.token);
  redirect("/?" + q.toString());
}
