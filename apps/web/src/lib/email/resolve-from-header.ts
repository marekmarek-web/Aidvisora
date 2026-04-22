import "server-only";

import { advisorPreferences, eq, and } from "db";
import { withTenantContextFromAuth } from "@/lib/auth/with-auth-context";
import { getEffectiveBranding } from "@/lib/admin/branding-settings";

/**
 * Resolver hlavičky "From:" pro odchozí e-maily.
 *
 * Priorita:
 *  1) explicit `override` (např. `campaign.fromNameOverride`)
 *  2) `advisor_preferences.birthdaySignatureName` nebo jméno z user_profiles (per-advisor branding)
 *  3) `tenant_settings.branding.senderName` (workspace branding)
 *  4) `EMAIL_FROM` env / fallback "Aidvisora"
 *
 * Formát výsledku respektuje RFC 5322 display-name: `"Jan Novák" <noreply@aidvisora.cz>`.
 */
export async function resolveFromHeader(params: {
  tenantId: string;
  userId?: string | null;
  override?: string | null;
}): Promise<string> {
  const fromDefault = process.env.EMAIL_FROM ?? "Aidvisora <noreply@aidvisora.cz>";
  const fromAddress = extractAddress(fromDefault);

  const override = params.override?.trim();
  if (override) {
    return buildDisplay(override, fromAddress);
  }

  // advisor_preferences (per-user branding)
  if (params.userId) {
    try {
      const [pref] = await withTenantContextFromAuth(
        { tenantId: params.tenantId, userId: params.userId },
        (tx) =>
          tx
            .select({
              birthdaySignatureName: advisorPreferences.birthdaySignatureName,
            })
            .from(advisorPreferences)
            .where(
              and(
                eq(advisorPreferences.tenantId, params.tenantId),
                eq(advisorPreferences.userId, params.userId!),
              ),
            )
            .limit(1),
      );
      const advisorName = pref?.birthdaySignatureName?.trim();
      if (advisorName) {
        return buildDisplay(advisorName, fromAddress);
      }
    } catch {
      // fall through to tenant branding
    }
  }

  // tenant_settings branding.senderName
  try {
    const branding = await getEffectiveBranding(params.tenantId);
    if (branding.senderName?.trim()) {
      return buildDisplay(branding.senderName.trim(), fromAddress);
    }
  } catch {
    // fall through
  }

  return fromDefault;
}

function extractAddress(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return m ? m[1]! : from.trim();
}

function buildDisplay(name: string, address: string): string {
  const sanitized = name.replace(/"/g, "'").trim();
  return `"${sanitized}" <${address}>`;
}
