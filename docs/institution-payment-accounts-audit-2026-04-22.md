# Audit institucionálních platebních účtů (F5 v3)

**Datum:** 22.04.2026
**Kontext:** Druhá revize seedu v `packages/db/src/data/institution-payment-accounts-v1.json`
a SQL migrace `payment-accounts-institutional-defaults-2026-04-22.sql`. v2 opravila
halucinovaná čísla z v1, ale měla další chyby: nesprávné bankovní názvy u kódu
`/0800` (Česká spořitelna, ne ČSOB), špatnou VS logiku u Conseq DPS účastníka,
sloučený řádek pro mimořádné a zaměstnavatelské platby u Conseq DPS, a chybějící
NN životní. v3 všechny tyto problémy řeší a zároveň rozšiřuje schema o pole
pro KS/SS.

## Změny oproti v2

### 1) Bank name opravy (0800 = Česká spořitelna, nikoli ČSOB)

Kód banky `/0800` v ČR patří **České spořitelně**, nikoliv ČSOB (ta má `/0300`).
Opraveny řádky:

| Partner / segment           | Účet            | Bank v v2       | Bank v v3         |
| --------------------------- | --------------- | --------------- | ----------------- |
| Kooperativa (běžné 7 segmentů) | 2226222/0800 | ČSOB            | Česká spořitelna  |
| NN Penzijní společnost DPS  | 5005004433/0800 | ČSOB            | Česká spořitelna  |
| KB Penzijní společnost DPS  | 300300232/0800  | ČSOB            | Česká spořitelna  |
| ČPP běžné (8 segmentů)      | 700135002/0800  | ČSOB            | Česká spořitelna  |
| ČPP mimořádné (8 segmentů)  | 700485002/0800  | ČSOB            | Česká spořitelna  |
| Conseq PS DPS extra         | 100010652/0800  | ČSOB            | Česká spořitelna  |
| Conseq PS DPS employer (nový) | 100010652/0800 | —              | Česká spořitelna  |

### 2) Conseq DPS — úplné přepracování

| Payment type | Účet / template                   | VS povinný | VS          | KS    | SS       | Poznámka |
| ------------ | --------------------------------- | ---------- | ----------- | ----- | -------- | -------- |
| regular      | `662266-{contractNumber}/2700`    | ✅ **TRUE** (fix) | číslo smlouvy | 558 | —     | Sdružená platba účastníka. v2 měla chybně FALSE + „VS se neuvádí". |
| extra        | 100010652/0800                    | ✅         | číslo smlouvy | 558 | 99     | MIMOŘÁDNÝ příspěvek účastníka. |
| employer     | 100010652/0800                    | ✅         | číslo smlouvy | 3552 | IČ zaměstnavatele | INDIVIDUÁLNÍ zaměstnavatelský příspěvek. |

**Pozor — hromadná zaměstnavatelská platba** má místo toho VS = IČ zaměstnavatele
a SS = RRRRMM. Tento případ v seedu nemáme jako samostatný řádek; místo toho je
pokryt `symbol_rules_note` na řádku employer, aby UI ukázal advisor varování a
ten zadal symboly ručně.

### 3) NN životní pojišťovna (ZP) — přidáno s productCode

Zdroj: <https://www.nn.cz/poradna/pojistovna/platby.html>

| Product code         | Účet           | Bank     | Poznámka                                   |
| -------------------- | -------------- | -------- | ------------------------------------------ |
| `contract_10_digit`  | 1000588419/3500 | ING Bank | Smlouvy s 10místným číslem. VS = číslo smlouvy. |
| `contract_8_digit`   | 1010101010/3500 | ING Bank | Smlouvy s 8místným číslem. Starší 8místné mohou mít jinou VS logiku — `symbol_rules_note` advisor upozorní. |

### 4) Direct — označeno jako FALLBACK

Direct oficiálně žádá klienty, aby platili podle konkrétních pokynů v pojistné
smlouvě, a veřejně uvádí dvě čísla účtů (123-1562900267/0100 a 2330257/0100).
Všechny řádky Directu nyní v notes mají explicitně napsáno „FALLBACK účet" a
`symbol_rules_note` připomíná poradci, ať ověří s platebními pokyny klienta.

### 5) Nová pole ve schématu

