-- AI Výpověď smlouvy – seed globálního registru pojistitelů + katalogu důvodů
-- Globální řádky: tenant_id = NULL (sdílené přes všechny tenanty).
-- Idempotentní: ON CONFLICT DO NOTHING + partial unikátní indexy z termination_module_2026-04-07.sql
-- Spustit PO termination_module_2026-04-07.sql (tabulky musí existovat).

-- ============================================================================
-- INSURER TERMINATION REGISTRY – česká pojišťovací scéna (seed / ukázka)
-- Pole registry_needs_verification = true dokud není ověřeno právně/ops týmem.
-- ============================================================================

INSERT INTO insurer_termination_registry (
  tenant_id, catalog_key, insurer_name, aliases, supported_segments,
  mailing_address, email, data_box, web_form_url, client_portal_url,
  freeform_letter_allowed, requires_official_form,
  official_form_name, official_form_storage_path, official_form_notes,
  allowed_channels, rule_overrides, attachment_rules,
  registry_needs_verification, active
) VALUES

-- Česká pojišťovna
(NULL, 'cz:CP', 'Česká pojišťovna a.s.',
  '["ČP","CP","ceska pojistovna"]',
  '["ZP","MAJ","ODP","AUTO_PR","AUTO_HAV","CEST"]',
  '{"name":"Česká pojišťovna a.s.","street":"Spálená 75/16","city":"Praha 1","zip":"113 04","country":"CZ"}',
  NULL, NULL, NULL, 'https://www.ceskapojistovna.cz',
  true, false, NULL, NULL, NULL,
  '["postal_mail","data_box","insurer_portal"]', '{}', '{}',
  true, true),

-- Kooperativa
(NULL, 'cz:KOOP', 'Kooperativa pojišťovna, a.s.',
  '["Kooperativa","KOOP","kooperativa"]',
  '["ZP","MAJ","ODP","AUTO_PR","AUTO_HAV","CEST","FIRMA_POJ"]',
  '{"name":"Kooperativa pojišťovna, a.s.","street":"Pobřežní 665/21","city":"Praha 8","zip":"186 00","country":"CZ"}',
  NULL, NULL, NULL, 'https://www.koop.cz',
  true, false, NULL, NULL, NULL,
  '["postal_mail","data_box","insurer_portal"]', '{}', '{}',
  true, true),

-- Generali
(NULL, 'cz:GENERALI', 'Generali Česká pojišťovna a.s.',
  '["Generali","generali","Generali CP"]',
  '["ZP","MAJ","ODP","AUTO_PR","AUTO_HAV","CEST"]',
  '{"name":"Generali Česká pojišťovna a.s.","street":"Bělehradská 132","city":"Praha 2","zip":"120 84","country":"CZ"}',
  NULL, NULL, NULL, 'https://www.generaliceska.cz',
  true, false, NULL, NULL, NULL,
  '["postal_mail","data_box","insurer_portal"]', '{}', '{}',
  true, true),

-- Allianz
(NULL, 'cz:ALLIANZ', 'Allianz pojišťovna, a.s.',
  '["Allianz","allianz"]',
  '["ZP","MAJ","ODP","AUTO_PR","AUTO_HAV","CEST"]',
  '{"name":"Allianz pojišťovna, a.s.","street":"Ke Štvanici 656/3","city":"Praha 8","zip":"186 00","country":"CZ"}',
  NULL, NULL, NULL, 'https://www.allianz.cz',
  true, false, NULL, NULL, NULL,
  '["postal_mail","email","insurer_portal"]', '{}', '{}',
  true, true),

-- UNIQA
(NULL, 'cz:UNIQA', 'UNIQA pojišťovna, a.s.',
  '["UNIQA","uniqa","Uniqa"]',
  '["ZP","MAJ","ODP","AUTO_PR","AUTO_HAV","CEST"]',
  '{"name":"UNIQA pojišťovna, a.s.","street":"Evropská 136","city":"Praha 6","zip":"160 12","country":"CZ"}',
  NULL, NULL, NULL, 'https://www.uniqa.cz',
  true, false, NULL, NULL, NULL,
  '["postal_mail","email"]', '{}', '{}',
  true, true),

