-- Backfill portfolio_attributes.paymentType pro INV / DPS / DIP smlouvy
-- Datum: 22.04.2026
-- Souvisí s: F2/F4 (oprava KPI „Měsíční investice"), canonical-contract-read.ts (heuristika readPaymentType)
--
-- Co migrace dělá:
--   1) Pro INV/DPS/DIP smlouvy, kde `portfolio_attributes->>'paymentType' IS NULL`:
--        - pokud `paymentFrequencyLabel` (nebo legacy `paymentFrequency`) obsahuje
--          „jednoráz" / „one time" / „single" → zapíše 'one_time';
--        - jinak zapíše 'regular'.
--   2) Nepřepisuje existující `paymentType` (idempotentní — lze spustit opakovaně).
--
-- Důvod:
-- `contact-overview-kpi.ts` interpretuje chybějící `paymentType` jako „regular"
-- a započítává `premiumAmount` do Měsíční investice. Jednorázové investice
-- bez explicitního `paymentType` tak halucinují KPI (pojistka F3/F4 z plánu).
-- Tento backfill dává starým smlouvám explicitní hodnotu založenou na
-- dostupných popiscích frekvence.

BEGIN;

DO $$
DECLARE
  v_one_time int;
  v_regular int;
BEGIN
  -- 1. One-time: label obsahuje „jednoráz" / „one time" / „single" / „lump"
  UPDATE contracts
     SET portfolio_attributes = COALESCE(portfolio_attributes, '{}'::jsonb)
           || jsonb_build_object('paymentType', 'one_time')
   WHERE segment IN ('INV', 'DPS', 'DIP')
     AND (portfolio_attributes IS NULL OR portfolio_attributes->>'paymentType' IS NULL)
     AND (
       COALESCE(portfolio_attributes->>'paymentFrequencyLabel', '') ILIKE '%jednoráz%'
       OR COALESCE(portfolio_attributes->>'paymentFrequencyLabel', '') ILIKE '%jednoraz%'
       OR COALESCE(portfolio_attributes->>'paymentFrequencyLabel', '') ILIKE '%one time%'
       OR COALESCE(portfolio_attributes->>'paymentFrequencyLabel', '') ILIKE '%one-time%'
       OR COALESCE(portfolio_attributes->>'paymentFrequencyLabel', '') ILIKE '%single%'
       OR COALESCE(portfolio_attributes->>'paymentFrequencyLabel', '') ILIKE '%lump%'
       OR COALESCE(portfolio_attributes->>'paymentFrequency', '') ILIKE '%jednoráz%'
       OR COALESCE(portfolio_attributes->>'paymentFrequency', '') ILIKE '%jednoraz%'
       OR COALESCE(portfolio_attributes->>'paymentFrequency', '') ILIKE '%one_time%'
     );
  GET DIAGNOSTICS v_one_time = ROW_COUNT;

  -- 2. Regular: zbytek INV/DPS/DIP bez paymentType
  UPDATE contracts
     SET portfolio_attributes = COALESCE(portfolio_attributes, '{}'::jsonb)
           || jsonb_build_object('paymentType', 'regular')
   WHERE segment IN ('INV', 'DPS', 'DIP')
     AND (portfolio_attributes IS NULL OR portfolio_attributes->>'paymentType' IS NULL);
  GET DIAGNOSTICS v_regular = ROW_COUNT;

  RAISE NOTICE 'Portfolio attributes payment_type backfill:';
  RAISE NOTICE '  • Přepnuté na paymentType=one_time (dle labelu): %', v_one_time;
  RAISE NOTICE '  • Přepnuté na paymentType=regular (default): %', v_regular;
  RAISE NOTICE 'KPI „Měsíční investice" nyní pro tyto smlouvy bude deterministická.';
END $$;

COMMIT;
