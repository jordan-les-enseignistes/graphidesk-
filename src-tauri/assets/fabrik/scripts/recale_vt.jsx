// ============================================================
// recale_vt.jsx — recale la maquette OUVERTE aux cotes VT
// ============================================================
// Les éléments générés par GraphiDesk portent des noms GD_ZONE_X__PIECE
// (posés via les id SVG, qui survivent au .ai — Illustrator convertit
// toutefois les "_" en espaces : on normalise avant comparaison).
//
// Pour chaque zone sélectionnée dans GraphiDesk :
//   - les pièces géométriques (CADRE, VERRE, REFLET, BANDEAU, FOND) sont
//     redimensionnées du ratio cotes VT / cotes provisoires, CENTRE
//     CONSERVÉ. Le ratio est indépendant de l'échelle du document : même
//     une maquette redimensionnée globalement reste recalée juste.
//   - le texte de cote (COTE) est mis à jour s'il existe encore (supprimé
//     par le graphiste = ignoré, jamais recréé).
// Le script ne touche QUE les objets nommés GD_* : jamais le travail posé
// par le graphiste (sauf s'il vit DANS une pièce GD, ce qui n'arrive pas :
// les pièces sont des tracés, pas des groupes).
// params attendus : { zones: [{ key, label, provW, provH, vtW, vtH }] }
// (dimensions en mm réels ; vtW/vtH absents = axe inchangé)

