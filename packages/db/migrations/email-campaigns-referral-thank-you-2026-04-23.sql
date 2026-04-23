-- Referral thank-you template seed (B3.2 gap closure)
--
-- Po odeslání formuláře na /r/[token] vytváříme single-recipient kampaň s touto
-- šablonou pro původního kontakt, který doporučení vyvolal.

BEGIN;

INSERT INTO email_templates (
  tenant_id, name, kind, subject, preheader, body_html,
  description, icon_name, accent_class, style_key, merge_fields,
  is_system, sort_order
)
SELECT * FROM (VALUES
  (NULL::uuid, 'Poděkování za doporučení',
   'referral_thank_you',
   'Děkuji za doporučení!',
   'Moc si Vašeho doporučení vážím.',
   '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h1 style="color:#0B3A7A;">Děkuji Vám, {{jmeno}}</h1>
      <p>dostal jsem právě Vaše doporučení a moc si toho vážím. Znamená to pro mě, že naše spolupráce má pro Vás smysl.</p>
      <p>S doporučeným kontaktem se brzy spojím a budu postupovat stejně pečlivě, jako s Vámi. Pokud byste chtěl cokoliv upřesnit, jsem Vám k dispozici.</p>
      <p style="margin-top:32px;font-size:12px;color:#64748b;">
        <a href="{{unsubscribe_url}}">Odhlásit odběr</a>
      </p>
    </div>',
   'Automatické poděkování po odeslání referral formuláře.',
   'Heart', 'text-rose-600', 'referral_thank_you',
   ARRAY['jmeno','cele_jmeno','unsubscribe_url']::text[], true, 55)
) AS seed(tenant_id, name, kind, subject, preheader, body_html, description, icon_name, accent_class, style_key, merge_fields, is_system, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM email_templates et
  WHERE et.tenant_id IS NULL
    AND et.kind = seed.kind
    AND et.is_system = true
);

COMMIT;
