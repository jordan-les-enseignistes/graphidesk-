/*
 * index.js — panneau Cotes BAT.
 * Lit la sélection, génère les cotes, fait avancer la lettre.
 */

const { entrypoints } = require("uxp");

// repli si l'API manifest est indisponible — synchronisé au packaging
const PANEL_VERSION = "0.5.3";
const geom = require("./lib/geometry");
const draw = require("./lib/indesign-draw");
const importer = require("./lib/import-graphidesk");

entrypoints.setup({
  panels: {
    cotesPanel: {
      show: function () { refreshFiches(); }
    }
  }
});

/* "AAAA-MM-JJ_HH-mm-ss_nom" -> "nom — JJ/MM HH:mm" */
function ficheLabel(folder) {
  const m = folder.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})_(.+)$/);
  if (!m) return folder;
  return m[7].replace(/-/g, " ") + " — " + m[3] + "/" + m[2] + " " + m[4] + ":" + m[5];
}

/* Remplit le volet des fiches GraphiDesk. La première option "(dernière
 * fiche exportée)" est résolue AU MOMENT de l'import : pas besoin de
 * rafraîchir ni de redémarrer après un nouvel export GraphiDesk. */
async function refreshFiches() {
  const sel = document.getElementById("ficheSelect");
  if (!sel) return;
  let list = [];
  try { list = await importer.listFiches(); } catch (e) {}
  const prev = sel.value;
  sel.innerHTML = "";
  const auto = document.createElement("option");
  auto.value = "auto";
  auto.textContent = "⟳ Dernière fiche exportée";
  sel.appendChild(auto);
  list.forEach(function (f) {
    const o = document.createElement("option");
    o.value = f.jsonPath;
    o.textContent = ficheLabel(f.folder);
    sel.appendChild(o);
  });
  // conserver la sélection si elle existe encore, sinon le mode auto
  if (prev && prev !== "auto" && list.some(function (f) { return f.jsonPath === prev; })) {
    sel.value = prev;
  } else {
    sel.value = "auto";
  }
}

function setStatus(msg, kind) {
  const el = document.getElementById("status");
  if (!el) return;
  el.textContent = msg || "";
  el.className = "status" + (kind ? " " + kind : "");
}

function onGenerate() {
  let indesign;
  try { indesign = require("indesign"); } catch (e) {
    setStatus("InDesign indisponible.", "error");
    return;
  }
  if (!indesign.app.documents.length || !indesign.app.activeDocument) {
    setStatus("Ouvre d'abord un document.", "error");
    return;
  }

  const field = document.getElementById("nextLetter");
  let startIndex = geom.indexFromLetter(field ? field.value : "A");
  if (startIndex < 0) startIndex = 0;

  try {
    const res = draw.run({ startIndex: startIndex });

    if (!res || res.count === 0) {
      setStatus("Sélectionne au moins un bloc sur la photo.", "error");
      return;
    }
    if (field) field.value = geom.letterFromIndex(res.nextIndex);
    const L = res.letters || {};
    let msg = res.count + (res.count > 1 ? " cotes" : " cote")
      + " — lettres : " + (L.vector || 0) + " vecto, " + (L.live || 0) + " texte, " + (L.none || 0) + " échec.";
    if (res.err) msg += "\n⚠ " + res.err;
    setStatus(msg, res.err ? "" : "ok");
    if (res.err) console.error("Cotes BAT — vecto KO:", res.err);
  } catch (e) {
    setStatus("Erreur : " + (e && e.message ? e.message : e), "error");
    console.error(e);
  }
}

async function onImport() {
  setStatus("Import en cours...", "");
  try {
    const sel = document.getElementById("ficheSelect");
    const v = sel ? sel.value : "auto";
    // "auto" -> null : importFiche rescanne le disque et prend la plus récente
    const res = await importer.importFiche(v && v !== "auto" ? v : null);
    setStatus(res.msg, res.ok ? "ok" : "error");
    refreshFiches();
  } catch (e) {
    setStatus("Erreur import : " + (e && e.message ? e.message : e), "error");
    console.error(e);
  }
}

/* Affiche la version du plugin en pied de panneau.
 * 3 sources, par ordre de fiabilité : API manifest UXP, lecture directe
 * du manifest.json du plugin, constante embarquée. */
async function showVersion() {
  const el = document.getElementById("version");
  if (!el) return;
  let v = "";
  try { v = require("uxp").plugin.manifest.version; } catch (e) {}
  if (!v) {
    try {
      const folder = await require("uxp").storage.localFileSystem.getPluginFolder();
      const f = await folder.getEntry("manifest.json");
      v = JSON.parse(await f.read()).version;
    } catch (e) {}
  }
  el.textContent = "Cotes BAT v" + (v || PANEL_VERSION);
}

function bind() {
  const btn = document.getElementById("btnGenerate");
  if (btn) btn.addEventListener("click", onGenerate);
  const btnImp = document.getElementById("btnImport");
  if (btnImp) btnImp.addEventListener("click", onImport);
  const btnR = document.getElementById("btnRefresh");
  if (btnR) btnR.addEventListener("click", function () { refreshFiches(); });
  const sel = document.getElementById("ficheSelect");
  if (sel) sel.addEventListener("mousedown", function () { refreshFiches(); });
  refreshFiches();
  showVersion();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bind);
} else {
  bind();
}
