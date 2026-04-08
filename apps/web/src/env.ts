import { z } from "zod";

/** Treat "" / whitespace as unset so optional keys do not fail Zod `.min()` in production / CI. */
function optionalStringMin(minLen: number) {
  return z.preprocess((val) => {
    if (val === undefined || val === null) return undefined;
    const s = String(val).trim();
    return s.length === 0 ? undefined : s;
  }, z.string().min(minLen).optional());
}

const optionalNonEmptyString = () => optionalStringMin(1);
const optionalCronSecret = () => optionalStringMin(8);

const serverSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    /** Legacy JWT anon; alternativa viz publishable klíče níže. */
    NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalStringMin(1),
    /** Nový klíč z Supabase dashboardu (často jen tento). */
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: optionalStringMin(1),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalStringMin(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OPENAI_API_KEY: optionalNonEmptyString(),
  CRON_SECRET: optionalCronSecret(),
  SENTRY_DSN: optionalNonEmptyString(),
  NEXT_PUBLIC_SENTRY_DSN: optionalNonEmptyString(),
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: optionalNonEmptyString(),
  /** Volitelné LLM observability (Langfuse cloud / self-hosted). */
  LANGFUSE_SECRET_KEY: optionalNonEmptyString(),
  LANGFUSE_PUBLIC_KEY: optionalNonEmptyString(),
  LANGFUSE_HOST: optionalNonEmptyString(),
  /** Vynutit prostředí v Langfuse (jinak VERCEL_ENV / NODE_ENV). */
  LANGFUSE_ENVIRONMENT: optionalNonEmptyString(),
  /** Nastav na `false` pro vypnutí odesílání i když jsou klíče v env. */
  LANGFUSE_ENABLED: z.enum(["true", "false", ""]).optional(),
  INTEGRATIONS_ENCRYPTION_KEY: optionalStringMin(16),
  RESEND_API_KEY: optionalNonEmptyString(),
  /** Odpovědi na tento e-mail (např. firemní poradce); From zůstane z ověřené domény. */
  RESEND_REPLY_TO: optionalStringMin(3),
  /** Doména pro generovaný From (např. aidvisora.cz); jinak se parsuje z RESEND_FROM_EMAIL. */
  RESEND_FROM_DOMAIN: optionalStringMin(3),
  GOOGLE_CLIENT_ID: optionalNonEmptyString(),
  GOOGLE_CLIENT_SECRET: optionalNonEmptyString(),
  NEXT_PUBLIC_SKIP_AUTH: z.enum(["true", "false", ""]).optional(),
  /** When "true", hides client portal AI help (nav-only chat). */
  NEXT_PUBLIC_DISABLE_CLIENT_PORTAL_AI: z.enum(["true", "false", ""]).optional(),
  })
  .superRefine((data, ctx) => {
    const hasPublicKey = Boolean(
      data.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
        data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    );
    if (!hasPublicKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Nastavte NEXT_PUBLIC_SUPABASE_ANON_KEY nebo NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY (Supabase → Project Settings → API).",
        path: ["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
      });
    }
  });

function validateEnv() {
  const result = serverSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.error(`[ENV] Missing or invalid environment variables:\n${formatted}`);
    if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
      throw new Error(`Invalid environment configuration:\n${formatted}`);
    }
  }
  return result.success ? result.data : (process.env as unknown as z.infer<typeof serverSchema>);
}

export const env = validateEnv();
