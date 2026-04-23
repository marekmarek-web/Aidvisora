# iOS push — minimální runtime smoke checklist

**Kdy:** před klikem **Submit for Review** v App Store Connect, a pak po každém release buildu, který mění nativní side (Podfile, Capacitor plugin, AppDelegate, entitlements, Firebase config).

**Prerekvizita (repo-side):** `bash apps/web/scripts/cap-smoke.sh` projde bez FAIL (spouští `assert-fcm-config.mjs` + unit testy + build + `cap sync`).

**Co potřebuješ:**
- Fyzický iPhone (ne simulator — APNs/FCM nefunguje v simulatoru pro FCM).
- TestFlight build aktuální verze.
- Přístup do Firebase console (pro fallback test přes Cloud Messaging composer).
- Druhý účet pro trigger (advisor → klient nebo obráceně).

---

## A. Registrace tokenu (first-run)

- [ ] **A.1** Smaž app z telefonu (clean state) + install z TestFlightu.
- [ ] **A.2** Otevři app → projdi login → OS zobrazí system dialog „Aidvisora by chtěla zasílat upozornění" → **Allow**.
- [ ] **A.3** V Safari na macu přes remote inspector otevři app → Application → Local Storage → najdi klíč `aidvisor.push.token`.
  - Hodnota musí být **FCM registration token** (Base64URL-ish string ~140–200 znaků, typicky obsahuje dvojtečku jako oddělovač project/instance). **NE** 64-znakový hex APNs token.
- [ ] **A.4** V DB (Supabase → `public.user_devices`) musí být row s `push_token = <hodnota z A.3>`, `platform = 'ios'`, `push_enabled = true`, `revoked_at IS NULL`.
- [ ] **A.5** V Sentry za posledních 15 min **žádný** `push.fcm.config_error`.

## B. Happy-path delivery (foreground)

- [ ] **B.1** App v popředí. Z druhého účtu pošli novou zprávu (advisor → klient nebo opačně).
- [ ] **B.2** Banner se objeví v top-notch notifikaci (in-app banner z FirebaseMessaging `notificationReceived` listener).
- [ ] **B.3** `notificationLog` row: `status = 'sent'`, `channel = 'push'`, `template` odpovídá event typu.

## C. Happy-path delivery (background / locked)

- [ ] **C.1** Zamkni telefon.
- [ ] **C.2** Trigger stejný event. Notifikace dorazí na lock screen do ~5 s.
- [ ] **C.3** Tap → app se otevře na správnou route (messages / request / document) přes `notificationActionPerformed`.

## D. Token refresh + revoke

- [ ] **D.1** Logout v app → `revokeStoredPushToken()` zavolá DELETE `/api/push/devices` → v DB má řádek `revoked_at != NULL`.
- [ ] **D.2** Login zpět → nový token přibude (může být stejná hodnota, ale `revoked_at IS NULL`).
- [ ] **D.3** Odinstaluj app → pošli push → v DB se řádek do ~24 h označí `revoked_at` přes FCM `UNREGISTERED` / `NOT_FOUND` (`classifyFcmError → token_dead`).

## E. Kill-switch (ops sanity, nikoliv submit blocker)

- [ ] **E.1** `vercel env add PUSH_KILL_SWITCH production` → `1`. Redeploy NEPOTŘEBA.
- [ ] **E.2** Trigger event → `sendPushToUser` vrací `{ sent: 0, failed: 0, skipped: true }`. V Sentry breadcrumb `push.kill_switch_active`.
- [ ] **E.3** `vercel env rm PUSH_KILL_SWITCH production` → následný event doručen.

## F. Failure taxonomy (quick manual)

Proženeš jen pokud měníš push sender kód. Jinak skip.

- [ ] **F.1** Úmyslně nastav `FCM_SERVICE_ACCOUNT_JSON` na JSON z **jiného** Firebase projektu → expected `SENDER_ID_MISMATCH` → Sentry `push.fcm.config_error` + device **NEní** revokovaný.
- [ ] **F.2** Obnov správný `FCM_SERVICE_ACCOUNT_JSON`.

---

## Go / no-go

Projde pokud **všechny A + B + C + D** jsou zelené na fyzickém iPhonu s TestFlight buildem. E a F jsou volitelné (ops sanity).

Pokud cokoliv v A selže, **NENÍ to blocker pro Submit for Review**, ale je to blocker pro veřejný launch — bez úspěšné registrace tokenu push kanál neexistuje. Troubleshooting: [`docs/runbook-push.md`](../runbook-push.md) §Troubleshooting.
