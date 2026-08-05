// Kit du nouvel arrivant — chaque ressource affiche son ÉTAT sur ce poste et
// s'installe à sa vraie place en un clic. Le graphiste n'a rien à ranger.
import { useRef, useState } from "react";
import { toast } from "sonner";
import { open, save } from "@tauri-apps/plugin-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowUpCircle,
  CheckCircle2,
  Download,
  Eraser,
  FolderPlus,
  HardDriveDownload,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useHasPermission } from "@/hooks/useHasPermission";
import { useAuthStore } from "@/stores/authStore";
import { CoordonneesBatDialog } from "@/components/fabrik/CoordonneesBatDialog";
import {
  useAtelierRessources,
  useStatutsRessources,
  useAddRessource,
  useDeleteRessource,
  useInstallerRessource,
  useDesinstallerRessource,
  useTelechargerRessource,
  useSupprimerPerimees,
  useCreerArborescence,
  LIBELLE_CATEGORIE,
  DESTINATION_LISIBLE,
  sInstalle,
  aBesoinDeMaj,
  useIdentiteReference,
  couplesDeRemplacement,
  personnaliserFichier,
  personnaliserDossier,
  zipPersonnalise,
  type CoordonneesBat,
  type AtelierRessource,
  type RessourceCategorie,
  type StatutRessource,
} from "@/hooks/useAtelierRessources";

