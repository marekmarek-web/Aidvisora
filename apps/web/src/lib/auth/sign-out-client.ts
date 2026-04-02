"use client";

import { createClient } from "@/lib/supabase/client";
import { revokeStoredPushToken } from "@/lib/push/usePushNotifications";

/** Minimal router surface from `useRouter()` for post-sign-out navigation. */
export type SignOutRouter = {
  push: (href: string) => void;
  refresh: () => void;
};

/**
 * Ends Supabase session, revokes stored push token, then redirects home.
 * Single canonical path for advisor/client portal sign-out from client components.
 */
export async function signOutAndRedirectClient(router: SignOutRouter): Promise<void> {
  await revokeStoredPushToken();
  const supabase = createClient();
  await supabase.auth.signOut();
  router.push("/");
  router.refresh();
}
