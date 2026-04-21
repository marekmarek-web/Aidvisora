# Upload Safety Policy

**Delta A17 — Rozhodnutí a honest disclosure pro nahrávané soubory.**

---

## Aktuální stav (soft-launch)

### Co platforma DĚLÁ

| Kontrola | Implementace | Kód |
| --- | --- | --- |
| **Velikost souboru** | `MAX_FILE_SIZE_BYTES` limit na upload route | `apps/web/src/lib/upload/validation.ts` |
| **MIME allowlist** | `ALLOWED_MIME_TYPES_GENERAL` (PDF, obrázky, DOCX, XLSX) | `apps/web/src/lib/upload/validation.ts` |
| **Magic bytes verifikace** | `detectMagicMimeTypeFromBytes()` — blokuje spoofnutý MIME | `apps/web/src/lib/security/file-signature.ts` |
| **Privátní bucket** | Supabase Storage bucket `documents` je privátní | `packages/db/migrations/storage-documents-tenant-policies-2026-04-21.sql` |
| **Signed URL only** | Ke stažení pouze krátkodobé signed URL vázané na user + tenant | `apps/web/src/lib/storage/signed-url.ts` |
| **Rate-limit** | `checkRateLimit` na upload endpointech | `apps/web/src/lib/security/rate-limit.ts` |
| **Fingerprint dedupe** | SHA-256 content hash proti zdvojení | `apps/web/src/lib/documents/processing/fingerprint.ts` |

### Co platforma NEDĚLÁ

| Riziko | Stav | Mitigace |
| --- | --- | --- |
| **Antivirový scan (ClamAV apod.)** | NENÍ nasazen | Explicit disclaimer na `/bezpecnost` a v Terms |
| **Macro-enabled Office dokumenty** | Blokováno MIME allowlist (nepřijímáme `.docm`/`.xlsm`) | — |
| **Zero-day exploity v PDF readerech** | Soubor otevírá uživatel ve svém klientu, ne platforma | Doporučení: moderní readery (Preview/Chrome) |
| **Sideloading přes signed URL** | Signed URL je tenant-scoped a má krátkou TTL | — |

---

## Proč jsme NEnasadili ClamAV k launchi

1. **False positives** — ClamAV signatures mají v reálu 1–3 % FP na běžné retail dokumenty (odmítnutí legitimních PDF od klientů ve vlně). To by zničilo UX v prvních týdnech.
2. **Update cadence** — ClamAV vyžaduje kontinuální `freshclam` update. Bez monitoringu rychle „vyhnije".
3. **Ops cost** — container-based scan v Vercel serverless nejde (120 s limit, 250 MB image). Museli bychom provoz ClamAV cluster na vlastní Fly.io/Render instanci → operativně drahé.
4. **Threat model** — primární vektor u finančních poradců nejsou malware PDF, ale **PII disclosure** (správné permissions, RLS, signed URLs). Tam jsme priorita.

---

## Roadmapa (post-launch, enterprise tier)

### Fáze 1 — offline re-scan (Q3 po launch)

- Vercel Cron denně stáhne files uploadnuté za posledních 24 h.
- Spustí `clamscan` v Vercel Sandbox / dedicated Fly.io worker.
- Pokud hit → automatické označení `documents.flagged_av = true` + email support@.

### Fáze 2 — synchronní scan na upload (enterprise only)

- Enterprise tenanti dostanou `tenants.require_av_scan = true`.
- Upload route routuje přes ClamAV gateway před uložením.
- Non-enterprise: zůstává best-effort offline model.

### Alternativy zvažované

| Služba | Rozhodnutí |
| --- | --- |
| **CloudMersive Virus Scan API** | Drahé (~ $50 / 10k scans), lock-in, EU residency otazník |
| **VirusTotal API** | NELZE — veřejné sdílení vzorků mimo tenant — **porušuje GDPR**, zakázané |
| **MetaDefender (OPSWAT)** | Enterprise-grade, ale $$$ a US-centric |
| **AWS GuardDuty Malware Protection** | Vyžaduje AWS ecosystem, my jsme Supabase + Vercel |
| **Supabase Storage AV (native)** | Supabase zatím nemá built-in AV scan — **potvrzeno 2026-04** |

---

## Honest disclosure

Na `/bezpecnost` je pod sekcí „Data a infrastruktura" explicitní TopicCard:

> **Kontrola nahraných souborů** *(live)*
>
> Uploady prochází serverovou validací velikosti, MIME typu a kontrolou magic bytes
> (PDF / JPEG / PNG / DOCX / XLSX). Soubory jsou ukládány do privátních buckettů a nikdy
> nejsou přímo servírovány jako veřejný obsah.
>
> **Co neděláme:** neprovádíme antivirový ani malware scan obsahu souborů. Poradce odpovídá
> za bezpečnost souborů, které do platformy nahraje. Nasazení AV skenu (ClamAV) je na
> roadmapě pro enterprise režim.

### Terms of Service (viz `apps/web/src/app/legal/content/terms-blocks.json`)

V sekci o uživatelských povinnostech je deklarace: *"Uživatel se zavazuje nahrávat pouze soubory,
u nichž má oprávnění s nimi nakládat a u nichž si není vědom, že by obsahovaly škodlivý kód."*

→ Pokud TOTO v Terms není → **přidat před launch** (viz `terms-acceptance-integration.md`).

---

## Sign-off

- [ ] Security owner (Marek): schváleno, soft-launch bez AV akceptovatelný s explicit disclosure.
- [ ] Legal owner: schvaluje explicit disclaimer na `/bezpecnost` + Terms klauzuli.
- [ ] Ops owner: zakládá Linear ticket `AIDV-SEC-AV-PHASE1` s milníkem Q3.
