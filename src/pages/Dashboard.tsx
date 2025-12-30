import { useState, useMemo } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useEffectiveRole } from "@/hooks/useEffectiveRole";
import { useMyDossiers, useAllDossiers } from "@/hooks/useDossiers";
import {
  useFeuilleTemps,
  calculateMonthlyHoursSup,
  formatMinutesToHuman,
  MOIS_LABELS,
} from "@/hooks/useHeuresSupplementaires";
import { useCongesMois, formatDateToString } from "@/hooks/usePlanningVacances";
import { useStatuts } from "@/hooks/useStatuts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ImportModal } from "@/components/import/ImportModal";
import { ROUTES } from "@/lib/constants";
import { formatDate, getFirstName } from "@/lib/utils";
import { Link } from "react-router-dom";
import {
  FolderOpen,
  Clock,
  CheckCircle,
  TrendingUp,
  Upload,
  PhoneCall,
  Calendar,
  Timer,
  Palmtree,
} from "lucide-react";

export default function Dashboard() {
  const [showImport, setShowImport] = useState(false);
  const profile = useAuthStore((state) => state.profile);
  const { isAdmin } = useEffectiveRole();

  // Toujours récupérer les dossiers de l'utilisateur connecté (même pour admin)
  const { data: myDossiers, isLoading, refetch: refetchMy } = useMyDossiers();
  // Pour le bouton import, on a besoin de refetch all
  const { refetch: refetchAll } = useAllDossiers();
  // Récupérer les statuts dynamiques
  const { data: statuts } = useStatuts();

  const dossiers = myDossiers;

  // Heures supplémentaires du mois en cours
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const { data: feuilleTemps, isLoading: isLoadingHeures } = useFeuilleTemps(
    currentYear,
    currentMonth
  );

  // Calcul des heures sup du mois
  const heuresSupMois = useMemo(() => {
    if (!feuilleTemps?.heures || feuilleTemps.heures.length === 0) {
      return { heuresSup: 0, totalTravaille: 0 };
    }
    return calculateMonthlyHoursSup(
      feuilleTemps.heures,
      profile?.horaires_base
    );
  }, [feuilleTemps, profile?.horaires_base]);

  // Congés à venir (prochain mois inclus)
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  const nextMonthYear = currentMonth === 12 ? currentYear + 1 : currentYear;
  const { data: congesMoisActuel } = useCongesMois(currentYear, currentMonth);
  const { data: congesMoisProchain } = useCongesMois(nextMonthYear, nextMonth);

  // Fusionner et filtrer les congés futurs, regroupés par période
  const prochainsCongés = useMemo(() => {
    const today = formatDateToString(now);
    const allConges: { date: string; prenom: string; type: string }[] = [];

    // Ajouter les congés du mois actuel
    congesMoisActuel?.forEach((conges, date) => {
      if (date >= today) {
        conges.forEach((c) => {
          allConges.push({ date, prenom: c.prenom, type: c.type });
        });
      }
    });

    // Ajouter les congés du mois prochain
    congesMoisProchain?.forEach((conges, date) => {
      conges.forEach((c) => {
        allConges.push({ date, prenom: c.prenom, type: c.type });
      });
    });

    // Trier par prénom puis par date
    allConges.sort((a, b) => {
      if (a.prenom !== b.prenom) return a.prenom.localeCompare(b.prenom);
      return a.date.localeCompare(b.date);
    });

    // Regrouper les congés consécutifs par personne
    const periodes: { prenom: string; dateDebut: string; dateFin: string }[] = [];

    // Créer un Set des dates uniques par personne (pour ignorer matin/aprem du même jour)
    const datesByPerson = new Map<string, Set<string>>();
    allConges.forEach((c) => {
      if (!datesByPerson.has(c.prenom)) {
        datesByPerson.set(c.prenom, new Set());
      }
      datesByPerson.get(c.prenom)!.add(c.date);
    });

    // Pour chaque personne, regrouper les dates consécutives
    datesByPerson.forEach((dates, prenom) => {
      const sortedDates = Array.from(dates).sort();
      if (sortedDates.length === 0) return;

      let periodStart = sortedDates[0];
      let periodEnd = sortedDates[0];

      for (let i = 1; i < sortedDates.length; i++) {
        const currentDate = new Date(sortedDates[i]);
        const prevDate = new Date(periodEnd);

        // Calculer la différence en jours (en tenant compte des weekends)
        const diffDays = Math.round((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

        // Si la date est consécutive (1 jour) ou proche (weekend = 3 jours max)
        if (diffDays <= 3) {
          periodEnd = sortedDates[i];
        } else {
          // Nouvelle période
          periodes.push({ prenom, dateDebut: periodStart, dateFin: periodEnd });
          periodStart = sortedDates[i];
          periodEnd = sortedDates[i];
        }
      }
      // Ajouter la dernière période
      periodes.push({ prenom, dateDebut: periodStart, dateFin: periodEnd });
    });

    // Trier par date de début et prendre les 5 premières périodes
    return periodes
      .sort((a, b) => a.dateDebut.localeCompare(b.dateDebut))
      .slice(0, 5);
  }, [congesMoisActuel, congesMoisProchain, now]);

  // Fonction pour déterminer si un dossier est à relancer
  const isARelancer = (d: typeof dossiers extends (infer T)[] ? T : never) => {
    // Statut explicitement "À relancer"
    if (d.statut === "À relancer") return true;

    // Statut "Attente R." depuis plus de 7 jours
    if (d.statut === "Attente R.") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const updatedAt = new Date(d.updated_at);
      return updatedAt < sevenDaysAgo;
    }
    return false;
  };

  // Calculs statistiques
  const stats = useMemo(() => {
    if (!dossiers) return { total: 0, aRelancer: 0, aFaire: 0, enAttente: 0 };

    return {
      total: dossiers.length,
      aRelancer: dossiers.filter(isARelancer).length,
      aFaire: dossiers.filter((d) => d.statut === "A faire").length,
      enAttente: dossiers.filter((d) => d.statut === "Mairie" || d.statut === "Attente R.").length,
    };
  }, [dossiers]);

  // Compter par statut (dynamique depuis la base de données)
  const parStatut = useMemo(() => {
    if (!statuts || !dossiers) return {} as Record<string, number>;
    return statuts.reduce((acc, statut) => {
      acc[statut.value] = dossiers.filter((d) => d.statut === statut.value).length;
      return acc;
    }, {} as Record<string, number>);
  }, [statuts, dossiers]);

  // Dossiers à relancer : en "Attente R." depuis plus de 7 jours ou statut "À relancer"
  const dossiersARelancer = useMemo(() => {
    if (!dossiers) return [];

    return dossiers
      .filter(isARelancer)
      .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()) // Plus anciens d'abord
      .slice(0, 5);
  }, [dossiers]);

  // Dossiers à traiter - priorité : Urgent > A faire/En cours > autres
  // Puis par date de création croissante (plus anciens d'abord pour éviter les retards)
  const dossiersRecents = useMemo(() => {
    if (!dossiers) return [];

    // Priorité des statuts : Urgent = 0, A faire/En cours = 1, autres = 2
    const getPriorite = (statut: string) => {
      if (statut === "! Urgent !") return 0;
      if (statut === "A faire" || statut === "En cours") return 1;
      return 2;
    };

    return [...dossiers]
      .sort((a, b) => {
        // D'abord trier par priorité de statut
        const prioA = getPriorite(a.statut);
        const prioB = getPriorite(b.statut);
        if (prioA !== prioB) return prioA - prioB;

        // Ensuite par date de création croissante (plus anciens d'abord)
        return new Date(a.date_creation).getTime() - new Date(b.date_creation).getTime();
      })
      .slice(0, 5);
  }, [dossiers]);

  const handleImportSuccess = () => {
    if (isAdmin) {
      refetchAll();
    } else {
      refetchMy();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Bonjour, {getFirstName(profile?.full_name)} !
          </h1>
          <p className="text-gray-500">
            Vue d'ensemble de vos dossiers
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => setShowImport(true)}
            className="bg-[#2470B8] hover:bg-[#1c5a94]"
          >
            <Upload className="mr-2 h-4 w-4" />
            Importer des dossiers
          </Button>
        )}
      </div>

      {/* Modal d'import */}
      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onSuccess={handleImportSuccess}
      />

      {/* Stats cards - Ordre: A faire -> En attente -> À relancer -> Total dossiers */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              A faire
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : stats.aFaire}
            </div>
            <p className="text-xs text-gray-500">
              Dossiers à traiter
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              En attente
            </CardTitle>
            <Clock className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : stats.enAttente}
            </div>
            <p className="text-xs text-gray-500">
              Mairie + Attente R.
            </p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-800">
              À relancer
            </CardTitle>
            <PhoneCall className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-800">
              {isLoading ? "..." : stats.aRelancer}
            </div>
            <p className="text-xs text-orange-600">
              Sans réponse depuis 7j+
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total dossiers
            </CardTitle>
            <FolderOpen className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : stats.total}
            </div>
            <p className="text-xs text-gray-500">
              Dossiers en cours
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Répartition par statut (2/3) + Heures sup (1/3) */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Répartition par statut
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {statuts?.map((statut) => (
                <Link
                  key={statut.value}
                  to={`/mes-dossiers?statut=${encodeURIComponent(statut.value)}`}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 transition-colors hover:bg-gray-50"
                >
                  <StatusBadge statut={statut.value} />
                  <span className="font-semibold">{parStatut[statut.value] || 0}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Heures sup du mois */}
        <Link to={ROUTES.HEURES_SUPPLEMENTAIRES} className="block">
          <Card
            className={
              heuresSupMois.heuresSup > 0
                ? "border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer h-full"
                : heuresSupMois.heuresSup < 0
                ? "border-red-200 bg-red-50 hover:bg-red-100 transition-colors cursor-pointer h-full"
                : "hover:bg-gray-50 transition-colors cursor-pointer h-full"
            }
          >
            <CardHeader>
              <CardTitle
                className={`flex items-center gap-2 ${
                  heuresSupMois.heuresSup > 0
                    ? "text-emerald-800"
                    : heuresSupMois.heuresSup < 0
                    ? "text-red-800"
                    : ""
                }`}
              >
                <Timer
                  className={`h-5 w-5 ${
                    heuresSupMois.heuresSup > 0
                      ? "text-emerald-500"
                      : heuresSupMois.heuresSup < 0
                      ? "text-red-500"
                      : "text-gray-500"
                  }`}
                />
                Heures supplémentaires
              </CardTitle>
              <p
                className={`text-xs mt-1 ${
                  heuresSupMois.heuresSup > 0
                    ? "text-emerald-600"
                    : heuresSupMois.heuresSup < 0
                    ? "text-red-600"
                    : "text-gray-500"
                }`}
              >
                {MOIS_LABELS[currentMonth - 1]} {currentYear}
              </p>
            </CardHeader>
            <CardContent>
              <div
                className={`text-4xl font-bold ${
                  heuresSupMois.heuresSup > 0
                    ? "text-emerald-800"
                    : heuresSupMois.heuresSup < 0
                    ? "text-red-800"
                    : ""
                }`}
              >
                {isLoadingHeures
                  ? "..."
                  : heuresSupMois.heuresSup === 0
                  ? "0h"
                  : (heuresSupMois.heuresSup > 0 ? "+" : "") +
                    formatMinutesToHuman(heuresSupMois.heuresSup)}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Cliquez pour voir le détail
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Grille 3 colonnes */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Dossiers à relancer */}
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <PhoneCall className="h-5 w-5" />
              À relancer
            </CardTitle>
            <p className="text-xs text-orange-600 mt-1">
              En attente de réponse depuis plus de 7 jours
            </p>
          </CardHeader>
          <CardContent>
            {dossiersARelancer.length === 0 ? (
              <p className="text-sm text-gray-500">
                Aucun dossier à relancer
              </p>
            ) : (
              <ul className="space-y-3">
                {dossiersARelancer.map((dossier) => {
                  const daysSinceUpdate = Math.floor(
                    (Date.now() - new Date(dossier.updated_at).getTime()) / (1000 * 60 * 60 * 24)
                  );
                  return (
                    <li
                      key={dossier.id}
                      className="flex items-center justify-between rounded-lg border border-orange-100 bg-orange-50 p-3"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{dossier.nom}</p>
                        <p className="text-sm text-orange-600">
                          Sans nouvelle depuis {daysSinceUpdate} jour{daysSinceUpdate > 1 ? "s" : ""}
                        </p>
                      </div>
                      <StatusBadge statut={dossier.statut} />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Dossiers à traiter en priorité */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              À traiter en priorité
            </CardTitle>
            <p className="text-xs text-gray-500 mt-1">
              Urgents et plus anciens en premier
            </p>
          </CardHeader>
          <CardContent>
            {dossiersRecents.length === 0 ? (
              <p className="text-sm text-gray-500">
                Aucun dossier à traiter
              </p>
            ) : (
              <ul className="space-y-3">
                {dossiersRecents.map((dossier) => (
                  <li
                    key={dossier.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{dossier.nom}</p>
                      <p className="text-sm text-gray-500">
                        Créé le {formatDate(dossier.date_creation)}
                      </p>
                    </div>
                    <StatusBadge statut={dossier.statut} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Prochains congés */}
        <Card className="border-cyan-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-cyan-800">
              <Palmtree className="h-5 w-5" />
              Prochains congés
            </CardTitle>
            <p className="text-xs text-cyan-600 mt-1">
              Absences à venir de l'équipe
            </p>
          </CardHeader>
          <CardContent>
            {prochainsCongés.length === 0 ? (
              <p className="text-sm text-gray-500">
                Aucun congé prévu
              </p>
            ) : (
              <ul className="space-y-3">
                {prochainsCongés.map((periode, index) => {
                  const isSameDay = periode.dateDebut === periode.dateFin;
                  const dateLabel = isSameDay
                    ? formatDate(periode.dateDebut)
                    : `du ${formatDate(periode.dateDebut)} au ${formatDate(periode.dateFin)}`;
                  return (
                    <li
                      key={`${periode.dateDebut}-${periode.prenom}-${index}`}
                      className="flex items-center justify-between rounded-lg border border-cyan-100 bg-cyan-50 p-3"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{periode.prenom}</p>
                        <p className="text-sm text-cyan-600">
                          {dateLabel}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link
              to={ROUTES.PLANNING_VACANCES}
              className="mt-4 inline-flex items-center gap-1 text-sm text-cyan-600 hover:text-cyan-800 transition-colors"
            >
              Voir le planning complet →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
