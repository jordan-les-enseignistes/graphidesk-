// Lecture d'un tableau Google Sheets partagé, SANS compte ni clé d'API.
//
// Pourquoi cette approche plutôt qu'un cadre intégré : Google bloque
// délibérément les navigateurs embarqués (politique de sécurité assumée), donc
// l'éditeur Sheets ne démarrera jamais dans GraphiDesk. La saisie reste dans le
// navigateur ; GraphiDesk, lui, AFFICHE le contenu pour que l'information soit
// consultable au même endroit que le reste.
//
// Deux points d'entrée publics de Google, vérifiés le 09/09/2026 sur un
// document réel :
//   - la page /edit contient déjà le bandeau d'onglets en clair (HTML servi) ;
//   - gviz/tq?tqx=out:csv&sheet=NOM renvoie le contenu d'un onglet en CSV.
// Tous deux répondent en anonyme, à condition que le document soit partagé
// « tout le monde avec le lien ».
//
// ⚠ Les requêtes partent du côté Rust (commande `lire_page_google`) : depuis
// le webview, Google n'autorise pas le CORS. Le côté Rust borne aussi la
// requête dans le temps et journalise les échecs — sans quoi une requête qui
// n'aboutit jamais laisse la page en chargement perpétuel.
import { invoke } from "@tauri-apps/api/core";

interface ReponseWeb {
  statut: number;
  type_contenu: string;
  corps: string;
}

function recuperer(url: string): Promise<ReponseWeb> {
  return invoke<ReponseWeb>("lire_page_google", { url });
}

/** Le document n'est pas lisible par lien : cas à distinguer d'une panne. */
export class AccesRefuse extends Error {
  constructor() {
    super("Document non accessible en lecture par lien.");
    this.name = "AccesRefuse";
  }
}

/** Extrait l'identifiant du document d'une URL Google Sheets. */
export function identifiantDocument(url: string): string | null {
  return /\/spreadsheets\/d\/([A-Za-z0-9_-]+)/.exec(url)?.[1] ?? null;
}

function decoderEntites(texte: string): string {
  const zone = document.createElement("textarea");
  zone.innerHTML = texte;
  return zone.value;
}

/**
 * Noms des onglets, dans l'ordre du bandeau.
 *
 * Renvoie un tableau VIDE si le bandeau n'a pas pu être lu : l'appelant se
 * rabat alors sur l'onglet actif, plutôt que d'afficher une erreur pour un
 * document parfaitement lisible.
 */
export async function listerOnglets(id: string): Promise<string[]> {
  const reponse = await recuperer(`https://docs.google.com/spreadsheets/d/${id}/edit`);
  if (reponse.statut !== 200) throw new AccesRefuse();
  const html = reponse.corps;
  const noms: string[] = [];
  const motif = /docs-sheet-tab-caption[^>]*>([^<]*)</g;
  let trouve: RegExpExecArray | null;
  while ((trouve = motif.exec(html)) !== null) {
    const nom = decoderEntites(trouve[1]).trim();
    if (nom && !noms.includes(nom)) noms.push(nom);
  }
  return noms;
}

/** Découpe un CSV en respectant les guillemets (virgules et sauts de ligne inclus). */
export function analyserCsv(csv: string): string[][] {
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let champ = "";
  let entreGuillemets = false;

  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (entreGuillemets) {
      if (c === '"') {
        if (csv[i + 1] === '"') {
          champ += '"';
          i++;
        } else {
          entreGuillemets = false;
        }
      } else {
        champ += c;
      }
      continue;
    }
    if (c === '"') {
      entreGuillemets = true;
    } else if (c === ",") {
      ligne.push(champ);
      champ = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && csv[i + 1] === "\n") i++;
      ligne.push(champ);
      lignes.push(ligne);
      ligne = [];
      champ = "";
    } else {
      champ += c;
    }
  }
  if (champ !== "" || ligne.length > 0) {
    ligne.push(champ);
    lignes.push(ligne);
  }
  return lignes;
}

