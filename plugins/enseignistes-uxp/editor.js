/*
 * editor.js — v3
 * Vue Produit : nom + liste des sous-produits.
 * Vue Sous-produit : nom + champs (avec sortie personnalisée par choix) + modèle de texte libre.
 * Piloté par index.js : setupEditor({ catalog, save, onChanged, goGenerate, goProduct, goSub }).
 */

const Catalog = require("./catalog.js");

let D = null;
let pvProdId = null;
let seProdId = null;
let seSubId = null;
let collapsedFields = {};
let advancedMode = false;

function applyAdvanced() {
  const v = document.getElementById("subView");
  if (v) v.classList.toggle("show-advanced", advancedMode);
}

const FIELD_TYPES = [
  { value: "text", label: "Texte libre" },
  { value: "dropdown", label: "Liste de choix" }
];

function el(id) { return document.getElementById(id); }

function fillMenu(dropdownEl, options, selIdx) {
  const menu = dropdownEl.querySelector("sp-menu");
  menu.innerHTML = "";
  options.forEach(function (opt, i) {
    const item = document.createElement("sp-menu-item");
    item.textContent = opt;
    if (i === selIdx) item.selected = true;
    menu.appendChild(item);
  });
  if (selIdx != null && selIdx >= 0) dropdownEl.selectedIndex = selIdx;
}

function mkBtn(txt, fn) {
  const b = document.createElement("sp-button");
  b.setAttribute("size", "s");
  b.setAttribute("variant", "secondary");
  b.textContent = txt;
  b.addEventListener("click", fn);
  return b;
}

function confirmButton(btn, action) {
  if (btn._armed) {
    btn._armed = false;
    btn.textContent = btn._label;
    action();
  } else {
    btn._armed = true;
    btn._label = btn.textContent;
    btn.textContent = "Confirmer ?";
    setTimeout(function () {
      if (btn._armed) { btn._armed = false; btn.textContent = btn._label; }
    }, 3000);
  }
}

function getProd(id) { return (D.catalog.products || []).filter(function (p) { return p.id === id; })[0] || null; }
function getSub() {
  const p = getProd(seProdId);
  return p ? (p.subproducts || []).filter(function (s) { return s.id === seSubId; })[0] || null : null;
}

/* ----------------------------------------------------------------- mise en place */

function setupEditor(deps) {
  D = deps;

  // --- Produit ---
  el("pvBack").addEventListener("click", function () { D.save(); D.goGenerate(pvProdId); });
  el("pvName").addEventListener("input", function () { const p = getProd(pvProdId); if (p) p.name = el("pvName").value; });
  el("pvName").addEventListener("change", function () { D.save(); D.onChanged(); });
  el("pvAddSub").addEventListener("click", function () {
    const p = getProd(pvProdId); if (!p) return;
    const s = { id: Catalog.uuid(), name: "Nouveau sous-produit", fields: [], template: "" };
    p.subproducts.push(s);
    D.save();
    D.goSub(pvProdId, s.id);
  });
  el("pvDelete").addEventListener("click", function () {
    confirmButton(el("pvDelete"), function () {
      D.catalog.products = D.catalog.products.filter(function (p) { return p.id !== pvProdId; });
      D.save(); D.onChanged(); D.goGenerate();
    });
  });

  // --- Sous-produit ---
  el("seBack").addEventListener("click", function () {
    D.save(); D.onChanged();
    const s = getSub();
    if (s && s.builtin) D.goGenerate();   // modèle de base : retour à la génération
    else D.goProduct(seProdId);
  });
  el("seResetBuiltin").addEventListener("click", function () {
    confirmButton(el("seResetBuiltin"), function () { D.resetBuiltin(seSubId); });
  });
  el("seName").addEventListener("input", function () { const s = getSub(); if (s) s.name = el("seName").value; });
  el("seName").addEventListener("change", function () { D.save(); });
  el("seAdvanced").addEventListener("change", function () { advancedMode = el("seAdvanced").checked; applyAdvanced(); });
  el("seAddField").addEventListener("click", function () {
    const s = getSub(); if (!s) return;
    s.fields.push({ id: Catalog.uuid(), label: "Champ", type: "text", options: [] });
    D.save(); renderSeFields(s); renderTokens(s); updatePreview();
  });
  el("seAddSeg").addEventListener("click", function () {
    const s = getSub(); if (!s) return;
    ensureSegArray(s);
    s.template.push("");
    D.save(); renderSegments(s); updatePreview();
  });
  el("seSave").addEventListener("click", function () { D.save(); D.onChanged(); setSe("Enregistré ✓", "ok"); });
  el("seDelete").addEventListener("click", function () {
    confirmButton(el("seDelete"), function () {
      const p = getProd(seProdId);
      if (p) p.subproducts = p.subproducts.filter(function (s) { return s.id !== seSubId; });
      D.save(); D.onChanged(); D.goProduct(seProdId);
    });
  });

  return { renderProduct: renderProduct, renderSub: renderSub };
}

