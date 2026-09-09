/*
 * products.js
 * Définition des produits + génération du texte.
 *
 * Architecture "pilotée par configuration" : chaque produit décrit ses champs
 * (fields) sous forme de données, et fournit une fonction buildText(v).
 * -> C'est cette structure qui permettra, plus tard, de laisser les
 *    utilisateurs créer/moduler leurs propres produits sans réécrire le code.
 *
 * Types de champ supportés :
 *   - "dropdown" : { options:[...], default:"texte" }
 *   - "text"     : { default:"" , width? }
 *   - "checkbox" : { default:false }
 *
 * Propriétés optionnelles d'un champ :
 *   - visibleWhen(v)  : retourne true/false selon les autres valeurs
 *   - optionsFrom(v)  : (dropdown) recalcule dynamiquement la liste d'options
 *
 * Un produit peut définir :
 *   - derive(v, set, changedId) : ajuste des champs automatiquement
 *       (ex : cocher "plusieurs parties" si la dimension dépasse un seuil)
 *   - note(v) : texte d'information affiché sous les champs
 */

function qtySuffix(q) {
  var n = parseInt(q, 10);
  return (!isNaN(n) && n > 1) ? " - x " + q + " exemplaires" : "";
}

function num(x) {
  var n = parseInt(x, 10);
  return isNaN(n) ? null : n;
}

