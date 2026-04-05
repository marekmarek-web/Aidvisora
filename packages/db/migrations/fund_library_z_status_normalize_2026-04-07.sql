-- Volitelné, idempotentní: duplicita UPDATE z konce `fund_library_settings_2026-04-06.sql`.
-- Název souboru `fund_library_z_*` zajišťuje běh PO `fund_library_settings_*` při abecedním řazení.
UPDATE fund_add_requests SET status = 'in_progress' WHERE status IN ('under_review', 'need_info');
UPDATE fund_add_requests SET status = 'added' WHERE status = 'approved';
UPDATE fund_add_requests SET status = 'new' WHERE status NOT IN ('new', 'in_progress', 'added', 'rejected');
