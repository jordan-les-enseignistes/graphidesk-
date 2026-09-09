/*
 * tests/verify-builtins.js
 * Compare, across all variant combinations, the hardcoded buildText output
 * (products.js) vs the config-driven output (builtins-config.js via catalog.js).
 *
 * Run: node tests/verify-builtins.js
 */

const { PRODUCTS } = require("../products.js");
const Catalog = require("../catalog.js");
const { BUILTIN_CONFIGS } = require("../builtins-config.js");

/* ---------- hardcoded pipeline (mirrors index.js) ---------- */
function hardcodedText(name, v) {
  const product = PRODUCTS[name];
  // Settle derive to a fixed point: changedId=null then each input field id.
  if (typeof product.derive === "function") {
    const set = (id, val) => { v[id] = val; };
    product.derive(v, set, null);
    product.fields.forEach(f => product.derive(v, set, f.id));
  }
  return product.buildText(v);
}

/* ---------- config pipeline (mirrors makeSubRuntime + catalog.buildText) ---------- */
function configText(cfg, cv) {
  // apply autoFill
  (cfg.fields || []).forEach(f => {
    if (f.autoFill && f.autoFill.on && f.autoFill.map) {
      const val = f.autoFill.map[cv[f.autoFill.on]];
      cv[f.id] = (val != null) ? val : "";
    }
  });
  return Catalog.buildText(cfg, cv);
}

function cartesian(dims) {
  // dims: array of arrays. Returns array of combos (array of picks).
  let out = [[]];
  dims.forEach(d => {
    const next = [];
    out.forEach(combo => d.forEach(val => next.push(combo.concat([val]))));
    out = next;
  });
  return out;
}

function run(name, scenarios) {
  const cfg = BUILTIN_CONFIGS[name];
  let tested = 0;
  const mismatches = [];
  const samples = [];

  scenarios.forEach(sc => {
    tested++;
    const v = sc.v();
    const cv = sc.cv();
    const a = hardcodedText(name, v);
    const b = configText(cfg, cv);
    if (a !== b) {
      mismatches.push({ scenario: sc.desc, hard: a, conf: b });
    } else if (samples.length < 4) {
      samples.push(a);
    }
  });

  console.log("==== " + name + " ====");
  console.log("  combos tested : " + tested);
  console.log("  mismatches    : " + mismatches.length);
  mismatches.slice(0, 5).forEach((m, i) => {
    console.log("  --- mismatch #" + (i + 1));
    console.log("      scenario: " + m.scenario);
    console.log("      HARD: " + JSON.stringify(m.hard));
    console.log("      CONF: " + JSON.stringify(m.conf));
  });
  if (mismatches.length === 0) {
    console.log("  sample matches:");
    samples.forEach(s => console.log("      " + s));
  }
  console.log("");
  return mismatches.length;
}

/* Fixed dimensions BELOW all auto-"plusieurs parties" thresholds. */
const LARG = "500", HAUT = "300", RAL = "7016";

/* =================================================================== PANNEAU */
function panneauScenarios() {
  const matieres = ["Dibond", "PVC 3 mm", "Plexi transparent 5 mm", "Akilux 3,5 mm"];
  const decoupes = ["Découpe droite", "Découpe à la forme"];
  const options = ["Sans option", "Laqué", "Adhésivé"];
  const adhOpts = ["Dos gris", "Teinté masse", "Transparent"];
  const bsVals = ["Sans", "Blanc de soutien sélectif", "Blanc de soutien total"];
  const lams = ["", "Mat", "Brillant", "Velleda"];
  const fixs = ["Sans", "Entretoises", "Perforation", "Double face", "Sur lisses"];
  const sc = [];
  cartesian([matieres, decoupes, options, adhOpts, bsVals, lams, fixs]).forEach(c => {
    const [matiere, decoupe, option, adhOpt, bs, lam, fix] = c;
    const desc = JSON.stringify(c);
    sc.push({
      desc,
      v: () => ({
        matiere, decoupe, largeur: LARG, hauteur: HAUT,
        multiple: false, option, ral: RAL, adhOpt, bs, lamination: lam,
        fixation: fix, lissesRAL: RAL, quantite: "1"
      }),
      cv: () => ({
        f_matiere: matiere, f_decoupe: decoupe, f_larg: LARG, f_haut: HAUT,
        f_opt: option,
        f_ral: option === "Laqué" ? RAL : "",
        f_adh: option === "Adhésivé" ? adhOpt : "",
        f_bs: (option === "Adhésivé" && adhOpt === "Transparent") ? bs : "Sans",
        f_lam: lam,
        f_fix: fix, f_lissesRal: RAL, f_parts: "", f_qty: ""
      })
    });
  });
  return sc;
}

