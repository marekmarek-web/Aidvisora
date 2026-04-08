# Registry pojišťoven pro výpovědi / ukončení smluv v Aidvisoře

Datum zpracování: 2026-04-08

## Jak to číst
- **Typ adresy**
  - **speciální doručovací / korespondenční adresa** = pojišťovna výslovně uvádí jinou adresu než sídlo nebo výslovně uvádí, že je určená pro dokumenty / změny / ukončení.
  - **sídlo / kontaktní adresa** = nenašel jsem na oficiálním webu samostatnou speciální adresu pro ukončení; pro registry MVP je vhodné použít tuto adresu a současně v UI nabídnout preferovaný kanál.
  - **primárně online / formulář / e-mail** = pojišťovna zjevně tlačí ukončení přes online formulář, klientskou zónu nebo e-mail; poštovní adresa zůstává jako fallback.

## Doporučené pole do DB
- `name`
- `aliases`
- `termination_address`
- `termination_address_type`
- `preferred_channel`
- `requires_official_form`
- `notes`
- `source_checked_at`

---

## Praktický seznam pojišťoven relevantních pro český trh a Aidvisoru

| Pojišťovna | Doporučená adresa / kanál pro výpověď | Typ adresy | Poznámka pro registry |
|---|---|---|---|
| Allianz pojišťovna, a.s. | Ke Štvanici 656/3, 186 00 Praha 8; zároveň online formulář / info@allianz.cz / pobočka | sídlo / kontaktní adresa | Allianz ve FAQ uvádí, že ukončení lze poslat elektronicky nebo poštou na adresu pojišťovny. |
| Kooperativa pojišťovna, a.s., Vienna Insurance Group | Brněnská 634, 664 42 Modřice; info@koop.cz | speciální doručovací / kontaktní adresa | Pro doručování a ukončení používá Kooperativa kontaktní adresu v Modřicích, nikoli jen pražské sídlo. |
| Generali Česká pojišťovna a.s. | P.O. Box 305, 659 05 Brno | speciální doručovací adresa pro dokumenty | Generali na kontaktu výslovně uvádí adresu pro doručení dokumentů. |
| Česká podnikatelská pojišťovna, a.s., Vienna Insurance Group | P.O.BOX 28, 664 42 Modřice | speciální korespondenční adresa | ČPP rozlišuje centrálu v Praze a korespondenční / klientskou adresu v Modřicích. |
| ČSOB Pojišťovna, a.s., člen holdingu ČSOB | primárně Klientská zóna / online formulář; fallback Masarykovo náměstí 1458, 530 02 Pardubice | primárně online / formulář | ČSOB u výpovědí neživotního pojištění tlačí klientskou zónu a online formuláře; životní pojištění řeší přes poradce / pobočku. |
| UNIQA pojišťovna, a.s. | pro žádosti poštou: Úzká 488/8, 602 02 Brno; obecné sídlo Evropská 810/136, 160 00 Praha 6 | speciální poštovní adresa pro žádosti | UNIQA na webu u ukončení uvádí poštovní adresu do Brna, ne jen pražské sídlo. |
| Direct pojišťovna, a.s. | primárně klientská zóna / online formuláře; fallback Nové sady 996/25, 602 00 Brno | primárně online | Direct výslovně nabízí online ukončení; poštovní adresa slouží jako fallback. |
| Pillow pojišťovna, a. s. | primárně e-mail z evidovaného e-mailu klienta na info@pillow.cz; pokud fyzicky poštou, Tomíčkova 2144/1, 148 00 Praha 4 | primárně e-mail | Pillow výslovně říká, že formulář není potřeba a ukončení je ideálně přes e-mail z adresy vedené u smlouvy. |
| Slavia pojišťovna a.s. | Táborská 940/31, 140 00 Praha 4 | sídlo / kontaktní adresa | Ve formuláři pro ukončení je v záhlaví uvedena Táborská 940/31. U aut má současně online cestu. |
| NN Životní pojišťovna N.V., pobočka pro Českou republiku | Nádražní 344/25, 150 00 Praha 5; případně online přes ePodatelnu NN | sídlo + online | NN má i online ePodatelnu pro výpověď smlouvy. |
| MetLife Europe d.a.c., pobočka pro Českou republiku | Purkyňova 2121/3, 110 00 Praha 1 | sídlo / kontaktní adresa | Na oficiálním kontaktu je sídlo v Praze 1; používá se i u formulářů pro klientské podání. |
| Simplea pojišťovna, a.s. | Türkova 2319/5b, 149 00 Praha 4 - Chodov | sídlo / kontaktní adresa | Na webu má obecný kontakt na centrálu; nenašel jsem samostatnou speciální adresu pro ukončení. |
| BNP Paribas Cardif Pojišťovna, a.s. | primárně online formulář; zákaznický servis Boudníkova 2506/1, 180 00 Praha 8 | primárně online / kontaktní centrum | Cardif výslovně uvádí online formulář i pro ukončení smlouvy. |
| Colonnade Insurance S.A., organizační složka | Na Pankráci 1683/127, 140 00 Praha 4 | sídlo / kontaktní adresa | Pro dokumenty poštou Colonnade odkazuje na adresu sídla v Praze 4. |
| D.A.S. Rechtsschutz AG, pobočka pro ČR | Vyskočilova 1481/4, 140 00 Praha 4 - Michle; případně e-mail / datová schránka | sídlo / kontaktní adresa | D.A.S. umožňuje výpověď e-mailem, doporučeným dopisem i datovou schránkou. |
| ERGO Cestovní Pojišťovna, a.s. (ERV) | Křižíkova 237/36a, 186 00 Praha 8 | sídlo / kontaktní adresa | Na webu i v dokumentech je konzistentně uváděna tato adresa. |
| Hasičská vzájemná pojišťovna, a.s. | Římská 2135/45, 120 00 Praha 2; případně info@hvp.cz | sídlo / kontaktní adresa | HVP v FAQ výslovně uvádí, že ukončení lze zaslat e-mailem nebo dopisem na tuto adresu. |
| HALALI, všeobecná pojišťovna, a.s. | Vinohradská 1632/180, 130 00 Praha 3 | sídlo / korespondenční adresa | HALALI uvádí stejnou adresu jako sídlo i korespondenční adresu. |
| Komerční pojišťovna, a.s. | pro změny a ukončení: Palackého 53, 586 01 Jihlava | speciální adresa pro podklady k pojistným smlouvám | KB Pojišťovna rozlišuje sídlo v Praze 5 a speciální poštovní adresu v Jihlavě pro změny a ukončení. |
| MAXIMA pojišťovna, a.s. | Italská 1583/24, 120 00 Praha 2 | sídlo / kontaktní adresa | Nenašel jsem zvláštní ukončovací adresu; použijte centrálu. |
| SV pojišťovna a.s. | Vyskočilova 1481/4, 140 00 Praha 4 | sídlo / kontaktní adresa | SV pojišťovna zároveň odkazuje na online klientský servis pro změny smluv a škody. |
| YOUPLUS Životní pojišťovna, pobočka pro Českou republiku | Vlněna Office Park, Přízova 5, 602 00 Brno; info@youplus.cz | kontaktní adresa | YOUPLUS má sídlo Přízova 526/5, ale v ukončovacím formuláři a kontaktech používá kontaktní adresu Vlněna Office Park, Přízova 5. |
| Agra pojišťovna, organizační složka | Starodejvická 1899/4, 160 00 Praha 6 | sídlo / kontaktní adresa | Specializovaná pojišťovna; smysluplná spíš pro specializované registry než běžné retail CRM. |
| Exportní garanční a pojišťovací společnost, a.s. (EGAP) | poštovní adresa: P. O. Box 6, 111 21 Praha 1; sídlo Vodičkova 34/701, 111 21 Praha 1 | speciální poštovní adresa | Specializovaná státní exportní pojišťovna; spíše mimo běžný poradenský retail flow. |

