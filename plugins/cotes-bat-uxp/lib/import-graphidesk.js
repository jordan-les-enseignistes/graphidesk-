/*
 * import-graphidesk.js — import d'une fiche VT exportée par GraphiDesk.
 *
 * Consomme le dossier généré par « Exporter la fiche VT (InDesign) » :
 *   - fiche_vt.json : zones (lettre, coins en px photo, cotes provisoires)
 *   - fiche_vt.jpg  : la photo
 *
 * Étapes :
 *   1. l'utilisateur choisit fiche_vt.json (la photo est cherchée à côté) ;
 *   2. la photo est placée dans le bloc image de la PAGE 1 du gabarit
 *      (script label "PHOTO_VT" prioritaire, sinon le plus grand bloc
 *      graphique de la page), ajustée proportionnellement ;
 *   3. les coins de chaque zone sont convertis px photo -> coordonnées page
 *      d'après les bounds réels du graphique placé ;
 *   4. la machinerie de cotes existante (indesign-draw.runOnBlocks) dessine
 *      flèches + losanges + lettres — chaque zone garde SA lettre GraphiDesk ;
 *   5. le tableau des dimensions est ajusté au nombre de zones (lettres).
 */

let indesign = null;
try { indesign = require("indesign"); } catch (e) { /* hors InDesign (tests) */ }

const draw = require("./indesign-draw");

/* ---------- utilitaires ---------- */

function pageByIndex(doc, idx) {
  try { return doc.pages.item(idx); } catch (e) { return null; }
}

/* Bloc photo de la page : script label "PHOTO_VT" prioritaire,
 * sinon le plus grand rectangle de la page (un bloc photo VIDE n'a ni
 * graphics ni forcément contentType GRAPHIC_TYPE : on ne filtre donc
 * pas sur le contenu — sur cette page, le plus grand rectangle est
 * toujours le bloc photo). */
function findPhotoFrame(page) {
  let biggest = null;
  let biggestArea = 0;
  const rects = page.rectangles;
  for (let i = 0; i < rects.length; i++) {
    const r = rects.item(i);
    try {
      const lbl = String(r.label || "");
      if (lbl === "PHOTO_VT") return r;
      const b = r.geometricBounds; // [y1, x1, y2, x2]
      const area = Math.abs(b[2] - b[0]) * Math.abs(b[3] - b[1]);
      if (area > biggestArea) { biggest = r; biggestArea = area; }
    } catch (e) {}
  }
  return biggest;
}

/* Place la photo dans le bloc et retourne les bounds du graphique placé. */
function placePhoto(frame, photoPath) {
  try {
    frame.place(photoPath);
  } catch (e) {
    throw new Error("place(photo) : " + (e && e.message ? e.message : e));
  }
  try {
    frame.fit(indesign.FitOptions.PROPORTIONALLY);
    frame.fit(indesign.FitOptions.CENTER_CONTENT);
  } catch (e) {}
  try {
    const g = frame.graphics.item(0);
    return g.geometricBounds; // [y1, x1, y2, x2] du graphique (photo) sur la page
  } catch (e) {
    // repli : bounds du bloc
    return frame.geometricBounds;
  }
}

/* px photo -> coordonnées page, d'après les bounds du graphique placé */
function makeMapper(gb, photoW, photoH) {
  const y1 = gb[0], x1 = gb[1], y2 = gb[2], x2 = gb[3];
  const sx = (x2 - x1) / photoW;
  const sy = (y2 - y1) / photoH;
  return function (pt) {
    return { x: x1 + pt.x * sx, y: y1 + pt.y * sy };
  };
}

/* ---------- fiches disponibles ----------
 * GraphiDesk exporte dans Documents\GraphiDesk\fiches_vt\{horodatage}_{projet}\.
 * Les dossiers sont préfixés par la date (AAAA-MM-JJ_HH-mm-ss) : le tri
 * alphabétique décroissant donne du plus récent au plus ancien. */
async function listFiches() {
  const out = [];
  try {
    const os = require("os");
    const fs = require("fs");
    const base = os.homedir().replace(/\\/g, "/") + "/Documents/GraphiDesk/fiches_vt";
    const entries = await fs.readdir(base);
    const candidates = entries.slice().sort().reverse();
    for (let i = 0; i < candidates.length; i++) {
      try {
        const sub = await fs.readdir(base + "/" + candidates[i]);
        if (sub.indexOf("fiche_vt.json") !== -1) {
          out.push({
            folder: candidates[i],
            jsonPath: base + "/" + candidates[i] + "/fiche_vt.json"
          });
        }
      } catch (e) { /* pas un dossier : suivant */ }
    }
  } catch (e) { /* dossier absent / fs indisponible */ }
  return out;
}

