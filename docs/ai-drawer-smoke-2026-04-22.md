# AI Drawer / Assistant — runtime smoke verification

Datum: 2026-04-22
Autor: runtime smoke pass (statický sweep + ruční checklist)
Rozsah: desktop drawer, mobile chat, advisor + client assistant, image/payment/review flow, multi-intent, role/safety, observabilita

> **Pravidla zápisu**
> - `PASS` — ověřeno v runtime + side-effect dohledán v DB/CRM/portálu
> - `FAIL` — UI tvrdí hotovo a side-effect chybí, nebo akce spadne
> - `FLAKY` — občas projde, občas ne, neopakovatelně
> - `NOT VERIFIED (env)` — prostředí na to teď nemá co
> - `MANUAL VERIFY` — nelze staticky, potřebuje klik / zařízení
> - `ASSUMPTION` — vychází z kódu, ale runtime jsem neklikl
> - `STATIC OK` — fix je viditelný v kódu, runtime doklik stále potřeba
>
> U každého FAIL zapiš: `expected`, `observed`, `kde se to lámalo`, `severity` (P0 / P1 / P2), `proof` (řádek v `execution_actions`, audit row, Sentry event ID, screenshot).

---

## 0. Co je bez doklikání ověřeno staticky (před smoke)

> **Update 2026-04-22 po hardening commitu** — viz sekce 0A níže pro stav po proběhlém code fix batch.

Rychlý code-level kontrol konkrétních „fixů". Nemluvím o runtime, mluvím o tom, zda je fix v kódu vůbec přítomný.

- **referencedEntities persistence** — `STATIC OK`.
  V `apps/web/src/lib/ai/assistant-conversation-repository.ts` (L111 definice, L120 insert, L440 select, L454 mapper) je sloupec `referencedEntities` v DB i v read modelu. Runtime test (A.5, E.3) stále potřeba — persistovat a reloadnout.

- **Fingerprint duplicate guard v execution engine** — `STATIC OK`.
  `apps/web/src/lib/ai/assistant-execution-engine.ts` L271 (`computeStepFingerprint`), L282 (`checkRecentFingerprint`), L342 (`recordFingerprint`). Plus DB idempotency přes `execution_actions` ledger (L273 `checkIdempotency`).
  Fingerprint keys pro `savePaymentSetup` v `assistant-action-fingerprint.ts` L101–107: `contactId + providerName + accountNumber + iban + variableSymbol`. Pro `createContact` L35–47 pokrývá `firstName + lastName + email + phone + birthDate + personalId + adresa`. To D.2 duplicate test pokryje.

- **Mobile action chip handlery** — `STATIC OK`.
  `apps/web/src/app/portal/mobile/screens/AiAssistantChatScreen.tsx` L725–746 handluje: `open_review`, `open_portal_path`, `view_client`, `open_task`, `create_task`, `draft_email`. Což je nadmnožina toho, co asistent skutečně emituje v `map-action-payload-to-suggested.ts`: `open_portal_path`, `open_review`, `create_task`, `draft_email`, `view_client`. **Žádný dead chip na mobilu na úrovni typů.** Runtime doklik stále potřeba (B.1–B.8).

- **Ledger degraded warning** — `STATIC OK`.
  `assistant-execution-engine.ts` L34–36 export `ASSISTANT_LEDGER_DEGRADED_ADVISOR_WARNING`, flag `executionActionsTableAvailable` (L55), detekce přes `isRelationMissingError` (L67–70). Když tabulka chybí, idempotence tiše degraduje — uživatel to v UI uvidí jen pokud se warning skutečně propaguje do response. Runtime test (G.6).

- **Client assistant role gate** — `STATIC OK`.
  `apps/web/src/app/api/ai/client-assistant/chat/route.ts` L47 odmítá vše, kde `auth.roleName !== "Client"`. F.2 runtime doklik stále potřeba (error hláška nesmí leakovat interní detail).