(function () {
  if (app.documents.length === 0) {
    alert("Recalage VT : aucun document ouvert dans Illustrator.");
    return;
  }
  var doc = app.activeDocument;

  function norm(n) {
    return String(n || "").replace(/[\s_]+/g, "_").toUpperCase();
  }

  // Index de TOUS les pageItems par nom normalisé (les doublons sont listés)
  var index = {};
  for (var i = 0; i < doc.pageItems.length; i++) {
    var it = doc.pageItems[i];
    var n = norm(it.name);
    if (!n) continue;
    if (!index[n]) index[n] = [];
    index[n].push(it);
  }

  var PIECES = ["CADRE", "VERRE", "REFLET", "BANDEAU", "FOND"];
  var MM2PT = 72 / 25.4;

  // ---- vérification d'identité projet (souple, jamais bloquante) ----
  // Le marqueur GD_PROJET_* est un objet invisible gravé à la génération.
  var markerWarning = null;
  if (params.projetKey) {
    var expected = norm(params.projetKey);
    var markers = [];
    for (var m in index) {
      if (m.indexOf("GD_PROJET_") === 0) markers.push(m);
    }
    if (markers.length === 0) {
      markerWarning = "⚠ Maquette sans marqueur projet (générée avant la v1.4.1 ?) — correspondance non vérifiable.";
    } else {
      var match = false;
      for (var mm = 0; mm < markers.length; mm++) {
        if (markers[mm] === expected) { match = true; break; }
      }
      if (!match) {
        var autre = markers[0].replace(/^GD_PROJET_/, "");
        var ok = confirm(
          "⚠ ATTENTION : la maquette ouverte semble appartenir à un AUTRE projet\n" +
          "(marqueur : " + autre + ",\n attendu : " + expected.replace(/^GD_PROJET_/, "") + ").\n\n" +
          "Recaler quand même ?"
        );
        if (!ok) {
          alert("Recalage annulé — ouvre la maquette du bon projet et relance.");
          return;
        }
        markerWarning = "⚠ Recalage forcé sur une maquette d'un autre projet (confirmé par l'utilisateur).";
      }
    }
  }
  // CMJN obligatoire (jamais de RVB dans les maquettes d'impression) —
  // équivalent du vert VT rgb(21,128,61)
  var vtGreen = new CMYKColor();
  vtGreen.cyan = 84; vtGreen.magenta = 0; vtGreen.yellow = 52; vtGreen.black = 50;

  var report = [];
  var totalOk = 0;

  for (var z = 0; z < params.zones.length; z++) {
    var zone = params.zones[z];
    var keyN = norm(zone.key);

    // 1. collecter toutes les pièces de la zone
    var pieces = [];
    for (var p = 0; p < PIECES.length; p++) {
      var items = index[keyN + "_" + PIECES[p]] || [];
      for (var k = 0; k < items.length; k++) {
        pieces.push({ item: items[k], kind: PIECES[p] });
      }
    }

    // 2. ancre commune = le VERRE (la cote mesurée), sinon la 1re pièce.
    //    Indispensable : le REFLET n'est PAS centré sur la vitrine — le
    //    redimensionner autour de son propre centre le ferait dériver.
    var anchor = null;
    for (var a = 0; a < pieces.length; a++) {
      if (pieces[a].kind === "VERRE") { anchor = pieces[a].item; break; }
    }
    if (!anchor && pieces.length) anchor = pieces[0].item;

    // bounds GÉOMÉTRIQUES (sans le contour) : [gauche, haut, droite, bas]
    function gbOf(it) {
      var g = it.geometricBounds;
      return {
        w: g[2] - g[0], h: g[1] - g[3],
        cx: (g[0] + g[2]) / 2, cy: (g[1] + g[3]) / 2
      };
    }

    var sx = 100, sy = 100;
    var ax = 0, ay = 0;
    if (anchor) {
      var ag = gbOf(anchor);
      ax = ag.cx; ay = ag.cy;
      // Recalage ABSOLU : cible = cote VT / 10 (maquette 1:10, doc en mm).
      // Contrairement à un simple ratio VT/provisoire, la taille finale est
      // EXACTE même si la maquette a déjà été recalée, partiellement
      // annulée ou légèrement retouchée — et relancer le recalage est
      // idempotent. Garde-fou : si le verre ne fait plus ± 10% de sa cote
      // provisoire (maquette redimensionnée globalement ?), on retombe sur
      // le ratio relatif pour ne pas détruire l'échelle voulue.
      var provWpt = (zone.provW / 10) * MM2PT;
      var provHpt = (zone.provH / 10) * MM2PT;
      var drift = provWpt > 0 ? ag.w / provWpt : 1;
      if (drift > 0.9 && drift < 1.1) {
        if (zone.vtW) sx = (((zone.vtW / 10) * MM2PT) / ag.w) * 100;
        if (zone.vtH) sy = (((zone.vtH / 10) * MM2PT) / ag.h) * 100;
      } else {
        if (zone.vtW && zone.provW) sx = (zone.vtW / zone.provW) * 100;
        if (zone.vtH && zone.provH) sy = (zone.vtH / zone.provH) * 100;
        report.push("⚠ " + zone.label + " : échelle inhabituelle détectée (maquette redimensionnée ?) — recalage relatif appliqué");
      }
    }

    // 3. redimensionner chaque pièce autour de son centre, puis la
    //    translater pour que l'ensemble reste homothétique autour de l'ancre
    var foundPieces = [];
    for (var q = 0; q < pieces.length; q++) {
      var it = pieces[q].item;
      try {
        if (Math.abs(sx - 100) > 0.001 || Math.abs(sy - 100) > 0.001) {
          var pg = gbOf(it);
          // resize(scaleX, scaleY, changePositions, changeFillPatterns,
          //        changeFillGradients, changeStrokePattern, changeLineWidths, about)
          it.resize(sx, sy, true, true, true, true, 100, Transformation.CENTER);
          // nouveau centre voulu : homothétie autour de l'ancre commune
          var nx = ax + (pg.cx - ax) * (sx / 100);
          var ny = ay + (pg.cy - ay) * (sy / 100);
          var ng = gbOf(it);
          it.translate(nx - ng.cx, ny - ng.cy);
        }
        foundPieces.push(pieces[q].kind.toLowerCase());
      } catch (e) {
        report.push(zone.label + " : erreur sur " + pieces[q].kind + " (" + e + ")");
      }
    }

    // texte de cote : mis à jour SI encore présent
    var coteDone = false;
    var cotes = index[keyN + "_COTE"] || [];
    for (var c = 0; c < cotes.length; c++) {
      try {
        if (cotes[c].typename === "TextFrame") {
          cotes[c].contents = zone.label + " " + zone.dimsText;
          try {
            cotes[c].textRange.characterAttributes.fillColor = vtGreen;
          } catch (e2) {}
          coteDone = true;
        }
      } catch (e) {}
    }

    if (foundPieces.length > 0) {
      totalOk++;
      report.push(
        "✔ " + zone.label + " : " + foundPieces.join(" + ") +
        (coteDone ? " + cote" : "") +
        "  → " + zone.dimsText
      );
    } else {
      report.push(
        "✖ " + zone.label + " : INTROUVABLE (dégroupée/renommée ou prémaquette antérieure à la v1.4.1) — à reprendre à la main"
      );
    }
  }

  alert(
    "Recalage aux cotes VT — " + totalOk + "/" + params.zones.length + " zone(s) recalée(s)\n" +
    "(centre conservé, votre travail n'a pas été touché)\n\n" +
    (markerWarning ? markerWarning + "\n\n" : "") +
    report.join("\n")
  );
})();