-- ČSOB Pojišťovna
(NULL, 'cz:CSOB_POJ', 'ČSOB Pojišťovna, a.s.',
  '["ČSOB Pojišťovna","ČSOBP","csob pojistovna"]',
  '["ZP","MAJ","ODP","AUTO_PR","AUTO_HAV","CEST"]',
  '{"name":"ČSOB Pojišťovna, a.s.","street":"Masarykovo náměstí 1458","city":"Pardubice","zip":"532 18","country":"CZ"}',
  NULL, NULL, NULL, 'https://www.csobpoj.cz',
  true, false, NULL, NULL, NULL,
  '["postal_mail","data_box"]', '{}', '{}',
  true, true),

-- NN Životní pojišťovna
(NULL, 'cz:NN', 'NN Životní pojišťovna N.V., pobočka pro Českou republiku',
  '["NN","nn","ING pojistovna"]',
  '["ZP","INV","DIP","DPS"]',
  '{"name":"NN Životní pojišťovna N.V.","street":"Nádražní 344/25","city":"Praha 5","zip":"150 00","country":"CZ"}',
  NULL, NULL, NULL, 'https://www.nn.cz',
  true, false, NULL, NULL, NULL,
  '["postal_mail","email"]', '{}',
  '{"id_copy":"recommended"}',
  true, true),

-- Pojišťovna České spořitelny
(NULL, 'cz:PCS', 'Pojišťovna České spořitelny, a.s.',
  '["PCS","pojistovna cs","pojišťovna ČS"]',
  '["ZP","INV","DPS"]',
  '{"name":"Pojišťovna České spořitelny, a.s.","street":"náměstí Republiky 115","city":"Pardubice","zip":"530 02","country":"CZ"}',
  NULL, NULL, NULL, 'https://www.pojistovnacs.cz',
  true, false, NULL, NULL, NULL,
  '["postal_mail","email"]', '{}', '{}',
  true, true),

-- AXA / Česká podnikatelská pojišťovna (přejmenování)
(NULL, 'cz:CPP', 'Česká podnikatelská pojišťovna, a.s.',
  '["ČPP","CPP","AXA","axa pojistovna"]',
  '["MAJ","ODP","AUTO_PR","AUTO_HAV","CEST","FIRMA_POJ"]',
  '{"name":"Česká podnikatelská pojišťovna, a.s.","street":"Budějovická 5","city":"Praha 4","zip":"140 21","country":"CZ"}',
  NULL, NULL, NULL, 'https://www.cpp.cz',
  true, false, NULL, NULL, NULL,
  '["postal_mail","email"]', '{}', '{}',
  true, true),

-- Slavia pojišťovna
(NULL, 'cz:SLAVIA', 'Slavia pojišťovna a.s.',
  '["Slavia","slavia"]',
  '["MAJ","ODP","AUTO_PR","AUTO_HAV","CEST"]',
  '{"name":"Slavia pojišťovna a.s.","street":"Revoluční 1/655","city":"Praha 1","zip":"110 00","country":"CZ"}',
  NULL, NULL, NULL, 'https://www.slavia-pojistovna.cz',
  true, false, NULL, NULL, NULL,
  '["postal_mail","email"]', '{}', '{}',
  true, true)

ON CONFLICT DO NOTHING;


-- ============================================================================
-- TERMINATION REASON CATALOG – globální důvody výpovědi (CZ zákon + praktika)
-- default_date_computation: hodnoty z terminationDefaultDateComputations.
-- ============================================================================

INSERT INTO termination_reason_catalog (
  tenant_id, reason_code, label_cs, supported_segments,
  default_date_computation, required_fields,
  attachment_required, always_review,
  instructions, sort_order, version, active
) VALUES

-- 1. Ke konci pojistného období (výpověď s 6týdenní lhůtou) – § 22 odst. 1 ZoPoj
(NULL, 'end_of_period_6_weeks',
  'Ke konci pojistného období (výpověď s 6týdenní výpovědní lhůtou)',
  '["ZP","MAJ","ODP","AUTO_PR","AUTO_HAV","CEST","FIRMA_POJ"]',
  'end_of_period_notice_6w',
  '["contract_anniversary_date"]',
  false, false,
  'Výpověď musí být doručena pojišťovně nejpozději 6 týdnů před výročním dnem smlouvy. Systém vypočítá nejbližší platné datum. Smlouva končí k výročnímu dni.',
  10, 1, true),

