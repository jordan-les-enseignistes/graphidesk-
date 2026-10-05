/*
 * catalog.js — modèle v3
 *
 *   catalog = {
 *     version: 3,
 *     products: [                      // "Produit" (ex: Temporis = un client)
 *       { id, name,
 *         subproducts: [               // "Sous-produit" (ex: Simple face)
 *           { id, name,
 *             fields: [
 *               { id, label, type:"text", default? }
 *               | { id, label, type:"dropdown", options:[ { label, out } ] }
 *             ],
 *             template: "texte libre avec des étiquettes {Libellé}"
 *           }
 *         ]
 *       }
 *     ]
 *   }
 *
 * - Le texte généré est un MODÈLE LIBRE : on remplace chaque {Libellé} par la
 *   valeur du champ. Pour une liste de choix, on insère la "sortie" (out) du
 *   choix sélectionné si elle est définie, sinon le libellé du choix lui-même.
 */

// Chargement paresseux d'UXP : permet de charger ce module hors InDesign (tests Node).
let fs = null, formats = null;
try {
  const _storage = require("uxp").storage;
  fs = _storage.localFileSystem;
  formats = _storage.formats;
} catch (e) { /* hors UXP : load/save non utilisés (tests) */ }

const FILE = "catalog.json";

function emptyCatalog() {
  return { version: 3, products: [] };
}

function uuid() {
  return "id-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e9).toString(36);
}

function optLabel(o) { return (o && typeof o === "object") ? (o.label || "") : (o || ""); }
function optOut(o) { return (o && typeof o === "object") ? (o.out || "") : ""; }

/* ----------------------------------------------------- migration / normalisation */

function migrateOptions(fields) {
  (fields || []).forEach(function (f) {
    if (f.type === "dropdown" && Array.isArray(f.options)) {
      f.options = f.options.map(function (o) {
        return (typeof o === "string") ? { label: o, out: "" } : o;
      });
    }
  });
  return fields;
}

function segmentsToString(template, fields) {
  if (typeof template === "string") return template;
  if (!Array.isArray(template)) return "";
  const parts = [];
  template.forEach(function (seg) {
    if (seg.kind === "text") { if (seg.value) parts.push(seg.value); }
    else if (seg.kind === "field") {
      const f = (fields || []).filter(function (x) { return x.id === seg.fieldId; })[0];
      if (f) parts.push("{" + f.label + "}");
    }
  });
  return parts.join(" - ");
}

/* Convertit un ancien "produit plat" (v2) en sous-produit v3. */
function productToSub(p) {
  const fields = migrateOptions(p.fields || []);
  return {
    id: p.id || uuid(),
    name: p.name || "Sans nom",
    fields: fields,
    template: segmentsToString(p.template, fields)
  };
}

function normalize(data) {
  if (!data) return emptyCatalog();

  // v3 déjà au bon format
  if (Array.isArray(data.products) && data.products.length && data.products[0] && Array.isArray(data.products[0].subproducts)) {
    return { version: 3, products: data.products };
  }
  if (Array.isArray(data.products) && data.products.length === 0) {
    return emptyCatalog();
  }

  // v2 : produits plats -> un Produit "Importés" contenant ces produits en sous-produits
  if (Array.isArray(data.products)) {
    return {
      version: 3,
      products: [{ id: uuid(), name: "Importés", subproducts: data.products.map(productToSub) }]
    };
  }

  // v1 : catégories -> chaque catégorie devient un Produit, ses produits des sous-produits
  if (Array.isArray(data.categories)) {
    return {
      version: 3,
      products: data.categories.map(function (c) {
        return { id: c.id || uuid(), name: c.name || "Catégorie", subproducts: (c.products || []).map(productToSub) };
      })
    };
  }

  return emptyCatalog();
}

/* ------------------------------------------------------------------ stockage */

async function loadCatalog() {
  try {
    const folder = await fs.getDataFolder();
    const entry = await folder.getEntry(FILE);
    return normalize(JSON.parse(await entry.read()));
  } catch (e) {
    return emptyCatalog();
  }
}

async function saveCatalog(catalog) {
  const folder = await fs.getDataFolder();
  const file = await folder.createFile(FILE, { overwrite: true });
  await file.write(JSON.stringify(catalog, null, 2), { format: formats.utf8 });
}

