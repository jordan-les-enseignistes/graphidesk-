/**
 * VérifIzy — préparation : classement de l'inventaire d'un dossier, SANS API.
 * Sert à l'écran Préparation (ce qui est là, ce qui manque), au choix des
 * annexes à examiner et à l'estimation de durée. Claude reçoit l'inventaire
 * brut et la liste des annexes autorisées ; il refait son propre classement.
 */
import type { EntreeDossier } from "./outils";

export type EtatPiece = "trouve" | "absent" | "non_prevu" | "client";

export interface Piece {
  nom: string;
  etat: EtatPiece;
  detail: string;
}

export interface Annexe {
  chemin: string;
  pourquoi: string;
  coche: boolean;
}

export interface Inventaire {
  pieces: Piece[];
  annexes: Annexe[];
  aDevis: boolean;
  /** fichiers que l'analyse lira à coup sûr (BAT, FAB, devis) */
  lusDOffice: string[];
  nbFichiers: number;
}

const nomDe = (c: string) => c.split("/").pop() ?? c;
const dossiers = (c: string) => c.split("/").slice(0, -1).map((d) => d.toUpperCase());
const dans = (c: string, re: RegExp) => dossiers(c).some((d) => re.test(d));
const ext = (c: string) => (nomDe(c).split(".").pop() ?? "").toLowerCase();
const date = (s: number) => (s ? new Date(s * 1000).toLocaleDateString("fr-FR") : "?");

const RE_ARCHIVE = /ARCHIVE|ANCIEN|OLD|PROVISOIRE/;

export function estDevis(c: string): boolean {
  const n = nomDe(c);
  return /devis|\bDE\d{4}|^DEV[_-]/i.test(n) || /^(CO|PR)\d{4}-\d{4,5}.*\.pdf$/i.test(n);
}

