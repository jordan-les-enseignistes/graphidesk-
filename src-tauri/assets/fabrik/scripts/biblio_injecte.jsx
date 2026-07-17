// ============================================================
// biblio_injecte.jsx — injecte des items de la bibliothèque
// ============================================================
// params : {
//   echelle: 10 | 1,   // 10 = maquette 1:10 (défaut), 1 = taille réelle
//   avecCotes: bool,   // génère des cotes autour des OBJETS injectés
//   items: [{ fichier, nom, mode: "objet"|"plan", largeurMm, hauteurMm }]
// }
//
// MÉTHODE : ouvrir le fichier de bibliothèque → tout sélectionner → COPIER
// → fermer → COLLER SUR PLACE dans le document actif. C'est la SEULE
// méthode 100 % fidèle : structure, groupes et masques d'origine conservés
// tels quels (l'import/incorporation passe par le PDF et fabrique des
// masques d'enveloppe imbriqués — abandonné).
//   - objet : regroupé, redimensionné à la variante ÷ échelle, posé au
//     centre de la vue (cascade si plusieurs), cotes générées en option
//   - plan  : nouveau plan de travail à droite des existants, contenu
//     posé EXACTEMENT comme dans la maquette d'origine, plan activé
// ⚠ Ne modifie ni le contenu existant ni les unités du graphiste.

