/*
 * index.js — v3 (Produit -> Sous-produit, modèle de texte libre)
 *   Vue Génération : menu "Produit" + menu "Sous-produit" + formulaire.
 *   Vue Produit : nom + liste des sous-produits.
 *   Vue Sous-produit : champs + modèle de texte (editor.js).
 */

const { entrypoints } = require("uxp");
const { PRODUCTS } = require("./products.js");
const ID = require("./indesign.js");
const Catalog = require("./catalog.js");
const { setupEditor } = require("./editor.js");
const { BUILTIN_CONFIGS } = require("./builtins-config.js");

const VIEWS = ["generateView", "productView", "subView", "exportView"];
const ADD_LABEL = "+ Ajouter un produit";

let catalog = Catalog.emptyCatalog();
let productEntries = [];      // [{ label, builtin?, product?, userId?, prod? }]
let curProd = null;           // produit utilisateur courant (objet catalogue) ou null
let curSub = null;            // sous-produit courant (objet) ou null (intégré)
let curBuiltinName = null;    // nom du produit de base sélectionné (sinon null)
let currentProduct = null;    // runtime { fields, buildText, ... }
let els = {};
let optionMaps = {};
let noteEl = null;
let ed = null;
let exportRows = [];          // [{ product, cb }] pour la vue d'export

entrypoints.setup({
  panels: {
    mainPanel: {
      create() { ensureInit(); },
      show() { ensureInit(); },
      menuItems: [
        { id: "export", label: "Exporter mes produits…" },
        { id: "import", label: "Importer des produits…" }
      ],
      invokeMenu(id) {
        if (id === "export") openExportView();
        else if (id === "import") onImport();
      }
    }
  }
});

function el(id) { return document.getElementById(id); }

function showFatal(msg) {
  try {
    const box = document.createElement("div");
    box.setAttribute("style", "color:#e34850;padding:10px;font-size:11px;white-space:pre-wrap;");
    box.textContent = "⚠ " + msg;
    if (document.body) document.body.appendChild(box);
  } catch (e) {}
}

if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("error", function (ev) {
    showFatal("ERREUR : " + ((ev && (ev.message || (ev.error && ev.error.message))) || "inconnue"));
  });
  window.addEventListener("unhandledrejection", function (ev) {
    showFatal("REJET : " + ((ev && ev.reason && (ev.reason.message || ev.reason)) || "inconnu"));
  });
}

let _inited = false;
function ensureInit() {
  if (_inited) return;
  _inited = true;
  Promise.resolve().then(init).catch(function (e) {
    showFatal("INIT REJET : " + (e && e.message ? e.message : e));
  });
}

/* --------------------------------------------------------------- utilitaires */

function fillMenu(dropdownEl, options, selIdx) {
  const menu = dropdownEl.querySelector("sp-menu");
  menu.innerHTML = "";
  options.forEach((opt, i) => {
    const item = document.createElement("sp-menu-item");
    item.textContent = opt;
    if (i === selIdx) item.selected = true;
    menu.appendChild(item);
  });
  if (selIdx != null && selIdx >= 0) dropdownEl.selectedIndex = selIdx;
}

function arraysEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function defaultValue(field) {
  if (field.type === "checkbox") return !!field.default;
  if (field.type === "dropdown") {
    if (field.default != null) return field.default;
    return field.options ? Catalog.optLabel(field.options[0]) : "";
  }
  return field.default != null ? field.default : "";
}

/* Choix d'un champ Liste : fonction (built-ins), dépendance d'un autre champ, ou liste fixe. */
function computeOptions(field, values) {
  if (typeof field.optionsFrom === "function") return field.optionsFrom(values);
  if (field.dependsOn) return (field.optionGroups && field.optionGroups[values[field.dependsOn]]) || [];
  return field.options || [];
}

/* --- Surcharges des produits de base (édition en place, réinitialisable) --- */
const BUILTINS_PROD_ID = "__builtins__";

function builtinsProduct(create) {
  for (let i = 0; i < catalog.products.length; i++) {
    if (catalog.products[i].id === BUILTINS_PROD_ID) return catalog.products[i];
  }
  if (create) {
    const p = { id: BUILTINS_PROD_ID, name: "(modèles de base)", subproducts: [] };
    catalog.products.push(p);
    return p;
  }
  return null;
}

