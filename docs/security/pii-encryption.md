# PII Encryption — WS-2 (launch)

> Interní dokument pro provoz. Popisuje, **jak Aidvisora šifruje citlivá PII pole** v
> DB a jak nad nimi dělá rovnostní lookup bez dešifrování.
>
> Aidvisora je nástroj pro poradce; PII se šifruje v rámci **tenant isolation**
> a pro compliance (GDPR, ZOOÚ). Nejedná se o produktové doporučení klientovi.

---

## 1. Proč aplikační AES-GCM a ne Supabase Vault / pgsodium

Při Phase 0 audit (viz `docs/security/rls-production-snapshot-2026-04-19.md`) jsme
zjistili:

- **pgsodium** (Supabase Transparent Column Encryption) je **deprecated** pro nové
  i existující projekty; není instalovaný.
- **supabase_vault 0.3.1** je pouze pro secret storage (klíče, tokeny), ne pro
  sloupcové šifrování dat.
- **pgcrypto** by vyžadovala držet klíč v session GUC → nechceme (log, plan cache).

**Zvolený model:** aplikační AES-256-GCM v Node.js, klíč v env (rotovatelný),
fingerprint přes HMAC-SHA256 pro equality lookup. Klíč drží hosting (Vercel env,
tenant-agnostic). DB vidí pouze envelope string.

---

## 2. Sloupce a formát

### 2.1. Dotčené tabulky / sloupce (launch scope)

Migrace: `packages/db/migrations/pii-encrypt-contacts-columns-2026-04-21.sql`.

| Sloupec | Obsah | Migrace |
|---|---|---|
| `public.contacts.personal_id` | plaintext rodné číslo (legacy, drop po backfillu) | existující |
| `public.contacts.personal_id_enc` | AES-256-GCM envelope rodného čísla | M5b |
| `public.contacts.personal_id_fingerprint` | HMAC-SHA256 base64url (lookup) | M5b |
| `public.contacts.id_card_number` | plaintext OP (legacy, drop po backfillu) | existující |
| `public.contacts.id_card_number_enc` | AES-256-GCM envelope OP | M5c |
| `public.contacts.id_card_number_fingerprint` | HMAC-SHA256 (lookup) | M5c |

**Indexy:** unique `(tenant_id, personal_id_fingerprint)` a
`(tenant_id, id_card_number_fingerprint)` pro rychlý lookup a enforcement unikátnosti
v rámci tenanta.

### 2.2. Envelope formát

```
v1.<key_id>.<base64url(iv)>.<base64url(ciphertext)>.<base64url(tag)>
```

- AES-256-GCM, 12B IV (náhodné), 16B auth tag.
- `key_id` umožňuje rotaci: primární klíč šifruje, sekundární klíče dešifrují
  legacy řádky. Viz `apps/web/src/lib/pii/encrypt.ts`.
- **AAD (Associated Data)** = `<tenant>:<column>` kontext, zabraňuje přenosu
  ciphertextu mezi sloupci / tenanty.

### 2.3. Fingerprint (HMAC-SHA256)

- Deterministický, pro equality lookup (`WHERE personal_id_fingerprint = ?`).
- **Jiný klíč než šifrovací** (`PII_FINGERPRINT_KEY_BASE64`). Rotace fingerprint
  klíče znehodnotí všechny indexy, proto se rotuje pouze s backfillem.
- Normalizace vstupu: `NFKC` → odstranit whitespace → lowercase. Takže
  `"880101/1234"`, `" 880101/1234 "` a `"880101/1234\n"` dají stejný fingerprint.
  Lomítko/interpunkce **zůstává**, aby šel rozlišit `123456/7890` od `1234567890`.
- Výstup: base64url bez paddingu (43 znaků) → vejde se do `text` i URL.

---

## 3. Environment variables

| Env | Účel | Formát |
|---|---|---|
| `PII_ENCRYPTION_KEY_BASE64` | primární AES-256 klíč (32 B po dekódování) | base64 |
| `PII_ENCRYPTION_KEY_ID` | identifikátor primárního klíče (default `k1`) | krátký string |
| `PII_ENCRYPTION_KEYS` | sekundární klíče pro rotaci (jen dešifrování) | `k2:<base64>,k3:<base64>` |
| `PII_FINGERPRINT_KEY_BASE64` | HMAC klíč pro fingerprint (min. 32 B) | base64 |

**Kde žijí:** Vercel Production + Preview env (marked as Sensitive). Nikdy v repu.
Rotace primárního klíče = přidat nový `k<N>`, udělat backfill, pak nechat starý
jako sekundární až do ověřeného reenc.

---

## 4. Write / Read flow (aplikace)

### 4.1. Zápis

Použij `apps/web/src/lib/pii/contacts-write-through.ts`:

```ts
const patch = buildContactsPiiPatch({
  personalId: form.personalId ?? null,
  idCardNumber: form.idCardNumber ?? null,
});
await db.update(contacts).set({ ...patch, updatedAt: new Date() })...
```

Patch obsahuje **všechny tři** varianty (plaintext + enc + fingerprint) během
migračního okna. Po drop plaintextu se patch redukuje.

### 4.2. Čtení pro editaci / decrypt

```ts
const row = await db.select(...).from(contacts).where(...);
const rc = row.personalIdEnc
  ? decryptPii(row.personalIdEnc, "contact:personal_id")
  : row.personalId;  // fallback na legacy plaintext během migrace
```

### 4.3. Lookup (unikátnost, deduplikace)

```ts
const fp = fingerprintPii(inputRc);
const existing = await db
  .select({ id: contacts.id })
  .from(contacts)
  .where(and(eq(contacts.tenantId, auth.tenantId), eq(contacts.personalIdFingerprint, fp)))
  .limit(1);
```

---

## 5. Backfill

Skript: `scripts/security/backfill-contacts-pii.ts`. Podmínky:

- Spustit **po** deployi M5a + M5b + M5c migrací a s nasazenými env proměnnými.
- Běží jako server-only skript (ne z browseru, ne z edge funkce).
- Idempotentní — přeskakuje řádky, které už mají `*_enc` a `*_fingerprint`.
- Batch size default 200; reportuje progress.
- **Spouštět proti stagingu nejdřív**, ověřit decrypt, teprve pak produkce.

---

## 6. Drop plaintextu

Provádí se **samostatnou migrací** po:

1. úspěšném backfillu na produkci,
2. minimálně 7denním observačním okně (žádné fallback čtení z plaintextu),
3. potvrzeném obnově z zálohy (simulované restore testu).

Migrace bude odstraňovat `personal_id`, `id_card_number` + jejich indexy a
redukovat `buildContactsPiiPatch` na enc-only variantu. **Není součástí launch
scope WS-2.**

---

## 7. Testy

`apps/web/src/lib/security/__tests__/ws2-batch5-pii-signed-url-audit.test.ts` pokrývá:

- AES-GCM roundtrip (encrypt → decrypt),
- IV je náhodné, envelope má 5 segmentů,
- AAD je svázaná — decrypt s jiným AAD padne,
- neznámý `key_id` → throw,
- fingerprint je deterministický,
- normalizace whitespace + case,
- různé vstupy → různé fingerprinty,
- prázdný vstup → throw,
- HMAC klíč musí být min. 32 B.
