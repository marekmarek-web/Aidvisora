import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/require-auth";
import "@/styles/monday.css";

export default async function BoardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await requireAuth();
  if (auth.roleName === "Client") {
    redirect("/client");
  }
  return <>{children}</>;
}
