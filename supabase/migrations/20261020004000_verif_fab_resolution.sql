-- Résolution : pas de seuil chiffré, contrôle visuel à l'échelle 1:1 (Jordan, 20/10/2026)
UPDATE public.verif_regles
SET statut = 'validee',
    titre = 'Qualité des images à l''échelle 1:1',
    texte = $$Pas de seuil de dpi : en signalétique, seule une vérification à l'échelle 1:1 fait foi. Pour chaque image imprimée (photo, logo en image), agrandir un extrait représentatif à sa taille réelle de pose (voir_page avec une petite zone) et juger le rendu : pixellisation, flou, escaliers sur les contours, artefacts de compression. Un logo ou un texte en image alors qu'il devrait être vectoriel est à signaler.$$,
    raison = 'Jordan, 20/10/2026 : pas de seuil, contrôle visuel à l''échelle 1:1',
    updated_at = now()
WHERE titre = 'Résolution des images à l''échelle 1:1';
