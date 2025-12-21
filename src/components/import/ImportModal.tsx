import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { useImportStore } from "@/stores/importStore";
import { useStatuts } from "@/hooks/useStatuts";
import { Upload, FileSpreadsheet, X, Check, AlertCircle, Loader2, ExternalLink } from "lucide-react";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface SheetInfo {
  name: string;
  rowCount: number;
  type: "graphiste" | "archive" | "franchises" | "projets" | "stats" | "unknown";
}

interface ImportResult {
  dossiers: { added: number; updated: number; unchanged: number; errors: number };
  franchises: { success: number; errors: number };
  projets: { success: number; errors: number };
}

// Mapping des noms de feuilles vers les graphistes (ancien format)
const GRAPHISTE_SHEETS = ["JORDAN", "CAROLE", "JULIETTE", "QUENTIN"];

// Feuilles du nouveau format normalisé
const NORMALIZED_SHEETS = ["DOSSIERS_ACTIFS", "ARCHIVES", "FRANCHISES", "PROJETS"];

// Mapping des statuts Excel vers les statuts de l'app (fallback si pas de statuts dynamiques)
const DEFAULT_STATUS_MAPPING: Record<string, string> = {
  "! urgent !": "! Urgent !",
  "urgent": "! Urgent !",
  "a faire": "A faire",
  "à faire": "A faire",
  "en cours": "En cours",
  "attente r.": "Attente R.",
  "attente r": "Attente R.",
  "attente retour": "Attente R.",
  "stand-by": "Stand-by",
  "standby": "Stand-by",
  "stand by": "Stand-by",
  "à relancer": "À relancer",
  "a relancer": "À relancer",
  "relancer": "À relancer",
  "mairie": "Mairie",
};

// Crée un mapping dynamique à partir des statuts de la BDD
function createDynamicStatusMapping(statuts: { value: string; label: string }[] | undefined): Record<string, string> {
  const mapping: Record<string, string> = { ...DEFAULT_STATUS_MAPPING };

  if (statuts) {
    for (const statut of statuts) {
      // Ajouter le label en lowercase comme clé pointant vers la value
      mapping[statut.label.toLowerCase().trim()] = statut.value;
      // Ajouter aussi la value en lowercase
      mapping[statut.value.toLowerCase().trim()] = statut.value;
    }
  }

  return mapping;
}

function normalizeStatus(status: string | null | undefined, statusMapping: Record<string, string>, defaultStatut: string): string {
  if (!status) return defaultStatut;
  const normalized = String(status).toLowerCase().trim();
  return statusMapping[normalized] || status;
}