export function classerInventaire(entrees: EntreeDossier[]): Inventaire {
  const fichiers = entrees.filter((e) => !e.est_dossier);
  const pdfLike = (c: string) => ["pdf", "ai"].includes(ext(c));

  const devis = fichiers.filter((f) => estDevis(f.chemin));
  const fab = fichiers.filter((f) => pdfLike(f.chemin) && dans(f.chemin, /^FAB/) && !dans(f.chemin, RE_ARCHIVE));
  const bat = fichiers.filter(
    (f) => ext(f.chemin) === "pdf" && /^BAT/i.test(nomDe(f.chemin)) && !dans(f.chemin, /MAIRIE|VT|MAQUETTE|FP/) && !dans(f.chemin, RE_ARCHIVE)
  );
  const aDossier = (re: RegExp) => entrees.some((e) => e.est_dossier && re.test(nomDe(e.chemin).toUpperCase()));
  const vt = fichiers.filter((f) => dans(f.chemin, /^VT/));
  const mairie = fichiers.filter((f) => dans(f.chemin, /MAIRIE/));
  const maquette = fichiers.filter((f) => dans(f.chemin, /MAQUETTE/) || /maquette/i.test(nomDe(f.chemin)));
  const cotesClient = fichiers.filter((f) => /c[oô]tes|m[eé]tr[eé]s|notice/i.test(nomDe(f.chemin)));

  const pieces: Piece[] = [
    bat.length
      ? { nom: "BAT", etat: "trouve", detail: `${nomDe(bat.sort((a, b) => b.modifie - a.modifie)[0].chemin)}, du ${date(bat[0].modifie)}` }
      : { nom: "BAT", etat: "absent", detail: "Aucun BAT à la racine" },
    fab.length
      ? { nom: "Fichiers de FAB", etat: "trouve", detail: `${fab.length} fichier${fab.length > 1 ? "s" : ""}` }
      : { nom: "Fichiers de FAB", etat: "absent", detail: "Pas encore de fichiers de FAB" },
    devis.length
      ? { nom: "Devis", etat: "trouve", detail: nomDe(devis[0].chemin) }
      : { nom: "Devis", etat: "absent", detail: "Aucun devis ni bon de commande" },
    maquette.length
      ? { nom: "Maquette", etat: "trouve", detail: `${maquette.length} fichier${maquette.length > 1 ? "s" : ""}` }
      : { nom: "Maquette", etat: "non_prevu", detail: "Aucun fichier de maquette" },
    vt.length || aDossier(/^VT/)
      ? { nom: "VT", etat: "trouve", detail: `${vt.length} fichier${vt.length > 1 ? "s" : ""}` }
      : cotesClient.length
        ? { nom: "Cotes", etat: "client", detail: "Cotes fournies par le client" }
        : { nom: "VT", etat: "non_prevu", detail: "Pas de VT : normal si elle n'était pas prévue" },
    mairie.length || aDossier(/MAIRIE/)
      ? { nom: "Mairie", etat: "trouve", detail: `${mairie.length} fichier${mairie.length > 1 ? "s" : ""}` }
      : { nom: "Mairie", etat: "non_prevu", detail: "Pas de dossier mairie : normal s'il n'était pas prévu" },
  ];

  // Annexes : tout ce qui n'est ni BAT, ni FAB, ni devis, ni source (.indd/.psd/.ai lourds)
  const dejaLus = new Set([...bat, ...fab, ...devis].map((f) => f.chemin));
  const annexes: Annexe[] = fichiers
    .filter((f) => !dejaLus.has(f.chemin) && ["pdf", "jpg", "jpeg", "png", "webp"].includes(ext(f.chemin)) && !dans(f.chemin, /ARCHIVE/))
    .map((f) => {
      const n = nomDe(f.chemin);
      const image = ext(f.chemin) !== "pdf";
      let pourquoi = image ? "Image : à regarder seulement si elle peut révéler un problème." : "Document annexe.";
      let coche = false;
      if (dans(f.chemin, /MAIRIE/) && !image) {
        coche = true;
        pourquoi = /arr[eê]t|refus|autoris|abf|avis|accord/i.test(n)
          ? "Réponse de la mairie : à lire en entier (réserves, refus)."
          : "Dossier mairie : vérifier qu'on ne fabrique pas plus grand que le dépôt.";
      } else if (dans(f.chemin, /^VT/) && !image) {
        coche = true;
        pourquoi = "Fiche de VT : cotes relevées, support, électricité, remarques.";
      } else if (dans(f.chemin, /^VT/) && image) {
        // souvent la VT n'est pas un PDF rempli mais des photos du BAT VT annoté
        coche = true;
        pourquoi = "Photo de VT : peut porter les cotes relevées (aperçu rapide d'abord).";
      } else if (/c[oô]tes|m[eé]tr[eé]s|notice/i.test(n) || /^MX-|scan/i.test(n)) {
        coche = true;
        pourquoi = "Cotes du client : à confronter au BAT.";
      } else if (dans(f.chemin, /PROVISOIRE/)) {
        pourquoi = "Signalétique provisoire : hors commande définitive.";
      } else if (dans(f.chemin, /MAQUETTE/) && !image) {
        pourquoi = "Maquette exportée : utile pour comparer à la FAB.";
      }
      return { chemin: f.chemin, pourquoi, coche };
    })
    .sort((a, b) => Number(b.coche) - Number(a.coche));

  return {
    pieces,
    annexes,
    aDevis: devis.length > 0,
    lusDOffice: [...dejaLus],
    nbFichiers: fichiers.length,
  };
}

/** Durée estimée (s) : ~18 s par fichier lu, ~12 s par annexe, plus le bilan */
export function dureeEstimee(nbLus: number, nbAnnexes: number): number {
  return Math.round(25 + nbLus * 18 + nbAnnexes * 12);
}

export function formaterDuree(s: number): string {
  if (s < 60) return `${Math.max(5, Math.round(s / 5) * 5)} s`;
  const m = Math.floor(s / 60), r = Math.round((s % 60) / 10) * 10;
  return r ? `${m} min ${r}` : `${m} min`;
}
