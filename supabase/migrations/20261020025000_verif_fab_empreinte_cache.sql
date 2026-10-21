-- VérifIzy : empreinte de la partie fixe (consignes + outils + règles) au dernier appel réel.
-- La relance du cache n'a lieu que si cette partie n'a pas changé depuis : sinon elle
-- réécrirait un cache neuf (~0,22 $) au lieu de relire l'existant (~0,005 $).
ALTER TABLE public.verif_parametres ADD COLUMN IF NOT EXISTS prefixe_empreinte text;