- **Write adapter permission checks** — `PARTIAL`.
  `apps/web/src/lib/ai/assistant-write-adapters.ts` volá `hasPermission` explicitně v: `documents:write` (L107), `contacts:write` (L160, L243, L1075 createContract), `meeting_notes:write` (L502, L529, L551). **Zbytek adapterů (`createTask`, `createOpportunity`, `createFollowUp`, `scheduleCalendarEvent`, `sendPortalMessage`, `savePaymentSetup`, `upsertContactCoverage`, `createContract`, `publishPortfolioItem` atd.) nemá explicitní `hasPermission` check v adapteru samotném** — spoléhá na to, že podkladová `actions/*` funkce role vynutí sama. To pro Viewer F.1 znamená: behavior může vypadat správně, ale **pokud podkladová server action nevynucuje roli, Viewer Would projde**. `MANUAL VERIFY` pro každý write action type ve Viewer roli.

- **action-guards.ts pipeline** — `RED FLAG, nebrzdi smoke, ale zapiš`.
  Soubor `apps/web/src/lib/ai/action-guards.ts` s `validateActionExecution(...)` je v produkčním runtime **nevolaný**. Grep přes `apps/web/src` najde volání jen v `__tests__/action-guards.test.ts` a `__tests__/assistant-evals.test.ts`. To znamená, že celý guard pipeline (tenant isolation, permission, quality gate, duplicate prevention, client selection, execution mode) **v aktuálním flow neběží**.
  Role/tenant/duplicate ochrana se děje jinde (execution engine fingerprint + write adapter `assertCtx` tenant match + `hasPermission` pro část adapterů). Ale pokud ti někdo tvrdil „máme guard pipeline", v runtime ji neuvidíš. Patří do sekce VII jako **P2 hardening**, ne P0 blocker — *pokud* write adapter layer ověří Viewer správně.

- **HEIC pipeline** — `STATIC UNKNOWN`.
  Reference v `apps/web/src/lib/upload/validation.ts`, `apps/web/src/lib/security/file-signature.ts`, `apps/web/src/lib/ai/image-intake/route-handler.ts`. `MANUAL VERIFY` na iPhonu — statický grep nedokáže ověřit, že HEIC skutečně projde celou cestou (paste → upload → OpenAI vision → payment extract).

- **AI review referencedEntities chip po reload** — `ASSUMPTION`.
  Column `referencedEntities` v message row existuje; runtime chování chipu (klik → otevření review) záleží na mapperech `assistant-history-mapper.ts` + drawer rendereru. Doklik (A.5, E.3) je nutný.

---

## 0A. Hardening fixy provedené 2026-04-22 (před smoke)

Níže uvedené změny už jsou v pracovním stromu a projdou testy (39/39 targeted vitest suite zelených, 4 pre-existing failures v `regression-suite` + `mortgage-scenario` + `image-intake-*` + `legacy-envelope` ověřené jako pre-existing přes `git stash`).

### D-H1a — fingerprint keys pro `savePaymentSetup` rozšířeny

Soubor: [apps/web/src/lib/ai/assistant-action-fingerprint.ts](../apps/web/src/lib/ai/assistant-action-fingerprint.ts) L101–113.

Přidané klíče: `constantSymbol`, `specificSymbol`, `amount`, `frequency`, `firstPaymentDate`.

Dopad na smoke: D.2 (stejný JPG dvakrát = duplicate_hit) teď neohlásí false-positive u dvou odlišných plateb se stejným VS. D.5 fingerprint teď rozlišuje i podle částky / frekvence / data první platby.

### D-H1b — write adapter pro `savePaymentSetup` teď čte `constantSymbol` / `specificSymbol`

Soubor: [apps/web/src/lib/ai/assistant-write-adapters.ts](../apps/web/src/lib/ai/assistant-write-adapters.ts) L1095–1110.

Před fixem adapter tyto 2 params zahazoval, i když je `createManualPaymentSetup` server action přijímá (soubor [apps/web/src/app/actions/manual-payment-setup.ts](../apps/web/src/app/actions/manual-payment-setup.ts) L92–93) a DB sloupce `constantSymbol` / `specificSymbol` existují. Takže KS/SS z AI extraktu se nikdy nezapisovaly.

