// Lettres rétroéclairées sur entretoises — le dialogue entre GraphiDesk et Illustrator, sans rien de propre à Tauri
// (les accès au système sont fournis par l'appelant : l'application dans orchestration.ts, un faux Illustrator dans les essais).
//
// UN SEUL script est lancé dans Illustrator (une seule confirmation), qui dialogue avec GraphiDesk par de petits fichiers
// du dossier temporaire — même principe que les fonds perdus intelligents de l'outil Adhésif :
//
//   Illustrator → graphidesk_retro_geometrie.json    le relevé des tracés
//   GraphiDesk  → graphidesk_retro_progression.json  signe de vie + avancement du calcul (barre de progression dans Illustrator)
//   GraphiDesk  → graphidesk_retro_resultat.json     ce qu'il faut dessiner (ou les points à corriger)
//   Illustrator → graphidesk_retro_fin.json          terminé, avec le bilan
//
// Chaque lancement porte un jeton : un fichier resté d'un lancement précédent n'est jamais pris pour le bon.
// ⚠ Illustrator ne rend la main qu'à la FIN du script, qui attend notre réponse : on n'attend donc JAMAIS le lancement.

export const FICHIERS = {
  geometrie: "graphidesk_retro_geometrie.json",
  progression: "graphidesk_retro_progression.json",
  resultat: "graphidesk_retro_resultat.json",
  fin: "graphidesk_retro_fin.json",
};

export type EtapeRetro = "placer" | "finaliser";

export interface BilanRetro {
  ok: boolean;
  /** l'utilisateur a renoncé dans Illustrator (retouches à garder) */
  annule?: boolean;
  erreur?: string;
  entretoises?: number;
  pieces?: number;
  /** points bloquants, cerclés en rouge dans Illustrator */
  doutes?: number;
  /** chemin du PDP enregistré (vide s'il n'a pas pu l'être) */
  pdp?: string;
}

export interface Systeme {
  /** Lance retro_entretoises.jsx dans Illustrator. Ne se termine qu'à la FIN du script. */
  lancer(params: object): Promise<unknown>;
  lire(nom: string): Promise<any>;
  ecrire(nom: string, contenu: string): Promise<unknown>;
  supprimer(noms: string[]): Promise<unknown>;
  /** Calcule la réponse à partir du relevé ; `surProgression` reçoit l'avancement, de 0 à 1. */
  calculer(etape: EtapeRetro, geo: unknown, parametres: object, surProgression: (fraction: number) => void): Promise<any>;
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const CALCUL_MAX_MS = 3 * 60 * 1000;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
function borner<T>(delaiMs: number, promesse: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const minuteur = setTimeout(() => reject(new Error("calcul trop long (plus de 3 minutes), abandonné")), delaiMs);
    promesse.then((v) => { clearTimeout(minuteur); resolve(v); }, (e) => { clearTimeout(minuteur); reject(e); });
  });
}

export async function deroulerRetro(
  sys: Systeme,
  etape: EtapeRetro,
  parametres: object,
  pdp: object,
  surEtape: (libelle: string) => void,
): Promise<BilanRetro> {
  const jeton = String(Date.now());
  await sys.supprimer(Object.values(FICHIERS));

  surEtape("Illustrator : relevé des tracés…");
  let echecLancement: Error | null = null;
  sys.lancer({ etape, jeton, parametres, pdp }).catch((e) => { echecLancement = new Error(message(e)); });

  const attendre = async (nom: string, delaiMaxMs: number, accepte: (c: any) => boolean): Promise<any> => {
    const debut = Date.now();
    while (Date.now() - debut < delaiMaxMs) {
      if (echecLancement) throw echecLancement;
      await pause(300);
      try {
        const c = await sys.lire(nom);
        if (accepte(c)) return c;
      } catch {
        // pas encore écrit
      }
    }
    throw new Error("Illustrator n'a pas répondu à temps");
  };
  const duJeton = (c: any) => String(c.jeton) === jeton;

  // 1. relevé (Illustrator l'écrit aussi, avec ok: false, s'il renonce ou échoue avant : il termine alors seul)
  const geo = await attendre(FICHIERS.geometrie, 20 * 60 * 1000, duJeton);
  if (!geo.ok) return { ok: false, annule: !!geo.annule, erreur: geo.erreur || (geo.annule ? undefined : "relevé des tracés impossible") };

  // 2. calcul ici ; Illustrator attend, fenêtre figée : signe de vie chaque seconde, réponse dans tous les cas
  const reponse: any = { jeton };
  let fraction = 0, battements = 0, enCours = false;
  const battre = () => {
    if (enCours) return;
    enCours = true;
    sys.ecrire(FICHIERS.progression, JSON.stringify({ jeton, f: fraction, n: ++battements })).catch(() => {}).finally(() => { enCours = false; });
  };
  battre();
  const horloge = setInterval(battre, 1000);
  try {
    surEtape(etape === "placer" ? "Calcul de la rainure et des entretoises…" : "Finalisation : rainure autour des entretoises, vérification…");
    Object.assign(reponse, await borner(CALCUL_MAX_MS, sys.calculer(etape, geo, parametres, (f) => { fraction = f; })));
  } catch (e) {
    reponse.erreur = message(e);
  } finally {
    clearInterval(horloge);
  }
  await sys.ecrire(FICHIERS.resultat, JSON.stringify(reponse));

  // 3. dessin, PDP et message de fin, par Illustrator
  surEtape(etape === "placer" ? "Illustrator : dessin…" : "Illustrator : rainure finale et PDP…");
  return await attendre(FICHIERS.fin, 10 * 60 * 1000, duJeton);
}