function getBuiltinOverride(name) {
  const p = builtinsProduct(false);
  if (!p) return null;
  return p.subproducts.filter(function (s) { return s.id === name; })[0] || null;
}

/* Produit runtime (génération) à partir d'un sous-produit config : champs + texte + auto-remplissage. */
function makeSubRuntime(sub) {
  return {
    fields: sub.fields || [],
    buildText: function (v) { return Catalog.buildText(sub, v); },
    derive: function (v, set, changedId) {
      (sub.fields || []).forEach(function (f) {
        if (f.autoFill && f.autoFill.on && f.autoFill.map && (changedId === null || changedId === f.autoFill.on)) {
          const val = f.autoFill.map[v[f.autoFill.on]];
          set(f.id, (val != null) ? val : "");
        }
      });
    }
  };
}

/* ----------------------------------------------------- liste de produits */

function buildProductEntries() {
  productEntries = [];
  Object.keys(PRODUCTS).forEach(name => productEntries.push({ label: name, builtin: true, product: PRODUCTS[name] }));
  (catalog.products || []).forEach(p => {
    if (p.id === BUILTINS_PROD_ID) return; // produit interne (surcharges) : non listé
    productEntries.push({ label: p.name, userId: p.id, prod: p });
  });
}

function refreshProductSelector(idx) {
  const labels = productEntries.map(e => e.label);
  labels.push(ADD_LABEL);
  fillMenu(el("productSelect"), labels, idx != null ? idx : 0);
}

function onCatalogChanged() {
  buildProductEntries();
  refreshProductSelector(0);
}

/* ------------------------------------------------------------------- vues */

function showView(name) {
  VIEWS.forEach(v => el(v).classList.toggle("hidden", v !== name));
}

function goGenerate(selectId) {
  buildProductEntries();
  let idx = 0;
  if (selectId) {
    for (let i = 0; i < productEntries.length; i++) {
      if (productEntries[i].userId === selectId) { idx = i; break; }
    }
  }
  refreshProductSelector(idx);
  showView("generateView");
  selectProductEntry(idx);
}

function goProduct(prodId) {
  ed.renderProduct(prodId);
  showView("productView");
}

function goSub(prodId, subId) {
  ed.renderSub(prodId, subId);
  showView("subView");
}

/* ------------------------------------------------------------ initialisation */

function persist() { return Catalog.saveCatalog(catalog); }

function createProduct() {
  const p = { id: Catalog.uuid(), name: "Nouveau produit", subproducts: [] };
  catalog.products.push(p);
  persist();
  goProduct(p.id);
}

/* Édite un produit de base EN PLACE : crée/ouvre sa surcharge éditable (pas de nouveau produit). */
function onEditBuiltin() {
  const name = curBuiltinName;
  const cfg = BUILTIN_CONFIGS[name];
  if (!cfg) return;
  const p = builtinsProduct(true);
  let sub = getBuiltinOverride(name);
  if (!sub) {
    sub = JSON.parse(JSON.stringify(cfg));
    sub.id = name;       // id = nom du produit de base (stable)
    sub.builtin = name;  // marque : modèle de base, réinitialisable
    p.subproducts.push(sub);
    persist();
    onCatalogChanged();
  }
  goSub(p.id, sub.id);
}

/* Réinitialise un produit de base : supprime la surcharge -> retour à la version d'origine verrouillée. */
function resetBuiltin(subId) {
  const p = builtinsProduct(false);
  if (p) p.subproducts = p.subproducts.filter(function (s) { return s.id !== subId; });
  persist();
  onCatalogChanged();
  goGenerate();
}

function onProductChange() {
  const idx = el("productSelect").selectedIndex;
  if (idx === productEntries.length) createProduct();
  else selectProductEntry(idx);
}

