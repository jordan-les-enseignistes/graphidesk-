// ============================================================
// neon_flex.jsx — transforme la SÉLECTION en maquette néon flex
// ============================================================
// Deux modes :
//   - "contour" (défaut) : texte/logo vectorisé, le tube suit le CONTOUR
//     des lettres (double trait) — vecto + fusion Pathfinder automatiques
//   - "simple" : MONO-TRAIT — la sélection EST le tracé du néon (lignes
//     dessinées à la plume ou police single-line) ; le texte vivant n'est
//     pas accepté dans ce mode (pas de ligne médiane extractible)
// Habillage : tube pastel + cœur blanc + lueur (5 strokes) + plaque plexi
// CONTOUR RÉEL vectorisé et ÉVIDÉ des poches internes + entretoises
// réalistes (calque dédié, premier plan, déplaçables) + cotes réelles.
// params : { couleur:{r,g,b}, tubeMm, coeurMm, lueur, plaque, fixations,
//            padPlaquePct, largeurReelleMm?, hauteurReelleMm?, echelle?,
//            trace? ("contour"|"simple"), cotes?, silencieux?,
//            vectoContourActionPath?, pathfinderUnionActionPath? }

(function () {
  if (app.documents.length === 0) { alert("Ouvre un document."); return; }
  var doc = app.activeDocument;
  if (!doc.selection || doc.selection.length === 0) {
    alert("Sélectionne d'abord ton texte (ou ton tracé) puis relance.");
    return;
  }

  // AUCUNE modale pendant la construction (profil couleur, police...) :
  // pendant un script l'interface est bloquée, une modale invisible fige
  // tout — rétabli avant le rapport final
  var oldUIL = null;
  try { oldUIL = app.userInteractionLevel; app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS; } catch (eU) {}

  var MM = 2.834645669;
  var C = params.couleur || { r: 255, g: 62, b: 181 };
  var TUBE = (params.tubeMm || 1.06) * MM;
  var COEUR = (params.coeurMm || 0.3) * MM;
  var AVEC_LUEUR = params.lueur !== false;
  var AVEC_PLAQUE = params.plaque !== false;
  var AVEC_FIX = params.fixations !== false;
  var AVEC_COTES = params.cotes !== false;
  var PAD_PCT = (params.padPlaquePct || 12) / 100;
  var ECH = params.echelle || 10;
  var MODE_SIMPLE = params.trace === "simple";

  // CMJN obligatoire (jamais de RVB dans les maquettes d'impression) :
  // conversion naïve RVB→CMJN — suffisante pour des couleurs d'habillage néon
  function rgb(r, g, b) {
    var rr = r / 255, gg = g / 255, bb = b / 255;
    var k = 1 - Math.max(rr, Math.max(gg, bb));
    var c = new CMYKColor();
    if (k >= 0.999) { c.black = 100; return c; }
    c.cyan = Math.round(((1 - rr - k) / (1 - k)) * 100);
    c.magenta = Math.round(((1 - gg - k) / (1 - k)) * 100);
    c.yellow = Math.round(((1 - bb - k) / (1 - k)) * 100);
    c.black = Math.round(k * 100);
    return c;
  }
  function mix(a, b, t) { return Math.round(a * (1 - t) + b * t); }
  var cTube = rgb(mix(C.r, 255, 0.6), mix(C.g, 255, 0.6), mix(C.b, 255, 0.6));
  var cLueur = rgb(C.r, C.g, C.b);
  var cBlanc = rgb(255, 255, 255);
  var cPlaque = rgb(224, 224, 226);
  var cNoir = rgb(60, 60, 64);

  // ---------- 1. base : tracés fournis (squelette GraphiDesk) OU sélection ----------
  var sel = [];
  for (var s = 0; s < doc.selection.length; s++) sel.push(doc.selection[s]);

  var base = null;
  if (MODE_SIMPLE) {
    for (var t0 = 0; t0 < sel.length; t0++) {
      if (sel[t0].typename === "TextFrame") {
        try { if (oldUIL !== null) app.userInteractionLevel = oldUIL; } catch (eV0) {}
        alert("Mode TRACÉ SIMPLE : sélectionne des TRACÉS (lignes à la plume ou police monoligne vectorisée), pas du texte vivant.");
        return;
      }
    }
  }
  var pieces = [];
  for (var i = 0; i < sel.length; i++) {
    var dup = sel[i].duplicate();
    if (dup.typename === "TextFrame") {
      // ⚠️ Illustrator = createOutline() SANS s (le "s" est l'API InDesign)
      dup = dup.createOutline();
    }
    pieces.push(dup);
  }
  if (pieces.length === 1 && pieces[0].typename === "GroupItem") {
    base = pieces[0];
  } else {
    base = doc.groupItems.add();
    for (var p = pieces.length - 1; p >= 0; p--) {
      try { pieces[p].move(base, ElementPlacement.PLACEATBEGINNING); } catch (e) {}
    }
  }

  // bounds de la sélection D'ORIGINE (pour placer dessous)
  var ob = null;
  for (var o = 0; o < sel.length; o++) {
    var b0 = sel[o].geometricBounds;
    if (!ob) ob = [b0[0], b0[1], b0[2], b0[3]];
    else {
      if (b0[0] < ob[0]) ob[0] = b0[0];
      if (b0[1] > ob[1]) ob[1] = b0[1];
      if (b0[2] > ob[2]) ob[2] = b0[2];
      if (b0[3] < ob[3]) ob[3] = b0[3];
    }
  }

  // ---------- 2. dimension cible (largeur OU hauteur RÉELLE en mm) ----------
  var bbL = base.geometricBounds;
  var w0 = bbL[2] - bbL[0], h0 = bbL[1] - bbL[3];
  var scalePct = 0;
  // la plaque déborde de PAD depuis le BORD du tube : le tube (Ø fixe, non
  // mis à l'échelle) s'ajoute à la cote finale → on le déduit de la cible
  if (params.largeurReelleMm > 0) {
    var targetW = (params.largeurReelleMm / ECH) * MM;
    scalePct = ((targetW - TUBE) / (w0 + 2 * PAD_PCT * h0)) * 100;
  } else if (params.hauteurReelleMm > 0) {
    var targetH = (params.hauteurReelleMm / ECH) * MM;
    scalePct = ((targetH - TUBE) / (h0 * (1 + 2 * PAD_PCT))) * 100;
  }
  if (scalePct > 0 && isFinite(scalePct)) {
    base.resize(scalePct, scalePct, true, true, true, true, 100, Transformation.TOPLEFT);
  }

  // débord de plaque proportionnel à la hauteur finale
  var bbF = base.geometricBounds;
  var PAD = PAD_PCT * (bbF[1] - bbF[3]);

  // placer la base sous l'original
  var bb = base.geometricBounds;
  base.translate(ob[0] - bb[0], (ob[3] - PAD - 10 * MM) - bb[1]);

  // ---------- 2b. fusion Pathfinder (mode CONTOUR uniquement) ----------
  // Certaines polices vectorisent en morceaux superposés (barres du F...)
  // → sans fusion, le tube dessine des traits parasites. En mode simple,
  // surtout NE PAS fusionner (les tracés ouverts seraient détruits).
  // ⚠️ PAS d'actions (loadAction/doScript) : elles GÈLENT Illustrator quand
  // le script tourne via le pont CEP — executeMenuCommand passe partout.
  if (!MODE_SIMPLE) {
    try {
      doc.selection = null;
      base.selected = true;
      app.executeMenuCommand("Live Pathfinder Add");
      app.executeMenuCommand("expandStyle");
      if (doc.selection && doc.selection.length > 0) base = doc.selection[0];
      doc.selection = null;
    } catch (eUn) { /* police propre : pas bloquant */ }
  }

  // ---------- helpers ----------
  function restyle(item, fill, fillCol, stroke, strokeCol, widthPt) {
    if (item.typename === "GroupItem") {
      for (var k = 0; k < item.pageItems.length; k++) restyle(item.pageItems[k], fill, fillCol, stroke, strokeCol, widthPt);
      return;
    }
    var paths = [];
    if (item.typename === "CompoundPathItem") {
      for (var q = 0; q < item.pathItems.length; q++) paths.push(item.pathItems[q]);
    } else if (item.typename === "PathItem") {
      paths.push(item);
    }
    for (var w = 0; w < paths.length; w++) {
      var pa = paths[w];
      try {
        pa.filled = fill;
        if (fill && fillCol) pa.fillColor = fillCol;
        pa.stroked = stroke;
        if (stroke) {
          pa.strokeColor = strokeCol;
          pa.strokeWidth = widthPt;
          pa.strokeCap = StrokeCap.ROUNDENDCAP;
          pa.strokeJoin = StrokeJoin.ROUNDENDJOIN;
        }
      } catch (e) {}
    }
  }

  var couches = []; // de l'arrière vers l'avant

  // ---------- 3. plaque : contour réel vectorisé + ÉVIDAGE des poches ----------
  var plaque = null;
  var contourReel = false;
  if (AVEC_PLAQUE) {
    plaque = base.duplicate();
    // largeur de trait = 2×PAD + Ø tube : le débord se mesure depuis le BORD
    // du tube (pas sa ligne centrale) → 12 % réellement visibles
    restyle(plaque, !MODE_SIMPLE, cPlaque, true, cPlaque, PAD * 2 + TUBE);
    try {
      // vectoriser le contour (Outline Stroke) puis fusionner — via
      // executeMenuCommand : les actions gèlent sous le pont CEP
      doc.selection = null;
      plaque.selected = true;
      app.executeMenuCommand("OffsetPath v22"); // Objet > Tracé > Vectoriser le contour
      app.executeMenuCommand("expandStyle");
      app.executeMenuCommand("Live Pathfinder Add");
      app.executeMenuCommand("expandStyle");
      if (doc.selection && doc.selection.length > 0) {
        plaque = doc.selection[0];
        contourReel = true;
      }
      doc.selection = null;
    } catch (ePl) { /* repli : plaque en apparence */ }

    // ÉVIDAGE : le plexi est découpé PLEIN — on supprime les sous-tracés
    // internes (poches fermées entre les lettres) du tracé composé : ne
    // restent que les frontières EXTÉRIEURES.
    if (contourReel) {
      try {
        var sub = [];
        (function collectSub(itm) {
          if (itm.typename === "CompoundPathItem") {
            for (var c2 = 0; c2 < itm.pathItems.length; c2++) sub.push(itm.pathItems[c2]);
          } else if (itm.typename === "GroupItem") {
            for (var g2 = 0; g2 < itm.pageItems.length; g2++) collectSub(itm.pageItems[g2]);
          } else if (itm.typename === "PathItem") {
            sub.push(itm);
          }
        })(plaque);
        // un sous-tracé est INTERNE si sa boîte est contenue dans celle
        // d'un autre — on le supprime (le plexi reste plein)
        for (var si2 = sub.length - 1; si2 >= 0; si2--) {
          var bi = sub[si2].geometricBounds;
          for (var sj = 0; sj < sub.length; sj++) {
            if (sj === si2) continue;
            var bj = sub[sj].geometricBounds;
            if (bi[0] >= bj[0] - 0.5 && bi[1] <= bj[1] + 0.5 && bi[2] <= bj[2] + 0.5 && bi[3] >= bj[3] - 0.5) {
              sub[si2].remove();
              sub.splice(si2, 1);
              break;
            }
          }
        }
      } catch (eEv) {}
    }

    restyle(plaque, true, cPlaque, false, null, 0);
    plaque.opacity = 86;
    plaque.name = contourReel ? "PLAQUE PLEXI (contour reel)" : "PLAQUE (apparence)";
    couches.push(plaque);
  }

  // ---------- 4. lueur ----------
  if (AVEC_LUEUR) {
    var glow = [
      { w: TUBE * 7, op: 10 },
      { w: TUBE * 5, op: 16 },
      { w: TUBE * 3.6, op: 24 },
      { w: TUBE * 2.6, op: 34 },
      { w: TUBE * 1.8, op: 45 }
    ];
    for (var gl = 0; gl < glow.length; gl++) {
      var lay = base.duplicate();
      restyle(lay, false, null, true, cLueur, glow[gl].w);
      lay.opacity = glow[gl].op;
      lay.name = "LUEUR";
      couches.push(lay);
    }
  }

  // ---------- 5. tube + cœur ----------
  var tube = base.duplicate();
  restyle(tube, false, null, true, cTube, TUBE);
  tube.name = "TUBE";
  couches.push(tube);

  var coeur = base.duplicate();
  restyle(coeur, false, null, true, cBlanc, COEUR);
  coeur.name = "COEUR";
  couches.push(coeur);

  // ---------- 6. positions des entretoises (créées en 7b, après tout) ----------
  var fixPositions = [];
  if (AVEC_FIX) {
    var pts = [];
    (function collect(item) {
      if (item.typename === "GroupItem") {
        for (var k2 = 0; k2 < item.pageItems.length; k2++) collect(item.pageItems[k2]);
      } else if (item.typename === "CompoundPathItem") {
        for (var q2 = 0; q2 < item.pathItems.length; q2++) collect(item.pathItems[q2]);
      } else if (item.typename === "PathItem") {
        for (var pp = 0; pp < item.pathPoints.length; pp++) pts.push(item.pathPoints[pp].anchor);
      }
    })(base);

    var tb = base.geometricBounds;
    var cibles = [
      [tb[0], tb[1]], [tb[2], tb[1]],
      [tb[0], tb[3]], [tb[2], tb[3]],
      [(tb[0] + tb[2]) / 2, tb[1]], [(tb[0] + tb[2]) / 2, tb[3]]
    ];
    var ccx = (tb[0] + tb[2]) / 2, ccy = (tb[1] + tb[3]) / 2;
    for (var f = 0; f < cibles.length; f++) {
      var best = null, bd = 1e18;
      for (var pn = 0; pn < pts.length; pn++) {
        var dx = pts[pn][0] - cibles[f][0], dy = pts[pn][1] - cibles[f][1];
        var dd = dx * dx + dy * dy;
        if (dd < bd) { bd = dd; best = pts[pn]; }
      }
      if (!best) continue;
      var vx = best[0] - ccx, vy = best[1] - ccy;
      var vn = Math.sqrt(vx * vx + vy * vy) || 1;
      fixPositions.push([best[0] + (vx / vn) * PAD * 0.55, best[1] + (vy / vn) * PAD * 0.55]);
    }
  }

  base.remove();

  // ---------- 7. empilement + groupe final ----------
  for (var z = 0; z < couches.length; z++) {
    try { couches[z].zOrder(ZOrderMethod.BRINGTOFRONT); } catch (e) {}
  }
  var final_ = doc.groupItems.add();
  final_.name = "NEON FLEX";
  // ⚠️ ordre ASCENDANT avec PLACEATBEGINNING : chaque couche passe DEVANT
  // la précédente → plaque au fond, cœur au premier plan
  for (var m = 0; m < couches.length; m++) {
    try { couches[m].move(final_, ElementPlacement.PLACEATBEGINNING); } catch (e) {}
  }
  try { final_.zOrder(ZOrderMethod.BRINGTOFRONT); } catch (e) {}

  // ---------- 7b. entretoises réalistes : créées EN DERNIER = dessus ----------
  if (AVEC_FIX && fixPositions.length > 0) {
    var layFix = null;
    try { layFix = doc.layers.getByName("ENTRETOISES"); }
    catch (eL) { try { layFix = doc.layers.add(); layFix.name = "ENTRETOISES"; } catch (eL2) { layFix = null; } }
    var enTete = false;
    if (layFix) {
      layFix.locked = false; layFix.visible = true;
      try { layFix.zOrder(ZOrderMethod.BRINGTOFRONT); } catch (e1) {}
      try { enTete = doc.layers[0] === layFix; } catch (e2) {}
      if (!enTete) {
        try {
          layFix.move(doc.layers[0], ElementPlacement.PLACEBEFORE);
          enTete = doc.layers[0] === layFix;
        } catch (e3) {}
      }
    }
    if (!enTete) layFix = doc.activeLayer; // repli : créées en dernier = devant

    var cRim = rgb(120, 122, 128);   // couronne
    var cMetal2 = rgb(205, 207, 212); // tête métal
    var cVis = rgb(96, 98, 104);     // empreinte centrale
    var dE = 1.5 * MM;
    for (var fx2 = 0; fx2 < fixPositions.length; fx2++) {
      var ex = fixPositions[fx2][0], ey = fixPositions[fx2][1];
      var g1 = layFix.pathItems.ellipse(ey + dE / 2, ex - dE / 2, dE, dE);
      g1.filled = true; g1.fillColor = cRim; g1.stroked = false;
      var d2 = dE * 0.72;
      var g2 = layFix.pathItems.ellipse(ey + d2 / 2, ex - d2 / 2, d2, d2);
      g2.filled = true; g2.fillColor = cMetal2; g2.stroked = false;
      var d3 = dE * 0.28;
      var g3 = layFix.pathItems.ellipse(ey + d3 / 2, ex - d3 / 2, d3, d3);
      g3.filled = true; g3.fillColor = cVis; g3.stroked = false;
      var gE = layFix.groupItems.add();
      gE.name = "ENTRETOISE";
      // ordre ASCENDANT : g3 (dessus) doit finir devant
      g1.move(gE, ElementPlacement.PLACEATBEGINNING);
      g2.move(gE, ElementPlacement.PLACEATBEGINNING);
      g3.move(gE, ElementPlacement.PLACEATBEGINNING);
      try { gE.zOrder(ZOrderMethod.BRINGTOFRONT); } catch (e4) {}
    }
  }

  // ---------- 7c. cotes réelles du néon fini (groupe COTES dans NEON FLEX) ----------
  var refB = (plaque || final_).geometricBounds;
  var wReel = Math.round(((refB[2] - refB[0]) / MM) * ECH);
  var hReel = Math.round(((refB[1] - refB[3]) / MM) * ECH);

  if (AVEC_COTES) {
    var gCotes = doc.groupItems.add();
    gCotes.name = "COTES";
    // tout est PROPORTIONNEL à la taille de la plaque : sur une enseigne de
    // 7 m les cotes en taille fixe deviennent des poussières illisibles
    var CS = Math.max(1, (refB[1] - refB[3]) / (60 * MM));
    function ligneC(x1, y1, x2, y2) {
      var l = gCotes.pathItems.add();
      l.setEntirePath([[x1, y1], [x2, y2]]);
      l.stroked = true; l.strokeWidth = 0.6 * CS; l.strokeColor = cNoir; l.filled = false;
      return l;
    }
    function flecheC(x, y, a) {
      var L2 = 1.6 * MM * CS, W2 = 0.55 * MM * CS;
      var bx = x - Math.cos(a) * L2, by = y - Math.sin(a) * L2;
      var px3 = -Math.sin(a) * W2, py3 = Math.cos(a) * W2;
      var tr = gCotes.pathItems.add();
      tr.setEntirePath([[x, y], [bx + px3, by + py3], [bx - px3, by - py3]]);
      tr.closed = true; tr.filled = true; tr.fillColor = cNoir; tr.stroked = false;
    }
    function texteC(x, y, s2) {
      var tfc = gCotes.textFrames.add();
      tfc.contents = s2;
      try {
        tfc.textRange.characterAttributes.size = 9 * CS;
        tfc.textRange.characterAttributes.fillColor = cNoir;
      } catch (eT) {}
      tfc.position = [x, y];
      return tfc;
    }
    // largeur, sous la plaque
    var yC = refB[3] - 4 * MM * CS;
    ligneC(refB[0], yC, refB[2], yC);
    flecheC(refB[0], yC, Math.PI); flecheC(refB[2], yC, 0);
    var tW = texteC(0, 0, wReel + " mm");
    tW.position = [(refB[0] + refB[2]) / 2 - tW.width / 2, yC - 1 * MM * CS];
    // hauteur, à droite de la plaque
    var xC = refB[2] + 4 * MM * CS;
    ligneC(xC, refB[1], xC, refB[3]);
    flecheC(xC, refB[1], Math.PI / 2); flecheC(xC, refB[3], -Math.PI / 2);
    var tH = texteC(0, 0, hReel + " mm");
    tH.rotate(90);
    tH.position = [xC + 1.5 * MM * CS, (refB[1] + refB[3]) / 2 + tH.height / 2];

    try { gCotes.move(final_, ElementPlacement.PLACEATBEGINNING); } catch (eMv) {}
  }

  app.redraw();

  // ---------- 8. rapport ----------
  try { if (oldUIL !== null) app.userInteractionLevel = oldUIL; } catch (eV) {}
  if (!params.silencieux) {
    alert(
      "Néon flex généré ✔  (" + (MODE_SIMPLE ? "tracé simple" : "contour des lettres") + ")\n" +
      (plaque ? "Plaque plexi" + (contourReel ? " (contour réel, évidé)" : " (apparence)") + " : " + wReel + " x " + hReel + " mm réels (1:" + ECH + ")\n" : "") +
      (AVEC_FIX ? "Entretoises : calque « ENTRETOISES » au premier plan, déplaçables une à une.\n" : "") +
      (AVEC_COTES ? "Cotes : groupe « COTES » dans NEON FLEX (supprimable d'un clic)." : "")
    );
  }
})();
