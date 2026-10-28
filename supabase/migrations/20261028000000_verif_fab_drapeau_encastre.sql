-- VérifIzy : drapeau ou caisson encastré dans un autre caisson : les deux fichiers doivent s'emboîter (Jordan, 28/10/2026).
UPDATE public.verif_regles SET texte = texte || '
- Drapeau (ou caisson) ENCASTRÉ dans un autre caisson : ses pieds, languettes ou sa potence (fichier de construction) doivent correspondre aux trous du caisson qui le reçoit (même nombre, même entraxe, même taille, même hauteur) et à la cote annoncée au BAT (cache potence…). Méthode : analyser_pdf des deux fichiers, compare decoupesSimples (trous du caisson) et contoursPolygonaux (pieds du drapeau). Écart entre les deux fichiers : erreur.',
  updated_at = now()
WHERE titre = 'Caissons' AND statut = 'validee' AND texte NOT LIKE '%ENCASTRÉ dans un autre caisson%';
SELECT count(*) AS ok FROM public.verif_regles WHERE statut = 'validee' AND texte LIKE '%ENCASTRÉ dans un autre caisson%';
