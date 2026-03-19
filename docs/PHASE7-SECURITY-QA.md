# Phase 7 Security QA Matrix

## Auth and Session
- [ ] iOS: login, kill app, reopen -> session persists.
- [ ] Android: login, kill app, reopen -> session persists.
- [ ] Local logout invalidates current device session only.
- [ ] "Odhlásit všechna zařízení" invalidates active sessions on another device.
- [ ] Protected routes reject unauthorized access after logout.

## Upload Security
- [ ] Upload valid PDF/JPEG/PNG/WEBP/GIF/HEIC succeeds.
- [ ] MIME spoofing is rejected (declared PDF with non-PDF content).
- [ ] Oversized upload (>20MB) is rejected.
- [ ] Invalid UUID identifiers in upload payload are rejected.
- [ ] Repeated upload with same `Idempotency-Key` returns replay/duplicate protection behavior.

## Signed URLs and Access Control
- [ ] Document download works for authorized user.
- [ ] Unauthorized tenant access to file returns 403/404.
- [ ] Client user can only access own allowed files.
- [ ] Signed URL expires as expected (short-lived policy).

## Push Device Security
- [ ] Register token writes/updates device record.
- [ ] Revoke single token disables that device.
- [ ] Revoke all devices disables all tokens for user in tenant.
- [ ] Register/revoke events are present in audit log.

## API Resilience and Limits
- [ ] Upload endpoint returns 429 on burst requests.
- [ ] Push devices endpoint returns 429 on burst requests.
- [ ] Retry-after header is present on 429 responses.
- [ ] Push registration survives transient network failure (retry/backoff).

## Audit and Monitoring
- [ ] Audit records include `ip_address`.
- [ ] Audit records include `user_agent`.
- [ ] Audit meta includes `requestId` when header is present.
- [ ] Security-sensitive actions (upload/download/revoke) are logged.

## Operational Guardrails
- [ ] Production blocks `/api/contracts/debug-auth`.
- [ ] Production requires `CRON_SECRET` for cron route.
- [ ] Production ignores `NEXT_PUBLIC_SKIP_AUTH`.
