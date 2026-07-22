// ============================================================
// biblio_export_selection.jsx — « Ajouter à la bibliothèque »
// ============================================================
// Copie la SÉLECTION du document actif dans un fichier .ai autonome
// + génère une vignette PNG + un fichier méta (dimensions dessinées).
// GraphiDesk récupère les 3 fichiers et les envoie dans la bibliothèque
// partagée (le graphiste saisit nom / catégorie / dimensions réelles).
// Sorties dans <temp>/graphidesk_biblio/ :
//   item.ai, preview.png, meta.json { "wMm": n, "hMm": n }
// ⚠ Ne modifie NI le document du graphiste NI ses unités globales.

(function () {
  var DIR = Folder.temp + "/graphidesk_biblio";

  function ecrireMeta(objStr) {
    var d = new Folder(DIR);
    if (!d.exists) d.create();
    var f = new File(DIR + "/meta.json");
    f.encoding = "UTF-8"; f.open("w"); f.write(objStr); f.close();
  }

  // purge des sorties précédentes
  try { var o1 = new File(DIR + "/item.ai"); if (o1.exists) o1.remove(); } catch (e0) {}
  try { var o2 = new File(DIR + "/preview.png"); if (o2.exists) o2.remove(); } catch (e1) {}
  try { var o3 = new File(DIR + "/meta.json"); if (o3.exists) o3.remove(); } catch (e2) {}

  if (app.documents.length === 0) { alert("Ouvre un document."); return; }
  var doc = app.activeDocument;

  // mode "plan" : capturer le PLAN DE TRAVAIL ACTIF entier (avec les cotes
  // et annotations du graphiste) — sinon mode "objet" : la sélection
  var MODE_PLAN = params.mode === "plan";
  var abRect = null;
  if (MODE_PLAN) {
    abRect = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect;
    doc.selection = null;
    try { app.executeMenuCommand("selectallinartboard"); } catch (eSA) {}
  }
  if (!doc.selection || doc.selection.length === 0) {
    alert(MODE_PLAN
      ? "Le plan de travail actif est vide."
      : "Sélectionne d'abord le visuel à ajouter à la bibliothèque.");
    return;
  }

  var oldUIL = null;
  try { oldUIL = app.userInteractionLevel; app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS; } catch (eU) {}

  try {
    // figer la sélection (duplicate() peut l'étendre — piège connu)
    var sel = [];
    for (var s = 0; s < doc.selection.length; s++) sel.push(doc.selection[s]);

    // bounds de l'ensemble
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
    var MM = 2.834645669;
    var wPt = (b[2] - b[0]) * sf, hPt = (b[1] - b[3]) * sf; // physiques

    // COPIER-COLLER via le presse-papiers : c'est la SEULE méthode 100 %
    // fidèle (dégradés, symboles, masques, images du logo... tout passe,
    // exactement comme un Ctrl+C/Ctrl+V du graphiste). La duplication
    // objet par objet perdait des contenus complexes (logo Camif !).
    app.executeMenuCommand("copy");

    // document autonome : la taille de création n'a AUCUNE importance,
    // le plan de travail sera recalé sur l'objet après collage.
    // CMJN comme les maquettes de l'atelier. Preset units=mm : sans preset,
    // documents.add crée un document en POINTS (le .ai de bibliothèque
    // s'ouvrirait en pts chez les graphistes).
    var outPreset = new DocumentPreset();
    outPreset.units = RulerUnits.Millimeters;
    outPreset.colorMode = DocumentColorSpace.CMYK;
    var out = app.documents.addDocument(DocumentColorSpace.CMYK, outPreset);
    app.executeMenuCommand("paste");

    // bounds RÉELS de ce qui a été collé (le collage sélectionne les items)
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

    // cadrage du plan de travail du fichier de bibliothèque :
    //   - objet : collé serré autour du visuel (+ marge 2 pt)
    //   - plan  : réplique EXACTE du plan de travail source (le contenu
    //     garde la même position relative que dans la maquette d'origine)
    var M = 2;
    var offX = 0, offYTop = 0; // décalage contenu → plan (mode plan)
    if (MODE_PLAN && abRect) {
      offX = b[0] - abRect[0];
      offYTop = abRect[1] - b[1];
      out.artboards[0].artboardRect = [
        g[0] - offX,
        g[1] + offYTop,
        g[0] - offX + (abRect[2] - abRect[0]),
        g[1] + offYTop - (abRect[1] - abRect[3]),
      ];
    } else {
      out.artboards[0].artboardRect = [g[0] - M, g[1] + M, g[2] + M, g[3] - M];
    }

    // vignette PNG (~400 px de large, basée sur la taille RÉELLE du cadre)
    var arOut = out.artboards[0].artboardRect;
    var wDoc = arOut[2] - arOut[0];
    var pct = Math.round(Math.min(300, Math.max(5, (400 / wDoc) * 100)));
    var opts = new ExportOptionsPNG24();
    opts.horizontalScale = pct; opts.verticalScale = pct;
    opts.antiAliasing = true; opts.artBoardClipping = true; opts.transparency = true;
    var dir = new Folder(DIR);
    if (!dir.exists) dir.create();
    out.exportFile(new File(DIR + "/preview.png"), ExportType.PNG24, opts);

    // fichier .ai autonome
    var aiOpts = new IllustratorSaveOptions();
    aiOpts.compatibility = Compatibility.ILLUSTRATOR17; // large compat
    aiOpts.pdfCompatible = true;
    out.saveAs(new File(DIR + "/item.ai"), aiOpts);
    out.close(SaveOptions.DONOTSAVECHANGES);

    // méta : dimensions DESSINÉES en mm (le doc du graphiste est
    // généralement au 1:10 → GraphiDesk préremplira réel = dessiné x 10).
    // Mode plan : dimensions du PLAN DE TRAVAIL + décalage du contenu
    // (mm dessinés physiques) pour le repositionnement à l'injection.
    if (MODE_PLAN && abRect) {
      var wAb = (abRect[2] - abRect[0]) * sf, hAb = (abRect[1] - abRect[3]) * sf;
      ecrireMeta(
        '{"mode":"plan","wMm":' + (wAb / MM).toFixed(1) +
        ',"hMm":' + (hAb / MM).toFixed(1) +
        ',"offXMm":' + ((offX * sf) / MM).toFixed(1) +
        ',"offYMm":' + ((offYTop * sf) / MM).toFixed(1) + '}'
      );
    } else {
      ecrireMeta('{"wMm":' + (wPt / MM).toFixed(1) + ',"hMm":' + (hPt / MM).toFixed(1) + '}');
    }
  } catch (eG) {
    ecrireMeta('{"erreur":"' + String(eG).replace(/"/g, "'") + '"}');
  }

  try { if (oldUIL !== null) app.userInteractionLevel = oldUIL; } catch (eV) {}
})();
