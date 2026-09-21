/*
 * tests/redaction.test.js — la rédaction des BAT, vérifiée hors InDesign.
 *
 *   node plugins/enseignistes-uxp/tests/redaction.test.js
 *
 * 1. SPÉCIFICATION : des saisies et la phrase EXACTE attendue, validées avec
 *    Jordan (21/09/2026). Toute modification des modèles doit les garder vraies
 *    ou les mettre à jour consciemment.
 * 2. BALAYAGE : toutes les combinaisons de listes et de cases de chaque produit,
 *    avec champs remplis ou vides ; aucune phrase ne doit être cassée
 *    (étiquette non remplacée, bloc vide, espace double, « undefined »…).
 * 3. MIGRATION : un catalogue d'ancienne version voit ses modèles de base
 *    remplacés, ses produits sur-mesure intacts.
 *
 * Remplace verify-builtins.js, qui comparait les deux moteurs d'écriture
 * (supprimés au profit d'un seul) — et ne vérifiait pas le Caisson.
 */

const Catalog = require("../catalog.js");
const { BUILTIN_CONFIGS, BUILTIN_VERSION } = require("../builtins-config.js");

/* ---------- simulation de la saisie (comme index.js) ---------- */
function saisir(nom, saisies) {
  const sub = BUILTIN_CONFIGS[nom];
  const v = Catalog.defaultValues(sub);
  const set = (id, val) => { v[id] = val; };
  const lire = () => v;
  const listesLiees = () => {
    // une liste dépendante garde son choix s'il existe encore, sinon le 1er
    sub.fields.forEach((f) => {
      if (!f.dependsOn) return;
      const opts = Catalog.fieldOptions(f, v).map(Catalog.optLabel);
      if (opts.indexOf(v[f.id]) < 0) v[f.id] = opts[0] || "";
    });
  };
  Catalog.appliquerAutomatismes(sub, v, null, set, lire);
  saisies.forEach(([id, val]) => {
    if (!sub.fields.some((f) => f.id === id)) throw new Error(nom + " : champ inconnu " + id);
    v[id] = val;
    Catalog.appliquerAutomatismes(sub, v, id, set, lire);
    listesLiees();
  });
  return Catalog.buildText(sub, v);
}

let echecs = 0, reussis = 0;
function attendu(nom, saisies, phrase) {
  const obtenu = saisir(nom, saisies);
  if (obtenu === phrase) { reussis++; return; }
  echecs++;
  console.log("✗ " + nom + " " + JSON.stringify(saisies));
  console.log("    attendu : " + phrase);
  console.log("    obtenu  : " + obtenu);
}

const D = [["f_larg", "1500"], ["f_haut", "500"]];

/* =================================================================== PANNEAU */
const P = "Panneau - Aluminium composite 3 mm";
attendu("Panneau", D, P + " - 1500 x 500 mm");
attendu("Panneau", [], P + " - (en attente de dimension)");
attendu("Panneau", [["f_larg", "1500"]], P + " - (en attente de dimension)");
attendu("Panneau", [...D, ["f_dimProv", true]], P + " - 1500 x 500 mm (dimension provisoire)");
attendu("Panneau", [["f_dimProv", true]], P + " - (en attente de dimension)");
attendu("Panneau", [...D, ["f_decoupe", "Découpe à la forme"]], P + " - Découpé à la forme - 1500 x 500 mm");
attendu("Panneau", [["f_matiere", "PVC 5 mm"], ...D], "Panneau - PVC 5 mm - 1500 x 500 mm");
// finition collée à ce qu'elle qualifie
attendu("Panneau", [...D, ["f_opt", "Laqué"], ["f_ral", "7016"], ["f_lam", "Mat"]], P + " - 1500 x 500 mm - Laqué RAL 7016 mat");
attendu("Panneau", [...D, ["f_opt", "Laqué"]], P + " - 1500 x 500 mm - Laqué RAL (à définir)");
attendu("Panneau", [...D, ["f_opt", "Laqué"], ["f_lam", "Brillant"]], P + " - 1500 x 500 mm - Laqué RAL (à définir) brillant");
attendu("Panneau", [...D, ["f_opt", "Adhésivé"], ["f_lam", "Mat"]], P + " - 1500 x 500 mm - Adhésif occultant mat contrecollé");
attendu("Panneau", [...D, ["f_opt", "Adhésivé"]], P + " - 1500 x 500 mm - Adhésif occultant contrecollé");
attendu("Panneau", [...D, ["f_opt", "Adhésivé"], ["f_adh", "Transparent"], ["f_bs", "Blanc de soutien sélectif"]],
  P + " - 1500 x 500 mm - Adhésif transparent contrecollé - Blanc de soutien sélectif");