Dopad na smoke: D.5 teď musí v cílovém `client_payment_setups` řádku obsahovat KS/SS, pokud v originální platbě nejsou prázdné. Před tímto fixem byly vždy `null`.

### F-F1 cleanup — mrtvý `action-guards.ts` smazán

Smazáno:
- `apps/web/src/lib/ai/action-guards.ts`
- `apps/web/src/lib/ai/__tests__/action-guards.test.ts`
- 2 testy v [apps/web/src/lib/ai/__tests__/assistant-evals.test.ts](../apps/web/src/lib/ai/__tests__/assistant-evals.test.ts) (celý `describe("Tenant isolation")` + 1 `it` uvnitř `describe("Security -- no sensitive data leaks")`)

Důvod: `validateActionExecution` nebyl volán v žádném produkčním kódu — jen v testech. Existence mrtvého pipeline generovala falešný signál, že je tam guard vrstva, která tam fakticky nebyla. Ekvivalentní ochrany zůstaly: `assertCtx` tenant check ve write adapterech, fingerprint duplicate guard v execution engine, per-adapter `hasPermission`.

### F-F2 — `hasPermission` doplněn do 16 write adapterů

Soubor: [apps/web/src/lib/ai/assistant-write-adapters.ts](../apps/web/src/lib/ai/assistant-write-adapters.ts).

Per-adapter pokrytí po fixu:

| adapter | permission | kde |
|---|---|---|
| createOpportunity | `opportunities:write` | L116 |
| createServiceCase | `opportunities:write` | ~L283 |
| updateOpportunity | `opportunities:write` | ~L338 |
| createTask | `tasks:write` | ~L385 |
| updateTask | `tasks:write` | ~L414 |
| createFollowUp | `tasks:write` | ~L444 |
| scheduleCalendarEvent | `events:write` | ~L472 |
| createClientRequest | `opportunities:write` | ~L664 |
| updateClientRequest | `opportunities:write` | ~L694 |
| createMaterialRequest | `documents:write` | ~L726 |
| createReminder | `tasks:write` | ~L780 |
| approveAiContractReview | `ai_review:use` | ~L869 |
| applyAiContractReviewToCrm | `ai_review:use` | ~L882 |
| linkAiContractReviewToDocuments | `ai_review:use` | ~L895 |
| setDocumentVisibleToClient | `documents:write` | ~L910 |
| linkDocumentToMaterialRequest | `documents:write` | ~L923 |

Všechny přidané permissions odpovídají tomu, co má Advisor v [apps/web/src/shared/rolePermissions.ts](../apps/web/src/shared/rolePermissions.ts) (`opportunities:*`, `tasks:*`, `events:*`, `documents:*`, `ai_review:use`), takže Advisora nezablokuje. Viewer má jen `*:read`, takže každý adapter teď Viewera jasně zastaví advisor-safe hláškou `Chybí oprávnění <domain>:write.`.

**Dopad na smoke F.1**: předtím byl stav ASSUMPTION — spoléhali jsme na to, že podkladová server action permission zkontroluje. Teď je to defense-in-depth přímo v adapteru. Runtime doklik Viewer smoke (desktop checklist bod IX.15) už nemá být false-negative.

### Nechráněné adaptery (úmyslně nechané, risk behavior change)

- `createClientPortalNotification` — vyžadovala by `notifications:write`, kterou **Advisor NEMÁ** (jen Manager+). Přidání by Advisora zablokovalo v produkci.
- `draftEmail`, `draftClientPortalMessage`, `sendPortalMessage` — stejný problém (žádná `communications:*` permission v `rolePermissions.ts`).
- `publishPortfolioItem`, `updatePortfolioItem` — permission mapping (`contracts:*` / `portfolio:*`) v role modelu neexistuje.

Plán: zařadit do **F-F2.2 po smoke**, nejdřív rozšířit `rolePermissions.ts` o příslušné permissions a rolové mapping, pak doplnit adaptery. Bez předchozího rozšíření role modelu je přidání těchto checků produkční P0 regrese pro Advisora.

