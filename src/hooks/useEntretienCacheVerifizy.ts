import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useHasPermission } from "@/hooks/useHasPermission";

const TOUTES_LES_5_MIN = 5 * 60_000;

/** Heure de Paris, midi compris : lundi-jeudi 8 h 30 - 18 h, vendredi 8 h 30 - 11 h 30 */
function heuresDeBureau(d = new Date()): boolean {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d).map((x) => [x.type, x.value]),
  );
  const minutes = Number(p.hour) * 60 + Number(p.minute);
  return p.weekday !== "Sat" && p.weekday !== "Sun" && minutes >= 8 * 60 + 30 && minutes < (p.weekday === "Fri" ? 11 * 60 + 30 : 18 * 60);
}

/**
 * Garde chaud le cache de VérifIzy (consignes + règles) pendant les heures de
 * bureau. Chaque poste demande toutes les 5 min ; la fonction serveur décide :
 * seulement après la première vérification du jour, après 45 min sans appel,
 * et un seul poste à la fois. Une relance coûte ~0,002 $ contre ~0,08 $ pour
 * réécrire le cache.
 */
export function useEntretienCacheVerifizy() {
  const autorise = useHasPermission("access:verif_fab");
  useEffect(() => {
    if (!autorise) return;
    const t = setInterval(() => {
      if (!heuresDeBureau()) return;
      supabase.functions.invoke("verif-fab", { body: { action: "entretien" } }).catch(() => { /* sans réseau : rien */ });
    }, TOUTES_LES_5_MIN);
    return () => clearInterval(t);
  }, [autorise]);
}
