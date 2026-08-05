// Kit du nouvel arrivant : les ressources de l'atelier, stockées sur Supabase
// et INSTALLÉES à leur vraie place par GraphiDesk — le graphiste n'a pas à
// savoir où Adobe range ses préréglages.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { supabase } from "@/lib/supabase";

const BUCKET = "atelier-ressources";

export type RessourceCategorie =
  | "nuancier"
  | "gabarit"
  | "script_indesign"
  | "squelette"
  | "autre";

export interface AtelierRessource {
  id: string;
  nom: string;
  categorie: RessourceCategorie;
  /** Nom de fichier RÉEL, extension comprise — c'est lui qui est déposé */
  fichier_nom: string;
  fichier_path: string;
  description: string | null;
  version: string | null;
  taille: number | null;
  ordre: number;
  /** SHA-256 du fichier de la librairie — sert à repérer une MAJ à faire */
  empreinte: string | null;
  maj_le: string;
  created_at: string;
}

/** Ce que le poste dit d'une ressource : où elle irait, si elle y est déjà,
 *  et quelles versions périmées traînent à côté. */
export interface StatutRessource {
  dossier: string | null;
  erreur: string | null;
  installee: boolean;
  /** SHA-256 du fichier réellement présent sur le poste */
  empreinte: string | null;
  voisins: string[];
}

/**
 * Une ressource est « à mettre à jour » quand elle est installée mais que son
 * empreinte diffère de celle de la librairie. Sans les deux empreintes on ne
 * conclut rien : mieux vaut ne rien signaler qu'alerter à tort.
 */
export function aBesoinDeMaj(
  r: AtelierRessource,
  s: StatutRessource | undefined
): boolean {
  if (!s?.installee || !r.empreinte || !s.empreinte) return false;
  return r.empreinte !== s.empreinte;
}

/** Empreinte SHA-256 d'un fichier, calculée par le navigateur. */
async function empreinteDe(fichier: Blob): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", await fichier.arrayBuffer());
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const LIBELLE_CATEGORIE: Record<RessourceCategorie, string> = {
  nuancier: "Nuanciers Illustrator",
  script_indesign: "Scripts InDesign",
  gabarit: "Gabarits InDesign",
  squelette: "Arborescence de dossier",
  autre: "Divers",
};

/** Où chaque catégorie atterrit, dit en français au graphiste */
export const DESTINATION_LISIBLE: Record<RessourceCategorie, string> = {
  nuancier: "Préréglages d'Illustrator — visible dans Fenêtre ▸ Nuancier",
  script_indesign: "Panneau Scripts d'InDesign",
  gabarit: "L'emplacement que tu choisis",
  squelette: "L'emplacement que tu choisis",
  autre: "L'emplacement que tu choisis",
};

/**
 * Une catégorie s'INSTALLE (destination imposée par Adobe, notion de « déjà
 * présent ») ou se TÉLÉCHARGE (le graphiste choisit où, le fichier lui
 * appartient ensuite). Confondre les deux donnait un « Installer » pour un
 * gabarit qu'on ne fait que copier quelque part.
 */
export function sInstalle(c: RessourceCategorie): boolean {
  return c === "nuancier" || c === "script_indesign";
}

/** Ordre d'affichage : ce qu'on installe une fois d'abord, le reste ensuite */
const ORDRE_CATEGORIES: RessourceCategorie[] = [
  "nuancier",
  "script_indesign",
  "gabarit",
  "squelette",
  "autre",
];

export function useAtelierRessources() {
  return useQuery({
    queryKey: ["atelier-ressources"],
    queryFn: async (): Promise<AtelierRessource[]> => {
      const { data, error } = await supabase
        .from("atelier_ressources")
        .select("*")
        .order("ordre")
        .order("nom");
      if (error) throw error;
      const liste = (data ?? []) as AtelierRessource[];
      return liste.sort(
        (a, b) =>
          ORDRE_CATEGORIES.indexOf(a.categorie) - ORDRE_CATEGORIES.indexOf(b.categorie) ||
          a.ordre - b.ordre ||
          a.nom.localeCompare(b.nom)
      );
    },
  });
}

/** État d'installation de chaque ressource sur CE poste. Requête à part : elle
 *  interroge le disque, pas le réseau, et doit pouvoir être rafraîchie seule
 *  après une installation. */
