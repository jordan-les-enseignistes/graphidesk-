// Fonds perdus intelligents — branchement de l'outil Adhésif (version de test) sur l'application :
// le déroulement du dialogue avec Illustrator est dans deroulement.ts ; ici, seulement les accès réels
// (commandes Tauri pour lancer le script et lire/écrire le dossier temporaire, calcul hors du fil de l'interface).
import { invoke } from "@tauri-apps/api/core";
import { calculerDepuisIllustrator } from "./illustrator.ts";
import { deroulerAdhesifAvecFondsPerdus, type BilanFondsPerdus, type ResultatCalcul } from "./deroulement.ts";

export type { BilanFondsPerdus };

/**
 * Calcule les correctifs hors du fil de l'interface (GraphiDesk reste fluide, l'avancement remonte au fur et à mesure).
 * Si le calcul en arrière-plan n'est pas disponible, il se fait sur place : même résultat, sans avancement.
 */
function calculer(geo: unknown, surProgression: (fraction: number) => void): Promise<ResultatCalcul> {
  return new Promise((resolve, reject) => {
    const surPlace = () => {
      try {
        resolve(calculerDepuisIllustrator(geo, surProgression));
      } catch (e) {
        reject(e);
      }
    };
    let ouvrier: Worker;
    try {
      ouvrier = new Worker(new URL("./calcul.worker.ts", import.meta.url), { type: "module" });
    } catch {
      surPlace();
      return;
    }
    // (deroulement.ts abandonne le calcul au bout de 3 minutes : on arrête alors vraiment le travail en arrière-plan)
    const arret = setTimeout(() => ouvrier.terminate(), 3 * 60 * 1000 + 5000);
    ouvrier.onmessage = (e) => {
      const m = e.data;
      if (m.type === "progression") surProgression(m.fraction);
      else {
        clearTimeout(arret);
        ouvrier.terminate();
        if (m.type === "fin") resolve(m.resultat);
        else reject(new Error(m.message));
      }
    };
    ouvrier.onerror = () => {
      clearTimeout(arret);
      ouvrier.terminate();
      surPlace();
    };
    ouvrier.postMessage(geo);
  });
}

/**
 * Lance l'automatisation adhésif puis la correction des fonds perdus.
 * `surEtape` reçoit un libellé à afficher pendant l'attente.
 */
export function lancerAdhesifAvecFondsPerdus(
  illustratorPath: string,
  params: object,
  surEtape: (libelle: string) => void,
): Promise<BilanFondsPerdus> {
  return deroulerAdhesifAvecFondsPerdus(
    {
      // (cette commande ne se termine qu'à la fin du script Illustrator : le déroulement ne l'attend pas)
      lancer: (p) => invoke<string>("run_illustrator_script", { illustratorPath, scriptName: "full_automation.jsx", params: JSON.stringify(p) }),
      lire: async (nom) => {
        const b64 = await invoke<string>("read_temp_binary", { fileName: nom });
        const octets = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        return JSON.parse(new TextDecoder("utf-8").decode(octets));
      },
      ecrire: (nom, contenu) => invoke("save_temp_file", { fileName: nom, content: contenu }),
      supprimer: (noms) => invoke("supprimer_temp", { fileNames: noms }),
      calculer,
    },
    params,
    surEtape,
  );
}
