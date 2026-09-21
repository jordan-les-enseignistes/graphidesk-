/*
 * builtins-config.js
 * Les 4 produits de base, décrits en configuration.
 *
 * ⚠ SOURCE UNIQUE depuis la 6.2.0 (21/09/2026). Il existait auparavant une
 * seconde version, codée en dur (products.js), utilisée tant que le produit
 * n'avait pas été « rendu modifiable ». Les deux divergeaient sans que rien
 * ne le signale : le « Mat » d'un caisson sortait AVANT le RAL qu'il
 * qualifie dans l'une, après dans l'autre. Désormais le produit verrouillé et
 * sa copie modifiable passent par le même moteur (catalog.js).
 *
 * VERSION : à incrémenter à chaque changement de ces modèles. Au lancement,
 * les copies « rendues modifiables » d'une version antérieure sont
 * remplacées par la nouvelle (validé par Jordan le 21/09/2026) — sans quoi
 * aucune correction n'atteindrait les postes où la copie existe déjà.
 *
 * Conventions :
 * - un choix avec out vide ("") écrit son libellé ; un out " " n'écrit rien
 *   (le bloc disparaît) -> sert aux mentions optionnelles ;
 * - condition / dependsOn / autoFill / plusieursParties référencent des
 *   IDENTIFIANTS de champ (f_*), stables d'une version à l'autre ;
 * - syntaxe des modèles ([ … ] facultatif, A|B repli) : voir catalog.js.
 */

const BUILTIN_VERSION = 2;

/* Ordre d'affichage dans le menu Produit */
const BUILTIN_ORDRE = ["Panneau", "Adhésif", "Caisson", "Lettres reliefs"];

/* Blocs communs */
const DIMENSIONS = "{Largeur} x {Hauteur} mm[ {Dimension provisoire}]|(en attente de dimension)";
const QUANTITE = "x {Quantité} exemplaires";
const champsDimensions = function () {
  return [
    { id: "f_larg", label: "Largeur", type: "text" },
    { id: "f_haut", label: "Hauteur", type: "text" },
    { id: "f_dimProv", label: "Dimension provisoire", type: "checkbox", out: "(dimension provisoire)" }
  ];
};
/* « x 1 exemplaires » ne s'écrit pas : une seule pièce va de soi */
const champQuantite = function () {
  return { id: "f_qty", label: "Quantité", type: "text", default: "1", ignorer: ["", "0", "1"] };
};
/* Finition COLLÉE à ce qu'elle qualifie : « Laqué RAL 7016 mat » */
const champFinition = function (conditionValeurs, avecVelleda) {
  const options = [
    { label: "", out: "" },
    { label: "Mat", out: "mat" },
    { label: "Brillant", out: "brillant" }
  ];
  if (avecVelleda) options.push({ label: "Velleda", out: "Velleda" });
  return {
    id: "f_lam", label: "Lamination", type: "dropdown", options: options,
    condition: { on: "f_opt", values: conditionValeurs }
  };
};