export function useStatutsRessources(ressources: AtelierRessource[] | undefined) {
  const cles = (ressources ?? []).map((r) => `${r.categorie}/${r.fichier_nom}`).join("|");
  return useQuery({
    queryKey: ["atelier-ressources-statuts", cles],
    enabled: !!ressources?.length,
    queryFn: async (): Promise<Record<string, StatutRessource>> => {
      const out: Record<string, StatutRessource> = {};
      for (const r of ressources ?? []) {
        try {
          out[r.id] = await invoke<StatutRessource>("statut_ressource", {
            categorie: r.categorie,
            fichierNom: r.fichier_nom,
          });
        } catch (e) {
          out[r.id] = {
            dossier: null,
            erreur: String(e),
            installee: false,
            empreinte: null,
            voisins: [],
          };
        }
      }
      return out;
    },
  });
}

/** Base64 d'un blob, par tranches : `String.fromCharCode(...)` sur un tableau
 *  entier fait sauter la pile dès quelques mégaoctets (un .indd en fait 7). */
async function enBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  const TRANCHE = 0x8000;
  for (let i = 0; i < buf.length; i += TRANCHE) {
    bin += String.fromCharCode(...buf.subarray(i, i + TRANCHE));
  }
  return btoa(bin);
}

async function telecharger(r: AtelierRessource): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).download(r.fichier_path);
  if (error || !data) throw error ?? new Error("Téléchargement impossible");
  return enBase64(data);
}

/** Télécharge puis dépose la ressource à sa vraie place. Renvoie le chemin. */
export function useInstallerRessource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: AtelierRessource): Promise<string> => {
      const contenuBase64 = await telecharger(r);
      return invoke<string>("installer_ressource", {
        categorie: r.categorie,
        fichierNom: r.fichier_nom,
        contenuBase64,
      });
    },
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["atelier-ressources-statuts"] }),
  });
}

/** Retire la ressource de CE POSTE. Sans rapport avec la librairie partagée. */
export function useDesinstallerRessource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (r: AtelierRessource) =>
      invoke<string>("desinstaller_ressource", {
        categorie: r.categorie,
        fichierNom: r.fichier_nom,
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["atelier-ressources-statuts"] }),
  });
}

/** Télécharge la ressource à l'endroit choisi par le graphiste. */
export function useTelechargerRessource() {
  return useMutation({
    mutationFn: async (input: {
      ressource: AtelierRessource;
      destination: string;
    }): Promise<string> => {
      const contentBase64 = await telecharger(input.ressource);
      return invoke<string>("save_binary_to", {
        path: input.destination,
        contentBase64,
      });
    },
  });
}

/** Supprime des versions périmées — toujours sur demande explicite. */
export function useSupprimerPerimees() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { categorie: RessourceCategorie; fichiers: string[] }) =>
      invoke<number>("supprimer_ressources_perimees", {
        categorie: input.categorie,
        fichiers: input.fichiers,
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["atelier-ressources-statuts"] }),
  });
}

/** Déplie un squelette de dossier à l'endroit choisi, au nom du chantier. */
export function useCreerArborescence() {
  return useMutation({
    mutationFn: async (input: {
      ressource: AtelierRessource;
      destination: string;
      nomDossier: string;
    }): Promise<string> => {
      const zipBase64 = await telecharger(input.ressource);
      return invoke<string>("creer_arborescence", {
        destination: input.destination,
        nomDossier: input.nomDossier,
        zipBase64,
      });
    },
  });
}

export function useAddRessource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      nom: string;
      categorie: RessourceCategorie;
      description: string;
      version: string;
      fichier: File;
    }) => {
      const empreinte = await empreinteDe(input.fichier);
      const fichierPath = `${input.categorie}/${Date.now()}_${input.fichier.name}`;
      const up = await supabase.storage
        .from(BUCKET)
        .upload(fichierPath, input.fichier, { upsert: false });
      if (up.error) throw up.error;
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("atelier_ressources").insert({
        nom: input.nom,
        categorie: input.categorie,
        // ⚠ le nom de fichier vient du FICHIER, pas du libellé saisi : un
        // nuancier nommé « RAL Classic » doit atterrir en .ase, sans quoi
        // Illustrator ne le voit pas.
        fichier_nom: input.fichier.name,
        fichier_path: fichierPath,
        description: input.description || null,
        version: input.version || null,
        taille: input.fichier.size,
        empreinte,
        maj_le: new Date().toISOString(),
        created_by: auth.user?.id ?? null,
      });
      if (error) {
        await supabase.storage.from(BUCKET).remove([fichierPath]);
        throw error;
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["atelier-ressources"] }),
  });
}

export function useDeleteRessource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: AtelierRessource) => {
      await supabase.storage.from(BUCKET).remove([r.fichier_path]);
      const { error } = await supabase.from("atelier_ressources").delete().eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["atelier-ressources"] }),
  });
}

