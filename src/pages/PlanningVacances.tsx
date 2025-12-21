import { useState } from "react";
import {
  usePlanningVacances,
  getCalendarDays,
  formatDateToString,
  type CongeAvecPrenom,
} from "@/hooks/usePlanningVacances";
import { MOIS_LABELS } from "@/hooks/useHeuresSupplementaires";
import { CongeModal } from "@/components/planning-vacances/CongeModal";
import { cn } from "@/lib/utils";
import { Palmtree, ChevronLeft, ChevronRight, Calendar, Sun, Moon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Jours de la semaine pour l'en-tête
const JOURS_SEMAINE_COURT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default function PlanningVacances() {
  // État pour le mois/année affiché
  const now = new Date();
  const [annee, setAnnee] = useState(now.getFullYear());
  const [mois, setMois] = useState(now.getMonth() + 1);

  // État pour la modale
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedConges, setSelectedConges] = useState<CongeAvecPrenom[]>([]);

  // Récupérer les données
  const { conges, joursFeries, isLoading } = usePlanningVacances(annee, mois);

  // Générer les jours du calendrier
  const calendarDays = getCalendarDays(annee, mois);

  // Navigation entre les mois
  const goToPreviousMonth = () => {
    if (mois === 1) {
      setMois(12);
      setAnnee(annee - 1);
    } else {
      setMois(mois - 1);
    }
  };

  const goToNextMonth = () => {
    if (mois === 12) {
      setMois(1);
      setAnnee(annee + 1);
    } else {
      setMois(mois + 1);
    }
  };

  const goToToday = () => {
    setAnnee(now.getFullYear());
    setMois(now.getMonth() + 1);
  };

  // Ouvrir la modale pour un jour
  const handleDayClick = (date: Date, congesJour: CongeAvecPrenom[]) => {
    // Ne pas ouvrir pour les weekends
    if (date.getDay() === 0 || date.getDay() === 6) return;

    setSelectedDate(date);
    setSelectedConges(congesJour);
    setIsModalOpen(true);
  };

  // Vérifier si on est sur le mois courant
  const isCurrentMonth =
    annee === now.getFullYear() && mois === now.getMonth() + 1;

  // Date d'aujourd'hui pour le highlight
  const todayStr = formatDateToString(now);

  // Helper pour afficher le type de congé
  const renderCongeType = (type: string) => {
    if (type === "conge_matin") {
      return <Sun className="h-3 w-3 flex-shrink-0 text-amber-500" />;
    }
    if (type === "conge_aprem") {
      return <Moon className="h-3 w-3 flex-shrink-0 text-indigo-500" />;
    }
    return <Palmtree className="h-3 w-3 flex-shrink-0" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Palmtree className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Planning Vacances</h1>
              <p className="text-emerald-100 text-sm">
                Calendrier des congés de l'équipe
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Calendrier */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            {/* Navigation mois */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={goToPreviousMonth}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-lg min-w-[180px] text-center">
                {MOIS_LABELS[mois - 1]} {annee}
              </CardTitle>
              <Button variant="outline" size="icon" onClick={goToNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Bouton Aujourd'hui */}
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              disabled={isCurrentMonth}
              className="gap-2"
            >
              <Calendar className="h-4 w-4" />
              Aujourd'hui
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* En-tête des jours de la semaine */}
              <div className="grid grid-cols-7 gap-1">
                {JOURS_SEMAINE_COURT.map((jour, i) => (
                  <div
                    key={jour}
                    className={cn(
                      "text-center text-sm font-medium py-2",
                      i >= 5 ? "text-gray-400" : "text-gray-700"
                    )}
                  >
                    {jour}
                  </div>
                ))}
              </div>

              {/* Grille du calendrier */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((date, index) => {
                  const dateStr = formatDateToString(date);
                  const isCurrentMonthDay = date.getMonth() + 1 === mois;
                  const isToday = dateStr === todayStr;
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  const jourFerie = joursFeries.get(dateStr);
                  const congesJour = conges.get(dateStr) || [];
                  const isClickable = isCurrentMonthDay && !isWeekend;

                  return (
                    <div
                      key={index}
                      onClick={() => isClickable && handleDayClick(date, congesJour)}
                      className={cn(
                        "min-h-[100px] p-2 rounded-lg border transition-colors",
                        // Curseur cliquable pour les jours ouvrés du mois
                        isClickable && "cursor-pointer hover:border-emerald-400 hover:shadow-sm",
                        // Jour hors mois courant
                        !isCurrentMonthDay && "opacity-40",
                        // Weekend
                        isWeekend && isCurrentMonthDay && "bg-gray-50",
                        // Jour férié
                        jourFerie && isCurrentMonthDay && "bg-amber-50 border-amber-200",
                        // Jour avec congés
                        congesJour.length > 0 &&
                          !jourFerie &&
                          isCurrentMonthDay &&
                          "bg-emerald-50 border-emerald-200",
                        // Jour normal
                        !isWeekend &&
                          !jourFerie &&
                          congesJour.length === 0 &&
                          isCurrentMonthDay &&
                          "bg-white border-gray-200",
                        // Aujourd'hui
                        isToday && "ring-2 ring-blue-500 ring-offset-1"
                      )}
                    >
                      {/* Numéro du jour */}
                      <div
                        className={cn(
                          "text-sm font-medium mb-1",
                          isWeekend && isCurrentMonthDay
                            ? "text-gray-400"
                            : isCurrentMonthDay
                            ? "text-gray-900"
                            : "text-gray-400"
                        )}
                      >
                        {date.getDate()}
                      </div>

                      {/* Jour férié */}
                      {jourFerie && isCurrentMonthDay && (
                        <div className="text-xs text-amber-700 font-medium truncate mb-1">
                          {jourFerie}
                        </div>
                      )}

                      {/* Liste des congés */}
                      {isCurrentMonthDay && congesJour.length > 0 && (
                        <div className="space-y-0.5">
                          {congesJour.map((conge) => (
                            <div
                              key={conge.userId}
                              className="text-xs text-emerald-700 truncate flex items-center gap-1"
                            >
                              {renderCongeType(conge.type)}
                              <span>{conge.prenom}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Légende */}
              <div className="flex flex-wrap items-center gap-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-amber-50 border border-amber-200" />
                  <span className="text-sm text-gray-600">Jour férié</span>
                </div>
                <div className="flex items-center gap-2">
                  <Palmtree className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm text-gray-600">Journée</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-gray-600">Matin</span>
                </div>
                <div className="flex items-center gap-2">
                  <Moon className="h-4 w-4 text-indigo-500" />
                  <span className="text-sm text-gray-600">Après-midi</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-white border-2 border-blue-500" />
                  <span className="text-sm text-gray-600">Aujourd'hui</span>
                </div>
              </div>

              {/* Instruction */}
              <p className="text-xs text-gray-500 italic text-center">
                Cliquez sur un jour pour ajouter ou modifier des congés
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modale de gestion des congés */}
      <CongeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedDate={selectedDate}
        existingConges={selectedConges}
      />
    </div>
  );
}