// un blanc de soutien resté choisi ne s'écrit pas sur un produit laqué
attendu("Panneau", [...D, ["f_opt", "Adhésivé"], ["f_adh", "Transparent"], ["f_bs", "Blanc de soutien total"],
  ["f_opt", "Laqué"], ["f_ral", "9005"]], P + " - 1500 x 500 mm - Laqué RAL 9005");
// sans option, la lamination ne qualifie rien : elle ne s'écrit pas
attendu("Panneau", [...D, ["f_lam", "Mat"]], P + " - 1500 x 500 mm");
attendu("Panneau", [...D, ["f_fix", "Sur lisses"]], P + " - 1500 x 500 mm - Sur lisses");
attendu("Panneau", [...D, ["f_fix", "Sur lisses"], ["f_lissesRal", "7016"]], P + " - 1500 x 500 mm - Sur lisses RAL 7016");
attendu("Panneau", [...D, ["f_fix", "Vissé"]], P + " - 1500 x 500 mm - Vissé");
attendu("Panneau", [...D, ["f_fix", "Entretoises"]], P + " - 1500 x 500 mm - Sur entretoises");
attendu("Panneau", [...D, ["f_qty", "1"]], P + " - 1500 x 500 mm");
attendu("Panneau", [...D, ["f_qty", "3"]], P + " - 1500 x 500 mm - x 3 exemplaires");
// plusieurs parties : > 3050 d'un côté, ou > 1500 des deux
attendu("Panneau", [["f_larg", "2000"], ["f_haut", "2000"]], P + " - 2000 x 2000 mm - En plusieurs parties");
attendu("Panneau", [["f_larg", "3100"], ["f_haut", "400"]], P + " - 3100 x 400 mm - En plusieurs parties");
attendu("Panneau", [["f_larg", "3000"], ["f_haut", "1400"]], P + " - 3000 x 1400 mm");
attendu("Panneau", [["f_larg", "1500"], ["f_haut", "1500"]], P + " - 1500 x 1500 mm");
attendu("Panneau", [["f_larg", "2000"], ["f_haut", "2000"], ["f_parts", false]], P + " - 2000 x 2000 mm");
attendu("Panneau", [...D, ["f_opt", "Adhésivé"], ["f_lam", "Velleda"], ["f_fix", "Perforation"], ["f_qty", "2"]],
  P + " - 1500 x 500 mm - Adhésif occultant Velleda contrecollé - Perforé - x 2 exemplaires");