/* --------------------------------------------------------------- vue Produit */

function renderProduct(prodId) {
  pvProdId = prodId;
  const p = getProd(prodId);
  if (!p) { D.goGenerate(); return; }
  el("pvName").value = p.name;
  renderPvSubs(p);
  setPv("", "");
}

function renderPvSubs(prod) {
  const box = el("pvSubs");
  box.innerHTML = "";
  (prod.subproducts || []).forEach(function (s) {
    const row = document.createElement("div");
    row.className = "mg-prod-row";
    const open = document.createElement("sp-button");
    open.setAttribute("variant", "secondary");
    open.className = "grow";
    open.textContent = s.name || "(sans nom)";
    open.addEventListener("click", function () { D.goSub(prod.id, s.id); });

    const dup = mkBtn("Dupliquer", function () {
      const copy = JSON.parse(JSON.stringify(s));
      copy.id = Catalog.uuid();
      copy.name = (s.name || "Sous-produit") + " (copie)";
      (copy.fields || []).forEach(function (f) { f.id = Catalog.uuid(); });
      prod.subproducts.push(copy);
      D.save(); D.onChanged(); renderPvSubs(prod);
    });

    const del = mkBtn("✕", function () {
      confirmButton(del, function () {
        prod.subproducts = prod.subproducts.filter(function (x) { return x.id !== s.id; });
        D.save(); D.onChanged(); renderPvSubs(prod);
      });
    });

    row.appendChild(open);
    row.appendChild(dup);
    row.appendChild(del);
    box.appendChild(row);
  });
  if ((prod.subproducts || []).length === 0) {
    const e = document.createElement("div");
    e.className = "note";
    e.textContent = "Aucun sous-produit. Touche « + Nouveau sous-produit ».";
    box.appendChild(e);
  }
}

/* --------------------------------------------------------------- vue Sous-produit */

function renderSub(prodId, subId) {
  seProdId = prodId;
  seSubId = subId;
  const s = getSub();
  if (!s) { D.goProduct(prodId); return; }
  el("seName").value = s.name;
  el("seAdvanced").checked = advancedMode;
  applyAdvanced();
  collapsedFields = {};
  (s.fields || []).forEach(function (f) { collapsedFields[f.id] = true; }); // volets fermés par défaut
  ensureSegArray(s);
  renderSeFields(s);
  renderTokens(s);
  renderSegments(s);
  updatePreview();
  const isBuiltin = !!s.builtin;
  el("seResetBuiltin").classList.toggle("hidden", !isBuiltin);
  el("seDelete").classList.toggle("hidden", isBuiltin);
  setSe(isBuiltin ? "Modèle de base — modifie librement, réinitialisable." : "", "");
}

function renderSeFields(sub) {
  const box = el("seFields");
  box.innerHTML = "";
  sub.fields.forEach(function (field) {
    box.appendChild(buildFieldCard(sub, field));
  });
}

