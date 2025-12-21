import { useEffect, useRef } from "react";
import { useReunionSettings } from "./useReunions";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

// Mapping des jours de la semaine
const JOURS_MAP: Record<string, number> = {
  dimanche: 0,
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
};

// Clé localStorage pour suivre si la notification a déjà été envoyée aujourd'hui
const NOTIFICATION_SENT_KEY = "reunion_notification_sent_date";

export function useReunionNotification() {
  const { data: settings } = useReunionSettings();
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!settings) return;

    const checkAndNotify = async () => {
      const now = new Date();
      const currentDay = now.getDay();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // Récupérer le jour et l'heure de réunion
      const reunionDay = JOURS_MAP[settings.jour.toLowerCase()] ?? 2; // Mardi par défaut
      const [reunionHour, reunionMinute] = settings.heure
        .split(":")
        .map(Number);

      // Vérifier si c'est le bon jour
      if (currentDay !== reunionDay) return;

      // Vérifier si c'est la bonne heure (on notifie dans la minute exacte)
      if (currentHour !== reunionHour || currentMinute !== reunionMinute) return;

      // Vérifier si on a déjà envoyé la notification aujourd'hui
      const todayStr = now.toISOString().split("T")[0];
      const lastSentDate = localStorage.getItem(NOTIFICATION_SENT_KEY);
      if (lastSentDate === todayStr) return;

      // Envoyer la notification
      try {
        let permissionGranted = await isPermissionGranted();
        if (!permissionGranted) {
          const permission = await requestPermission();
          permissionGranted = permission === "granted";
        }

        if (permissionGranted) {
          await sendNotification({
            title: "Rappel Réunion",
            body: settings.message || `La réunion hebdomadaire commence maintenant ! (${settings.heure})`,
            sound: "default",
          });

          // Marquer comme envoyée
          localStorage.setItem(NOTIFICATION_SENT_KEY, todayStr);
        }
      } catch (error) {
        console.error("Erreur envoi notification réunion:", error);
      }
    };

    // Vérifier toutes les 30 secondes
    checkAndNotify();
    intervalRef.current = window.setInterval(checkAndNotify, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [settings]);
}

// Fonction utilitaire pour envoyer une notification de test
export async function sendTestNotification(message: string) {
  try {
    let permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      const permission = await requestPermission();
      permissionGranted = permission === "granted";
    }

    if (permissionGranted) {
      await sendNotification({
        title: "Rappel Réunion",
        body: message,
        sound: "default",
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error("Erreur envoi notification test:", error);
    return false;
  }
}
