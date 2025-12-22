import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { useEffectiveRole } from "@/hooks/useEffectiveRole";
import type { Process, ProcessInsert, ProcessUpdate } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  Filter,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  FileText,
  FileUp,
  Eye,
  Trash,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Star,
} from "lucide-react";
import {
  useProcessFavorites,
  useToggleProcessFavorite,
} from "@/hooks/useProcessFavorites";

// Configuration de pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Fonction pour normaliser le texte (enlever les accents)
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Fonction pour extraire le texte d'un PDF
async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    fullText += pageText + "\n";
  }

  return fullText;
}

// Hook pour récupérer les process
function useProcess(includeDeleted = false) {
  const { isAdmin } = useEffectiveRole();

  return useQuery({
    queryKey: ["process", includeDeleted],
    queryFn: async () => {
      let query = supabase
        .from("process")
        .select("*")
        .order("categorie", { ascending: true, nullsFirst: false })
        .order("ordre", { ascending: true })
        .order("titre", { ascending: true });

      // Si on ne veut pas les supprimés, filtrer
      if (!includeDeleted) {
        query = query.is("deleted_at", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Process[];
    },
    enabled: includeDeleted ? isAdmin : true,
  });
}

// Hook pour créer un process
function useCreateProcess() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);

  return useMutation({
    mutationFn: async (process: Omit<ProcessInsert, "created_by">) => {
      const { data, error } = await supabase
        .from("process")
        .insert({ ...process, created_by: profile?.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process"] });
      toast.success("Process créé");
    },
    onError: (error) => {
      console.error("Erreur création process:", error);
      toast.error("Erreur lors de la création");
    },
  });
}

// Hook pour modifier un process
function useUpdateProcess() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);

  return useMutation({
    mutationFn: async ({ id, ...updates }: ProcessUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("process")
        .update({ ...updates, updated_by: profile?.id })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process"] });
      toast.success("Process modifié");
    },
    onError: (error) => {
      console.error("Erreur modification process:", error);
      toast.error("Erreur lors de la modification");
    },
  });
}

// Hook pour soft delete
function useSoftDeleteProcess() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("process")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: profile?.id,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process"] });
      toast.success("Process mis à la corbeille");
    },
    onError: (error) => {
      console.error("Erreur suppression process:", error);
      toast.error("Erreur lors de la suppression");
    },
  });
}

// Hook pour restaurer
function useRestoreProcess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("process")
        .update({ deleted_at: null, deleted_by: null })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process"] });
      toast.success("Process restauré");
    },
    onError: (error) => {
      console.error("Erreur restauration process:", error);
      toast.error("Erreur lors de la restauration");
    },
  });
}

// Hook pour hard delete (admin only)
function useHardDeleteProcess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (process: Process) => {
      // Supprimer le fichier du storage si c'est un PDF
      if (process.type === "pdf" && process.fichier_url) {
        const path = process.fichier_url.split("/process/")[1];
        if (path) {
          await supabase.storage.from("process").remove([path]);
        }
      }

      const { error } = await supabase.from("process").delete().eq("id", process.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process"] });
      toast.success("Process supprimé définitivement");
    },
    onError: (error) => {
      console.error("Erreur suppression définitive:", error);
      toast.error("Erreur lors de la suppression définitive");
    },
  });
}