/* Exporte le catalogue vers un fichier .json choisi par l'utilisateur. */
async function exportCatalog(catalog, suggestedName) {
  const file = await fs.getFileForSaving(suggestedName || "produits-enseignistes.json", { types: ["json"] });
  if (!file) return { ok: false, cancelled: true };
  await file.write(JSON.stringify(catalog, null, 2), { format: formats.utf8 });
  return { ok: true };
}

/* Importe un catalogue depuis un fichier .json. Retourne { ok, catalog }. */
async function importCatalog() {
  const file = await fs.getFileForOpening({ types: ["json"] });
  if (!file) return { ok: false, cancelled: true };
  const data = JSON.parse(await file.read());
  return { ok: true, catalog: normalize(data) };
}

/* ------------------------------------------------------------------ génération */

/*
 * Types de champ : "text", "dropdown", "checkbox".
 *   - checkbox : cochée, elle écrit sa sortie (out) ou, à défaut, son libellé.
 *
 * Propriétés facultatives d'un champ :
 *   - condition : { on, value } ou { on, values:[…] } — le champ n'est actif que
 *     si le champ `on` vaut l'une de ces valeurs ET est lui-même actif.
 *   - dependsOn + optionGroups : choix d'une liste selon la valeur d'un autre champ.
 *   - autoFill : { on, map, partiel? } — valeur posée quand le champ `on` change.
 *     `partiel` : une valeur absente de la table ne touche à rien (sinon le
 *     champ est vidé) — pour un choix par défaut qui ne vaut que dans un cas.
 *   - ignorer : [valeurs] traitées comme vides (ex. une quantité de « 1 »).
 *   - plusieursParties : { largeur, hauteur, epaisseur?, long, court, seulSi? }
 *     (ou une liste de ces règles) — case cochée d'office quand la pièce ne
 *     tient pas dans une plaque / une laize.
 *
 * Syntaxe du modèle (une entrée = un bloc ; les blocs sont séparés par « - ») :
 *   - {Libellé} : valeur du champ. Vide → le bloc disparaît.
 *   - [ … ]     : partie FACULTATIVE du bloc — retirée si l'une de ses
 *                 étiquettes est vide, sans faire disparaître le bloc.
 *   - A|B       : si A a une étiquette vide, on écrit B (repli).
 *   Un bloc dont une étiquette appartient à un champ INACTIF (condition non
 *   remplie) disparaît entièrement, repli compris : « Laqué RAL (à définir) »
 *   ne doit s'écrire que pour un produit laqué.
 */

function defaultValues(sub) {
  const v = {};
  // 1er passage : champs indépendants
  (sub.fields || []).forEach(function (f) {
    if (f.dependsOn) return;
    if (f.type === "checkbox") v[f.id] = !!f.default;
    else if (f.type === "dropdown") {
      v[f.id] = (f.default != null) ? f.default
        : ((f.options && f.options.length) ? optLabel(f.options[0]) : "");
    } else v[f.id] = (f.default != null) ? f.default : "";
  });
  // 2e passage : champs dépendants, dans l'ordre (un parent peut lui-même dépendre d'un autre)
  (sub.fields || []).forEach(function (f) {
    if (!f.dependsOn) return;
    const opts = fieldOptions(f, v);
    v[f.id] = opts.length ? optLabel(opts[0]) : "";
  });
  // 3e passage : valeurs auto-remplies selon un autre champ
  (sub.fields || []).forEach(function (f) {
    if (f.autoFill && f.autoFill.on && f.autoFill.map) {
      // un champ inactif ne déclenche rien (ex. un éclairage alors que le
      // produit n'est pas lumineux)
      const declencheur = (sub.fields || []).filter(function (x) { return x.id === f.autoFill.on; })[0];
      if (declencheur && !isActive(declencheur, v, sub.fields)) return;
      const val = f.autoFill.map[v[f.autoFill.on]];
      if (val != null && val !== "") v[f.id] = val;
    }
  });
  return v;
}

/* Liste des étiquettes disponibles pour le mémo : ["{Largeur}", "{RAL}", ...] */
function tokensOf(sub) {
  return (sub.fields || []).map(function (f) { return "{" + (f.label || "") + "}"; });
}

/* Choix actifs d'un champ : groupe dépendant du champ parent, ou liste fixe. */
function fieldOptions(f, values) {
  if (f.dependsOn) return (f.optionGroups && f.optionGroups[values[f.dependsOn]]) || [];
  return f.options || [];
}

