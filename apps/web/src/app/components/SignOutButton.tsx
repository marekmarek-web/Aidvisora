"use client";

import { useRouter } from "next/navigation";
import { signOutAndRedirectClient } from "@/lib/auth/sign-out-client";

export function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    await signOutAndRedirectClient(router);
  }
  return (
    <button
      type="button"
      onClick={signOut}
      className="text-slate-500 hover:text-slate-700"
    >
      Odhlásit se
    </button>
  );
}