async function readFicheAt(jsonPath) {
  const fs = require("fs");
  const txt = await fs.readFile(jsonPath, { encoding: "utf-8" });
  return JSON.parse(typeof txt === "string" ? txt : String(txt));
}

/* ---------- tableau des dimensions ----------
 * Structure réelle du gabarit (vérifiée dans l'IDML) : 4 tableaux !
 *   - 2 bandeaux "LARGEUR | HAUTEUR" : tableaux d'UNE ligne, 2 colonnes ;
 *   - 2 tableaux de cotes : 9 lignes × 3 colonnes (lettre, L, H), SANS
 *     ligne d'en-tête.
 * On remplit les lettres dans les tableaux de cotes (gauche puis droite),
 * on supprime les lignes en trop, et si la colonne de droite est
 * inutilisée on retire son tableau ET son bandeau. Jamais d'ajout de
 * ligne : au-delà de la capacité (18), avertissement. */
function updateTables(page, letters) {
  try {
    const frames = [];
    const tfs = page.textFrames;
    for (let i = 0; i < tfs.length; i++) {
      try {
        const tf = tfs.item(i);
        if (tf.tables.length > 0) {
          frames.push({ tf: tf, table: tf.tables.item(0), x: tf.geometricBounds[1] });
        }
      } catch (e) {}
    }
    const bigs = [];
    const banners = [];
    for (let i = 0; i < frames.length; i++) {
      let n = 0;
      try { n = frames[i].table.rows.length; } catch (e) {}
      (n > 1 ? bigs : banners).push(frames[i]);
    }
    if (!bigs.length) return "tableau de cotes introuvable";
    bigs.sort(function (a, b) { return a.x - b.x; });

    let li = 0;
    let capacity = 0;
    for (let t = 0; t < bigs.length; t++) {
      const rows = bigs[t].table.rows;
      const n = rows.length;
      capacity += n;
      const keep = Math.min(Math.max(letters.length - li, 0), n);

      if (keep === 0) {
        // colonne entière inutilisée : retirer le tableau + son bandeau
        // LARGEUR/HAUTEUR (celui dont le X est le plus proche).
        let hdr = -1, best = Infinity;
        for (let h = 0; h < banners.length; h++) {
          const dx = Math.abs(banners[h].x - bigs[t].x);
          if (dx < best) { best = dx; hdr = h; }
        }
        try { bigs[t].tf.remove(); } catch (e) {}
        if (hdr >= 0) {
          try { banners[hdr].tf.remove(); banners.splice(hdr, 1); } catch (e) {}
        }
        continue;
      }

      for (let r = 0; r < keep; r++) {
        try { rows.item(r).cells.item(0).contents = String(letters[li]); } catch (e) {}
        li++;
      }
      for (let r = n - 1; r >= keep; r--) {
        try { rows.item(r).remove(); } catch (e) {}
      }
    }
    if (letters.length > capacity) {
      return "tableau plein (" + capacity + " lignes) : " + (letters.length - capacity) +
        " cote(s) sans ligne — ajoute-les à la main";
    }
    return null;
  } catch (e) {
    return "tableau : " + (e && e.message ? e.message : e);
  }
}

/* ---------- point d'entrée (async : lecture fichier) ---------- */