---

## Důležité implementační poznámky pro Aidvisoru

1. **Nedržet jen jedno pole `address`.**  
   Doporučuji minimálně:
   - `headquarters_address`
   - `termination_address`
   - `termination_address_type`
   - `preferred_channel`
   - `notes`

2. **Přidat flag `termination_flow_type`.**
   Například:
   - `postal_free_form`
   - `postal_form_required`
   - `online_form_preferred`
   - `email_from_registered_contact`
   - `advisor_or_branch_required`

3. **Přidat `confidence_level`.**
   - `high` = pojišťovna výslovně uvádí adresu pro dokumenty / ukončení
   - `medium` = výslovně uvádí kontaktní centrum nebo korespondenční adresu, ale ne jen pro ukončení
   - `low` = zatím jen sídlo / obecný kontakt

4. **Nechat produktové override.**
   Některé pojišťovny mohou mít jinou cestu pro:
   - životní pojištění
   - neživotní pojištění
   - povinné ručení / havarijní pojištění
   - cestovní pojištění
   - skupinové / bankopojištění

5. **ČSOB, Direct, Pillow, Cardif a částečně NN / UNIQA** by v UI měly mít přednostně tlačítko nebo badge typu:
   - `Preferovaný online postup`
   - `Možné i poštou`
   - `Vyžaduje formulář / klientskou zónu`

---

## Co bych zavedl hned v první live verzi
- Seednout výše uvedený seznam do registry tabulky.
- U každé pojišťovny zobrazit:
  - název,
  - adresu pro ukončení,
  - typ adresy,
  - doporučený kanál,
  - krátké upozornění.
- U pojišťoven s jasně preferovaným online kanálem nechat poštovní adresu jen jako fallback.
- U Kooperativy, Generali, ČPP, Komerční pojišťovny a UNIQA nepoužít jen sídlo; mají lepší / specifičtější doručovací nebo poštovní cesty.

---

## Poznámka ke scope
Tento list je dělaný pro **praktické použití v Aidvisoře**: tedy pro pojišťovny, které reálně dávají smysl v českém poradenském a klientském flow.  
Nejde o úplný právně-absolutní export všech pojišťovacích a zajišťovacích subjektů z ČNB/JERRS včetně všech přeshraničně notifikovaných institucí. Pro úplně exhaustivní regulatorní seznam je jako zdroj pravdy potřeba ČNB/JERRS.
