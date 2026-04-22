-- Board labels persist — per-tenant perzistence štítků pro monday-like Board.
-- Datum: 2026-04-22
--
-- Do 2026-04-22 byly štítky drženy pouze v `localStorage` pod klíčem
-- `aidvisora_labels`. Desktop a mobilní WebView (Capacitor iOS) však mají
-- **samostatný** WebKit localStorage, takže poradce viděl jiné sady štítků
-- na každém zařízení. Tato migrace zavádí server-side perzistenci:
--
--   * `id` — zachováváme existující `label_<timestamp>` formát kvůli
--            zpětné kompatibilitě se sloupci `statusLabel` v `contracts`,
--            `contacts` atp.
--   * `tenant_id` — povinný, RLS dle `app.tenant_id` (stejný pattern jako
--                   ostatní tenant-scoped tabulky v M3/M4).
--   * `is_closed_deal` — kterým štítkem se obchod považuje za uzavřený
--                        (pipeline analytics).
--   * `sort_index` — ruční řazení v Edit Labels editoru.
--
-- Seedování: klient (web/mobile) při prvním načtení, když DB vrátí prázdno
-- a `localStorage.aidvisora_labels` má data, uploadne vše do DB a LS smaže.

BEGIN;

CREATE TABLE IF NOT EXISTS public.board_labels (
  id text PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  color text NOT NULL,
  is_closed_deal boolean NOT NULL DEFAULT false,
  sort_index int NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS board_labels_tenant_sort_idx
  ON public.board_labels (tenant_id, sort_index, created_at);

ALTER TABLE public.board_labels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS board_labels_tenant_select ON public.board_labels;
CREATE POLICY board_labels_tenant_select
  ON public.board_labels FOR SELECT TO authenticated, aidvisora_app
  USING (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid);

DROP POLICY IF EXISTS board_labels_tenant_insert ON public.board_labels;
CREATE POLICY board_labels_tenant_insert
  ON public.board_labels FOR INSERT TO authenticated, aidvisora_app
  WITH CHECK (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid);

DROP POLICY IF EXISTS board_labels_tenant_update ON public.board_labels;
CREATE POLICY board_labels_tenant_update
  ON public.board_labels FOR UPDATE TO authenticated, aidvisora_app
  USING (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid)
  WITH CHECK (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid);

DROP POLICY IF EXISTS board_labels_tenant_delete ON public.board_labels;
CREATE POLICY board_labels_tenant_delete
  ON public.board_labels FOR DELETE TO authenticated, aidvisora_app
  USING (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid);

COMMENT ON TABLE  public.board_labels IS 'Per-tenant definice štítků Boardu — nahrazuje localStorage klíč aidvisora_labels.';
COMMENT ON COLUMN public.board_labels.id IS 'Zachován label_<timestamp> formát kvůli zpětné kompatibilitě se sloupci statusLabel.';
COMMENT ON COLUMN public.board_labels.name IS 'Uživatelem zvolený název štítku; prázdný string = jen barva.';
COMMENT ON COLUMN public.board_labels.is_closed_deal IS 'Štítek reprezentuje uzavřený obchod (pipeline analytics).';
COMMENT ON COLUMN public.board_labels.sort_index IS 'Ruční řazení v Edit Labels editoru.';

COMMIT;
