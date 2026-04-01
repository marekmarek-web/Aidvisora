import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseKey } from "@/lib/supabase/get-public-supabase-key";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    getPublicSupabaseKey()
  );
}
