// ============================================================
// relief3d_export_selection.jsx — « Faire ma 3D » (lettres relief)
// ============================================================
// Exporte la SÉLECTION du document actif (le tracé de découpe des
// lettres) en SVG, plus la position RÉELLE des entretoises si le
// calque ENTRETOISES_PREVIEW existe (étape « Placer » déjà lancée).
// GraphiDesk construit la simulation 3D à partir de ces deux sorties.
//
// Sorties dans <temp>/graphidesk_3d/ :
//   lettres.svg
//   meta.json { wMm, hMm, entretoises:[{xMm,yMm,dMm}], erreur? }
//     (repère : origine = coin HAUT-GAUCHE des lettres, y vers le bas)
//
// ⚠ Ne modifie NI le document du graphiste NI ses unités globales :
//    on travaille sur une COPIE via le presse-papiers.

(function (params) {
  var DIR = Folder.temp + "/graphidesk_3d";
  var MM = 2.834645669;
  // Un suffixe permet de faire DEUX relevés sans que le second écrase le
  // premier : le panneau d'un drapeau, puis sa zone à ajourer.
  var SUF = (params && params.suffixe) ? String(params.suffixe) : "";
  var NOM_SVG = "/lettres" + SUF + ".svg";
  var NOM_META = "/meta" + SUF + ".json";

  function ecrireMeta(objStr) {
    var d = new Folder(DIR);
    if (!d.exists) d.create();
    var f = new File(DIR + NOM_META);
    f.encoding = "UTF-8"; f.open("w"); f.write(objStr); f.close();
  }

  // purge des sorties précédentes (sinon GraphiDesk relirait l'export d'avant)
  try { var o1 = new File(DIR + NOM_SVG); if (o1.exists) o1.remove(); } catch (e0) {}
  try { var o2 = new File(DIR + NOM_META); if (o2.exists) o2.remove(); } catch (e1) {}

  if (app.documents.length === 0) { alert("Ouvre ton fichier."); return; }
  var doc = app.activeDocument;
  if (!doc.selection || doc.selection.length === 0) {
    alert("Sélectionne d'abord les tracés à récupérer.");
    return;
  }

  var oldUIL = null;
  try { oldUIL = app.userInteractionLevel; app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS; } catch (eU) {}

  try {
    // figer la sélection (duplicate/copy peut l'étendre — piège connu)
    var sel = [];
    for (var s = 0; s < doc.selection.length; s++) sel.push(doc.selection[s]);

    // bounds de l'ensemble sélectionné (repère de TOUTES les coordonnées)
    var b = null;
    for (var i = 0; i < sel.length; i++) {
      var gb = sel[i].visibleBounds;
      if (!b) b = [gb[0], gb[1], gb[2], gb[3]];
      else {
        if (gb[0] < b[0]) b[0] = gb[0];
        if (gb[1] > b[1]) b[1] = gb[1];
        if (gb[2] > b[2]) b[2] = gb[2];
        if (gb[3] < b[3]) b[3] = gb[3];
      }
    }
    var sf = 1;
    try { sf = doc.scaleFactor || 1; } catch (eSf) {}
    var wPt = (b[2] - b[0]) * sf, hPt = (b[1] - b[3]) * sf; // dimensions physiques

    // ---- entretoises déjà placées (calque ENTRETOISES_PREVIEW) ----
    // Elles sont relevées AVANT la copie : on lit le document d'origine.
    var ents = [];
    function scanEntretoises(container) {
      var k;
      for (k = 0; k < container.pathItems.length; k++) {
        try {
          var p = container.pathItems[k];
          var pb = p.visibleBounds;
          var wp = pb[2] - pb[0], hp = pb[1] - pb[3];
          if (wp <= 0 || hp <= 0) continue;
          // un cercle : largeur ≈ hauteur (tolérance 15 %)
          if (Math.abs(wp - hp) > Math.max(wp, hp) * 0.15) continue;
          var cx = (pb[0] + pb[2]) / 2, cy = (pb[1] + pb[3]) / 2;
          ents.push({
            x: ((cx - b[0]) * sf) / MM,
            y: ((b[1] - cy) * sf) / MM,
            d: ((wp + hp) / 2 * sf) / MM
          });
        } catch (eP) {}
      }
      for (k = 0; k < container.groupItems.length; k++) {
        try { scanEntretoises(container.groupItems[k]); } catch (eGr) {}
      }
    }
    for (var L = 0; L < doc.layers.length; L++) {
      try {
        var lay = doc.layers[L];
        if (!/ENTRETOISE/i.test(String(lay.name))) continue;
        scanEntretoises(lay);
      } catch (eL) {}
    }

    // ---- copie autonome de la sélection → export SVG ----
    // COPIER-COLLER : seule méthode 100 % fidèle (composés, masques...).
    app.executeMenuCommand("copy");

    // document CMJN en MILLIMÈTRES (sans preset, documents.add crée un
    // document en POINTS — leçon des unités)
    var outPreset = new DocumentPreset();
    outPreset.units = RulerUnits.Millimeters;
    outPreset.colorMode = DocumentColorSpace.CMYK;
    var out = app.documents.addDocument(DocumentColorSpace.CMYK, outPreset);
    app.executeMenuCommand("paste");

    var colles = out.selection;
    if (!colles || colles.length === 0) throw new Error("collage vide");
    var g = null;
    for (var u = 0; u < colles.length; u++) {
      var vb = colles[u].visibleBounds;
      if (!g) g = [vb[0], vb[1], vb[2], vb[3]];
      else {
        if (vb[0] < g[0]) g[0] = vb[0];
        if (vb[1] > g[1]) g[1] = vb[1];
        if (vb[2] > g[2]) g[2] = vb[2];
        if (vb[3] < g[3]) g[3] = vb[3];
      }
    }
    // plan de travail collé EXACTEMENT sur les lettres : l'origine du SVG
    // exporté coïncide alors avec le repère des entretoises ci-dessus
    out.artboards[0].artboardRect = [g[0], g[1], g[2], g[3]];

    var svgOpts = new ExportOptionsSVG();
    try { svgOpts.embedRasterImages = false; } catch (eO1) {}
    try { svgOpts.fontType = SVGFontType.OUTLINEFONT; } catch (eO2) {}
    try { svgOpts.coordinatePrecision = 4; } catch (eO3) {}
    try { svgOpts.documentEncoding = SVGDocumentEncoding.UTF8; } catch (eO4) {}
    try { svgOpts.cssProperties = SVGCSSPropertyLocation.PRESENTATIONATTRIBUTES; } catch (eO5) {}
    var dir = new Folder(DIR);
    if (!dir.exists) dir.create();
    out.exportFile(new File(DIR + NOM_SVG), ExportType.SVG, svgOpts);
    out.close(SaveOptions.DONOTSAVECHANGES);

    var parts = [];
    for (var e = 0; e < ents.length; e++) {
      parts.push('{"xMm":' + ents[e].x.toFixed(2) +
        ',"yMm":' + ents[e].y.toFixed(2) +
        ',"dMm":' + ents[e].d.toFixed(2) + '}');
    }
    // origine du repère (coin haut-gauche des lettres, en points document) :
    // permet à un second relevé — les lisses — de se caler exactement dessus
    ecrireMeta('{"wMm":' + (wPt / MM).toFixed(2) +
      ',"hMm":' + (hPt / MM).toFixed(2) +
      ',"origX":' + b[0].toFixed(3) +
      ',"origY":' + b[1].toFixed(3) +
      ',"sf":' + sf +
      ',"entretoises":[' + parts.join(",") + ']}');
  } catch (eG) {
    ecrireMeta('{"erreur":"' + String(eG).replace(/"/g, "'") + '"}');
  }

  try { if (oldUIL !== null) app.userInteractionLevel = oldUIL; } catch (eV) {}
})(typeof params !== "undefined" ? params : {});