---

## I. Runtime smoke result (vyplň během smoke)

### A. Desktop drawer

- A.1 create_task klientovi — `___` — proof: `execution_actions.id=___`
- A.2 create_note klientovi — `___` — proof: `audit_logs row=___`
- A.3 open client ze suggested action — `___`
- A.4 open AI review ze suggested action / referenced entity — `___`
- A.5 reload konverzace → referencedEntities chips stále funkční — `___`
- A.6 změna klienta během rozdělané konverzace → další akce použije nový contactId — `___`
- A.7 cancel behavior (abort mid-request) → žádný ledger row se stavem `completed` — `___`
- A.8 smart scroll — `___`
- A.9 success UI vs CRM side-effect parita (micro-loop) — `___`

### B. Mobile drawer / chat

- B.1 suggested `create_task` chip → task vytvořen + navigace — `___`
- B.2 suggested `open_review` → review detail otevřen — `___`
- B.3 suggested `open_portal_path` → navigace na path — `___`
- B.4 reload session (tab pryč a zpět) → state drží — `___`
- B.5 image thumbs po reloadu — `___`
- B.6 keyboard / viewport / scroll — `MANUAL VERIFY (iPhone)`
- B.7 `create_task` chip po fixu není dead — `___` (po static sweep `STATIC OK` že handler existuje; runtime doklik)
- B.8 `contract_review` / `review` link — `___` (payload obsahuje `reviewId`)

### C. Multi-intent / grounding

- C.1 „založ kontakt a rovnou mu vytvoř úkol" — 2 akce v jednom planu, druhá má `contactId` první — `___`
- C.2 „u Jiřího Chlumeckého vytvoř úkol a poznámku" — obě akce na stejný contactId — `___`
- C.3 podobná jména → ambiguous resolution (není silent miss) — `___`
- C.4 follow-up bez jména klienta → použije active session contactId — `___`
- C.5 switch klienta mid-thread — viz A.6 — `___`
- C.6 child action parity (ani jeden child row s jiným contactId) — `___`

### D. Payment / image flows

- D.1 JPG screenshot → payment instruction — `___`
- D.2 stejný JPG znovu → idempotent hit, žádný druhý `payment_setups` row — `___` (fingerprint test)
- D.3 HEIC z iPhonu → payment instruction — `MANUAL VERIFY (iPhone)`
- D.4 payment setup props dorazí do správné entity — `___`
- D.5 pole: amount / frequency / payer account / payee account / VS / KS / SS / firstPaymentDate → 8 polí, každé musí pasovat s originálem — `___`
- D.6 drawer nehlásí hotovo pokud contact detail je prázdný — `___`

### E. AI review handoff

- E.1 upload smlouvy → review otevřen — `___`
- E.2 otevřený review odpovídá reálnému `contract_reviews.id` — `___`
- E.3 referencedEntities `{kind:'review',id}` po reloadu konverzace — `___`
- E.4 review chip desktop — `___`
- E.5 review chip mobile — `___`
- E.6 drawer nesmí říct „otevřel jsem review" pokud review ID v DB neexistuje — `___`

### F. Role / safety / boundaries

- F.1 Viewer → write action zablokována, advisor-safe hláška — `MANUAL VERIFY` (write adapters pokrývají hasPermission jen částečně, viz sekce 0)
- F.2 client assistant → error hláška bez internal leaku — `___`
- F.3 advisor → destructive akce vyžaduje explicit confirm před execute — `___`
- F.4 x-user-id spoof → server ignoruje header, použije Clerk identitu — `MANUAL VERIFY (curl)`
- F.5 cross-tenant bleed → druhý tenant nevidí referencedEntities prvního — `ASSUMPTION` (záleží na RLS migracích z 2026-04-19/21)

### G. Observability

Pro každý FAIL z A–F vyplnit, zda existuje:

