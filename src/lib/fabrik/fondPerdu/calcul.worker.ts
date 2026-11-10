// Fonds perdus intelligents — le calcul, hors du fil de l'interface.
//
// Le calcul peut durer plusieurs secondes sur un gros fichier : fait ici, il ne fige pas GraphiDesk et peut annoncer
// son avancement au fur et à mesure (barre de progression dans Illustrator).
//   reçoit : le relevé Illustrator
//   envoie : { type: "progression", fraction } … puis { type: "fin", resultat } ou { type: "erreur", message }
// @ts-nocheck
import { calculerDepuisIllustrator } from "./illustrator.ts";

self.onmessage = (e) => {
  try {
    let dernier = 0;
    const resultat = calculerDepuisIllustrator(e.data, (fraction) => {
      const t = Date.now();
      if (t - dernier < 120 && fraction < 1) return;            // pas plus de 8 annonces par seconde
      dernier = t;
      self.postMessage({ type: "progression", fraction });
    });
    self.postMessage({ type: "fin", resultat });
  } catch (erreur) {
    self.postMessage({ type: "erreur", message: erreur && erreur.message ? erreur.message : String(erreur) });
  }
};