/* Valeur écrite d'un champ (sortie personnalisée d'un choix, ou texte saisi). */
function fieldValue(f, values) {
  const raw = values[f.id];
  let val;
  if (f.type === "checkbox") {
    val = raw ? (f.out || f.label || "") : "";
  } else if (f.type === "dropdown") {
    let opt = null;
    fieldOptions(f, values).forEach(function (o) { if (optLabel(o) === raw) opt = o; });
    val = opt ? (optOut(opt) || optLabel(opt)) : (raw || "");
  } else {
    val = (raw == null) ? "" : String(raw);
  }
  if (Array.isArray(f.ignorer) && f.ignorer.indexOf(String(val).trim()) >= 0) return "";
  return val;
}

/*
 * Un champ conditionnel n'est actif que si son déclencheur a l'une des valeurs
 * voulues ET est lui-même actif. Sans ce chaînage, un « Blanc de soutien »
 * lié à un adhésif transparent s'écrivait sur un produit LAQUÉ dès lors que
 * la liste Adhésif, masquée, était restée sur « Transparent ».
 */
function isActive(f, values, fields, _vus) {
  if (!f || !f.condition || !f.condition.on) return true;
  const c = f.condition;
  const attendues = (Array.isArray(c.values) && c.values.length) ? c.values : [c.value];
  if (attendues.indexOf(values[c.on]) < 0) return false;
  if (!fields) return true;
  const vus = _vus || {};
  if (vus[f.id]) return true; // conditions en boucle : on s'arrête là
  vus[f.id] = true;
  const parent = fields.filter(function (x) { return x.id === c.on; })[0];
  return isActive(parent, values, fields, vus);
}

function nombre(x) {
  const n = parseFloat(String(x == null ? "" : x).replace(/\s/g, "").replace(",", "."));
  return isNaN(n) ? null : n;
}

/*
 * Faut-il plusieurs parties ? Une pièce tient dans une plaque de `long` x
 * `court` : trop longue d'un côté, ou trop grande des DEUX côtés, elle n'y
 * tient plus. Un caisson se découpe dans une plaque plus grande que lui : ses
 * retours pliés ajoutent son épaisseur de chaque côté.
 */
function plusieursPartiesRequises(regle, values) {
  if (regle.seulSi && values[regle.seulSi.on] !== regle.seulSi.value) return false;
  const ep = regle.epaisseur ? (nombre(values[regle.epaisseur]) || 0) : 0;
  const w = nombre(values[regle.largeur]);
  const h = nombre(values[regle.hauteur]);
  if (w === null || h === null) return false;
  const a = w + 2 * ep, b = h + 2 * ep;
  const tropLong = regle.long ? (a > regle.long || b > regle.long) : false;
  const tropGrand = regle.court ? (a > regle.court && b > regle.court) : false;
  return tropLong || tropGrand;
}

/*
 * Automatismes après une saisie : valeurs auto-remplies, puis « plusieurs
 * parties ». `changedId` = champ modifié (null au premier affichage).
 * `set(id, valeur)` écrit une valeur ; `lire()` relit toutes les valeurs.
 */
function appliquerAutomatismes(sub, values, changedId, set, lire) {
  const fields = sub.fields || [];
  fields.forEach(function (f) {
    if (f.autoFill && f.autoFill.on && f.autoFill.map && (changedId === null || changedId === f.autoFill.on)) {
      const val = f.autoFill.map[values[f.autoFill.on]];
      if (val == null && f.autoFill.partiel) return;
      set(f.id, (val != null) ? val : "");
    }
  });
  const v = lire();
  fields.forEach(function (f) {
    if (!f.plusieursParties) return;
    const regles = Array.isArray(f.plusieursParties) ? f.plusieursParties : [f.plusieursParties];
    // recalcul quand une donnée d'une règle change — y compris l'épaisseur
    // posée automatiquement — mais jamais par-dessus un choix manuel de la case
    const sources = [];
    regles.forEach(function (r) {
      sources.push(r.largeur, r.hauteur, r.epaisseur, r.seulSi && r.seulSi.on);
      fields.forEach(function (g) { if (g.autoFill && g.id === r.epaisseur) sources.push(g.autoFill.on); });
    });
    if (changedId !== null && sources.indexOf(changedId) < 0) return;
    set(f.id, regles.some(function (r) { return plusieursPartiesRequises(r, v); }));
  });
}

