-- VérifIzy : retours de Jordan après Temporis Mont-de-Marsan (20/10/2026) — règles génériques.

-- 1. Nommage : le nom doit tout DIRE, la forme est libre (séparateurs, N2, P1, matière en toutes lettres…).
UPDATE public.verif_regles SET texte =
'Le nom d''un fichier de FAB doit DIRE : la matière (code ou en toutes lettres) ou, pour un élément laqué, le type de produit + RAL ; la lamination si non mat (BRILLANT, SPECIAL-SOL, CONFORMABLE, VELLEDA) ; les options utiles (DECOUPE, MIROIR, RAL, taille, épaisseur, échelle si < 1…) ; xN si plus d''un exemplaire ; le nom COMPLET du dossier serveur (ville, site compris : « CLIENT-VILLE », pas seulement « CLIENT ») ; le numéro au BAT.
Exemples de la Bible : DG-BRILLANT-x2-RIAFR27-8 ; DIBOND-1500x380mm-LAPETITE-COCOTE-5 ; DEPOLI-MIROIR-x7-MAIRIEDESATOLAS-22.
La FORME est libre : séparateurs « - » ou « _ », numéro écrit « 5 » ou « N5 », suffixe « P1, P2… » pour un élément en plusieurs fichiers, matière en code (DG, DB, DEPOLI, PVC…) ou en toutes lettres (TRANSPARENT, TEINTE-MASSE-BLANC, BLANC-SELECTIF…). Les listes ci-dessus sont des exemples, pas une liste fermée.
Ne signale que ce qui MANQUE (matière, numéro, quantité, nom du dossier) ou CONTREDIT le BAT (autre numéro, autre quantité, autre matière, autre finition) — jamais une simple différence d''écriture. Nom tronqué ou d''un autre dossier : alerte, même pour un fichier déjà produit.
Correspondance BAT → code matière (en général) : adhésif OCCULTANT = DG (dos gris) ; adhésif DIFFUSANT = DB (dos blanc). Un autre code que celui attendu : question.'
WHERE titre = 'Nom des fichiers de FAB' AND statut = 'validee';

-- 2. BAT : pour un adhésif découpé à la forme, la cote attendue est celle du SUPPORT.
UPDATE public.verif_regles SET texte = texte || '
Adhésif découpé à la forme : la cote attendue au BAT est celle du SUPPORT (« Pour vitrine L x H ») ; l''emprise de l''adhésif lui-même n''est pas exigée au BAT.'
WHERE titre = 'BAT complet : contenu obligatoire' AND statut = 'validee' AND texte NOT LIKE '%cote attendue au BAT est celle du SUPPORT%';

SELECT titre FROM public.verif_regles WHERE statut = 'validee'
  AND (texte LIKE '%La FORME est libre%' OR texte LIKE '%cote attendue au BAT est celle du SUPPORT%');
