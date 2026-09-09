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

function defaultValues(sub) {
  const v = {};
  // 1er passage : champs indépendants
  (sub.fields || []).forEach(function (f) {
    if (f.dependsOn) return;
    if (f.type === "dropdown") v[f.id] = (f.options && f.options.length) ? optLabel(f.options[0]) : "";
    else v[f.id] = f.default || "";
  });
  // 2e passage : champs dépendants (les parents sont déjà résolus)
  (sub.fields || []).forEach(function (f) {
    if (!f.dependsOn) return;
    const opts = fieldOptions(f, v);
    v[f.id] = opts.length ? optLabel(opts[0]) : "";
  });
  // 3e passage : valeurs auto-remplies selon un autre champ
  (sub.fields || []).forEach(function (f) {
    if (f.autoFill && f.autoFill.on && f.autoFill.map) {
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

/* Valeur résolue d'un champ (sortie personnalisée d'un choix, ou texte saisi). */
/* Choix actifs d'un champ : groupe dépendant du champ parent, ou liste fixe. */
function fieldOptions(f, values) {
  if (f.dependsOn) return (f.optionGroups && f.optionGroups[values[f.dependsOn]]) || [];
  return f.options || [];
}

function fieldValue(f, values) {
  const raw = values[f.id];
  if (f.type === "dropdown") {
    let opt = null;
    fieldOptions(f, values).forEach(function (o) { if (optLabel(o) === raw) opt = o; });
    return opt ? (optOut(opt) || optLabel(opt)) : (raw || "");
  }
  return (raw == null) ? "" : String(raw);
}

/* Un champ conditionnel n'est "actif" que si son champ déclencheur a la bonne valeur. */
function isActive(f, values) {
  if (!f.condition || !f.condition.on) return true;
  return values[f.condition.on] === f.condition.value;
}

/*
 * Génère le texte : le modèle est découpé sur les " - " ; chaque segment dont
 * une étiquette est vide est entièrement omis (avec son séparateur). Les
 * segments de texte fixe (sans étiquette) sont toujours conservés.
 */
/* Le modèle est une liste de blocs (chaînes). Tolère un ancien modèle "chaîne". */
function templateSegments(sub) {
  let segs = sub.template;
  if (typeof segs === "string") segs = segs.split(" - ");
  return Array.isArray(segs) ? segs : [];
}

function buildText(sub, values) {
  const byLabel = {};
  (sub.fields || []).forEach(function (f) { if (f.label) byLabel[f.label] = f; });

  const out = [];
  templateSegments(sub).forEach(function (seg) {
    seg = (seg == null) ? "" : String(seg);
    const tokens = seg.match(/\{[^{}]+\}/g);

    if (!tokens) { if (seg.trim() !== "") out.push(seg); return; } // texte fixe

    let anyEmpty = false;
    let resolved = seg;
    tokens.forEach(function (tok) {
      const label = tok.substring(1, tok.length - 1);
      const f = byLabel[label];
      if (!f) return; // étiquette inconnue : laissée telle quelle
      if (!isActive(f, values)) { anyEmpty = true; resolved = resolved.split(tok).join(""); return; }
      const val = fieldValue(f, values);
      if (String(val).trim() === "") anyEmpty = true;
      resolved = resolved.split(tok).join(val);
    });

    if (!anyEmpty && resolved.trim() !== "") out.push(resolved);
  });

  return out.join(" - ");
}

/* Libellés des champs obligatoires non remplis (pour l'avertissement). */
function missingRequired(sub, values) {
  return (sub.fields || []).filter(function (f) {
    return f.required && isActive(f, values) && String(fieldValue(f, values)).trim() === "";
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
  optLabel: optLabel
};
