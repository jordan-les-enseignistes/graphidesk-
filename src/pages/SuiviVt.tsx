// Suivi VT — le tableau partagé avec le prestataire, CONSULTABLE dans
// GraphiDesk et modifiable d'un clic dans le navigateur.
//
// ⚠ Pourquoi la lecture seule ici. Essayé le 09/09/2026, et mesuré : cadre
// intégré, fenêtre GraphiDesk dédiée, signature de navigateur standard — les
// trois échouent (« Problème lors du chargement »). Google bloque
// délibérément les navigateurs embarqués ; ce n'est pas contournable. Et les
// gestionnaires de pose n'utilisent pas GraphiDesk : la saisie doit rester
// dans le document commun. GraphiDesk apporte donc ce qui manquait — voir
// l'information sans quitter l'application, et retrouver le lien sans le
// chercher.
import { useCallback, useEffect, useMemo, useState } from "react";
import { open as ouvrirDansNavigateur } from "@tauri-apps/plugin-shell";
import { toast } from "sonner";
import {
  ExternalLink,
  TableProperties,
  RefreshCw,
  Search,
  TriangleAlert,
  Square,
  SquareCheckBig,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loading } from "@/components/ui/loading";
import { supabase } from "@/lib/supabase";
import {
  AccesRefuse,
  identifiantDocument,
  listerOnglets,
  lireOnglet,
} from "@/lib/googleSheet";

/** L'URL vit en réglage d'application : changer de document ne doit pas
 *  demander une nouvelle version de GraphiDesk. */
const CLE_REGLAGE = "suivi_vt_url";

/** Onglet actif du document, quand le bandeau n'a pas pu être lu. */
const ONGLET_PAR_DEFAUT = "Feuille active";

/** Onglets sans intérêt au quotidien : ils restent dans le document, ils ne
 *  sont simplement pas proposés ici. */
const ONGLETS_MASQUES = ["Mode d'emploi", "Listes"];

/** Le dernier onglet consulté est retenu : le premier onglet d'un document est
 *  souvent un mode d'emploi, sans intérêt une fois qu'on le connaît. */
const CLE_DERNIER_ONGLET = "suivi_vt_dernier_onglet";