async function init() {
  try {
    try { catalog = await Catalog.loadCatalog(); }
    catch (e) { catalog = Catalog.emptyCatalog(); }

    ed = setupEditor({
      catalog: catalog,
      save: persist,
      onChanged: onCatalogChanged,
      goGenerate: goGenerate,
      goProduct: goProduct,
      goSub: goSub,
      resetBuiltin: resetBuiltin
    });

    buildProductEntries();
    refreshProductSelector(0);

    el("productSelect").addEventListener("change", onProductChange);
    el("subSelect").addEventListener("change", () => selectSub(el("subSelect").selectedIndex));
    el("btnEdit").addEventListener("click", function () { if (curProd) goProduct(curProd.id); });
    el("btnCopyBuiltin").addEventListener("click", onEditBuiltin);
    el("btnReset").addEventListener("click", onReset);
    el("btnGenerate").addEventListener("click", onGenerate);
    el("btnPlus").addEventListener("click", onPlus);
    el("preview").addEventListener("input", autoGrowPreview);
    installerPoigneeApercu();
    el("exBack").addEventListener("click", goGenerate);
    el("exDoExport").addEventListener("click", doExport);

    selectProductEntry(0);
  } catch (e) {
    showFatal("ERREUR INIT : " + (e && e.message ? e.message : e) + (e && e.stack ? "\n" + e.stack : ""));
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", ensureInit);
} else {
  ensureInit();
}

/* ------------------------------------------------------- sélection produit */

function selectProductEntry(idx) {
  if (idx == null || idx < 0 || idx >= productEntries.length) idx = 0;
  const entry = productEntries[idx];
  if (!entry) return;

  if (entry.builtin) {
    curProd = null;
    curBuiltinName = entry.label;
    el("btnEdit").classList.add("hidden");
    el("btnCopyBuiltin").classList.toggle("hidden", !BUILTIN_CONFIGS[entry.label]);
    el("subRow").classList.add("hidden");
    const override = getBuiltinOverride(entry.label);
    if (override) {
      curSub = override;
      currentProduct = makeSubRuntime(override); // version modifiée par l'utilisateur
    } else {
      curSub = null;
      currentProduct = entry.product; // version verrouillée d'origine
    }
    renderFields();
    refresh(null);
    return;
  }

  // produit utilisateur
  curProd = entry.prod;
  curBuiltinName = null;
  el("btnEdit").classList.remove("hidden");
  el("btnCopyBuiltin").classList.add("hidden");
  const subs = curProd.subproducts || [];
  if (subs.length) {
    el("subRow").classList.remove("hidden");
    fillMenu(el("subSelect"), subs.map(s => s.name), 0);
    selectSub(0);
  } else {
    el("subRow").classList.add("hidden");
    curSub = null;
    currentProduct = { fields: [], buildText: function () { return ""; } };
    renderFields();
    refresh(null);
    setStatus("Ce produit n'a pas de sous-produit. Touche « Modifier » pour en ajouter.", "");
  }
}

function selectSub(subIdx) {
  if (!curProd) return;
  const subs = curProd.subproducts || [];
  if (subIdx == null || subIdx < 0 || subIdx >= subs.length) subIdx = 0;
  const sub = subs[subIdx];
  curSub = sub;
  currentProduct = makeSubRuntime(sub);
  renderFields();
  refresh(null);
}

/* ------------------------------------------------------- moteur de génération */

function renderFields() {
  const container = el("fields");
  container.innerHTML = "";
  els = {};
  optionMaps = {};
  noteEl = null;

  const defaults = {};
  currentProduct.fields.forEach(f => { if (!f.dependsOn) defaults[f.id] = defaultValue(f); });
  currentProduct.fields.forEach(f => {
    if (f.dependsOn) {
      const o = computeOptions(f, defaults).map(Catalog.optLabel);
      defaults[f.id] = o.length ? o[0] : "";
    }
  });

  currentProduct.fields.forEach(field => {
    const wrapper = document.createElement("div");
    wrapper.className = (field.type === "checkbox") ? "field" : "field row";

    let control;

    if (field.type === "dropdown") {
      const label = document.createElement("label");
      label.textContent = field.label;
      wrapper.appendChild(label);

      control = document.createElement("sp-dropdown");
      control.className = "control";
      const menu = document.createElement("sp-menu");
      menu.setAttribute("slot", "options");
      control.appendChild(menu);

      const rawOpts = computeOptions(field, defaults);
      const opts = rawOpts.map(Catalog.optLabel);
      let idx = opts.indexOf(defaults[field.id]);
      if (idx < 0) idx = 0;
      fillMenu(control, opts, opts.length ? idx : -1);
      optionMaps[field.id] = opts;

      control.addEventListener("change", () => refresh(field.id));
      wrapper.appendChild(control);

    } else if (field.type === "checkbox") {
      control = document.createElement("sp-checkbox");
      control.textContent = field.label;
      control.checked = !!defaults[field.id];
      control.addEventListener("change", () => refresh(field.id));
      wrapper.appendChild(control);

    } else {
      const label = document.createElement("label");
      label.textContent = field.label;
      wrapper.appendChild(label);

      control = document.createElement("sp-textfield");
      control.className = "control";
      control.value = defaults[field.id];
      control.addEventListener("input", () => refresh(field.id));
      control.addEventListener("change", () => refresh(field.id));
      wrapper.appendChild(control);
    }

    els[field.id] = { control, wrapper, field };
    container.appendChild(wrapper);
  });

  if (typeof currentProduct.note === "function") {
    noteEl = document.createElement("div");
    noteEl.className = "note";
    container.appendChild(noteEl);
  }
}

function readValues() {
  const v = {};
  for (const id in els) {
    const { control, field } = els[id];
    if (field.type === "checkbox") {
      v[id] = !!control.checked;
    } else if (field.type === "dropdown") {
      const opts = optionMaps[id] || [];
      const idx = control.selectedIndex;
      v[id] = (idx != null && idx >= 0 && idx < opts.length) ? opts[idx] : (opts[0] || "");
    } else {
      v[id] = control.value || "";
    }
  }
  return v;
}

function setVal(id, val) {
  const e = els[id];
  if (!e) return;
  const { control, field } = e;
  if (field.type === "checkbox") {
    control.checked = !!val;
  } else if (field.type === "dropdown") {
    const opts = optionMaps[id] || [];
    const idx = opts.indexOf(val);
    if (idx >= 0) control.selectedIndex = idx;
  } else {
    control.value = (val == null) ? "" : String(val);
  }
}

function rebuildDynamicOptions(v) {
  for (const id in els) {
    const { control, field } = els[id];
    if (field.type === "dropdown" && (field.optionsFrom || field.dependsOn)) {
      const newOpts = computeOptions(field, v).map(Catalog.optLabel);
      if (!arraysEqual(optionMaps[id], newOpts)) {
        fillMenu(control, newOpts, 0);
        optionMaps[id] = newOpts;
      }
    }
  }
}

function applyVisibility(v) {
  for (const id in els) {
    const { wrapper, field } = els[id];
    let visible = true;
    if (typeof field.visibleWhen === "function") {
      visible = field.visibleWhen(v);
    } else if (field.condition && field.condition.on) {
      visible = (v[field.condition.on] === field.condition.value);
    }
    wrapper.classList.toggle("hidden", !visible);
  }
}

function refresh(changedId) {
  if (!currentProduct) return;
  let v = readValues();

  if (typeof currentProduct.derive === "function") {
    currentProduct.derive(v, setVal, changedId);
    v = readValues();
  }

  rebuildDynamicOptions(v);
  v = readValues();

  applyVisibility(v);

  if (noteEl && typeof currentProduct.note === "function") {
    noteEl.textContent = currentProduct.note(v);
  }

  el("preview").value = currentProduct.buildText(v);
  autoGrowPreview();

  const missing = curSub ? Catalog.missingRequired(curSub, v) : [];
  if (missing.length) setStatus("À remplir : " + missing.join(", "), "warn");
  else setStatus("", "");
}

/* Le graphiste a étiré l'aperçu : sa hauteur devient la sienne, et le code
   cesse de l'ajuster. Passe à vrai UNIQUEMENT par un glisser sur la poignée —
   ne jamais le déduire d'une mesure, une hauteur mesurée diffère de la hauteur
   posée et l'aperçu se figerait tout seul (constaté le 09/09/2026 : texte
   tronqué). */
let hauteurChoisie = false;

/** Ajuste la hauteur de l'aperçu au texte, tant que personne ne l'a réglée. */
function autoGrowPreview() {
  const elp = el("preview");
  if (!elp) return;
  if (hauteurChoisie) return;
  const grow = function () {
    elp.style.height = "";
    elp.style.height = (elp.scrollHeight + 2) + "px";
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(grow);
  else grow();
}

/** Poignée d'étirement de l'aperçu, en bas à droite. */
function installerPoigneeApercu() {
  const elp = el("preview");
  const grip = el("previewGrip");
  if (!elp || !grip) return;
  const HAUTEUR_MINI = 40;
  let actif = false;
  let yDepart = 0;
  let hDepart = 0;

  grip.addEventListener("mousedown", function (ev) {
    actif = true;
    yDepart = ev.clientY;
    hDepart = elp.offsetHeight;
    ev.preventDefault();
  });
  document.addEventListener("mousemove", function (ev) {
    if (!actif) return;
    const h = Math.max(HAUTEUR_MINI, hDepart + (ev.clientY - yDepart));
    elp.style.height = h + "px";
    hauteurChoisie = true;
    ev.preventDefault();
  });
  document.addEventListener("mouseup", function () {
    actif = false;
  });
}

function setStatus(message, kind) {
  const s = el("status");
  s.textContent = message || "";
  s.className = kind || "";
}

function onReset() {
  if (!currentProduct) return;
  // « Réinitialiser » remet aussi l'aperçu en ajustement automatique : c'est
  // le seul geste qui annonce clairement qu'on repart de zéro.
  hauteurChoisie = false;
  renderFields();
  refresh(null);
}

function onGenerate() {
  try {
    const texte = el("preview").value;
    const res = ID.applyToSelection(texte);
    setStatus(res.ok ? "Texte appliqué." : res.message, res.ok ? "ok" : "error");
  } catch (e) {
    setStatus("Erreur : " + (e && e.message ? e.message : e), "error");
  }
}

function onPlus() {
  try {
    const texte = el("preview").value;
    const res = ID.applyToSelection(texte);
    if (!res.ok) { setStatus(res.message, "error"); return; }
    const res2 = ID.duplicateLeftOrigAndFit();
    setStatus(res2.ok ? "Généré + dupliqué." : res2.message, res2.ok ? "ok" : "error");
  } catch (e) {
    setStatus("Erreur : " + (e && e.message ? e.message : e), "error");
  }
}

function openExportView() {
  renderExportList();
  showView("exportView");
}

function renderExportList() {
  const box = el("exportList");
  box.innerHTML = "";
  exportRows = [];
  if (!catalog.products.length) {
    const e = document.createElement("div");
    e.className = "note";
    e.textContent = "Aucun produit à exporter.";
    box.appendChild(e);
    return;
  }
  catalog.products.forEach(function (p) {
    const row = document.createElement("div");
    row.className = "field";
    const cb = document.createElement("sp-checkbox");
    cb.textContent = p.name || "(sans nom)";
    cb.checked = true;
    row.appendChild(cb);
    box.appendChild(row);
    exportRows.push({ product: p, cb: cb });
  });
}

function cleanFileName(s) {
  return (s || "").replace(/[\\/:*?"<>|]/g, "").trim() || "produit";
}

function exportFileName(selected) {
  if (selected.length === 1) return cleanFileName(selected[0].name) + ".json";
  let joined = selected.map(function (p) { return cleanFileName(p.name); }).join(", ");
  if (joined.length > 60) joined = "produits (" + selected.length + ")";
  return joined + ".json";
}

async function doExport() {
  const selected = exportRows.filter(function (r) { return r.cb.checked; }).map(function (r) { return r.product; });
  if (!selected.length) { setExStatus("Coche au moins un produit.", "error"); return; }
  try {
    const res = await Catalog.exportCatalog({ version: 3, products: selected }, exportFileName(selected));
    if (res.ok) {
      goGenerate();
      setStatus(selected.length + " produit(s) exporté(s) ✓", "ok");
    }
  } catch (e) {
    setExStatus("Erreur export : " + (e && e.message ? e.message : e), "error");
  }
}

function setExStatus(m, k) { const s = el("exStatus"); s.textContent = m || ""; s.className = k || ""; }

/* Import : n'écrase JAMAIS — chaque produit importé est ajouté avec de nouveaux identifiants. */
async function onImport() {
  try {
    const res = await Catalog.importCatalog();
    if (!res.ok) return;
    const incoming = (res.catalog && res.catalog.products) || [];
    const names = catalog.products.map(function (p) { return p.name; });
    let count = 0;
    incoming.forEach(function (p) {
      const copy = JSON.parse(JSON.stringify(p));
      copy.id = Catalog.uuid();
      (copy.subproducts || []).forEach(function (s) {
        s.id = Catalog.uuid();
        (s.fields || []).forEach(function (f) { f.id = Catalog.uuid(); });
      });
      if (names.indexOf(copy.name) >= 0) copy.name = copy.name + " (importé)";
      catalog.products.push(copy);
      count++;
    });
    await persist();
    onCatalogChanged();
    setStatus(count + " produit(s) importé(s) ✓ — rien n'a été écrasé.", "ok");
  } catch (e) {
    setStatus("Erreur import : " + (e && e.message ? e.message : e), "error");
  }
}
