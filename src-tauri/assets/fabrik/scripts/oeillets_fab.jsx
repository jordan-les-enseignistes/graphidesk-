// ============================================================
// oeillets_fab.jsx — fichier de FAB de la bâche à l'échelle 1:1
// ============================================================
// Depuis le fichier maquette OUVERT (bâche 1:10 + œillets de l'étape 1) :
//   1. crée un NOUVEAU document aux dimensions RÉELLES — la maquette
//      n'est JAMAIS modifiée. Au-delà de ~5,77 m : GRAND CANEVAS via un
//      gabarit .ai (le scripting ne sait pas l'activer tout seul) dont
//      une COPIE temporaire est ouverte (l'original est intouchable).
//   2. y duplique tout le contenu, à l'échelle 1:1 physique ;
//   3. remplace chaque œillet (groupes "OEILLET") DEPUIS SON CENTRE par
//      un marqueur Ø diamFabMm : blanc sur fond sombre / noir sur fond
//      clair (détection auto), croix de centrage + liseré opposé.
// ⚠️ Grand canevas : les scripts y travaillent en unités divisées par
//    document.scaleFactor (10) — toutes les géométries sont compensées.
// params : { echelle, diamFabMm }

(function () {
  if (app.documents.length === 0) { alert("Ouvre d'abord le fichier avec ses œillets."); return; }
  var src = app.activeDocument;

  var S = params.echelle || 10;
  var DIAMF = params.diamFabMm || 5; // mm réels
  var MM = 2.834645669;
  var CANVAS_MAX_PT = 163830; // grand canevas (~57,7 m)

  // --- œillets présents dans la maquette ? ---
  var nbOeillets = 0;
  for (var g0 = 0; g0 < src.groupItems.length; g0++) {
    var nm0 = String(src.groupItems[g0].name || "").replace(/[\s_]+/g, "");
    if (nm0.toUpperCase() === "OEILLET") nbOeillets++;
  }
  if (nbOeillets === 0) {
    alert("Aucun œillet trouvé (groupes nommés OEILLET).\nLance d'abord l'étape 1 sur ce fichier.");
    return;
  }

  // --- bâche = sélection (union) ; à défaut : tout le contenu ---
  var r = null;
  function unionB(gb) {
    if (!r) r = [gb[0], gb[1], gb[2], gb[3]];
    else {
      if (gb[0] < r[0]) r[0] = gb[0];
      if (gb[1] > r[1]) r[1] = gb[1];
      if (gb[2] > r[2]) r[2] = gb[2];
      if (gb[3] < r[3]) r[3] = gb[3];
    }
  }
  if (src.selection && src.selection.length > 0) {
    for (var si = 0; si < src.selection.length; si++) unionB(src.selection[si].geometricBounds);
  } else {
    for (var ci = 0; ci < src.pageItems.length; ci++) {
      try {
        if (src.pageItems[ci].hidden || src.pageItems[ci].guides) continue;
        unionB(src.pageItems[ci].geometricBounds);
      } catch (e) {}
    }
  }
  if (!r) { alert("Aucun contenu mesurable."); return; }
  var w = r[2] - r[0], h = r[1] - r[3];
  var W = w * S, H = h * S; // dimensions physiques réelles en points

  if (W > CANVAS_MAX_PT || H > CANVAS_MAX_PT) {
    alert("Bâche > 57 m : au-delà même du grand canevas. Rien n'a été fait.");
    return;
  }

  // --- luminosité du fond (dans la maquette) ---
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
  for (var pi = 0; pi < src.pathItems.length; pi++) {
    var it0 = src.pathItems[pi];
    try {
      if (!it0.filled || estOeillet(it0)) continue;
      var gb0 = it0.geometricBounds;
      var area = Math.abs(gb0[2] - gb0[0]) * Math.abs(gb0[1] - gb0[3]);
      if (area > bgArea) { bgArea = area; bgLum = luminance(it0.fillColor); }
    } catch (e) {}
  }
  var fondSombre = bgLum < 50;

  // --- création du document FAB ---
  function sfOf(d) { var s = 1; try { s = d.scaleFactor || 1; } catch (e) {} return s; }
  function physOk(d) {
    // dimensions PHYSIQUES = unités script x scaleFactor
    try { var s = sfOf(d); return d.width * s >= W - 2 && d.height * s >= H - 2; } catch (e) { return false; }
  }
  function fermer(d) { try { d.close(SaveOptions.DONOTSAVECHANGES); } catch (e) {} }

  var TEMPLATE_PATH = ($.getenv("USERPROFILE") || "~").replace(/\\/g, "/") +
    "/Documents/GraphiDesk/templates/grand_canevas.ai";

  var fab = null;

  // unités MILLIMÈTRES pour les documents créés par ce script — la préférence
  // est GLOBALE : on mémorise celle du graphiste et on la RESTAURE à la fin
  // (règle absolue : un script ne modifie JAMAIS les unités de l'utilisateur)
  var oldRuler = null;
  try { oldRuler = app.preferences.getIntegerPreference("rulerType"); } catch (e0) {}
  try { app.preferences.setIntegerPreference("rulerType", 1); } catch (e) {}
  function restaurerUnites() {
    try { if (oldRuler !== null) app.preferences.setIntegerPreference("rulerType", oldRuler); } catch (eR) {}
  }

  // 1. création directe (suffit si <= 5,77 m — et fonctionne aussi en
  //    grand canevas quand un document grand canevas est déjà ouvert)
  try {
    fab = app.documents.add(DocumentColorSpace.CMYK, W, H);
    if (!physOk(fab)) { fermer(fab); fab = null; }
  } catch (e) { fab = null; }

  // 2. gabarit grand canevas : COPIE temporaire ouverte + plan de travail
  //    redimensionné (en unités script = physiques / scaleFactor)
  if (!fab) {
    var tpl = new File(TEMPLATE_PATH);
    if (tpl.exists) {
      try {
        var tmp = new File(Folder.temp + "/bache_fab_1a1.ai");
        if (tmp.exists) tmp.remove();
        tpl.copy(tmp);
        fab = app.open(tmp);
        var sfT = sfOf(fab);
        var tr = fab.artboards[0].artboardRect;
        fab.artboards[0].artboardRect = [tr[0], tr[1], tr[0] + W / sfT, tr[1] - H / sfT];
      } catch (e3) { fermer(fab); fab = null; }
    }
  }

  if (!fab) {
    alert(
      "Ta bâche fait " + Math.round(W / MM) + " x " + Math.round(H / MM) + " mm : il faut le GRAND CANEVAS,\n" +
      "et le scripting d'Illustrator ne peut pas l'activer tout seul.\n\n" +
      "MISE EN PLACE (une seule fois, 1 minute) :\n" +
      "1. Fichier > Nouveau > largeur 7000 mm x hauteur 7000 mm\n" +
      "   (Illustrator activera le grand canevas automatiquement)\n" +
      "2. Enregistre ce document VIDE sous :\n" +
      "   Documents\\GraphiDesk\\templates\\grand_canevas.ai\n" +
      "3. Relance ce bouton — le script utilisera ce gabarit à chaque fois\n" +
      "   (il ouvre une copie : ton gabarit reste vide et intouchable)."
    );
    restaurerUnites();
    return;
  }
  restaurerUnites();

  var SF = sfOf(fab);           // 1 (classique) ou 10 (grand canevas)
  var FACT = S / SF;            // facteur de resize des duplicatas
  var fr = fab.artboards[0].artboardRect;

  // --- duplication du contenu (arrière -> avant : z-order préservé) ---
  app.activeDocument = src;
  var dups = [];
  for (var li = src.layers.length - 1; li >= 0; li--) {
    var lay = src.layers[li];
    var wasLocked = lay.locked, wasVisible = lay.visible;
    lay.locked = false; lay.visible = true;
    for (var k = lay.pageItems.length - 1; k >= 0; k--) {
      try {
        dups.push(lay.pageItems[k].duplicate(fab.layers[0], ElementPlacement.PLACEATBEGINNING));
      } catch (e) {}
    }
    lay.locked = wasLocked; lay.visible = wasVisible;
  }
  app.activeDocument = fab;

  // --- mise à l'échelle + repositionnement (en unités script du doc FAB) ---
  for (var d2 = 0; d2 < dups.length; d2++) {
    var itm = dups[d2];
    try {
      var b = itm.geometricBounds;
      var cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
      if (Math.abs(FACT - 1) > 0.001) {
        itm.resize(100 * FACT, 100 * FACT, true, true, true, true, 100 * FACT, Transformation.CENTER);
      }
      var tx = fr[0] + (cx - r[0]) * FACT;
      var ty = fr[1] + (cy - r[1]) * FACT;
      itm.translate(tx - cx, ty - cy);
    } catch (e) {}
  }

  // --- recalage FINAL auto-correcteur : quel que soit le système de
  // coordonnées du document (les conventions varient !), on aligne le
  // coin haut-gauche du contenu réellement obtenu sur celui du plan
  // de travail — le contenu ne peut pas finir hors plan de travail.
  var u = null;
  for (var u1 = 0; u1 < dups.length; u1++) {
    try {
      var ub = dups[u1].geometricBounds;
      if (!u) u = [ub[0], ub[1], ub[2], ub[3]];
      else {
        if (ub[0] < u[0]) u[0] = ub[0];
        if (ub[1] > u[1]) u[1] = ub[1];
        if (ub[2] > u[2]) u[2] = ub[2];
        if (ub[3] < u[3]) u[3] = ub[3];
      }
    } catch (e) {}
  }
  if (u) {
    var dxAll = fr[0] - u[0], dyAll = fr[1] - u[1];
    if (Math.abs(dxAll) > 0.01 || Math.abs(dyAll) > 0.01) {
      for (var u2 = 0; u2 < dups.length; u2++) {
        try { dups[u2].translate(dxAll, dyAll); } catch (e) {}
      }
    }
  }

  // --- remplacement des œillets par les marqueurs (Ø physique réel) ---
  var blanc = new CMYKColor();
  var noir = new CMYKColor(); noir.black = 100;
  var cMarqueur = fondSombre ? blanc : noir;
  var cOppose = fondSombre ? noir : blanc;

  var oeillets = [];
  for (var g = 0; g < fab.groupItems.length; g++) {
    var nm = String(fab.groupItems[g].name || "").replace(/[\s_]+/g, "");
    if (nm.toUpperCase() === "OEILLET") oeillets.push(fab.groupItems[g]);
  }

  var d = (DIAMF * MM) / SF;
  var croix = d * 0.7;
  var epLisere = (0.5 * MM * 0.35) / SF;
  var epCroix = (0.25 * MM) / SF;
  var nb = 0;
  var layFab = fab.layers[0];
  for (var o = oeillets.length - 1; o >= 0; o--) {
    var grp = oeillets[o];
    var bb = grp.geometricBounds;
    var mx = (bb[0] + bb[2]) / 2, my = (bb[1] + bb[3]) / 2;
    grp.remove();

    var dot = layFab.pathItems.ellipse(my + d / 2, mx - d / 2, d, d);
    dot.filled = true; dot.fillColor = cMarqueur;
    dot.stroked = true; dot.strokeColor = cOppose; dot.strokeWidth = epLisere;
    var l1 = layFab.pathItems.add();
    l1.setEntirePath([[mx - croix / 2, my], [mx + croix / 2, my]]);
    l1.stroked = true; l1.strokeColor = cOppose; l1.strokeWidth = epCroix; l1.filled = false;
    var l2 = layFab.pathItems.add();
    l2.setEntirePath([[mx, my - croix / 2], [mx, my + croix / 2]]);
    l2.stroked = true; l2.strokeColor = cOppose; l2.strokeWidth = epCroix; l2.filled = false;
    nb++;
  }

  app.redraw();
  alert(
    "Fichier de FAB créé : document à l'échelle 1:1 (" +
    Math.round(W / MM) + " x " + Math.round(H / MM) + " mm" +
    (SF > 1 ? ", GRAND CANEVAS" : "") + ")\n" +
    nb + " marqueurs Ø " + DIAMF + " mm — fond " + (fondSombre ? "SOMBRE → marqueurs blancs" : "CLAIR → marqueurs noirs") + "\n" +
    "Ta maquette n'a pas été touchée. Enregistre ce document en _FAB (c'est une copie temporaire)."
  );
})();