- G.1 application log s `requestId` — `___`
- G.2 `audit_logs` row — `___`
- G.3 `assistant_events` row — `___`
- G.4 Sentry event s tenantId / sessionId / actionType tags — `___`
- G.5 rozlišitelnost failure typů (abort / timeout / quality_gate_fail / permission_fail / missing_entity / duplicate_hit / partial_failure) — `___`
- G.6 ledger degraded warning se propaguje do UI, když `execution_actions` chybí — `NOT VERIFIED (env)` (vyžaduje nonprod DB bez tabulky)
- G.7 client assistant error neobsahuje internal leak — parita s F.2

---

## II. Verified fixes (vyplň po smoke)

Kategorie: **plně funkční v runtime** / **funguje částečně** / **stále nedůvěryhodné**.

- Fully verified in runtime: `___`
- Partially verified: `___`
- Not trustworthy yet: `___`

## III. Failures / regressions

Per položka:
- scénář ID (např. `D.2`)
- expected
- observed
- kde se to lámalo (soubor:řádek nebo vrstva)
- severity (P0 / P1 / P2)
- proof link

## IV. Dead UI / false success

- Kde UI tvrdí úspěch bez side-effectu: `___`
- Kde reload rozbije návaznost: `___`
- Kde chip vypadá klikatelně, ale nic nedělá: `___`

## V. Permission / safety result

- Advisor: `___`
- Viewer: `___` (pozor: guard pipeline v action-guards.ts není v runtime zapojena; spoléhá se na write adaptery a server actions)
- Client assistant: `___`
- Cross-tenant / cross-client isolation: `___`
- Confirmation guard před destructive action: `___`

## VI. Observability result

- Co se zalogovalo: `___`
- Co chybí: `___`
- Co v Sentry / audit trail není dohledatelné: `___`
- Co z UI nelze vysvětlit: `___`

## VII. Mini fix batch (jen pokud FAIL)

Rozděleno na:

### P0 — live demo blocker
*(zatím prázdné; doplň po smoke)*

### P1 — první uživatelé blocker
Kandidát z static sweep (nevybít bez rozhodnutí): zapojit `validateActionExecution` do execution pipeline, aby tenant isolation / permission / quality gate / duplicate / client selection check neběžely jen v testech. Risk: duplicitní s write-adapter permission checks, nutno smířit. Pokud write adapter layer odpovídá 1:1, může to být jen P2 hardening.

### P2 — hardening
- `action-guards.ts` mrtvé — buď zapojit, nebo explicitně smazat, aby další auditor ho nepovažoval za aktivní ochranu.
- Sjednotit permission check napříč adaptery (v současnosti jen část volá `hasPermission` explicitně, zbytek spoléhá na server actions).

## VIII. Hard verdict

Vyplň až po smoke. Šablona:

- Live demo safe? **ano / ne** — zdůvodnění: `___`
- První poradci safe? **ano / ne** — zdůvodnění: `___`
- První klienti safe? **ano / ne** — zdůvodnění: `___`
- Mobil safe? **ano / ne** — zdůvodnění: `___`
- Co bych ještě neukazoval: `___`

---

## IX. Desktop — co prokliknout dnes večer (17 kroků)

Prostředí: Chrome, 2 taby (drawer + CRM detail klienta), otevřený DevTools Network + Supabase SQL editor.

