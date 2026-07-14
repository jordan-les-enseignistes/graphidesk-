/*
 * indesign-draw.js — couche InDesign (DOM) pour Cotes BAT.
 *
 * Pour chaque forme sélectionnée :
 *   - lit les vrais points du tracé (entirePath) -> croix qui épouse la forme ;
 *   - 2 tracés (flèches) avec embouts NATIFS alignés sur le bout ;
 *   - losange bleu ;
 *   - lettre VECTORISÉE (createOutlines) mise à l'échelle + centrée, avec repli
 *     en texte vivant si la vectorisation échoue.
 *
 * Robustesse : chaque cote est isolée dans un try/catch ; AUCUNE exception ne
 * remonte -> la boucle va au bout (multi-blocs) et doScript regroupe tout en
 * une seule annulation (un seul Ctrl+Z). On travaille en POINTS puis on restaure.
 */

let indesign = null;
try { indesign = require("indesign"); } catch (e) { /* hors InDesign (tests) */ }

const geom = require("./geometry");

function existingSwatch(doc, name) {
  try {
    const s = doc.swatches.itemByName(name);
    if (s && s.isValid) return s;
  } catch (e) {}
  return null;
}

function ensureRGB(doc, name, rgb, fallbackName) {
  const found = existingSwatch(doc, name);
  if (found) return found;
  try {
    const c = doc.colors.add();
    c.name = name;
    c.model = indesign.ColorModel.PROCESS;
    c.space = indesign.ColorSpace.RGB;
    c.colorValue = rgb;
    return c;
  } catch (e) {
    return existingSwatch(doc, fallbackName) || existingSwatch(doc, "Black");
  }
}

function noneSwatch(doc) { return existingSwatch(doc, "None"); }

function withPoints(doc, fn) {
  const vp = doc.viewPreferences;
  const h = vp.horizontalMeasurementUnits;
  const v = vp.verticalMeasurementUnits;
  try {
    vp.horizontalMeasurementUnits = indesign.MeasurementUnits.POINTS;
    vp.verticalMeasurementUnits = indesign.MeasurementUnits.POINTS;
  } catch (e) {}
  try {
    return fn();
  } finally {
    try {
      vp.horizontalMeasurementUnits = h;
      vp.verticalMeasurementUnits = v;
    } catch (e) {}
  }
}

/* Points (coins) de la forme en coordonnées planche, ou null si transformée. */
function getCorners(item) {
  try {
    if (Math.abs(item.rotationAngle || 0) > 0.01 || Math.abs(item.shearAngle || 0) > 0.01) return null;
  } catch (e) {}
  try {
    const ep = item.paths.item(0).entirePath;
    if (!ep || !ep.length) return null;
    return ep.map(function (e) {
      return Array.isArray(e[0]) ? { x: e[1][0], y: e[1][1] } : { x: e[0], y: e[1] };
    });
  } catch (e) { return null; }
}

/* Trait simple (la tête de flèche est un triangle dessiné à part). */
function drawLine(spread, layer, seg, stroke, none, weight) {
  const gl = spread.graphicLines.add(layer);
  try { gl.paths.item(0).entirePath = [[seg.x1, seg.y1], [seg.x2, seg.y2]]; }
  catch (e) { gl.geometricBounds = [seg.y1, seg.x1, seg.y2, seg.x2]; }
  gl.strokeWeight = weight;
  gl.strokeColor = stroke;
  try { gl.fillColor = none; } catch (e) {}
  return gl;
}

function drawPolygon(spread, layer, points, fill, strokeColor, strokeWeight) {
  const poly = spread.polygons.add(layer);
  try { poly.paths.item(0).entirePath = points; } catch (e) {}
  poly.fillColor = fill;
  try { poly.strokeColor = strokeColor; } catch (e) {}
  if (strokeWeight) { try { poly.strokeWeight = strokeWeight; } catch (e) {} }
  return poly;
}

