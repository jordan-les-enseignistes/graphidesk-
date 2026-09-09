/*
 * builtins-config.js
 * Versions ÉDITABLES (format configuration) des produits de base.
 * Sert uniquement à "Rendre modifiable" : on copie ces modèles dans le
 * catalogue utilisateur. Les produits de base hardcodés (products.js) restent
 * intacts et verrouillés.
 *
 * Conventions :
 * - un choix avec out vide ("") affiche son libellé ; un choix de libellé ""
 *   n'affiche rien (le bloc disparaît) -> sert aux mentions optionnelles.
 * - condition / dependsOn / autoFill référencent des IDENTIFIANTS de champ (f_*).
 *   On NE régénère PAS ces id à la copie (ils sont uniques dans le sous-produit).
 */

const BUILTIN_CONFIGS = {

  "Caisson": {
    name: "Caisson",
    fields: [
      { id: "f_type", label: "Type de caisson", type: "dropdown",
        options: [{ label: "Double-face", out: "" }, { label: "Simple-face", out: "" }] },
      { id: "f_larg", label: "Largeur", type: "text" },
      { id: "f_haut", label: "Hauteur", type: "text" },
      { id: "f_parts", label: "Plusieurs parties", type: "dropdown",
        options: [{ label: "", out: "" }, { label: "En plusieurs parties", out: "" }] },
      { id: "f_lum", label: "Lumineux", type: "dropdown",
        options: [{ label: "Non lumineux", out: "" }, { label: "Lumineux", out: "" }] },
      { id: "f_ep", label: "Épaisseur", type: "text",
        autoFill: { on: "f_lum", map: { "Lumineux": "70", "Non lumineux": "45" } } },
      { id: "f_ajour", label: "Ajourage", type: "dropdown",
        condition: { on: "f_lum", value: "Lumineux" },
        options: [
          { label: "Ajourage à plat", out: "Ajourage à plat - Plexi contrecollé et rétro‑éclairage LED" },
          { label: "Ajourage relief", out: "Ajourage relief" }
        ] },
      { id: "f_lam", label: "Lamination", type: "dropdown",
        options: [{ label: "", out: "" }, { label: "Mat", out: "" }, { label: "Brillant", out: "" }] },
      { id: "f_opt", label: "Option", type: "dropdown",
        options: [{ label: "Sans option", out: "" }, { label: "Laqué", out: "" }, { label: "Adhésivé", out: "" }] },
      { id: "f_ral", label: "RAL", type: "text",
        condition: { on: "f_opt", value: "Laqué" } },
      { id: "f_adh", label: "Adhésif", type: "dropdown",
        condition: { on: "f_opt", value: "Adhésivé" },
        options: [
          { label: "Dos gris", out: "Adhésif occultant" },
          { label: "Teinté masse", out: "Adhésif teinté masse" },
          { label: "Transparent", out: "Adhésif transparent" }
        ] },
      { id: "f_qty", label: "Quantité", type: "text" }
    ],
    template: [
      "Caisson",
      "{Type de caisson}",
      "{Largeur} x {Hauteur} mm",
      "{Plusieurs parties}",
      "Épaisseur {Épaisseur} mm",
      "{Lumineux}",
      "{Ajourage}",
      "{Lamination}",
      "Laqué RAL {RAL}",
      "{Adhésif}",
      "x {Quantité} exemplaires"
    ]
  },

  "Panneau": {
    name: "Panneau",
    fields: [
      { id: "f_matiere", label: "Matière", type: "dropdown",
        options: [
          { label: "Dibond", out: "Aluminium composite 3mm" },
          { label: "PVC 3 mm", out: "" },
          { label: "PVC 5 mm", out: "" },
          { label: "Plexi transparent 3 mm", out: "" },
          { label: "Plexi transparent 5 mm", out: "" },
          { label: "Plexi transparent 8 mm", out: "" },
          { label: "Akilux 3,5 mm", out: "" }
        ] },
      { id: "f_decoupe", label: "Découpe", type: "dropdown",
        options: [
          { label: "Découpe droite", out: " " },
          { label: "Découpe à la forme", out: "Découpé à la forme" }
        ] },
      { id: "f_larg", label: "Largeur", type: "text" },
      { id: "f_haut", label: "Hauteur", type: "text" },
      { id: "f_opt", label: "Option", type: "dropdown",
        options: [
          { label: "Sans option", out: "" },
          { label: "Laqué", out: "" },
          { label: "Adhésivé", out: "" }
        ] },
      { id: "f_ral", label: "RAL", type: "text",
        condition: { on: "f_opt", value: "Laqué" } },
      { id: "f_adh", label: "Adhésif", type: "dropdown",
        condition: { on: "f_opt", value: "Adhésivé" },
        options: [
          { label: "Dos gris", out: "Adhésif occultant" },
          { label: "Teinté masse", out: "Adhésif teinté masse" },
          { label: "Transparent", out: "Adhésif transparent" }
        ] },
      { id: "f_bs", label: "Blanc de soutien", type: "dropdown",
        condition: { on: "f_adh", value: "Transparent" },
        options: [
          { label: "Sans", out: " " },
          { label: "Blanc de soutien sélectif", out: "" },
          { label: "Blanc de soutien total", out: "" }
        ] },
      { id: "f_lam", label: "Lamination", type: "dropdown",
        options: [
          { label: "", out: "" },
          { label: "Mat", out: "" },
          { label: "Brillant", out: "" },
          { label: "Velleda", out: "" }
        ] },
      { id: "f_fix", label: "Fixation", type: "dropdown",
        options: [
          { label: "Sans", out: " " },
          { label: "Entretoises", out: "Sur entretoises" },
          { label: "Perforation", out: "Perforé" },
          { label: "Double face", out: "Fixation double-face" },
          { label: "Sur lisses", out: " " }
        ] },
      { id: "f_lissesRal", label: "RAL lisses", type: "text",
        condition: { on: "f_fix", value: "Sur lisses" } },
      { id: "f_parts", label: "Plusieurs parties", type: "dropdown",
        options: [{ label: "", out: "" }, { label: "En plusieurs parties", out: "" }] },
      { id: "f_qty", label: "Quantité", type: "text" }
    ],
    template: [
      "Panneau",
      "{Matière}",
      "{Découpe}",
      "{Largeur} x {Hauteur} mm",
      "Laqué RAL {RAL}",
      "{Adhésif}",
      "{Blanc de soutien}",
      "{Lamination}",
      "{Fixation}",
      "Sur lisses RAL {RAL lisses}",
      "{Plusieurs parties}",
      "x {Quantité} exemplaires"
    ]
  },

  "Adhésif": {
    name: "Adhésif",
    fields: [
      { id: "f_matiere", label: "Matière", type: "dropdown",
        options: [
          { label: "Dos gris", out: "Occultant" },
          { label: "Dos blanc", out: "Diffusant" },
          { label: "Dépoli", out: "" },
          { label: "Dépoli imprimé", out: "" },
          { label: "Dépoli dégradé", out: "" },
          { label: "Dépoli ajouré", out: "" },
          { label: "Colle renforcée", out: "" },
          { label: "Microperforé", out: "" },
          { label: "Teinté masse", out: " " },
          { label: "Transparent", out: "" },
          { label: "Conformable", out: "" }
        ] },
      { id: "f_refTm", label: "Référence teinté masse", type: "text",
        condition: { on: "f_matiere", value: "Teinté masse" } },
      { id: "f_bs", label: "Blanc de soutien", type: "dropdown",
        condition: { on: "f_matiere", value: "Transparent" },
        options: [
          { label: "Sans", out: " " },
          { label: "Blanc de soutien sélectif", out: "" },
          { label: "Blanc de soutien total", out: "" }
        ] },
      { id: "f_lam", label: "Lamination", type: "dropdown",
        options: [
          { label: "Mat", out: "" },
          { label: "Brillant", out: "" },
          { label: "Velleda", out: "" },
          { label: "Spéciale sol antidérapant", out: "" },
          { label: "Anti UV", out: "Lamination anti-UV" },
          { label: "Sans", out: "Sans lamination" }
        ] },
      { id: "f_decoupe", label: "Découpe", type: "dropdown",
        options: [
          { label: "droite", out: "Découpe droite" },
          { label: "à la forme", out: "Découpe à la forme" }
        ] },
      { id: "f_dimType", label: "Type dimension", type: "dropdown",
        condition: { on: "f_decoupe", value: "à la forme" },
        options: [{ label: "Vitrine", out: "" }, { label: "Adhésif", out: "" }] },
      { id: "f_dimVitrine", label: "Dim vitrine", type: "text",
        condition: { on: "f_dimType", value: "Vitrine" } },
      { id: "f_dimAdh", label: "Dim forme adhésif", type: "text",
        condition: { on: "f_dimType", value: "Adhésif" } },
      { id: "f_dimDroite", label: "Dim droite", type: "text",
        condition: { on: "f_decoupe", value: "droite" } },
      { id: "f_parts", label: "Plusieurs parties", type: "dropdown",
        options: [{ label: "", out: "" }, { label: "En plusieurs parties avec raccord", out: "" }] },
      { id: "f_pose", label: "Pose", type: "dropdown",
        options: [
          { label: "Extérieur", out: "Pose en extérieur" },
          { label: "Intérieur", out: "Pose en intérieur" }
        ] },
      { id: "f_qty", label: "Quantité", type: "text" }
    ],
    template: [
      "Adhésif",
      "{Matière}",
      "Teinté masse {Référence teinté masse}",
      "{Blanc de soutien}",
      "{Lamination}",
      "{Découpe}",
      "Pour vitrine {Dim vitrine}",
      "{Dim forme adhésif}",
      "{Dim droite}",
      "{Plusieurs parties}",
      "{Pose}",
      "x {Quantité} exemplaires"
    ]
  },

  "Lettres reliefs": {
    name: "Lettres reliefs",
    fields: [
      { id: "f_matiere", label: "Matière", type: "dropdown",
        dependsOn: "f_opt",
        optionGroups: {
          "": [
            { label: "Dibond 3mm", out: "Panneau aluminium composite" },
            { label: "PVC blanc", out: "PVC Blanc" },
            { label: "PVC noir", out: "PVC Noir" },
            { label: "Lettres boitiers", out: "Boitiers" },
            { label: "Lettres bloc LED", out: "Bloc LED" }
          ],
          "Face adhésivée": [
            { label: "Dibond 3mm", out: "Panneau aluminium composite" },
            { label: "PVC blanc", out: "PVC Blanc" },
            { label: "PVC noir", out: "PVC Noir" },
            { label: "Lettres boitiers", out: "Boitiers" },
            { label: "Lettres bloc LED", out: "Bloc LED" }
          ],
          "Laquées": [
            { label: "Dibond 3mm", out: "Panneau aluminium composite" },
            { label: "PVC blanc", out: "PVC" },
            { label: "PVC noir", out: "PVC Noir" },
            { label: "Lettres boitiers", out: "Boitiers" },
            { label: "Lettres bloc LED", out: "Bloc LED" }
          ]
        } },
      { id: "f_ep", label: "Épaisseur", type: "text" },
      { id: "f_lum", label: "Lumineux", type: "dropdown",
        options: [
          { label: "Non lumineux", out: "Non lumineuses" },
          { label: "Lumineux", out: "Lumineuses" }
        ] },
      { id: "f_eclairage", label: "Éclairage", type: "dropdown",
        condition: { on: "f_lum", value: "Lumineux" },
        options: [
          { label: "Face avant lumineuse", out: "Éclairage face avant" },
          { label: "Rétro-éclairage", out: "Éclairage par l'arrière (rétroéclairé)" },
          { label: "Face avant et chant lumineux (Bloc LED)", out: "Face et chant lumineux" }
        ] },
      { id: "f_opt", label: "Option", type: "dropdown",
        options: [
          { label: "", out: "" },
          { label: "Face adhésivée", out: "Face adhésivée" },
          { label: "Laquées", out: " " }
        ] },
      { id: "f_adh", label: "Adhésif", type: "dropdown",
        condition: { on: "f_opt", value: "Face adhésivée" },
        options: [
          { label: "Dos gris", out: "Adhésif occultant sur la face des lettres" },
          { label: "Dos blanc", out: "Adhésif diffusant sur la face des lettres" }
        ] },
      { id: "f_ral", label: "RAL", type: "text",
        condition: { on: "f_opt", value: "Laquées" } },
      { id: "f_larg", label: "Largeur", type: "text" },
      { id: "f_haut", label: "Hauteur", type: "text" },
      { id: "f_lam", label: "Lamination", type: "dropdown",
        options: [{ label: "", out: "" }, { label: "Mat", out: "" }, { label: "Brillant", out: "" }] },
      { id: "f_fix", label: "Fixation", type: "dropdown",
        options: [
          { label: "Sans", out: " " },
          { label: "Entretoises", out: "Sur entretoises" },
          { label: "Tige filetée", out: "Sur tiges filetées" },
          { label: "Double face", out: "Fixation double-face" },
          { label: "Sur lisses", out: " " },
          { label: "Vissée", out: "Vissées" }
        ] },
      { id: "f_lissesRal", label: "RAL lisses", type: "text",
        condition: { on: "f_fix", value: "Sur lisses" } },
      { id: "f_qty", label: "Quantité", type: "text" }
    ],
    template: [
      "Lettres reliefs",
      "{Matière}",
      "{Épaisseur}",
      "{Lumineux}",
      "{Éclairage}",
      "{Option}",
      "{Adhésif}",
      "RAL {RAL}",
      "{Largeur}x{Hauteur} mm",
      "{Lamination}",
      "{Fixation}",
      "Sur lisses RAL {RAL lisses}",
      "x {Quantité} exemplaires"
    ]
  }

};

module.exports = { BUILTIN_CONFIGS: BUILTIN_CONFIGS };
