// Fonds perdus intelligents — le déroulement du dialogue entre GraphiDesk et Illustrator, sans rien de propre à Tauri
// (les accès au système sont fournis par l'appelant : l'application dans orchestration.ts, un faux Illustrator dans les essais).
//
// UN SEUL script est lancé dans Illustrator (donc une seule confirmation d'Illustrator, comme avec l'outil habituel) :
// l'automatisation habituelle (full_automation.jsx) enchaîne d'elle-même sur fp_intelligent.jsx, qui dialogue avec
// GraphiDesk par de petits fichiers du dossier temporaire :
//
//   Illustrator → graphidesk_adhesif_fin.json     l'automatisation habituelle est terminée
//   Illustrator → graphidesk_fp_geometrie.json    le relevé des tracés (Artwork, CutContour, FondPerdu)
//   GraphiDesk  → graphidesk_fp_progression.json  signe de vie + avancement du calcul (barre de progression dans Illustrator)
//   GraphiDesk  → graphidesk_fp_correctifs.json   les correctifs à poser
//   Illustrator → graphidesk_fp_fin.json          les correctifs sont posés
//
// Chaque lancement porte un jeton : un fichier resté d'un lancement précédent n'est jamais pris pour le bon.
//
// ⚠ Illustrator ne rend la main à celui qui lance le script qu'une fois le script TERMINÉ — et le script, lui, attend nos
// correctifs. On ne doit donc JAMAIS attendre le retour du lancement avant de dialoguer avec lui : les deux s'attendraient
// l'un l'autre jusqu'à l'abandon d'Illustrator (essai réel du 10/11/2026 : 2 minutes de « Ne répond pas », aucun correctif).

export const FICHIERS = {
  finAdhesif: "graphidesk_adhesif_fin.json",
  geometrie: "graphidesk_fp_geometrie.json",
  progression: "graphidesk_fp_progression.json",
  correctifs: "graphidesk_fp_correctifs.json",
  finFp: "graphidesk_fp_fin.json",
};

export interface BilanFondsPerdus {
  /** nombre de correctifs posés sur le calque FondPerdu */
  poses: number;
  /** nombre d'endroits signalés à vérifier */
  doutes: number;
  /** renseigné si la correction automatique n'a pas pu se faire (les fonds perdus restent ceux de l'outil habituel) */
  erreur?: string;
  /** durée du calcul, en secondes */
  secondes?: number;
}

export interface ResultatCalcul {
  correctifs: unknown[];
  doutes: unknown[];
  stats?: { secondes?: number };
}

/** Ce dont le déroulement a besoin autour de lui. */
export interface Systeme {
  /** Lance full_automation.jsx dans Illustrator avec ces paramètres. Ne se termine qu'à la FIN du script. */
  lancer(params: object): Promise<unknown>;
  /** Lit un fichier JSON du dossier temporaire ; échoue s'il n'existe pas (encore) ou n'est pas fini d'écrire. */
  lire(nom: string): Promise<any>;
  /** Écrit un fichier texte dans le dossier temporaire. */
  ecrire(nom: string, contenu: string): Promise<unknown>;
  /** Efface des fichiers du dossier temporaire. */
  supprimer(noms: string[]): Promise<unknown>;
  /** Calcule les correctifs à partir du relevé ; `surProgression` reçoit l'avancement, de 0 à 1. */
  calculer(geo: unknown, surProgression: (fraction: number) => void): Promise<ResultatCalcul>;
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Durée maximale du calcul : au-delà, on répond à Illustrator qu'il n'y aura pas de correctifs (il attend, fenêtre figée). */
const CALCUL_MAX_MS = 3 * 60 * 1000;
function borner<T>(delaiMs: number, promesse: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const minuteur = setTimeout(() => reject(new Error("calcul trop long (plus de 3 minutes), abandonné")), delaiMs);
    promesse.then(
      (v) => { clearTimeout(minuteur); resolve(v); },
      (e) => { clearTimeout(minuteur); reject(e); },
    );
  });
}
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Lance l'automatisation adhésif puis la correction des fonds perdus.
 * `surEtape` reçoit un libellé à afficher pendant l'attente.
 */