function groupItems(doc, spread, items) {
  if (!items || items.length < 2) return (items && items[0]) || null;
  try { return doc.groups.add(items); } catch (e) {}
  try { return spread.groups.add(items); } catch (e) {}
  return items[0];
}

/* Lettre VECTORISÉE : centrage géométrique parfait + mise à l'échelle libre.
 * Pattern fiable : createOutlines renvoie UN objet (ancré) -> on le DUPLIQUE
 * sur la planche (rebind sur la valeur de retour) -> on supprime le bloc EN
 * DERNIER -> on relit les bounds après chaque transfo. Renvoie l'objet ou null. */
function tryVectorLetter(doc, spread, layer, letter, color, none, targetH, center) {
  let tf = null, item = null, err = null;
  try {
    tf = spread.textFrames.add(layer);
    tf.geometricBounds = [0, 0, 300, 300];
    tf.contents = letter;
    const txt = tf.texts.item(0);
    txt.pointSize = 200;
    txt.fillColor = color;        // blanc AVANT vectorisation -> le vecteur l'hérite
    try { txt.fontStyle = "Bold"; } catch (e) {}

    const made = txt.createOutlines(true); // tableau de PageItem (ancrés dans le bloc)
    let src = [];
    if (Array.isArray(made)) src = made;
    else if (made && typeof made.everyItem === "function") { try { src = made.everyItem().getElements(); } catch (e) { src = []; } }
    else if (made && typeof made.length === "number") { for (let k = 0; k < made.length; k++) src.push(made[k]); }
    else if (made) src = [made];

    // Dupliquer chaque contour SUR la planche (rebind sur la valeur de retour).
    const dups = [];
    for (let k = 0; k < src.length; k++) {
      const o = src[k];
      let d = null;
      try { d = o.duplicate(spread); }
      catch (e) {
        try { d = o.move(spread); }
        catch (e2) { err = "dup/move: " + (e2 && e2.message ? e2.message : e2); }
      }
      if (d) dups.push(d);
    }
    item = (dups.length > 1) ? groupItems(doc, spread, dups) : (dups[0] || null);
    if (!item && !err) err = "aucun contour extrait (" + src.length + " src)";
  } catch (e) { item = null; err = "outlines: " + (e && e.message ? e.message : e); }

  // Supprimer le bloc texte EN DERNIER, une fois qu'on tient un objet libre.
  try { if (tf && tf.isValid) tf.remove(); } catch (e) {}

  try {
    if (!item || item.isValid === false) return { item: null, err: err || "objet vecteur invalide" };
    try { item.fillColor = color; } catch (e) {}
    try { item.strokeColor = none; } catch (e) {} // pas de contour -> centre = boîte d'encre

    let gb = item.geometricBounds;
    const h0 = gb[2] - gb[0];
    if (h0 > 0.01 && isFinite(h0)) {
      const s = targetH / h0;
      try {
        item.resize(
          indesign.CoordinateSpaces.INNER_COORDINATES,
          indesign.AnchorPoint.CENTER_ANCHOR,
          indesign.ResizeMethods.MULTIPLYING_CURRENT_DIMENSIONS_BY,
          [s, s]
        );
      } catch (e) { err = "resize: " + (e && e.message ? e.message : e); }
    }
    gb = item.geometricBounds; // RELIRE après resize
    const w = gb[3] - gb[1], h = gb[2] - gb[0];
    if (!isFinite(w) || !isFinite(h) || w <= 0.01 || h <= 0.01) {
      try { item.remove(); } catch (e) {}
      return { item: null, err: err || "vecteur taille nulle" };
    }
    try { item.move([center.x - w / 2, center.y - h / 2]); } catch (e) {}
    try { item.bringToFront(); } catch (e) {}
    return { item: item, err: null };
  } catch (e) { return { item: null, err: "post: " + (e && e.message ? e.message : e) }; }
}

