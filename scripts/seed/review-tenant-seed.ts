/**
 * B1.8 — Reproducible App Store / Play Store review tenant seed.
 *
 * Zdroj pravdy: docs/launch/review-tenant-seed.md.
 *
 * Spuštění:
 *   DATABASE_URL=... \
 *   NEXT_PUBLIC_SUPABASE_URL=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   pnpm seed:review-tenant --i-know-what-i-do --tenant-domain=aidvisora.cz
 *
 * Guardrails:
 *   - vyžaduje flag `--i-know-what-i-do`
 *   - `--tenant-domain=aidvisora.cz` — zabraňuje spuštění proti foreign datům
 *   - při nepřítomnosti `SUPABASE_SERVICE_ROLE_KEY` skript skončí bez síťových
 *     hovorů (žádný "silent partial seed")
 *   - v `VERCEL_ENV=production` nebo `NODE_ENV=production` odmítá, pokud
 *     není dodaný `--allow-production` (dvojitá ochrana)
 *
 * Idempotence:
 *   Skript **nejprve smaže** existující review tenant (identifikovaný
 *   deterministickou slug `aidvisora-review`) včetně auth userů a všech
 *   navázaných řádků přes CASCADE. Pak vytvoří tenant znovu. Spuštění 2×
 *   za sebou vytvoří identický state.
 */

import { randomUUID } from "crypto";
import postgres from "postgres";

type Args = {
  knowWhatIDo: boolean;
  tenantDomain: string | null;
  allowProduction: boolean;
  reset: boolean;
  tenantName: string;
};

const REVIEW_SLUG = "aidvisora-review";
const REVIEW_ADVISOR_EMAIL = "review@aidvisora.cz";
const REVIEW_CLIENT_EMAIL = "review-klient@aidvisora.cz";
const DEMO_ADVISOR_EMAIL = "jan.novak.demo@aidvisora.cz";
const DEMO_MANAGER_EMAIL = "petr.svoboda.demo@aidvisora.cz";

