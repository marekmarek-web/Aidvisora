/**
 * Veřejný klíč pro Supabase v prohlížeči / SSR: klasický anon JWT (eyJ…)
 * nebo nový publishable klíč (sb_publishable_…) z dashboardu.
 */
export function getPublicSupabaseKey(): string {
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const publishableDefault = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim();
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  return anon || publishableDefault || publishable || "";
}