/* Repli : texte vivant (centrage approché) + boucle anti-débordement. */
function liveTextLetter(spread, layer, center, letter, color, none, targetH) {
  try {
    const half = targetH * 1.6;
    const tf = spread.textFrames.add(layer);
    tf.geometricBounds = [center.y - half, center.x - half, center.y + half, center.x + half];
    try { tf.fillColor = none; } catch (e) {}
    try { tf.strokeColor = none; } catch (e) {}
    try { tf.textFramePreferences.autoSizingType = indesign.AutoSizingTypeEnum.OFF; } catch (e) {}
    try { tf.textFramePreferences.insetSpacing = [0, 0, 0, 0]; } catch (e) {}
    try { tf.textFramePreferences.firstBaselineOffset = indesign.FirstBaseline.CAP_HEIGHT; } catch (e) {}
    try { tf.textFramePreferences.verticalJustification = indesign.VerticalJustification.CENTER_ALIGN; } catch (e) {}
    tf.contents = letter;

    let txt = null;
    try {
      txt = tf.texts.item(0);
      txt.fillColor = color;
      try { txt.justification = indesign.Justification.CENTER_ALIGN; } catch (e) {}
      try { txt.fontStyle = "Bold"; } catch (e) {}
    } catch (e) {}

    if (txt) {
      let size = targetH * 1.2, guard = 0;
      while (guard < 40) {
        try { txt.pointSize = size; } catch (e) { break; }
        try { txt.leading = size; } catch (e) {}
        let over = false;
        try { over = !!tf.overflows; } catch (e) { over = false; }
        if (!over) break;
        size *= 0.85;
        guard++;
      }
    }
    try { tf.bringToFront(); } catch (e) {}
    return tf;
  } catch (e) { return null; }
}

function drawLetter(doc, spread, layer, center, letter, color, none, targetH) {
  const v = tryVectorLetter(doc, spread, layer, letter, color, none, targetH, center);
  if (v.item) return { item: v.item, mode: "vector", err: null };
  const l = liveTextLetter(spread, layer, center, letter, color, none, targetH);
  return { item: l, mode: l ? "live" : "none", err: v.err };
}

function clearBlock(item, none) {
  try { item.fillColor = none; } catch (e) {}
  try { item.strokeColor = none; } catch (e) {}
}

function readSelection() {
  const sel = indesign.app.selection;
  const out = [];
  for (let i = 0; i < sel.length; i++) {
    try {
      const b = sel[i].geometricBounds;
      if (b && b.length === 4) {
        out.push({ item: sel[i], bounds: [b[0], b[1], b[2], b[3]], corners: getCorners(sel[i]) });
      }
    } catch (e) {}
  }
  return out;
}

/* Génère une cote pour un bloc. Isolée : ne lève jamais.
 * blk.item peut être null (blocs programmatiques, import GraphiDesk). */
function makeOne(doc, spread, layer, blk, letter, colors, opts) {
  try {
    const corners = blk.corners || geom.cornersFromBounds(blk.bounds);
    const s = geom.computeCote(corners, letter, opts.shape || {});

    if (blk.item) clearBlock(blk.item, colors.none);

    const items = [];
    s.shafts.forEach(function (seg) {
      items.push(drawLine(spread, layer, seg, colors.white, colors.none, s.strokeWeight));
    });
    s.heads.forEach(function (tri) {
      items.push(drawPolygon(spread, layer, tri, colors.white, colors.none, 0));
    });
    // Losange bleu + fin liseré blanc (lisible sur tous les fonds).
    const outline = Math.min(Math.max(s.badge * 0.04, 0.3), 1.0);
    items.push(drawPolygon(spread, layer, s.diamond, colors.blue, colors.white, outline));
    const lr = drawLetter(doc, spread, layer, s.center, letter, colors.white, colors.none, s.letterHeight);
    if (lr.item) items.push(lr.item);

    const g = groupItems(doc, spread, items);
    try { (g || items[0]).label = "cote-bat"; } catch (e) {}
    return { ok: true, mode: lr.mode, err: lr.err };
  } catch (e) {
    return { ok: false, mode: "none", err: "cote: " + (e && e.message ? e.message : e) };
  }
}

