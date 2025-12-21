import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { useEffectiveRole } from "@/hooks/useEffectiveRole";
import { supabase } from "@/lib/supabase";
import {
  useFeuilleTemps,
  useAllFeuillesTemps,
  useUpdateHeureJournaliere,
  useInitialiserMois,
  useHorairesBase,
  getJourSemaine,
  getNumeroSemaine,
  calculateDayTotal,
  calculateMonthlyHoursSup,
  formatMinutesToHuman,
  MOIS_LABELS,
} from "@/hooks/useHeuresSupplementaires";
import { useProfiles } from "@/hooks/useProfiles";
import { HORAIRES_BASE_DEFAUT } from "@/types/database";
import type { HeuresJournalieres, JourSemaine, Profile, JourFerie } from "@/types";
import { cn } from "@/lib/utils";
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Timer,
  TrendingUp,
  TrendingDown,
  Users,
  Palmtree,
  RefreshCw,
  Mail,
  Sun,
  Moon,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmailConfigModal } from "@/components/heures-sup/EmailConfigModal";

// Hook pour récupérer les jours fériés
function useJoursFeries(annee: number, mois: number) {
  const anneeMin = mois === 1 ? annee - 1 : annee;
  const anneeMax = mois === 12 ? annee + 1 : annee;

  return useQuery({
    queryKey: ["jours-feries", anneeMin, anneeMax],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jours_feries")
        .select("*")
        .gte("date", `${anneeMin}-01-01`)
        .lte("date", `${anneeMax}-12-31`);
      if (error) throw error;
      return data as JourFerie[];
    },
  });
}