export async function deroulerAdhesifAvecFondsPerdus(
  sys: Systeme,
  params: object,
  surEtape: (libelle: string) => void,
): Promise<BilanFondsPerdus> {
  const jeton = String(Date.now());
  await sys.supprimer(Object.values(FICHIERS));

  // 1. l'automatisation habituelle, qui enchaîne d'elle-même sur les fonds perdus.
  //    On NE l'attend PAS (voir l'avertissement en tête de fichier) ; on retient seulement un éventuel échec du lancement.
  surEtape("Automatisation adhésif en cours dans Illustrator…");
  let echecLancement: Error | null = null;
  sys.lancer({ ...params, fpIntelligent: true, jeton }).catch((e) => {
    echecLancement = new Error(message(e));
  });

  /** Attend qu'Illustrator ait écrit un fichier JSON que `accepte` reconnaît comme le bon. */
  const attendre = async (nom: string, delaiMaxMs: number, accepte: (contenu: any) => boolean = () => true): Promise<any> => {
    const debut = Date.now();
    while (Date.now() - debut < delaiMaxMs) {
      if (echecLancement) throw echecLancement;
      await pause(300);
      try {
        const contenu = await sys.lire(nom);
        if (accepte(contenu)) return contenu;
      } catch {
        // pas encore écrit (ou en cours d'écriture) : on continue de guetter
      }
    }
    throw new Error("Illustrator n'a pas répondu à temps (" + nom + ")");
  };

  const fin = await attendre(FICHIERS.finAdhesif, 20 * 60 * 1000);
  if (!fin.ok) throw new Error(fin.erreur || "L'automatisation adhésif a échoué");

  // 2. relevé des tracés, par Illustrator (un relevé en échec n'a pas de jeton : Illustrator termine alors seul)
  surEtape("Fonds perdus : relevé des tracés…");
  let erreur: string | undefined;
  let secondes: number | undefined;
  let nbDoutes = 0;
  try {
    const geo = await attendre(FICHIERS.geometrie, 10 * 60 * 1000, (g) => g.ok === false || g.jeton === jeton);
    if (!geo.ok) throw new Error(geo.erreur || "relevé des tracés impossible");

    // 3. calcul des correctifs, ici. Illustrator attend la réponse, fenêtre figée : il lui faut un signe de vie tout de suite,
    //    puis un battement régulier (il abandonne après 30 s de silence), et dans TOUS les cas une réponse,
    //    en temps borné.
    const reponse: { jeton: string; correctifs: unknown[]; doutes: unknown[]; erreur?: string } = { jeton, correctifs: [], doutes: [] };
    let fraction = 0;
    let battements = 0;
    let ecritureEnCours = false;
    let derniereEcriture = 0;
    const battre = () => {
      if (ecritureEnCours) return; // le prochain battement passera
      ecritureEnCours = true;
      derniereEcriture = Date.now();
      sys
        .ecrire(FICHIERS.progression, JSON.stringify({ jeton, f: fraction, n: ++battements }))
        .catch(() => {})
        .finally(() => {
          ecritureEnCours = false;
        });
    };
    battre();
    const horloge = setInterval(battre, 1000);
    let dernierPourcent = -1;
    try {
      surEtape("Fonds perdus : calcul des correctifs…");
      const resultat = await borner(CALCUL_MAX_MS, sys.calculer(geo, (f) => {
        fraction = f;
        const pourcent = Math.round(f * 100);
        if (pourcent !== dernierPourcent) {
          dernierPourcent = pourcent;
          surEtape(`Fonds perdus : calcul des correctifs… ${pourcent} %`);
        }
        if (Date.now() - derniereEcriture >= 250) battre();
      }));
      reponse.correctifs = resultat.correctifs;
      reponse.doutes = resultat.doutes;
      nbDoutes = resultat.doutes.length;
      secondes = resultat.stats?.secondes;
    } catch (e) {
      erreur = message(e);
      reponse.erreur = erreur; // Illustrator l'affichera dans son message de fin
    } finally {
      clearInterval(horloge);
    }
    await sys.ecrire(FICHIERS.correctifs, JSON.stringify(reponse));
    surEtape("Fonds perdus : pose des correctifs…");
  } catch (e) {
    // relevé impossible : Illustrator n'attend pas de réponse, il termine seul avec les fonds perdus de l'outil habituel
    erreur = message(e);
  }

  // 4. pose des correctifs et message de fin, par Illustrator (affiché dans tous les cas)
  const pose = await attendre(FICHIERS.finFp, 10 * 60 * 1000);
  if (!pose.ok) return { poses: 0, doutes: nbDoutes, erreur: pose.erreur || erreur || "pose des correctifs impossible", secondes };
  return { poses: pose.poses || 0, doutes: pose.doutes || 0, erreur: erreur || pose.erreurFP || undefined, secondes };
}