function tailleLisible(octets: number | null): string {
  if (!octets) return "";
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

const CATEGORIES: RessourceCategorie[] = [
  "nuancier",
  "script_indesign",
  "gabarit",
  "squelette",
  "autre",
];

export function AtelierRessourcesCard() {
  const { data: ressources, isLoading } = useAtelierRessources();
  const { data: statuts, refetch: relireStatuts } = useStatutsRessources(ressources);
  const peutGerer = useHasPermission("manage:users");
  const addRessource = useAddRessource();
  const deleteRessource = useDeleteRessource();
  const installer = useInstallerRessource();
  const desinstaller = useDesinstallerRessource();
  const telecharger = useTelechargerRessource();
  const supprimerPerimees = useSupprimerPerimees();
  const creerArbo = useCreerArborescence();

  const { data: reference } = useIdentiteReference();
  const profile = useAuthStore((e) => e.profile);
  // ⚠ Pré-remplissage seulement : Jordan prépare parfois un dossier pour
  // quelqu'un d'autre, les champs restent libres.
  const defautCoordonnees: CoordonneesBat = {
    nomComplet: profile?.nom_bat || profile?.full_name || "",
    prenom: (profile?.full_name || "").split(" ")[0] ?? "",
    nom: (profile?.full_name || "").split(" ").slice(1).join(" "),
    mail: profile?.email || "",
  };
  const [demande, setDemande] = useState<
    | null
    | { type: "gabarit"; r: AtelierRessource; destination: string }
    | { type: "zip"; r: AtelierRessource; destination: string }
    | { type: "dossier"; r: AtelierRessource; destination: string; nomDossier: string }
  >(null);

  const [enCours, setEnCours] = useState<string | null>(null);
  const [addCategorie, setAddCategorie] = useState<RessourceCategorie>("nuancier");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddFile = (file: File) => {
    addRessource.mutate(
      {
        nom: file.name.replace(/\.[^.]+$/, ""),
        categorie: addCategorie,
        description: "",
        version: "",
        fichier: file,
      },
      {
        onSuccess: () => toast.success(`« ${file.name} » ajouté à la librairie`),
        onError: (e) => toast.error(String(e)),
      }
    );
  };

  const handleInstaller = async (r: AtelierRessource) => {
    setEnCours(r.id);
    try {
      const chemin = await installer.mutateAsync(r);
      toast.success(`« ${r.nom} » installé`, { description: chemin, duration: 7000 });
    } catch (e) {
      toast.error(String(e), { duration: 10000 });
    } finally {
      setEnCours(null);
    }
  };

  const handleTelecharger = async (r: AtelierRessource) => {
    const cible = await save({ defaultPath: r.fichier_nom, title: `Enregistrer « ${r.nom} »` });
    if (!cible) return;
    // Un gabarit InDesign porte une identité : on la met à jour avant livraison.
    if (r.categorie === "gabarit" && reference) {
      setDemande({ type: "gabarit", r, destination: cible });
      return;
    }
    if (r.categorie === "squelette" && reference) {
      setDemande({ type: "zip", r, destination: cible });
      return;
    }
    await livrerFichier(r, cible, []);
  };

  const livrerFichier = async (
    r: AtelierRessource,
    cible: string,
    remplacements: { avant: string; apres: string }[]
  ) => {
    setEnCours(r.id);
    try {
      const chemin = await telecharger.mutateAsync({ ressource: r, destination: cible });
      let suffixe = "";
      if (remplacements.length) {
        const n = await personnaliserFichier(chemin, remplacements);
        suffixe = ` — ${n} mention(s) mise(s) à ton nom`;
      }
      toast.success(`« ${r.nom} » enregistré${suffixe}`, {
        description: chemin,
        duration: 8000,
      });
    } catch (e) {
      toast.error(String(e), { duration: 12000 });
    } finally {
      setEnCours(null);
    }
  };

  const handleDesinstaller = async (r: AtelierRessource) => {
    const ok = window.confirm(
      `Retirer « ${r.nom} » de CE POSTE ?\n\n` +
        `Le fichier reste dans la librairie : tu pourras le réinstaller quand tu veux.`
    );
    if (!ok) return;
    setEnCours(r.id);
    try {
      const chemins = await desinstaller.mutateAsync(r);
      toast.success(`« ${r.nom} » retiré de ce poste`, {
        description: chemins,
        duration: 7000,
      });
    } catch (e) {
      toast.error(String(e), { duration: 10000 });
    } finally {
      setEnCours(null);
    }
  };

  const handleNettoyer = async (r: AtelierRessource, voisins: string[]) => {
    const ok = window.confirm(
      `Supprimer définitivement ${voisins.length} ancienne(s) version(s) ?\n\n` +
        voisins.join("\n") +
        `\n\nSeul « ${r.fichier_nom} » sera conservé.`
    );
    if (!ok) return;
    try {
      const n = await supprimerPerimees.mutateAsync({
        categorie: r.categorie,
        fichiers: voisins,
      });
      toast.success(`${n} ancienne(s) version(s) supprimée(s)`);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleArborescence = async (r: AtelierRessource) => {
    const nom = window.prompt("Nom du dossier de chantier à créer ?");
    if (!nom?.trim()) return;
    const dossier = await open({ directory: true, title: "Où créer le dossier ?" });
    if (typeof dossier !== "string") return;
    if (reference) {
      setDemande({ type: "dossier", r, destination: dossier, nomDossier: nom.trim() });
      return;
    }
    await livrerDossier(r, dossier, nom.trim(), []);
  };

  const livrerDossier = async (
    r: AtelierRessource,
    destination: string,
    nomDossier: string,
    remplacements: { avant: string; apres: string }[]
  ) => {
    setEnCours(r.id);
    try {
      const chemin = await creerArbo.mutateAsync({ ressource: r, destination, nomDossier });
      let suffixe = "";
      if (remplacements.length) {
        const rap = await personnaliserDossier(chemin, remplacements);
        suffixe = ` — ${rap.fichiers} gabarit(s) à ton nom`;
        // ⚠ un échec partiel doit se voir : un gabarit resté au nom du
        // précédent partirait sinon chez le client sans que personne ne le sache
        rap.echecs.forEach((e) => toast.error(e, { duration: 15000 }));
      }
      toast.success(`Dossier créé${suffixe}`, { description: chemin, duration: 10000 });
    } catch (e) {
      toast.error(String(e), { duration: 12000 });
    } finally {
      setEnCours(null);
    }
  };

  const validerCoordonnees = async (c: CoordonneesBat) => {
    const d = demande;
    setDemande(null);
    if (!d || !reference) return;
    const remplacements = couplesDeRemplacement(reference, c);
    if (d.type === "gabarit") {
      await livrerFichier(d.r, d.destination, remplacements);
    } else if (d.type === "dossier") {
      await livrerDossier(d.r, d.destination, d.nomDossier, remplacements);
    } else {
      setEnCours(d.r.id);
      try {
        const rap = await zipPersonnalise({
          ressource: d.r,
          destination: d.destination,
          remplacements,
        });
        rap.echecs.forEach((e) => toast.error(e, { duration: 15000 }));
        toast.success(`Archive enregistrée — ${rap.fichiers} gabarit(s) à ton nom`, {
          description: d.destination,
          duration: 10000,
        });
      } catch (e) {
        toast.error(String(e), { duration: 12000 });
      } finally {
        setEnCours(null);
      }
    }
  };

  const ligne = (r: AtelierRessource) => {
    const s: StatutRessource | undefined = statuts?.[r.id];
    const squelette = r.categorie === "squelette";
    const installable = sInstalle(r.categorie);
    const aMaj = aBesoinDeMaj(r, s);
    const occupe = enCours === r.id;
    return (
      <div
        key={r.id}
        className="flex items-start gap-3 rounded border border-slate-200 dark:border-slate-700 px-3 py-2"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium dark:text-slate-200 truncate">{r.nom}</span>
            {r.version && (
              <span className="text-[11px] rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-slate-500 dark:text-slate-300 shrink-0">
                v{r.version}
              </span>
            )}
            <span className="text-xs text-slate-400 shrink-0">{tailleLisible(r.taille)}</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {r.description || r.fichier_nom}
          </p>

          {installable && s?.erreur && (
            <p className="text-xs text-red-500 mt-1">{s.erreur}</p>
          )}
          {installable && !s?.erreur && s?.installee && !aMaj && (
            <p className="text-xs flex items-center gap-1 text-emerald-600 dark:text-emerald-400 mt-1">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Déjà installé sur ce poste
            </p>
          )}
          {installable && aMaj && (
            <p className="text-xs flex items-center gap-1 text-sky-600 dark:text-sky-400 mt-1 font-medium">
              <ArrowUpCircle className="h-3.5 w-3.5 shrink-0" />
              Une nouvelle version est disponible — ta copie date d'avant
            </p>
          )}
          {!!s?.voisins.length && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="text-xs flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Ancienne(s) version(s) présente(s) : {s.voisins.join(", ")}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[11px]"
                onClick={() => handleNettoyer(r, s.voisins)}
              >
                Faire le ménage
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {squelette && (
            <Button
              size="sm"
              disabled={occupe}
              onClick={() => handleArborescence(r)}
              className="gap-1.5"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              Créer un dossier
            </Button>
          )}

          <Button
            size="sm"
            disabled={occupe}
            onClick={() => (installable ? handleInstaller(r) : handleTelecharger(r))}
            className="gap-1.5"
            variant={installable && (!s?.installee || aMaj) ? "default" : "outline"}
          >
            {occupe ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : aMaj ? (
              <ArrowUpCircle className="h-3.5 w-3.5" />
            ) : installable ? (
              <HardDriveDownload className="h-3.5 w-3.5" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {/* Installer = destination imposée par Adobe ; Télécharger = le
                graphiste choisit où, et le fichier lui appartient ensuite. */}
            {!installable
              ? squelette
                ? "Télécharger le .zip"
                : "Télécharger"
              : aMaj
                ? "Mettre à jour"
                : s?.installee
                  ? "Réinstaller"
                  : "Installer"}
          </Button>

          {installable && s?.installee && (
            <Button
              variant="ghost"
              size="sm"
              disabled={occupe}
              onClick={() => handleDesinstaller(r)}
              className="gap-1.5 text-slate-500"
              title="Retirer le fichier de ce poste uniquement"
            >
              <Eraser className="h-3.5 w-3.5" />
              Désinstaller
            </Button>
          )}

          {peutGerer && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
              onClick={() =>
                window.confirm(
                  `SUPPRIMER « ${r.nom} » DE LA LIBRAIRIE ?\n\n` +
                    `Le fichier disparaît pour TOUTE L'ÉQUIPE et cette action est ` +
                    `définitive.\n\nPour l'enlever seulement de ton poste, utilise ` +
                    `« Désinstaller ».`
                ) &&
                deleteRessource.mutate(r, {
                  onSuccess: () => toast.success(`« ${r.nom} » retiré de la librairie`),
                  onError: (e) => toast.error(String(e)),
                })
              }
              title="Supprimer de la librairie partagée — définitif, pour toute l'équipe"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
    <CoordonneesBatDialog
      ouvert={!!demande}
      defaut={defautCoordonnees}
      reference={reference ?? null}
      onValider={validerCoordonnees}
      onAnnuler={() => setDemande(null)}
    />
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Les nuanciers et les scripts s'<strong>installent</strong> à leur vraie place, là où
          Illustrator et InDesign vont les chercher. Le reste se <strong>télécharge</strong> où
          tu veux.
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => relireStatuts()}
          className="gap-1.5 h-8 shrink-0"
          title="Relire l'état d'installation sur ce poste"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Actualiser
        </Button>
      </div>

      {peutGerer && (
        <div className="flex items-center gap-2 rounded-md border border-dashed border-slate-300 dark:border-slate-600 p-2.5">
          <select
            value={addCategorie}
            onChange={(e) => setAddCategorie(e.target.value as RessourceCategorie)}
            className="h-8 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs dark:text-slate-200"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {LIBELLE_CATEGORIE[c]}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            disabled={addRessource.isPending}
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5 h-8"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter à la librairie
          </Button>
          <p className="text-[11px] text-slate-400">
            {addCategorie === "squelette"
              ? "Un .zip du dossier type. Le mot NOMDUDOSSIER y sera remplacé par le nom du chantier, dossiers et fichiers compris."
              : DESTINATION_LISIBLE[addCategorie]}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleAddFile(f);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : !ressources?.length ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">
          La librairie est vide.
          {peutGerer
            ? " Ajoute les nuanciers, les gabarits et le script BAT ci-dessus."
            : " Un administrateur doit encore y déposer les fichiers."}
        </p>
      ) : (
        <div className="space-y-4">
          {CATEGORIES.map((cat) => {
            const items = ressources.filter((r) => r.categorie === cat);
            if (!items.length) return null;
            return (
              <div key={cat}>
                <div className="flex items-baseline gap-2 mb-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {LIBELLE_CATEGORIE[cat]}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                    → {DESTINATION_LISIBLE[cat]}
                  </p>
                </div>
                <div className="space-y-1.5">{items.map(ligne)}</div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
    </>
  );
}
