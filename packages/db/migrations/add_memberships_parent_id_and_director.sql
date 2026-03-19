ALTER TABLE memberships
ADD COLUMN IF NOT EXISTS parent_id text;

CREATE INDEX IF NOT EXISTS memberships_tenant_parent_idx
ON memberships (tenant_id, parent_id);

INSERT INTO roles (tenant_id, name, created_at)
SELECT t.id, 'Director', now()
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM roles r
  WHERE r.tenant_id = t.id
    AND r.name = 'Director'
);