var INACTIF = { inactif: true };

/*
 * Résout un morceau de modèle : remplace ses étiquettes. Renvoie null si une
 * étiquette est vide, INACTIF si l'une appartient à un champ inactif.
 */
function resoudre(texte, byLabel, values, fields) {
  let res = texte;
  let vide = false, inactif = false;
  (texte.match(/\{[^{}]+\}/g) || []).forEach(function (tok) {
    const f = byLabel[tok.substring(1, tok.length - 1)];
    if (!f) return; // étiquette inconnue : laissée telle quelle
    if (!isActive(f, values, fields)) { inactif = true; return; }
    const val = String(fieldValue(f, values));
    if (val.trim() === "") vide = true;
    res = res.split(tok).join(val);
  });
  if (inactif) return INACTIF;
  return vide ? null : res;
}

const FACULTATIF = /\[([^\[\]]*)\]/g;

function buildText(sub, values) {
  const fields = sub.fields || [];
  const byLabel = {};
  fields.forEach(function (f) { if (f.label) byLabel[f.label] = f; });

  const out = [];
  templateSegments(sub).forEach(function (seg) {
    const variantes = ((seg == null) ? "" : String(seg)).split("|");
    for (let i = 0; i < variantes.length; i++) {
      // partie obligatoire : un champ inactif fait disparaître le bloc,
      // repli compris ; une étiquette vide fait passer au repli suivant
      const essentiel = resoudre(variantes[i].replace(FACULTATIF, ""), byLabel, values, fields);
      if (essentiel === INACTIF) return;
      if (essentiel === null) continue;
      const complet = variantes[i].replace(FACULTATIF, function (_, dedans) {
        const r = resoudre(dedans, byLabel, values, fields);
        return (r === null || r === INACTIF) ? "" : r;
      });
      let texte = String(resoudre(complet, byLabel, values, fields) || "");
      // une partie facultative retirée laisse des espaces orphelins ; les
      // blocs sans crochets restent tels qu'écrits (un « RAL » suivi d'un
      // espace attend qu'on tape le numéro derrière)
      if (complet !== variantes[i]) texte = texte.replace(/\s+/g, " ").trim();
      if (texte.trim() !== "") out.push(texte);
      return;
    }
  });

  return out.join(" - ");
}

/* Le modèle est une liste de blocs (chaînes). Tolère un ancien modèle "chaîne". */
function templateSegments(sub) {
  let segs = sub.template;
  if (typeof segs === "string") segs = segs.split(" - ");
  return Array.isArray(segs) ? segs : [];
}

/*
 * Remplace les modèles de base « rendus modifiables » d'une version antérieure
 * (`produit` = le produit interne qui les regroupe). Renvoie les noms remplacés.
 */
function migrerModelesDeBase(produit, configs, version) {
  if (!produit) return [];
  const remplaces = [];
  produit.subproducts = (produit.subproducts || []).map(function (s) {
    const nom = s.builtin || s.id;
    const cfg = configs[nom];
    if (!cfg || (s.version || 1) >= version) return s;
    remplaces.push(nom);
    const neuf = JSON.parse(JSON.stringify(cfg));
    neuf.id = s.id;
    neuf.builtin = nom;
    return neuf;
  });
  return remplaces;
}

/* Libellés des champs obligatoires non remplis (pour l'avertissement). */
function missingRequired(sub, values) {
  const fields = sub.fields || [];
  return fields.filter(function (f) {
    return f.required && isActive(f, values, fields) && String(fieldValue(f, values)).trim() === "";
  }).map(function (f) { return f.label || "(champ)"; });
}

module.exports = {
  emptyCatalog: emptyCatalog,
  uuid: uuid,
  loadCatalog: loadCatalog,
  saveCatalog: saveCatalog,
  exportCatalog: exportCatalog,
  importCatalog: importCatalog,
  defaultValues: defaultValues,
  buildText: buildText,
  missingRequired: missingRequired,
  tokensOf: tokensOf,
  optLabel: optLabel,
  fieldOptions: fieldOptions,
  isActive: isActive,
  appliquerAutomatismes: appliquerAutomatismes,
  plusieursPartiesRequises: plusieursPartiesRequises,
  migrerModelesDeBase: migrerModelesDeBase
};
