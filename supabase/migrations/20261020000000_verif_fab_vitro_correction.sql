-- Vitrophanie : SEUL le calque White est en surimpression. La Bible demande aussi
-- la surimpression sur le Graphisme : c'est une erreur de la Bible (Jordan, 19/10/2026).
UPDATE public.verif_regles
SET texte = $$Adhésif collé à l'intérieur de la vitre, vu de l'extérieur : impression sur transparent avec blanc de soutien total ou sélectif. Calques : Graphisme (tout en dessous, SANS surimpression) ; Cut contour (seulement si découpe de forme : tracés fermés en rose Colorado-2025) ; White (couleur bleue Colorado-2025, au-dessus, EN surimpression). Les noms de calques importent peu (WORK/WHITE convient). Le fichier n'est PAS mis en miroir : l'atelier s'en charge, mais « MIROIR » doit figurer dans le nom du fichier de FAB.$$,
    raison = 'Bible du graphiste (PROCESS-IMPRESSION), corrigée par Jordan le 19/10/2026 : seul le White est en surimpression',
    updated_at = now()
WHERE titre = 'Vitrophanie' AND statut = 'validee';
