-- B2.7 (pre-launch audit 2026-04-22) — household membership uniqueness.
--
-- Problém: `household_members` nemělo žádný unique constraint na (tenant_id,
-- contact_id). Race conditions v `addContactToHousehold` (dva tab-y /
-- simultánní AI Review apply) vyráběly dvojitý row — klient pak viděl
-- household v portálu nedeterministicky a advisor měl duplicity v KPI.
--
-- Tento soubor je bezpečná varianta: používá CONCURRENTLY, aby neblokoval
-- běžící zápisy, a vytváří unique constraint jen pokud ještě neexistuje.
-- Před spuštěním musí být dupes vyřešené (viz „Ověřovací sada" v plánu):
--
--   SELECT contact_id, COUNT(*) FROM household_members
--    GROUP BY contact_id HAVING COUNT(*) > 1;
--
-- Pokud SELECT vrátí > 0, spusť merge skript (hand-picked) a AŽ PAK tohle.
-- Migration runner musí umět CONCURRENTLY (tj. spustit bez transakce, nebo
-- obalit do vlastního connection pool).
--
-- Rollback: DROP INDEX CONCURRENTLY IF EXISTS household_members_unique_contact;
-- (bezpečné — nezahazuje data, jen sundá constraint).

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS household_members_unique_contact
  ON household_members (contact_id);

-- Poznámka: v schema.ts je `contactId` nullable=false a refs contacts.id, ale
-- household_members nemá sloupec tenant_id (tenant se dědí přes household).
-- Kdyby někdy chtěl někdo přesunout contact mezi tenanty, musí nejdřív
-- updatnout household_id (cascade) — tento unique to nezlomí, protože je na
-- contact_id samotném.