// Composant Modal pour ajouter/éditer un process
function ProcessModal({
  process,
  onClose,
  onSave,
  isLoading,
  existingCategories,
}: {
  process?: Process;
  onClose: () => void;
  onSave: (data: ProcessInsert | (ProcessUpdate & { id: string }), file?: File) => void;
  isLoading: boolean;
  existingCategories: string[];
}) {
  const [formData, setFormData] = useState({
    titre: process?.titre || "",
    description: process?.description || "",
    type: process?.type || ("texte" as const),
    contenu: process?.contenu || "",
    categorie: process?.categorie || "",
  });
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractingText, setExtractingText] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Seuls les fichiers PDF sont acceptés");
      return;
    }

    setSelectedFile(file);
    setFormData((prev) => ({ ...prev, type: "pdf" }));

    // Extraire le texte du PDF
    setExtractingText(true);
    try {
      const text = await extractTextFromPdf(file);
      setFormData((prev) => ({ ...prev, contenu: text }));
      toast.success("Texte extrait du PDF pour la recherche");
    } catch (err) {
      console.error("Erreur extraction texte:", err);
      toast.error("Impossible d'extraire le texte du PDF");
    } finally {
      setExtractingText(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titre.trim()) {
      toast.error("Le titre est obligatoire");
      return;
    }

    if (formData.type === "pdf" && !selectedFile && !process?.fichier_url) {
      toast.error("Veuillez sélectionner un fichier PDF");
      return;
    }

    const finalCategorie = showNewCategory ? newCategory.trim() : formData.categorie;
    const dataToSave = { ...formData, categorie: finalCategorie || null };

    if (process?.id) {
      onSave({ id: process.id, ...dataToSave }, selectedFile || undefined);
    } else {
      onSave(dataToSave, selectedFile || undefined);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold">
            {process ? "Modifier le process" : "Créer un process"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Type de process */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type de process
            </label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: "texte" })}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors",
                  formData.type === "texte"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <FileText className="h-5 w-5" />
                <span>Rédigé</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: "pdf" })}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors",
                  formData.type === "pdf"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <FileUp className="h-5 w-5" />
                <span>Fichier PDF</span>
              </button>
            </div>
          </div>

          {/* Titre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Titre *
            </label>
            <input
              type="text"
              value={formData.titre}
              onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ex: Guide d'installation Illustrator"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Courte description du process"
            />
          </div>

          {/* Catégorie */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Catégorie
            </label>
            {!showNewCategory ? (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    value={formData.categorie}
                    onChange={(e) => setFormData({ ...formData, categorie: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                  >
                    <option value="">Sans catégorie</option>
                    {existingCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewCategory(true)}
                  className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors whitespace-nowrap"
                >
                  + Nouvelle
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Nom de la nouvelle catégorie"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowNewCategory(false);
                    setNewCategory("");
                  }}
                  className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Annuler
                </button>
              </div>
            )}
          </div>

          {/* Contenu selon le type */}
          {formData.type === "texte" ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contenu
              </label>
              <textarea
                value={formData.contenu}
                onChange={(e) => setFormData({ ...formData, contenu: e.target.value })}
                rows={12}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono text-sm"
                placeholder="Rédigez le contenu du process ici..."
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fichier PDF
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              {selectedFile || process?.fichier_nom ? (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <FileUp className="h-8 w-8 text-red-500" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {selectedFile?.name || process?.fichier_nom}
                    </p>
                    {extractingText && (
                      <p className="text-sm text-blue-600">Extraction du texte en cours...</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  >
                    Changer
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  <FileUp className="h-10 w-10 text-gray-400" />
                  <span className="text-gray-600">Cliquez pour sélectionner un PDF</span>
                </button>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading || extractingText}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? "Enregistrement..." : process ? "Modifier" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Interface pour les résultats de recherche avec position dans la page
interface SearchMatch {
  pageIndex: number;
  matchIndexInPage: number;
  globalIndex: number;
}

// Interface pour les positions de highlight sur une page
interface HighlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
  matchIndex: number;
}

// Composant viewer PDF avec recherche Ctrl+F
function PdfViewer({
  url,
  onClose,
  title,
  initialSearch = "",
}: {
  url: string;
  onClose: () => void;
  title: string;
  initialSearch?: string;
}) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [pdfDocument, setPdfDocument] = useState<any>(null);

  // États pour la recherche
  const [searchOpen, setSearchOpen] = useState(!!initialSearch);
  const [searchText, setSearchText] = useState(initialSearch);
  const [searchResults, setSearchResults] = useState<SearchMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [initialSearchDone, setInitialSearchDone] = useState(false);
  const [pageLoaded, setPageLoaded] = useState(false);
  const [highlightRects, setHighlightRects] = useState<HighlightRect[]>([]);
  const [pageViewport, setPageViewport] = useState<{ width: number; height: number } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const activeHighlightRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  // Reset page loaded quand on change de page
  useEffect(() => {
    setPageLoaded(false);
    setHighlightRects([]);
  }, [pageNumber]);

  // Charger le document PDF pour la recherche
  useEffect(() => {
    const loadPdf = async () => {
      try {
        const pdf = await pdfjs.getDocument(url).promise;
        setPdfDocument(pdf);
      } catch (err) {
        console.error("Erreur chargement PDF:", err);
      }
    };
    loadPdf();
  }, [url]);

  // Lancer la recherche initiale quand le PDF est chargé
  useEffect(() => {
    if (pdfDocument && initialSearch && !initialSearchDone) {
      setInitialSearchDone(true);
      searchInPdf(initialSearch);
    }
  }, [pdfDocument, initialSearch, initialSearchDone]);

  // Raccourci Ctrl+F
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setSearchText("");
        setSearchResults([]);
        setHighlightRects([]);
      }
      if (e.key === "Enter" && searchOpen && searchResults.length > 0) {
        if (e.shiftKey) {
          goToPreviousMatch();
        } else {
          goToNextMatch();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen, searchResults, currentMatchIndex]);

  // Fonction de recherche dans le PDF
  const searchInPdf = useCallback(async (text: string) => {
    if (!pdfDocument || !text.trim()) {
      setSearchResults([]);
      setHighlightRects([]);
      return;
    }

    setIsSearching(true);
    const matches: SearchMatch[] = [];
    const searchLower = text.toLowerCase();
    let globalIndex = 0;

    try {
      for (let i = 1; i <= pdfDocument.numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ")
          .toLowerCase();

        let startIndex = 0;
        let matchIndexInPage = 0;
        while ((startIndex = pageText.indexOf(searchLower, startIndex)) !== -1) {
          matches.push({ pageIndex: i, matchIndexInPage, globalIndex });
          startIndex += searchLower.length;
          matchIndexInPage++;
          globalIndex++;
        }
      }

      setSearchResults(matches);
      setCurrentMatchIndex(0);

      if (matches.length > 0) {
        setPageNumber(matches[0].pageIndex);
      }
    } catch (err) {
      console.error("Erreur recherche:", err);
    } finally {
      setIsSearching(false);
    }
  }, [pdfDocument]);

  // Debounce la recherche
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchText) {
        searchInPdf(searchText);
      } else {
        setSearchResults([]);
        setHighlightRects([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText, searchInPdf]);

  // Obtenir l'index du match actuel sur la page courante
  const getCurrentMatchIndexOnPage = useCallback(() => {
    if (searchResults.length === 0) return -1;
    const currentMatch = searchResults[currentMatchIndex];
    if (currentMatch.pageIndex !== pageNumber) return -1;
    return currentMatch.matchIndexInPage;
  }, [searchResults, currentMatchIndex, pageNumber]);

  // Calculer les rectangles de highlight pour la page courante
  const calculateHighlightRects = useCallback(async () => {
    if (!pdfDocument || !searchText || searchResults.length === 0) {
      setHighlightRects([]);
      return;
    }

    const matchesOnPage = searchResults.filter(m => m.pageIndex === pageNumber);
    if (matchesOnPage.length === 0) {
      setHighlightRects([]);
      return;
    }

    try {
      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      setPageViewport({ width: viewport.width, height: viewport.height });

      const textContent = await page.getTextContent();
      const items = textContent.items as any[];

      const rects: HighlightRect[] = [];
      const searchLower = searchText.toLowerCase();

      // Construire le texte avec positions
      let currentPos = 0;
      const itemPositions: { start: number; end: number; item: any }[] = [];

      items.forEach((item) => {
        const str = item.str || "";
        itemPositions.push({
          start: currentPos,
          end: currentPos + str.length,
          item
        });
        currentPos += str.length + 1; // +1 pour l'espace entre items
      });

      // Trouver les positions des matches
      const fullText = items.map(item => item.str).join(" ").toLowerCase();
      let matchIndex = 0;
      let pos = 0;

      while ((pos = fullText.indexOf(searchLower, pos)) !== -1) {
        // Trouver quel item contient ce match
        for (const ip of itemPositions) {
          if (pos >= ip.start && pos < ip.end) {
            const item = ip.item;
            if (item.transform) {
              // Calculer la position dans le viewport
              const tx = item.transform[4];
              const ty = item.transform[5];
              const fontSize = Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]);

              // Convertir les coordonnées PDF en coordonnées viewport
              const x = tx * scale;
              const y = viewport.height - (ty * scale) - (fontSize * scale);
              const width = (item.width || fontSize * searchText.length * 0.6) * scale;
              const height = fontSize * scale * 1.2;

              rects.push({
                left: x,
                top: y,
                width: Math.max(width, 20),
                height: Math.max(height, 14),
                matchIndex
              });
            }
            break;
          }
        }
        pos += searchLower.length;
        matchIndex++;
      }

      setHighlightRects(rects);
    } catch (err) {
      console.error("Erreur calcul highlights:", err);
    }
  }, [pdfDocument, searchText, searchResults, pageNumber, scale]);

  // Recalculer les highlights quand la page change ou le scale
  useEffect(() => {
    if (pageLoaded && searchText && searchResults.length > 0) {
      calculateHighlightRects();
    }
  }, [pageLoaded, searchText, searchResults, pageNumber, scale, calculateHighlightRects]);

  // Scroll vers le match actif
  useEffect(() => {
    if (activeHighlightRef.current && containerRef.current) {
      const container = containerRef.current;
      const highlight = activeHighlightRef.current;

      requestAnimationFrame(() => {
        const highlightRect = highlight.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        const scrollTop = container.scrollTop + (highlightRect.top - containerRect.top) - (containerRect.height / 2) + (highlightRect.height / 2);

        container.scrollTo({
          top: Math.max(0, scrollTop),
          behavior: "smooth"
        });
      });
    }
  }, [highlightRects, currentMatchIndex]);

  // Naviguer vers le résultat suivant
  const goToNextMatch = useCallback(() => {
    if (searchResults.length === 0) return;
    const nextIndex = (currentMatchIndex + 1) % searchResults.length;
    setCurrentMatchIndex(nextIndex);
    const match = searchResults[nextIndex];
    if (match.pageIndex !== pageNumber) {
      setPageNumber(match.pageIndex);
    }
  }, [searchResults, currentMatchIndex, pageNumber]);

  // Naviguer vers le résultat précédent
  const goToPreviousMatch = useCallback(() => {
    if (searchResults.length === 0) return;
    const prevIndex = currentMatchIndex === 0 ? searchResults.length - 1 : currentMatchIndex - 1;
    setCurrentMatchIndex(prevIndex);
    const match = searchResults[prevIndex];
    if (match.pageIndex !== pageNumber) {
      setPageNumber(match.pageIndex);
    }
  }, [searchResults, currentMatchIndex, pageNumber]);

  // Callback quand une page a fini de charger
  const onPageRenderSuccess = useCallback(() => {
    setPageLoaded(true);
  }, []);

  // Obtenir l'index du match actif sur la page courante
  const activeMatchOnPage = getCurrentMatchIndexOnPage();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-800 text-white">
        <h2 className="font-semibold truncate flex-1">{title}</h2>
        <div className="flex items-center gap-4">
          {/* Bouton recherche */}
          <button
            onClick={() => {
              setSearchOpen(!searchOpen);
              if (!searchOpen) {
                setTimeout(() => searchInputRef.current?.focus(), 100);
              }
            }}
            className={cn(
              "p-2 rounded-lg transition-colors",
              searchOpen ? "bg-blue-600" : "hover:bg-gray-700"
            )}
            title="Rechercher (Ctrl+F)"
          >
            <Search className="h-5 w-5" />
          </button>

          {/* Zoom controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              title="Zoom arrière"
            >
              <ZoomOut className="h-5 w-5" />
            </button>
            <span className="text-sm min-w-[60px] text-center">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale((s) => Math.min(2, s + 0.25))}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              title="Zoom avant"
            >
              <ZoomIn className="h-5 w-5" />
            </button>
          </div>

          {/* Page navigation */}
          {numPages && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                disabled={pageNumber <= 1}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-sm min-w-[80px] text-center">
                {pageNumber} / {numPages}
              </span>
              <button
                onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                disabled={pageNumber >= numPages}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}

          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Barre de recherche */}
      {searchOpen && (
        <div className="flex items-center gap-3 px-4 py-2 bg-gray-700 text-white">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Rechercher dans le document..."
              className="w-full pl-10 pr-4 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Résultats et navigation */}
          {searchText && (
            <div className="flex items-center gap-2">
              {isSearching ? (
                <span className="text-sm text-gray-300">Recherche...</span>
              ) : searchResults.length > 0 ? (
                <>
                  <span className="text-sm text-gray-300">
                    {currentMatchIndex + 1} / {searchResults.length}
                  </span>
                  <button
                    onClick={goToPreviousMatch}
                    className="p-1.5 hover:bg-gray-600 rounded transition-colors"
                    title="Précédent (Shift+Enter)"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={goToNextMatch}
                    className="p-1.5 hover:bg-gray-600 rounded transition-colors"
                    title="Suivant (Enter)"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <span className="text-sm text-red-400">Aucun résultat</span>
              )}
            </div>
          )}

          <button
            onClick={() => {
              setSearchOpen(false);
              setSearchText("");
              setSearchResults([]);
              setHighlightRects([]);
            }}
            className="p-1.5 hover:bg-gray-600 rounded transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* PDF Content */}
      <div ref={containerRef} className="flex-1 overflow-auto flex justify-center p-4">
        <div ref={pageRef} className="relative">
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full" />
              </div>
            }
            error={
              <div className="text-white text-center">
                <p>Impossible de charger le PDF</p>
              </div>
            }
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              onRenderSuccess={onPageRenderSuccess}
            />
          </Document>

          {/* Overlay des highlights */}
          {highlightRects.length > 0 && (
            <div
              className="absolute top-0 left-0 pointer-events-none"
              style={{
                width: pageViewport?.width || "100%",
                height: pageViewport?.height || "100%"
              }}
            >
              {highlightRects.map((rect, idx) => {
                const isActive = rect.matchIndex === activeMatchOnPage;
                return (
                  <div
                    key={idx}
                    ref={isActive ? activeHighlightRef : null}
                    className={cn(
                      "absolute rounded-sm",
                      isActive
                        ? "bg-orange-500/60 ring-2 ring-orange-500 ring-offset-1"
                        : "bg-yellow-400/50"
                    )}
                    style={{
                      left: rect.left,
                      top: rect.top,
                      width: rect.width,
                      height: rect.height,
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Composant viewer texte avec recherche
function TextViewer({
  process,
  onClose,
  initialSearch = "",
}: {
  process: Process;
  onClose: () => void;
  initialSearch?: string;
}) {
  const [searchOpen, setSearchOpen] = useState(!!initialSearch);
  const [searchText, setSearchText] = useState(initialSearch);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Calculer le contenu avec surlignage
  const highlightedContent = useMemo(() => {
    if (!process.contenu || !searchText || searchText.length < 2) {
      return process.contenu || "";
    }

    const content = process.contenu;
    const searchLower = searchText.toLowerCase();
    const contentLower = content.toLowerCase();

    // Trouver toutes les occurrences
    const matches: number[] = [];
    let pos = 0;
    while ((pos = contentLower.indexOf(searchLower, pos)) !== -1) {
      matches.push(pos);
      pos += searchLower.length;
    }

    setMatchCount(matches.length);

    if (matches.length === 0) return content;

    // Construire le contenu avec les highlights
    const parts: { text: string; isMatch: boolean; matchIndex: number }[] = [];
    let lastEnd = 0;

    matches.forEach((matchPos, index) => {
      if (matchPos > lastEnd) {
        parts.push({ text: content.substring(lastEnd, matchPos), isMatch: false, matchIndex: -1 });
      }
      parts.push({
        text: content.substring(matchPos, matchPos + searchText.length),
        isMatch: true,
        matchIndex: index
      });
      lastEnd = matchPos + searchText.length;
    });

    if (lastEnd < content.length) {
      parts.push({ text: content.substring(lastEnd), isMatch: false, matchIndex: -1 });
    }

    return parts;
  }, [process.contenu, searchText]);

  // Scroll vers le match actuel
  useEffect(() => {
    if (contentRef.current && matchCount > 0) {
      const activeMatch = contentRef.current.querySelector(".text-search-highlight-active");
      if (activeMatch) {
        activeMatch.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentMatchIndex, matchCount, highlightedContent]);

  // Scroll au premier match au chargement
  useEffect(() => {
    if (initialSearch && matchCount > 0 && contentRef.current) {
      setTimeout(() => {
        const firstMatch = contentRef.current?.querySelector(".text-search-highlight-active");
        if (firstMatch) {
          firstMatch.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    }
  }, [initialSearch, matchCount]);

  // Raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setSearchText("");
      }
      if (e.key === "Enter" && searchOpen && matchCount > 0) {
        if (e.shiftKey) {
          setCurrentMatchIndex((prev) => (prev === 0 ? matchCount - 1 : prev - 1));
        } else {
          setCurrentMatchIndex((prev) => (prev + 1) % matchCount);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen, matchCount]);

  // Rendu du contenu
  const renderContent = () => {
    if (typeof highlightedContent === "string") {
      return highlightedContent;
    }

    return highlightedContent.map((part, i) => {
      if (!part.isMatch) {
        return part.text;
      }
      const isActive = part.matchIndex === currentMatchIndex;
      return (
        <mark
          key={i}
          className={cn(
            "px-0.5 rounded",
            isActive
              ? "text-search-highlight-active bg-orange-400 text-white font-semibold"
              : "text-search-highlight bg-yellow-200"
          )}
        >
          {part.text}
        </mark>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="font-semibold">{process.titre}</h2>
          {process.description && (
            <p className="text-sm text-gray-500">{process.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSearchOpen(!searchOpen);
              if (!searchOpen) {
                setTimeout(() => searchInputRef.current?.focus(), 100);
              }
            }}
            className={cn(
              "p-2 rounded-lg transition-colors",
              searchOpen ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100"
            )}
            title="Rechercher (Ctrl+F)"
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Barre de recherche */}
      {searchOpen && (
        <div className="flex items-center gap-3 px-4 py-2 bg-gray-100 border-b">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setCurrentMatchIndex(0);
              }}
              placeholder="Rechercher dans le document..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {searchText && searchText.length >= 2 && (
            <div className="flex items-center gap-2">
              {matchCount > 0 ? (
                <>
                  <span className="text-sm text-gray-600">
                    {currentMatchIndex + 1} / {matchCount}
                  </span>
                  <button
                    onClick={() => setCurrentMatchIndex((prev) => (prev === 0 ? matchCount - 1 : prev - 1))}
                    className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                    title="Précédent (Shift+Enter)"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setCurrentMatchIndex((prev) => (prev + 1) % matchCount)}
                    className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                    title="Suivant (Enter)"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <span className="text-sm text-red-500">Aucun résultat</span>
              )}
            </div>
          )}

          <button
            onClick={() => {
              setSearchOpen(false);
              setSearchText("");
            }}
            className="p-1.5 hover:bg-gray-200 rounded transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-auto p-6 max-w-4xl mx-auto w-full">
        <div className="prose prose-lg max-w-none whitespace-pre-wrap">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

// Composant carte process
function ProcessCard({
  process,
  onEdit,
  onDelete,
  onView,
  onRestore,
  onHardDelete,
  onToggleFavorite,
  isAdmin,
  isDeleted,
  isFavorite,
}: {
  process: Process;
  onEdit: () => void;
  onDelete: () => void;
  onView: () => void;
  onRestore?: () => void;
  onHardDelete?: () => void;
  onToggleFavorite?: () => void;
  isAdmin: boolean;
  isDeleted?: boolean;
  isFavorite?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl border shadow-sm hover:shadow-md transition-all cursor-pointer",
        isDeleted && "opacity-60",
        isFavorite && "ring-2 ring-amber-300 border-amber-300"
      )}
      onClick={onView}
    >
      <div className="flex items-center gap-3 p-4">
        {/* Icône type */}
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0",
            process.type === "pdf" ? "bg-red-100" : "bg-blue-100"
          )}
        >
          {process.type === "pdf" ? (
            <FileUp className="h-5 w-5 text-red-600" />
          ) : (
            <FileText className="h-5 w-5 text-blue-600" />
          )}
        </div>

        {/* Infos */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{process.titre}</h3>
          {process.description && (
            <p className="text-sm text-gray-500 truncate">{process.description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {isDeleted ? (
            <>
              {onRestore && (
                <button
                  onClick={onRestore}
                  className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  title="Restaurer"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
              {onHardDelete && (
                <button
                  onClick={onHardDelete}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Supprimer définitivement"
                >
                  <Trash className="h-4 w-4" />
                </button>
              )}
            </>
          ) : (
            <>
              {/* Bouton favori */}
              {onToggleFavorite && (
                <button
                  onClick={onToggleFavorite}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    isFavorite
                      ? "text-amber-500 hover:text-amber-600 hover:bg-amber-50"
                      : "text-gray-400 hover:text-amber-500 hover:bg-amber-50"
                  )}
                  title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                >
                  <Star className={cn("h-4 w-4", isFavorite && "fill-current")} />
                </button>
              )}
              <button
                onClick={onView}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Voir"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={onEdit}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Modifier"
              >
                <Pencil className="h-4 w-4" />
              </button>
              {isAdmin && (
                <button
                  onClick={onDelete}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Interface pour une occurrence individuelle
interface SearchOccurrence {
  excerpt: string;
  position: number; // Position dans le texte pour pouvoir naviguer
}

// Interface pour les résultats de recherche globale
interface GlobalSearchResult {
  process: Process;
  occurrences: SearchOccurrence[];
  matchCount: number;
}

// Fonction pour extraire toutes les occurrences avec leurs extraits
function getAllOccurrences(text: string, searchTerm: string, contextLength = 50, maxOccurrences = 5): SearchOccurrence[] {
  const lowerText = text.toLowerCase();
  const lowerSearch = searchTerm.toLowerCase();
  const occurrences: SearchOccurrence[] = [];
  let pos = 0;

  while ((pos = lowerText.indexOf(lowerSearch, pos)) !== -1 && occurrences.length < maxOccurrences) {
    const start = Math.max(0, pos - contextLength);
    const end = Math.min(text.length, pos + searchTerm.length + contextLength);

    let excerpt = text.substring(start, end);
    if (start > 0) excerpt = "..." + excerpt;
    if (end < text.length) excerpt = excerpt + "...";

    occurrences.push({ excerpt, position: pos });
    pos += lowerSearch.length;
  }

  return occurrences;
}

// Fonction pour compter les occurrences
function countOccurrences(text: string, searchTerm: string): number {
  const lowerText = text.toLowerCase();
  const lowerSearch = searchTerm.toLowerCase();
  let count = 0;
  let pos = 0;
  while ((pos = lowerText.indexOf(lowerSearch, pos)) !== -1) {
    count++;
    pos += lowerSearch.length;
  }
  return count;
}

export default function ProcessPage() {
  const { isAdmin } = useEffectiveRole();

  const [showDeleted, setShowDeleted] = useState(false);
  const { data: processList, isLoading } = useProcess(showDeleted);

  // Favoris
  const { favorites, isFavorite, toggle: toggleFavorite } = useToggleProcessFavorite();

  const createProcess = useCreateProcess();
  const updateProcess = useUpdateProcess();
  const softDeleteProcess = useSoftDeleteProcess();
  const restoreProcess = useRestoreProcess();
  const hardDeleteProcess = useHardDeleteProcess();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<Process | undefined>();
  const [viewingProcess, setViewingProcess] = useState<Process | null>(null);
  const [initialSearchTerm, setInitialSearchTerm] = useState<string>("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [deleteConfirm, setDeleteConfirm] = useState<Process | null>(null);
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState<Process | null>(null);

  // Extraire les catégories uniques
  const existingCategories = processList
    ? [...new Set(processList.filter((p) => !p.deleted_at).map((p) => p.categorie).filter((c): c is string => !!c))].sort()
    : [];

  // Séparer les actifs et supprimés
  const activeProcess = processList?.filter((p) => !p.deleted_at) || [];
  const deletedProcess = processList?.filter((p) => p.deleted_at) || [];

  // Process favoris (filtrés parmi les actifs)
  const favoriteProcessList = useMemo(() => {
    if (!favorites || favorites.length === 0) return [];
    const favoriteIds = new Set(favorites.map((f) => f.process_id));
    return activeProcess.filter((p) => favoriteIds.has(p.id));
  }, [favorites, activeProcess]);

  // Recherche globale dans le contenu
  const globalSearchResults = useMemo((): GlobalSearchResult[] => {
    if (!search || search.length < 2) return [];

    const searchNormalized = normalizeText(search);
    const results: GlobalSearchResult[] = [];

    activeProcess.forEach((p) => {
      const titleNorm = normalizeText(p.titre);
      const descNorm = p.description ? normalizeText(p.description) : "";
      const contenuNorm = p.contenu ? normalizeText(p.contenu) : "";

      const inTitle = titleNorm.includes(searchNormalized);
      const inDesc = descNorm.includes(searchNormalized);
      const inContenu = contenuNorm.includes(searchNormalized);

      if (inTitle || inDesc || inContenu) {
        // Compter les occurrences totales
        let matchCount = 0;
        if (inTitle) matchCount += countOccurrences(titleNorm, searchNormalized);
        if (inDesc) matchCount += countOccurrences(descNorm, searchNormalized);
        if (inContenu) matchCount += countOccurrences(contenuNorm, searchNormalized);

        // Extraire toutes les occurrences (max 5) du contenu
        let occurrences: SearchOccurrence[] = [];
        if (inContenu && p.contenu) {
          occurrences = getAllOccurrences(p.contenu, search, 50, 5);
        } else if (inDesc && p.description) {
          occurrences = getAllOccurrences(p.description, search, 50, 3);
        } else if (inTitle) {
          occurrences = [{ excerpt: p.titre, position: 0 }];
        }

        results.push({ process: p, occurrences, matchCount });
      }
    });

    // Trier par nombre de matches décroissant
    return results.sort((a, b) => b.matchCount - a.matchCount);
  }, [search, activeProcess]);

  // Grouper par catégorie (quand pas de recherche)
  const groupedProcess = activeProcess.reduce(
    (acc, process) => {
      const cat = process.categorie || "Sans catégorie";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(process);
      return acc;
    },
    {} as Record<string, Process[]>
  );

  // Filtrer par catégorie uniquement (quand pas de recherche)
  const filteredGroups = Object.entries(groupedProcess).reduce(
    (acc, [cat, catProcess]) => {
      if (categoryFilter && cat !== categoryFilter) {
        return acc;
      }
      acc[cat] = catProcess;
      return acc;
    },
    {} as Record<string, Process[]>
  );

  // Upload file to storage
  const uploadFile = useCallback(async (file: File): Promise<string> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("process")
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("process").getPublicUrl(fileName);
    return data.publicUrl;
  }, []);

  const handleSave = async (
    data: ProcessInsert | (ProcessUpdate & { id: string }),
    file?: File
  ) => {
    try {
      let fichier_url = "id" in data ? undefined : undefined;
      let fichier_nom = file?.name;

      if (file) {
        fichier_url = await uploadFile(file);
      }

      const processData = {
        ...data,
        ...(fichier_url && { fichier_url }),
        ...(fichier_nom && { fichier_nom }),
      };

      if ("id" in data && data.id) {
        updateProcess.mutate(processData as ProcessUpdate & { id: string }, {
          onSuccess: () => {
            setModalOpen(false);
            setEditingProcess(undefined);
          },
        });
      } else {
        createProcess.mutate(processData as ProcessInsert, {
          onSuccess: () => {
            setModalOpen(false);
          },
        });
      }
    } catch (error) {
      console.error("Erreur upload:", error);
      toast.error("Erreur lors de l'upload du fichier");
    }
  };

  const handleSoftDelete = (process: Process) => {
    softDeleteProcess.mutate(process.id, {
      onSuccess: () => setDeleteConfirm(null),
    });
  };

  const handleHardDelete = (process: Process) => {
    hardDeleteProcess.mutate(process, {
      onSuccess: () => setHardDeleteConfirm(null),
    });
  };

  // Get signed URL for PDF viewing
  const getPdfUrl = useCallback(async (process: Process): Promise<string | null> => {
    if (!process.fichier_url) return null;

    // Extract path from URL
    const path = process.fichier_url.split("/process/")[1];
    if (!path) return process.fichier_url;

    const { data, error } = await supabase.storage
      .from("process")
      .createSignedUrl(path, 3600); // 1 hour

    if (error) {
      console.error("Erreur signed URL:", error);
      return process.fichier_url;
    }

    return data.signedUrl;
  }, []);

  const handleView = async (process: Process, searchTerm?: string) => {
    // Stocker le terme de recherche pour l'ouvrir directement avec la recherche
    if (searchTerm) {
      setInitialSearchTerm(searchTerm);
    } else {
      setInitialSearchTerm("");
    }

    if (process.type === "pdf" && process.fichier_url) {
      const url = await getPdfUrl(process);
      if (url) {
        setViewingProcess({ ...process, fichier_url: url });
      }
    } else {
      setViewingProcess(process);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
            <BookOpen className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Process</h1>
            <p className="text-sm text-gray-500">
              Procédures et guides internes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => setShowDeleted(!showDeleted)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
                showDeleted
                  ? "bg-red-100 text-red-700"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <Trash className="h-4 w-4" />
              Corbeille ({deletedProcess.length})
            </button>
          )}

          <button
            onClick={() => {
              setEditingProcess(undefined);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nouveau process
          </button>
        </div>
      </div>

      {/* Recherche et filtre */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un process..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {existingCategories.length > 0 && (
          <div className="relative min-w-[180px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={cn(
                "w-full pl-10 pr-8 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white",
                categoryFilter ? "border-blue-500 text-blue-700" : "border-gray-300"
              )}
            >
              <option value="">Toutes les catégories</option>
              {existingCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
              <option value="Sans catégorie">Sans catégorie</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        )}

        {(search || categoryFilter) && (
          <button
            onClick={() => {
              setSearch("");
              setCategoryFilter("");
            }}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Corbeille (admin) */}
      {showDeleted && isAdmin && deletedProcess.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-red-800 uppercase tracking-wider mb-3">
            Corbeille
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-start">
            {deletedProcess.map((process) => (
              <ProcessCard
                key={process.id}
                process={process}
                isAdmin={isAdmin}
                isDeleted
                onEdit={() => {}}
                onDelete={() => {}}
                onView={() => handleView(process)}
                onRestore={() => restoreProcess.mutate(process.id)}
                onHardDelete={() => setHardDeleteConfirm(process)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Section Favoris (affichée uniquement quand pas de recherche active) */}
      {(!search || search.length < 2) && favoriteProcessList.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Star className="h-4 w-4 text-amber-600 fill-amber-600" />
            <h2 className="text-sm font-semibold text-amber-800 uppercase tracking-wider">
              Mes Favoris
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-start">
            {favoriteProcessList.map((process) => (
              <ProcessCard
                key={process.id}
                process={process}
                isAdmin={isAdmin}
                isFavorite={true}
                onEdit={() => {
                  setEditingProcess(process);
                  setModalOpen(true);
                }}
                onDelete={() => setDeleteConfirm(process)}
                onView={() => handleView(process)}
                onToggleFavorite={() => toggleFavorite(process.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Résultats de recherche globale */}
      {search && search.length >= 2 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Résultats de recherche ({globalSearchResults.reduce((sum, r) => sum + r.matchCount, 0)} occurrence{globalSearchResults.reduce((sum, r) => sum + r.matchCount, 0) > 1 ? "s" : ""} dans {globalSearchResults.length} document{globalSearchResults.length > 1 ? "s" : ""})
          </h2>

          {globalSearchResults.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-xl border">
              <Search className="h-10 w-10 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">Aucun résultat pour "{search}"</p>
            </div>
          ) : (
            <div className="space-y-3">
              {globalSearchResults.map((result) => (
                <div
                  key={result.process.id}
                  className="bg-white rounded-xl border shadow-sm overflow-hidden"
                >
                  {/* En-tête du document */}
                  <div
                    onClick={() => handleView(result.process, search)}
                    className="flex items-center gap-3 p-4 hover:bg-gray-50 cursor-pointer transition-colors border-b"
                  >
                    {/* Icône type */}
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0",
                        result.process.type === "pdf" ? "bg-red-100" : "bg-blue-100"
                      )}
                    >
                      {result.process.type === "pdf" ? (
                        <FileUp className="h-5 w-5 text-red-600" />
                      ) : (
                        <FileText className="h-5 w-5 text-blue-600" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{result.process.titre}</h3>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          {result.matchCount} occurrence{result.matchCount > 1 ? "s" : ""}
                        </span>
                      </div>
                      {result.process.categorie && (
                        <span className="text-xs text-gray-400">
                          {result.process.categorie}
                        </span>
                      )}
                    </div>

                    <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  </div>

                  {/* Liste des occurrences */}
                  <div className="divide-y divide-gray-100">
                    {result.occurrences.map((occurrence, i) => (
                      <div
                        key={i}
                        onClick={() => handleView(result.process, search)}
                        className="px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors flex items-start gap-3"
                      >
                        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-gray-100 rounded-full text-xs text-gray-500 font-medium">
                          {i + 1}
                        </span>
                        <p className="text-sm text-gray-600 flex-1">
                          {occurrence.excerpt.split(new RegExp(`(${search})`, "gi")).map((part, j) =>
                            part.toLowerCase() === search.toLowerCase() ? (
                              <mark key={j} className="bg-yellow-200 px-0.5 rounded font-medium">
                                {part}
                              </mark>
                            ) : (
                              part
                            )
                          )}
                        </p>
                      </div>
                    ))}
                    {result.matchCount > result.occurrences.length && (
                      <div
                        onClick={() => handleView(result.process, search)}
                        className="px-4 py-2 text-center text-sm text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors"
                      >
                        + {result.matchCount - result.occurrences.length} autre{result.matchCount - result.occurrences.length > 1 ? "s" : ""} occurrence{result.matchCount - result.occurrences.length > 1 ? "s" : ""}...
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Liste des process (quand pas de recherche) */}
      {(!search || search.length < 2) && (
        <>
          {Object.keys(filteredGroups).length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border">
              <BookOpen className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">
                {categoryFilter ? "Aucun process dans cette catégorie" : "Aucun process créé"}
              </p>
              {!categoryFilter && (
                <button
                  onClick={() => setModalOpen(true)}
                  className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                >
                  Créer le premier process
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(filteredGroups)
                .sort(([a], [b]) => {
                  if (a === "Sans catégorie") return 1;
                  if (b === "Sans catégorie") return -1;
                  return a.localeCompare(b);
                })
                .map(([category, categoryProcess]) => (
                  <div key={category}>
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      {category}
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-start">
                      {categoryProcess.map((process) => (
                        <ProcessCard
                          key={process.id}
                          process={process}
                          isAdmin={isAdmin}
                          isFavorite={isFavorite(process.id)}
                          onEdit={() => {
                            setEditingProcess(process);
                            setModalOpen(true);
                          }}
                          onDelete={() => setDeleteConfirm(process)}
                          onView={() => handleView(process)}
                          onToggleFavorite={() => toggleFavorite(process.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </>
      )}

      {/* Modal ajout/édition */}
      {modalOpen && (
        <ProcessModal
          process={editingProcess}
          onClose={() => {
            setModalOpen(false);
            setEditingProcess(undefined);
          }}
          onSave={handleSave}
          isLoading={createProcess.isPending || updateProcess.isPending}
          existingCategories={existingCategories}
        />
      )}

      {/* Viewer PDF */}
      {viewingProcess?.type === "pdf" && viewingProcess.fichier_url && (
        <PdfViewer
          url={viewingProcess.fichier_url}
          title={viewingProcess.titre}
          onClose={() => {
            setViewingProcess(null);
            setInitialSearchTerm("");
          }}
          initialSearch={initialSearchTerm}
        />
      )}

      {/* Viewer Texte */}
      {viewingProcess?.type === "texte" && (
        <TextViewer
          process={viewingProcess}
          onClose={() => {
            setViewingProcess(null);
            setInitialSearchTerm("");
          }}
          initialSearch={initialSearchTerm}
        />
      )}

      {/* Modal confirmation soft delete */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Supprimer ce process ?
            </h3>
            <p className="text-gray-600 mb-6">
              Il sera placé dans la corbeille et pourra être restauré par un administrateur.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleSoftDelete(deleteConfirm)}
                disabled={softDeleteProcess.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {softDeleteProcess.isPending ? "Suppression..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmation hard delete */}
      {hardDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-red-600 mb-2">
              Supprimer définitivement ?
            </h3>
            <p className="text-gray-600 mb-6">
              Cette action est irréversible. Le process et son fichier seront supprimés définitivement.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setHardDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleHardDelete(hardDeleteConfirm)}
                disabled={hardDeleteProcess.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {hardDeleteProcess.isPending ? "Suppression..." : "Supprimer définitivement"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