function buildFieldCard(sub, field) {
  const card = document.createElement("div");
  card.className = "ed-field";

  const row = document.createElement("div");
  row.className = "ed-row";

  const labelInput = document.createElement("sp-textfield");
  labelInput.value = field.label || "";
  labelInput.setAttribute("placeholder", "Libellé du champ");
  labelInput.addEventListener("input", function () { field.label = labelInput.value; renderTokens(sub); updatePreview(); });
  labelInput.addEventListener("change", function () { D.save(); });

  const typeDd = document.createElement("sp-dropdown");
  const tMenu = document.createElement("sp-menu");
  tMenu.setAttribute("slot", "options");
  typeDd.appendChild(tMenu);
  fillMenu(typeDd, FIELD_TYPES.map(function (t) { return t.label; }), field.type === "dropdown" ? 1 : 0);

  const del = mkBtn("✕", function () {
    sub.fields = sub.fields.filter(function (f) { return f.id !== field.id; });
    D.save(); renderSeFields(sub); renderTokens(sub); updatePreview();
  });

  row.appendChild(labelInput);
  row.appendChild(typeDd);
  row.appendChild(del);
  card.appendChild(row);

  // Champ obligatoire ? (sinon optionnel : disparaît du texte s'il est vide)
  const reqRow = document.createElement("div");
  reqRow.className = "ed-req adv";
  const reqCb = document.createElement("sp-checkbox");
  reqCb.textContent = "Obligatoire";
  if (field.required) reqCb.checked = true;
  reqCb.addEventListener("change", function () { field.required = !!reqCb.checked; D.save(); });
  reqRow.appendChild(reqCb);
  card.appendChild(reqRow);

  // --- Affichage conditionnel : n'afficher ce champ que si un autre champ = valeur ---
  const condWrap = document.createElement("div");
  condWrap.className = "ed-cond adv";
  const condCb = document.createElement("sp-checkbox");
  condCb.textContent = "N'afficher que si…";
  condCb.checked = !!field.condition;
  condWrap.appendChild(condCb);
  const condRow = document.createElement("div");
  condRow.className = "ed-row";
  condWrap.appendChild(condRow);
  card.appendChild(condWrap);

  function buildCondUI() {
    condRow.innerHTML = "";
    condRow.classList.toggle("hidden", !field.condition);
    if (!field.condition) return;
    const others = sub.fields.filter(function (f) { return f.id !== field.id; });
    if (!others.length) {
      const n = document.createElement("span");
      n.className = "note";
      n.textContent = "Ajoute un autre champ d'abord.";
      condRow.appendChild(n);
      return;
    }
    if (others.map(function (f) { return f.id; }).indexOf(field.condition.on) < 0) {
      field.condition.on = others[0].id;
    }

    const fd = document.createElement("sp-dropdown");
    const fm = document.createElement("sp-menu");
    fm.setAttribute("slot", "options");
    fd.appendChild(fm);
    let sel = others.map(function (f) { return f.id; }).indexOf(field.condition.on);
    if (sel < 0) sel = 0;
    fillMenu(fd, others.map(function (f) { return f.label || "(sans nom)"; }), sel);
    fd.addEventListener("change", function () {
      field.condition.on = others[fd.selectedIndex].id;
      field.condition.value = "";
      D.save(); buildCondUI(); updatePreview();
    });
    condRow.appendChild(fd);

    const eq = document.createElement("span");
    eq.className = "ed-eq";
    eq.textContent = "=";
    condRow.appendChild(eq);

    const onField = others.filter(function (f) { return f.id === field.condition.on; })[0];
    if (onField && onField.type === "dropdown") {
      const vd = document.createElement("sp-dropdown");
      const vm = document.createElement("sp-menu");
      vm.setAttribute("slot", "options");
      vd.appendChild(vm);
      const opts = (onField.options || []).map(function (o) { return (o && o.label) || ""; });
      let vsel = opts.indexOf(field.condition.value);
      if (vsel < 0) vsel = 0;
      fillMenu(vd, opts, opts.length ? vsel : -1);
      if (opts.length) field.condition.value = opts[vsel];
      vd.addEventListener("change", function () {
        field.condition.value = opts[vd.selectedIndex]; D.save(); updatePreview();
      });
      condRow.appendChild(vd);
    } else {
      const vt = document.createElement("sp-textfield");
      vt.value = field.condition.value || "";
      vt.setAttribute("placeholder", "valeur");
      vt.addEventListener("input", function () { field.condition.value = vt.value; updatePreview(); });
      vt.addEventListener("change", function () { D.save(); });
      condRow.appendChild(vt);
    }
  }

  condCb.addEventListener("change", function () {
    if (condCb.checked) field.condition = field.condition || { on: null, value: "" };
    else delete field.condition;
    D.save(); buildCondUI(); updatePreview();
  });
  buildCondUI();

  // Bloc des choix (Liste) : fixe OU dépendant d'un autre champ (choix par valeur parente)
  const optsBox = document.createElement("div");
  optsBox.className = "ed-opts";

  const depToggle = document.createElement("sp-checkbox");
  depToggle.className = "adv";
  depToggle.textContent = "Les choix dépendent d'un autre champ";
  depToggle.checked = !!field.dependsOn;
  optsBox.appendChild(depToggle);

  const depRow = document.createElement("div");
  depRow.className = "ed-row adv";
  optsBox.appendChild(depRow);

  const optsContent = document.createElement("div");
  optsBox.appendChild(optsContent);
  card.appendChild(optsBox);

  function depCandidates() {
    return sub.fields.filter(function (f) {
      return f.id !== field.id && f.type === "dropdown" && !f.dependsOn;
    });
  }

  function renderOptsArea() {
    depRow.innerHTML = "";
    depRow.classList.toggle("hidden", !depToggle.checked);
    optsContent.innerHTML = "";

    if (!depToggle.checked) {
      delete field.dependsOn;
      if (!field.options) field.options = [];
      const list = document.createElement("div");
      optsContent.appendChild(list);
      const renderFlat = function () {
        list.innerHTML = "";
        field.options.forEach(function (o, i) { list.appendChild(buildOptionRow(field.options, i, renderFlat)); });
      };
      renderFlat();
      optsContent.appendChild(mkBtn("+ Ajouter un choix", function () {
        field.options.push({ label: "", out: "" });
        D.save(); renderFlat(); updatePreview();
      }));
      return;
    }

    const cands = depCandidates();
    if (!cands.length) {
      const n = document.createElement("span");
      n.className = "note";
      n.textContent = "Ajoute d'abord un autre champ « Liste de choix ».";
      depRow.appendChild(n);
      return;
    }
    if (cands.map(function (f) { return f.id; }).indexOf(field.dependsOn) < 0) field.dependsOn = cands[0].id;

    const plabel = document.createElement("span");
    plabel.className = "note"; plabel.textContent = "selon :";
    depRow.appendChild(plabel);
    const pd = document.createElement("sp-dropdown");
    const pm = document.createElement("sp-menu"); pm.setAttribute("slot", "options"); pd.appendChild(pm);
    let psel = cands.map(function (f) { return f.id; }).indexOf(field.dependsOn); if (psel < 0) psel = 0;
    fillMenu(pd, cands.map(function (f) { return f.label || "(sans nom)"; }), psel);
    pd.addEventListener("change", function () {
      field.dependsOn = cands[pd.selectedIndex].id; D.save(); renderOptsArea(); updatePreview();
    });
    depRow.appendChild(pd);

    const parent = cands[psel];
    field.optionGroups = field.optionGroups || {};
    (parent.options || []).forEach(function (po) {
      const pc = (po && po.label) || "";
      field.optionGroups[pc] = field.optionGroups[pc] || [];
      const grp = field.optionGroups[pc];
      const h = document.createElement("div");
      h.className = "ed-grp";
      h.textContent = "Si « " + pc + " » :";
      optsContent.appendChild(h);
      const list = document.createElement("div");
      optsContent.appendChild(list);
      const renderGrp = function () {
        list.innerHTML = "";
        grp.forEach(function (o, i) { list.appendChild(buildOptionRow(grp, i, renderGrp)); });
      };
      renderGrp();
      optsContent.appendChild(mkBtn("+ Ajouter un choix", function () {
        grp.push({ label: "", out: "" });
        D.save(); renderGrp(); updatePreview();
      }));
    });
  }

  depToggle.addEventListener("change", function () {
    D.save(); renderOptsArea(); updatePreview();
  });

  optsBox.classList.toggle("hidden", field.type !== "dropdown" || !!collapsedFields[field.id]);
  renderOptsArea();

  // --- Valeur automatique (champ Texte, avancé) : se remplit selon un autre champ, modifiable ---
  if (field.type === "text") {
    const afBox = document.createElement("div");
    afBox.className = "ed-opts adv";
    const afToggle = document.createElement("sp-checkbox");
    afToggle.textContent = "Valeur automatique selon un autre champ";
    afToggle.checked = !!field.autoFill;
    afBox.appendChild(afToggle);
    const afRow = document.createElement("div");
    afRow.className = "ed-row";
    afBox.appendChild(afRow);
    const afContent = document.createElement("div");
    afBox.appendChild(afContent);
    card.appendChild(afBox);

    const afCandidates = function () {
      return sub.fields.filter(function (f) { return f.id !== field.id && f.type === "dropdown" && !f.dependsOn; });
    };
    const renderAF = function () {
      afRow.innerHTML = "";
      afContent.innerHTML = "";
      afRow.classList.toggle("hidden", !afToggle.checked);
      if (!afToggle.checked) { delete field.autoFill; return; }
      const cands = afCandidates();
      if (!cands.length) {
        const n = document.createElement("span");
        n.className = "note";
        n.textContent = "Ajoute d'abord un champ « Liste de choix ».";
        afRow.appendChild(n);
        return;
      }
      field.autoFill = field.autoFill || { on: cands[0].id, map: {} };
      if (cands.map(function (f) { return f.id; }).indexOf(field.autoFill.on) < 0) {
        field.autoFill.on = cands[0].id; field.autoFill.map = {};
      }
      const pl = document.createElement("span"); pl.className = "note"; pl.textContent = "selon :"; afRow.appendChild(pl);
      const pd = document.createElement("sp-dropdown");
      const pm = document.createElement("sp-menu"); pm.setAttribute("slot", "options"); pd.appendChild(pm);
      let psel = cands.map(function (f) { return f.id; }).indexOf(field.autoFill.on); if (psel < 0) psel = 0;
      fillMenu(pd, cands.map(function (f) { return f.label || "(sans nom)"; }), psel);
      pd.addEventListener("change", function () {
        field.autoFill.on = cands[pd.selectedIndex].id; field.autoFill.map = {}; D.save(); renderAF(); updatePreview();
      });
      afRow.appendChild(pd);
      const parent = cands[psel];
      field.autoFill.map = field.autoFill.map || {};
      (parent.options || []).forEach(function (po) {
        const pc = (po && po.label) || "";
        const r = document.createElement("div"); r.className = "ed-opt-row";
        const lab = document.createElement("span"); lab.className = "note ed-af-lab"; lab.textContent = "Si « " + pc + " » →";
        r.appendChild(lab);
        const vt = document.createElement("sp-textfield");
        vt.value = field.autoFill.map[pc] || "";
        vt.setAttribute("placeholder", "valeur (ex : 70)");
        vt.addEventListener("input", function () { field.autoFill.map[pc] = vt.value; updatePreview(); });
        vt.addEventListener("change", function () { D.save(); });
        r.appendChild(vt);
        afContent.appendChild(r);
      });
    };
    afToggle.addEventListener("change", function () { D.save(); renderAF(); updatePreview(); });
    renderAF();
  }

  typeDd.addEventListener("change", function () {
    field.type = FIELD_TYPES[typeDd.selectedIndex].value;
    if (field.type === "dropdown" && !field.options) field.options = [];
    D.save(); renderSeFields(sub); updatePreview();
  });

  if (field.type === "dropdown") {
    const caret = mkBtn(collapsedFields[field.id] ? "▸" : "▾", function () {
      collapsedFields[field.id] = !collapsedFields[field.id];
      const c = !!collapsedFields[field.id];
      optsBox.classList.toggle("hidden", c);
      caret.textContent = c ? "▸" : "▾";
    });
    row.insertBefore(caret, row.firstChild);
  }

  return card;
}

