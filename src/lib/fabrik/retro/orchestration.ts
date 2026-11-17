// Lettres rétroéclairées sur entretoises — branchement sur l'application (commandes Tauri, calcul en arrière-plan).
// Le déroulement du dialogue avec Illustrator est dans deroulement.ts.
import { invoke } from "@tauri-apps/api/core";
import { placerDepuisIllustrator, finaliserDepuisIllustrator } from "./illustrator.ts";
import { deroulerRetro, type BilanRetro, type EtapeRetro } from "./deroulement.ts";

export type { BilanRetro, EtapeRetro };

function calculer(etape: EtapeRetro, geo: unknown, parametres: object, surProgression: (f: number) => void): Promise<any> {
  return new Promise((resolve, reject) => {
    const surPlace = () => {
      try {
        resolve(etape === "placer" ? placerDepuisIllustrator(geo, parametres, surProgression) : finaliserDepuisIllustrator(geo, parametres));
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
    ouvrier.postMessage({ etape, geo, parametres });
  });
}

export function lancerRetro(
  illustratorPath: string,
  etape: EtapeRetro,
  parametres: object,
  pdp: object,
  surEtape: (libelle: string) => void,
): Promise<BilanRetro> {
  return deroulerRetro(
    {
      lancer: (p) => invoke<string>("run_illustrator_script", { illustratorPath, scriptName: "retro_entretoises.jsx", params: JSON.stringify(p) }),
      lire: async (nom) => {
        const b64 = await invoke<string>("read_temp_binary", { fileName: nom });
        const octets = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        return JSON.parse(new TextDecoder("utf-8").decode(octets));
      },
      ecrire: (nom, contenu) => invoke("save_temp_file", { fileName: nom, content: contenu }),
      supprimer: (noms) => invoke("supprimer_temp", { fileNames: noms }),
      calculer,
    },
    etape,
    parametres,
    pdp,
    surEtape,
  );
}