/* =================================================================== ADHÉSIF */
const DA = [["f_larg", "500"], ["f_haut", "300"]];
attendu("Adhésif", DA, "Adhésif - Occultant - Mat - Découpe droite - 500 x 300 mm - Pose en extérieur");
attendu("Adhésif", [], "Adhésif - Occultant - Mat - Découpe droite - (en attente de dimension) - Pose en extérieur");
attendu("Adhésif", [...DA, ["f_dimProv", true]], "Adhésif - Occultant - Mat - Découpe droite - 500 x 300 mm (dimension provisoire) - Pose en extérieur");
attendu("Adhésif", [["f_matiere", "Dos blanc"], ...DA, ["f_pose", "Intérieur"]], "Adhésif - Diffusant - Mat - Découpe droite - 500 x 300 mm - Pose en intérieur");
attendu("Adhésif", [["f_matiere", "Teinté masse"], ...DA], "Adhésif - Teinté masse - Mat - Découpe droite - 500 x 300 mm - Pose en extérieur");
attendu("Adhésif", [["f_matiere", "Teinté masse"], ["f_refTm", "8300-043"], ...DA], "Adhésif - Teinté masse 8300-043 - Mat - Découpe droite - 500 x 300 mm - Pose en extérieur");
attendu("Adhésif", [["f_matiere", "Transparent"], ["f_bs", "Blanc de soutien total"], ...DA], "Adhésif - Transparent - Blanc de soutien total - Mat - Découpe droite - 500 x 300 mm - Pose en extérieur");
// le dépoli est le seul sans lamination
attendu("Adhésif", [["f_matiere", "Dépoli"], ...DA], "Adhésif - Dépoli - Sans lamination - Découpe droite - 500 x 300 mm - Pose en extérieur");
attendu("Adhésif", [["f_matiere", "Dépoli imprimé"], ...DA], "Adhésif - Dépoli imprimé - Sans lamination - Découpe droite - 500 x 300 mm - Pose en extérieur");
attendu("Adhésif", [["f_matiere", "Dépoli"], ["f_matiere", "Dos gris"], ...DA], "Adhésif - Occultant - Mat - Découpe droite - 500 x 300 mm - Pose en extérieur");
attendu("Adhésif", [["f_lam", "Anti UV"], ...DA], "Adhésif - Occultant - Lamination anti-UV - Découpe droite - 500 x 300 mm - Pose en extérieur");
attendu("Adhésif", [["f_decoupe", "à la forme"], ...DA], "Adhésif - Occultant - Mat - Découpe à la forme - Pour vitrine 500 x 300 mm - Pose en extérieur");
attendu("Adhésif", [["f_decoupe", "à la forme"], ["f_dimType", "Adhésif"], ...DA], "Adhésif - Occultant - Mat - Découpe à la forme - 500 x 300 mm - Pose en extérieur");
attendu("Adhésif", [["f_decoupe", "à la forme"]], "Adhésif - Occultant - Mat - Découpe à la forme - (en attente de dimension) - Pose en extérieur");
attendu("Adhésif", [["f_larg", "1600"], ["f_haut", "1600"]], "Adhésif - Occultant - Mat - Découpe droite - 1600 x 1600 mm - En plusieurs parties avec raccord - Pose en extérieur");
attendu("Adhésif", [["f_larg", "3000"], ["f_haut", "1000"]], "Adhésif - Occultant - Mat - Découpe droite - 3000 x 1000 mm - Pose en extérieur");
attendu("Adhésif", [["f_decoupe", "à la forme"], ["f_larg", "1600"], ["f_haut", "1600"]], "Adhésif - Occultant - Mat - Découpe à la forme - Pour vitrine 1600 x 1600 mm - Pose en extérieur");
attendu("Adhésif", [...DA, ["f_qty", "4"]], "Adhésif - Occultant - Mat - Découpe droite - 500 x 300 mm - Pose en extérieur - x 4 exemplaires");

/* =================================================================== CAISSON */
const DC = [["f_larg", "2000"], ["f_haut", "500"]];
const C = "Caisson - Simple-face - 2000 x 500 mm";
attendu("Caisson", DC, C + " - Épaisseur 45 mm - Non lumineux");
attendu("Caisson", [], "Caisson - Simple-face - (en attente de dimension) - Épaisseur 45 mm - Non lumineux");
attendu("Caisson", [...DC, ["f_opt", "Laqué"], ["f_ral", "7016"], ["f_lam", "Mat"]], C + " - Épaisseur 45 mm - Non lumineux - Laqué RAL 7016 mat");
attendu("Caisson", [...DC, ["f_opt", "Laqué"]], C + " - Épaisseur 45 mm - Non lumineux - Laqué RAL (à définir)");
attendu("Caisson", [...DC, ["f_opt", "Adhésivé"], ["f_lam", "Mat"]], C + " - Épaisseur 45 mm - Non lumineux - Adhésif occultant mat contrecollé");
attendu("Caisson", [...DC, ["f_opt", "Adhésivé"], ["f_adh", "Transparent"]], C + " - Épaisseur 45 mm - Non lumineux - Adhésif transparent contrecollé");
attendu("Caisson", [["f_larg", "800"], ["f_haut", "800"], ["f_lum", "Lumineux"]],
  "Caisson - Simple-face - 800 x 800 mm - Épaisseur 70 mm - Lumineux - Ajourage à plat - Plexi contrecollé - Rétroéclairage LED");