// Générer les semaines du mois en logique comptable (semaines ISO complètes)
// Un mois comptable INCLUT la semaine qui contient le 1er du mois (même si elle déborde sur le mois précédent)
// Et EXCLUT la semaine qui contient le 1er du mois suivant (elle appartient au mois suivant)
function getWeeksOfMonth(annee: number, mois: number): { weekNum: number; days: Date[] }[] {
  const weeks: { weekNum: number; days: Date[] }[] = [];

  // Trouver le 1er du mois
  const firstOfMonth = new Date(annee, mois - 1, 1);
  const firstDayOfWeek = firstOfMonth.getDay(); // 0=dim, 1=lun, etc.

  // Calculer le LUNDI de la semaine qui contient le 1er du mois
  // C'est le début de notre période comptable
  let startDate: Date;
  if (firstDayOfWeek === 0) {
    // Le 1er est un dimanche -> le lundi était 6 jours avant
    startDate = new Date(annee, mois - 1, 1 - 6);
  } else if (firstDayOfWeek === 1) {
    // Le 1er est un lundi
    startDate = new Date(firstOfMonth);
  } else {
    // Le lundi était (firstDayOfWeek - 1) jours avant
    startDate = new Date(annee, mois - 1, 1 - (firstDayOfWeek - 1));
  }

  // Trouver le 1er du mois suivant
  const firstOfNextMonth = new Date(annee, mois, 1);
  const nextMonthDayOfWeek = firstOfNextMonth.getDay();

  // Calculer le LUNDI de la semaine qui contient le 1er du mois suivant
  // Puis reculer d'un jour pour avoir le dimanche de la semaine précédente
  let mondayOfNextMonthWeek: Date;
  if (nextMonthDayOfWeek === 0) {
    // Le 1er du mois suivant est un dimanche -> le lundi est 6 jours avant
    mondayOfNextMonthWeek = new Date(annee, mois, 1 - 6);
  } else if (nextMonthDayOfWeek === 1) {
    // Le 1er du mois suivant est un lundi
    mondayOfNextMonthWeek = new Date(annee, mois, 1);
  } else {
    // Le lundi était (nextMonthDayOfWeek - 1) jours avant
    mondayOfNextMonthWeek = new Date(annee, mois, 1 - (nextMonthDayOfWeek - 1));
  }

  // La fin est le dimanche AVANT ce lundi (donc lundi - 1 jour)
  const endDate = new Date(mondayOfNextMonthWeek);
  endDate.setDate(endDate.getDate() - 1);

  // Générer toutes les semaines entre startDate et endDate
  const current = new Date(startDate);
  let currentWeek: Date[] = [];
  let currentWeekNum = -1;

  while (current <= endDate) {
    const weekNum = getNumeroSemaine(current);
    if (currentWeekNum !== weekNum && currentWeek.length > 0) {
      weeks.push({ weekNum: currentWeekNum, days: currentWeek });
      currentWeek = [];
    }
    currentWeekNum = weekNum;
    currentWeek.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  if (currentWeek.length > 0) {
    weeks.push({ weekNum: currentWeekNum, days: currentWeek });
  }
  return weeks;
}

function formatDateStr(date: Date): string {
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
}

const JOUR_LABELS: Record<JourSemaine, string> = {
  lundi: "Lundi",
  mardi: "Mardi",
  mercredi: "Mercredi",
  jeudi: "Jeudi",
  vendredi: "Vendredi",
  samedi: "Samedi",
  dimanche: "Dimanche",
};

// Input heure séparé (heures : minutes)
function TimeInput({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");

  useEffect(() => {
    if (value) {
      const parts = value.split(":");
      setHours(parts[0] || "");
      setMinutes(parts[1] || "");
    } else {
      setHours("");
      setMinutes("");
    }
  }, [value]);

  const commit = (h: string, m: string) => {
    if (!h && !m) {
      onChange(null);
      return;
    }
    const hNum = Math.min(23, Math.max(0, parseInt(h) || 0));
    const mNum = Math.min(59, Math.max(0, parseInt(m) || 0));
    onChange(`${hNum.toString().padStart(2, "0")}:${mNum.toString().padStart(2, "0")}`);
  };

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 2);
    setHours(val);
  };

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 2);
    setMinutes(val);
  };

  const handleBlur = () => {
    commit(hours, minutes);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      commit(hours, minutes);
      e.currentTarget.blur();
    }
  };

  return (
    <div className="flex items-center gap-0.5">
      <input
        type="text"
        value={hours}
        onChange={handleHoursChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="--"
        className="w-7 text-center text-sm font-mono bg-white border border-gray-200 rounded px-0.5 py-0.5 hover:border-blue-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 focus:outline-none transition-all"
      />
      <span className="text-gray-400 text-xs">:</span>
      <input
        type="text"
        value={minutes}
        onChange={handleMinutesChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="--"
        className="w-7 text-center text-sm font-mono bg-white border border-gray-200 rounded px-0.5 py-0.5 hover:border-blue-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 focus:outline-none transition-all"
      />
    </div>
  );
}

// Type pour les congés
type TypeConge = "conge" | "conge_matin" | "conge_aprem";

// Ligne d'un jour
function DayRow({
  date,
  isToday,
  heureData,
  onUpdate,
  onSetConge,
  onClearConge,
  jourFerie,
}: {
  date: Date;
  isToday: boolean;
  heureData: HeuresJournalieres | null;
  onUpdate: (date: string, jour: JourSemaine, field: string, value: string | null) => void;
  onSetConge: (date: string, jour: JourSemaine, type: TypeConge) => void;
  onClearConge: (date: string, jour: JourSemaine) => void;
  jourFerie?: JourFerie;
}) {
  const jourSemaine = getJourSemaine(date);
  const dateStr = formatDateStr(date);
  const jour = date.getDate();
  const isWeekend = jourSemaine === "samedi" || jourSemaine === "dimanche";
  const isFerie = !!jourFerie || heureData?.type_absence === "ferie";
  const isConge = heureData?.type_absence === "conge";
  const isCongeMatin = heureData?.type_absence === "conge_matin";
  const isCongeAprem = heureData?.type_absence === "conge_aprem";
  const hasAnyConge = isConge || isCongeMatin || isCongeAprem;

  const total = calculateDayTotal(
    heureData?.matin_debut || null,
    heureData?.matin_fin || null,
    heureData?.aprem_debut || null,
    heureData?.aprem_fin || null
  );

  const handleChange = (field: string, value: string | null) => {
    onUpdate(dateStr, jourSemaine, field, value);
  };

  const handlePointer = (field: string) => {
    const now = new Date();
    handleChange(field, `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`);
  };

  const handleSetConge = (type: TypeConge) => {
    onSetConge(dateStr, jourSemaine, type);
  };

  const handleClearConge = () => {
    onClearConge(dateStr, jourSemaine);
  };

  // Weekend - ligne compacte grisée
  if (isWeekend) {
    return (
      <tr className="bg-gray-50">
        <td className="px-2 py-1 text-xs text-gray-400 font-medium">
          {JOUR_LABELS[jourSemaine].slice(0, 3)}
        </td>
        <td className="px-2 py-1 text-xs text-gray-400">{jour}</td>
        <td colSpan={5} className="px-2 py-1 text-xs text-gray-300 italic">
          Weekend
        </td>
      </tr>
    );
  }

  const rowBg = isFerie
    ? "bg-amber-50"
    : isConge
    ? "bg-emerald-50"
    : isCongeMatin || isCongeAprem
    ? "bg-emerald-50/50"
    : isToday
    ? "bg-blue-50"
    : "bg-white hover:bg-gray-50";

  return (
    <tr className={cn(rowBg, "transition-colors")}>
      {/* Jour */}
      <td className={cn("px-2 py-1.5 text-sm font-medium", isToday ? "text-blue-600" : "text-gray-600")}>
        {JOUR_LABELS[jourSemaine].slice(0, 3)}
      </td>
      {/* Date */}
      <td className="px-2 py-1.5">
        <span className={cn(
          "text-sm font-bold",
          isToday && "bg-blue-600 text-white rounded-full w-6 h-6 inline-flex items-center justify-center",
          isFerie && !isToday && "text-amber-700",
          hasAnyConge && !isToday && "text-emerald-700",
          !isToday && !isFerie && !hasAnyConge && "text-gray-700"
        )}>
          {jour}
        </span>
      </td>

      {/* Contenu selon état */}
      {isFerie ? (
        <td colSpan={5} className="px-2 py-1.5 text-sm text-amber-600 font-medium">
          {jourFerie?.nom || "Jour férié"}
        </td>
      ) : isConge ? (
        <>
          <td colSpan={4} className="px-2 py-1.5">
            <span className="text-sm text-emerald-600 font-medium flex items-center gap-1">
              <Palmtree className="h-4 w-4" />
              Congé (journée)
            </span>
          </td>
          <td className="px-2 py-1.5">
            <button
              onClick={handleClearConge}
              className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors"
              title="Annuler le congé"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </td>
        </>
      ) : isCongeMatin ? (
        <>
          {/* Congé matin - afficher horaires après-midi */}
          <td colSpan={2} className="px-1 py-1.5">
            <span className="text-sm text-emerald-600 font-medium flex items-center gap-1">
              <Sun className="h-4 w-4" />
              Congé matin
            </span>
          </td>
          <td className="px-1 py-1.5">
            <div className="flex items-center gap-1">
              <TimeInput value={heureData?.aprem_debut || null} onChange={(v) => handleChange("aprem_debut", v)} />
              {isToday && (
                <button onClick={() => handlePointer("aprem_debut")} className="p-1 rounded hover:bg-blue-100 text-blue-400" title="Pointer">
                  <Timer className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </td>
          <td className="px-1 py-1.5">
            <div className="flex items-center gap-1">
              <TimeInput value={heureData?.aprem_fin || null} onChange={(v) => handleChange("aprem_fin", v)} />
              {isToday && (
                <button onClick={() => handlePointer("aprem_fin")} className="p-1 rounded hover:bg-blue-100 text-blue-400" title="Pointer">
                  <Timer className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </td>
          <td className="px-2 py-1.5 text-right">
            <div className="flex items-center justify-end gap-2">
              {total > 0 && (
                <span className="text-sm font-semibold text-gray-700">{formatMinutesToHuman(total)}</span>
              )}
              <button
                onClick={handleClearConge}
                className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors"
                title="Annuler le congé"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </td>
        </>
      ) : isCongeAprem ? (
        <>
          {/* Congé après-midi - afficher horaires matin */}
          <td className="px-1 py-1.5">
            <div className="flex items-center gap-1">
              <TimeInput value={heureData?.matin_debut || null} onChange={(v) => handleChange("matin_debut", v)} />
              {isToday && (
                <button onClick={() => handlePointer("matin_debut")} className="p-1 rounded hover:bg-blue-100 text-blue-400" title="Pointer">
                  <Timer className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </td>
          <td className="px-1 py-1.5">
            <div className="flex items-center gap-1">
              <TimeInput value={heureData?.matin_fin || null} onChange={(v) => handleChange("matin_fin", v)} />
              {isToday && (
                <button onClick={() => handlePointer("matin_fin")} className="p-1 rounded hover:bg-blue-100 text-blue-400" title="Pointer">
                  <Timer className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </td>
          <td colSpan={2} className="px-1 py-1.5">
            <span className="text-sm text-indigo-600 font-medium flex items-center gap-1">
              <Moon className="h-4 w-4" />
              Congé après-midi
            </span>
          </td>
          <td className="px-2 py-1.5 text-right">
            <div className="flex items-center justify-end gap-2">
              {total > 0 && (
                <span className="text-sm font-semibold text-gray-700">{formatMinutesToHuman(total)}</span>
              )}
              <button
                onClick={handleClearConge}
                className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors"
                title="Annuler le congé"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </td>
        </>
      ) : (
        <>
          {/* Matin */}
          <td className="px-1 py-1.5">
            <div className="flex items-center gap-1">
              <TimeInput value={heureData?.matin_debut || null} onChange={(v) => handleChange("matin_debut", v)} />
              {isToday && (
                <button onClick={() => handlePointer("matin_debut")} className="p-1 rounded hover:bg-blue-100 text-blue-400" title="Pointer">
                  <Timer className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </td>
          <td className="px-1 py-1.5">
            <div className="flex items-center gap-1">
              <TimeInput value={heureData?.matin_fin || null} onChange={(v) => handleChange("matin_fin", v)} />
              {isToday && (
                <button onClick={() => handlePointer("matin_fin")} className="p-1 rounded hover:bg-blue-100 text-blue-400" title="Pointer">
                  <Timer className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </td>
          {/* Après-midi */}
          <td className="px-1 py-1.5">
            <div className="flex items-center gap-1">
              <TimeInput value={heureData?.aprem_debut || null} onChange={(v) => handleChange("aprem_debut", v)} />
              {isToday && (
                <button onClick={() => handlePointer("aprem_debut")} className="p-1 rounded hover:bg-blue-100 text-blue-400" title="Pointer">
                  <Timer className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </td>
          <td className="px-1 py-1.5">
            <div className="flex items-center gap-1">
              <TimeInput value={heureData?.aprem_fin || null} onChange={(v) => handleChange("aprem_fin", v)} />
              {isToday && (
                <button onClick={() => handlePointer("aprem_fin")} className="p-1 rounded hover:bg-blue-100 text-blue-400" title="Pointer">
                  <Timer className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </td>
          {/* Total + Congé Dropdown */}
          <td className="px-2 py-1.5 text-right">
            <div className="flex items-center justify-end gap-2">
              {total > 0 && (
                <span className="text-sm font-semibold text-gray-700">{formatMinutesToHuman(total)}</span>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-1 rounded hover:bg-emerald-100 text-gray-300 hover:text-emerald-600 transition-colors"
                    title="Poser un congé"
                  >
                    <Palmtree className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => handleSetConge("conge")} className="gap-2">
                    <Palmtree className="h-4 w-4 text-emerald-600" />
                    <span>Journée</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSetConge("conge_matin")} className="gap-2">
                    <Sun className="h-4 w-4 text-amber-500" />
                    <span>Matin</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSetConge("conge_aprem")} className="gap-2">
                    <Moon className="h-4 w-4 text-indigo-500" />
                    <span>Après-midi</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </td>
        </>
      )}
    </tr>
  );
}

// Bloc semaine (tableau)
function WeekTable({
  weekNum,
  days,
  heuresMap,
  onUpdate,
  onSetConge,
  onClearConge,
  weekData,
  today,
  joursFeriesMap,
}: {
  weekNum: number;
  days: Date[];
  heuresMap: Map<string, HeuresJournalieres>;
  onUpdate: (date: string, jour: JourSemaine, field: string, value: string | null) => void;
  onSetConge: (date: string, jour: JourSemaine, type: TypeConge) => void;
  onClearConge: (date: string, jour: JourSemaine) => void;
  weekData?: { travaille: number; base: number; sup: number };
  today: string;
  joursFeriesMap: Map<string, JourFerie>;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-4 py-2 flex items-center justify-between">
        <span className="text-sm font-bold text-white">Semaine {weekNum}</span>
        {weekData && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-300">{formatMinutesToHuman(weekData.travaille)}</span>
            <span className={cn(
              "text-xs font-bold px-2 py-0.5 rounded-full",
              weekData.sup >= 0 ? "bg-emerald-400/20 text-emerald-300" : "bg-red-400/20 text-red-300"
            )}>
              {weekData.sup >= 0 ? "+" : ""}{formatMinutesToHuman(weekData.sup)}
            </span>
          </div>
        )}
      </div>

      {/* Table */}
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
            <th className="px-2 py-1.5 text-left font-medium w-12">Jour</th>
            <th className="px-2 py-1.5 text-left font-medium w-10">#</th>
            <th className="px-1 py-1.5 text-center font-medium" colSpan={2}>Matin</th>
            <th className="px-1 py-1.5 text-center font-medium" colSpan={2}>Après-midi</th>
            <th className="px-2 py-1.5 text-right font-medium w-20">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {days.map((day) => {
            const dateStr = formatDateStr(day);
            return (
              <DayRow
                key={dateStr}
                date={day}
                isToday={dateStr === today}
                heureData={heuresMap.get(dateStr) || null}
                onUpdate={onUpdate}
                onSetConge={onSetConge}
                onClearConge={onClearConge}
                jourFerie={joursFeriesMap.get(dateStr)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function HeuresSupplementaires() {
  const profile = useAuthStore((state) => state.profile);
  const { isAdmin } = useEffectiveRole();

  const now = new Date();
  const todayStr = formatDateStr(now);
  const [annee, setAnnee] = useState(now.getFullYear());
  const [mois, setMois] = useState(now.getMonth() + 1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const { data: horairesBase } = useHorairesBase(selectedUserId || undefined);
  const effectiveHoraires = horairesBase || HORAIRES_BASE_DEFAUT;

  const { data: feuille, isLoading } = useFeuilleTemps(annee, mois, selectedUserId || undefined);
  const { data: allFeuilles } = useAllFeuillesTemps(annee, mois);
  const { data: allProfiles } = useProfiles();
  const { data: joursFeries } = useJoursFeries(annee, mois);

  const updateHeure = useUpdateHeureJournaliere();
  const initialiserMois = useInitialiserMois();

  const joursFeriesMap = useMemo(() => {
    const map = new Map<string, JourFerie>();
    joursFeries?.forEach((jf) => map.set(jf.date, jf));
    return map;
  }, [joursFeries]);

  useEffect(() => {
    if (feuille && feuille.heures.length === 0 && !initialiserMois.isPending) {
      initialiserMois.mutate({
        feuilleId: feuille.id,
        annee,
        mois,
        horairesBase: effectiveHoraires,
      });
    }
  }, [feuille?.id, feuille?.heures.length]);

  const weeks = useMemo(() => getWeeksOfMonth(annee, mois), [annee, mois]);
  const weekNumbers = useMemo(() => weeks.map(w => w.weekNum), [weeks]);

  const heuresMap = useMemo(() => {
    const map = new Map<string, HeuresJournalieres>();
    feuille?.heures?.forEach((h) => map.set(h.date, h));
    return map;
  }, [feuille?.heures]);

  const totaux = useMemo(() => {
    if (!feuille?.heures) return { totalTravaille: 0, totalBase: 0, heuresSup: 0, parSemaine: {} };
    return calculateMonthlyHoursSup(feuille.heures, effectiveHoraires);
  }, [feuille?.heures, effectiveHoraires]);

  const handleUpdate = (date: string, jour: JourSemaine, field: string, value: string | null) => {
    if (!feuille) return;
    updateHeure.mutate({
      feuilleId: feuille.id,
      date,
      jourSemaine: jour,
      data: { [field]: value },
    });
  };

  // Poser un congé (journée complète ou demi-journée)
  const handleSetConge = (date: string, jour: JourSemaine, type: TypeConge) => {
    if (!feuille) return;

    // Pour une journée complète, on efface les horaires
    // Pour une demi-journée, on garde les horaires de l'autre demi-journée
    const updates: Record<string, string | null> = {
      type_absence: type,
    };

    if (type === "conge") {
      // Journée complète : effacer tous les horaires
      updates.matin_debut = null;
      updates.matin_fin = null;
      updates.aprem_debut = null;
      updates.aprem_fin = null;
    } else if (type === "conge_matin") {
      // Congé matin : effacer les horaires du matin, garder après-midi
      updates.matin_debut = null;
      updates.matin_fin = null;
    } else if (type === "conge_aprem") {
      // Congé après-midi : effacer les horaires de l'après-midi, garder matin
      updates.aprem_debut = null;
      updates.aprem_fin = null;
    }

    updateHeure.mutate({
      feuilleId: feuille.id,
      date,
      jourSemaine: jour,
      data: updates,
    });
  };

  // Annuler un congé et réinitialiser les horaires par défaut
  const handleClearConge = (date: string, jour: JourSemaine) => {
    if (!feuille) return;

    // Récupérer les horaires par défaut pour ce jour
    const horairesJour = effectiveHoraires[jour as keyof typeof effectiveHoraires];

    updateHeure.mutate({
      feuilleId: feuille.id,
      date,
      jourSemaine: jour,
      data: {
        type_absence: null,
        matin_debut: horairesJour?.matin?.debut || null,
        matin_fin: horairesJour?.matin?.fin || null,
        aprem_debut: horairesJour?.aprem?.debut || null,
        aprem_fin: horairesJour?.aprem?.fin || null,
      },
    });
  };

  // Liste de tous les utilisateurs (sauf moi) pour les filtres admin
  const users = useMemo(() => {
    if (!allProfiles || !profile) return [];
    return allProfiles.filter((u) => u.id !== profile.id);
  }, [allProfiles, profile]);

  const getPrenom = (name: string) => name.split(" ")[0];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-5 text-white shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-2.5">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Heures supplémentaires</h1>
              <p className="text-blue-200 text-xs">Comptabilisation mensuelle</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl p-1">
              <button
                onClick={() => mois === 1 ? (setMois(12), setAnnee(annee - 1)) : setMois(mois - 1)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold min-w-[120px] text-center">
                {MOIS_LABELS[mois - 1]} {annee}
              </span>
              <button
                onClick={() => mois === 12 ? (setMois(1), setAnnee(annee + 1)) : setMois(mois + 1)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => feuille && initialiserMois.mutate({
                feuilleId: feuille.id,
                annee,
                mois,
                horairesBase: effectiveHoraires,
              })}
              disabled={initialiserMois.isPending || !feuille}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
              title="Réinitialiser le mois"
            >
              <RefreshCw className={cn("h-4 w-4", initialiserMois.isPending && "animate-spin")} />
            </button>
            {isAdmin && (
              <button
                onClick={() => setShowEmailModal(true)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-1.5"
                title="Envoyer par email"
              >
                <Mail className="h-4 w-4" />
                <span className="text-xs font-medium hidden sm:inline">Email</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <div className="text-blue-200 text-[10px] font-medium">Travaillées</div>
            <div className="text-xl font-bold">{formatMinutesToHuman(totaux.totalTravaille)}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <div className="text-blue-200 text-[10px] font-medium">Prévues</div>
            <div className="text-xl font-bold">{formatMinutesToHuman(totaux.totalBase)}</div>
          </div>
          <div className={cn("rounded-xl p-3", totaux.heuresSup >= 0 ? "bg-emerald-500/30" : "bg-red-500/30")}>
            <div className="text-[10px] font-medium flex items-center gap-1">
              {totaux.heuresSup >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              Total HS
            </div>
            <div className="text-xl font-bold">
              {totaux.heuresSup >= 0 ? "+" : ""}{formatMinutesToHuman(totaux.heuresSup)}
            </div>
          </div>
        </div>
      </div>

      {/* Onglets admin */}
      {isAdmin && users.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setSelectedUserId(null)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              !selectedUserId ? "bg-blue-600 text-white shadow" : "bg-white text-gray-600 hover:bg-gray-50 border"
            )}
          >
            Moi
          </button>
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => setSelectedUserId(u.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                selectedUserId === u.id ? "bg-blue-600 text-white shadow" : "bg-white text-gray-600 hover:bg-gray-50 border"
              )}
            >
              {getPrenom(u.full_name)}
            </button>
          ))}
        </div>
      )}

      {/* Légende */}
      <div className="flex items-center gap-4 text-[10px] text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-100 border border-blue-300" />
          <span>Aujourd'hui</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-amber-50 border border-amber-200" />
          <span>Férié</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200" />
          <span>Congé</span>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-6 text-gray-500">
          <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
          Chargement...
        </div>
      )}

      {/* Semaines en colonnes */}
      <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
        {weeks.map((week) => (
          <WeekTable
            key={week.weekNum}
            weekNum={week.weekNum}
            days={week.days}
            heuresMap={heuresMap}
            onUpdate={handleUpdate}
            onSetConge={handleSetConge}
            onClearConge={handleClearConge}
            weekData={totaux.parSemaine[week.weekNum]}
            today={todayStr}
            joursFeriesMap={joursFeriesMap}
          />
        ))}
      </div>

      {/* Vue équipe */}
      {isAdmin && allProfiles && allProfiles.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-gray-400" />
            <h3 className="font-semibold text-sm text-gray-700">Équipe</h3>
          </div>
          <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
            {allProfiles.map((u) => {
              // Trouver la feuille correspondante si elle existe
              const isMe = u.id === profile?.id;
              const userFeuille = isMe && !selectedUserId
                ? feuille
                : allFeuilles?.find((f) => f.user?.id === u.id);
              // Utiliser les horaires de base de l'utilisateur pour le calcul des congés
              const userHorairesBase = isMe && !selectedUserId
                ? effectiveHoraires
                : (userFeuille?.user?.horaires_base as typeof HORAIRES_BASE_DEFAUT | null) || HORAIRES_BASE_DEFAUT;
              const stats = userFeuille
                ? calculateMonthlyHoursSup(userFeuille.heures || [], userHorairesBase)
                : { heuresSup: 0 };
              return (
                <button
                  key={u.id}
                  onClick={() => setSelectedUserId(isMe ? null : u.id)}
                  className={cn(
                    "p-3 rounded-lg border transition-all text-left",
                    (isMe && !selectedUserId) || selectedUserId === u.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:bg-gray-50"
                  )}
                >
                  <div className="font-medium text-sm text-gray-900">
                    {getPrenom(u.full_name)}
                    {isMe && <span className="text-xs text-gray-400 ml-1">(moi)</span>}
                  </div>
                  <div className={cn("text-lg font-bold", stats.heuresSup >= 0 ? "text-emerald-600" : "text-red-600")}>
                    {userFeuille ? (
                      <>{stats.heuresSup >= 0 ? "+" : ""}{formatMinutesToHuman(stats.heuresSup)}</>
                    ) : (
                      <span className="text-gray-400 text-sm">Non initialisé</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal envoi email */}
      {isAdmin && (
        <EmailConfigModal
          isOpen={showEmailModal}
          onClose={() => setShowEmailModal(false)}
          annee={annee}
          mois={mois}
          semaines={weekNumbers}
        />
      )}
    </div>
  );
}