async function importFiche(selectedJsonPath) {
  if (!indesign || !indesign.app.documents.length) {
    return { ok: false, msg: "Ouvre d'abord le gabarit VT dans InDesign." };
  }

  // 1. fiche choisie dans le volet (sinon la plus récente, sinon choix manuel)
  let fiche = null;
  let jsonPath = selectedJsonPath || null;
  let sourceLabel = "";

  if (!jsonPath) {
    const fiches = await listFiches();
    if (fiches.length) jsonPath = fiches[0].jsonPath;
  }

  if (jsonPath) {
    try {
      fiche = await readFicheAt(jsonPath);
    } catch (e) {
      return { ok: false, msg: "Fiche illisible : " + (e && e.message ? e.message : e) };
    }
    sourceLabel = jsonPath.split("/").slice(-2, -1)[0] || "fiche";
  } else {
    const fsProvider = require("uxp").storage.localFileSystem;
    const file = await fsProvider.getFileForOpening({ types: ["json"] });
    if (!file) return { ok: false, msg: "Aucune fiche trouvée et import annulé." };
    try {
      fiche = JSON.parse(await file.read());
    } catch (e) {
      return { ok: false, msg: "JSON illisible : " + (e && e.message ? e.message : e) };
    }
    jsonPath = file.nativePath.replace(/\\/g, "/");
    sourceLabel = jsonPath.split("/").slice(-2, -1)[0] || "fiche";
  }

  // normalisation v1/v2 : liste de pages (v1 = une seule, champs racine)
  let pagesData = null;
  if (fiche && fiche.pages && fiche.pages.length) {
    pagesData = fiche.pages;
  } else if (fiche && fiche.zones && fiche.zones.length) {
    pagesData = [{
      face: null,
      photoFile: fiche.photoFile,
      photoWidth: fiche.photoWidth,
      photoHeight: fiche.photoHeight,
      zones: fiche.zones
    }];
  }
  if (!pagesData || !pagesData.some(function (p) { return p.zones && p.zones.length; })) {
    return { ok: false, msg: "Aucune zone dans la fiche." };
  }
  pagesData = pagesData.filter(function (p) { return p.zones && p.zones.length; });

  const doc = indesign.app.activeDocument;
  // ⚠ PAGE 1 depuis le gabarit VT de septembre 2026 : photo, cotes et tableau
  // sont passés de la page 2 à la page 1. Un document fait sur l'ANCIEN
  // gabarit n'est plus pris en charge (choix de Jordan, 11/09/2026).
  const tpl = pageByIndex(doc, 0);
  if (!tpl) return { ok: false, msg: "Page 1 introuvable dans le document." };
  if (!findPhotoFrame(tpl)) {
    return {
      ok: false,
      msg: "Bloc photo introuvable page 1. Donne le script label PHOTO_VT au bloc image."
    };
  }

  // multi-faces : dupliquer la page gabarit VIERGE (une page par face,
  // dans l'ordre des faces) AVANT tout placement
  const targetPages = [tpl];
  try {
    let ref = tpl;
    for (let d = 1; d < pagesData.length; d++) {
      const np = tpl.duplicate(indesign.LocationOptions.AFTER, ref);
      targetPages.push(np);
      ref = np;
    }
  } catch (e) {
    return {
      ok: false,
      msg: "Duplication de la page gabarit impossible : " + (e && e.message ? e.message : e)
    };
  }

  // 3. par page : placement + mapping + cotes + tableau
  let total = 0, attendu = 0;
  const warns = [];

  const workPage = function (page, pdata) {
    const photoPath = jsonPath.replace(/[^/]+$/, pdata.photoFile || "fiche_vt.jpg");
    const frame = findPhotoFrame(page);
    if (!frame) {
      warns.push((pdata.face || "page") + " : bloc photo introuvable");
      return;
    }
    // IMPORTANT : la machinerie de dessin travaille en POINTS. On lit donc
    // les bounds de la photo placée dans la MÊME unité, sinon les cotes
    // sont mappées en mm et dessinées en pt (tout tassé en haut à gauche).
    const placed = draw.withPoints(doc, function () {
      return placePhoto(frame, photoPath);
    });
    const map = makeMapper(placed, pdata.photoWidth, pdata.photoHeight);

    const blocks = pdata.zones.map(function (z) {
      const corners = (z.corners || []).map(map);
      const xs = corners.map(function (p) { return p.x; });
      const ys = corners.map(function (p) { return p.y; });
      return {
        item: null,
        // lettre d'AFFICHAGE (suite propre A,B,C... continue sur toute la
        // fiche) ; repli sur la lettre technique pour les anciennes fiches
        letter: z.displayLetter || z.letter,
        corners: corners.length === 4 ? corners : null,
        bounds: [
          Math.min.apply(null, ys), Math.min.apply(null, xs),
          Math.max.apply(null, ys), Math.max.apply(null, xs)
        ]
      };
    });

    // spread de la page (les cotes doivent tomber sur la bonne planche)
    let spread = null;
    try { spread = page.parent; } catch (e) {}

    const res = draw.runOnBlocks(blocks, { spread: spread });
    attendu += blocks.length;
    total += res.count;
    if (res.err) warns.push(res.err);

    // tableau : en une seule étape d'annulation
    let tableErr = null;
    const letters = pdata.zones.map(function (z) { return z.displayLetter || z.letter; });
    const tfn = function () { tableErr = updateTables(page, letters); };
    try {
      indesign.app.doScript(
        tfn, indesign.ScriptLanguage.JAVASCRIPT, [],
        indesign.UndoModes.ENTIRE_SCRIPT, "Tableau cotes GraphiDesk"
      );
    } catch (e) { tfn(); }
    if (tableErr) warns.push((pdata.face ? pdata.face + " — " : "") + tableErr);
  };

  let result = { ok: false, msg: "?" };
  try {
    for (let p = 0; p < pagesData.length; p++) {
      workPage(targetPages[p], pagesData[p]);
    }
    let msg = total + "/" + attendu + " cotes générées";
    if (pagesData.length > 1) msg += " sur " + pagesData.length + " pages (une par face)";
    msg += " — fiche : " + sourceLabel;
    if (warns.length) msg += " — ⚠ " + warns.join(" ; ");
    result = { ok: total > 0, msg: msg };
  } catch (e) {
    result = { ok: false, msg: "Erreur : " + (e && e.message ? e.message : e) };
  }
  return result;
}

module.exports = { importFiche: importFiche, listFiches: listFiches };
