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
//            couleur2?:{r,g,b}, etape? ("memoriser"), numero? (1|2),
//            vectoContourActionPath?, pathfinderUnionActionPath? }
//
// DEUX COULEURS (demande de Carole, 02/10/2026) — flux en trois temps,
// voulu par Jordan (05/10/2026) :
//   1. sélection de la couleur 1 → etape "memoriser", numero 1 ;
//   2. sélection de la couleur 2 → etape "memoriser", numero 2 :
//      les éléments sont marqués (note GD_NEON_COULEUR_n), rien d'autre ne
//      bouge, et le nombre d'éléments marqués est écrit dans
//      graphidesk_neon_memo.json (temp) pour que GraphiDesk l'affiche ;
//   3. génération avec `couleur2` : AUCUNE sélection requise. UN SEUL néon
//      — une plaque, une échelle, une série de cotes pour l'ensemble — mais
//      chaque couleur fusionnée et habillée à part (fusionner les deux
//      couleurs ensemble les aurait mélangées en un seul tube).

(function () {
  if (app.documents.length === 0) { alert("Ouvre un document."); return; }
  var doc = app.activeDocument;
  // en deux couleurs, la génération travaille sur les éléments MÉMORISÉS
  var GENERATION_DEUX_COULEURS = !!params.couleur2 && params.etape !== "memoriser";
  if (!GENERATION_DEUX_COULEURS && params.etape !== "memoriser" &&
      (!doc.selection || doc.selection.length === 0)) {
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
  // tube pastel + lueur saturée, déclinés de la couleur du « gaz »
  function teintes(col) {
    return {
      tube: rgb(mix(col.r, 255, 0.6), mix(col.g, 255, 0.6), mix(col.b, 255, 0.6)),
      lueur: rgb(col.r, col.g, col.b)
    };
  }
  var cBlanc = rgb(255, 255, 255);
  var cPlaque = rgb(224, 224, 226);
  var cNoir = rgb(60, 60, 64);

  // ---------- 0. deux couleurs : marquage des couleurs 1 et 2 ----------
  function marque(n) { return "GD_NEON_COULEUR_" + n; }
  function elementsMarques(n) {
    var res = [];
    for (var a = 0; a < doc.pageItems.length; a++) {
      try { if (doc.pageItems[a].note === marque(n)) res.push(doc.pageItems[a]); } catch (eN) {}
    }
    return res;
  }
  function effacerMarques(n) {
    var m = elementsMarques(n);
    for (var a = 0; a < m.length; a++) { try { m[a].note = ""; } catch (eE) {} }
  }
  if (params.etape === "memoriser") {
    var numero = params.numero === 2 ? 2 : 1;
    effacerMarques(numero);
    var nb = 0;
    if (doc.selection) {
      for (var s1 = 0; s1 < doc.selection.length; s1++) {
        try { doc.selection[s1].note = marque(numero); nb++; } catch (eM) {}
      }
    }
    // compte-rendu lu par GraphiDesk (pas de fenêtre : c'est GraphiDesk qui
    // affiche l'étape faite). Écriture atomique : .tmp puis renommage.
    try {
      var memo = new File(Folder.temp + "/graphidesk_neon_memo.json.tmp");
      memo.encoding = "UTF-8"; memo.open("w");
      memo.write('{"numero":' + numero + ',"nb":' + nb + '}');
      memo.close();
      var cible = new File(Folder.temp + "/graphidesk_neon_memo.json");
      if (cible.exists) cible.remove();
      memo.rename("graphidesk_neon_memo.json");
    } catch (eF) {}
    try { if (oldUIL !== null) app.userInteractionLevel = oldUIL; } catch (eV1) {}
    return;
  }
  var DEUX_COULEURS = GENERATION_DEUX_COULEURS;

  // ---------- 1. éléments par couleur ----------
  var groupesSel = [];   // [{ items:[], couleur:{r,g,b} }]
  if (DEUX_COULEURS) {
    var sel1 = elementsMarques(1);
    var sel2 = elementsMarques(2);
    if (sel1.length === 0 || sel2.length === 0) {
      try { if (oldUIL !== null) app.userInteractionLevel = oldUIL; } catch (eV2) {}
      alert("Néon deux couleurs : mémorise d'abord la COULEUR " + (sel1.length === 0 ? "1" : "2") + " dans GraphiDesk.");
      return;
    }
    groupesSel.push({ items: sel1, couleur: C });
    groupesSel.push({ items: sel2, couleur: params.couleur2 });
  } else {
    var selTout = [];
    for (var s = 0; s < doc.selection.length; s++) selTout.push(doc.selection[s]);
    groupesSel.push({ items: selTout, couleur: C });
  }

  if (MODE_SIMPLE) {
    for (var gs0 = 0; gs0 < groupesSel.length; gs0++) {
      for (var t0 = 0; t0 < groupesSel[gs0].items.length; t0++) {
        if (groupesSel[gs0].items[t0].typename === "TextFrame") {
          try { if (oldUIL !== null) app.userInteractionLevel = oldUIL; } catch (eV0) {}
          alert("Mode TRACÉ SIMPLE : sélectionne des TRACÉS (lignes à la plume ou police monoligne vectorisée), pas du texte vivant.");
          return;
        }
      }
    }
  }

  // une base (copie vectorisée) PAR COULEUR, réunies dans un groupe pour
  // être mises à l'échelle et placées ENSEMBLE
  var base = doc.groupItems.add();
  var bases = []; // [{ item, couleur }]
  var ob = null;  // bounds de la sélection D'ORIGINE (pour placer dessous)
  for (var gs = 0; gs < groupesSel.length; gs++) {
    var items = groupesSel[gs].items;
    var gc = base.groupItems.add();
    for (var i = items.length - 1; i >= 0; i--) {
      var dup = items[i].duplicate();
      if (dup.typename === "TextFrame") {
        // ⚠️ Illustrator = createOutline() SANS s (le "s" est l'API InDesign)
        dup = dup.createOutline();
      }
      try { dup.move(gc, ElementPlacement.PLACEATBEGINNING); } catch (e) {}
      var b0 = items[i].geometricBounds;
      if (!ob) ob = [b0[0], b0[1], b0[2], b0[3]];
      else {
        if (b0[0] < ob[0]) ob[0] = b0[0];
        if (b0[1] > ob[1]) ob[1] = b0[1];
        if (b0[2] > ob[2]) ob[2] = b0[2];
        if (b0[3] < ob[3]) ob[3] = b0[3];
      }
    }
    bases.push({ item: gc, couleur: groupesSel[gs].couleur });
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

  // les bases de couleur sortent du groupe commun : chacune se fusionne seule
  for (var bx0 = 0; bx0 < bases.length; bx0++) {
    try { bases[bx0].item.move(doc.activeLayer, ElementPlacement.PLACEATBEGINNING); } catch (eMv0) {}
  }
  try { base.remove(); } catch (eRm0) {}

  // ---------- 2b. fusion Pathfinder (mode CONTOUR uniquement), PAR COULEUR ----------
  // Certaines polices vectorisent en morceaux superposés (barres du F...)
  // → sans fusion, le tube dessine des traits parasites. En mode simple,
  // surtout NE PAS fusionner (les tracés ouverts seraient détruits).
  // ⚠️ PAS d'actions (loadAction/doScript) : elles GÈLENT Illustrator quand
  // le script tourne via le pont CEP — executeMenuCommand passe partout.
  if (!MODE_SIMPLE) {
    for (var bf = 0; bf < bases.length; bf++) {
      try {
        doc.selection = null;
        bases[bf].item.selected = true;
        app.executeMenuCommand("Live Pathfinder Add");
        app.executeMenuCommand("expandStyle");
        if (doc.selection && doc.selection.length > 0) bases[bf].item = doc.selection[0];
        doc.selection = null;
      } catch (eUn) { /* police propre : pas bloquant */ }
    }
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
    // la plaque englobe TOUTES les couleurs : une seule pièce de plexi
    plaque = doc.groupItems.add();
    for (var bp = 0; bp < bases.length; bp++) {
      try { bases[bp].item.duplicate(plaque, ElementPlacement.PLACEATEND); } catch (eDp) {}
    }
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

  // ---------- 4. lueur (chaque couleur la sienne) ----------
  var suffixe = function (bi) { return DEUX_COULEURS ? " " + (bi + 1) : ""; };
  if (AVEC_LUEUR) {
    var glow = [
      { w: TUBE * 7, op: 10 },
      { w: TUBE * 5, op: 16 },
      { w: TUBE * 3.6, op: 24 },
      { w: TUBE * 2.6, op: 34 },
      { w: TUBE * 1.8, op: 45 }
    ];
    for (var gl = 0; gl < glow.length; gl++) {
      for (var bl = 0; bl < bases.length; bl++) {
        var lay = bases[bl].item.duplicate();
        restyle(lay, false, null, true, teintes(bases[bl].couleur).lueur, glow[gl].w);
        lay.opacity = glow[gl].op;
        lay.name = "LUEUR" + suffixe(bl);
        couches.push(lay);
      }
    }
  }

  // ---------- 5. tube + cœur (chaque couleur le sien) ----------
  for (var bt = 0; bt < bases.length; bt++) {
    var tube = bases[bt].item.duplicate();
    restyle(tube, false, null, true, teintes(bases[bt].couleur).tube, TUBE);
    tube.name = "TUBE" + suffixe(bt);
    couches.push(tube);
  }
  for (var bc = 0; bc < bases.length; bc++) {
    var coeur = bases[bc].item.duplicate();
    restyle(coeur, false, null, true, cBlanc, COEUR);
    coeur.name = "COEUR" + suffixe(bc);
    couches.push(coeur);
  }

  // ---------- 6. positions des entretoises (créées en 7b, après tout) ----------
  var fixPositions = [];
  if (AVEC_FIX) {
    var pts = [];
    var tb = null;
    for (var bpt = 0; bpt < bases.length; bpt++) {
      (function collect(item) {
        if (item.typename === "GroupItem") {
          for (var k2 = 0; k2 < item.pageItems.length; k2++) collect(item.pageItems[k2]);
        } else if (item.typename === "CompoundPathItem") {
          for (var q2 = 0; q2 < item.pathItems.length; q2++) collect(item.pathItems[q2]);
        } else if (item.typename === "PathItem") {
          for (var pp = 0; pp < item.pathPoints.length; pp++) pts.push(item.pathPoints[pp].anchor);
        }
      })(bases[bpt].item);
      var bbt = bases[bpt].item.geometricBounds;
      if (!tb) tb = [bbt[0], bbt[1], bbt[2], bbt[3]];
      else {
        if (bbt[0] < tb[0]) tb[0] = bbt[0];
        if (bbt[1] > tb[1]) tb[1] = bbt[1];
        if (bbt[2] > tb[2]) tb[2] = bbt[2];
        if (bbt[3] < tb[3]) tb[3] = bbt[3];
      }
    }

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

  for (var br = 0; br < bases.length; br++) { try { bases[br].item.remove(); } catch (eRb) {} }
  // les marques ont servi : l'original redevient neutre
  if (DEUX_COULEURS) { effacerMarques(1); effacerMarques(2); }

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
      "Néon flex généré ✔  (" + (MODE_SIMPLE ? "tracé simple" : "contour des lettres") + (DEUX_COULEURS ? ", deux couleurs" : "") + ")\n" +
      (plaque ? "Plaque plexi" + (contourReel ? " (contour réel, évidé)" : " (apparence)") + " : " + wReel + " x " + hReel + " mm réels (1:" + ECH + ")\n" : "") +
      (AVEC_FIX ? "Entretoises : calque « ENTRETOISES » au premier plan, déplaçables une à une.\n" : "") +
      (AVEC_COTES ? "Cotes : groupe « COTES » dans NEON FLEX (supprimable d'un clic)." : "")
    );
  }
})();
