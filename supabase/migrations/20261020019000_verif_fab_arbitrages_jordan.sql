-- VérifIzy : arbitrages de Jordan (20/10/2026) après l'extraction Discord et le 2e test
-- Mont-de-Marsan. Règles génériques uniquement.

-- 1. CutContour sur un adhésif plein : une seule règle (fusion), pas de seuil absolu.
UPDATE public.verif_regles SET
  titre = 'CutContour sur un adhésif plein (découpe droite)',
  texte = 'Un adhésif plein posé tel quel n''a en général PAS de CutContour (l''atelier coupe à la main). Pas de règle absolue : une découpe automatique se justifie pour une série d''exemplaires identiques (à partir d''environ 7). Dès que la quantité dépasse 5 : alerte « à valider avec l''atelier » (CutContour ou découpe à la main ?). Un CutContour sur un adhésif plein en petite quantité : question.',
  updated_at = now()
WHERE id::text LIKE 'a9b73446%' AND statut = 'validee';
UPDATE public.verif_regles SET statut = 'fusionnee', remplace_id = (SELECT id FROM public.verif_regles WHERE id::text LIKE 'a9b73446%'), updated_at = now()
WHERE id::text LIKE '3bfc19c6%' AND statut = 'validee';

-- 2. Échelle : maquettes au 1:10e ; FAB au 1:1 de préférence, 1:10e OBLIGATOIRE au-delà de 5 m.
UPDATE public.verif_regles SET
  texte = 'Les MAQUETTES sont au 1:10e. Les fichiers de FAB sont au 1:1 de préférence (moins d''erreurs à l''atelier) ; au-delà de 5000 mm de long, le 1:10e est OBLIGATOIRE et l''échelle doit figurer dans le nom du fichier.',
  updated_at = now()
WHERE id::text LIKE '4321a16d%' AND statut = 'validee';

-- 3. Adhésif sur panneau : les 20 mm ne vont que du côté où l'adhésif est bord à bord.
UPDATE public.verif_regles SET
  texte = 'Le panneau reste à la taille indiquée. L''adhésif a des bords perdus de 20 mm à DROITE et 20 mm en BAS (rien en haut ni à gauche) — seulement dans la direction où il couvre tout le panneau : un adhésif pleine largeur mais pas pleine hauteur n''a pas de bords perdus en hauteur.',
  updated_at = now()
WHERE id::text LIKE '6836cf58%' AND statut = 'validee';

-- 4. Prolongation du visuel : seulement pour un adhésif IMPRIMÉ sur matière opaque.
UPDATE public.verif_regles SET
  texte = replace(texte, 'Visuel prolongé d''au moins 15 mm hors du tracé si possible.',
    'Visuel prolongé d''au moins 15 mm hors du tracé si possible — seulement pour un adhésif IMPRIMÉ sur matière opaque (DG, DB…) ; sur un transparent ou un teinté masse (vitrophanie), pas de prolongation attendue : rien à signaler.'),
  updated_at = now()
WHERE id::text LIKE '67d18a9f%' AND statut = 'validee' AND texte NOT LIKE '%seulement pour un adhésif IMPRIMÉ%';

-- 5. Gravité : orthographe et accents non signalés ; arrondi de cote non signalé ; fichier repris mais conforme non signalé.
UPDATE public.verif_regles SET
  texte = replace(replace(texte,
    'une coquille (référence mal tapée, faute de frappe)',
    'une coquille qui peut tromper (référence, nom, cote ou matière mal écrits) — les fautes d''orthographe, d''accent ou d''accord ne sont PAS à signaler ; une cote à décimale arrondie au mm ailleurs (ex. 1234,5 / 1234) n''est pas une coquille'),
    'fichier repris d''un ancien dossier mais conforme, ', ''),
  updated_at = now()
WHERE id::text LIKE 'd0a4fd76%' AND statut = 'validee';
UPDATE public.verif_regles SET
  texte = texte || ' Un fichier repris d''un ancien dossier (date antérieure à la commande) dont le contenu est conforme au BAT et à la maquette n''est pas à signaler.',
  updated_at = now()
WHERE id::text LIKE 'd0a4fd76%' AND statut = 'validee' AND texte NOT LIKE '%repris d''un ancien dossier (date%';

-- 6. Propositions Caroline ajustées selon les réponses.
UPDATE public.verif_regles SET texte =
'Un DÉPOLI ou une matière NON imprimée, sans ajourage, posé en intérieur ne change ni le fichier ni son nom : miroir ou pas, c''est pareil (pas de MIROIR exigé). Dès que le dépoli est imprimé (texte, visuel) ou ajouré, le fichier doit être en MIROIR pour une pose intérieure. Exception à « Pose intérieure ↔ fichier MIROIR ».',
  updated_at = now()
WHERE titre = 'Matière vierge posée en intérieur : pas de miroir' AND statut = 'proposee';
UPDATE public.verif_regles SET texte = replace(texte,
  '- Coquilles de cotes : une valeur à ±1 mm d''une cote ronde attendue (ex. 5599 pour 5600) ou une somme de parties différente du total est une alerte.',
  '- Coquilles de cotes : une valeur à 1 mm d''une cote ronde attendue (artefact de l''outil de mesure, ex. 1999 pour 2000) ou une somme de parties différente du total est une alerte. Une cote à décimale arrondie au mm ailleurs n''en est pas une.'),
  updated_at = now()
WHERE titre = 'BAT : rédaction des cotes et du descriptif' AND statut = 'proposee';

SELECT titre, statut FROM public.verif_regles WHERE updated_at > now() - interval '1 minute' ORDER BY titre;
