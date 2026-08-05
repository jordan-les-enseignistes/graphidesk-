// Combien de ressources du Kit sont à mettre à jour sur CE poste ?
// Sert à la pastille de la barre latérale et au bandeau de la page : un
// graphiste ne doit pas avoir à ouvrir le Kit pour découvrir qu'un script a
// changé — c'est le logiciel qui vient le lui dire.
import { useAtelierRessources, useStatutsRessources, aBesoinDeMaj } from "@/hooks/useAtelierRessources";

export function useMajKit(): { nombre: number; noms: string[] } {
  const { data: ressources } = useAtelierRessources();
  const { data: statuts } = useStatutsRessources(ressources);
  const noms = (ressources ?? [])
    .filter((r) => aBesoinDeMaj(r, statuts?.[r.id]))
    .map((r) => r.nom);
  return { nombre: noms.length, noms };
}
