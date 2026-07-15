// ============================================================
// oeillets_fab.jsx — fichier de FAB de la bâche à l'échelle 1:1
// ============================================================
// Sur le fichier OUVERT contenant les œillets posés par l'étape 1
// (les groupes nommés "OEILLET" suffisent — le calque d'origine peut
// avoir été perdu par un copier-coller dans un fichier neuf) :
//   1. VALIDE que la bâche 1:1 tient dans le canevas Illustrator
//      (limite absolue ~5,7 m) — sinon abandon SANS RIEN MODIFIER ;
//   2. met tout le document à l'échelle x S, RECENTRÉ autour du plan
//      de travail actif (pas d'explosion de coordonnées) ;
//   3. remplace chaque œillet DEPUIS SON CENTRE par un marqueur
//      Ø diamFabMm : blanc sur fond sombre / noir sur fond clair
//      (détection auto), croix de centrage + liseré opposé.
// params : { echelle, diamFabMm }

(function () {
  if (app.documents.length === 0) { alert("Ouvre d'abord le fichier avec ses œillets."); return; }
  var doc = app.activeDocument;

  var S = params.echelle || 10;
  var DIAMF = params.diamFabMm || 5; // mm réels
  var MM = 2.834645669;
  var CANVAS_PT = 16380; // limite du canevas Illustrator (~5,77 m)

  // --- œillets : groupes nommés OEILLET, où qu'ils soient ---
  var oeillets = [];
  for (var g = 0; g < doc.groupItems.length; g++) {
    var nm = String(doc.groupItems[g].name || "").replace(/[\s_]+/g, "");
    if (nm.toUpperCase() === "OEILLET") oeillets.push(doc.groupItems[g]);
  }
  if (oeillets.length === 0) {
    alert("Aucun œillet trouvé (groupes nommés OEILLET).\nLance d'abord l'étape 1, ou vérifie que le collage a conservé les groupes.");
    return;
  }

  // --- bâche = l'objet SÉLECTIONNÉ (union) ; à défaut : contenu global
  //     du document (PAS le plan de travail, souvent bien plus grand) ---
  var ab = doc.artboards[doc.artboards.getActiveArtboardIndex()];
  var r = null;
  if (doc.selection && doc.selection.length > 0) {
    for (var si = 0; si < doc.selection.length; si++) {
      var sb = doc.selection[si].geometricBounds;
      if (!r) r = [sb[0], sb[1], sb[2], sb[3]];
      else {
        if (sb[0] < r[0]) r[0] = sb[0];
        if (sb[1] > r[1]) r[1] = sb[1];
        if (sb[2] > r[2]) r[2] = sb[2];
        if (sb[3] < r[3]) r[3] = sb[3];
      }
    }
  } else {
    // union de tout le contenu visible (bâche + œillets)
    for (var ci = 0; ci < doc.pageItems.length; ci++) {
      try {
        var it0 = doc.pageItems[ci];
        if (it0.hidden || it0.guides) continue;
        var cb = it0.geometricBounds;
        if (!r) r = [cb[0], cb[1], cb[2], cb[3]];
        else {
          if (cb[0] < r[0]) r[0] = cb[0];
          if (cb[1] > r[1]) r[1] = cb[1];
          if (cb[2] > r[2]) r[2] = cb[2];
          if (cb[3] < r[3]) r[3] = cb[3];
        }
      } catch (e) {}
    }
    if (!r) r = ab.artboardRect;
  }
  var w = r[2] - r[0], h = r[1] - r[3];
  if (w * S > CANVAS_PT || h * S > CANVAS_PT) {
    alert(
      "Impossible : la bâche à l'échelle 1:1 ferait " +
      Math.round(w * S / MM) + " x " + Math.round(h * S / MM) + " mm,\n" +
      "au-delà de la limite du canevas Illustrator (~5770 mm).\n" +
      "Rien n'a été modifié — produis ce fichier à l'échelle 1:" + S + " en le signalant à la FAB."
    );
    return;
  }
  var abCx = (r[0] + r[2]) / 2, abCy = (r[1] + r[3]) / 2;

  // --- luminosité du fond AVANT transformation (plus grand aplat hors œillets) ---
  function luminance(col) {
    try {
      if (col.typename === "CMYKColor") return (1 - col.black / 100) * (1 - 0.6 * col.cyan / 100 - 0.3 * col.magenta / 100 - 0.1 * col.yellow / 100) * 100;
      if (col.typename === "RGBColor") return (0.299 * col.red + 0.587 * col.green + 0.114 * col.blue) / 2.55;
      if (col.typename === "GrayColor") return 100 - col.gray;
    } catch (e) {}
    return 50;
  }
  function estOeillet(item) {
    var p = item;
    while (p) {
      try {
        if (p.typename === "GroupItem" && String(p.name || "").replace(/[\s_]+/g, "").toUpperCase() === "OEILLET") return true;
      } catch (e) {}
      try { p = p.parent; } catch (e2) { p = null; }
      if (p && p.typename === "Layer") break;
    }
    return false;
  }
  var bgLum = 50, bgArea = 0;
  for (var pi = 0; pi < doc.pathItems.length; pi++) {
    var it = doc.pathItems[pi];
    try {
      if (!it.filled || estOeillet(it)) continue;
      var gb = it.geometricBounds;
      var area = Math.abs(gb[2] - gb[0]) * Math.abs(gb[1] - gb[3]);
      if (area > bgArea) { bgArea = area; bgLum = luminance(it.fillColor); }
    } catch (e) {}
  }
  var fondSombre = bgLum < 50;

  // --- échelle x S, recentrée sur le plan de travail ---
  // chaque élément : resize autour de son centre, puis translation pour
  // que (centre - centrePlan) soit multiplié par S — le plan de travail
  // reste où il est, rien ne part aux confins du canevas.
  function scaleItem(item) {
    try {
      var b = item.geometricBounds;
      var cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
      item.resize(100 * S, 100 * S, true, true, true, true, 100 * S, Transformation.CENTER);
      item.translate((cx - abCx) * (S - 1), (cy - abCy) * (S - 1));
    } catch (e) {}
  }
  function scaleLayer(lay) {
    var wasLocked = lay.locked, wasVisible = lay.visible;
    lay.locked = false; lay.visible = true;
    for (var k = 0; k < lay.pageItems.length; k++) scaleItem(lay.pageItems[k]);
    for (var s2 = 0; s2 < lay.layers.length; s2++) scaleLayer(lay.layers[s2]);
    lay.locked = wasLocked; lay.visible = wasVisible;
  }
  for (var li = 0; li < doc.layers.length; li++) scaleLayer(doc.layers[li]);

  // plan de travail : même centre, dimensions x S
  ab.artboardRect = [abCx - (w * S) / 2, abCy + (h * S) / 2, abCx + (w * S) / 2, abCy - (h * S) / 2];

  // --- marqueurs ---
  var blanc = new CMYKColor();
  var noir = new CMYKColor(); noir.black = 100;
  var cMarqueur = fondSombre ? blanc : noir;
  var cOppose = fondSombre ? noir : blanc;

  var d = DIAMF * MM;
  var croix = d * 0.7;
  var nb = 0;
  for (var o = oeillets.length - 1; o >= 0; o--) {
    var grp = oeillets[o];
    var layTarget = null;
    try { layTarget = grp.layer; } catch (e) {}
    if (!layTarget) layTarget = doc.activeLayer;
    var lockedT = layTarget.locked; layTarget.locked = false;

    var bb = grp.geometricBounds;
    var mx = (bb[0] + bb[2]) / 2, my = (bb[1] + bb[3]) / 2;
    grp.remove();

    var dot = layTarget.pathItems.ellipse(my + d / 2, mx - d / 2, d, d);
    dot.filled = true; dot.fillColor = cMarqueur;
    dot.stroked = true; dot.strokeColor = cOppose; dot.strokeWidth = 0.5 * MM * 0.35;
    var l1 = layTarget.pathItems.add();
    l1.setEntirePath([[mx - croix / 2, my], [mx + croix / 2, my]]);
    l1.stroked = true; l1.strokeColor = cOppose; l1.strokeWidth = 0.25 * MM; l1.filled = false;
    var l2 = layTarget.pathItems.add();
    l2.setEntirePath([[mx, my - croix / 2], [mx, my + croix / 2]]);
    l2.stroked = true; l2.strokeColor = cOppose; l2.strokeWidth = 0.25 * MM; l2.filled = false;

    layTarget.locked = lockedT;
    nb++;
  }

  app.redraw();
  alert(
    "Fichier de FAB prêt : échelle 1:1 (" + Math.round(w * S / MM) + " x " + Math.round(h * S / MM) + " mm), " +
    nb + " marqueurs Ø " + DIAMF + " mm\n" +
    "Fond détecté : " + (fondSombre ? "SOMBRE → marqueurs blancs" : "CLAIR → marqueurs noirs") + " (croix + liseré opposés)\n" +
    "Pense à ENREGISTRER SOUS un nouveau fichier (_FAB)."
  );
})();