/**
 * Retire les lignes et les colonnes entièrement vides en fin de tableau.
 * L'export de Google complète systématiquement jusqu'à la largeur de la
 * feuille : sans cela, on afficherait une vingtaine de colonnes fantômes.
 */
export function rognerVide(lignes: string[][]): string[][] {
  let bas = lignes.length;
  while (bas > 0 && lignes[bas - 1].every((c) => c.trim() === "")) bas--;
  const utiles = lignes.slice(0, bas);

  let largeur = 0;
  for (const l of utiles) {
    for (let i = l.length - 1; i >= largeur; i--) {
      if (l[i].trim() !== "") {
        largeur = i + 1;
        break;
      }
    }
  }
  return utiles.map((l) => {
    const decoupe = l.slice(0, largeur);
    while (decoupe.length < largeur) decoupe.push("");
    return decoupe;
  });
}

/**
 * Retire les colonnes dont AUCUNE ligne ne porte de donnée.
 *
 * Une feuille de calcul contient des colonnes de mise en page — colonnes de
 * respiration entre deux blocs, colonne d'un titre de feuille — qui n'ont de
 * sens que dans la grille d'origine. Reproduites telles quelles, elles ne font
 * qu'écarter les colonnes utiles. Le titre seul ne suffit donc pas à garder une
 * colonne : c'est la présence de données qui décide.
 */
export function retirerColonnesVides(lignes: string[][]): string[][] {
  if (lignes.length < 2) return lignes;
  const largeur = lignes[0].length;
  const gardees: number[] = [];
  for (let j = 0; j < largeur; j++) {
    if (lignes.slice(1).some((l) => (l[j] ?? "").trim() !== "")) gardees.push(j);
  }
  if (gardees.length === 0) return lignes;
  return lignes.map((l) => gardees.map((j) => l[j] ?? ""));
}

/**
 * Bandeaux de haut de feuille (titre, mode d'emploi), lus dans la colonne A.
 *
 * Google COLLE ces bandeaux sur l'entête de la première colonne, ce qui donne
 * des titres à rallonge (« Suivi des visites techniques SUIVI DU DOSSIER
 * Commande FP »). Les connaître permet de les retirer.
 *
 * ⚠ Cette sonde ne peut porter que sur la colonne A : demander les mêmes
 * lignes sur TOUTES les colonnes renvoie du vide, Google typant chaque colonne
 * d'après ses données (un titre texte dans une colonne de dates est écarté).
 */
async function bandeaux(id: string, onglet: string): Promise<string[]> {
  const adresse =
    `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv` +
    `&sheet=${encodeURIComponent(onglet)}&headers=0&tq=${encodeURIComponent("select A limit 5")}`;
  try {
    const reponse = await recuperer(adresse);
    if (reponse.statut !== 200 || !reponse.type_contenu.includes("csv")) return [];
    return analyserCsv(reponse.corps)
      .map((l) => (l[0] ?? "").trim())
      .filter((v) => v !== "");
  } catch {
    return [];
  }
}

/** Retire de l'entête les bandeaux que Google y a collés. */
function deshabiller(entete: string, prefixes: string[]): string {
  let reste = entete.trim();
  for (const p of prefixes) {
    if (reste.length > p.length && reste.startsWith(p)) {
      reste = reste.slice(p.length).trim();
    }
  }
  return reste || entete;
}

/**
 * Contenu d'un onglet. `onglet` omis = onglet actif du document.
 */
export async function lireOnglet(id: string, onglet?: string): Promise<string[][]> {
  const adresse = onglet
    ? `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(onglet)}`
    : `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
  const reponse = await recuperer(adresse);
  if (reponse.statut !== 200) throw new AccesRefuse();
  // Un document non partagé renvoie une page de connexion, en HTML : le code
  // 200 seul ne suffit donc pas à conclure que la lecture a réussi.
  if (!reponse.type_contenu.includes("csv")) throw new AccesRefuse();
  const lignes = retirerColonnesVides(rognerVide(analyserCsv(reponse.corps)));
  if (onglet && lignes.length > 0 && lignes[0].length > 0) {
    lignes[0][0] = deshabiller(lignes[0][0], await bandeaux(id, onglet));
  }
  return lignes;
}
