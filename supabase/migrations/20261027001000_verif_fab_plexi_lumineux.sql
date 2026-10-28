-- VérifIzy : plexi transparent ou translucide selon l'éclairage (Jordan, 27/10/2026).
INSERT INTO public.verif_regles (categorie, titre, texte, statut, raison)
SELECT 'plaque', 'Plexi : transparent ou translucide (diffusant)',
$t$Plexi TRANSPARENT : on voit au travers (plaque type plaque de médecin, vitrophanie sur plexi…). Plexi TRANSLUCIDE (« diffusant ») : laisse passer la lumière mais on ne voit pas au travers.
Tout élément LUMINEUX éclairé à travers le plexi (face de caisson, lettres, plexi rétroéclairé) : plexi translucide / diffusant, écrit comme tel au BAT (« Plexi diffusant ») et dans le nom du fichier de FAB. Un plexi transparent sur un élément lumineux laisse voir les LED et l'intérieur : erreur (BAT ou FAB).
Le devis dit « non lumineux » mais le BAT ou la maquette montrent un élément éclairé (ou l'inverse) : question.$t$,
'validee', 'Ajoutée par Jordan'
WHERE NOT EXISTS (SELECT 1 FROM public.verif_regles WHERE titre = 'Plexi : transparent ou translucide (diffusant)');
SELECT id, statut FROM public.verif_regles WHERE titre = 'Plexi : transparent ou translucide (diffusant)';