export default function SuiviVt() {
  const [url, setUrl] = useState<string | null>(null);
  const [onglets, setOnglets] = useState<string[]>([]);
  const [ongletActif, setOngletActif] = useState<string | null>(null);
  const [lignes, setLignes] = useState<string[][]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [accesRefuse, setAccesRefuse] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [heureMaj, setHeureMaj] = useState<Date | null>(null);

  const id = useMemo(() => (url ? identifiantDocument(url) : null), [url]);

  // Une adresse mal formée doit se voir, pas se traduire par un chargement
  // qui tourne indéfiniment.
  useEffect(() => {
    if (url && !id) {
      setErreur("L'adresse configurée n'est pas un document Google Sheets.");
      setChargement(false);
    }
  }, [url, id]);

  // 1. L'adresse du document
  useEffect(() => {
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", CLE_REGLAGE)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          setErreur(error.message);
          setChargement(false);
          return;
        }
        const v = typeof data?.value === "string" ? data.value : null;
        if (!v) {
          setErreur("Aucun document n'est configuré pour le Suivi VT.");
          setChargement(false);
          return;
        }
        setUrl(v);
      });
  }, []);

  // 2. Les onglets du document
  useEffect(() => {
    if (!id) return;
    let vivant = true;
    listerOnglets(id)
      .then((tous) => {
        if (!vivant) return;
        const noms = tous.filter((n) => !ONGLETS_MASQUES.includes(n));
        setOnglets(noms);
        const retenu = localStorage.getItem(CLE_DERNIER_ONGLET);
        setOngletActif(
          retenu && noms.includes(retenu) ? retenu : noms[0] ?? ONGLET_PAR_DEFAUT
        );
      })
      .catch(() => {
        // Le bandeau est un confort : sans lui on affiche l'onglet actif,
        // ce qui reste utile. L'échec réel se verra au chargement du contenu.
        if (!vivant) return;
        setOnglets([]);
        setOngletActif(ONGLET_PAR_DEFAUT);
      });
    return () => {
      vivant = false;
    };
  }, [id]);

  // 3. Le contenu de l'onglet choisi
  const charger = useCallback(async () => {
    if (!id || !ongletActif) {
      setChargement(false);
      return;
    }
    setChargement(true);
    setErreur(null);
    setAccesRefuse(false);
    try {
      const contenu = await lireOnglet(
        id,
        ongletActif === ONGLET_PAR_DEFAUT ? undefined : ongletActif
      );
      setLignes(contenu);
      setHeureMaj(new Date());
    } catch (e) {
      setLignes([]);
      if (e instanceof AccesRefuse) setAccesRefuse(true);
      else setErreur(String(e));
    } finally {
      setChargement(false);
    }
  }, [id, ongletActif]);

  useEffect(() => {
    void charger();
  }, [charger]);

  // Toutes les feuilles ne sont pas des tableaux. « Tableau de bord » empile
  // des blocs, dont deux CÔTE À CÔTE (À TRAITER MAINTENANT à gauche, NATURE
  // DES ANOMALIES à droite) : sa première ligne porte donc deux titres, sans
  // pour autant nommer des colonnes. Y plaquer une ligne d'entête ferait
  // passer un titre de bloc pour le nom de toute une colonne.
  // Le critère qui distingue les deux : une vraie ligne d'entête nomme la
  // PLUPART des colonnes, un alignement de titres de blocs seulement quelques
  // unes.
  const aEntete = useMemo(() => {
    const premiere = lignes[0];
    if (!premiere || premiere.length === 0) return false;
    const nommees = premiere.filter((c) => c.trim() !== "").length;
    return nommees / premiere.length >= 0.6;
  }, [lignes]);

  const largeur = useMemo(
    () => lignes.reduce((m, l) => Math.max(m, l.length), 0),
    [lignes]
  );

  const entetes = aEntete ? lignes[0] : [];
  const corps = useMemo(() => {
    // Les lignes vides ne servent qu'à espacer les blocs dans la feuille.
    const donnees = (aEntete ? lignes.slice(1) : lignes).filter((l) =>
      l.some((c) => c.trim() !== "")
    );
    const q = recherche.trim().toLowerCase();
    if (!q) return donnees;
    return donnees.filter((l) => l.some((c) => c.toLowerCase().includes(q)));
  }, [lignes, recherche, aEntete]);

  /** Titre de bloc : la feuille les écrit en capitales, c'est sa convention.
   *  Réservé aux feuilles sans entête — ailleurs, une référence comme
   *  « FP-26-0101 » est aussi en capitales sans être un titre. */
  const titreDeBloc = (valeur: string) => {
    if (aEntete) return false;
    const v = valeur.trim();
    return v.length > 0 && v.length <= 40 && /[A-ZÀ-Þ]/.test(v) && v === v.toUpperCase();
  };

  const estBooleen = (valeur: string) => {
    const v = valeur.trim().toUpperCase();
    return v === "TRUE" || v === "VRAI" || v === "FALSE" || v === "FAUX";
  };

  /** Les colonnes de cases à cocher arrivent en « TRUE »/« FALSE » : illisible
   *  en tableau. On rend la case elle-même. */
  const contenuCellule = (valeur: string) => {
    const v = valeur.trim().toUpperCase();
    if (v === "TRUE" || v === "VRAI")
      return <SquareCheckBig className="h-4 w-4 text-emerald-500" aria-label="oui" />;
    if (v === "FALSE" || v === "FAUX")
      return <Square className="h-4 w-4 text-slate-300 dark:text-slate-600" aria-label="non" />;
    return valeur;
  };

  const ouvrirPourModifier = () => {
    if (!url) return;
    ouvrirDansNavigateur(url).catch((e) => toast.error(String(e)));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold dark:text-slate-100">
            <TableProperties className="h-6 w-6 text-emerald-500" />
            Suivi VT
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Le tableau partagé avec le prestataire, consultable ici. Pour le modifier, il s'ouvre
            dans ton navigateur.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!id || chargement}
            onClick={() => void charger()}
            className="gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${chargement ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
          <Button disabled={!url} onClick={ouvrirPourModifier} className="gap-1.5">
            <ExternalLink className="h-4 w-4" />
            Modifier dans le navigateur
          </Button>
        </div>
      </div>

      {erreur && (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
          {erreur}
        </div>
      )}

      {accesRefuse && (
        <div className="flex gap-3 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">Le document n'est pas lisible depuis GraphiDesk.</p>
            <p>
              Son partage est restreint à des comptes précis. Pour l'afficher ici, passe-le en
              « Tout utilisateur disposant du lien » en <strong>Lecteur</strong> : le partage
              d'écriture existant reste inchangé. Le bouton « Modifier dans le navigateur »
              fonctionne dans tous les cas.
            </p>
          </div>
        </div>
      )}

      {onglets.length > 1 && (
        <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700">
          {onglets.map((nom) => (
            <button
              key={nom}
              onClick={() => {
                setOngletActif(nom);
                localStorage.setItem(CLE_DERNIER_ONGLET, nom);
              }}
              className={`-mb-px border-b-2 px-3 py-1.5 text-sm transition-colors ${
                nom === ongletActif
                  ? "border-emerald-500 font-medium text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {nom}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher dans le tableau…"
            className="pl-8"
          />
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {corps.length} ligne{corps.length > 1 ? "s" : ""}
          {heureMaj &&
            ` · à jour au ${heureMaj.toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            })}`}
        </span>
      </div>

      <Card className="overflow-hidden p-0">
        {(chargement || (!ongletActif && !erreur && !accesRefuse)) && lignes.length === 0 ? (
          <div className="p-10">
            <Loading text="Lecture du tableau…" />
          </div>
        ) : lignes.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">
            {accesRefuse ? "Contenu indisponible." : "Ce tableau est vide."}
          </p>
        ) : (
          <div className="max-h-[calc(100vh-22rem)] overflow-auto">
            {/* Quadrillage COMPLET : une bordure sur les quatre côtés de chaque
                cellule. Un tableau dense sans lignes verticales oblige l'œil à
                suivre l'alignement tout seul, et la lecture décroche. */}
            <table className="w-full border-collapse text-sm">
              {aEntete && (
              <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                <tr>
                  {entetes.map((titre, i) => (
                    <th
                      key={i}
                      className="border border-slate-300 px-3 py-2 text-center align-middle font-medium text-slate-700 shadow-[inset_0_-1px_0_#cbd5e1] dark:border-slate-600 dark:text-slate-200 dark:shadow-[inset_0_-1px_0_#475569]"
                    >
                      <div className="mx-auto min-w-[5rem] max-w-[12rem] whitespace-normal break-words">
                        {titre}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              )}
              <tbody>
                {corps.map((ligne, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    {Array.from({ length: largeur }).map((_, j) => {
                      const brut = ligne[j] ?? "";
                      const coche = estBooleen(brut);
                      const titre = titreDeBloc(brut);
                      return (
                        <td
                          key={j}
                          title={coche ? undefined : brut}
                          className={`border border-slate-200 px-3 py-1.5 align-top dark:border-slate-700 ${
                            titre
                              ? "bg-slate-100 font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                              : "text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          <div
                            className={
                              coche ? "flex justify-center" : "max-w-[16rem] truncate"
                            }
                          >
                            {contenuCellule(brut)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
