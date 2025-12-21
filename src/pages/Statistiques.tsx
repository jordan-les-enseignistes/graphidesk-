import { useState, useMemo } from "react";
import { useAllDossiers, useArchives } from "@/hooks/useDossiers";
import { useProfiles } from "@/hooks/useProfiles";
import { useStatuts } from "@/hooks/useStatuts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { BarChart3, TrendingUp, Users, FolderOpen, Archive, Calendar } from "lucide-react";
import { getFirstName, cn } from "@/lib/utils";
import { getBadgeClassName } from "@/lib/badgeColors";

export default function Statistiques() {
  // Filtre par année - année courante par défaut
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));

  const { data: dossiers, isLoading: loadingDossiers } = useAllDossiers();
  const { data: archives, isLoading: loadingArchives } = useArchives();
  const { data: profiles } = useProfiles();
  const { data: statuts } = useStatuts();

  const isLoading = loadingDossiers || loadingArchives;

  // Options d'années disponibles
  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    years.add(currentYear);

    dossiers?.forEach((d) => {
      const year = new Date(d.date_creation).getFullYear();
      if (year >= 2020 && year <= currentYear + 1) years.add(year);
    });
    archives?.forEach((d) => {
      // Pour les archives, utiliser date_archivage si disponible
      const dateStr = d.date_archivage || d.date_creation;
      if (dateStr) {
        const year = new Date(dateStr).getFullYear();
        if (year >= 2020 && year <= currentYear + 1) years.add(year);
      }
    });

    const sortedYears = Array.from(years).sort((a, b) => b - a);
    return [
      { value: "all", label: "Toutes les années" },
      ...sortedYears.map((y) => ({ value: String(y), label: String(y) })),
    ];
  }, [dossiers, archives, currentYear]);

  // Filtrer par année sélectionnée
  const filteredDossiers = useMemo(() => {
    if (!dossiers) return [];
    if (selectedYear === "all") return dossiers;
    return dossiers.filter((d) => {
      const year = new Date(d.date_creation).getFullYear();
      return year === parseInt(selectedYear);
    });
  }, [dossiers, selectedYear]);

  const filteredArchives = useMemo(() => {
    if (!archives) return [];
    if (selectedYear === "all") return archives;
    return archives.filter((d) => {
      // Utiliser date_archivage pour le filtre des archives
      const dateStr = d.date_archivage;
      if (!dateStr) return false;
      const year = new Date(dateStr).getFullYear();
      return year === parseInt(selectedYear);
    });
  }, [archives, selectedYear]);

  // IDs des graphistes actifs
  const graphistesActifsIds = useMemo(() => {
    return new Set(profiles?.filter(p => p.is_active).map(p => p.id) ?? []);
  }, [profiles]);

  // Calculs - exclure les dossiers des anciens graphistes du compteur "En cours"
  const dossiersActifs = useMemo(() => {
    return filteredDossiers.filter((d) => d.graphiste_id && graphistesActifsIds.has(d.graphiste_id));
  }, [filteredDossiers, graphistesActifsIds]);

  const totalEnCours = dossiersActifs.length;
  const totalArchives = filteredArchives.length;
  const totalTraites = totalEnCours + totalArchives;

  // Par statut (uniquement dossiers en cours des graphistes actifs)
  const parStatut = (statuts || []).map((statut) => ({
    ...statut,
    count: dossiersActifs.filter((d) => d.statut === statut.value).length,
  }));

  // Par graphiste - calcul des dossiers par catégorie
  // Ordre des catégories : Urgent > A faire/En cours > Attente > Mairie > Autres
  const parGraphiste = useMemo(() => {
    const graphistesActifs = profiles?.filter(p => p.is_active) ?? [];

    const result = graphistesActifs.map((p) => {
      // Ne compter que les dossiers avec graphiste_id correspondant (pas NULL)
      const dossiersGraphiste = filteredDossiers.filter((d) => d.graphiste_id && d.graphiste_id === p.id);
      const archivesGraphiste = filteredArchives.filter((d) => d.graphiste_id && d.graphiste_id === p.id);

      // Catégoriser les dossiers selon l'ordre demandé
      const urgent = dossiersGraphiste.filter((d) => d.statut === "! Urgent !").length;
      const aFaireEnCours = dossiersGraphiste.filter((d) =>
        ["A faire", "En cours", "À relancer"].includes(d.statut)
      ).length;
      const attente = dossiersGraphiste.filter((d) =>
        ["Attente R.", "Stand-by"].includes(d.statut)
      ).length;
      const mairie = dossiersGraphiste.filter((d) => d.statut === "Mairie").length;
      const total = dossiersGraphiste.length;

      return {
        ...p,
        total,
        urgent,
        aFaireEnCours,
        attente,
        mairie,
        archives: archivesGraphiste.length,
      };
    });

    return result;
  }, [profiles, filteredDossiers, filteredArchives]);

  // Anciens graphistes (dossiers sans graphiste_id ou avec graphiste inactif)
  const anciensGraphistesStats = useMemo(() => {
    // Dossiers sans graphiste_id OU avec un graphiste_id qui n'est pas actif
    const dossiersAnciens = filteredDossiers.filter((d) =>
      !d.graphiste_id || !graphistesActifsIds.has(d.graphiste_id)
    );
    const archivesAnciens = filteredArchives.filter((d) =>
      !d.graphiste_id || !graphistesActifsIds.has(d.graphiste_id)
    );

    return {
      total: dossiersAnciens.length,
      archives: archivesAnciens.length,
    };
  }, [graphistesActifsIds, filteredDossiers, filteredArchives]);

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
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Répartition par graphiste
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Charge de travail actuelle (dossiers actifs uniquement)
              </p>
            </CardHeader>
            <CardContent>
              {/* Légende - ordre : Urgent > A faire/En cours > Attente > Mairie */}
              <div className="flex flex-wrap gap-4 mb-6 text-xs">
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded bg-red-500" />
                  <span>Urgent</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded bg-blue-500" />
                  <span>A faire / En cours</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded bg-purple-500" />
                  <span>En attente</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded bg-pink-500" />
                  <span>Mairie</span>
                </div>
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
                    {/* Barre de charge colorée - ordre : Urgent > A faire/En cours > Attente > Mairie */}
                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
                      {graphiste.urgent > 0 && (
                        <div
                          className="h-full bg-red-500 transition-all"
                          style={{ width: `${(graphiste.urgent / maxGraphiste) * 100}%` }}
                          title={`Urgent: ${graphiste.urgent}`}
                        />
                      )}
                      {graphiste.aFaireEnCours > 0 && (
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${(graphiste.aFaireEnCours / maxGraphiste) * 100}%` }}
                          title={`A faire / En cours: ${graphiste.aFaireEnCours}`}
                        />
                      )}
                      {graphiste.attente > 0 && (
                        <div
                          className="h-full bg-purple-500 transition-all"
                          style={{ width: `${(graphiste.attente / maxGraphiste) * 100}%` }}
                          title={`En attente: ${graphiste.attente}`}
                        />
                      )}
                      {graphiste.mairie > 0 && (
                        <div
                          className="h-full bg-pink-500 transition-all"
                          style={{ width: `${(graphiste.mairie / maxGraphiste) * 100}%` }}
                          title={`Mairie: ${graphiste.mairie}`}
                        />
                      )}
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
            </CardContent>
          </Card>

          {/* Répartition par statut */}
          <Card>
            <CardHeader>
              <CardTitle>Répartition par statut</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
