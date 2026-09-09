-- Gabarits à ne JAMAIS personnaliser, par nom de fichier.
--
-- ⚠ Pourquoi cette liste existe. GraphiDesk décide de proposer — ou non — la
-- mise au nom du graphiste en cherchant les repères d'identité DANS le
-- fichier. Or un .indd enregistré de façon incrémentale conserve l'état
-- ANTÉRIEUR du document : des noms retirés d'une page restent présents dans
-- les octets sans plus être affichés nulle part. Aucun examen du fichier ne
-- permet de les distinguer ; seul quelqu'un qui ouvre le document le peut.
-- D'où une liste, tenue à la main, plutôt qu'une exception codée en dur.
--
-- BAT_MAIRIE_.indd : vérifié par Jordan le 09/09/2026 — les deux occurrences
-- de « Jordan NEAU » présentes dans les octets ne sont affichées sur aucune page.
UPDATE app_settings
SET value = jsonb_set(
      value::jsonb,
      '{sansPersonnalisation}',
      '["BAT_MAIRIE_.indd"]'::jsonb,
      true
    )
WHERE key = 'gabarits_identite_reference'
  AND NOT (value::jsonb ? 'sansPersonnalisation');
