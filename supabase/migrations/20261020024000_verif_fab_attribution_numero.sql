-- VérifIzy : ne jamais rattacher un constat au mauvais élément (retour de Jordan, 20/10/2026).
UPDATE public.verif_regles SET texte = texte || '
Avant de rattacher un constat à un numéro, vérifie que le visuel, la ligne de légende et le fichier décrivent bien le MÊME produit (tapis, lettres, adhésif, caisson…) : un constat attribué au mauvais élément est une fausse alerte. En cas de doute sur la correspondance, pose la question.',
  updated_at = now()
WHERE titre = 'Numérotation du BAT' AND statut = 'validee' AND texte NOT LIKE '%décrivent bien le MÊME produit%';
SELECT count(*) AS ok FROM public.verif_regles WHERE texte LIKE '%décrivent bien le MÊME produit%';