attendu("Caisson", [["f_larg", "800"], ["f_haut", "800"], ["f_lum", "Lumineux"], ["f_ajour", "Ajourage relief"]],
  "Caisson - Simple-face - 800 x 800 mm - Épaisseur 70 mm - Lumineux - Ajourage relief - PMMA 30 mm - Rétroéclairage LED");
attendu("Caisson", [["f_larg", "800"], ["f_haut", "800"], ["f_lum", "Lumineux"], ["f_ajour", "Face plexi lumineuse"]],
  "Caisson - Simple-face - 800 x 800 mm - Épaisseur 70 mm - Lumineux - Face plexi diffusant - Chant alu anodisé - Rétroéclairage LED");
attendu("Caisson", [["f_lum", "Lumineux"], ["f_lum", "Non lumineux"], ...DC], C + " - Épaisseur 45 mm - Non lumineux");
// fixations selon le type
attendu("Caisson", [...DC, ["f_fix", "Vissé"]], C + " - Épaisseur 45 mm - Non lumineux - Vissé");
attendu("Caisson", [...DC, ["f_fix", "Entretoises"]], C + " - Épaisseur 45 mm - Non lumineux - Sur entretoises");
attendu("Caisson", [...DC, ["f_fix", "Sur lisses"], ["f_fixRal", "9005"]], C + " - Épaisseur 45 mm - Non lumineux - Sur lisses RAL 9005");
attendu("Caisson", [["f_type", "Double-face"], ["f_larg", "800"], ["f_haut", "800"], ["f_fix", "Potence"], ["f_fixRal", "7016"]],
  "Caisson - Double-face - 800 x 800 mm - Épaisseur 45 mm - Non lumineux - Sur potence RAL 7016");
attendu("Caisson", [["f_type", "Double-face"], ["f_larg", "800"], ["f_haut", "800"], ["f_fix", "Monopotence"]],
  "Caisson - Double-face - 800 x 800 mm - Épaisseur 45 mm - Non lumineux - Sur monopotence");
// une fixation de simple face ne survit pas au passage en double face
attendu("Caisson", [["f_larg", "800"], ["f_haut", "800"], ["f_fix", "Vissé"], ["f_type", "Double-face"]],
  "Caisson - Double-face - 800 x 800 mm - Épaisseur 45 mm - Non lumineux");
// plusieurs parties : plaque = (L + 2 ép.) x (H + 2 ép.)
attendu("Caisson", [["f_larg", "2900"], ["f_haut", "500"]], "Caisson - Simple-face - 2900 x 500 mm - Épaisseur 45 mm - Non lumineux");
attendu("Caisson", [["f_larg", "2900"], ["f_haut", "500"], ["f_lum", "Lumineux"]],
  "Caisson - Simple-face - 2900 x 500 mm - Épaisseur 70 mm - Lumineux - Ajourage à plat - Plexi contrecollé - Rétroéclairage LED");
attendu("Caisson", [["f_larg", "2950"], ["f_haut", "500"], ["f_lum", "Lumineux"]],
  "Caisson - Simple-face - 2950 x 500 mm - En plusieurs parties - Épaisseur 70 mm - Lumineux - Ajourage à plat - Plexi contrecollé - Rétroéclairage LED");
attendu("Caisson", [["f_larg", "2970"], ["f_haut", "500"]], "Caisson - Simple-face - 2970 x 500 mm - En plusieurs parties - Épaisseur 45 mm - Non lumineux");
attendu("Caisson", [["f_larg", "1450"], ["f_haut", "1450"]], "Caisson - Simple-face - 1450 x 1450 mm - En plusieurs parties - Épaisseur 45 mm - Non lumineux");
attendu("Caisson", [["f_larg", "1400"], ["f_haut", "1400"]], "Caisson - Simple-face - 1400 x 1400 mm - Épaisseur 45 mm - Non lumineux");
attendu("Caisson", [...DC, ["f_qty", "2"]], C + " - Épaisseur 45 mm - Non lumineux - x 2 exemplaires");

