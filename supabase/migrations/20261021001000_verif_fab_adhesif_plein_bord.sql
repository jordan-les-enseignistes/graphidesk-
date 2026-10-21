-- VérifIzy : règle validée par Jordan (21/10/2026) — un adhésif plein va jusqu'au bord, sans liseré.
INSERT INTO public.verif_regles (categorie, titre, texte, statut)
SELECT 'adhesif', 'Adhésif plein : le visuel va jusqu''au bord',
$t$Sur un adhésif plein (rectangle, pas découpé à la forme), le fond couvre toute la page, fonds perdus compris. S'il s'arrête avant un bord, même de quelques dixièmes de millimètre, il reste un liseré blanc à l'impression : erreur.
Méthode : avec analyser_pdf, compare l'emprise des tracés et des images aux boîtes de la page (Trim, Bleed, Media), bord par bord. Au moindre écart, zoome sur ce bord avec voir_page pour confirmer.$t$,
'validee'
WHERE NOT EXISTS (SELECT 1 FROM public.verif_regles WHERE titre = 'Adhésif plein : le visuel va jusqu''au bord');
SELECT id, statut FROM public.verif_regles WHERE titre = 'Adhésif plein : le visuel va jusqu''au bord';
