import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useUserPreferencesStore } from "@/stores/userPreferencesStore";
import { useHorairesBase, useUpdateHorairesBase } from "@/hooks/useHeuresSupplementaires";
import { HORAIRES_BASE_DEFAUT, DEFAULT_PREFERENCES, BADGE_COLORS, type BadgeColorId } from "@/types/database";
import type { HorairesBase, JourSemaine, UserPreferences } from "@/types";
import { cn } from "@/lib/utils";
import { getBadgeClassName } from "@/lib/badgeColors";
import { User, Clock, Save, RotateCcw, Settings, Palette, Check, Lock, Eye, EyeOff, Sun } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { setMinimizeOnClose } from "@/lib/tauri";
import { useQueryClient } from "@tanstack/react-query";

const JOURS: { key: JourSemaine; label: string }[] = [
  { key: "lundi", label: "Lundi" },
  { key: "mardi", label: "Mardi" },
  { key: "mercredi", label: "Mercredi" },
  { key: "jeudi", label: "Jeudi" },
  { key: "vendredi", label: "Vendredi" },
  { key: "samedi", label: "Samedi" },
  { key: "dimanche", label: "Dimanche" },
];

function TimeInput({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
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

  return (
    <div className="flex items-center gap-0.5">
      <input
        type="text"
        value={hours}
        onChange={handleHoursChange}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder="--"
        className={cn(
          "w-10 text-center text-sm font-mono border border-gray-200 rounded px-1 py-1.5",
          "hover:border-blue-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 focus:outline-none transition-all",
          disabled && "bg-gray-100 cursor-not-allowed opacity-50"
        )}
      />
      <span className="text-gray-400 text-sm">:</span>
      <input
        type="text"
        value={minutes}
        onChange={handleMinutesChange}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder="--"
        className={cn(
          "w-10 text-center text-sm font-mono border border-gray-200 rounded px-1 py-1.5",
          "hover:border-blue-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 focus:outline-none transition-all",
          disabled && "bg-gray-100 cursor-not-allowed opacity-50"
        )}
      />
    </div>
  );
}

export default function MonProfil() {
  const profile = useAuthStore((state) => state.profile);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const queryClient = useQueryClient();
  const { data: horairesBase, isLoading } = useHorairesBase();
  const updateHoraires = useUpdateHorairesBase();
  const { highlightIntensity, setHighlightIntensity } = useUserPreferencesStore();

  const [localHoraires, setLocalHoraires] = useState<HorairesBase>(HORAIRES_BASE_DEFAUT);
  const [hasChanges, setHasChanges] = useState(false);

  // Préférences utilisateur
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [savingPreferences, setSavingPreferences] = useState(false);

  // Couleur du badge
  const [savingBadgeColor, setSavingBadgeColor] = useState(false);

  // Changement de mot de passe
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async () => {
    // Validations
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Le nouveau mot de passe doit contenir au moins 6 caractères");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }

    setChangingPassword(true);
    try {
      // D'abord, vérifier l'ancien mot de passe en tentant une connexion
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile?.email || "",
        password: currentPassword,
      });

      if (signInError) {
        toast.error("Mot de passe actuel incorrect");
        return;
      }

      // Ensuite, mettre à jour le mot de passe
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      // Réinitialiser les champs
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Mot de passe modifié avec succès");
    } catch (e) {
      console.error("Erreur changement mot de passe:", e);
      toast.error("Erreur lors du changement de mot de passe");
    } finally {
      setChangingPassword(false);
    }
  };

  // Charger les préférences depuis le profil
  useEffect(() => {
    if (profile?.preferences) {
      setPreferences(profile.preferences);
    } else {
      setPreferences(DEFAULT_PREFERENCES);
    }
  }, [profile?.preferences]);

  // Toggle préférence minimize on close
  const handleToggleMinimizeOnClose = async () => {
    const newValue = !preferences.minimize_on_close;
    const newPrefs = { ...preferences, minimize_on_close: newValue };

    setSavingPreferences(true);
    try {
      // Mettre à jour dans Supabase
      const { error } = await supabase
        .from("profiles")
        .update({ preferences: newPrefs })
        .eq("id", profile?.id);

      if (error) throw error;

      // Mettre à jour dans Tauri
      await setMinimizeOnClose(newValue);

      // Mettre à jour l'état local
      setPreferences(newPrefs);
      toast.success(
        newValue
          ? "La fermeture minimisera l'application"
          : "La fermeture quittera l'application"
      );
    } catch (e) {
      console.error("Erreur mise à jour préférences:", e);
      toast.error("Erreur lors de la sauvegarde des préférences");
    } finally {
      setSavingPreferences(false);
    }
  };

  // Initialiser avec les horaires de la base ou les défauts
  useEffect(() => {
    if (horairesBase) {
      setLocalHoraires(horairesBase);
    } else {
      setLocalHoraires(HORAIRES_BASE_DEFAUT);
    }
    setHasChanges(false);
  }, [horairesBase]);

  const updateJour = (jour: JourSemaine, periode: "matin" | "aprem", field: "debut" | "fin", value: string | null) => {
    setLocalHoraires((prev) => {
      const newHoraires = { ...prev };
      if (!newHoraires[jour]) {
        newHoraires[jour] = { matin: null, aprem: null };
      }

      if (value === null) {
        // Si on efface la valeur et que l'autre champ de la période est aussi vide, mettre toute la période à null
        const otherField = field === "debut" ? "fin" : "debut";
        const otherValue = newHoraires[jour]?.[periode]?.[otherField];
        if (!otherValue) {
          newHoraires[jour] = {
            ...newHoraires[jour],
            [periode]: null,
          };
        } else {
          newHoraires[jour] = {
            ...newHoraires[jour],
            [periode]: {
              ...newHoraires[jour]?.[periode],
              [field]: value,
            },
          };
        }
      } else {
        // Créer ou mettre à jour la période
        newHoraires[jour] = {
          ...newHoraires[jour],
          [periode]: {
            debut: newHoraires[jour]?.[periode]?.debut || null,
            fin: newHoraires[jour]?.[periode]?.fin || null,
            [field]: value,
          },
        };
      }
      return newHoraires;
    });
    setHasChanges(true);
  };

  const toggleJourTravaille = (jour: JourSemaine) => {
    setLocalHoraires((prev) => {
      const newHoraires = { ...prev };
      const currentJour = newHoraires[jour];

      // Si le jour a des horaires, on les supprime (jour non travaillé)
      if (currentJour?.matin || currentJour?.aprem) {
        newHoraires[jour] = { matin: null, aprem: null };
      } else {
        // Sinon on remet les horaires par défaut
        newHoraires[jour] = HORAIRES_BASE_DEFAUT[jour];
      }
      return newHoraires;
    });
    setHasChanges(true);
  };

  const handleSave = () => {
    updateHoraires.mutate(localHoraires, {
      onSuccess: () => {
        setHasChanges(false);
      },
    });
  };

  const handleReset = () => {
    setLocalHoraires(horairesBase || HORAIRES_BASE_DEFAUT);
    setHasChanges(false);
    toast.info("Modifications annulées");
  };

  const isJourTravaille = (jour: JourSemaine) => {
    const h = localHoraires[jour];
    return h?.matin || h?.aprem;
  };

  // Changer la couleur du badge
  const handleChangeBadgeColor = async (colorId: BadgeColorId) => {
    if (colorId === profile?.badge_color) return;

    setSavingBadgeColor(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ badge_color: colorId })
        .eq("id", profile?.id);

      if (error) throw error;

      // Rafraîchir le profil dans le store
      await refreshProfile();
      // Invalider le cache des profils pour mettre à jour partout
      queryClient.invalidateQueries({ queryKey: ["profiles"] });

      toast.success("Couleur du badge mise à jour");
    } catch (e) {
      console.error("Erreur mise à jour couleur badge:", e);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSavingBadgeColor(false);
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
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
          <User className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mon Profil</h1>
          <p className="text-sm text-gray-500">
            Gérez vos informations et vos horaires de travail
          </p>
        </div>
      </div>

      {/* Infos utilisateur */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Informations</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-gray-500">Nom complet</label>
            <p className="mt-1 text-gray-900">{profile?.full_name}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Email</label>
            <p className="mt-1 text-gray-900">{profile?.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Initiales</label>
            <p className="mt-1 text-gray-900">{profile?.initials}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Rôle</label>
            <p className="mt-1 text-gray-900 capitalize">{profile?.role}</p>
          </div>
        </div>
      </div>

      {/* Changement de mot de passe */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Changer mon mot de passe</h2>
        </div>

        <div className="space-y-4 max-w-md">
          {/* Mot de passe actuel */}
          <div>
            <label className="text-sm font-medium text-gray-700">Mot de passe actuel</label>
            <div className="relative mt-1">
              <input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Nouveau mot de passe */}
          <div>
            <label className="text-sm font-medium text-gray-700">Nouveau mot de passe</label>
            <div className="relative mt-1">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Minimum 6 caractères</p>
          </div>

          {/* Confirmer nouveau mot de passe */}
          <div>
            <label className="text-sm font-medium text-gray-700">Confirmer le nouveau mot de passe</label>
            <div className="relative mt-1">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Bouton sauvegarder */}
          <button
            onClick={handleChangePassword}
            disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
            className={cn(
              "w-full py-2 px-4 rounded-lg font-medium transition-colors",
              "bg-blue-600 text-white hover:bg-blue-700",
              "disabled:bg-gray-300 disabled:cursor-not-allowed"
            )}
          >
            {changingPassword ? "Modification en cours..." : "Modifier le mot de passe"}
          </button>
        </div>
      </div>

      {/* Couleur du badge */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Couleur de mon badge</h2>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Choisissez la couleur qui sera affichée sur votre badge d'initiales dans toute l'application.
        </p>

        <div className="flex items-center gap-4">
          {/* Aperçu du badge actuel */}
          <div className="flex items-center gap-3 pr-4 border-r border-gray-200">
            <span className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold",
              getBadgeClassName(profile?.badge_color)
            )}>
              {profile?.initials}
            </span>
            <span className="text-sm text-gray-500">Aperçu</span>
          </div>

          {/* Sélecteur de couleurs */}
          <div className="flex flex-wrap gap-2">
            {BADGE_COLORS.map((color) => {
              const isSelected = (profile?.badge_color ?? "blue") === color.id;
              return (
                <button
                  key={color.id}
                  onClick={() => handleChangeBadgeColor(color.id)}
                  disabled={savingBadgeColor}
                  className={cn(
                    "relative flex h-8 w-8 items-center justify-center rounded-full transition-all",
                    color.bg,
                    isSelected ? "ring-2 ring-offset-2 ring-gray-400" : "hover:scale-110",
                    savingBadgeColor && "opacity-50 cursor-not-allowed"
                  )}
                  title={color.label}
                >
                  {isSelected && (
                    <Check className={cn("h-4 w-4", color.text)} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Préférences application */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Préférences</h2>
        </div>

        <div className="space-y-6">
          {/* Intensité du surlignage */}
          <div className="py-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4 text-yellow-500" />
                <p className="font-medium text-gray-900">Intensité du surlignage</p>
              </div>
              <span className="text-sm font-medium text-gray-600">
                {highlightIntensity}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="10"
              value={highlightIntensity}
              onChange={(e) => setHighlightIntensity(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Aucun</span>
              <span>Fort</span>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Ajustez l'intensité des couleurs de fond dans "Mes Dossiers" selon votre écran.
            </p>
            {/* Aperçu */}
            <div className="mt-3 space-y-1">
              {[
                { label: "Urgent", rgb: "254, 202, 202" },
                { label: "A faire", rgb: "191, 219, 254" },
                { label: "Attente R.", rgb: "221, 214, 254" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="px-3 py-1.5 rounded text-sm"
                  style={{ backgroundColor: `rgba(${item.rgb}, ${highlightIntensity / 100})` }}
                >
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          {/* Option minimize on close */}
          <div className="flex items-center justify-between py-2 border-t pt-4">
            <div>
              <p className="font-medium text-gray-900">Minimiser au lieu de fermer</p>
              <p className="text-sm text-gray-500">
                Quand vous cliquez sur la croix, l'application sera réduite dans la barre des tâches au lieu de se fermer
              </p>
            </div>
            <button
              onClick={handleToggleMinimizeOnClose}
              disabled={savingPreferences}
              className={cn(
                "w-12 h-7 rounded-full transition-colors relative flex-shrink-0",
                preferences.minimize_on_close ? "bg-blue-600" : "bg-gray-200",
                savingPreferences && "opacity-50 cursor-not-allowed"
              )}
            >
              <span
                className={cn(
                  "absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform",
                  preferences.minimize_on_close ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Horaires de travail */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Horaires de travail par défaut</h2>
          </div>
          {hasChanges && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={updateHoraires.isPending}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {updateHoraires.isPending ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          )}
        </div>

        <p className="text-sm text-gray-500 mb-6">
          Ces horaires servent de base pour le calcul des heures supplémentaires.
          Ils sont utilisés pour pré-remplir les feuilles de temps mensuelles.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-2 text-sm font-medium text-gray-500 w-32">Jour</th>
                <th className="text-center py-3 px-2 text-sm font-medium text-gray-500" colSpan={2}>Matin</th>
                <th className="text-center py-3 px-2 text-sm font-medium text-gray-500" colSpan={2}>Après-midi</th>
                <th className="text-center py-3 px-2 text-sm font-medium text-gray-500 w-24">Travaillé</th>
              </tr>
              <tr className="border-b border-gray-100 text-xs text-gray-400">
                <th></th>
                <th className="py-1 px-2">Début</th>
                <th className="py-1 px-2">Fin</th>
                <th className="py-1 px-2">Début</th>
                <th className="py-1 px-2">Fin</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {JOURS.map(({ key, label }) => {
                const travaille = isJourTravaille(key);
                const isWeekend = key === "samedi" || key === "dimanche";
                return (
                  <tr
                    key={key}
                    className={cn(
                      "border-b border-gray-100",
                      isWeekend && "bg-gray-50"
                    )}
                  >
                    <td className="py-3 px-2">
                      <span className={cn(
                        "font-medium",
                        travaille ? "text-gray-900" : "text-gray-400"
                      )}>
                        {label}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <TimeInput
                        value={localHoraires[key]?.matin?.debut || null}
                        onChange={(v) => updateJour(key, "matin", "debut", v)}
                        disabled={!travaille}
                      />
                    </td>
                    <td className="py-3 px-2 text-center">
                      <TimeInput
                        value={localHoraires[key]?.matin?.fin || null}
                        onChange={(v) => updateJour(key, "matin", "fin", v)}
                        disabled={!travaille}
                      />
                    </td>
                    <td className="py-3 px-2 text-center">
                      <TimeInput
                        value={localHoraires[key]?.aprem?.debut || null}
                        onChange={(v) => updateJour(key, "aprem", "debut", v)}
                        disabled={!travaille}
                      />
                    </td>
                    <td className="py-3 px-2 text-center">
                      <TimeInput
                        value={localHoraires[key]?.aprem?.fin || null}
                        onChange={(v) => updateJour(key, "aprem", "fin", v)}
                        disabled={!travaille}
                      />
                    </td>
                    <td className="py-3 px-2 text-center">
                      <button
                        onClick={() => toggleJourTravaille(key)}
                        className={cn(
                          "w-10 h-6 rounded-full transition-colors relative",
                          travaille ? "bg-blue-600" : "bg-gray-200"
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform",
                            travaille ? "translate-x-5" : "translate-x-1"
                          )}
                        />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