/* ============================================================ LETTRES RELIEFS */
const DL = [["f_larg", "1200"], ["f_haut", "300"]];
attendu("Lettres reliefs", DL, "Lettres reliefs - Panneau aluminium composite - 3 mm - Non lumineuses - 1200 x 300 mm");
attendu("Lettres reliefs", [], "Lettres reliefs - Panneau aluminium composite - 3 mm - Non lumineuses - (en attente de dimension)");
attendu("Lettres reliefs", [["f_opt", "Laquées"], ["f_matiere", "PVC blanc"], ["f_ep", "19 mm"], ["f_ral", "9016"], ["f_lam", "Mat"], ...DL],
  "Lettres reliefs - PVC - 19 mm - Non lumineuses - Laquées RAL 9016 mat - 1200 x 300 mm");
attendu("Lettres reliefs", [["f_matiere", "PVC blanc"], ["f_ep", "19 mm"], ["f_opt", "Laquées"], ...DL],
  "Lettres reliefs - PVC - 19 mm - Non lumineuses - Laquées RAL (à définir) - 1200 x 300 mm");
attendu("Lettres reliefs", [["f_matiere", "Lettres boitiers"], ["f_ep", "60 mm"], ["f_lum", "Lumineux"], ["f_opt", "Face adhésivée"],
  ["f_adh", "Dos blanc"], ["f_lam", "Mat"], ["f_tranches", "7016"], ...DL, ["f_fix", "Entretoises"]],
  "Lettres reliefs - Boitiers - 60 mm - Lumineuses - Éclairage face avant - Adhésif diffusant mat contrecollé sur la face - Tranches laquées RAL 7016 - 1200 x 300 mm - Sur entretoises");
attendu("Lettres reliefs", [["f_matiere", "Lettres boitiers"], ["f_lum", "Lumineux"], ["f_eclairage", "Rétroéclairage"], ...DL],
  "Lettres reliefs - Boitiers - 30 mm - Lumineuses - Rétroéclairées - 1200 x 300 mm");
attendu("Lettres reliefs", [["f_matiere", "Lettres bloc LED"], ["f_lum", "Lumineux"], ["f_eclairage", "Face avant et chant lumineux (Bloc LED)"], ...DL],
  "Lettres reliefs - Bloc LED - 30 mm - Lumineuses - Face et chant lumineux - 1200 x 300 mm");
attendu("Lettres reliefs", [["f_matiere", "PVC blanc"], ["f_ep", "Autres"], ["f_epAutre", "12"], ...DL],
  "Lettres reliefs - PVC Blanc - 12 mm - Non lumineuses - 1200 x 300 mm");
attendu("Lettres reliefs", [["f_opt", "Face adhésivée"], ...DL], "Lettres reliefs - Panneau aluminium composite - 3 mm - Non lumineuses - Adhésif occultant contrecollé sur la face - 1200 x 300 mm");
// les tranches laquées ne concernent que les boitiers
attendu("Lettres reliefs", [["f_matiere", "Lettres boitiers"], ["f_tranches", "7016"], ["f_matiere", "PVC noir"], ...DL],
  "Lettres reliefs - PVC Noir - 10 mm - Non lumineuses - 1200 x 300 mm");
// changer d'option ne ramène pas la matière au premier choix
attendu("Lettres reliefs", [["f_matiere", "PVC noir"], ["f_opt", "Laquées"], ["f_ral", "9005"], ...DL],
  "Lettres reliefs - PVC Noir - 10 mm - Non lumineuses - Laquées RAL 9005 - 1200 x 300 mm");
attendu("Lettres reliefs", [...DL, ["f_fix", "Vissée"]], "Lettres reliefs - Panneau aluminium composite - 3 mm - Non lumineuses - 1200 x 300 mm - Vissées");
attendu("Lettres reliefs", [...DL, ["f_fix", "Sur lisses"], ["f_lissesRal", "7016"]], "Lettres reliefs - Panneau aluminium composite - 3 mm - Non lumineuses - 1200 x 300 mm - Sur lisses RAL 7016");
attendu("Lettres reliefs", [...DL, ["f_fix", "Tige filetée"], ["f_qty", "2"]], "Lettres reliefs - Panneau aluminium composite - 3 mm - Non lumineuses - 1200 x 300 mm - Sur tiges filetées - x 2 exemplaires");