function parseArgs(argv: string[]): Args {
  const args: Args = {
    knowWhatIDo: false,
    tenantDomain: null,
    allowProduction: false,
    reset: false,
    tenantName: "Aidvisora Demo s.r.o.",
  };
  for (const raw of argv.slice(2)) {
    if (raw === "--i-know-what-i-do") args.knowWhatIDo = true;
    else if (raw === "--allow-production") args.allowProduction = true;
    else if (raw === "--reset") args.reset = true;
    else if (raw.startsWith("--tenant-domain=")) args.tenantDomain = raw.slice("--tenant-domain=".length).trim();
    else if (raw.startsWith("--tenant-name=")) args.tenantName = raw.slice("--tenant-name=".length).trim();
  }
  return args;
}

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Chybí env proměnná ${name}.`);
  return v;
}

async function ensureSupabaseUser(
  supabaseUrl: string,
  serviceRoleKey: string,
  email: string,
  password: string,
  userMetadata: Record<string, unknown> = {},
): Promise<string> {
  // Idempotentní: pokud user existuje, vrátí existující id; jinak vytvoří.
  const base = supabaseUrl.replace(/\/$/, "");
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  } as const;

  // Nejprve zjistit, zda user existuje.
  const listUrl = `${base}/auth/v1/admin/users?filter=email.eq.${encodeURIComponent(email)}`;
  const listRes = await fetch(listUrl, { headers });
  if (!listRes.ok) throw new Error(`list users failed ${listRes.status}: ${await listRes.text()}`);
  const listJson = (await listRes.json()) as { users?: Array<{ id: string; email?: string }> };
  const existing = listJson.users?.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
  if (existing?.id) {
    // Reset hesla + metadata (idempotence).
    const updateUrl = `${base}/auth/v1/admin/users/${existing.id}`;
    const updateRes = await fetch(updateUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify({ password, user_metadata: userMetadata, email_confirm: true }),
    });
    if (!updateRes.ok) throw new Error(`update user ${email} failed: ${await updateRes.text()}`);
    return existing.id;
  }

  const createUrl = `${base}/auth/v1/admin/users`;
  const createRes = await fetch(createUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
    }),
  });
  if (!createRes.ok) throw new Error(`create user ${email} failed: ${await createRes.text()}`);
  const created = (await createRes.json()) as { id: string };
  return created.id;
}

async function deleteSupabaseUserByEmail(
  supabaseUrl: string,
  serviceRoleKey: string,
  email: string,
): Promise<void> {
  const base = supabaseUrl.replace(/\/$/, "");
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  } as const;
  const listUrl = `${base}/auth/v1/admin/users?filter=email.eq.${encodeURIComponent(email)}`;
  const listRes = await fetch(listUrl, { headers });
  if (!listRes.ok) return;
  const listJson = (await listRes.json()) as { users?: Array<{ id: string; email?: string }> };
  const existing = listJson.users?.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
  if (!existing?.id) return;
  await fetch(`${base}/auth/v1/admin/users/${existing.id}`, { method: "DELETE", headers });
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.knowWhatIDo) {
    console.error("refuse: spuštění vyžaduje --i-know-what-i-do");
    process.exit(2);
  }
  if (args.tenantDomain !== "aidvisora.cz") {
    console.error("refuse: --tenant-domain musí být 'aidvisora.cz'");
    process.exit(2);
  }
  const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  if (isProd && !args.allowProduction) {
    console.error("refuse: produkční prostředí detekováno; doplň --allow-production pokud vědomě seeduješ review tenant proti produkci");
    process.exit(2);
  }

  const connectionString = requireEnv("DATABASE_URL");
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const reviewPassword = process.env.REVIEW_TENANT_PASSWORD?.trim() || "AidvisoraReview2026!";

  const sql = postgres(connectionString, {
    max: 2,
    prepare: false,
    ssl: connectionString.includes("supabase.co") ? "require" : undefined,
  });

  try {
    // 1. Teardown předešlého review tenantu (idempotence).
    const existingTenants = await sql<Array<{ id: string }>>`
      SELECT id FROM public.tenants WHERE slug = ${REVIEW_SLUG}
    `;
    for (const t of existingTenants) {
      // CASCADE maže membership, contacts, contracts, etc. Před tím smaž auth users.
      await sql`DELETE FROM public.tenants WHERE id = ${t.id}`;
    }
    for (const email of [REVIEW_ADVISOR_EMAIL, REVIEW_CLIENT_EMAIL, DEMO_ADVISOR_EMAIL, DEMO_MANAGER_EMAIL]) {
      await deleteSupabaseUserByEmail(supabaseUrl, serviceRoleKey, email);
    }

    if (args.reset) {
      console.log("reset-only complete; review tenant odstraněn");
      return;
    }

    // 2. Create auth users.
    const advisorUserId = await ensureSupabaseUser(
      supabaseUrl,
      serviceRoleKey,
      REVIEW_ADVISOR_EMAIL,
      reviewPassword,
      { full_name: "Review Admin", is_review_tenant: true },
    );
    const demoAdvisorUserId = await ensureSupabaseUser(
      supabaseUrl,
      serviceRoleKey,
      DEMO_ADVISOR_EMAIL,
      reviewPassword,
      { full_name: "Jan Novák (demo)" },
    );
    const demoManagerUserId = await ensureSupabaseUser(
      supabaseUrl,
      serviceRoleKey,
      DEMO_MANAGER_EMAIL,
      reviewPassword,
      { full_name: "Petr Svoboda (demo)" },
    );
    const clientUserId = await ensureSupabaseUser(
      supabaseUrl,
      serviceRoleKey,
      REVIEW_CLIENT_EMAIL,
      reviewPassword,
      { full_name: "Alena Nováková (demo klient)", is_review_tenant: true },
    );

    // 3. Create tenant + roles + memberships.
    const tenantId = randomUUID();
    await sql.begin(async (tx) => {
      await tx`
        INSERT INTO public.tenants (id, name, slug, notification_email, billing_company_name, billing_dic)
        VALUES (${tenantId}, ${args.tenantName}, ${REVIEW_SLUG}, ${REVIEW_ADVISOR_EMAIL}, ${args.tenantName}, 'CZ99999999')
      `;

      const roleRows = await tx<Array<{ id: string; name: string }>>`
        INSERT INTO public.roles (tenant_id, name)
        VALUES (${tenantId}, 'Admin'), (${tenantId}, 'Manager'), (${tenantId}, 'Advisor'), (${tenantId}, 'Viewer')
        RETURNING id, name
      `;
      const roleByName = new Map(roleRows.map((r) => [r.name, r.id]));

      await tx`
        INSERT INTO public.memberships (tenant_id, user_id, role_id)
        VALUES
          (${tenantId}, ${advisorUserId}, ${roleByName.get("Admin")!}),
          (${tenantId}, ${demoAdvisorUserId}, ${roleByName.get("Advisor")!}),
          (${tenantId}, ${demoManagerUserId}, ${roleByName.get("Manager")!})
      `;

      // 4. 15 contacts (fiktivní).
      const contactInputs = [
        { firstName: "Alena", lastName: "Nováková", email: REVIEW_CLIENT_EMAIL, phone: "+420 601 111 111", portalLinked: true },
        { firstName: "Tomáš", lastName: "Novotný", email: "tomas.novotny@example.cz", phone: "+420 602 222 222" },
        { firstName: "Eva", lastName: "Svobodová", email: "eva.svobodova@example.cz", phone: "+420 603 333 333" },
        { firstName: "Pavel", lastName: "Dvořák", email: "pavel.dvorak@example.cz", phone: "+420 604 444 444" },
        { firstName: "Jana", lastName: "Procházková", email: "jana.prochazkova@example.cz", phone: "+420 605 555 555" },
        { firstName: "Petr", lastName: "Veselý", email: "petr.vesely@example.cz", phone: "+420 606 666 666" },
        { firstName: "Lucie", lastName: "Horáková", email: "lucie.horakova@example.cz", phone: "+420 607 777 777" },
        { firstName: "Martin", lastName: "Krejčí", email: "martin.krejci@example.cz", phone: "+420 608 888 888" },
        { firstName: "Kateřina", lastName: "Polášková", email: "katerina.polaskova@example.cz", phone: "+420 609 999 999" },
        { firstName: "Jiří", lastName: "Marek", email: "jiri.marek@example.cz", phone: "+420 610 101 010" },
        { firstName: "Hana", lastName: "Kučerová", email: "hana.kucerova@example.cz", phone: "+420 611 111 112" },
        { firstName: "David", lastName: "Beneš", email: "david.benes@example.cz", phone: "+420 612 121 212" },
        { firstName: "Monika", lastName: "Šimková", email: "monika.simkova@example.cz", phone: "+420 613 131 313" },
        { firstName: "Roman", lastName: "Pospíšil", email: "roman.pospisil@example.cz", phone: "+420 614 141 414" },
        { firstName: "Lenka", lastName: "Urbanová", email: "lenka.urbanova@example.cz" },
      ];

      const contactIds: string[] = [];
      let portalContactId: string | null = null;
      for (const c of contactInputs) {
        const id = randomUUID();
        contactIds.push(id);
        if (c.portalLinked) portalContactId = id;
        await tx`
          INSERT INTO public.contacts (id, tenant_id, first_name, last_name, email, phone)
          VALUES (${id}, ${tenantId}, ${c.firstName}, ${c.lastName}, ${c.email ?? null}, ${c.phone ?? null})
        `;
      }

      // 5. Propojení review klienta s kontakt pro client portal.
      if (portalContactId) {
        await tx`
          INSERT INTO public.client_contacts (tenant_id, user_id, contact_id)
          VALUES (${tenantId}, ${clientUserId}, ${portalContactId})
          ON CONFLICT DO NOTHING
        `;
      }

      // 6. 12 contracts (5 různých segmentů × různé kontakty).
      const contractSeeds: Array<{
        contactIdx: number;
        segment: string;
        partnerName: string;
        productName: string;
        premium: string;
      }> = [
        { contactIdx: 0, segment: "ZP", partnerName: "Kooperativa", productName: "Životní pojištění PLUS", premium: "650.00" },
        { contactIdx: 0, segment: "POV", partnerName: "Generali", productName: "Povinné ručení", premium: "390.00" },
        { contactIdx: 1, segment: "ZP", partnerName: "Allianz", productName: "Životní pojištění Standard", premium: "780.00" },
        { contactIdx: 2, segment: "INV", partnerName: "ČSOB", productName: "Investiční fond Dynamic", premium: "1500.00" },
        { contactIdx: 2, segment: "ZP", partnerName: "Česká pojišťovna", productName: "Životní pojištění Premium", premium: "1200.00" },
        { contactIdx: 3, segment: "POV", partnerName: "UNIQA", productName: "Povinné ručení Comfort", premium: "420.00" },
        { contactIdx: 4, segment: "INV", partnerName: "Conseq", productName: "Conseq Invest", premium: "2000.00" },
        { contactIdx: 5, segment: "HYP", partnerName: "Komerční banka", productName: "Hypotéka 20Y", premium: "12500.00" },
        { contactIdx: 6, segment: "ZP", partnerName: "Kooperativa", productName: "Životní pojištění PLUS", premium: "890.00" },
        { contactIdx: 7, segment: "POV", partnerName: "Allianz", productName: "Povinné ručení", premium: "450.00" },
        { contactIdx: 8, segment: "ZP", partnerName: "Generali", productName: "Životní pojištění Basic", premium: "540.00" },
        { contactIdx: 9, segment: "ODP", partnerName: "UNIQA", productName: "Pojištění odpovědnosti", premium: "320.00" },
      ];

      for (const seed of contractSeeds) {
        const contactId = contactIds[seed.contactIdx];
        if (!contactId) continue;
        await tx`
          INSERT INTO public.contracts (
            id, tenant_id, contact_id, segment, type, partner_name, product_name,
            premium_amount, visible_to_client, portfolio_status, source_kind
          )
          VALUES (
            ${randomUUID()}, ${tenantId}, ${contactId}, ${seed.segment}, ${seed.segment},
            ${seed.partnerName}, ${seed.productName}, ${seed.premium}, true, 'active', 'manual'
          )
        `;
      }

      console.log("review tenant seeded:", { tenantId, slug: REVIEW_SLUG });
    });

    console.log("");
    console.log("=== REVIEW TENANT CREDENTIALS ===");
    console.log("Advisor:  ", REVIEW_ADVISOR_EMAIL);
    console.log("Client:   ", REVIEW_CLIENT_EMAIL);
    console.log("Password: ", reviewPassword);
    console.log("=================================");
    console.log("Před App Store submission přepiš heslo a zaznamenaj do docs/launch/review-tenant-credentials.gpg");
  } finally {
    await sql.end({ timeout: 2 });
  }
}

main().catch((err) => {
  console.error("[review-tenant-seed] FAILED:", err);
  process.exit(1);
});