| Sloupec                    | Typ  | Použití                                                  |
| -------------------------- | ---- | -------------------------------------------------------- |
| `constant_symbol`          | TEXT | Statický KS (558, 3552, 3558). Modal předvyplní prázdné pole. |
| `specific_symbol_template` | TEXT | Literál („99") nebo placeholder (`{birthNumber}`, `{ico}`, `{yearMonth}`). Literály modal předvyplní, placeholdery jen naznačí v hintu. |
| `symbol_rules_note`        | TEXT | Textový popis pro složité symbol logiky (tooltip v UI).  |

## Ověřené řádky v3 — úplný přehled

### Allianz pojišťovna

| Segment            | Payment type | Účet                  | Bank            | KS | SS | Poznámka |
| ------------------ | ------------ | --------------------- | --------------- | -- | -- | -------- |
| ZP                 | regular      | 2700/2700             | UniCredit Bank  | —  | —  | Životní pojištění. |
| MAJ, ODP, CEST, FIRMA_POJ, AUTO_PR, AUTO_HAV | regular | 2727/2700 | UniCredit Bank | — | — | Neživotní + běžné pojistné auta. |
| AUTO_PR, AUTO_HAV  | first        | 20001-38138021/0100   | Komerční banka  | —  | —  | POUZE 1. pojistné. |

### Allianz penzijní společnost

| Segment | Payment type | Účet      | Bank           | Poznámka                                  |
| ------- | ------------ | --------- | -------------- | ----------------------------------------- |
| DPS     | regular      | 3033/2700 | UniCredit Bank | `symbol_rules_note`: účastník vs zaměstnavatel se liší KS — ověřte v rámcové smlouvě. |

### Kooperativa

| Segment                                        | Payment type | Účet                | Bank              | Poznámka |
| ---------------------------------------------- | ------------ | ------------------- | ----------------- | -------- |
| ZP, MAJ, AUTO_PR, AUTO_HAV, CEST, ODP, FIRMA_POJ | regular    | 2226222/0800        | **Česká spořitelna** | Univerzální běžné pojistné. |
| ODP_ZAM                                        | regular      | 40002-50404011/0100 | Komerční banka    | Zákonné pojištění odpovědnosti zaměstnavatele, VS = IČO. |

### Penzijní společnosti (DPS)

| Partner                       | Účet           | Bank                 | KS   | SS           | Poznámka |
| ----------------------------- | -------------- | -------------------- | ---- | ------------ | -------- |
| NN Penzijní společnost        | 5005004433/0800 | **Česká spořitelna** | —    | —            | `symbol_rules_note`: SS/KS se liší podle typu platby. |
| UNIQA Penzijní společnost     | 222333222/2700  | UniCredit Bank       | —    | —            | VS = číslo smlouvy. |
| ČSOB Penzijní společnost      | 2106990187/2700 | UniCredit Bank       | 3558 | `{birthNumber}` | VS = číslo smlouvy, SS = rodné číslo. |
| KB Penzijní společnost        | 300300232/0800  | **Česká spořitelna** | —    | —            | VS = číslo smlouvy. |

### ČPP (VIG)

| Payment type | Účet           | Bank                 | Poznámka                                       |
| ------------ | -------------- | -------------------- | ---------------------------------------------- |
| regular      | 700135002/0800 | **Česká spořitelna** | Běžné pojistné všech segmentů.                 |
| extra        | 700485002/0800 | **Česká spořitelna** | Mimořádné pojistné.                            |

### ČSOB pojišťovna

| Segment                                   | Účet            | Bank | Poznámka                                                         |
| ----------------------------------------- | --------------- | ---- | ---------------------------------------------------------------- |
| ZP                                        | 130450683/0300  | ČSOB | Životní pojištění.                                               |
| MAJ, AUTO_PR, AUTO_HAV, CEST, ODP, ODP_ZAM | 187078376/0300 | ČSOB | Neživotní retail.                                                |
| FIRMA_POJ                                 | 180135112/0300  | ČSOB | Podnikatelská rizika. Flotily používají 157411676/0300 (zatím nepřidáno). |

### Direct pojišťovna (FALLBACK)

| Segmenty                                       | Účet                | Bank           | Poznámka |
| ---------------------------------------------- | ------------------- | -------------- | -------- |
| ZP, MAJ, AUTO_PR, AUTO_HAV, ODP, CEST, FIRMA_POJ | 123-1562900267/0100 | Komerční banka | FALLBACK — alternativní účet 2330257/0100; platba podle pokynů v pojistné smlouvě klienta. |

### Pillow pojišťovna

| Segment  | Účet           | Bank      | Poznámka                                    |
| -------- | -------------- | --------- | ------------------------------------------- |
| MAJ, ODP | 501401304/2010 | Fio banka | Jeden VS pro všechny klientovy smlouvy.     |

### Conseq (investice + penze)

| Segment | Payment type | Product code             | Účet / template                 | KS   | SS           | Poznámka |
| ------- | ------------ | ------------------------ | ------------------------------- | ---- | ------------ | -------- |
| INV     | regular      | `active_horizont_invest` | `666777-{contractNumber}/2700`  | —    | —            | Active / Horizont Invest — bez VS. |
| INV     | regular      | `classic_invest_czk`     | 6850057/2700                    | —    | —            | Classic Invest (CZK), VS = číslo smlouvy. |
| DPS (Conseq PS) | regular | —                       | `662266-{contractNumber}/2700`  | **558** | —       | Sdružená platba účastníka. **VS povinný = číslo smlouvy** (fix oproti v2). |
| DPS (Conseq PS) | extra   | —                       | 100010652/**0800**              | **558** | **99**    | Mimořádný příspěvek účastníka. |
| DPS (Conseq PS) | employer | —                      | 100010652/**0800**              | **3552** | `{ico}` | Individuální zaměstnavatelský příspěvek. Hromadný employer (VS=IČ, SS=RRRRMM) pokryt v `symbol_rules_note`. |
| DIP     | employer     | —                        | 1388083926/2700                 | —    | `{ico}`      | DIP employer contribution. |

### NN životní pojišťovna

| Product code         | Účet           | Bank     | Poznámka                                   |
| -------------------- | -------------- | -------- | ------------------------------------------ |
| `contract_10_digit`  | 1000588419/3500 | ING Bank | Zdroj https://www.nn.cz/poradna/pojistovna/platby.html |
| `contract_8_digit`   | 1010101010/3500 | ING Bank | Starší smlouvy mohou mít jinou VS logiku (pokryto v `symbol_rules_note`). |

## Záměrně vynecháno ze seedu

### Generali Česká pojišťovna

Generali vede klienty přes platební workflow / klientskou zónu, univerzální
sběrný účet v aktuálních veřejných zdrojích neexistuje. Pro zákonné pojištění
odpovědnosti zaměstnavatele existuje zvláštní účet 90034-17433-021/0100, ale
ostatní produkty mají různé účty.

## Další známé nuance, které dnes seed NEpokrývá

- **ČSOB pojišťovna flotily** — 157411676/0300 (vyžadovalo by `product_code='fleet'` pro FIRMA_POJ).
- **Generali — zákonné pojištění odpovědnosti zaměstnavatele** 90034-17433-021/0100.
- **Conseq DPS hromadná employer platba** — VS = IČ, SS = RRRRMM (dokumentováno v `symbol_rules_note` na řádku employer).
- **NN životní** diferenciace dle délky čísla smlouvy řešena jen productCodem — advisor musí zvolit správnou variantu.
- **Allianz penze** — rozlišení účastníka vs zaměstnavatele přes KS advisor doplní ručně podle rámcové smlouvy.

## Migrace (idempotentní)

`packages/db/migrations/payment-accounts-institutional-defaults-2026-04-22.sql`:

1. `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` — přidá `constant_symbol`,
   `specific_symbol_template`, `symbol_rules_note` (+ sloupce z v2).
2. `DROP INDEX IF EXISTS payment_accounts_global_partner_name_segment_uniq` a
   recreate nového unique partial indexu na čtveřici
   `(partner_name, segment, COALESCE(payment_type,''), COALESCE(product_code,''))`
   `WHERE tenant_id IS NULL`.
3. `DELETE FROM payment_accounts WHERE tenant_id IS NULL` — vymaže všechny
   globální řádky z v1 i v2 (tenant overrides zůstávají).
4. Naseeduje ověřené řádky v3 z tabulek výše.

V transakci, s `RAISE NOTICE` pro audit.
