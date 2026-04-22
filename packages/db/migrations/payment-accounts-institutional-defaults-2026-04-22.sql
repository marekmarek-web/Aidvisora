-- Rozšíření payment_accounts o institucionální defaulty + seed globálních řádků (tenant_id IS NULL)
-- Datum: 22.04.2026 (v3 — po druhém auditu)
-- Souvisí s: packages/db/src/data/institution-payment-accounts-v1.json, F5 (institucionální platební účty).
--
-- HISTORIE:
--   v1 (22.04.2026): halucinovaná čísla účtů a univerzální Conseq template s /0100. Zrušeno.
--   v2 (22.04.2026): oprava účtů a přidání dimenzí payment_type + product_code. Ale:
--     - u řádků s bankovním kódem /0800 uváděla nesprávný název banky „ČSOB" místo „Česká spořitelna",
--     - Conseq DPS 'regular' (účastník) měl nesprávně variable_symbol_required = FALSE
--       — oficiální pokyny vyžadují VS = číslo smlouvy a KS = 558,
--     - Conseq DPS 'extra' směšoval mimořádné příspěvky účastníka a zaměstnavatelské
--       příspěvky, které mají různé symboly (SS/KS),
--     - chyběl seed pro NN životní pojišťovnu (dvě varianty podle délky čísla smlouvy).
--
-- Co v3 dělá:
--   1) Přidá nové sloupce pro symboly: `constant_symbol`, `specific_symbol_template`,
--      `symbol_rules_note`. Zbylé sloupce z v2 (bank_code, variable_symbol_required,
--      account_number_template, payment_type, product_code) jsou zachovány.
--   2) Drop starý index a vytvoření širšího unique partial indexu
--      (partner_name, segment, COALESCE(payment_type,''), COALESCE(product_code,''))
--      WHERE tenant_id IS NULL — umožňuje více řádků pro stejný segment lišících se
--      payment type nebo produktovou variantou.
--   3) DELETE FROM payment_accounts WHERE tenant_id IS NULL — reset globálů z v1/v2
--      (tenant overrides zůstávají netknuté).
--   4) Seed pouze veřejně ověřených záznamů se správnými bankovními názvy, kompletní
--      symbol logikou u DPS/DIP a Conseq DPS rozdělením na účastník/mimořádné/zaměstnavatel.
--   5) ZÁMĚRNĚ VYNECHÁNO: Generali Česká pojišťovna (univerzální účet nelze obhájit
--      z veřejných zdrojů).
--
-- Idempotentní, v transakci.

BEGIN;

-- 1. Schema extension (idempotentní).
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS bank_code TEXT;
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS variable_symbol_required BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS account_number_template TEXT;
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS payment_type TEXT;
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS product_code TEXT;
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS constant_symbol TEXT;
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS specific_symbol_template TEXT;
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS symbol_rules_note TEXT;

-- 2. Index rework.
DROP INDEX IF EXISTS payment_accounts_global_partner_name_segment_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS payment_accounts_global_partner_seg_ptype_prod_uniq
  ON payment_accounts (
    partner_name,
    segment,
    COALESCE(payment_type, ''),
    COALESCE(product_code, '')
  )
  WHERE tenant_id IS NULL;

-- 3. Reset všech globálů (tenant overrides ponecháváme).
DELETE FROM payment_accounts WHERE tenant_id IS NULL;

