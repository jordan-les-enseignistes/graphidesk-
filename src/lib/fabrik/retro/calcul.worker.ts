// Lettres rétroéclairées — le calcul, hors du fil de l'interface (GraphiDesk reste fluide, l'avancement remonte).
//   reçoit : { etape, geo, parametres }
//   envoie : { type: "progression", fraction } … puis { type: "fin", resultat } ou { type: "erreur", message }
// @ts-nocheck
import { placerDepuisIllustrator, finaliserDepuisIllustrator } from "./illustrator.ts";

self.onmessage = (e) => {
  try {
    const { etape, geo, parametres } = e.data;
    let dernier = 0;
    const resultat = etape === "placer"
      ? placerDepuisIllustrator(geo, parametres, (fraction) => {
          const t = Date.now();
          if (t - dernier < 120 && fraction < 1) return;
          dernier = t;
          self.postMessage({ type: "progression", fraction });
        })
      : finaliserDepuisIllustrator(geo, parametres);
    self.postMessage({ type: "fin", resultat });
  } catch (erreur) {
    self.postMessage({ type: "erreur", message: erreur && erreur.message ? erreur.message : String(erreur) });
  }
};
