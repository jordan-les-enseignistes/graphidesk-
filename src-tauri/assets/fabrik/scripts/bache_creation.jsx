// ============================================================
// bache_creation.jsx — crée le fichier maquette de bâche complet
// ============================================================
// Depuis les DIMENSIONS RÉELLES saisies dans GraphiDesk :
//   1. crée un document CMJN en MILLIMÈTRES à l'échelle 1:échelle (1:10),
//      plan de travail = la bâche exactement ;
//   2. calque "VISUEL" (dessous) : rectangle de la bâche (fond blanc,
//      contour fin) — le graphiste dépose sa créa dedans ;
//   3. calque "OEILLETS" (dessus) : œillets posés comme l'étape 1
//      (4 coins à marge/marge + intermédiaires équidistants, entraxe
//      réel <= pasMaxMm), groupes nommés "OEILLET" → l'étape 2 (FAB 1:1)
//      fonctionne ensuite telle quelle.
// ⚠️ Unités : DocumentPreset.units = Millimeters (l'unité du DOCUMENT ;
//    documents.add sans preset = points). La préférence GLOBALE du
//    graphiste n'est jamais touchée.
// params : { largeurMm, hauteurMm, echelle, margeMm, pasMaxMm, diamMaquetteMm, avecCotes }

(function () {
  var LREEL = parseFloat(params.largeurMm) || 0;
  var HREEL = parseFloat(params.hauteurMm) || 0;
  if (LREEL <= 0 || HREEL <= 0) {
    alert("Saisis d'abord la largeur et la hauteur réelles de la bâche (mm).");
    return;
  }

  var S = params.echelle || 10;
  var MM = 2.834645669;
  var DIAM = (params.diamMaquetteMm || 25) / S;
  // marge = distance bord de bâche → EXTRÉMITÉ de l'œillet (centre à marge + Ø/2)
  var MARGE = (params.margeMm || 25) / S + DIAM / 2;
  // entraxe plafond : le nominal PRIME s'il dépasse le maxi — sinon le champ
  // "Entraxe nominal" du formulaire serait ignoré (retour Jordan 22/07/2026)
  var PASMAX = Math.max(params.pasMm || 500, params.pasMaxMm || 520) / S;

  var W = (LREEL / S) * MM; // largeur maquette en points
  var H = (HREEL / S) * MM;

  // --- document maquette en mm ---
  var preset = new DocumentPreset();
  preset.units = RulerUnits.Millimeters;
  preset.colorMode = DocumentColorSpace.CMYK;
  var doc = app.documents.addDocument(DocumentColorSpace.CMYK, preset);
  // ne jamais faire confiance à la taille initiale : caler l'artboard explicitement
  doc.artboards[0].artboardRect = [0, 0, W, -H];

  // --- calque VISUEL (dessous) : rectangle de la bâche ---
  var visuel = doc.layers[0];
  visuel.name = "VISUEL";
  var blanc = new CMYKColor();
  var gris = new CMYKColor(); gris.black = 30;
  var rect = visuel.pathItems.rectangle(0, 0, W, H); // top, left, w, h
  rect.filled = true; rect.fillColor = blanc;
  rect.stroked = true; rect.strokeColor = gris; rect.strokeWidth = 0.5;

  // --- calque OEILLETS (dessus) ---
  var layer = doc.layers.add(); // layers.add() = au-dessus
  layer.name = "OEILLETS";

  // périmètre de pose (identique à oeillets_maquette.jsx)
  var L = 0, T = 0, R = W, B = -H;
  var x1 = L + MARGE * MM, x2 = R - MARGE * MM;
  var y1 = T - MARGE * MM, y2 = B + MARGE * MM;

  function repartir(a, b) {
    var span = Math.abs(b - a);
    var n = Math.max(1, Math.ceil(span / (PASMAX * MM)));
    var out = [];
    for (var i = 0; i <= n; i++) out.push(a + (b - a) * (i / n));
    return out;
  }
  var xs = repartir(x1, x2);
  var ys = repartir(y1, y2);
  var centres = [];
  for (var i2 = 0; i2 < xs.length; i2++) { centres.push([xs[i2], y1]); centres.push([xs[i2], y2]); }
  for (var j = 1; j < ys.length - 1; j++) { centres.push([x1, ys[j]]); centres.push([x2, ys[j]]); }

  // rendu "œillet laiton nickelé" (identique à oeillets_maquette.jsx)
  var cOmbre = new CMYKColor(); cOmbre.black = 78;
  var cBagueFonce = new CMYKColor(); cBagueFonce.black = 52;
  var cMetal = new CMYKColor(); cMetal.black = 16;
  var cReflet = new CMYKColor(); cReflet.black = 4;
  var cBiseau = new CMYKColor(); cBiseau.black = 62;
  var cTrou = new CMYKColor();

  function disque(cx, cy, d, col) {
    var p = layer.pathItems.ellipse(cy + d / 2, cx - d / 2, d, d);
    p.filled = true; p.fillColor = col; p.stroked = false;
    return p;
  }
  function oeillet(cx, cy) {
    var d = DIAM * MM;
    var items = [];
    // cercle invisible symétrique Ø exact : centre de bounds = centre œillet
    var ref = layer.pathItems.ellipse(cy + d / 2, cx - d / 2, d, d);
    ref.filled = false; ref.stroked = false;
    items.push(ref);
    items.push(disque(cx + d * 0.03, cy - d * 0.03, d * 0.94, cOmbre));
    items.push(disque(cx, cy, d, cBagueFonce));
    items.push(disque(cx - d * 0.02, cy + d * 0.02, d * 0.92, cReflet));
    items.push(disque(cx, cy, d * 0.86, cMetal));
    items.push(disque(cx, cy, d * 0.56, cBiseau));
    items.push(disque(cx, cy, d * 0.48, cTrou));
    var g = layer.groupItems.add();
    g.name = "OEILLET";
    // ascendant : chaque élément passe DEVANT le précédent (trou au premier plan)
    for (var m = 0; m < items.length; m++) items[m].move(g, ElementPlacement.PLACEATBEGINNING);
  }
  for (var c = 0; c < centres.length; c++) oeillet(centres[c][0], centres[c][1]);

  // --- cotes générées (option) : valeurs RÉELLES, style injecteur Bibliothèque ---
  if (params.avecCotes) {
    var coteLayer = doc.layers.add();
    coteLayer.name = "COTES";
    var gris = new GrayColor(); gris.gray = 75;
    var CS = Math.max(0.55, H / (60 * MM));
    function ligneC(lx1, ly1, lx2, ly2) {
      var l = coteLayer.pathItems.add();
      l.setEntirePath([[lx1, ly1], [lx2, ly2]]);
      l.stroked = true; l.strokeWidth = 0.6 * CS; l.strokeColor = gris; l.filled = false;
    }
    function flecheC(fx, fy, ang) {
      var L2 = (1.6 * MM) * CS, W2 = (0.55 * MM) * CS;
      var bx = fx - Math.cos(ang) * L2, by = fy - Math.sin(ang) * L2;
      var px = -Math.sin(ang) * W2, py = Math.cos(ang) * W2;
      var tr = coteLayer.pathItems.add();
      tr.setEntirePath([[fx, fy], [bx + px, by + py], [bx - px, by - py]]);
      tr.closed = true; tr.filled = true; tr.fillColor = gris; tr.stroked = false;
    }
    function texteC(s2) {
      var tfc = coteLayer.textFrames.add();
      tfc.contents = s2;
      try {
        tfc.textRange.characterAttributes.size = 10 * CS;
        tfc.textRange.characterAttributes.fillColor = gris;
      } catch (eT) {}
      return tfc;
    }
    var off = (4.5 * MM) * CS;
    // largeur (sous la bâche)
    var yC = B - off;
    ligneC(L, yC, R, yC);
    flecheC(L, yC, Math.PI); flecheC(R, yC, 0);
    var tW = texteC(Math.round(LREEL) + " mm");
    tW.position = [(L + R) / 2 - tW.width / 2, yC - (1 * MM) * CS];
    // hauteur (à droite de la bâche)
    var xC = R + off;
    ligneC(xC, T, xC, B);
    flecheC(xC, T, Math.PI / 2); flecheC(xC, B, -Math.PI / 2);
    var tH = texteC(Math.round(HREEL) + " mm");
    tH.rotate(90);
    tH.position = [xC + (1.2 * MM) * CS, (T + B) / 2 + tH.height / 2];

    // le plan de travail s'étend pour englober les cotes (+3mm de marge) —
    // sinon elles pendent hors du plan. L'étape FAB ignore le calque COTES,
    // ses dimensions restent donc celles de la bâche seule.
    var margePlan = 3 * MM;
    var uC = null;
    for (var ci = 0; ci < coteLayer.pageItems.length; ci++) {
      try {
        var cb = coteLayer.pageItems[ci].visibleBounds;
        if (!uC) uC = [cb[0], cb[1], cb[2], cb[3]];
        else {
          if (cb[0] < uC[0]) uC[0] = cb[0];
          if (cb[1] > uC[1]) uC[1] = cb[1];
          if (cb[2] > uC[2]) uC[2] = cb[2];
          if (cb[3] < uC[3]) uC[3] = cb[3];
        }
      } catch (eB) {}
    }
    if (uC) {
      doc.artboards[0].artboardRect = [
        Math.min(L, uC[0]) - margePlan,
        Math.max(T, uC[1]) + margePlan,
        Math.max(R, uC[2]) + margePlan,
        Math.min(B, uC[3]) - margePlan
      ];
    }
  }

  var entraxeH = xs.length > 1 ? Math.abs(xs[1] - xs[0]) / MM * S : 0;
  var entraxeV = ys.length > 1 ? Math.abs(ys[1] - ys[0]) / MM * S : 0;

  try { app.executeMenuCommand("fitall"); } catch (eF) {}
  app.redraw();
  alert(
    "Fichier bâche créé : " + LREEL + " x " + HREEL + " mm réels (maquette 1:" + S + ", document en mm)\n" +
    centres.length + " œillets posés — entraxe H " + Math.round(entraxeH) + " mm / V " + Math.round(entraxeV) + " mm\n\n" +
    "Calques : OEILLETS (dessus) / VISUEL (dessous)\n" +
    "Dépose ta créa dans VISUEL, puis lance « 2. Préparer le fichier de FAB »."
  );
})();
