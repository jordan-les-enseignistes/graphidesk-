-- VérifIzy : retours de Jordan après City Locker (20/10/2026) — règles génériques.

-- 1. Le nom du dossier dans un fichier de FAB est le nom COMPLET du dossier serveur.
UPDATE public.verif_regles SET texte = texte || '
Le NOM dans le fichier est le nom COMPLET du dossier serveur (ville, site, numéro compris : « CLIENT-VILLE », pas seulement « CLIENT ») : un nom tronqué ou différent est une alerte, même pour un fichier déjà produit.'
WHERE titre = 'Nom des fichiers de FAB' AND statut = 'validee' AND texte NOT LIKE '%nom COMPLET du dossier serveur%';

-- 2. Rien d'oublié : raisonner pièce par pièce, pas seulement élément par élément.
UPDATE public.verif_regles SET texte = texte || '
Raisonne PIÈCE PAR PIÈCE : un élément est souvent fait de plusieurs pièces (caisson : face plexi ou alu, tranche, adhésif, ajourage ; lettres : faces, chants ; panneau : support, adhésif). Chaque pièce à imprimer, découper ou commander a son fichier ; s''il manque, question : sous-traitée ou faite sans fichier ?'
WHERE titre = 'Fichiers de FAB : rien d''oublié' AND statut = 'validee' AND texte NOT LIKE '%PIÈCE PAR PIÈCE%';

SELECT titre FROM public.verif_regles WHERE statut = 'validee' AND (texte LIKE '%nom COMPLET du dossier serveur%' OR texte LIKE '%PIÈCE PAR PIÈCE%');