-- 4. Seed pouze ověřených řádků z institution-payment-accounts-v1.json (v3).
DO $$
DECLARE
  v_applied int := 0;
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    -- (partner_name, segment, payment_type, product_code, account_number, bank, bank_code,
    --  vs_required, account_template, constant_symbol, specific_symbol_template, symbol_rules_note, note_text)

    -- ─── Allianz pojišťovna ──────────────────────────────────────────────────────
    ('Allianz pojišťovna', 'ZP',        'regular', NULL, '2700', 'UniCredit Bank', '2700', TRUE, NULL, NULL, NULL, NULL,
     'Allianz životní pojištění — VS = číslo smlouvy.'),

    ('Allianz pojišťovna', 'MAJ',       'regular', NULL, '2727', 'UniCredit Bank', '2700', TRUE, NULL, NULL, NULL, NULL, 'Allianz neživotní (majetek). VS = číslo smlouvy.'),
    ('Allianz pojišťovna', 'ODP',       'regular', NULL, '2727', 'UniCredit Bank', '2700', TRUE, NULL, NULL, NULL, NULL, 'Allianz neživotní (odpovědnost). VS = číslo smlouvy.'),
    ('Allianz pojišťovna', 'CEST',      'regular', NULL, '2727', 'UniCredit Bank', '2700', TRUE, NULL, NULL, NULL, NULL, 'Allianz cestovní pojištění. VS = číslo smlouvy.'),
    ('Allianz pojišťovna', 'FIRMA_POJ', 'regular', NULL, '2727', 'UniCredit Bank', '2700', TRUE, NULL, NULL, NULL, NULL, 'Allianz podnikatelské pojištění. VS = číslo smlouvy.'),
    ('Allianz pojišťovna', 'AUTO_PR',   'regular', NULL, '2727', 'UniCredit Bank', '2700', TRUE, NULL, NULL, NULL, NULL, 'Allianz autopojištění — BĚŽNÉ pojistné. Pro 1. pojistné speciální účet.'),
    ('Allianz pojišťovna', 'AUTO_HAV',  'regular', NULL, '2727', 'UniCredit Bank', '2700', TRUE, NULL, NULL, NULL, NULL, 'Allianz havarijní — BĚŽNÉ pojistné. Pro 1. pojistné speciální účet.'),

    ('Allianz pojišťovna', 'AUTO_PR',  'first', NULL, '20001-38138021', 'Komerční banka', '0100', TRUE, NULL, NULL, NULL, NULL, 'Allianz autopojištění — POUZE 1. pojistné. Pro běžné 2727/2700.'),
    ('Allianz pojišťovna', 'AUTO_HAV', 'first', NULL, '20001-38138021', 'Komerční banka', '0100', TRUE, NULL, NULL, NULL, NULL, 'Allianz havarijní — POUZE 1. pojistné. Pro běžné 2727/2700.'),

    -- ─── Allianz penzijní společnost ────────────────────────────────────────────
    ('Allianz penzijní společnost', 'DPS', 'regular', NULL, '3033', 'UniCredit Bank', '2700', TRUE, NULL, NULL, NULL,
     'Allianz penze rozlišuje účastníka vs zaměstnavatele konstantním symbolem — ověřte v rámcové smlouvě klienta.',
     'Allianz PS (DPS) — VS = číslo smlouvy.'),

    -- ─── Kooperativa ────────────────────────────────────────────────────────────
    -- Pozor: /0800 = Česká spořitelna, nikoli ČSOB.
    ('Kooperativa', 'ZP',        'regular', NULL, '2226222', 'Česká spořitelna', '0800', TRUE, NULL, NULL, NULL, NULL, 'Kooperativa — běžné pojistné (ŽP). VS = číslo smlouvy.'),
    ('Kooperativa', 'MAJ',       'regular', NULL, '2226222', 'Česká spořitelna', '0800', TRUE, NULL, NULL, NULL, NULL, 'Kooperativa — běžné pojistné (majetek). VS = číslo smlouvy.'),
    ('Kooperativa', 'AUTO_PR',   'regular', NULL, '2226222', 'Česká spořitelna', '0800', TRUE, NULL, NULL, NULL, NULL, 'Kooperativa — běžné pojistné (AUTO PR). VS = číslo smlouvy.'),
    ('Kooperativa', 'AUTO_HAV',  'regular', NULL, '2226222', 'Česká spořitelna', '0800', TRUE, NULL, NULL, NULL, NULL, 'Kooperativa — běžné pojistné (HAV). VS = číslo smlouvy.'),
    ('Kooperativa', 'CEST',      'regular', NULL, '2226222', 'Česká spořitelna', '0800', TRUE, NULL, NULL, NULL, NULL, 'Kooperativa — cestovní pojištění. VS = číslo smlouvy.'),
    ('Kooperativa', 'ODP',       'regular', NULL, '2226222', 'Česká spořitelna', '0800', TRUE, NULL, NULL, NULL, NULL, 'Kooperativa — odpovědnost občana. VS = číslo smlouvy.'),
    ('Kooperativa', 'FIRMA_POJ', 'regular', NULL, '2226222', 'Česká spořitelna', '0800', TRUE, NULL, NULL, NULL, NULL, 'Kooperativa — podnikatelské pojištění. VS = číslo smlouvy.'),

    ('Kooperativa', 'ODP_ZAM', 'regular', NULL, '40002-50404011', 'Komerční banka', '0100', TRUE, NULL, NULL, NULL, NULL,
     'Kooperativa — zákonné pojištění odpovědnosti zaměstnavatele (vyhláška 125/1993 Sb.). VS = IČO plátce.'),

    -- ─── Penzijní společnosti (DPS) ─────────────────────────────────────────────
    -- NN PS /0800 = Česká spořitelna.
    ('NN Penzijní společnost', 'DPS', 'regular', NULL, '5005004433', 'Česká spořitelna', '0800', TRUE, NULL, NULL, NULL,
     'NN PS používá SS a KS podle typu platby a smluvního vztahu — řiďte se pokyny v rámcové smlouvě klienta.',
     'NN PS — VS = číslo smlouvy (případně rodné číslo v určeném formátu).'),

    ('UNIQA Penzijní společnost', 'DPS', 'regular', NULL, '222333222', 'UniCredit Bank', '2700', TRUE, NULL, NULL, NULL, NULL,
     'UNIQA PS (bývalá AXA) — VS = číslo smlouvy.'),

    ('ČSOB Penzijní společnost', 'DPS', 'regular', NULL, '2106990187', 'UniCredit Bank', '2700', TRUE, NULL, '3558', '{birthNumber}', NULL,
     'ČSOB PS — VS = číslo smlouvy, SS = rodné číslo, KS = 3558.'),

    -- KB PS /0800 = Česká spořitelna.
    ('KB Penzijní společnost', 'DPS', 'regular', NULL, '300300232', 'Česká spořitelna', '0800', TRUE, NULL, NULL, NULL, NULL,
     'KB PS — VS = číslo smlouvy.'),

    -- ─── ČPP ────────────────────────────────────────────────────────────────────
    -- ČPP /0800 = Česká spořitelna.
    ('ČPP', 'ZP',        'regular', NULL, '700135002', 'Česká spořitelna', '0800', TRUE, NULL, NULL, NULL, NULL, 'ČPP — běžné pojistné (ŽP). VS = číslo smlouvy.'),
    ('ČPP', 'MAJ',       'regular', NULL, '700135002', 'Česká spořitelna', '0800', TRUE, NULL, NULL, NULL, NULL, 'ČPP — běžné pojistné (MAJ). VS = číslo smlouvy.'),
    ('ČPP', 'AUTO_PR',   'regular', NULL, '700135002', 'Česká spořitelna', '0800', TRUE, NULL, NULL, NULL, NULL, 'ČPP — běžné pojistné (AUTO PR). VS = číslo smlouvy.'),
    ('ČPP', 'AUTO_HAV',  'regular', NULL, '700135002', 'Česká spořitelna', '0800', TRUE, NULL, NULL, NULL, NULL, 'ČPP — běžné pojistné (HAV). VS = číslo smlouvy.'),
    ('ČPP', 'CEST',      'regular', NULL, '700135002', 'Česká spořitelna', '0800', TRUE, NULL, NULL, NULL, NULL, 'ČPP — cestovní pojištění. VS = číslo smlouvy.'),
    ('ČPP', 'ODP',       'regular', NULL, '700135002', 'Česká spořitelna', '0800', TRUE, NULL, NULL, NULL, NULL, 'ČPP — odpovědnost. VS = číslo smlouvy.'),
    ('ČPP', 'ODP_ZAM',   'regular', NULL, '700135002', 'Česká spořitelna', '0800', TRUE, NULL, NULL, NULL, NULL, 'ČPP — odpovědnost zaměstnance. VS = číslo smlouvy.'),
    ('ČPP', 'FIRMA_POJ', 'regular', NULL, '700135002', 'Česká spořitelna', '0800', TRUE, NULL, NULL, NULL, NULL, 'ČPP — podnikatelské pojištění. VS = číslo smlouvy.'),

    ('ČPP', 'ZP',        'extra', NULL, '700485002', 'Česká spořitelna', '0800', TRUE, NULL, NULL, NULL, NULL, 'ČPP — mimořádné pojistné (ŽP). VS = číslo smlouvy.'),
    ('ČPP', 'MAJ',       'extra', NULL, '700485002', 'Česká spořitelna', '0800', TRUE, NULL, NULL, NULL, NULL, 'ČPP — mimořádné pojistné (MAJ). VS = číslo smlouvy.'),
    ('ČPP', 'AUTO_PR',   'extra', NULL, '700485002', 'Česká spořitelna', '0800', TRUE, NULL, NULL, NULL, NULL, 'ČPP — mimořádné pojistné (AUTO PR). VS = číslo smlouvy.'),
    ('ČPP', 'AUTO_HAV',  'extra', NULL, '700485002', 'Česká spořitelna', '0800', TRUE, NULL, NULL, NULL, NULL, 'ČPP — mimořádné pojistné (HAV). VS = číslo smlouvy.'),
    ('ČPP', 'CEST',      'extra', NULL, '700485002', 'Česká spořitelna', '0800', TRUE, NULL, NULL, NULL, NULL, 'ČPP — mimořádné pojistné (CEST). VS = číslo smlouvy.'),
    ('ČPP', 'ODP',       'extra', NULL, '700485002', 'Česká spořitelna', '0800', TRUE, NULL, NULL, NULL, NULL, 'ČPP — mimořádné pojistné (ODP). VS = číslo smlouvy.'),
    ('ČPP', 'ODP_ZAM',   'extra', NULL, '700485002', 'Česká spořitelna', '0800', TRUE, NULL, NULL, NULL, NULL, 'ČPP — mimořádné pojistné (ODP_ZAM). VS = číslo smlouvy.'),
    ('ČPP', 'FIRMA_POJ', 'extra', NULL, '700485002', 'Česká spořitelna', '0800', TRUE, NULL, NULL, NULL, NULL, 'ČPP — mimořádné pojistné (FIRMA_POJ). VS = číslo smlouvy.'),

    -- ─── ČSOB pojišťovna ────────────────────────────────────────────────────────
    ('ČSOB pojišťovna', 'ZP',        'regular', NULL, '130450683', 'ČSOB', '0300', TRUE, NULL, NULL, NULL, NULL, 'ČSOB pojišťovna — životní pojištění. VS = číslo smlouvy.'),
    ('ČSOB pojišťovna', 'MAJ',       'regular', NULL, '187078376', 'ČSOB', '0300', TRUE, NULL, NULL, NULL, NULL, 'ČSOB pojišťovna — neživotní retail (MAJ). VS = číslo smlouvy.'),
    ('ČSOB pojišťovna', 'AUTO_PR',   'regular', NULL, '187078376', 'ČSOB', '0300', TRUE, NULL, NULL, NULL, NULL, 'ČSOB pojišťovna — neživotní retail (AUTO PR). VS = číslo smlouvy.'),
    ('ČSOB pojišťovna', 'AUTO_HAV',  'regular', NULL, '187078376', 'ČSOB', '0300', TRUE, NULL, NULL, NULL, NULL, 'ČSOB pojišťovna — neživotní retail (HAV). VS = číslo smlouvy.'),
    ('ČSOB pojišťovna', 'CEST',      'regular', NULL, '187078376', 'ČSOB', '0300', TRUE, NULL, NULL, NULL, NULL, 'ČSOB pojišťovna — neživotní retail (CEST). VS = číslo smlouvy.'),
    ('ČSOB pojišťovna', 'ODP',       'regular', NULL, '187078376', 'ČSOB', '0300', TRUE, NULL, NULL, NULL, NULL, 'ČSOB pojišťovna — neživotní retail (ODP). VS = číslo smlouvy.'),
    ('ČSOB pojišťovna', 'ODP_ZAM',   'regular', NULL, '187078376', 'ČSOB', '0300', TRUE, NULL, NULL, NULL, NULL, 'ČSOB pojišťovna — neživotní retail (ODP_ZAM). VS = číslo smlouvy.'),
    ('ČSOB pojišťovna', 'FIRMA_POJ', 'regular', NULL, '180135112', 'ČSOB', '0300', TRUE, NULL, NULL, NULL, NULL, 'ČSOB pojišťovna — podnikatelská rizika. Pro flotily 157411676/0300.'),

    -- ─── Direct pojišťovna (FALLBACK — klient má platit podle pokynů v pojistné smlouvě) ──
    ('Direct', 'ZP',        'regular', NULL, '123-1562900267', 'Komerční banka', '0100', TRUE, NULL, NULL, NULL,
     'Direct oficiálně žádá platit podle pokynů v pojistné smlouvě. Alternativní účet 2330257/0100. Tento řádek slouží jen jako předvyplnění — vždy ověřte s platebními pokyny klienta.',
     'Direct pojišťovna — FALLBACK účet v Kč. VS = číslo smlouvy.'),
    ('Direct', 'MAJ',       'regular', NULL, '123-1562900267', 'Komerční banka', '0100', TRUE, NULL, NULL, NULL,
     'Direct oficiálně žádá platit podle pokynů v pojistné smlouvě. Alternativní účet 2330257/0100.',
     'Direct pojišťovna — FALLBACK účet v Kč. VS = číslo smlouvy.'),
    ('Direct', 'AUTO_PR',   'regular', NULL, '123-1562900267', 'Komerční banka', '0100', TRUE, NULL, NULL, NULL,
     'Direct oficiálně žádá platit podle pokynů v pojistné smlouvě. Alternativní účet 2330257/0100.',
     'Direct pojišťovna — FALLBACK účet v Kč. VS = číslo smlouvy.'),
    ('Direct', 'AUTO_HAV',  'regular', NULL, '123-1562900267', 'Komerční banka', '0100', TRUE, NULL, NULL, NULL,
     'Direct oficiálně žádá platit podle pokynů v pojistné smlouvě. Alternativní účet 2330257/0100.',
     'Direct pojišťovna — FALLBACK účet v Kč. VS = číslo smlouvy.'),
    ('Direct', 'ODP',       'regular', NULL, '123-1562900267', 'Komerční banka', '0100', TRUE, NULL, NULL, NULL,
     'Direct oficiálně žádá platit podle pokynů v pojistné smlouvě. Alternativní účet 2330257/0100.',
     'Direct pojišťovna — FALLBACK účet v Kč. VS = číslo smlouvy.'),
    ('Direct', 'CEST',      'regular', NULL, '123-1562900267', 'Komerční banka', '0100', TRUE, NULL, NULL, NULL,
     'Direct oficiálně žádá platit podle pokynů v pojistné smlouvě. Alternativní účet 2330257/0100.',
     'Direct pojišťovna — FALLBACK účet v Kč. VS = číslo smlouvy.'),
    ('Direct', 'FIRMA_POJ', 'regular', NULL, '123-1562900267', 'Komerční banka', '0100', TRUE, NULL, NULL, NULL,
     'Direct oficiálně žádá platit podle pokynů v pojistné smlouvě. Alternativní účet 2330257/0100.',
     'Direct pojišťovna — FALLBACK účet v Kč. VS = číslo smlouvy.'),

    -- ─── Pillow (Fio banka) ─────────────────────────────────────────────────────
    ('Pillow', 'MAJ', 'regular', NULL, '501401304', 'Fio banka', '2010', TRUE, NULL, NULL, NULL, NULL, 'Pillow — jeden VS pro všechny smlouvy klienta (klientské ID).'),
    ('Pillow', 'ODP', 'regular', NULL, '501401304', 'Fio banka', '2010', TRUE, NULL, NULL, NULL, NULL, 'Pillow — jeden VS pro všechny smlouvy klienta (klientské ID).'),

    -- ─── Conseq INV ─────────────────────────────────────────────────────────────
    ('Conseq', 'INV', 'regular', 'active_horizont_invest', NULL, 'UniCredit Bank', '2700', FALSE, '666777-{contractNumber}/2700', NULL, NULL, NULL,
     'Conseq Active / Horizont Invest — účet 666777-{číslo smlouvy}/2700. VS se neuvádí.'),

    ('Conseq', 'INV', 'regular', 'classic_invest_czk', '6850057', 'UniCredit Bank', '2700', TRUE, NULL, NULL, NULL, NULL,
     'Conseq Classic Invest (CZK) — VS = číslo smlouvy.'),

    -- ─── Conseq DPS (účastník regular / mimořádné / zaměstnavatel) ──────────────
    -- Účastník sdružená platba: účet má template, VS = číslo smlouvy, KS = 558.
    ('Conseq Penzijní společnost', 'DPS', 'regular', NULL, NULL, 'UniCredit Bank', '2700', TRUE, '662266-{contractNumber}/2700', '558', NULL, NULL,
     'Conseq DPS — sdružená platba účastníka. Předčíslí 662266, číslo účtu = číslo smlouvy. VS = číslo smlouvy, KS = 558, SS se neuvádí.'),

    -- Mimořádný příspěvek účastníka: SS = 99, KS = 558. /0800 = Česká spořitelna.
    ('Conseq Penzijní společnost', 'DPS', 'extra', NULL, '100010652', 'Česká spořitelna', '0800', TRUE, NULL, '558', '99', NULL,
     'Conseq DPS — MIMOŘÁDNÝ příspěvek účastníka. VS = číslo smlouvy, SS = 99, KS = 558.'),

    -- Individuální zaměstnavatelský příspěvek: SS = IČ, KS = 3552.
    ('Conseq Penzijní společnost', 'DPS', 'employer', NULL, '100010652', 'Česká spořitelna', '0800', TRUE, NULL, '3552', '{ico}',
     'Individuální zaměstnavatelský příspěvek. Pro HROMADNOU platbu zaměstnavatele má VS = IČ a SS = RRRRMM — v takovém případě zadejte ručně.',
     'Conseq DPS — INDIVIDUÁLNÍ zaměstnavatelský příspěvek. VS = číslo smlouvy, SS = IČ zaměstnavatele, KS = 3552.'),

    -- ─── Conseq DIP ─────────────────────────────────────────────────────────────
    ('Conseq', 'DIP', 'employer', NULL, '1388083926', 'UniCredit Bank', '2700', TRUE, NULL, NULL, '{ico}', NULL,
     'Conseq DIP — zaměstnavatelské příspěvky. VS = číslo podkladové smlouvy, SS = IČ zaměstnavatele.'),

    -- ─── NN životní pojišťovna (ZP) — 10místné vs 8místné smlouvy ──────────────
    -- Zdroj: https://www.nn.cz/poradna/pojistovna/platby.html
    ('NN', 'ZP', 'regular', 'contract_10_digit', '1000588419', 'ING Bank', '3500', TRUE, NULL, NULL, NULL,
     'Platí pro smlouvy s 10místným číslem. 8místné smlouvy mají jiný účet a jinou VS logiku — použijte variantu contract_8_digit.',
     'NN životní — smlouvy s 10místným číslem smlouvy. VS = číslo smlouvy.'),

    ('NN', 'ZP', 'regular', 'contract_8_digit', '1010101010', 'ING Bank', '3500', TRUE, NULL, NULL, NULL,
     'Starší 8místné smlouvy NN mohou mít odlišnou logiku VS (rodné číslo / identifikátor z pojistné smlouvy). Ověřte podle pokynu u klienta.',
     'NN životní — smlouvy s 8místným číslem smlouvy. VS = číslo smlouvy (u starších smluv může být jiná logika).')

  ) AS seed(
    partner_name, segment, payment_type, product_code,
    account_number, bank, bank_code,
    vs_required, account_template,
    constant_symbol, specific_symbol_template, symbol_rules_note,
    note_text
  )
  LOOP
    INSERT INTO payment_accounts (
      tenant_id, partner_id, partner_name, segment,
      payment_type, product_code,
      account_number, bank, bank_code,
      variable_symbol_required, account_number_template,
      constant_symbol, specific_symbol_template, symbol_rules_note,
      note
    )
    VALUES (
      NULL, NULL, r.partner_name, r.segment,
      r.payment_type, r.product_code,
      COALESCE(r.account_number, ''),
      r.bank, r.bank_code,
      r.vs_required, r.account_template,
      r.constant_symbol, r.specific_symbol_template, r.symbol_rules_note,
      r.note_text
    );

    v_applied := v_applied + 1;
  END LOOP;

  RAISE NOTICE 'Institutional payment accounts v3 seed:';
  RAISE NOTICE '  • Reset + vloženo globálních řádků: %', v_applied;
  RAISE NOTICE '  • Opraveny bankovní názvy (/0800 = Česká spořitelna, nikoli ČSOB).';
  RAISE NOTICE '  • Conseq DPS regular nyní VS povinný (= číslo smlouvy), KS = 558.';
  RAISE NOTICE '  • Conseq DPS rozděleno na regular / extra (mimořádné, SS=99) / employer (SS=IČ, KS=3552).';
  RAISE NOTICE '  • NN životní přidáno — 10místné i 8místné smlouvy (productCode rozlišuje).';
  RAISE NOTICE '  • Záměrně vynecháno: Generali Česká pojišťovna.';
END $$;

COMMIT;
