import { useState, useMemo } from "react";
import {
  useStatsGlobal,
  useStatsParStatut,
  useStatsParGraphiste,
  useStatsGraphisteParStatut,
  useStatsArchivesParAnnee,
  useStatsArchivesParGraphiste,
} from "@/hooks/useStatistiques";
import { useProfiles } from "@/hooks/useProfiles";
import { useStatuts } from "@/hooks/useStatuts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { BarChart3, TrendingUp, Users, FolderOpen, Archive, Calendar, PieChart } from "lucide-react";
import { getFirstName, cn } from "@/lib/utils";
import { getBadgeClassName } from "@/lib/badgeColors";

type ChartMode = "bar" | "pie";

export default function Statistiques() {
  // Filtre par année - année courante par défaut
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  const [chartModeStatut, setChartModeStatut] = useState<ChartMode>("bar");
  const [chartModeGraphiste, setChartModeGraphiste] = useState<ChartMode>("bar");

  // Hooks agrégés (bypass RLS, pas de limite de 1000)
  const { data: statsGlobal, isLoading: loadingGlobal } = useStatsGlobal();
  const { data: statsParStatut, isLoading: loadingParStatut } = useStatsParStatut();
  const { data: statsParGraphiste, isLoading: loadingParGraphiste } = useStatsParGraphiste();
  const { data: statsGraphisteParStatut } = useStatsGraphisteParStatut();
  const { data: statsArchivesParAnnee } = useStatsArchivesParAnnee();

  // Archives par graphiste avec filtre année
  const selectedAnnee = selectedYear === "all" ? undefined : parseInt(selectedYear);
  const { data: statsArchivesParGraphiste } = useStatsArchivesParGraphiste(
    selectedYear === "all" || parseInt(selectedYear) === currentYear ? undefined : selectedAnnee
  );

  const { data: profiles } = useProfiles();
  const { data: statuts } = useStatuts();

  const isLoading = loadingGlobal || loadingParStatut || loadingParGraphiste;

  // Options d'années disponibles (basées sur les archives)
  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    years.add(currentYear);

    statsArchivesParAnnee?.forEach((item) => {
      if (item.annee >= 2020 && item.annee <= currentYear + 1) {
        years.add(item.annee);
      }
    });

    const sortedYears = Array.from(years).sort((a, b) => b - a);
    return [
      { value: "all", label: "Toutes les années" },
      ...sortedYears.map((y) => ({ value: String(y), label: String(y) })),
    ];
  }, [statsArchivesParAnnee, currentYear]);

  // Calcul des totaux
  // Les dossiers EN COURS sont toujours dans l'année courante
  const totalEnCours = useMemo(() => {
    if (selectedYear !== "all" && parseInt(selectedYear) !== currentYear) {
      return 0; // Année passée = pas de dossiers actifs
    }
    return statsGlobal?.total_en_cours ?? 0;
  }, [statsGlobal, selectedYear, currentYear]);

  const totalArchives = useMemo(() => {
    if (selectedYear === "all") {
      return statsGlobal?.total_archives ?? 0;
    }
    // Filtrer par année
    const archivesAnnee = statsArchivesParAnnee?.find(a => a.annee === parseInt(selectedYear));
    return archivesAnnee?.count ?? 0;
  }, [statsGlobal, statsArchivesParAnnee, selectedYear]);

  const totalTraites = totalEnCours + totalArchives;

  // Par statut - mapper avec les infos de style des statuts
  const parStatut = useMemo(() => {
    return (statuts || []).map((statut) => {
      const stat = statsParStatut?.find(s => s.statut === statut.value);
      return {
        ...statut,
        count: (selectedYear === "all" || parseInt(selectedYear) === currentYear)
          ? (stat?.count ?? 0)
          : 0,
      };
    });
  }, [statuts, statsParStatut, selectedYear, currentYear]);

  // Par graphiste - avec détail par statut
  const parGraphiste = useMemo(() => {
    const graphistesActifs = profiles?.filter(p => p.is_active) ?? [];

    return graphistesActifs.map((p) => {
      const graphisteStats = statsParGraphiste?.find(s => s.graphiste_id === p.id);
      const archivesStats = statsArchivesParGraphiste?.find(s => s.graphiste_id === p.id);

      // Récupérer le détail par statut pour ce graphiste
      const parStatutGraphiste = (statuts || []).map((statut) => {
        const stat = statsGraphisteParStatut?.find(
          s => s.graphiste_id === p.id && s.statut === statut.value
        );
        return {
          statut: statut.value,
          label: statut.label,
          barColor: statut.bar_color,
          count: (selectedYear === "all" || parseInt(selectedYear) === currentYear)
            ? (stat?.count ?? 0)
            : 0,
        };
      });

      const total = (selectedYear === "all" || parseInt(selectedYear) === currentYear)
        ? (graphisteStats?.total_actifs ?? 0)
        : 0;

      const archives = selectedYear === "all"
        ? (graphisteStats?.total_archives ?? 0)
        : (archivesStats?.count ?? 0);

      return {
        ...p,
        total,
        parStatut: parStatutGraphiste,
        archives,
      };
    });
  }, [profiles, statsParGraphiste, statsGraphisteParStatut, statsArchivesParGraphiste, statuts, selectedYear, currentYear]);

  // Anciens graphistes stats
  const anciensGraphistesStats = useMemo(() => {
    const graphistesActifsIds = new Set(profiles?.filter(p => p.is_active).map(p => p.id) ?? []);

    // Calculer les archives des anciens graphistes
    let archivesAnciens = 0;
    statsArchivesParGraphiste?.forEach((item) => {
      if (!item.graphiste_id || !graphistesActifsIds.has(item.graphiste_id)) {
        archivesAnciens += item.count;
      }
    });

    return {
      total: 0, // Les anciens graphistes n'ont pas de dossiers actifs
      archives: archivesAnciens,
    };
  }, [profiles, statsArchivesParGraphiste]);

  // Trouver le max pour la barre
  const maxCount = Math.max(...parStatut.map((s) => s.count), 1);
  // Pour la barre de charge, on utilise seulement les dossiers en cours (pas archivés)
  const maxGraphiste = Math.max(...parGraphiste.map((g) => g.total), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Statistiques</h1>
            <p className="text-sm text-gray-500">
              Vue d'ensemble des performances
            </p>
          </div>
        </div>

        {/* Filtre par année */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <Select
            options={yearOptions}
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-44"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Stats globales */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Dossiers en cours
                </CardTitle>
                <FolderOpen className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalEnCours}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Dossiers archivés
                </CardTitle>
                <Archive className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalArchives}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total traité
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalTraites}</div>
              </CardContent>
            </Card>
          </div>

          {/* Répartition par graphiste - visible par tous */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Répartition par graphiste
                  </CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    Charge de travail actuelle (dossiers actifs uniquement)
                  </p>
                </div>
                <button
                  onClick={() => setChartModeGraphiste(chartModeGraphiste === "bar" ? "pie" : "bar")}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  title={chartModeGraphiste === "bar" ? "Afficher en camembert" : "Afficher en barres"}
                >
                  {chartModeGraphiste === "bar" ? (
                    <>
                      <PieChart className="h-4 w-4" />
                      <span className="hidden sm:inline">Camembert</span>
                    </>
                  ) : (
                    <>
                      <BarChart3 className="h-4 w-4" />
                      <span className="hidden sm:inline">Barres</span>
                    </>
                  )}
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {chartModeGraphiste === "bar" ? (
                /* Vue en barres */
                <>
                  {/* Légende dynamique basée sur les statuts */}
                  <div className="flex flex-wrap gap-4 mb-6 text-xs">
                    {(statuts || []).map((statut) => (
                      <div key={statut.value} className="flex items-center gap-1">
                        <div className={`h-3 w-3 rounded ${statut.bar_color}`} />
                        <span>{statut.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-6">
                    {parGraphiste.map((graphiste) => (
                      <div key={graphiste.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
                              getBadgeClassName(graphiste.badge_color)
                            )}>
                              {graphiste.initials}
                            </span>
                            <span className="font-medium">{getFirstName(graphiste.full_name)}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-blue-600 font-medium">
                              {graphiste.total} dossiers actifs
                            </span>
                            <span className="text-gray-500">
                              {graphiste.archives} archivés
                            </span>
                          </div>
                        </div>
                        {/* Barre de charge colorée - dynamique par statut */}
                        <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
                          {graphiste.parStatut.map((s) => (
                            s.count > 0 && (
                              <div
                                key={s.statut}
                                className={`h-full ${s.barColor} transition-all`}
                                style={{ width: `${(s.count / maxGraphiste) * 100}%` }}
                                title={`${s.label}: ${s.count}`}
                              />
                            )
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Anciens graphistes - affiché seulement s'il y a des archives */}
                    {anciensGraphistesStats.archives > 0 && (
                      <div className="space-y-2 pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-500">
                              ?
                            </span>
                            <span className="font-medium text-gray-500">Anciens graphistes</span>
                          </div>
                          <div className="text-sm">
                            <span className="text-gray-400">
                              {anciensGraphistesStats.archives} archivés
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Vue en camembert */
                <div className="flex flex-col lg:flex-row items-center gap-8">
                  {/* Camembert SVG */}
                  <div className="relative">
                    <svg viewBox="0 0 100 100" className="w-64 h-64 -rotate-90">
                      {(() => {
                        const total = parGraphiste.reduce((sum, g) => sum + g.total, 0);
                        if (total === 0) {
                          return (
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="none"
                              stroke="#e5e7eb"
                              strokeWidth="20"
                            />
                          );
                        }

                        let cumulativePercent = 0;
                        const circumference = 2 * Math.PI * 40;

                        // Couleurs pour les graphistes
                        const graphisteColors = [
                          "#3b82f6", // blue
                          "#22c55e", // green
                          "#f97316", // orange
                          "#a855f7", // purple
                          "#ef4444", // red
                          "#06b6d4", // cyan
                          "#eab308", // yellow
                          "#ec4899", // pink
                        ];

                        return parGraphiste.map((graphiste, index) => {
                          const percent = (graphiste.total / total) * 100;
                          const strokeDasharray = `${(percent * circumference) / 100} ${circumference}`;
                          const strokeDashoffset = -(cumulativePercent * circumference) / 100;
                          cumulativePercent += percent;

                          const strokeColor = graphisteColors[index % graphisteColors.length];

                          return graphiste.total > 0 ? (
                            <circle
                              key={graphiste.id}
                              cx="50"
                              cy="50"
                              r="40"
                              fill="none"
                              stroke={strokeColor}
                              strokeWidth="20"
                              strokeDasharray={strokeDasharray}
                              strokeDashoffset={strokeDashoffset}
                              className="transition-all duration-500"
                            />
                          ) : null;
                        });
                      })()}
                    </svg>
                    {/* Total au centre */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-gray-900">
                          {parGraphiste.reduce((sum, g) => sum + g.total, 0)}
                        </div>
                        <div className="text-sm text-gray-500">dossiers</div>
                      </div>
                    </div>
                  </div>

                  {/* Légende */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(() => {
                      const graphisteColors = [
                        "bg-blue-500",
                        "bg-green-500",
                        "bg-orange-500",
                        "bg-purple-500",
                        "bg-red-500",
                        "bg-cyan-500",
                        "bg-yellow-500",
                        "bg-pink-500",
                      ];
                      const total = parGraphiste.reduce((sum, g) => sum + g.total, 0);

                      return parGraphiste.map((graphiste, index) => {
                        const percent = total > 0 ? ((graphiste.total / total) * 100).toFixed(1) : "0";
                        return (
                          <div key={graphiste.id} className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${graphisteColors[index % graphisteColors.length]}`} />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{getFirstName(graphiste.full_name)}</div>
                              <div className="text-xs text-gray-500">
                                {graphiste.total} dossiers ({percent}%)
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Répartition par statut */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Répartition par statut</CardTitle>
                <button
                  onClick={() => setChartModeStatut(chartModeStatut === "bar" ? "pie" : "bar")}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  title={chartModeStatut === "bar" ? "Afficher en camembert" : "Afficher en barres"}
                >
                  {chartModeStatut === "bar" ? (
                    <>
                      <PieChart className="h-4 w-4" />
                      <span className="hidden sm:inline">Camembert</span>
                    </>
                  ) : (
                    <>
                      <BarChart3 className="h-4 w-4" />
                      <span className="hidden sm:inline">Barres</span>
                    </>
                  )}
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {chartModeStatut === "bar" ? (
                /* Vue en barres */
                <div className="space-y-4">
                  {parStatut.map((statut) => (
                    <div key={statut.value} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{statut.label}</span>
                        <span className="text-gray-500">{statut.count}</span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full transition-all ${statut.bar_color}`}
                          style={{ width: `${(statut.count / maxCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Vue en camembert */
                <div className="flex flex-col lg:flex-row items-center gap-8">
                  {/* Camembert SVG */}
                  <div className="relative">
                    <svg viewBox="0 0 100 100" className="w-64 h-64 -rotate-90">
                      {(() => {
                        const total = parStatut.reduce((sum, s) => sum + s.count, 0);
                        if (total === 0) {
                          return (
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="none"
                              stroke="#e5e7eb"
                              strokeWidth="20"
                            />
                          );
                        }

                        let cumulativePercent = 0;
                        const circumference = 2 * Math.PI * 40;

                        return parStatut.map((statut, index) => {
                          const percent = (statut.count / total) * 100;
                          const strokeDasharray = `${(percent * circumference) / 100} ${circumference}`;
                          const strokeDashoffset = -(cumulativePercent * circumference) / 100;
                          cumulativePercent += percent;

                          // Mapper bar_color vers une couleur CSS
                          const colorMap: Record<string, string> = {
                            "bg-red-500": "#ef4444",
                            "bg-blue-500": "#3b82f6",
                            "bg-yellow-500": "#eab308",
                            "bg-purple-500": "#a855f7",
                            "bg-orange-500": "#f97316",
                            "bg-pink-500": "#ec4899",
                            "bg-gray-500": "#6b7280",
                            "bg-green-500": "#22c55e",
                            "bg-cyan-500": "#06b6d4",
                            "bg-indigo-500": "#6366f1",
                          };
                          const strokeColor = colorMap[statut.bar_color] || "#6b7280";

                          return statut.count > 0 ? (
                            <circle
                              key={statut.value}
                              cx="50"
                              cy="50"
                              r="40"
                              fill="none"
                              stroke={strokeColor}
                              strokeWidth="20"
                              strokeDasharray={strokeDasharray}
                              strokeDashoffset={strokeDashoffset}
                              className="transition-all duration-500"
                            />
                          ) : null;
                        });
                      })()}
                    </svg>
                    {/* Total au centre */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-gray-900">
                          {parStatut.reduce((sum, s) => sum + s.count, 0)}
                        </div>
                        <div className="text-sm text-gray-500">dossiers</div>
                      </div>
                    </div>
                  </div>

                  {/* Légende */}
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    {parStatut.map((statut) => {
                      const total = parStatut.reduce((sum, s) => sum + s.count, 0);
                      const percent = total > 0 ? ((statut.count / total) * 100).toFixed(1) : "0";
                      return (
                        <div key={statut.value} className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${statut.bar_color}`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{statut.label}</div>
                            <div className="text-xs text-gray-500">
                              {statut.count} ({percent}%)
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