const BUILTIN_CONFIGS = {

  /* ----------------------------------------------------------------- PANNEAU */
  "Panneau": {
    name: "Panneau",
    version: BUILTIN_VERSION,
    fields: [
      { id: "f_matiere", label: "Matière", type: "dropdown",
        options: [
          { label: "Dibond", out: "Aluminium composite 3 mm" },
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
        ] }
    ].concat(champsDimensions(), [
      { id: "f_parts", label: "En plusieurs parties", type: "checkbox",
        plusieursParties: { largeur: "f_larg", hauteur: "f_haut", long: 3050, court: 1500 } },
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
      champFinition(["Laqué", "Adhésivé"], true),
      { id: "f_fix", label: "Fixation", type: "dropdown",
        options: [
          { label: "Sans", out: " " },
          { label: "Entretoises", out: "Sur entretoises" },
          { label: "Perforation", out: "Perforé" },
          { label: "Double face", out: "Fixation double-face" },
          { label: "Sur lisses", out: "Sur lisses" },
          { label: "Vissé", out: "Vissé" }
        ] },
      { id: "f_lissesRal", label: "RAL lisses", type: "text",
        condition: { on: "f_fix", value: "Sur lisses" } },
      champQuantite()
    ]),
    template: [
      "Panneau",
      "{Matière}",
      "{Découpe}",
      DIMENSIONS,
      "Laqué RAL {RAL}[ {Lamination}]|Laqué RAL (à définir)[ {Lamination}]",
      "{Adhésif}[ {Lamination}] contrecollé",
      "{Blanc de soutien}",
      "{Fixation}[ RAL {RAL lisses}]",
      "{En plusieurs parties}",
      QUANTITE
    ]
  },

  /* ----------------------------------------------------------------- ADHÉSIF */
  "Adhésif": {
    name: "Adhésif",
    version: BUILTIN_VERSION,
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
          { label: "Teinté masse", out: "" },
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
      // le dépoli est le seul adhésif sans lamination : choisi d'office, modifiable
      { id: "f_lam", label: "Lamination", type: "dropdown",
        options: [
          { label: "Mat", out: "" },
          { label: "Brillant", out: "" },
          { label: "Velleda", out: "" },
          { label: "Spéciale sol antidérapant", out: "" },
          { label: "Anti UV", out: "Lamination anti-UV" },
          { label: "Sans", out: "Sans lamination" }
        ],
        autoFill: { on: "f_matiere", map: {
          "Dos gris": "Mat", "Dos blanc": "Mat",
          "Dépoli": "Sans", "Dépoli imprimé": "Sans", "Dépoli dégradé": "Sans", "Dépoli ajouré": "Sans",
          "Colle renforcée": "Mat", "Microperforé": "Mat", "Teinté masse": "Mat",
          "Transparent": "Mat", "Conformable": "Mat"
        } } },
      { id: "f_decoupe", label: "Découpe", type: "dropdown",
        options: [
          { label: "droite", out: "Découpe droite" },
          { label: "à la forme", out: "Découpe à la forme" }
        ] },
      { id: "f_dimType", label: "Dimension de", type: "dropdown",
        condition: { on: "f_decoupe", value: "à la forme" },
        options: [
          { label: "Vitrine", out: "Pour vitrine" },
          { label: "Adhésif", out: " " }
        ] }
    ].concat(champsDimensions(), [
      // rouleau de 1530 mm : une découpe droite plus large ET plus haute se raccorde
      { id: "f_parts", label: "En plusieurs parties avec raccord", type: "checkbox",
        plusieursParties: { largeur: "f_larg", hauteur: "f_haut", court: 1530,
                            seulSi: { on: "f_decoupe", value: "droite" } } },
      { id: "f_pose", label: "Pose", type: "dropdown",
        options: [
          { label: "Extérieur", out: "Pose en extérieur" },
          { label: "Intérieur", out: "Pose en intérieur" }
        ] },
      champQuantite()
    ]),
    template: [
      "Adhésif",
      "{Matière}[ {Référence teinté masse}]",
      "{Blanc de soutien}",
      "{Lamination}",
      "{Découpe}",
      "[{Dimension de} ]" + DIMENSIONS,
      "{En plusieurs parties avec raccord}",
      "{Pose}",
      QUANTITE
    ]
  },

  /* ----------------------------------------------------------------- CAISSON */
  "Caisson": {
    name: "Caisson",
    version: BUILTIN_VERSION,
    fields: [
      { id: "f_type", label: "Type de caisson", type: "dropdown",
        options: [{ label: "Simple-face", out: "" }, { label: "Double-face", out: "" }] }
    ].concat(champsDimensions(), [
      // plaque nécessaire = (largeur + 2 épaisseurs) x (hauteur + 2 épaisseurs) :
      // les retours pliés se prennent dans la même plaque
      { id: "f_parts", label: "En plusieurs parties", type: "checkbox",
        plusieursParties: { largeur: "f_larg", hauteur: "f_haut", epaisseur: "f_ep", long: 3050, court: 1500 } },
      { id: "f_lum", label: "Lumineux", type: "dropdown",
        options: [{ label: "Non lumineux", out: "" }, { label: "Lumineux", out: "" }] },
      { id: "f_ep", label: "Épaisseur", type: "text", default: "45",
        autoFill: { on: "f_lum", map: { "Lumineux": "70", "Non lumineux": "45" } } },
      { id: "f_ajour", label: "Éclairage", type: "dropdown",
        condition: { on: "f_lum", value: "Lumineux" },
        options: [
          { label: "Ajourage à plat", out: "Ajourage à plat - Plexi contrecollé - Rétroéclairage LED" },
          { label: "Ajourage relief", out: "Ajourage relief - PMMA 30 mm - Rétroéclairage LED" },
          { label: "Face plexi lumineuse", out: "Face plexi diffusant - Chant alu anodisé - Rétroéclairage LED" }
        ] },
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
      champFinition(["Laqué", "Adhésivé"], false),
      // un simple face se fixe au mur ; un double face (drapeau) sur potence
      { id: "f_fix", label: "Fixation", type: "dropdown", dependsOn: "f_type",
        optionGroups: {
          "Simple-face": [
            { label: "Sans", out: " " },
            { label: "Vissé", out: "Vissé" },
            { label: "Entretoises", out: "Sur entretoises" },
            { label: "Sur lisses", out: "Sur lisses" }
          ],
          "Double-face": [
            { label: "Sans", out: " " },
            { label: "Potence", out: "Sur potence" },
            { label: "Monopotence", out: "Sur monopotence" }
          ]
        } },
      { id: "f_fixRal", label: "RAL fixation", type: "text",
        condition: { on: "f_fix", values: ["Sur lisses", "Potence", "Monopotence"] } },
      champQuantite()
    ]),
    template: [
      "Caisson",
      "{Type de caisson}",
      DIMENSIONS,
      "{En plusieurs parties}",
      "Épaisseur {Épaisseur} mm",
      "{Lumineux}",
      "{Éclairage}",
      "Laqué RAL {RAL}[ {Lamination}]|Laqué RAL (à définir)[ {Lamination}]",
      "{Adhésif}[ {Lamination}] contrecollé",
      "{Fixation}[ RAL {RAL fixation}]",
      QUANTITE
    ]
  },

  /* --------------------------------------------------------- LETTRES RELIEFS */
  "Lettres reliefs": {
    name: "Lettres reliefs",
    version: BUILTIN_VERSION,
    fields: [
      { id: "f_matiere", label: "Matière", type: "dropdown",
        dependsOn: "f_opt",
        optionGroups: {
          "": [
            { label: "Dibond 3 mm", out: "Panneau aluminium composite" },
            { label: "PVC blanc", out: "PVC Blanc" },
            { label: "PVC noir", out: "PVC Noir" },
            { label: "Lettres boitiers", out: "Boitiers" },
            { label: "Lettres bloc LED", out: "Bloc LED" }
          ],
          "Face adhésivée": [
            { label: "Dibond 3 mm", out: "Panneau aluminium composite" },
            { label: "PVC blanc", out: "PVC Blanc" },
            { label: "PVC noir", out: "PVC Noir" },
            { label: "Lettres boitiers", out: "Boitiers" },
            { label: "Lettres bloc LED", out: "Bloc LED" }
          ],
          // laqué, un PVC blanc n'est plus blanc
          "Laquées": [
            { label: "Dibond 3 mm", out: "Panneau aluminium composite" },
            { label: "PVC blanc", out: "PVC" },
            { label: "PVC noir", out: "PVC Noir" },
            { label: "Lettres boitiers", out: "Boitiers" },
            { label: "Lettres bloc LED", out: "Bloc LED" }
          ]
        } },
      // épaisseurs disponibles selon la matière
      { id: "f_ep", label: "Épaisseur", type: "dropdown", dependsOn: "f_matiere",
        optionGroups: {
          "Dibond 3 mm": [{ label: "3 mm", out: "" }, { label: "Autres", out: " " }],
          "PVC blanc": [
            { label: "3 mm", out: "" }, { label: "5 mm", out: "" }, { label: "10 mm", out: "" },
            { label: "19 mm", out: "" }, { label: "38 mm", out: "" }, { label: "Autres", out: " " }
          ],
          "PVC noir": [{ label: "10 mm", out: "" }, { label: "19 mm", out: "" }, { label: "Autres", out: " " }],
          "Lettres boitiers": [
            { label: "30 mm", out: "" }, { label: "60 mm", out: "" }, { label: "100 mm", out: "" },
            { label: "Autres", out: " " }
          ],
          "Lettres bloc LED": [{ label: "30 mm", out: "" }, { label: "Autres", out: " " }]
        } },
      { id: "f_epAutre", label: "Autre épaisseur", type: "text",
        condition: { on: "f_ep", value: "Autres" } },
      { id: "f_lum", label: "Lumineux", type: "dropdown",
        options: [
          { label: "Non lumineux", out: "Non lumineuses" },
          { label: "Lumineux", out: "Lumineuses" }
        ] },
      { id: "f_eclairage", label: "Éclairage", type: "dropdown",
        condition: { on: "f_lum", value: "Lumineux" },
        options: [
          { label: "Face avant lumineuse", out: "Éclairage face avant" },
          { label: "Rétroéclairage", out: "Rétroéclairées" },
          { label: "Face avant et chant lumineux (Bloc LED)", out: "Face et chant lumineux" }
        ] },
      { id: "f_opt", label: "Option", type: "dropdown",
        options: [
          { label: "", out: "" },
          { label: "Face adhésivée", out: "" },
          { label: "Laquées", out: "" }
        ] },
      { id: "f_adh", label: "Adhésif", type: "dropdown",
        condition: { on: "f_opt", value: "Face adhésivée" },
        options: [
          { label: "Dos gris", out: "Adhésif occultant" },
          { label: "Dos blanc", out: "Adhésif diffusant" }
        ] },
      { id: "f_ral", label: "RAL", type: "text",
        condition: { on: "f_opt", value: "Laquées" } },
      champFinition(["Face adhésivée", "Laquées"], false),
      { id: "f_tranches", label: "RAL tranches", type: "text",
        condition: { on: "f_matiere", value: "Lettres boitiers" } }
    ].concat(champsDimensions(), [
      { id: "f_fix", label: "Fixation", type: "dropdown",
        options: [
          { label: "Sans", out: " " },
          { label: "Entretoises", out: "Sur entretoises" },
          { label: "Tige filetée", out: "Sur tiges filetées" },
          { label: "Double face", out: "Fixation double-face" },
          { label: "Sur lisses", out: "Sur lisses" },
          { label: "Vissée", out: "Vissées" }
        ] },
      { id: "f_lissesRal", label: "RAL lisses", type: "text",
        condition: { on: "f_fix", value: "Sur lisses" } },
      champQuantite()
    ]),
    template: [
      "Lettres reliefs",
      "{Matière}",
      "{Épaisseur}",
      "{Autre épaisseur} mm",
      "{Lumineux}",
      "{Éclairage}",
      "{Adhésif}[ {Lamination}] contrecollé sur la face",
      "Laquées RAL {RAL}[ {Lamination}]|Laquées RAL (à définir)[ {Lamination}]",
      "Tranches laquées RAL {RAL tranches}",
      DIMENSIONS,
      "{Fixation}[ RAL {RAL lisses}]",
      QUANTITE
    ]
  }

};

module.exports = {
  BUILTIN_CONFIGS: BUILTIN_CONFIGS,
  BUILTIN_VERSION: BUILTIN_VERSION,
  BUILTIN_ORDRE: BUILTIN_ORDRE
};
