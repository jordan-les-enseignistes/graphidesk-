import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  X,
  FileText,
  Building2,
  Briefcase,
  Phone,
  BookOpen,
  Globe,
  MessageSquare,
  Archive,
  Loader2,
  ChevronDown,
  ExternalLink,
} from "lucide-react";

// Types pour les résultats de recherche
interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  category: SearchCategory;
  route: string;
}

type SearchCategory =
  | "dossiers"
  | "archives"
  | "franchises"
  | "projets"
  | "contacts"
  | "process"
  | "sites"
  | "reunions";

const CATEGORY_CONFIG: Record<
  SearchCategory,
  { label: string; icon: React.ReactNode; color: string; bgColor: string }
> = {
  dossiers: {
    label: "Dossiers actifs",
    icon: <FileText className="h-4 w-4" />,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  archives: {
    label: "Archives",
    icon: <Archive className="h-4 w-4" />,
    color: "text-gray-600",
    bgColor: "bg-gray-100",
  },
  franchises: {
    label: "Franchises",
    icon: <Building2 className="h-4 w-4" />,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  projets: {
    label: "Projets internes",
    icon: <Briefcase className="h-4 w-4" />,
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  contacts: {
    label: "Annuaire",
    icon: <Phone className="h-4 w-4" />,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
  process: {
    label: "Process",
    icon: <BookOpen className="h-4 w-4" />,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
  },
  sites: {
    label: "Sites internet",
    icon: <Globe className="h-4 w-4" />,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
  },
  reunions: {
    label: "Sujets réunion",
    icon: <MessageSquare className="h-4 w-4" />,
    color: "text-pink-600",
    bgColor: "bg-pink-50",
  },
};

const ALL_CATEGORIES: SearchCategory[] = [
  "dossiers",
  "archives",
  "franchises",
  "projets",
  "contacts",
  "process",
  "sites",
  "reunions",
];

// Normalise le texte pour la recherche (retire accents, lowercase)
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Vérifie si le texte contient la recherche (insensible à la casse et aux accents)
function matchesSearch(text: string | null | undefined, search: string): boolean {
  if (!text) return false;
  return normalizeText(text).includes(normalizeText(search));
}

export default function Recherche() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [searchInput, setSearchInput] = useState(initialQuery);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategories, setSelectedCategories] = useState<Set<SearchCategory>>(
    new Set(ALL_CATEGORIES)
  );

  // Debounce de la recherche
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      if (searchInput) {
        setSearchParams({ q: searchInput });
      } else {
        setSearchParams({});
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, setSearchParams]);

  // Focus sur l'input au chargement
  useEffect(() => {
    const input = document.getElementById("search-input");
    if (input) input.focus();
  }, []);

  // Récupérer TOUTES les données pour la recherche
  const { data: dossiers, isLoading: loadingDossiers } = useQuery({
    queryKey: ["search-all-dossiers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("dossiers")
        .select("id, nom, statut, is_archived")
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
    staleTime: 60000,
  });

  const { data: franchises, isLoading: loadingFranchises } = useQuery({
    queryKey: ["search-all-franchises"],
    queryFn: async () => {
      const { data } = await supabase.from("franchises").select("id, nom");
      return data ?? [];
    },
    staleTime: 60000,
  });

  const { data: projets, isLoading: loadingProjets } = useQuery({
    queryKey: ["search-all-projets"],
    queryFn: async () => {
      const { data } = await supabase
        .from("projets_internes")
        .select("id, tache, commercial, is_termine");
      return data ?? [];
    },
    staleTime: 60000,
  });

  const { data: contacts, isLoading: loadingContacts } = useQuery({
    queryKey: ["search-all-contacts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, nom, prenom, fonction, entreprise, email, telephone");
      return data ?? [];
    },
    staleTime: 60000,
  });

  const { data: process, isLoading: loadingProcess } = useQuery({
    queryKey: ["search-all-process"],
    queryFn: async () => {
      const { data } = await supabase
        .from("process")
        .select("id, titre, description, categorie, contenu")
        .is("deleted_at", null);
      return data ?? [];
    },
    staleTime: 60000,
  });

  const { data: sites, isLoading: loadingSites } = useQuery({
    queryKey: ["search-all-sites"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sites_internet")
        .select("id, nom, url, categorie");
      return data ?? [];
    },
    staleTime: 60000,
  });

  const { data: reunions, isLoading: loadingReunions } = useQuery({
    queryKey: ["search-all-reunions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("reunions_sujets")
        .select("id, titre, description, is_archived");
      return data ?? [];
    },
    staleTime: 60000,
  });

  const isLoading = loadingDossiers || loadingFranchises || loadingProjets ||
                    loadingContacts || loadingProcess || loadingSites || loadingReunions;

  // Filtrer les résultats
  const results = useMemo(() => {
    if (searchQuery.length < 2) return [];

    const allResults: SearchResult[] = [];

    // Dossiers actifs
    if (selectedCategories.has("dossiers")) {
      dossiers
        ?.filter((d) => !d.is_archived && matchesSearch(d.nom, searchQuery))
        .forEach((d) => {
          allResults.push({
            id: `dossier-${d.id}`,
            title: d.nom,
            subtitle: d.statut,
            category: "dossiers",
            route: ROUTES.TOUS_LES_DOSSIERS + `?search=${encodeURIComponent(d.nom)}`,
          });
        });
    }

    // Archives
    if (selectedCategories.has("archives")) {
      dossiers
        ?.filter((d) => d.is_archived && matchesSearch(d.nom, searchQuery))
        .forEach((d) => {
          allResults.push({
            id: `archive-${d.id}`,
            title: d.nom,
            subtitle: "Archivé",
            category: "archives",
            route: ROUTES.ARCHIVES + `?search=${encodeURIComponent(d.nom)}`,
          });
        });
    }

    // Franchises
    if (selectedCategories.has("franchises")) {
      franchises
        ?.filter((f) => matchesSearch(f.nom, searchQuery))
        .forEach((f) => {
          allResults.push({
            id: `franchise-${f.id}`,
            title: f.nom,
            category: "franchises",
            route: ROUTES.FRANCHISES + `?search=${encodeURIComponent(f.nom)}`,
          });
        });
    }

    // Projets internes
    if (selectedCategories.has("projets")) {
      projets
        ?.filter(
          (p) => matchesSearch(p.tache, searchQuery) || matchesSearch(p.commercial, searchQuery)
        )
        .forEach((p) => {
          allResults.push({
            id: `projet-${p.id}`,
            title: p.tache,
            subtitle: [p.commercial, p.is_termine ? "Terminé" : "En cours"].filter(Boolean).join(" - "),
            category: "projets",
            route: ROUTES.PROJETS_INTERNES,
          });
        });
    }

    // Contacts
    if (selectedCategories.has("contacts")) {
      contacts
        ?.filter(
          (c) =>
            matchesSearch(c.nom, searchQuery) ||
            matchesSearch(c.prenom, searchQuery) ||
            matchesSearch(c.entreprise, searchQuery) ||
            matchesSearch(c.fonction, searchQuery) ||
            matchesSearch(c.email, searchQuery) ||
            matchesSearch(c.telephone, searchQuery)
        )
        .forEach((c) => {
          const fullName = [c.prenom, c.nom].filter(Boolean).join(" ");
          allResults.push({
            id: `contact-${c.id}`,
            title: fullName || c.nom,
            subtitle: [c.fonction, c.entreprise].filter(Boolean).join(" - ") || undefined,
            category: "contacts",
            route: ROUTES.ANNUAIRE + `?search=${encodeURIComponent(c.nom)}`,
          });
        });
    }

    // Process (recherche aussi dans le contenu)
    if (selectedCategories.has("process")) {
      process
        ?.filter(
          (p) =>
            matchesSearch(p.titre, searchQuery) ||
            matchesSearch(p.description, searchQuery) ||
            matchesSearch(p.categorie, searchQuery) ||
            matchesSearch(p.contenu, searchQuery)
        )
        .forEach((p) => {
          allResults.push({
            id: `process-${p.id}`,
            title: p.titre,
            subtitle: p.categorie || p.description || undefined,
            category: "process",
            route: ROUTES.PROCESS + `?search=${encodeURIComponent(searchQuery)}`,
          });
        });
    }

    // Sites internet
    if (selectedCategories.has("sites")) {
      sites
        ?.filter(
          (s) =>
            matchesSearch(s.nom, searchQuery) ||
            matchesSearch(s.url, searchQuery) ||
            matchesSearch(s.categorie, searchQuery)
        )
        .forEach((s) => {
          allResults.push({
            id: `site-${s.id}`,
            title: s.nom,
            subtitle: s.categorie || undefined,
            category: "sites",
            route: ROUTES.SITES_INTERNET + `?search=${encodeURIComponent(s.nom)}`,
          });
        });
    }

    // Réunions
    if (selectedCategories.has("reunions")) {
      reunions
        ?.filter(
          (r) => matchesSearch(r.titre, searchQuery) || matchesSearch(r.description, searchQuery)
        )
        .forEach((r) => {
          allResults.push({
            id: `reunion-${r.id}`,
            title: r.titre,
            subtitle: r.is_archived ? "Archivé" : undefined,
            category: "reunions",
            route: ROUTES.REUNIONS,
          });
        });
    }

    return allResults;
  }, [searchQuery, selectedCategories, dossiers, franchises, projets, contacts, process, sites, reunions]);

  // Grouper par catégorie
  const groupedResults = useMemo(() => {
    const groups: Record<SearchCategory, SearchResult[]> = {
      dossiers: [],
      archives: [],
      franchises: [],
      projets: [],
      contacts: [],
      process: [],
      sites: [],
      reunions: [],
    };
    results.forEach((r) => groups[r.category].push(r));
    return groups;
  }, [results]);

  // Compteurs par catégorie
  const categoryCounts = useMemo(() => {
    const counts: Record<SearchCategory, number> = {
      dossiers: 0,
      archives: 0,
      franchises: 0,
      projets: 0,
      contacts: 0,
      process: 0,
      sites: 0,
      reunions: 0,
    };
    results.forEach((r) => counts[r.category]++);
    return counts;
  }, [results]);

  const toggleCategory = (category: SearchCategory) => {
    const newSet = new Set(selectedCategories);
    if (newSet.has(category)) {
      newSet.delete(category);
    } else {
      newSet.add(category);
    }
    setSelectedCategories(newSet);
  };

  const selectAllCategories = () => {
    setSelectedCategories(new Set(ALL_CATEGORIES));
  };

  const clearAllCategories = () => {
    setSelectedCategories(new Set());
  };

  const handleResultClick = (result: SearchResult) => {
    navigate(result.route);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
          <Search className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recherche globale</h1>
          <p className="text-sm text-gray-500">
            Recherchez dans tous les modules de l'application
          </p>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <Input
          id="search-input"
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Rechercher un dossier, une franchise, un contact, un process..."
          className="pl-12 pr-12 h-12 text-lg"
        />
        {searchInput && (
          <button
            onClick={() => setSearchInput("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        )}
      </div>

      {/* Filtres par catégorie */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">Filtrer par catégorie</span>
          <div className="flex gap-2">
            <button
              onClick={selectAllCategories}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              Tout sélectionner
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={clearAllCategories}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Tout désélectionner
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {ALL_CATEGORIES.map((category) => {
            const config = CATEGORY_CONFIG[category];
            const count = categoryCounts[category];
            const isSelected = selectedCategories.has(category);
            return (
              <button
                key={category}
                onClick={() => toggleCategory(category)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors",
                  isSelected
                    ? `${config.bgColor} ${config.color} border-current`
                    : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100"
                )}
              >
                {config.icon}
                <span>{config.label}</span>
                {searchQuery.length >= 2 && (
                  <span className={cn(
                    "ml-1 px-1.5 py-0.5 rounded text-xs",
                    isSelected ? "bg-white/50" : "bg-gray-200"
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Résultats */}
      <div className="bg-white rounded-xl border">
        {searchQuery.length < 2 ? (
          <div className="py-16 text-center">
            <Search className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Tapez au moins 2 caractères pour lancer la recherche</p>
          </div>
        ) : isLoading ? (
          <div className="py-16 flex items-center justify-center gap-3 text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Recherche en cours...</span>
          </div>
        ) : results.length === 0 ? (
          <div className="py-16 text-center">
            <Search className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Aucun résultat pour "{searchQuery}"</p>
            <p className="text-sm text-gray-400 mt-1">
              Essayez avec d'autres mots-clés ou vérifiez les filtres
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {/* En-tête avec compteur */}
            <div className="px-4 py-3 bg-gray-50 rounded-t-xl">
              <span className="text-sm font-medium text-gray-700">
                {results.length} résultat{results.length > 1 ? "s" : ""} trouvé{results.length > 1 ? "s" : ""}
              </span>
            </div>

            {/* Résultats groupés par catégorie */}
            {ALL_CATEGORIES.map((category) => {
              const categoryResults = groupedResults[category];
              if (categoryResults.length === 0 || !selectedCategories.has(category)) return null;

              const config = CATEGORY_CONFIG[category];
              return (
                <div key={category} className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={cn("p-1.5 rounded", config.bgColor, config.color)}>
                      {config.icon}
                    </span>
                    <span className="text-sm font-medium text-gray-700">
                      {config.label}
                    </span>
                    <span className="text-xs text-gray-400">
                      ({categoryResults.length})
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {categoryResults.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => handleResultClick(result)}
                        className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 text-left transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600">
                            {result.title}
                          </div>
                          {result.subtitle && (
                            <div className="text-xs text-gray-500 truncate">
                              {result.subtitle}
                            </div>
                          )}
                        </div>
                        <ExternalLink className="h-4 w-4 text-gray-300 group-hover:text-blue-500 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
