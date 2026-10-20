# VérifIzy — résultats attendus (banc de parité)

Chaque dossier ci-dessous a été analysé à la main (Claude, hors API) puis CORRIGÉ par Jordan.
VérifIzy (API) doit retrouver CHAQUE erreur, alerte et question listée, avec le bon niveau,
et ne rien signaler de ce qui est marqué « ne PAS signaler ». Un écart = un bug du prompt,
d'un outil ou d'une règle, à corriger avant mise en service.

## 1. VLC Conseil — `Y:\JORDAN\TEST` (fichier piégé par Jordan)
- ERREUR : QR code absent de la FAB (présent au BAT p.2 sous « site internet »).
- ALERTE/ERREUR selon règles : CutContour sur adhésif plein en découpe droite (x10, pas une grande série) — question.
- Fonds perdus 2,5 mm sur 4 côtés au lieu de 20 mm droite + bas (adhésif sur panneau rectangulaire ? sinon « fichier à la taille » : question sur le support).
- Ne PAS confondre l'ancien BAT (MAQUETTE/FP, CO2607-5606) avec le BAT en cours.

## 2. City Locker Metz — `Z:\C\CITY_LOCKER\CITY-LOCKER-METZ-2`
- ERREUR probable : DB-X2-…-3 (caisson rond) visuel prolongé 5 mm au-delà de la découpe au lieu de 15 mm (page 640, fond 620, découpe 610).
- QUESTIONS devis ↔ BAT : caisson (devis alu laqué RAL 9016 + ajourage ; BAT face plexi + adhésifs, tranche alu brut) ; lettres « KEEP AN EYE… » 100 mm au devis / 76 mm au BAT ; laquage au devis / PVC blanc au BAT ; fichier de la face plexi du caisson ?
- ALERTE : fichiers vitrophanie nommés « CITY-LOCKER » au lieu de « CITY-LOCKER-METZ ».
- Mairie : pas de réponse de la mairie dans le dossier → question « autorisation obtenue ? ».
- Ne PAS signaler : calques WORK/WHITE (noms libres) ; graphisme quadri sans surimpression (seul le White l'est) ; White en surimpression = conforme.
- Conforme : PVC 19 mm 2144 x 230, PVC 10 mm 2144 x 76, interligne plan de pose ≈ BAT (66/68 mm), formes = BAT.

## 3. Camif Habitat Bouguenais — `Z:\C\CAMIF HABITAT\BOUGUENAIS` (sans FAB)
- Arrêté du 12/10 lu (scan) : bandeau n°3 façade 2 interdit, drapeau n°2 refusé → BAT du 13/10 conforme (ni l'un ni l'autre).
- ERREUR : numérotation — page 5 sans numéros sur les visuels (n°5 carré 1200 x 565, n°6 tapis) ; suite 1-2-3-5-6 (le 4 manque).
- QUESTION : enseigne n°1 autorisée — mêmes dimensions que la demande du 20/08 ? (toute modification = nouvelle demande).
- QUESTION : pas de devis dans le dossier.
- Ne PAS confondre le visuel du n°5 avec le tapis n°6 (demander si doute).
- Conforme : VT ↔ BAT (3985, 675 x 1775, 2860 x 2220), découpe à 1300 hors texte, zoom kit horaire p.4, dimensions définitives.

## 4. Temporis Mont-de-Marsan — `Z:\T\TEMPORIS\MONT DE MARSAN`
- ERREUR : BAT éléments 4 à 7 sans dimensions (matières : teinté masse miroir OK pour pose intérieure).
- ERREUR : fichiers de sous-traitance sans numéro (N1, N3).
- ALERTES : référence « C2608-5656 » ; « intérieure » ; n°8 CutContour 0,5 pt + visuel prolongé 10–13 mm ; n°4 et 5 > 2000 mm de long ; n°8 repris d'un dossier de 2021.
- QUESTIONS : caisson 10 620 = largeur façade (métré client, pose client) ; pas de devis.
- Ne PAS signaler : texte « REPERE » non vectorisé (repère de calage) ; teinté masse en miroir ; graphisme quadri sans surimpression.
- Conforme : caisson 4 parties 2845/2270/2750/2845 x 990 (retours 45 aux extrémités), White en surimpression, vitrophanies 4-7 ↔ BAT.

## 5. Temporis St Quentin — `Z:\T\TEMPORIS\ST QUENTIN\ENSEIGNE`
- ERREUR : 3 fichiers de FAB nommés « TEMPORIS_OBERNAI » (contenu = St Quentin, mais Obernai CO2606-5395 en sous-traitance la même semaine).
- ALERTES : dossier « FAB » sans n° de commande ; maquette/PSD à la racine ; pas de mention d'arrivée électrique (4 enseignes rétroéclairées).
- QUESTIONS : cotes seulement dans un scan manuscrit (B = 1,15 m, 1 = 1,71 m) ; pas de devis.
- Ne PAS signaler : absence de VT / mairie (non prévues) ; N1_4 et N2 au contenu identique (même logo T).
- Conforme : 500 x 500, 1887,5 x 500, RAL 7022/3002/9002, drapeau 30 mm + potence 100, numérotation 1-5.

## Limites connues de l'API par rapport au test manuel
- Ne lit QUE le dossier choisi : ne peut pas aller comparer avec un autre dossier (ex. Obernai) — l'erreur de nom reste détectable par le nom seul.
- Un scan (arrêté, cotes manuscrites) se lit en image (voir_page) : à cocher au ciblage.
