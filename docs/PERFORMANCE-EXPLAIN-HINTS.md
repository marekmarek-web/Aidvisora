# SQL: EXPLAIN pro hot path (Aidvisora)

Spusťte v **Supabase SQL Editor** nebo `psql` proti produkční DB (read-only role). Cíl: ověřit, že plánovač používá indexy z [`packages/db/supabase-schema.sql`](../packages/db/supabase-schema.sql) a migrací (`idx_contacts_tenant_active`, `idx_messages_tenant_unread_client`, …).

## Kontakty (tenant + aktivní)

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, first_name, last_name, email, phone
FROM contacts
WHERE tenant_id = '<tenant_uuid>' AND archived_at IS NULL
ORDER BY last_name, first_name
LIMIT 500;
```

## Nepřečtené zprávy (badge)

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(DISTINCT m.contact_id)::int AS cnt
FROM messages m
WHERE m.tenant_id = '<tenant_uuid>'
  AND m.sender_type = 'client'
  AND m.read_at IS NULL;
```

## Úkoly / pipeline (příklad)

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*)::int
FROM tasks
WHERE tenant_id = '<tenant_uuid>' AND completed_at IS NULL;
```

Po nasazení nových indexů zkontrolujte `Index Scan` / `Bitmap Index Scan` místo `Seq Scan` na velkých tabulkách.