(function () {
  if (app.documents.length === 0) { alert("Ouvre d'abord ton document de travail."); return; }
  if (!params.items || params.items.length === 0) { alert("Aucun item à injecter."); return; }

  var doc = app.activeDocument;
  var MM = 2.834645669;
  var ECH = params.echelle || 10;
  var sf = 1;
  try { sf = doc.scaleFactor || 1; } catch (eSf) {}

  var oldUIL = null;
  try { oldUIL = app.userInteractionLevel; app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS; } catch (eU) {}

  // centre de la vue active (en unités script du doc)
  var centre;
  try {
    var vb = doc.activeView.bounds; // [g, h, d, b]
    centre = [(vb[0] + vb[2]) / 2, (vb[1] + vb[3]) / 2];
  } catch (eV0) {
    var ab0 = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect;
    centre = [(ab0[0] + ab0[2]) / 2, (ab0[1] + ab0[3]) / 2];
  }

  var faits = 0;
  var erreurs = "";

  for (var i = 0; i < params.items.length; i++) {
    var item = params.items[i];
    try {
      var f = new File(item.fichier);
      if (!f.exists) { erreurs += item.nom + " : fichier introuvable\n"; continue; }

      // ---------- 1. ouvrir la source, tout copier, refermer ----------
      var src = app.open(f);
      var abSrc = src.artboards[0].artboardRect; // repère du plan source
      var sfSrc = 1;
      try { sfSrc = src.scaleFactor || 1; } catch (eSfS) {}
      src.selection = null;
      app.executeMenuCommand("selectall");
      if (!src.selection || src.selection.length === 0) {
        src.close(SaveOptions.DONOTSAVECHANGES);
        erreurs += item.nom + " : fichier vide\n";
        continue;
      }
      // décalage PHYSIQUE du contenu dans son plan source (repositionnement
      // ABSOLU après collage : les coordonnées de "coller sur place" sont
      // relatives au plan actif, on ne s'y fie pas)
      var bSrc = null;
      for (var sB = 0; sB < src.selection.length; sB++) {
        var vbS = src.selection[sB].visibleBounds;
        if (!bSrc) bSrc = [vbS[0], vbS[1], vbS[2], vbS[3]];
        else {
          if (vbS[0] < bSrc[0]) bSrc[0] = vbS[0];
          if (vbS[1] > bSrc[1]) bSrc[1] = vbS[1];
          if (vbS[2] > bSrc[2]) bSrc[2] = vbS[2];
          if (vbS[3] < bSrc[3]) bSrc[3] = vbS[3];
        }
      }
      var offXPhys = (bSrc[0] - abSrc[0]) * sfSrc;
      var offYPhys = (abSrc[1] - bSrc[1]) * sfSrc;
      app.executeMenuCommand("copy");
      src.close(SaveOptions.DONOTSAVECHANGES);

      // ---------- 2. coller SUR PLACE dans le document cible ----------
      app.activeDocument = doc;
      app.executeMenuCommand("pasteInPlace");
      var colles = [];
      for (var c = 0; c < doc.selection.length; c++) colles.push(doc.selection[c]);
      if (colles.length === 0) { erreurs += item.nom + " : collage vide\n"; continue; }

      // un seul groupe, nommé — en ASCENDANT (le descendant inverse le z-order)
      var g;
      if (colles.length === 1 && colles[0].typename === "GroupItem") {
        g = colles[0];
      } else {
        g = doc.groupItems.add();
        for (var m = 0; m < colles.length; m++) {
          try { colles[m].move(g, ElementPlacement.PLACEATBEGINNING); } catch (eMv) {}
        }
      }
      g.name = item.nom;

      if (item.mode === "plan") {
        // ---------- PLAN : nouveau plan de travail, contenu tel quel ----------
        var maxD = -1e12, topRef = 0;
        for (var a = 0; a < doc.artboards.length; a++) {
          var ra = doc.artboards[a].artboardRect;
          if (ra[2] > maxD) { maxD = ra[2]; topRef = ra[1]; }
        }
        var GAP = (30 * MM) / sf;
        var wA = (item.largeurMm * MM) / sf;
        var hA = (item.hauteurMm * MM) / sf;
        var rNew = [maxD + GAP, topRef, maxD + GAP + wA, topRef - hA];
        var nAb = doc.artboards.add(rNew);
        try { nAb.name = item.nom; } catch (eNa) {}

        // positionnement ABSOLU : le contenu est posé DANS le nouveau plan,
        // au même décalage (physique) que dans la maquette d'origine
        var gb = g.visibleBounds;
        g.translate(
          rNew[0] + offXPhys / sf - gb[0],
          rNew[1] - offYPhys / sf - gb[1]
        );
        try { doc.artboards.setActiveArtboardIndex(doc.artboards.length - 1); } catch (eAA) {}
      } else {
        // ---------- OBJET : redimensionner + centrer dans la vue ----------
        var vb2 = g.visibleBounds;
        var wCour = vb2[2] - vb2[0];
        var wCible = ((item.largeurMm / ECH) * MM) / sf;
        if (wCour > 0.001) {
          var k = (wCible / wCour) * 100;
          g.resize(k, k, true, true, true, true, k, Transformation.TOPLEFT);
        }
        var vb3 = g.visibleBounds;
        var dec = ((8 * MM) / sf) * faits;
        g.translate(
          centre[0] - (vb3[0] + vb3[2]) / 2 + dec,
          centre[1] - (vb3[1] + vb3[3]) / 2 - dec
        );

        // cotes générées (option) : valeurs RÉELLES de la variante
        if (params.avecCotes) {
          var b2 = g.visibleBounds;
          var gris = new GrayColor(); gris.gray = 75;
          var CS = Math.max(0.55, (b2[1] - b2[3]) / ((60 * MM) / sf));
          var gC = doc.groupItems.add();
          gC.name = "COTES";
          function ligneC(x1, y1, x2, y2) {
            var l = gC.pathItems.add();
            l.setEntirePath([[x1, y1], [x2, y2]]);
            l.stroked = true; l.strokeWidth = 0.6 * CS; l.strokeColor = gris; l.filled = false;
          }
          function flecheC(x, y, ang) {
            var L2 = ((1.6 * MM) / sf) * CS, W2 = ((0.55 * MM) / sf) * CS;
            var bx = x - Math.cos(ang) * L2, by = y - Math.sin(ang) * L2;
            var px = -Math.sin(ang) * W2, py = Math.cos(ang) * W2;
            var tr = gC.pathItems.add();
            tr.setEntirePath([[x, y], [bx + px, by + py], [bx - px, by - py]]);
            tr.closed = true; tr.filled = true; tr.fillColor = gris; tr.stroked = false;
          }
          function texteC(s2) {
            var tfc = gC.textFrames.add();
            tfc.contents = s2;
            try {
              tfc.textRange.characterAttributes.size = 10 * CS;
              tfc.textRange.characterAttributes.fillColor = gris;
            } catch (eT) {}
            return tfc;
          }
          var off = ((4.5 * MM) / sf) * CS;
          var yC = b2[3] - off;
          ligneC(b2[0], yC, b2[2], yC);
          flecheC(b2[0], yC, Math.PI); flecheC(b2[2], yC, 0);
          var tW = texteC(Math.round(item.largeurMm) + " mm");
          tW.position = [(b2[0] + b2[2]) / 2 - tW.width / 2, yC - ((1 * MM) / sf) * CS];
          var xC = b2[2] + off;
          ligneC(xC, b2[1], xC, b2[3]);
          flecheC(xC, b2[1], Math.PI / 2); flecheC(xC, b2[3], -Math.PI / 2);
          var tH = texteC(Math.round(item.hauteurMm) + " mm");
          tH.rotate(90);
          tH.position = [xC + ((1.2 * MM) / sf) * CS, (b2[1] + b2[3]) / 2 + tH.height / 2];
          var tot = doc.groupItems.add();
          tot.name = item.nom;
          try { g.move(tot, ElementPlacement.PLACEATBEGINNING); } catch (eM1) {}
          try { gC.move(tot, ElementPlacement.PLACEATBEGINNING); } catch (eM2) {}
          g = tot;
        }
        try { g.zOrder(ZOrderMethod.BRINGTOFRONT); } catch (eZ2) {}
      }
      faits++;
    } catch (eI) {
      erreurs += item.nom + " : " + String(eI) + "\n";
    }
  }

  app.redraw();
  try { if (oldUIL !== null) app.userInteractionLevel = oldUIL; } catch (eV) {}

  if (erreurs) {
    alert("Injection : " + faits + "/" + params.items.length + " item(s) placés.\n\nProblèmes :\n" + erreurs);
  }
})();