/* =================================================================== ADHÉSIF */
function adhesifScenarios() {
  const matieres = ["Dos gris", "Dos blanc", "Dépoli", "Microperforé", "Teinté masse", "Transparent", "Conformable"];
  const bsVals = ["Sans", "Blanc de soutien sélectif", "Blanc de soutien total"];
  const lamHasOptions = [
    { lamination: "Avec", typeLam: "Mat" },
    { lamination: "Avec", typeLam: "Brillant" },
    { lamination: "Avec", typeLam: "Velleda" },
    { lamination: "Avec", typeLam: "Spéciale sol antidérapant" },
    { lamination: "Avec", typeLam: "Anti UV" },
    { lamination: "Sans", typeLam: "Mat" }
  ];
  const decoupes = ["droite", "à la forme"];
  const dimTypes = ["Vitrine", "Adhésif"];
  const poses = ["Extérieur", "Intérieur"];
  const refTm = "REF42";
  const sc = [];
  cartesian([matieres, bsVals, lamHasOptions, decoupes, dimTypes, poses]).forEach(c => {
    const [matiere, bs, lamCombo, decoupe, dimType, pose] = c;
    const desc = JSON.stringify([matiere, bs, lamCombo, decoupe, dimType, pose]);

    // config lamination single value.
    // Replicate hardcoded derive: matière "Dépoli..." forces lamination "Sans".
    let cfgLam;
    const forcedSans = /^Dépoli/.test(matiere);
    if (lamCombo.lamination === "Sans" || forcedSans) cfgLam = "Sans";
    else cfgLam = lamCombo.typeLam;

    const dim = LARG + " x " + HAUT + " mm";
    sc.push({
      desc,
      v: () => ({
        matiere, bs, refTm,
        lamination: lamCombo.lamination, typeLam: lamCombo.typeLam,
        decoupe, dimType,
        largeur: LARG, hauteur: HAUT, multiple: false, pose, quantite: "1"
      }),
      cv: () => ({
        f_matiere: matiere,
        f_refTm: matiere === "Teinté masse" ? refTm : "",
        f_bs: bs,
        f_lam: cfgLam,
        f_decoupe: decoupe,
        f_dimType: decoupe === "à la forme" ? dimType : "",
        f_dimVitrine: dim,
        f_dimAdh: dim,
        f_dimDroite: dim,
        f_parts: "",
        f_pose: pose,
        f_qty: ""
      })
    });
  });
  return sc;
}

/* ============================================================ LETTRES RELIEFS */
function lettresScenarios() {
  const matieres = ["Dibond 3mm", "PVC blanc", "PVC noir", "Lettres boitiers", "Lettres bloc LED"];
  // valid épaisseur per matière (first of optionsFrom list, excluding "Autres")
  const epByMat = {
    "Dibond 3mm": "3 mm",
    "PVC blanc": "5 mm",
    "PVC noir": "10 mm",
    "Lettres boitiers": "30 mm",
    "Lettres bloc LED": "30 mm"
  };
  const lums = [
    { lumineux: "Non lumineux", eclairage: "Face avant lumineuse" },
    { lumineux: "Lumineux", eclairage: "Face avant lumineuse" },
    { lumineux: "Lumineux", eclairage: "Rétro-éclairage" },
    { lumineux: "Lumineux", eclairage: "Face avant et chant lumineux (Bloc LED)" }
  ];
  const options = ["", "Face adhésivée", "Laquées"];
  const adhOpts = ["Dos gris", "Dos blanc"];
  const lams = ["", "Mat", "Brillant"];
  const fixs = ["Sans", "Entretoises", "Tige filetée", "Double face", "Sur lisses", "Vissée"];
  const sc = [];
  cartesian([matieres, lums, options, adhOpts, lams, fixs]).forEach(c => {
    const [matiere, lumCombo, option, adhOpt, lam, fix] = c;
    const ep = epByMat[matiere];
    const desc = JSON.stringify([matiere, lumCombo, option, adhOpt, lam, fix]);
    sc.push({
      desc,
      v: () => ({
        matiere, epaisseur: ep, epAutre: "",
        lumineux: lumCombo.lumineux, eclairage: lumCombo.eclairage,
        option, adhOpt, ral: RAL,
        largeur: LARG, hauteur: HAUT, lamination: lam,
        fixation: fix, lissesRAL: RAL, quantite: "1"
      }),
      cv: () => ({
        f_opt: option,
        f_matiere: matiere,
        f_ep: ep,
        f_lum: lumCombo.lumineux,
        f_eclairage: lumCombo.eclairage,
        f_adh: option === "Face adhésivée" ? adhOpt : "",
        f_ral: option === "Laquées" ? RAL : "",
        f_larg: LARG, f_haut: HAUT,
        f_lam: lam,
        f_fix: fix, f_lissesRal: RAL,
        f_qty: ""
      })
    });
  });
  return sc;
}

let total = 0;
total += run("Panneau", panneauScenarios());
total += run("Adhésif", adhesifScenarios());
total += run("Lettres reliefs", lettresScenarios());

console.log("TOTAL MISMATCHES: " + total);
process.exit(total === 0 ? 0 : 1);