/* Construit une ligne de choix (libellé + texte généré) dans le tableau `opts` à l'index i. */
function buildOptionRow(opts, i, rerender) {
  if (typeof opts[i] === "string") opts[i] = { label: opts[i], out: "" };
  const opt = opts[i];

  const wrap = document.createElement("div");
  wrap.className = "ed-opt";

  const top = document.createElement("div");
  top.className = "ed-opt-row";
  const lab = document.createElement("sp-textfield");
  lab.value = opt.label || "";
  lab.setAttribute("placeholder", "Choix (ex : 400)");
  lab.addEventListener("input", function () { opt.label = lab.value; updatePreview(); });
  lab.addEventListener("change", function () { D.save(); });
  const x = mkBtn("✕", function () { opts.splice(i, 1); D.save(); rerender(); updatePreview(); });
  top.appendChild(lab);
  top.appendChild(x);
  wrap.appendChild(top);

  const out = document.createElement("sp-textfield");
  out.className = "ed-opt-out";
  out.value = opt.out || "";
  out.setAttribute("placeholder", "Texte généré si différent (ex : 400x1870)");
  out.addEventListener("input", function () { opt.out = out.value; updatePreview(); });
  out.addEventListener("change", function () { D.save(); });
  wrap.appendChild(out);

  return wrap;
}

