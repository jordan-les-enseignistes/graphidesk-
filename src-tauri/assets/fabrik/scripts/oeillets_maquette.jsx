// ============================================================
// oeillets_maquette.jsx — pose les œillets sur la maquette de bâche
// ============================================================
// Le plan de travail ACTIF = la bâche, à l'échelle 1:échelle (1:10).
// Œillets aux 4 coins (marge/marge des bords) + intermédiaires
// équidistants, entraxe réel <= pasMaxMm (économise un œillet si un
// entraxe de 500-520 mm suffit). Posés sur un calque "OEILLETS",
// chaque œillet est un groupe nommé "OEILLET" (anneau gris + centre
// clair, Ø diamMaquetteMm réel).
// params : { echelle, margeMm, pasMm, pasMaxMm, diamMaquetteMm }

(function () {
  if (app.documents.length === 0) { alert("Ouvre d'abord la maquette de la bâche."); return; }
  var doc = app.activeDocument;

  var S = params.echelle || 10;
  var DIAM = (params.diamMaquetteMm || 25) / S;
  // ⚠️ la marge = distance bord de bâche → EXTRÉMITÉ de l'œillet.
  // Le centre est donc à marge + Ø/2 du bord.
  var MARGE = (params.margeMm || 25) / S + DIAM / 2;
  var PASMAX = (params.pasMaxMm || 520) / S;
  var MM = 2.834645669;

  // bâche = l'objet SÉLECTIONNÉ (union des sélections) ;
  // à défaut : le plan de travail actif
  var r = null;
  if (doc.selection && doc.selection.length > 0) {
    for (var si = 0; si < doc.selection.length; si++) {
      var sb = doc.selection[si].geometricBounds; // [gauche, haut, droite, bas]
      if (!r) r = [sb[0], sb[1], sb[2], sb[3]];
      else {
        if (sb[0] < r[0]) r[0] = sb[0];
        if (sb[1] > r[1]) r[1] = sb[1];
        if (sb[2] > r[2]) r[2] = sb[2];
        if (sb[3] < r[3]) r[3] = sb[3];
      }
    }
  } else {
    var ab = doc.artboards[doc.artboards.getActiveArtboardIndex()];
    r = ab.artboardRect;
  }
  var L = r[0], T = r[1], R = r[2], B = r[3];

  // positions des centres (en points)
  var x1 = L + MARGE * MM, x2 = R - MARGE * MM;
  var y1 = T - MARGE * MM, y2 = B + MARGE * MM;

  // répartition équidistante sur une longueur (points), entraxe <= PASMAX
  function repartir(a, b) {
    var span = Math.abs(b - a);
    var n = Math.max(1, Math.ceil(span / (PASMAX * MM))); // nb d'intervalles
    var out = [];
    for (var i = 0; i <= n; i++) out.push(a + (b - a) * (i / n));
    return out;
  }

  var xs = repartir(x1, x2);
  var ys = repartir(y1, y2);

  // centres : périmètre seulement (pas de doublons aux coins)
  var centres = [];
  for (var i = 0; i < xs.length; i++) { centres.push([xs[i], y1]); centres.push([xs[i], y2]); }
  for (var j = 1; j < ys.length - 1; j++) { centres.push([x1, ys[j]]); centres.push([x2, ys[j]]); }

  // calque OEILLETS (recréé à chaque exécution pour éviter les doublons)
  try {
    var old = doc.layers.getByName("OEILLETS");
    old.locked = false; old.remove();
  } catch (e) {}
  var layer = doc.layers.add();
  layer.name = "OEILLETS";

  // rendu "œillet laiton nickelé" : ombre portée, bague métal avec
  // biseaux clair/sombre, trou traversant (blanc). Proportions d'un
  // œillet réel Ø25 : trou ~Ø12.
  var cOmbre = new CMYKColor(); cOmbre.black = 78;
  var cBagueFonce = new CMYKColor(); cBagueFonce.black = 52;
  var cMetal = new CMYKColor(); cMetal.black = 16;
  var cReflet = new CMYKColor(); cReflet.black = 4;
  var cBiseau = new CMYKColor(); cBiseau.black = 62;
  var cTrou = new CMYKColor(); // blanc (mur visible à travers)

  function disque(cx, cy, d, col) {
    var p = layer.pathItems.ellipse(cy + d / 2, cx - d / 2, d, d);
    p.filled = true; p.fillColor = col; p.stroked = false;
    return p;
  }

  function oeillet(cx, cy) {
    var d = DIAM * MM;
    var items = [];
    // cercle invisible SYMÉTRIQUE Ø exact : le groupe mesure précisément
    // le diamètre demandé, et son centre de bounds = le centre de l'œillet
    // (repositionnement exact à l'étape FAB). L'ombre reste À L'INTÉRIEUR.
    var ref = layer.pathItems.ellipse(cy + d / 2, cx - d / 2, d, d);
    ref.filled = false; ref.stroked = false;
    items.push(ref);
    items.push(disque(cx + d * 0.03, cy - d * 0.03, d * 0.94, cOmbre)); // ombre portée (contenue)
    items.push(disque(cx, cy, d, cBagueFonce));                        // tranche de la bague
    items.push(disque(cx - d * 0.02, cy + d * 0.02, d * 0.92, cReflet)); // reflet haut-gauche
    items.push(disque(cx, cy, d * 0.86, cMetal));                      // plat métal
    items.push(disque(cx, cy, d * 0.56, cBiseau));                     // biseau vers le trou
    items.push(disque(cx, cy, d * 0.48, cTrou));                       // trou traversant
    var g = layer.groupItems.add();
    g.name = "OEILLET";
    // ordre d'empilement : chaque élément passe DEVANT le précédent
    // (le trou, créé en dernier, doit finir au premier plan)
    for (var m = 0; m < items.length; m++) items[m].move(g, ElementPlacement.PLACEATBEGINNING);
  }

  for (var c = 0; c < centres.length; c++) oeillet(centres[c][0], centres[c][1]);

  // entraxes réels obtenus (info)
  var entraxeH = xs.length > 1 ? Math.abs(xs[1] - xs[0]) / MM * S : 0;
  var entraxeV = ys.length > 1 ? Math.abs(ys[1] - ys[0]) / MM * S : 0;

  app.redraw();
  alert(
    centres.length + " œillets posés (calque OEILLETS)\n" +
    "Entraxe horizontal : " + Math.round(entraxeH) + " mm — vertical : " + Math.round(entraxeV) + " mm\n" +
    "(marge " + (params.margeMm || 25) + " mm, Ø " + (params.diamMaquetteMm || 25) + " mm réels, échelle 1:" + S + ")"
  );
})();