// ---------------------------------------------------------------------------
// Personnalisation des gabarits
// ---------------------------------------------------------------------------

export interface CoordonneesBat {
  nomComplet: string;
  prenom: string;
  nom: string;
  mail: string;
}

/**
 * Identité présente DANS les gabarits — celle qui sera remplacée.
 *
 * ⚠ PLUSIEURS formes par champ : un même gabarit porte tantôt le nom du
 * titulaire, tantôt l'emplacement vide resté en « xxxx XXXX » sous le titre
 * « VOTRE GRAPHISTE ». N'en traiter qu'une laissait l'autre sur le document
 * livré au client.
 *
 * Rangée en réglage d'application : elle appartient aux fichiers, pas à la
 * personne qui télécharge, et elle changera le jour où les gabarits changeront.
 */
export interface IdentiteReference {
  nomComplet: string[];
  prenom: string[];
  nom: string[];
  mail: string[];
}

/** Tolère l'ancienne forme (une seule chaîne par champ) comme la nouvelle. */
function enListe(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string" && x.trim());
  return typeof v === "string" && v.trim() ? [v] : [];
}

export function useIdentiteReference() {
  return useQuery({
    queryKey: ["gabarits-identite-reference"],
    queryFn: async (): Promise<IdentiteReference | null> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "gabarits_identite_reference")
        .maybeSingle();
      if (error) throw error;
      if (!data?.value) return null;
      const v = data.value as Record<string, unknown>;
      return {
        nomComplet: enListe(v.nomComplet),
        prenom: enListe(v.prenom),
        nom: enListe(v.nom),
        mail: enListe(v.mail),
      };
    },
    staleTime: 1000 * 60 * 30,
  });
}

/**
 * Couples à substituer, dans un ORDRE qui compte : le nom complet d'abord,
 * sinon « Jordan NEAU » serait d'abord amputé de son prénom et ne
 * correspondrait plus à rien.
 */
export function couplesDeRemplacement(
  reference: IdentiteReference,
  cible: CoordonneesBat
): { avant: string; apres: string }[] {
  const paires: { avant: string; apres: string }[] = [];
  const ajoute = (avants: string[], apres: string) => {
    for (const avant of avants) paires.push({ avant, apres });
  };
  // ⚠ le nom COMPLET d'abord, puis le mail, puis les formes courtes : « xxxx »
  // est un morceau de « xxxxx@… », et « Jordan » un morceau de « Jordan NEAU ».
  // Traiter les longues d'abord évite de couper une chaîne en deux.
  ajoute(reference.nomComplet, cible.nomComplet);
  ajoute(reference.mail, cible.mail);
  ajoute(reference.prenom, cible.prenom);
  ajoute(reference.nom, cible.nom);
  return paires.filter((c) => c.avant.trim() && c.apres.trim() && c.avant !== c.apres);
}

export interface RapportPersonnalisation {
  fichiers: number;
  remplacements: number;
  echecs: string[];
}

/** Met un gabarit déjà téléchargé au nom du graphiste. */
export async function personnaliserFichier(
  fichier: string,
  remplacements: { avant: string; apres: string }[]
): Promise<number> {
  return invoke<number>("personnaliser_gabarit", { fichier, remplacements });
}

/** Met au nom du graphiste tous les gabarits d'une arborescence. */
export async function personnaliserDossier(
  dossier: string,
  remplacements: { avant: string; apres: string }[]
): Promise<RapportPersonnalisation> {
  return invoke<RapportPersonnalisation>("personnaliser_dossier", {
    dossier,
    remplacements,
  });
}

/**
 * « Télécharger le .zip » d'un squelette, au nom du graphiste : on le déplie
 * dans un dossier de travail, on personnalise les gabarits, puis on
 * recompresse vers la destination choisie. Sans ce détour, le zip livré
 * resterait au nom du précédent.
 */
export async function zipPersonnalise(input: {
  ressource: AtelierRessource;
  destination: string;
  remplacements: { avant: string; apres: string }[];
}): Promise<RapportPersonnalisation> {
  const travail = await invoke<string>("dossier_temporaire", { nom: "squelette" });
  const zipBase64 = await telecharger(input.ressource);
  const racine = await invoke<string>("creer_arborescence", {
    destination: travail,
    nomDossier: "NOMDUDOSSIER",
    zipBase64,
  });
  const rapport = input.remplacements.length
    ? await personnaliserDossier(racine, input.remplacements)
    : { fichiers: 0, remplacements: 0, echecs: [] };
  await invoke<string>("zipper_dossier", { dossier: racine, destination: input.destination });
  return rapport;
}