function parseExcelDate(value: unknown): string | null {
  if (!value) return null;

  // Si c'est un numéro Excel (jours depuis 1900)
  if (typeof value === "number") {
    try {
      const date = XLSX.SSF.parse_date_code(value);
      if (date) {
        // Ajouter l'année courante si pas spécifiée
        const year = date.y < 100 ? 2000 + date.y : date.y;
        return `${year}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
      }
    } catch {
      return null;
    }
  }

  // Si c'est une chaîne
  const str = String(value).trim();
  if (!str || str === "-") return null;

  // Format DD/MM ou DD/MM/YY ou DD/MM/YYYY
  const frMatch = str.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (frMatch) {
    const day = frMatch[1].padStart(2, "0");
    const month = frMatch[2].padStart(2, "0");
    let year = frMatch[3] ? frMatch[3] : new Date().getFullYear().toString();
    if (year.length === 2) {
      year = "20" + year;
    }
    return `${year}-${month}-${day}`;
  }

  // Format YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return str;
  }

  return null;
}

function detectSheetType(sheetName: string, isNormalizedFormat: boolean): SheetInfo["type"] {
  const upper = sheetName.toUpperCase();

  if (isNormalizedFormat) {
    // Nouveau format normalisé
    if (upper === "DOSSIERS_ACTIFS") return "graphiste"; // Dossiers actifs
    if (upper === "ARCHIVES") return "archive";
    if (upper === "FRANCHISES") return "franchises";
    if (upper === "PROJETS") return "projets";
    return "unknown";
  }

  // Ancien format
  if (GRAPHISTE_SHEETS.includes(upper)) return "graphiste";
  if (upper.includes("ARCHIVE")) return "archive";
  if (upper.includes("FRANCHISE")) return "franchises";
  if (upper.includes("PROJET") || upper.includes("INTERNE")) return "projets";
  if (upper.includes("STATS") || upper.includes("2025") || upper.includes("2024")) return "stats";
  return "unknown";
}

export function ImportModal({ isOpen, onClose, onSuccess }: ImportModalProps) {
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState<string>("");
  const [isNormalizedFormat, setIsNormalizedFormat] = useState(false);
  const profile = useAuthStore((state) => state.profile);

  // Récupérer les statuts dynamiques
  const { data: statuts } = useStatuts();

  // Store pour l'import en arrière-plan
  const importStore = useImportStore();

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setResult(null);
    setProgress("");

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const wb = XLSX.read(data, { type: "binary" });

        // Détecter si c'est le nouveau format normalisé
        const hasNormalizedSheets = wb.SheetNames.some(name =>
          name.toUpperCase() === "DOSSIERS_ACTIFS" || name.toUpperCase() === "ARCHIVES"
        );
        setIsNormalizedFormat(hasNormalizedSheets);

        const sheetInfos: SheetInfo[] = wb.SheetNames.map((name) => {
          const sheet = wb.Sheets[name];
          const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
          const rowCount = range.e.r - range.s.r;
          return {
            name,
            rowCount,
            type: detectSheetType(name, hasNormalizedSheets),
          };
        });

        setWorkbook(wb);
        setFileName(file.name);
        setSheets(sheetInfos);

        // Pré-sélectionner les feuilles graphistes, archives, franchises et projets
        const defaultSelected = new Set<string>();
        sheetInfos.forEach((s) => {
          if (s.type === "graphiste" || s.type === "archive" || s.type === "franchises" || s.type === "projets") {
            defaultSelected.add(s.name);
          }
        });
        setSelectedSheets(defaultSelected);
      } catch {
        setError("Erreur lors de la lecture du fichier. Vérifiez qu'il s'agit d'un fichier Excel valide.");
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  const toggleSheet = (sheetName: string) => {
    setSelectedSheets((prev) => {
      const next = new Set(prev);
      if (next.has(sheetName)) {
        next.delete(sheetName);
      } else {
        next.add(sheetName);
      }
      return next;
    });
  };

  // Fonction pour lancer l'import en arrière-plan
  const runBackgroundImport = async (
    wb: XLSX.WorkBook,
    sheetsToImport: Set<string>,
    sheetInfos: SheetInfo[],
    isNormalized: boolean,
    profileId: string
  ) => {
    const results: ImportResult = {
      dossiers: { added: 0, updated: 0, unchanged: 0, errors: 0 },
      franchises: { success: 0, errors: 0 },
      projets: { success: 0, errors: 0 },
    };

    try {
      // Récupérer les statuts dynamiques depuis la BDD
      const { data: statutsData } = await supabase
        .from("statuts")
        .select("value, label")
        .order("priority", { ascending: true });

      const statusMapping = createDynamicStatusMapping(statutsData || undefined);
      const defaultStatut = statutsData?.[0]?.value || "A faire";

      // Récupérer la liste des graphistes
      const { data: graphistes } = await supabase
        .from("profiles")
        .select("id, initials, full_name")
        .eq("is_active", true);

      const graphisteMap = new Map<string, string>();
      graphistes?.forEach((g) => {
        graphisteMap.set(g.initials.toUpperCase(), g.id);
        graphisteMap.set(g.full_name.toUpperCase(), g.id);
        const prenom = g.full_name.split(" ")[0].toUpperCase();
        graphisteMap.set(prenom, g.id);
        const prenomSansAccent = prenom.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        graphisteMap.set(prenomSansAccent, g.id);
      });

      const explicitMappings: Record<string, string[]> = {
        "JORDAN": ["J", "JORDAN"],
        "CAROLE": ["C", "CAROLE"],
        "JULIETTE": ["JU", "JULIETTE"],
        "QUENTIN": ["Q", "QUENTIN"],
      };

      for (const [sheetName, possibleKeys] of Object.entries(explicitMappings)) {
        for (const key of possibleKeys) {
          const existingId = graphisteMap.get(key);
          if (existingId) {
            graphisteMap.set(sheetName, existingId);
            break;
          }
        }
      }

      // Importer chaque feuille
      for (const sheetName of sheetsToImport) {
        const sheetInfo = sheetInfos.find((s) => s.name === sheetName);
        if (!sheetInfo) continue;

        importStore.setCurrentSheet(sheetName, sheetInfo.rowCount);

        const sheet = wb.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          defval: null,
          raw: false,
          header: 1
        });

        // NOUVEAU FORMAT NORMALISÉ
        if (isNormalized && (sheetInfo.type === "graphiste" || sheetInfo.type === "archive")) {
          const isArchiveSheet = sheetInfo.type === "archive";

          const { data: allExisting } = await supabase
            .from("dossiers")
            .select("id, nom, graphiste_id, graphiste_initials, statut, deadline_premiere_reponse, commentaires, is_archived, date_creation, date_archivage");

          const existingDossiers = allExisting || [];
          const existingByKey = new Map<string, typeof existingDossiers[0]>();
          existingDossiers.forEach(d => {
            const key = `${d.nom.toLowerCase().trim()}|${d.graphiste_id}`;
            existingByKey.set(key, d);
          });

          for (let rowIndex = 1; rowIndex < rawData.length; rowIndex++) {
            try {
              const row = rawData[rowIndex] as unknown[];
              if (!row || row.length < 2) continue;

              const graphisteNom = row[0];
              const nomRaw = row[1];
              const dateRaw = row[2];
              const statutRaw = row[3];
              const commentairesRaw = row[4];

              if (!nomRaw || String(nomRaw).trim() === "") continue;
              const nomNormalized = String(nomRaw).trim();
              if (nomNormalized.length < 3) continue;

              let graphisteId: string | null = null;
              let graphisteInitials: string | null = null;
              if (graphisteNom) {
                const nomGraphiste = String(graphisteNom).toUpperCase().trim();
                graphisteId = graphisteMap.get(nomGraphiste) || null;

                if (nomGraphiste === "JULIETTE") graphisteInitials = "JU";
                else if (nomGraphiste === "JB") graphisteInitials = "JB";
                else if (nomGraphiste === "MARION") graphisteInitials = "MA";
                else if (nomGraphiste === "MARIE") graphisteInitials = "MR";
                else if (nomGraphiste === "LUCIE") graphisteInitials = "LU";
                else if (nomGraphiste === "MICKAEL") graphisteInitials = "MI";
                else graphisteInitials = nomGraphiste.charAt(0);
              }

              const parsedDate = parseExcelDate(dateRaw);
              const dateCreation = parsedDate || new Date().toISOString().split("T")[0];
              const dateArchivage = isArchiveSheet ? dateCreation : null;
              const statut = normalizeStatus(statutRaw as string, statusMapping, defaultStatut);
              const commentairesText = commentairesRaw ? String(commentairesRaw).trim() : null;
              const hasCommentaires = !!commentairesText && commentairesText !== "";

              const keyComposite = `${nomNormalized.toLowerCase()}|${graphisteId}`;
              const existingDossier = existingByKey.get(keyComposite);

              if (existingDossier) {
                const hasChanges =
                  existingDossier.statut !== statut ||
                  existingDossier.commentaires !== commentairesText ||
                  existingDossier.is_archived !== isArchiveSheet;

                if (hasChanges) {
                  const { error: updateError } = await supabase
                    .from("dossiers")
                    .update({
                      statut,
                      has_commentaires: hasCommentaires,
                      commentaires: commentairesText,
                      is_archived: isArchiveSheet,
                      date_archivage: dateArchivage,
                      updated_by: profileId,
                    })
                    .eq("id", existingDossier.id);

                  if (updateError) {
                    results.dossiers.errors++;
                    importStore.addResult("dossiers", "error");
                  } else {
                    results.dossiers.updated++;
                    importStore.addResult("dossiers", "updated");
                  }
                } else {
                  results.dossiers.unchanged++;
                  importStore.addResult("dossiers", "unchanged");
                }
              } else {
                const { error: insertError } = await supabase.from("dossiers").insert({
                  nom: nomNormalized,
                  graphiste_id: graphisteId,
                  graphiste_initials: graphisteInitials,
                  date_creation: dateCreation,
                  statut,
                  has_commentaires: hasCommentaires,
                  commentaires: commentairesText,
                  is_archived: isArchiveSheet,
                  date_archivage: dateArchivage,
                  created_by: profileId,
                });

                if (insertError) {
                  results.dossiers.errors++;
                  importStore.addResult("dossiers", "error");
                } else {
                  results.dossiers.added++;
                  importStore.addResult("dossiers", "added");
                }
              }

              importStore.incrementRow();
            } catch {
              results.dossiers.errors++;
              importStore.addResult("dossiers", "error");
              importStore.incrementRow();
            }
          }
          continue;
        }

        // ANCIEN FORMAT - Dossiers graphistes
        if (sheetInfo.type === "graphiste" || sheetInfo.type === "archive") {
          const graphisteId = sheetInfo.type === "graphiste"
            ? graphisteMap.get(sheetName.toUpperCase())
            : null;
          const isArchiveSheet = sheetInfo.type === "archive";

          const { data: allExisting } = await supabase
            .from("dossiers")
            .select("id, nom, graphiste_id, graphiste_initials, statut, deadline_premiere_reponse, commentaires, is_archived, date_creation, date_archivage");

          const existingDossiers = allExisting || [];
          const existingByKey = new Map<string, typeof existingDossiers[0]>();
          const existingByNom = new Map<string, typeof existingDossiers[0]>();
          existingDossiers.forEach(d => {
            const key = `${d.nom.toLowerCase().trim()}|${d.graphiste_id}`;
            existingByKey.set(key, d);
            existingByNom.set(d.nom.toLowerCase().trim(), d);
          });

          let startRow = 2;
          for (let i = 0; i < Math.min(5, rawData.length); i++) {
            const row = rawData[i] as unknown[];
            if (row && row[1] && String(row[1]).toUpperCase().includes("DOSSIER")) {
              startRow = i + 1;
              break;
            }
          }

          for (let rowIndex = startRow; rowIndex < rawData.length; rowIndex++) {
            try {
              const row = rawData[rowIndex] as unknown[];
              if (!row || row.length < 2) continue;

              const initialesRaw = row[0];
              const nomRaw = row[1];
              const dateRaw = row[2];
              const ddlRaw = row[3];
              const comRaw = row[4];
              const statutRaw = row[6];
              const commentairesRaw = row[7];
              const termineRaw = row[8];

              if (!nomRaw || String(nomRaw).trim() === "") continue;
              const nomNormalized = String(nomRaw).trim();
              const nomUpper = nomNormalized.toUpperCase();

              if (nomUpper.includes("DOSSIER") || nomUpper.includes("ARCHIVE")) continue;
              if (["VRAI", "FAUX", "TRUE", "FALSE"].includes(nomUpper)) continue;
              if (nomNormalized.length < 3) continue;

              const parsedDate = parseExcelDate(dateRaw);
              const deadline = parseExcelDate(ddlRaw);

              let dateCreation: string;
              let dateArchivage: string | null;

              if (isArchiveSheet) {
                dateArchivage = parsedDate || new Date().toISOString().split("T")[0];
                dateCreation = dateArchivage;
              } else {
                dateCreation = parsedDate || new Date().toISOString().split("T")[0];
                dateArchivage = null;
              }

              const statut = normalizeStatus(statutRaw as string, statusMapping, defaultStatut);
              const commentairesText = commentairesRaw ? String(commentairesRaw).trim() : null;
              const hasCommentaires = !!commentairesText && commentairesText !== "-" && commentairesText !== "";
              const hasComFromIndicator = comRaw && String(comRaw).trim() !== "-" && String(comRaw).trim() !== "";

              const isTermine = termineRaw === true ||
                String(termineRaw).toUpperCase() === "VRAI" ||
                String(termineRaw).toUpperCase() === "TRUE";

              let finalGraphisteId = graphisteId;
              let graphisteInitials: string | null = null;

              if (isArchiveSheet) {
                if (initialesRaw) {
                  graphisteInitials = String(initialesRaw).toUpperCase().trim();
                  finalGraphisteId = graphisteMap.get(graphisteInitials) || null;
                }
              } else {
                const sheetUpper = sheetName.toUpperCase();
                if (sheetUpper === "JULIETTE") graphisteInitials = "JU";
                else if (sheetUpper === "JB") graphisteInitials = "JB";
                else if (sheetUpper === "MARION") graphisteInitials = "AR";
                else if (sheetUpper === "MARIE") graphisteInitials = "MA";
                else if (sheetUpper === "LUCIE") graphisteInitials = "LU";
                else graphisteInitials = sheetUpper.charAt(0);
              }

              const isArchived = isArchiveSheet || isTermine;
              if (isTermine && !isArchiveSheet) {
                dateArchivage = dateCreation;
              }

              const keyComposite = `${nomNormalized.toLowerCase()}|${finalGraphisteId}`;
              let existingDossier = existingByKey.get(keyComposite);
              if (!existingDossier) {
                existingDossier = existingByNom.get(nomNormalized.toLowerCase());
              }

              if (existingDossier) {
                const hasChanges =
                  existingDossier.statut !== statut ||
                  existingDossier.deadline_premiere_reponse !== deadline ||
                  existingDossier.commentaires !== commentairesText ||
                  existingDossier.is_archived !== isArchived ||
                  (isArchived && existingDossier.date_archivage !== dateArchivage);

                if (hasChanges) {
                  const updateData: Record<string, unknown> = {
                    statut,
                    deadline_premiere_reponse: deadline,
                    has_commentaires: hasCommentaires || hasComFromIndicator,
                    commentaires: commentairesText,
                    is_archived: isArchived,
                    updated_by: profileId,
                  };

                  if (graphisteInitials && !existingDossier.graphiste_initials) {
                    updateData.graphiste_initials = graphisteInitials;
                  }
                  if (isArchived && dateArchivage) {
                    updateData.date_archivage = dateArchivage;
                  }

                  const { error: updateError } = await supabase
                    .from("dossiers")
                    .update(updateData)
                    .eq("id", existingDossier.id);

                  if (updateError) {
                    results.dossiers.errors++;
                    importStore.addResult("dossiers", "error");
                  } else {
                    results.dossiers.updated++;
                    importStore.addResult("dossiers", "updated");
                  }
                } else {
                  results.dossiers.unchanged++;
                  importStore.addResult("dossiers", "unchanged");
                }
              } else {
                const { error: insertError } = await supabase.from("dossiers").insert({
                  nom: nomNormalized,
                  graphiste_id: finalGraphisteId,
                  graphiste_initials: graphisteInitials,
                  date_creation: dateCreation,
                  deadline_premiere_reponse: deadline,
                  statut,
                  has_commentaires: hasCommentaires || hasComFromIndicator,
                  commentaires: commentairesText,
                  is_archived: isArchived,
                  date_archivage: dateArchivage,
                  created_by: profileId,
                });

                if (insertError) {
                  results.dossiers.errors++;
                  importStore.addResult("dossiers", "error");
                } else {
                  results.dossiers.added++;
                  importStore.addResult("dossiers", "added");
                }
              }

              importStore.incrementRow();
            } catch {
              results.dossiers.errors++;
              importStore.addResult("dossiers", "error");
              importStore.incrementRow();
            }
          }
        } else if (sheetInfo.type === "franchises") {
          const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
            defval: null,
            raw: false
          });

          for (const row of jsonData) {
            try {
              const keys = Object.keys(row);
              if (keys.length === 0) continue;

              const firstKey = keys[0];
              const franchiseNom = row[firstKey];

              if (!franchiseNom || String(franchiseNom).trim() === "") continue;
              const nomStr = String(franchiseNom).trim();
              const nomUpper = nomStr.toUpperCase();
              if (nomUpper.includes("FRANCHISE") || nomUpper === "NOM" || nomUpper === "NAME") continue;

              const { data: franchise, error: franchiseError } = await supabase
                .from("franchises")
                .upsert({ nom: nomStr }, { onConflict: "nom" })
                .select()
                .single();

              if (franchiseError || !franchise) {
                results.franchises.errors++;
                importStore.addResult("franchises", "error");
                continue;
              }

              for (let i = 1; i < keys.length; i++) {
                const key = keys[i];
                const value = row[key];
                const strValue = String(value || "").toUpperCase().trim();
                const keyUpper = key.toUpperCase().replace(/^__EMPTY_?\d*$/, "");

                const isCoche = value === true ||
                  strValue === "VRAI" ||
                  strValue === "TRUE" ||
                  strValue === "X" ||
                  strValue === "OUI" ||
                  strValue === "1";

                let assignGraphisteId: string | undefined;
                if (keyUpper && keyUpper !== "__EMPTY" && !keyUpper.match(/^__EMPTY_?\d*$/)) {
                  assignGraphisteId = graphisteMap.get(keyUpper);
                }
                if (!assignGraphisteId && strValue && !isCoche) {
                  assignGraphisteId = graphisteMap.get(strValue);
                }

                if (assignGraphisteId && (isCoche || graphisteMap.has(strValue))) {
                  await supabase.from("franchise_assignments").upsert({
                    franchise_id: franchise.id,
                    graphiste_id: assignGraphisteId,
                  }, { onConflict: "franchise_id,graphiste_id" });
                } else if (isCoche) {
                  const possibleGraphiste = graphisteMap.get(key.toUpperCase());
                  if (possibleGraphiste) {
                    await supabase.from("franchise_assignments").upsert({
                      franchise_id: franchise.id,
                      graphiste_id: possibleGraphiste,
                    }, { onConflict: "franchise_id,graphiste_id" });
                  }
                }
              }

              results.franchises.success++;
              importStore.addResult("franchises", "success");
              importStore.incrementRow();
            } catch {
              results.franchises.errors++;
              importStore.addResult("franchises", "error");
              importStore.incrementRow();
            }
          }
        } else if (sheetInfo.type === "projets") {
          const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
            defval: null,
            raw: false
          });

          let colCommercial = 0;
          let colTache = 1;
          let colDemande = 2;
          let colGraphiste = 3;
          let colTermine = 4;

          for (const row of jsonData) {
            try {
              const keys = Object.keys(row);
              if (keys.length === 0) continue;

              const getValue = (colIndex: number) => {
                if (colIndex < 0 || colIndex >= keys.length) return null;
                return row[keys[colIndex]];
              };

              const tache = getValue(colTache);
              if (!tache || String(tache).trim() === "") continue;
              const tacheStr = String(tache).trim();
              const tacheUpper = tacheStr.toUpperCase();
              if (tacheUpper.includes("TACHE") || tacheUpper.includes("TÂCHE") || tacheUpper === "DESCRIPTION") continue;

              const commercial = getValue(colCommercial);
              const demande = getValue(colDemande);
              const graphisteNom = getValue(colGraphiste);
              const termine = getValue(colTermine);

              let projetGraphisteId: string | null = null;
              if (graphisteNom) {
                const nomNormalized = String(graphisteNom).toUpperCase().trim();
                projetGraphisteId = graphisteMap.get(nomNormalized) || null;
              }

              const isTermine = termine === true ||
                String(termine || "").toUpperCase() === "VRAI" ||
                String(termine || "").toUpperCase() === "TRUE" ||
                String(termine || "").toUpperCase() === "OUI" ||
                String(termine || "").toUpperCase() === "X" ||
                String(termine || "").toUpperCase() === "1";

              const { error: projetError } = await supabase.from("projets_internes").insert({
                commercial: commercial ? String(commercial).trim() : null,
                tache: tacheStr,
                demande: demande ? String(demande).trim() : null,
                graphiste_id: projetGraphisteId,
                is_termine: isTermine,
              });

              if (projetError) {
                results.projets.errors++;
                importStore.addResult("projets", "error");
              } else {
                results.projets.success++;
                importStore.addResult("projets", "success");
              }
              importStore.incrementRow();
            } catch {
              results.projets.errors++;
              importStore.addResult("projets", "error");
              importStore.incrementRow();
            }
          }
        }
      }

      // Import terminé
      importStore.completeImport();
      onSuccess();
    } catch (err) {
      console.error("Erreur import:", err);
      importStore.setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  const handleImport = async () => {
    if (!workbook || !profile || selectedSheets.size === 0) return;

    // Calculer le nombre total de lignes
    let totalRows = 0;
    for (const sheetName of selectedSheets) {
      const sheetInfo = sheets.find((s) => s.name === sheetName);
      if (sheetInfo) {
        totalRows += sheetInfo.rowCount;
      }
    }

    // Démarrer l'import en arrière-plan
    importStore.startImport(fileName, totalRows);

    // Fermer la modal immédiatement
    setSheets([]);
    setSelectedSheets(new Set());
    setWorkbook(null);
    setFileName("");
    setError(null);
    setResult(null);
    setProgress("");
    setIsNormalizedFormat(false);
    onClose();

    // Lancer l'import en arrière-plan (ne bloque pas)
    runBackgroundImport(
      workbook,
      selectedSheets,
      sheets,
      isNormalizedFormat,
      profile.id
    );
  };

  const handleClose = () => {
    setSheets([]);
    setSelectedSheets(new Set());
    setWorkbook(null);
    setFileName("");
    setError(null);
    setResult(null);
    setProgress("");
    setIsNormalizedFormat(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-6 w-6 text-[#2470B8]" />
            <h2 className="text-xl font-semibold">Importer des données</h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Contenu */}
        {sheets.length === 0 && !result && (
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600">
                Sélectionnez le fichier SUIVI_GRAPHISTES.xlsx
              </p>
              <input
                id="import-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="mt-4 cursor-pointer text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-[#2470B8] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#1c5a94]"
              />
            </div>

            <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
              <p className="font-medium">Feuilles reconnues automatiquement :</p>
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li><strong>JORDAN, CAROLE, JULIETTE, QUENTIN</strong> : Dossiers par graphiste</li>
                <li><strong>ARCHIVE</strong> : Dossiers terminés</li>
                <li><strong>FRANCHISES</strong> : Attribution des franchises</li>
                <li><strong>PROJETS_INTERNE</strong> : Projets internes</li>
              </ul>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-600">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {sheets.length > 0 && !result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  Fichier : <strong>{fileName}</strong>
                </p>
                {isNormalizedFormat && (
                  <p className="text-xs text-green-600 mt-1">
                    Format normalisé détecté - Import simplifié
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSheets([]);
                  setWorkbook(null);
                  setIsNormalizedFormat(false);
                }}
              >
                Changer de fichier
              </Button>
            </div>

            <div className="rounded-lg border p-4">
              <p className="mb-3 font-medium text-gray-700">Sélectionnez les feuilles à importer :</p>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                {sheets.map((sheet) => (
                  <label
                    key={sheet.name}
                    className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${
                      selectedSheets.has(sheet.name)
                        ? "border-[#2470B8] bg-blue-50"
                        : "border-gray-200 hover:bg-gray-50"
                    } ${sheet.type === "stats" || sheet.type === "unknown" ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedSheets.has(sheet.name)}
                        onChange={() => toggleSheet(sheet.name)}
                        disabled={sheet.type === "stats" || sheet.type === "unknown"}
                        className="h-4 w-4 rounded border-gray-300 text-[#2470B8] focus:ring-[#2470B8]"
                      />
                      <div>
                        <span className="font-medium">{sheet.name}</span>
                        <span className="ml-2 text-sm text-gray-500">
                          ({sheet.rowCount} lignes)
                        </span>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      sheet.type === "graphiste" ? "bg-green-100 text-green-700" :
                      sheet.type === "archive" ? "bg-orange-100 text-orange-700" :
                      sheet.type === "franchises" ? "bg-purple-100 text-purple-700" :
                      sheet.type === "projets" ? "bg-blue-100 text-blue-700" :
                      "bg-gray-100 text-gray-500"
                    }`}>
                      {sheet.type === "graphiste" ? "Dossiers" :
                       sheet.type === "archive" ? "Archives" :
                       sheet.type === "franchises" ? "Franchises" :
                       sheet.type === "projets" ? "Projets" :
                       "Ignoré"}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {progress && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                {progress}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || selectedSheets.size === 0}
                className="bg-[#2470B8] hover:bg-[#1c5a94]"
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Import en cours...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Importer ({selectedSheets.size} feuilles)
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-medium">Import terminé</p>
              <div className="mt-3 space-y-2 text-left">
                {(result.dossiers.added > 0 || result.dossiers.updated > 0 || result.dossiers.unchanged > 0 || result.dossiers.errors > 0) && (
                  <div className="rounded-lg bg-gray-50 px-4 py-3 space-y-1">
                    <div className="flex justify-between font-medium">
                      <span>Dossiers</span>
                      <span className="text-gray-500">{result.dossiers.added + result.dossiers.updated + result.dossiers.unchanged} traités</span>
                    </div>
                    <div className="text-sm space-y-0.5">
                      {result.dossiers.added > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Nouveaux</span>
                          <span className="text-green-600 font-medium">+{result.dossiers.added}</span>
                        </div>
                      )}
                      {result.dossiers.updated > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Mis à jour</span>
                          <span className="text-blue-600 font-medium">{result.dossiers.updated}</span>
                        </div>
                      )}
                      {result.dossiers.unchanged > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Inchangés</span>
                          <span className="text-gray-400">{result.dossiers.unchanged}</span>
                        </div>
                      )}
                      {result.dossiers.errors > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Erreurs</span>
                          <span className="text-red-600 font-medium">{result.dossiers.errors}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {(result.franchises.success > 0 || result.franchises.errors > 0) && (
                  <div className="flex justify-between rounded-lg bg-gray-50 px-4 py-2">
                    <span>Franchises</span>
                    <span>
                      <span className="text-green-600 font-medium">{result.franchises.success}</span>
                      {result.franchises.errors > 0 && (
                        <span className="text-red-600 ml-2">({result.franchises.errors} erreurs)</span>
                      )}
                    </span>
                  </div>
                )}
                {(result.projets.success > 0 || result.projets.errors > 0) && (
                  <div className="flex justify-between rounded-lg bg-gray-50 px-4 py-2">
                    <span>Projets internes</span>
                    <span>
                      <span className="text-green-600 font-medium">{result.projets.success}</span>
                      {result.projets.errors > 0 && (
                        <span className="text-red-600 ml-2">({result.projets.errors} erreurs)</span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <Button onClick={handleClose} className="bg-[#2470B8] hover:bg-[#1c5a94]">
              Fermer
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