var PRODUCTS = {

  /* ----------------------------------------------------------------- PANNEAU */
  "Panneau": {
    label: "Panneau",
    fields: [
      { id: "matiere", label: "Matière :", type: "dropdown",
        options: ["Dibond", "PVC 3 mm", "PVC 5 mm", "Plexi transparent 3 mm",
                  "Plexi transparent 5 mm", "Plexi transparent 8 mm", "Akilux 3,5 mm"],
        default: "Dibond" },
      { id: "decoupe", label: "Découpe :", type: "dropdown",
        options: ["Découpe droite", "Découpe à la forme"], default: "Découpe droite" },
      { id: "largeur", label: "Largeur (mm) :", type: "text", group: "size" },
      { id: "hauteur", label: "Hauteur (mm) :", type: "text", group: "size" },
      { id: "multiple", label: "En plusieurs parties", type: "checkbox", default: false },
      { id: "option", label: "Option :", type: "dropdown",
        options: ["Laqué", "Adhésivé", "Sans option"], default: "Sans option" },
      { id: "ral", label: "RAL :", type: "text",
        visibleWhen: function (v) { return v.option === "Laqué"; } },
      { id: "adhOpt", label: "Adhésif :", type: "dropdown",
        options: ["Dos gris", "Teinté masse", "Transparent"], default: "Dos gris",
        visibleWhen: function (v) { return v.option === "Adhésivé"; } },
      { id: "bs", label: "Blanc de soutien :", type: "dropdown",
        options: ["Sans", "Blanc de soutien sélectif", "Blanc de soutien total"], default: "Sans",
        visibleWhen: function (v) { return v.option === "Adhésivé" && v.adhOpt === "Transparent"; } },
      { id: "lamination", label: "Lamination :", type: "dropdown",
        options: ["", "Mat", "Brillant", "Velleda"], default: "" },
      { id: "fixation", label: "Fixation :", type: "dropdown",
        options: ["Sans", "Entretoises", "Perforation", "Double face", "Sur lisses"], default: "Sans" },
      { id: "lissesRAL", label: "RAL :", type: "text",
        visibleWhen: function (v) { return v.fixation === "Sur lisses"; } },
      { id: "quantite", label: "Quantité :", type: "text", default: "1" }
    ],
    derive: function (v, set, changedId) {
      if (changedId === "largeur" || changedId === "hauteur") {
        var w = num(v.largeur), h = num(v.hauteur);
        set("multiple", (w !== null && w > 3000) || (h !== null && h > 3000));
      }
    },
    buildText: function (v) {
      var texte = "Panneau";
      texte += (v.matiere === "Dibond") ? " - Aluminium composite 3mm" : " - " + v.matiere;
      if (v.decoupe === "Découpe à la forme") texte += " - Découpé à la forme";
      if (v.largeur && v.hauteur) texte += " - " + v.largeur + " x " + v.hauteur + " mm";
      if (v.option === "Laqué" && v.ral) {
        texte += " - Laqué RAL " + v.ral;
      } else if (v.option === "Adhésivé") {
        if (v.adhOpt === "Teinté masse") texte += " - Adhésif teinté masse";
        else if (v.adhOpt === "Transparent") texte += " - Adhésif transparent";
        else texte += " - Adhésif occultant";
        if (v.adhOpt === "Transparent" && v.bs !== "Sans") texte += " - " + v.bs;
      }
      if (v.lamination !== "") texte += " - " + v.lamination;
      if (v.fixation === "Sur lisses") {
        texte += v.lissesRAL ? " - Sur lisses RAL " + v.lissesRAL : " - Sur lisses";
      } else if (v.fixation === "Perforation") {
        texte += " - Perforé";
      } else if (v.fixation === "Entretoises") {
        texte += " - Sur entretoises";
      } else if (v.fixation === "Double face") {
        texte += " - Fixation double-face";
      }
      if (v.multiple) texte += " - En plusieurs parties";
      texte += qtySuffix(v.quantite);
      return texte;
    }
  },

  /* ----------------------------------------------------------------- ADHÉSIF */
  "Adhésif": {
    label: "Adhésif",
    fields: [
      { id: "matiere", label: "Matière :", type: "dropdown",
        options: ["Dos gris", "Dos blanc", "Dépoli", "Dépoli imprimé", "Dépoli dégradé",
                  "Dépoli ajouré", "Colle renforcée", "Microperforé", "Teinté masse",
                  "Transparent", "Conformable"],
        default: "Dos gris" },
      { id: "bs", label: "Blanc de soutien :", type: "dropdown",
        options: ["Sans", "Blanc de soutien sélectif", "Blanc de soutien total"], default: "Sans",
        visibleWhen: function (v) { return v.matiere === "Transparent"; } },
      { id: "refTm", label: "Référence teinté masse :", type: "text",
        visibleWhen: function (v) { return v.matiere === "Teinté masse"; } },
      { id: "lamination", label: "Lamination :", type: "dropdown",
        options: ["Avec", "Sans"], default: "Avec" },
      { id: "typeLam", label: "Type de lamination :", type: "dropdown",
        options: ["Mat", "Brillant", "Velleda", "Spéciale sol antidérapant", "Anti UV"], default: "Mat",
        visibleWhen: function (v) { return v.lamination === "Avec"; } },
      { id: "decoupe", label: "Découpe :", type: "dropdown",
        options: ["droite", "à la forme"], default: "droite" },
      { id: "dimType", label: "Dimension :", type: "dropdown",
        options: ["Vitrine", "Adhésif"], default: "Vitrine",
        visibleWhen: function (v) { return v.decoupe === "à la forme"; } },
      { id: "largeur", label: "Largeur (mm) :", type: "text", group: "size" },
      { id: "hauteur", label: "Hauteur (mm) :", type: "text", group: "size" },
      { id: "multiple", label: "En plusieurs parties", type: "checkbox", default: false },
      { id: "pose", label: "Pose :", type: "dropdown",
        options: ["Extérieur", "Intérieur"], default: "Extérieur" },
      { id: "quantite", label: "Quantité :", type: "text", default: "1" }
    ],
    note: function (v) {
      return (v.decoupe === "à la forme") ? "Dimension vitrine" : "Dimension de l'adhésif";
    },
    derive: function (v, set, changedId) {
      // Matière "Dépoli..." -> pas de lamination
      if (changedId === "matiere" && /^Dépoli/.test(v.matiere)) {
        set("lamination", "Sans");
      }
      if (changedId === "largeur" || changedId === "hauteur" || changedId === "decoupe") {
        var w = num(v.largeur), h = num(v.hauteur);
        set("multiple", (w !== null && w > 1530) && (h !== null && h > 1530) && v.decoupe === "droite");
      }
    },
    buildText: function (v) {
      var texte;
      switch (v.matiere) {
        case "Dos gris":  texte = "Adhésif - Occultant"; break;
        case "Dos blanc": texte = "Adhésif - Diffusant"; break;
        default:          texte = "Adhésif - " + v.matiere; break;
      }
      if (v.matiere === "Teinté masse") texte += " " + v.refTm;
      if (v.matiere === "Transparent" && v.bs !== "Sans") texte += " - " + v.bs;
      if (v.lamination === "Sans") texte += " - Sans lamination";
      else if (v.typeLam === "Anti UV") texte += " - Lamination anti-UV";
      else texte += " - " + v.typeLam;
      texte += " - Découpe " + v.decoupe;
      if (v.largeur && v.hauteur) {
        var dim = v.largeur + " x " + v.hauteur + " mm";
        texte += (v.decoupe === "à la forme" && v.dimType === "Vitrine")
          ? " - Pour vitrine " + dim
          : " - " + dim;
      }
      if (v.multiple) texte += " - En plusieurs parties avec raccord";
      texte += (v.pose === "Extérieur") ? " - Pose en extérieur" : " - Pose en intérieur";
      texte += qtySuffix(v.quantite);
      return texte;
    }
  },

  /* ----------------------------------------------------------------- CAISSON */
  "Caisson": {
    label: "Caisson",
    fields: [
      { id: "typeCaisson", label: "Type de caisson :", type: "dropdown",
        options: ["Double-face", "Simple-face"], default: "Simple-face" },
      { id: "lumineux", label: "Lumineux", type: "checkbox", default: false },
      { id: "lumineuxOptions", label: "Si lumineux :", type: "dropdown",
        options: ["Ajourage à plat", "Ajourage relief"], default: "Ajourage à plat",
        visibleWhen: function (v) { return v.lumineux === true; } },
      { id: "largeur", label: "Largeur (mm) :", type: "text", group: "size" },
      { id: "hauteur", label: "Hauteur (mm) :", type: "text", group: "size" },
      { id: "multiple", label: "En plusieurs parties", type: "checkbox", default: false },
      { id: "epaisseur", label: "Épaisseur (mm) :", type: "text", default: "45" },
      { id: "option", label: "Option :", type: "dropdown",
        options: ["Laqué", "Adhésivé", "Sans option"], default: "Sans option" },
      { id: "ral", label: "RAL :", type: "text",
        visibleWhen: function (v) { return v.option === "Laqué"; } },
      { id: "adhOpt", label: "Adhésif :", type: "dropdown",
        options: ["Dos gris", "Teinté masse", "Transparent"], default: "Dos gris",
        visibleWhen: function (v) { return v.option === "Adhésivé"; } },
      { id: "lamination", label: "Lamination :", type: "dropdown",
        options: ["", "Mat", "Brillant"], default: "" },
      { id: "quantite", label: "Quantité :", type: "text", default: "1" }
      /* NOTE : la section "Potences" de la V5 n'était jamais affichée
         (poteGroup.visible restait à false) et ne produisait donc aucun texte.
         Elle est volontairement omise ici pour un rendu identique. */
    ],
    derive: function (v, set, changedId) {
      if (changedId === "lumineux") {
        set("epaisseur", v.lumineux ? "70" : "45");   // 70 mm lumineux, 45 mm non lumineux
      }
      if (changedId === "largeur" || changedId === "hauteur") {
        var w = num(v.largeur), h = num(v.hauteur);
        set("multiple", (w !== null && w > 2860) || (h !== null && h > 2860));
      }
    },
    buildText: function (v) {
      var t = "Caisson - " + v.typeCaisson;
      if (v.largeur && v.hauteur) t += " - " + v.largeur + " x " + v.hauteur + " mm";
      if (v.multiple) t += " - En plusieurs parties";
      if (v.epaisseur) t += " - Épaisseur " + v.epaisseur + " mm";
      t += v.lumineux ? " - Lumineux" : " - Non lumineux";
      if (v.lumineux) {
        t += (v.lumineuxOptions === "Ajourage à plat")
          ? " - Ajourage à plat - Plexi contrecollé et rétro‑éclairage LED"
          : " - Ajourage relief";
      }
      if (v.option === "Laqué" && v.ral) {
        t += " - Laqué RAL " + v.ral;
      } else if (v.option === "Adhésivé") {
        t += (v.adhOpt === "Teinté masse") ? " - Adhésif teinté masse" : " - Adhésif occultant";
      }
      if (v.lamination !== "") t += " - " + v.lamination;
      t += qtySuffix(v.quantite);
      return t;
    }
  },

  /* --------------------------------------------------------- LETTRES RELIEFS */
  "Lettres reliefs": {
    label: "Lettres reliefs",
    fields: [
      { id: "matiere", label: "Matière :", type: "dropdown",
        options: ["Dibond 3mm", "PVC blanc", "PVC noir", "Lettres boitiers", "Lettres bloc LED"],
        default: "Dibond 3mm" },
      { id: "epaisseur", label: "Épaisseur :", type: "dropdown",
        options: ["3 mm", "Autres"], default: "3 mm",
        optionsFrom: function (v) {
          var ep;
          switch (v.matiere) {
            case "Dibond 3mm":       ep = ["3 mm"]; break;
            case "PVC blanc":        ep = ["3 mm", "5 mm", "10 mm", "19 mm", "38 mm"]; break;
            case "PVC noir":         ep = ["10 mm", "19 mm"]; break;
            case "Lettres boitiers": ep = ["30 mm", "60 mm", "100 mm"]; break;
            case "Lettres bloc LED": ep = ["30 mm"]; break;
            default:                 ep = []; break;
          }
          ep.push("Autres");
          return ep;
        } },
      { id: "epAutre", label: "Épaisseur (mm) :", type: "text",
        visibleWhen: function (v) { return v.epaisseur === "Autres"; } },
      { id: "lumineux", label: "Lumineux :", type: "dropdown",
        options: ["Non lumineux", "Lumineux"], default: "Non lumineux" },
      { id: "eclairage", label: "Éclairage :", type: "dropdown",
        options: ["Face avant lumineuse", "Rétro-éclairage", "Face avant et chant lumineux (Bloc LED)"],
        default: "Face avant lumineuse",
        visibleWhen: function (v) { return v.lumineux === "Lumineux"; } },
      { id: "option", label: "Option :", type: "dropdown",
        options: ["", "Face adhésivée", "Laquées"], default: "" },
      { id: "adhOpt", label: "Adhésif :", type: "dropdown",
        options: ["Dos gris", "Dos blanc"], default: "Dos gris",
        visibleWhen: function (v) { return v.option === "Face adhésivée"; } },
      { id: "ral", label: "RAL :", type: "text",
        visibleWhen: function (v) { return v.option === "Laquées"; } },
      { id: "largeur", label: "Largeur (mm) :", type: "text", group: "size" },
      { id: "hauteur", label: "Hauteur (mm) :", type: "text", group: "size" },
      { id: "lamination", label: "Lamination :", type: "dropdown",
        options: ["", "Mat", "Brillant"], default: "" },
      { id: "fixation", label: "Fixation :", type: "dropdown",
        options: ["Sans", "Entretoises", "Tige filetée", "Double face", "Sur lisses", "Vissée"],
        default: "Sans" },
      { id: "lissesRAL", label: "RAL :", type: "text",
        visibleWhen: function (v) { return v.fixation === "Sur lisses"; } },
      { id: "quantite", label: "Quantité :", type: "text", default: "1" }
    ],
    buildText: function (v) {
      var texte = "Lettres reliefs";
      switch (v.matiere) {
        case "Dibond 3mm": texte += " - Panneau aluminium composite"; break;
        case "PVC blanc":  texte += (v.option === "Laquées") ? " - PVC" : " - PVC Blanc"; break;
        case "PVC noir":   texte += " - PVC Noir"; break;
        case "Lettres boitiers": texte += " - Boitiers"; break;
        case "Lettres bloc LED": texte += " - Bloc LED"; break;
      }
      if (v.epaisseur === "Autres" && v.epAutre) texte += " - " + v.epAutre + " mm";
      else texte += " - " + v.epaisseur;
      if (v.lumineux === "Lumineux") {
        texte += " - Lumineuses";
        switch (v.eclairage) {
          case "Face avant lumineuse": texte += " - Éclairage face avant"; break;
          case "Rétro-éclairage":      texte += " - Éclairage par l'arrière (rétroéclairé)"; break;
          case "Face avant et chant lumineux (Bloc LED)": texte += " - Face et chant lumineux"; break;
        }
      } else {
        texte += " - Non lumineuses";
      }
      if (v.option === "Face adhésivée") {
        texte += " - Face adhésivée";
        texte += (v.adhOpt === "Dos gris")
          ? " - Adhésif occultant sur la face des lettres"
          : " - Adhésif diffusant sur la face des lettres";
      } else if (v.option === "Laquées" && v.ral) {
        texte += " - RAL " + v.ral;
      }
      if (v.largeur && v.hauteur) texte += " - " + v.largeur + "x" + v.hauteur + " mm";
      if (v.lamination !== "") texte += " - " + v.lamination;
      switch (v.fixation) {
        case "Entretoises":  texte += " - Sur entretoises"; break;
        case "Tige filetée": texte += " - Sur tiges filetées"; break;  /* corrigé : la V5 avait un espace parasite qui rendait ce cas inactif */
        case "Double face":  texte += " - Fixation double-face"; break;
        case "Sur lisses":   texte += v.lissesRAL ? " - Sur lisses RAL " + v.lissesRAL : " - Sur lisses"; break;
        case "Vissée":       texte += " - Vissées"; break;
      }
      texte += qtySuffix(v.quantite);
      return texte;
    }
  }
};

module.exports = { PRODUCTS: PRODUCTS };