-- 2. K určitému sjednanému datu (jen pokud smlouva takovou klauzuli obsahuje)
(NULL, 'fixed_date_if_contractually_allowed',
  'K určitému datu (sjednáno ve smlouvě)',
  '["ZP","MAJ","ODP","AUTO_PR","AUTO_HAV","FIRMA_POJ"]',
  'fixed_user_date',
  '["requested_effective_date"]',
  false, true,
  'Tuto variantu zvolte pouze pokud smlouva výslovně umožňuje výpověď ke konkrétnímu datu. Poradce musí potvrdit, že podmínka je splněna – žádost jde do review.',
  20, 1, true),

-- 3. Do 2 měsíců od sjednání smlouvy (§ 22 odst. 2 ZoPoj)
(NULL, 'within_2_months_from_inception',
  'Do 2 měsíců od sjednání smlouvy',
  '["ZP","MAJ","ODP","AUTO_PR","AUTO_HAV","CEST"]',
  'two_months_from_inception',
  '["contract_start_date"]',
  false, false,
  'Zákonné právo vypovědět smlouvu do 2 měsíců od jejího vzniku. Datum účinnosti je den doručení výpovědi. Systém ověří, zda 2 měsíce ještě neuplynuly – pokud uplynuly, vrátí chybu.',
  30, 1, true),

-- 4. Po pojistné události (§ 22 odst. 3 ZoPoj)
(NULL, 'after_claim_event',
  'Po pojistné události',
  '["ZP","MAJ","ODP","AUTO_PR","AUTO_HAV"]',
  'after_claim_manual',
  '["requested_effective_date"]',
  true, true,
  'Výpověď po pojistné události – pojišťovna i pojistník mají právo vypovědět smlouvu do 1 měsíce od oznámení události nebo od výplaty plnění. Poradce musí doložit datum události. Žádost jde do review a vyžaduje doklad o pojistné události.',
  40, 1, true),

-- 5. Odstoupení od smlouvy uzavřené na dálku / distančním způsobem (§ 21 ZoPoj / § 54 ZoSF)
(NULL, 'distance_contract_withdrawal',
  'Odstoupení od smlouvy uzavřené na dálku (distanční smlouva)',
  '["ZP","MAJ","ODP","AUTO_PR","AUTO_HAV","CEST","INV"]',
  'distance_withdrawal_legal',
  '["contract_start_date"]',
  false, true,
  'Zákonné právo odstoupit od smlouvy sjednané na dálku bez udání důvodu do 14–30 dnů od uzavření (lhůta závisí na typu pojištění). Systém ověří lhůtu. Žádost jde do review pro potvrzení distančního způsobu uzavření.',
  50, 1, true),

-- 6. Dohodou / vzájemnou dohodou
(NULL, 'mutual_agreement',
  'Dohodou (vzájemná dohoda pojistníka a pojišťovny)',
  '["ZP","MAJ","ODP","AUTO_PR","AUTO_HAV","CEST","INV","FIRMA_POJ"]',
  'mutual_agreement_date',
  '["requested_effective_date"]',
  false, true,
  'Ukončení smlouvy na základě vzájemné dohody – datum je smluvní. Pojišťovna musí souhlasit. Žádost jde do review, poradce musí potvrdit souhlas pojišťovny nebo iniciovat komunikaci.',
  60, 1, true),

-- 7. Jiný důvod / ruční posouzení (fallback)
(NULL, 'special_reason_manual_review',
  'Jiný důvod / ruční posouzení',
  '["ZP","MAJ","ODP","AUTO_PR","AUTO_HAV","CEST","INV","DIP","DPS","HYPO","UVER","FIRMA_POJ"]',
  'manual_always',
  '[]',
  false, true,
  'Důvod výpovědi nespadá do žádné standardní kategorie nebo si poradce není jistý. Žádost vždy jde do review, kde compliance/ops tým posoudí správný postup.',
  70, 1, true)

ON CONFLICT DO NOTHING;