1. Login jako advisor, otevřít drawer z dashboardu.
2. „Vytvoř úkol Jiřímu Chlumeckému — ověření adresy, do pátku." → confirm → ověř `tasks` row, `execution_actions.actionType='createTask'`, audit row. (**A.1**)
3. „Přidej poznámku klientovi: zavolat k potvrzení adresy." → confirm → ověř `notes` row + audit. (**A.2**)
4. Klik na suggested chip `Otevřít klienta` → URL `/portal/contacts/<id>` odpovídá klientovi z kroku 2. (**A.3**)
5. Nahraj PDF smlouvy do drawer → drawer vytvoří review → klik na `Otevřít review` → URL `/portal/contracts/review/<id>`. (**A.4, E.1, E.2**)
6. F5 reload konverzace → review chip + contact chip musí zůstat klikatelné a vést na stejné ID. (**A.5, E.3, E.4**)
7. V CRM rychle přepni na jiného klienta, vrať se do drawer, pošli „Vytvoř úkol: splnit zákaznický dotazník." → ověř že task se uloží na AKTUÁLNÍHO klienta, ne na původního z vlákna. (**A.6, C.5**)
8. Spusť pomalou akci → okamžitě klikni cancel → ověř že žádný `execution_actions` row nemá `status='completed'` pro tuto sessionId. (**A.7**)
9. V drawer poslat dlouhou odpověď (např. „vysvětli mi všechny typy životního pojištění") → nech ji odjet, pak scrolluj nahoru a pošli další zprávu → drawer nesmí skočit dolů, dokud nedokončíš vstup. (**A.8**)
10. Paste JPG platby → confirm → ověř částku/frekvenci/VS/KS/SS/účet/datum v contact detailu proti originálu. (**D.1, D.4, D.5**)
11. Paste ten samý JPG znovu → drawer musí vrátit `duplicate_hit` nebo idempotent hit, žádný druhý `payment_setups` row. (**D.2**)
12. „Založ nový kontakt: Marek Testovací, narozen 1.1.1990, a rovnou mu vytvoř úkol: pozvat na schůzku." → ověř 2 řádky v `execution_actions` se stejným `sessionId`, druhý má `contactId` prvního. (**C.1, C.6**)
13. „U Jiřího Chlumeckého vytvoř úkol a poznámku" (pokud existují 2 Jiří Chlumecký, musí se zeptat). (**C.2, C.3**)
14. Po jedné akci bez jména klienta: „Ještě mu přidej poznámku." → musí použít posledního aktivního klienta. (**C.4**)
15. Logout, login jako Viewer → spustit `create_task` → musí se zastavit s „Chybí oprávnění" nebo advisor-safe hláškou, žádný ledger write. (**F.1**)
16. Back to advisor → drawer: „smaž kontakt X" → musí vyžadovat explicit confirm před execute. (**F.3**)
17. Každý FAIL doplň do sekce III s Sentry event ID a audit row ID.

## X. iPhone — co prokliknout dnes večer (12 kroků)

Prostředí: iPhone (Safari + portal.aidvisora), mít po ruce HEIC foto platebního příkazu a ten samý jako JPG export.

1. Otevři mobile portal, přejdi na AI assistant tab.
2. „Vytvoř úkol pro Jiřího Chlumeckého — doručit KV." → confirm → v CRM desktop ověř že task existuje. (**B.1, micro-loop**)
3. „Otevři review X" nebo klik na suggested `open_review` chip → navigace na review detail. (**B.2, B.8, E.5**)
4. Suggested chip `view_client` → navigace na contact detail. (**B.3**)
5. Přepni do jiného tabu a zpět → session drží, chat bubbles nemizí. (**B.4**)
6. Image thumbnails zobrazené v chat history musí být dostupné (ne broken image). (**B.5**)
7. Otevři keyboard (klikni do input) → ověř že drawer layout nevykopne composer pod klávesnici, scroll funguje. (**B.6**)
8. Vyfoť platbu (Camera → použij originál jako HEIC) → paste do drawer → ověř že HEIC projde pipeline a dostaneš payment extract. (**D.3**)
9. Ověř že částka/frekvence/VS/účet/datum v přijatém payment extractu odpovídají realitě. (**D.5 mobilní verze**)
10. Klik na `create_task` chip po úspěšném extractu → ověř side-effect v CRM. (**B.7**)
11. Zkus poslat zprávu přes flaky síť (Airplane mode on/off) → drawer musí vrátit uživatelsky srozumitelnou chybu, ne stack trace. (**F.2 parita**)
12. Každý FAIL nafoť screenshot + zapiš do sekce III.

## XI. Ráno před live demem (7 checkpointů, ~15 min)

1. Sentry → filtruj posledních 12h pro `project:aidvisora-web`, tag `assistant.*` → zkontroluj, zda v noci neběží nový typ chyby. Pokud ano, rozhodni mute / fix / postpone demo.
2. `execution_actions` v Supabase → posledních 12h: zkontroluj že nejsou řádky se `status='failed'` bez korespondujícího audit_log. Osiřelá selhání = něco v logice errování.
3. Smoke 3 základní flow na demo účtu: create_task, create_note, payment from JPG. Každé s micro-loopem (UI → DB → reload). Pokud jakýkoli FAIL, demo BEZ ASISTENTA.
4. Mobile single pass: otevřít portal na iPhonu, zkusit `create_task` chip, ověřit že task dorazí. Pokud FAIL, mobile drawer na demu **off**.
5. Viewer negative test: jedno rychlé přihlášení jako Viewer a pokus o write. Musí se zastavit.
6. Ověř že `execution_actions` a `audit_logs` tabulky existují na demo DB (nejsou degraded). Pokud `ASSISTANT_LEDGER_DEGRADED_ADVISOR_WARNING` visí někde v response, demo BEZ ASISTENTA — idempotence neposkytuje ochranu.
7. Připrav si seznam „co bych neukazoval" z sekce VIII jako záložku, aby ses na demu nezašel tam, kde je FLAKY.

---

## Appendix — soubory, na které směřují důkazy

- Execution engine + idempotency: [apps/web/src/lib/ai/assistant-execution-engine.ts](../apps/web/src/lib/ai/assistant-execution-engine.ts)
- Fingerprint guard: [apps/web/src/lib/ai/assistant-action-fingerprint.ts](../apps/web/src/lib/ai/assistant-action-fingerprint.ts)
- Action guards (mrtvé v runtime): [apps/web/src/lib/ai/action-guards.ts](../apps/web/src/lib/ai/action-guards.ts)
- Write adaptery + per-action hasPermission: [apps/web/src/lib/ai/assistant-write-adapters.ts](../apps/web/src/lib/ai/assistant-write-adapters.ts)
- Advisor chat route: [apps/web/src/app/api/ai/assistant/chat/route.ts](../apps/web/src/app/api/ai/assistant/chat/route.ts)
- Client assistant role gate: [apps/web/src/app/api/ai/client-assistant/chat/route.ts](../apps/web/src/app/api/ai/client-assistant/chat/route.ts)
- Conversation repository + referencedEntities: [apps/web/src/lib/ai/assistant-conversation-repository.ts](../apps/web/src/lib/ai/assistant-conversation-repository.ts)
- Desktop drawer: [apps/web/src/app/portal/AiAssistantDrawer.tsx](../apps/web/src/app/portal/AiAssistantDrawer.tsx), [apps/web/src/app/portal/today/DashboardAiAssistant.tsx](../apps/web/src/app/portal/today/DashboardAiAssistant.tsx)
- Mobile chat screen: [apps/web/src/app/portal/mobile/screens/AiAssistantChatScreen.tsx](../apps/web/src/app/portal/mobile/screens/AiAssistantChatScreen.tsx)
- Suggested action mapper (co se vůbec emituje do UI): [apps/web/src/lib/ai/map-action-payload-to-suggested.ts](../apps/web/src/lib/ai/map-action-payload-to-suggested.ts)
- Image intake / HEIC: [apps/web/src/lib/ai/image-intake/route-handler.ts](../apps/web/src/lib/ai/image-intake/route-handler.ts), [apps/web/src/lib/upload/validation.ts](../apps/web/src/lib/upload/validation.ts), [apps/web/src/lib/security/file-signature.ts](../apps/web/src/lib/security/file-signature.ts)
- Payment from image: [apps/web/src/app/actions/ai-payment-from-image.ts](../apps/web/src/app/actions/ai-payment-from-image.ts), [apps/web/src/app/actions/manual-payment-setup.ts](../apps/web/src/app/actions/manual-payment-setup.ts)
- Observability: [apps/web/src/lib/observability/assistant-sentry.ts](../apps/web/src/lib/observability/assistant-sentry.ts), [apps/web/src/lib/ai/assistant-telemetry.ts](../apps/web/src/lib/ai/assistant-telemetry.ts)