console.log("Spécification : " + reussis + " phrases conformes, " + echecs + " écart(s).");

/* ================================================================= BALAYAGE */
function combinaisons(listes) {
  let out = [[]];
  listes.forEach((l) => { const n = []; out.forEach((c) => l.forEach((x) => n.push(c.concat([x])))); out = n; });
  return out;
}
const DEFAUTS = /undefined|null|\{|\}|\[|\]|\||  | - - |^ | $| -$|^- |RAL  |RAL -|RAL$| x  |NaN/;
let balayees = 0, cassees = 0;
Object.keys(BUILTIN_CONFIGS).forEach((nom) => {
  const sub = BUILTIN_CONFIGS[nom];
  // chaque champ : ses choix possibles (tous groupes confondus), coché/décoché, rempli/vide
  const axes = sub.fields.map((f) => {
    if (f.type === "checkbox") return [false, true];
    if (f.type === "dropdown") {
      const toutes = f.dependsOn ? [].concat(...Object.values(f.optionGroups)) : f.options;
      return Array.from(new Set(toutes.map(Catalog.optLabel)));
    }
    if (f.id === "f_qty") return ["", "1", "2"];
    if (f.id === "f_larg") return ["", "1200"];
    if (f.id === "f_haut") return ["", "300"];
    return ["", "7016"];
  });
  // l'espace complet est trop grand : on garde un échantillon régulier, toujours le même
  const tout = combinaisons(axes);
  const pas = Math.max(1, Math.floor(tout.length / 60000));
  for (let i = 0; i < tout.length; i += pas) {
    const v = {};
    sub.fields.forEach((f, j) => { v[f.id] = tout[i][j]; });
    // une liste dépendante ne peut valoir qu'un choix de son groupe
    let incoherent = false;
    sub.fields.forEach((f) => {
      if (f.dependsOn && Catalog.fieldOptions(f, v).map(Catalog.optLabel).indexOf(v[f.id]) < 0) incoherent = true;
    });
    if (incoherent) continue;
    balayees++;
    const t = Catalog.buildText(sub, v);
    if (DEFAUTS.test(t) || t.split(" - ").some((s) => s.trim() === "")) {
      if (cassees < 8) console.log("✗ phrase cassée (" + nom + ") : " + JSON.stringify(t) + "  ← " + JSON.stringify(v));
      cassees++;
    }
  }
});
console.log("Balayage : " + balayees + " combinaisons, " + cassees + " phrase(s) cassée(s).");

/* ================================================================ MIGRATION */
let migration = 0;
const ancien = {
  version: 3,
  products: [
    { id: "__builtins__", name: "(modèles de base)", subproducts: [
      { id: "Caisson", builtin: "Caisson", name: "Caisson", fields: [], template: ["ancien"] },
      { id: "Panneau", builtin: "Panneau", name: "Panneau", version: BUILTIN_VERSION, fields: [], template: ["à jour"] }
    ] },
    { id: "p1", name: "Temporis", subproducts: [{ id: "s1", name: "Timbre", fields: [], template: ["sur-mesure"] }] }
  ]
};
const remplaces = Catalog.migrerModelesDeBase(ancien.products[0], BUILTIN_CONFIGS, BUILTIN_VERSION);
const caisson = ancien.products[0].subproducts[0];
if (remplaces.join() !== "Caisson") { migration++; console.log("✗ migration : remplacés = " + remplaces); }
if (caisson.version !== BUILTIN_VERSION || caisson.builtin !== "Caisson" || caisson.id !== "Caisson") { migration++; console.log("✗ migration : caisson mal remplacé"); }
if (ancien.products[0].subproducts[1].template[0] !== "à jour") { migration++; console.log("✗ migration : un modèle à jour a été remplacé"); }
if (ancien.products[1].subproducts[0].template[0] !== "sur-mesure") { migration++; console.log("✗ migration : produit sur-mesure touché"); }
console.log("Migration : " + (migration ? migration + " écart(s)." : "conforme."));

const total = echecs + cassees + migration;
console.log(total ? "\nÉCHEC : " + total + " problème(s)." : "\nTOUT EST CONFORME.");
process.exit(total ? 1 : 0);