function runCore(opts) {
  const doc = indesign.app.activeDocument;
  return withPoints(doc, function () {
    const layer = doc.activeLayer;
    const spread = indesign.app.activeWindow.activeSpread;

    const blocks = readSelection();
    if (!blocks.length) return { count: 0, reason: "no-selection" };

    const colors = {
      white: ensureRGB(doc, "Cote Blanc", [255, 255, 255], "Paper"),
      blue: ensureRGB(doc, "Cote Bleu", [0, 91, 171], "Black"),
      none: noneSwatch(doc)
    };

    const ordered = geom.sortBlocks(blocks);
    let idx = opts.startIndex || 0;
    let done = 0;
    const letters = { vector: 0, live: 0, none: 0 };
    let firstErr = null;

    ordered.forEach(function (blk) {
      const letter = geom.letterFromIndex(idx);
      const r = makeOne(doc, spread, layer, blk, letter, colors, opts);
      if (r.ok) { done++; letters[r.mode] = (letters[r.mode] || 0) + 1; }
      if (r.err && !firstErr) firstErr = r.err;
      idx++;
    });

    return { count: done, nextIndex: idx, letters: letters, err: firstErr };
  });
}

function run(opts) {
  opts = opts || {};
  let result = { count: 0 };
  const fn = function () { result = runCore(opts); };
  try {
    indesign.app.doScript(
      fn,
      indesign.ScriptLanguage.JAVASCRIPT,
      [],
      indesign.UndoModes.ENTIRE_SCRIPT,
      "Ajouter des cotes BAT"
    );
  } catch (e) {
    // doScript indisponible : génération directe (annulation multi-étapes).
    result = runCore(opts);
  }
  return result;
}

/* ------------------------------------------------------------------
 * Génération sur des blocs PROGRAMMATIQUES (import GraphiDesk).
 * blocks: [{ bounds:[y1,x1,y2,x2], corners:[{x,y}x4]|null, letter:"A" }]
 * Chaque bloc porte SA lettre (synchronisée avec les zones GraphiDesk).
 * ------------------------------------------------------------------ */
function runOnBlocksCore(blocks, opts) {
  const doc = indesign.app.activeDocument;
  return withPoints(doc, function () {
    const layer = doc.activeLayer;
    const spread = (opts && opts.spread) || indesign.app.activeWindow.activeSpread;

    const colors = {
      white: ensureRGB(doc, "Cote Blanc", [255, 255, 255], "Paper"),
      blue: ensureRGB(doc, "Cote Bleu", [0, 91, 171], "Black"),
      none: noneSwatch(doc)
    };

    let done = 0;
    const letters = { vector: 0, live: 0, none: 0 };
    let firstErr = null;

    blocks.forEach(function (blk) {
      const r = makeOne(doc, spread, layer, blk, blk.letter || "?", colors, opts || {});
      if (r.ok) { done++; letters[r.mode] = (letters[r.mode] || 0) + 1; }
      if (r.err && !firstErr) firstErr = r.err;
    });

    return { count: done, letters: letters, err: firstErr };
  });
}

function runOnBlocks(blocks, opts) {
  opts = opts || {};
  let result = { count: 0 };
  const fn = function () { result = runOnBlocksCore(blocks, opts); };
  try {
    indesign.app.doScript(
      fn,
      indesign.ScriptLanguage.JAVASCRIPT,
      [],
      indesign.UndoModes.ENTIRE_SCRIPT,
      "Importer cotes GraphiDesk"
    );
  } catch (e) {
    result = runOnBlocksCore(blocks, opts);
  }
  return result;
}

module.exports = { run: run, runOnBlocks: runOnBlocks, withPoints: withPoints };