function renderTokens(sub) {
  const box = el("seTokens");
  box.innerHTML = "";
  const fields = sub.fields || [];
  if (!fields.length) {
    const n = document.createElement("span");
    n.className = "note";
    n.textContent = "(ajoute des champs ci-dessus)";
    box.appendChild(n);
    return;
  }
  fields.forEach(function (f) {
    const tok = "{" + (f.label || "") + "}";
    const chip = mkBtn(tok, function () {
      const s = getSub(); if (!s) return;
      ensureSegArray(s);
      s.template.push(tok);
      D.save(); renderSegments(s); updatePreview();
    });
    box.appendChild(chip);
  });
}

function ensureSegArray(s) {
  if (typeof s.template === "string") {
    s.template = s.template.split(" - ").filter(function (x) { return x.trim() !== ""; });
  }
  if (!Array.isArray(s.template)) s.template = [];
}

function renderSegments(sub) {
  const box = el("seSegments");
  box.innerHTML = "";
  (sub.template || []).forEach(function (seg, i) {
    box.appendChild(buildSegRow(sub, seg, i));
  });
}

function buildSegRow(sub, seg, index) {
  const row = document.createElement("div");
  row.className = "ed-row";
  const tf = document.createElement("sp-textfield");
  tf.value = seg || "";
  tf.setAttribute("placeholder", "Texte ou {étiquette}");
  tf.addEventListener("input", function () { sub.template[index] = tf.value; updatePreview(); });
  tf.addEventListener("change", function () { D.save(); });
  row.appendChild(tf);
  row.appendChild(mkBtn("↑", function () { moveSeg(sub, index, -1); }));
  row.appendChild(mkBtn("↓", function () { moveSeg(sub, index, 1); }));
  row.appendChild(mkBtn("✕", function () {
    sub.template.splice(index, 1);
    D.save(); renderSegments(sub); updatePreview();
  }));
  return row;
}

function moveSeg(sub, index, dir) {
  const j = index + dir;
  if (j < 0 || j >= sub.template.length) return;
  const t = sub.template[index];
  sub.template[index] = sub.template[j];
  sub.template[j] = t;
  D.save(); renderSegments(sub); updatePreview();
}

function updatePreview() {
  const s = getSub();
  if (!s) return;
  el("sePreview").textContent = Catalog.buildText(s, Catalog.defaultValues(s));
}

function setPv(m, k) { const s = el("pvStatus"); s.textContent = m || ""; s.className = k || ""; }
function setSe(m, k) { const s = el("seStatus"); s.textContent = m || ""; s.className = k || ""; }

module.exports = { setupEditor: setupEditor };
