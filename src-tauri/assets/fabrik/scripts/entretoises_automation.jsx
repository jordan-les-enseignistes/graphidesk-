// ============================================================
// GraphiDesk FabRik — Lettres relief PVC rétroéclairées
// Placement automatique d'entretoises
// ============================================================
// params injectés par GraphiDesk :
//   mode              : "placer" | "finaliser"
//   offsetMm          : offset intérieur du contour (déf. 5)
//   diamMm            : diamètre entretoise (déf. 9)
//   coverageMm        : rayon de couverture X (déf. 150)
//   fallbackMarginMm  : marge esthétique du fallback intérieur (déf. 3)
//
// Convention d'entrée (mode "placer") :
//   fichier à l'échelle 1:1 contenant le(s) tracé(s) de découpe
//   (contour noir). Le script gère tout le reste.
//
// Calques produits :
//   DECOUPE             tracé rose (magenta) = découpe 1:1
//   OFFSET              tracé vert = offset intérieur + encoches
//   ENTRETOISES_PREVIEW cercles éditables entre "placer" et "finaliser"
// ============================================================

(function (params) {
    var PT_PER_MM = 2.83465;

    // ---------- paramètres avec défauts ----------
    var MODE = (params && params.mode) ? String(params.mode) : "placer";
    var OFFSET_MM = num(params.offsetMm, 6);
    var DIAM_MM = num(params.diamMm, 9);
    var RADIUS_MM = DIAM_MM / 2;
    var COVERAGE_MM = num(params.coverageMm, 150);
    // Distance minimale entre le bord du cercle et le tracé rose (esthétique :
    // une entretoise collée au bord se voit dans le halo du rétroéclairage)
    var CLEARANCE_MM = num(params.clearanceMm, 2);

    var CANDIDATE_STEP_MM = 3;    // pas d'échantillonnage des candidats sur le vert
    var CURVE_SAMPLES = 10;       // subdivisions par segment de Bézier
    var MIN_SPACING_MM = DIAM_MM + 4; // distance min entre centres d'entretoises
    var CORNER_ANGLE_DEG = 28;    // seuil de détection des angles/extrémités
    var MAX_PER_PIECE = 40;       // garde-fou

    var LAYER_DECOUPE = "DECOUPE";
    var LAYER_OFFSET = "OFFSET";
    var LAYER_PREVIEW = "ENTRETOISES_PREVIEW";

    function num(v, def) {
        var n = parseFloat(v);
        return (isNaN(n) || n <= 0) ? def : n;
    }
    function mmToPt(mm) { return mm * PT_PER_MM; }
    function ptToMm(pt) { return pt / PT_PER_MM; }

    try {
        if (!app || app.documents.length === 0) {
            throw new Error("Aucun document Illustrator n'est ouvert.");
        }
        var doc = app.activeDocument;

        if (MODE === "placer") {
            runPlacer(doc);
        } else if (MODE === "finaliser") {
            runFinaliser(doc);
        } else {
            throw new Error("Mode inconnu : " + MODE);
        }

        return { success: true };
    } catch (error) {
        alert("❌ Erreur : " + error.message);
        return { success: false, error: error.message };
    }

    // ============================================================
    // MODE PLACER
    // ============================================================
    function runPlacer(doc) {
        // ----- 1. Calques + tracé rose -----
        var decoupeLayer = ensureLayer(doc, LAYER_DECOUPE);
        var offsetLayer = ensureLayer(doc, LAYER_OFFSET);
        var previewLayer = ensureLayer(doc, LAYER_PREVIEW);

        // Déplacer tous les tracés existants (hors calques cibles) vers DECOUPE
        var moved = collectSourcePaths(doc);
        if (moved.length === 0 && decoupeLayer.pageItems.length === 0) {
            throw new Error("Aucun tracé trouvé.\nLe fichier doit contenir le contour de découpe (tracé noir, échelle 1:1).");
        }
        for (var i = 0; i < moved.length; i++) {
            try { moved[i].move(decoupeLayer, ElementPlacement.PLACEATBEGINNING); } catch (e) {}
        }

        // Colorer le rose (magenta), sans fond
        var rose = makeCMYK(0, 100, 0, 0);
        forEachLeafPath(decoupeLayer, function (p) {
            p.filled = false;
            p.stroked = true;
            p.strokeColor = rose;
            p.strokeWidth = 1;
        });

        // ----- 2. Générer le tracé vert (offset intérieur) -----
        // Nettoyer un éventuel offset précédent
        removeAllItems(offsetLayer);

        for (var d = decoupeLayer.pageItems.length - 1; d >= 0; d--) {
            try {
                decoupeLayer.pageItems[d].duplicate(offsetLayer, ElementPlacement.PLACEATBEGINNING);
            } catch (e) {}
        }

        // Offset paramétrable via Live Effect puis décomposition.
        // ⚠️ Contour "intérieur" émulé : l'API Illustrator ne sait pas aligner
        // un contour vers l'intérieur, on décale donc le TRACÉ d'une demi-
        // épaisseur de trait (0.5pt) en plus — le bord du trait vert côté
        // découpe tombe ainsi EXACTEMENT à OFFSET_MM du bord extérieur
        // (l'atelier mesurait un peu moins avec le trait centré sur le tracé).
        var offsetPt = -(mmToPt(OFFSET_MM) + 0.5);
        var fx = '<LiveEffect name="Adobe Offset Path"><Dict data="I jntp 2 R mlim 4 R ofst ' + offsetPt + ' "/></LiveEffect>';
        for (var o = 0; o < offsetLayer.pageItems.length; o++) {
            try { offsetLayer.pageItems[o].applyEffect(fx); } catch (e) {}
        }
        doc.selection = null;
        selectAllOn(offsetLayer);
        try { app.executeMenuCommand("expandStyle"); } catch (e) {}
        doc.selection = null;

        var vert = makeCMYK(100, 0, 100, 0);
        forEachLeafPath(offsetLayer, function (p) {
            p.filled = false;
            p.stroked = true;
            p.strokeColor = vert;
            p.strokeWidth = 1;
        });
        app.redraw();

        // ----- 3. Extraire la géométrie (polylignes en mm) -----
        var pinkRings = extractRings(decoupeLayer);
        var greenRings = extractRings(offsetLayer);
        if (pinkRings.length === 0) throw new Error("Impossible d'extraire le tracé de découpe.");
        if (greenRings.length === 0) throw new Error("L'offset intérieur n'a produit aucun tracé (formes trop fines pour " + OFFSET_MM + "mm ?).");

        var pinkGrid = buildSegmentGrid(pinkRings, 20);
        // Index de parité optimisé (bbox + contours allégés) pour les tests
        // "point dans la forme" — sinon chaque test parcourt tous les points
        // de toutes les lettres et le placement prend 30s+
        var pinkParity = buildParityIndex(pinkRings);

        // ----- 4. Regrouper par sous-forme (lettre) -----
        var pieces = groupIntoPieces(pinkRings, greenRings);

        // ----- 5. Placement par pièce -----
        removeAllItems(previewLayer);
        var colStandard = makeCMYK(0, 60, 100, 0); // orange = standard (sur le vert)
        var colFallback = makeCMYK(100, 0, 0, 0);  // cyan = fallback (glissé à l'intérieur)

        var totStd = 0, totFb = 0, warnings = [];

        for (var pi = 0; pi < pieces.length; pi++) {
            var piece = pieces[pi];
            var result;
            try {
                result = placeForPiece(piece, pinkParity, pinkGrid);
            } catch (pieceErr) {
                warnings.push("Sous-forme " + (pi + 1) + " : erreur interne (" + pieceErr.message + ")");
                continue;
            }
            for (var r = 0; r < result.placed.length; r++) {
                var pl = result.placed[r];
                // classification : si le cercle ne touche plus le vert → fallback intérieur
                var isFallback = distToRings(pl.x, pl.y, piece.greenRings) >= RADIUS_MM - 0.1;
                drawCircle(previewLayer, pl.x, pl.y, RADIUS_MM, isFallback ? colFallback : colStandard);
                if (isFallback) totFb++; else totStd++;
            }
            if (result.placed.length === 0) {
                warnings.push("Sous-forme " + (pi + 1) + " : 0 entretoise posée (" + result.diag + ")");
            }
            for (var w = 0; w < result.warnings.length; w++) warnings.push(result.warnings[w]);
        }

        try { previewLayer.zOrder(ZOrderMethod.BRINGTOFRONT); } catch (e) {}
        app.redraw();

        var msg = "✅ PLACEMENT TERMINÉ\n" +
            "═══════════════════════════\n" +
            "Sous-formes détectées : " + pieces.length + "\n" +
            "Entretoises standard (orange) : " + totStd + "\n" +
            "Entretoises fallback intérieur (cyan) : " + totFb + "\n";
        if (warnings.length > 0) {
            msg += "\n⚠️ AVERTISSEMENTS :\n";
            for (var wm = 0; wm < warnings.length && wm < 8; wm++) msg += "• " + warnings[wm] + "\n";
            if (warnings.length > 8) msg += "• ... et " + (warnings.length - 8) + " autre(s)\n";
        }
        msg += "\n👉 Ajuste les cercles sur le calque " + LAYER_PREVIEW +
            "\n(déplacer / ajouter / supprimer), puis lance « Finaliser ».";

        // Rapport complet écrit sur le Bureau (pour diagnostic)
        try {
            var rep = "RAPPORT PLACEMENT ENTRETOISES — " + doc.name + "\n";
            rep += "offset=" + OFFSET_MM + "mm diam=" + DIAM_MM + "mm couverture=" + COVERAGE_MM + "mm garde=" + CLEARANCE_MM + "mm\n";
            rep += "Anneaux roses : " + pinkRings.length + " / verts : " + greenRings.length + " / sous-formes : " + pieces.length + "\n";
            rep += "Posées : " + totStd + " standard + " + totFb + " fallback\n\nAVERTISSEMENTS (" + warnings.length + ") :\n";
            for (var wr = 0; wr < warnings.length; wr++) rep += "• " + warnings[wr] + "\n";
            var repFile = new File(Folder.desktop + "/rapport_entretoises.txt");
            repFile.encoding = "UTF-8";
            repFile.open("w");
            repFile.write(rep);
            repFile.close();
        } catch (e) {}

        alert(msg);
    }

    // ============================================================
    // MODE FINALISER
    // ============================================================
    function runFinaliser(doc) {
        var decoupeLayer = findLayer(doc, LAYER_DECOUPE);
        var offsetLayer = findLayer(doc, LAYER_OFFSET);
        var previewLayer = findLayer(doc, LAYER_PREVIEW);
        if (!decoupeLayer || !offsetLayer || !previewLayer) {
            throw new Error("Calques manquants. Lance d'abord « Placer les entretoises ».");
        }
        decoupeLayer.locked = false;
        offsetLayer.locked = false;
        previewLayer.locked = false;

        // ----- 1. Récupérer les cercles du preview -----
        var circles = [];
        forEachLeafPath(previewLayer, function (p) {
            var gb = p.geometricBounds;
            var w = ptToMm(gb[2] - gb[0]);
            var h = ptToMm(gb[1] - gb[3]);
            if (w > 1 && h > 1 && Math.abs(w - h) / Math.max(w, h) < 0.2) {
                circles.push({
                    x: ptToMm((gb[0] + gb[2]) / 2),
                    y: ptToMm((gb[1] + gb[3]) / 2),
                    r: (w + h) / 4,
                    item: p
                });
            }
        });
        if (circles.length === 0) {
            throw new Error("Aucune entretoise sur le calque " + LAYER_PREVIEW + ".");
        }

        // ----- 2. Re-validation : chaque cercle doit tenir dans le rose -----
        var pinkRings = extractRings(decoupeLayer);
        var pinkGrid = buildSegmentGrid(pinkRings, 20);
        var problems = [];
        for (var c = 0; c < circles.length; c++) {
            var ci = circles[c];
            if (!pointInRings(ci.x, ci.y, pinkRings)) {
                problems.push("Entretoise hors des lettres en x=" + Math.round(ci.x) + " y=" + Math.round(ci.y));
            } else if (distToSegmentsGrid(ci.x, ci.y, pinkGrid) < ci.r - 0.2) {
                problems.push("Entretoise déborde du tracé rose en x=" + Math.round(ci.x) + " y=" + Math.round(ci.y));
            }
        }
        if (problems.length > 0) {
            var pmsg = "⚠️ " + problems.length + " entretoise(s) posent problème :\n\n";
            for (var pm = 0; pm < problems.length && pm < 6; pm++) pmsg += "• " + problems[pm] + "\n";
            pmsg += "\nContinuer quand même ?";
            if (!confirm(pmsg)) throw new Error("Finalisation annulée — corrige les entretoises signalées.");
        }

        // ----- 3. Séparer : encoches (intersectent le vert) vs cercles pleins -----
        var greenRings = extractRings(offsetLayer);
        var vert = makeCMYK(100, 0, 100, 0);
        var toSubtract = [];
        var standalone = [];

        for (var c2 = 0; c2 < circles.length; c2++) {
            var ci2 = circles[c2];
            var dGreen = distToRings(ci2.x, ci2.y, greenRings);
            if (dGreen < ci2.r - 0.1) {
                toSubtract.push(ci2);
            } else {
                standalone.push(ci2);
            }
        }

        // ----- 4. Encoches GÉOMÉTRIQUES (sans Pathfinder) -----
        // Le Pathfinder d'Illustrator s'est révélé non fiable en script
        // (résultats vides à répétition). On construit donc nous-mêmes les
        // tracés encochés : la polyligne verte est coupée aux intersections de
        // chaque cercle et on y insère l'arc qui bombe vers l'intérieur.
        var greenItems = [];
        for (var gi = 0; gi < offsetLayer.pageItems.length; gi++) {
            greenItems.push(offsetLayer.pageItems[gi]);
        }
        var nbNotches = 0;
        var finalDiag = [];
        for (var g3 = 0; g3 < greenItems.length; g3++) {
            var gItem = greenItems[g3];
            var itemRings = extractRingsOfItem(gItem);
            if (itemRings.length === 0) {
                finalDiag.push("Item " + (g3 + 1) + " : aucun anneau extrait — laissé tel quel");
                continue;
            }

            // cercles qui mordent cet item vert
            var mine = [];
            for (var mc = 0; mc < toSubtract.length; mc++) {
                var cc = toSubtract[mc];
                if (distToRings(cc.x, cc.y, itemRings) < cc.r - 0.05) mine.push(cc);
            }
            if (mine.length === 0) {
                finalDiag.push("Item " + (g3 + 1) + " : aucun cercle — laissé tel quel");
                continue;
            }

            // reconstruire chaque tracé feuille de l'item
            var leaves = [];
            collectLeaves(gItem, leaves);
            var itemNotches = 0;
            for (var lf = 0; lf < leaves.length; lf++) {
                try {
                    var leafPoly = flattenPath(leaves[lf]);
                    if (leafPoly.length < 3) continue;

                    // cercles touchant CE tracé précis
                    var touching = [];
                    for (var tc = 0; tc < mine.length; tc++) {
                        if (distToRings(mine[tc].x, mine[tc].y, [leafPoly]) < mine[tc].r - 0.05) {
                            touching.push(mine[tc]);
                        }
                    }

                    if (touching.length === 0) {
                        // aucun cercle : recopier tel quel (on garde les courbes natives)
                        leaves[lf].duplicate(offsetLayer, ElementPlacement.PLACEATBEGINNING);
                    } else {
                        var notched = notchRing(leafPoly, touching, itemRings);
                        if (notched && notched.length >= 3) {
                            drawPolyline(offsetLayer, notched, vert);
                            itemNotches += touching.length;
                        } else {
                            finalDiag.push("Item " + (g3 + 1) + " feuille " + (lf + 1) +
                                " : encochage n'a rien produit (" + touching.length + " cercles)");
                        }
                    }
                } catch (leafErr) {
                    finalDiag.push("Item " + (g3 + 1) + " feuille " + (lf + 1) + " : ERREUR " + leafErr.message);
                }
            }
            nbNotches += itemNotches;
            finalDiag.push("Item " + (g3 + 1) + " : " + leaves.length + " feuille(s), " +
                mine.length + " cercle(s), " + itemNotches + " encoche(s)");
            try { gItem.remove(); } catch (e) {}
        }

        // Rapport de finalisation sur le Bureau
        try {
            var frep = "RAPPORT FINALISATION ENTRETOISES — " + doc.name + "\n";
            frep += "Items verts : " + greenItems.length + " / cercles preview : " + circles.length +
                " (" + toSubtract.length + " encoches, " + standalone.length + " pleins)\n\n";
            for (var fd = 0; fd < finalDiag.length; fd++) frep += "• " + finalDiag[fd] + "\n";
            var frepFile = new File(Folder.desktop + "/rapport_finalisation.txt");
            frepFile.encoding = "UTF-8";
            frepFile.open("w");
            frepFile.write(frep);
            frepFile.close();
        } catch (e) {}

        // ----- 5. Cercles pleins (fallback) : déplacés sur OFFSET en vert -----
        for (var st = 0; st < standalone.length; st++) {
            try {
                var moved = standalone[st].item.duplicate(offsetLayer, ElementPlacement.PLACEATBEGINNING);
                moved.filled = false;
                moved.stroked = true;
                moved.strokeColor = vert;
                moved.strokeWidth = 1;
            } catch (e) {}
        }

        // ----- 6. Recolorer l'ensemble du calque OFFSET en vert -----
        forEachLeafPath(offsetLayer, function (p) {
            p.filled = false;
            p.stroked = true;
            p.strokeColor = vert;
            p.strokeWidth = 1;
        });

        // ----- 7. Supprimer le calque preview -----
        try { previewLayer.remove(); } catch (e) {}

        app.redraw();

        alert("🎉 FINALISATION TERMINÉE !\n" +
            "═══════════════════════════\n" +
            "Encoches pathfindées : " + nbNotches + "\n" +
            "Entretoises intérieures (cercles pleins) : " + standalone.length + "\n\n" +
            "⚠️ VÉRIFICATIONS :\n" +
            "• Contrôler visuellement les encoches\n" +
            "• Vérifier l'échelle 1:1 avant export\n\n" +
            "✅ Fichier de fabrication prêt !");
    }

    // ============================================================
    // PLACEMENT — cœur de l'algo (par sous-forme)
    // ============================================================
    function placeForPiece(piece, pinkParity, pinkGrid) {
        var placed = [];
        var warnings = [];

        // 1. Candidats le long des anneaux verts de la pièce
        var candidates = []; // {x, y, corner, angle, fallback, nx, ny}
        for (var g = 0; g < piece.greenRings.length; g++) {
            var ring = piece.greenRings[g];
            var samples = resampleRing(ring, CANDIDATE_STEP_MM);
            for (var s = 0; s < samples.length; s++) {
                var pt = samples[s];
                var prev = samples[(s - 1 + samples.length) % samples.length];
                var next = samples[(s + 1) % samples.length];
                var ang = turnAngleDeg(prev, pt, next);
                candidates.push({
                    x: pt[0], y: pt[1],
                    angle: ang,
                    corner: ang >= CORNER_ANGLE_DEG,
                    fallback: false,
                    prev: prev, next: next
                });
            }
        }
        if (candidates.length === 0) {
            warnings.push("Sous-forme sans tracé vert exploitable (trop fine ?)");
            return { placed: placed, warnings: warnings, diag: "0 candidats sur le vert" };
        }

        // 2. Positionner chaque candidat : le cercle doit tenir dans le rose
        //    avec une garde de CLEARANCE_MM. S'il est trop près du bord, on le
        //    glisse vers l'intérieur le long de la normale (il mange alors un
        //    peu plus dans le vert, voire devient un cercle plein intérieur).
        //    Dégradation : si RIEN ne passe avec la garde demandée, on retente
        //    avec une garde minimale de 0.5mm (forme étroite).
        var built = buildValidCandidates(candidates, pinkParity, pinkGrid, RADIUS_MM + CLEARANCE_MM);
        var valid = built.list;
        var degraded = false;
        if (valid.length === 0 && CLEARANCE_MM > 0.5) {
            built = buildValidCandidates(candidates, pinkParity, pinkGrid, RADIUS_MM + 0.5);
            valid = built.list;
            degraded = valid.length > 0;
        }
        var diag = candidates.length + " candidats, " + built.nbInside + " dans la forme, " + valid.length + " valides";
        if (degraded) {
            warnings.push("Sous-forme étroite : garde réduite à 0.5mm au lieu de " + CLEARANCE_MM + "mm");
        }
        if (valid.length === 0) {
            warnings.push("Sous-forme trop étroite : aucune entretoise Ø" + DIAM_MM + "mm ne rentre, " +
                "il faut un trait d'au moins " + (DIAM_MM + 1) + "mm de large (" + diag + ")");
            return { placed: placed, warnings: warnings, diag: diag };
        }

        // 3. Points à couvrir = échantillons du vert de la pièce
        var coverPts = [];
        for (var g2 = 0; g2 < piece.greenRings.length; g2++) {
            var cs = resampleRing(piece.greenRings[g2], CANDIDATE_STEP_MM * 2);
            for (var q = 0; q < cs.length; q++) coverPts.push(cs[q]);
        }

        // 4. Seeds : angles/extrémités d'abord (triés par angle décroissant)
        var seeds = [];
        for (var sv = 0; sv < valid.length; sv++) {
            if (valid[sv].corner) seeds.push(valid[sv]);
        }
        seeds.sort(function (a, b) { return b.angle - a.angle; });
        for (var se = 0; se < seeds.length && placed.length < MAX_PER_PIECE; se++) {
            if (minDistToPlaced(seeds[se], placed) >= MIN_SPACING_MM) {
                placed.push(seeds[se]);
            }
        }

        // 5. Complétion par couverture (farthest-point sur les trous de couverture)
        var guard = 0;
        while (placed.length < MAX_PER_PIECE && guard < 200) {
            guard++;
            var worst = worstCoveredPoint(coverPts, placed);
            if (worst.dist <= COVERAGE_MM) break; // couverture satisfaite

            // candidat valide le plus proche du point mal couvert, à distance min des posés
            var bestCand = null, bestD = -1;
            for (var bc = 0; bc < valid.length; bc++) {
                var cnd = valid[bc];
                if (minDistToPlaced(cnd, placed) < MIN_SPACING_MM) continue;
                var dd = dist2d(cnd.x, cnd.y, worst.x, worst.y);
                if (bestCand === null || dd < bestD) { bestCand = cnd; bestD = dd; }
            }
            if (bestCand === null) {
                warnings.push("Zone non couvrable (candidats épuisés) autour de x=" + Math.round(worst.x) + " y=" + Math.round(worst.y));
                break;
            }
            placed.push(bestCand);
        }

        // 6. Minimum 2 par pièce (anti-rotation)
        if (placed.length === 1 && valid.length > 1) {
            var far = null, farD = -1;
            for (var f = 0; f < valid.length; f++) {
                var dd2 = dist2d(valid[f].x, valid[f].y, placed[0].x, placed[0].y);
                if (dd2 >= MIN_SPACING_MM && dd2 > farD) { far = valid[f]; farD = dd2; }
            }
            if (far) placed.push(far);
        }
        if (placed.length === 0 && valid.length > 0) {
            placed.push(valid[Math.floor(valid.length / 2)]);
        }

        return { placed: placed, warnings: warnings, diag: diag };
    }

    // Construit la liste des candidats valides pour une garde donnée
    function buildValidCandidates(candidates, pinkParity, pinkGrid, need) {
        var list = [];
        var nbInside = 0;
        for (var v = 0; v < candidates.length; v++) {
            var cd = candidates[v];
            if (!pointInParity(cd.x, cd.y, pinkParity)) continue;
            nbInside++;
            if (distToSegmentsGrid(cd.x, cd.y, pinkGrid) >= need) {
                list.push(cd);
            } else {
                var slid = slideInward(cd, need, pinkParity, pinkGrid);
                if (slid) list.push(slid);
            }
        }
        return { list: list, nbInside: nbInside };
    }

    // Glissement vers l'intérieur le long de la normale, jusqu'à ce que le
    // bord du cercle soit à `need` mm du tracé rose. Retourne null si la forme
    // est trop étroite.
    // ⚠️ La direction "intérieur" n'est PAS déductible du sens du tracé (au
    // milieu d'un trait large, les deux côtés de la normale sont dans la
    // forme). On choisit donc la direction qui ÉLOIGNE du tracé rose, et si
    // elle échoue on tente l'autre.
    function slideInward(cd, need, pinkParity, pinkGrid) {
        // normale au tracé au point candidat
        var tx = cd.next[0] - cd.prev[0];
        var ty = cd.next[1] - cd.prev[1];
        var len = Math.sqrt(tx * tx + ty * ty);
        if (len < 0.001) return null;
        var nx = -ty / len, ny = tx / len;

        // direction prioritaire = celle où la distance au rose augmente
        var probe = 1.0;
        var dPlus = distToSegmentsGrid(cd.x + nx * probe, cd.y + ny * probe, pinkGrid);
        var dMinus = distToSegmentsGrid(cd.x - nx * probe, cd.y - ny * probe, pinkGrid);
        var firstSign = (dPlus >= dMinus) ? 1 : -1;

        var res = trySlide(cd, nx * firstSign, ny * firstSign, need, pinkParity, pinkGrid);
        if (res) return res;
        return trySlide(cd, -nx * firstSign, -ny * firstSign, need, pinkParity, pinkGrid);
    }

    function trySlide(cd, nx, ny, need, pinkParity, pinkGrid) {
        var maxSlide = need + 20;
        for (var s = 0.5; s <= maxSlide; s += 0.5) {
            var qx = cd.x + nx * s;
            var qy = cd.y + ny * s;
            if (!pointInParity(qx, qy, pinkParity)) return null; // sorti de la forme
            if (distToSegmentsGrid(qx, qy, pinkGrid) >= need) {
                return { x: qx, y: qy, angle: cd.angle, corner: cd.corner, prev: cd.prev, next: cd.next };
            }
        }
        return null;
    }

    // ============================================================
    // GÉOMÉTRIE — extraction et utilitaires
    // ============================================================

    // Extrait tous les anneaux (polylignes fermées, en mm) d'un calque
    // ⚠️ On accepte aussi les tracés techniquement "ouverts" (flag closed=false
    // mais extrémités confondues — fréquent sur des contours vectorisés) :
    // ils sont refermés implicitement par la corde de fermeture.
    function extractRings(layer) {
        var rings = [];
        forEachLeafPath(layer, function (p) {
            if (p.pathPoints.length < 3) return;
            var poly = flattenPath(p);
            if (poly.length >= 3) rings.push(poly);
        });
        return rings;
    }

    // ============================================================
    // ENCOCHES GÉOMÉTRIQUES — découpe d'un anneau par des cercles
    // ============================================================

    // Reconstruit un anneau (polyligne fermée) en remplaçant les portions
    // traversant un cercle par l'arc de ce cercle qui bombe vers l'intérieur.
    // Hypothèse : les cercles ne se chevauchent pas entre eux (garanti par
    // MIN_SPACING au placement).
    function notchRing(polyIn, circles, itemRings) {
        // ⚠️ Densifier d'abord : les segments droits sont aplatis en 1 seul
        // point par sommet — sans densification, un cercle posé au milieu d'un
        // long segment droit n'est jamais détecté (aucun POINT dans le cercle).
        var poly = densifyRing(polyIn, 1.5);
        var n = poly.length;

        function inCircle(pt) {
            for (var c = 0; c < circles.length; c++) {
                if (dist2d(pt[0], pt[1], circles[c].x, circles[c].y) < circles[c].r) return c;
            }
            return -1;
        }

        // point de départ hors de tout cercle
        var start = -1;
        for (var i = 0; i < n; i++) {
            if (inCircle(poly[i]) < 0) { start = i; break; }
        }
        if (start < 0) return null; // anneau entièrement avalé par un cercle

        var out = [];
        var i2 = 0;
        while (i2 < n) {
            var idx = (start + i2) % n;
            var pt = poly[idx];
            var ci = inCircle(pt);
            if (ci < 0) {
                out.push(pt);
                i2++;
                continue;
            }
            // entrée dans le cercle ci
            var prevPt = out.length ? out[out.length - 1] : poly[start];
            var c = circles[ci];
            var A = lineCircleHit(prevPt, pt, c);

            // avancer jusqu'à la sortie du cercle
            var j2 = i2;
            var lastInside = pt;
            var nextPt = null;
            while (j2 < n) {
                var jdx = (start + j2) % n;
                if (inCircle(poly[jdx]) === ci) {
                    lastInside = poly[jdx];
                    j2++;
                } else {
                    nextPt = poly[jdx];
                    break;
                }
            }
            if (nextPt === null) nextPt = poly[start]; // fin de boucle (start est hors cercles)

            var B = lineCircleHit(nextPt, lastInside, c);

            // insérer A + arc intérieur + B
            out.push(A);
            var arc = buildInnerArc(A, B, c, itemRings);
            for (var ap = 0; ap < arc.length; ap++) out.push(arc[ap]);
            out.push(B);

            i2 = (j2 > i2) ? j2 : i2 + 1; // sécurité anti-boucle infinie
        }
        return out;
    }

    // Insère des points intermédiaires pour qu'aucun segment ne dépasse maxLen
    function densifyRing(poly, maxLen) {
        var out = [];
        var n = poly.length;
        for (var i = 0; i < n; i++) {
            var a = poly[i];
            var b = poly[(i + 1) % n];
            out.push(a);
            var L = dist2d(a[0], a[1], b[0], b[1]);
            if (L > maxLen) {
                var k = Math.ceil(L / maxLen);
                for (var s = 1; s < k; s++) {
                    out.push([a[0] + (b[0] - a[0]) * s / k, a[1] + (b[1] - a[1]) * s / k]);
                }
            }
        }
        return out;
    }

    // Intersection précise segment [po (hors cercle) → pi (dans le cercle)] / cercle
    function lineCircleHit(po, pi_, c) {
        var dx = pi_[0] - po[0], dy = pi_[1] - po[1];
        var fx = po[0] - c.x, fy = po[1] - c.y;
        var a = dx * dx + dy * dy;
        var b = 2 * (fx * dx + fy * dy);
        var cc = fx * fx + fy * fy - c.r * c.r;
        var disc = b * b - 4 * a * cc;
        if (disc < 0 || a < 0.000001) {
            return [(po[0] + pi_[0]) / 2, (po[1] + pi_[1]) / 2];
        }
        var sq = Math.sqrt(disc);
        var t1 = (-b - sq) / (2 * a);
        var t2 = (-b + sq) / (2 * a);
        var t = (t1 >= 0 && t1 <= 1) ? t1 : t2;
        if (t < 0) t = 0;
        if (t > 1) t = 1;
        return [po[0] + t * dx, po[1] + t * dy];
    }

    // Arc de cercle de A vers B qui bombe vers l'INTÉRIEUR de la forme
    // (l'encoche doit manger dans la matière, pas ressortir du tracé)
    function buildInnerArc(A, B, c, itemRings) {
        var a0 = Math.atan2(A[1] - c.y, A[0] - c.x);
        var a1 = Math.atan2(B[1] - c.y, B[0] - c.x);
        var dCCW = a1 - a0;
        while (dCCW < 0) dCCW += Math.PI * 2;
        var dCW = dCCW - Math.PI * 2;

        // candidat CCW : si le milieu de l'arc est dans la forme, c'est le bon
        var midCCW = arcPoint(c, a0 + dCCW / 2);
        var delta = pointInRings(midCCW[0], midCCW[1], itemRings) ? dCCW : dCW;

        var arcLen = Math.abs(delta) * c.r;
        var steps = Math.max(4, Math.ceil(arcLen / 1.5));
        var pts = [];
        for (var s = 1; s < steps; s++) {
            pts.push(arcPoint(c, a0 + delta * s / steps));
        }
        return pts;
    }

    function arcPoint(c, ang) {
        return [c.x + Math.cos(ang) * c.r, c.y + Math.sin(ang) * c.r];
    }

    // Dessine une polyligne fermée (points en mm) sur un calque
    // ⚠️ setEntirePath refuse les tracés de plus de ~1000 points : on simplifie
    // la polyligne (tolérance 0.05mm, invisible en fabrication) et on augmente
    // la tolérance si nécessaire jusqu'à passer sous la limite.
    function drawPolyline(layer, ptsMm, strokeCol) {
        var pts = simplifyPoly(ptsMm, 0.05);
        var tol = 0.1;
        while (pts.length > 950 && tol <= 0.8) {
            pts = simplifyPoly(ptsMm, tol);
            tol = tol * 2;
        }
        var arr = [];
        for (var i = 0; i < pts.length; i++) {
            arr.push([mmToPt(pts[i][0]), mmToPt(pts[i][1])]);
        }
        var p = layer.pathItems.add();
        p.setEntirePath(arr);
        p.closed = true;
        p.filled = false;
        p.stroked = true;
        p.strokeColor = strokeCol;
        p.strokeWidth = 1;
        return p;
    }

    // Simplification de polyligne : supprime les points quasi-colinéaires
    // (déviation < tol mm par rapport à la corde), en préservant la géométrie.
    function simplifyPoly(pts, tol) {
        if (pts.length <= 3) return pts;
        var out = [pts[0]];
        var anchor = 0;
        var i = 2;
        while (i < pts.length) {
            // déviation max des points intermédiaires par rapport à la corde anchor→i
            var maxDev = 0;
            for (var k = anchor + 1; k < i; k++) {
                var d = distToSegment(pts[k][0], pts[k][1], pts[anchor], pts[i]);
                if (d > maxDev) maxDev = d;
            }
            if (maxDev > tol) {
                out.push(pts[i - 1]);
                anchor = i - 1;
            }
            i++;
        }
        out.push(pts[pts.length - 1]);
        return out;
    }

    // Collecte les PathItem feuilles d'un item
    function collectLeaves(item, out) {
        try {
            if (item.typename === "PathItem") {
                out.push(item);
            } else if (item.typename === "CompoundPathItem") {
                for (var p = 0; p < item.pathItems.length; p++) out.push(item.pathItems[p]);
            } else if (item.typename === "GroupItem") {
                for (var i = 0; i < item.pageItems.length; i++) collectLeaves(item.pageItems[i], out);
            }
        } catch (e) {}
    }

    // Extrait les anneaux d'un item précis (PathItem, CompoundPathItem ou GroupItem)
    function extractRingsOfItem(item) {
        var rings = [];
        function handlePath(p) {
            if (p.pathPoints.length < 3) return;
            var poly = flattenPath(p);
            if (poly.length >= 3) rings.push(poly);
        }
        try {
            if (item.typename === "PathItem") {
                handlePath(item);
            } else if (item.typename === "CompoundPathItem") {
                for (var p = 0; p < item.pathItems.length; p++) handlePath(item.pathItems[p]);
            } else if (item.typename === "GroupItem") {
                forEachLeafPath(item, handlePath);
            }
        } catch (e) {}
        return rings;
    }

    // Aplatit un PathItem en polyligne [ [x,y], ... ] en mm
    // Subdivision ADAPTATIVE : le nombre de pas dépend de la longueur réelle
    // du segment (précision ~2mm), sinon les grands arcs (O de 700mm...)
    // seraient approximés par des cordes de 50-90mm qui faussent toutes les
    // distances.
    function flattenPath(p) {
        var out = [];
        var pts = p.pathPoints;
        var n = pts.length;
        // tracé ouvert : ne pas parcourir le segment de bouclage (ses poignées
        // n'existent pas) — la fermeture se fait par la corde implicite
        var nbSegs = p.closed ? n : n - 1;
        for (var i = 0; i < nbSegs; i++) {
            var a = pts[i];
            var b = pts[(i + 1) % n];
            var P0 = a.anchor, P1 = a.rightDirection, P2 = b.leftDirection, P3 = b.anchor;
            var isLine = (P1[0] === P0[0] && P1[1] === P0[1] && P2[0] === P3[0] && P2[1] === P3[1]);
            var steps;
            if (isLine) {
                steps = 1;
            } else {
                // longueur approx = polygone de contrôle (majorant)
                var approxLen = ptToMm(
                    segLen(P0, P1) + segLen(P1, P2) + segLen(P2, P3)
                );
                steps = Math.ceil(approxLen / 2); // 1 point tous les ~2mm
                if (steps < CURVE_SAMPLES) steps = CURVE_SAMPLES;
                if (steps > 200) steps = 200;
            }
            for (var t = 0; t < steps; t++) {
                var u = t / steps;
                var pt = bezierPoint(P0, P1, P2, P3, u);
                out.push([ptToMm(pt[0]), ptToMm(pt[1])]);
            }
        }
        // tracé ouvert : ajouter le dernier point d'ancrage (la fermeture vers
        // le premier point se fait par la corde implicite, quasi nulle si les
        // extrémités coïncident)
        if (!p.closed && n > 0) {
            var lastAnchor = pts[n - 1].anchor;
            out.push([ptToMm(lastAnchor[0]), ptToMm(lastAnchor[1])]);
        }
        return out;
    }

    function segLen(A, B) {
        var dx = B[0] - A[0], dy = B[1] - A[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    function bezierPoint(P0, P1, P2, P3, t) {
        var mt = 1 - t;
        var x = mt * mt * mt * P0[0] + 3 * mt * mt * t * P1[0] + 3 * mt * t * t * P2[0] + t * t * t * P3[0];
        var y = mt * mt * mt * P0[1] + 3 * mt * mt * t * P1[1] + 3 * mt * t * t * P2[1] + t * t * t * P3[1];
        return [x, y];
    }

    // Ré-échantillonne un anneau à pas régulier (mm)
    function resampleRing(ring, step) {
        var out = [];
        var acc = 0;
        for (var i = 0; i < ring.length; i++) {
            var a = ring[i];
            var b = ring[(i + 1) % ring.length];
            var seg = dist2d(a[0], a[1], b[0], b[1]);
            if (seg < 0.0001) continue;
            var pos = 0;
            while (acc + (seg - pos) >= step) {
                var advance = step - acc;
                pos += advance;
                var u = pos / seg;
                out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
                acc = 0;
            }
            acc += (seg - pos);
        }
        if (out.length === 0) out.push(ring[0]);
        return out;
    }

    // Angle de virage (degrés) au point b entre a→b et b→c
    function turnAngleDeg(a, b, c) {
        var v1x = b[0] - a[0], v1y = b[1] - a[1];
        var v2x = c[0] - b[0], v2y = c[1] - b[1];
        var l1 = Math.sqrt(v1x * v1x + v1y * v1y);
        var l2 = Math.sqrt(v2x * v2x + v2y * v2y);
        if (l1 < 0.0001 || l2 < 0.0001) return 0;
        var cos = (v1x * v2x + v1y * v2y) / (l1 * l2);
        if (cos > 1) cos = 1;
        if (cos < -1) cos = -1;
        return Math.acos(cos) * 180 / Math.PI;
    }

    // ---------- Index de parité optimisé (perf) ----------
    // Contours allégés (~6mm) + bbox par anneau : le test point-dans-forme ne
    // parcourt que les anneaux dont la bbox peut influencer la parité.
    function buildParityIndex(rings) {
        var idx = [];
        for (var r = 0; r < rings.length; r++) {
            var ring = rings[r];
            // simplification : garder 1 point tous les ~6mm
            var coarse = [];
            var acc = 999;
            for (var i = 0; i < ring.length; i++) {
                if (acc >= 6) { coarse.push(ring[i]); acc = 0; }
                var nxt = ring[(i + 1) % ring.length];
                acc += dist2d(ring[i][0], ring[i][1], nxt[0], nxt[1]);
            }
            if (coarse.length < 3) coarse = ring;
            // bbox
            var minX = 999999, maxX = -999999, minY = 999999, maxY = -999999;
            for (var b = 0; b < coarse.length; b++) {
                if (coarse[b][0] < minX) minX = coarse[b][0];
                if (coarse[b][0] > maxX) maxX = coarse[b][0];
                if (coarse[b][1] < minY) minY = coarse[b][1];
                if (coarse[b][1] > maxY) maxY = coarse[b][1];
            }
            idx.push({ pts: coarse, minX: minX, maxX: maxX, minY: minY, maxY: maxY });
        }
        return idx;
    }

    function pointInParity(x, y, idx) {
        var inside = false;
        for (var r = 0; r < idx.length; r++) {
            var e = idx[r];
            // hors bbox en y, ou à droite de la bbox : 0 croisement
            // à gauche de la bbox : nombre pair de croisements → parité inchangée
            if (y < e.minY || y > e.maxY || x > e.maxX || x < e.minX) continue;
            var ring = e.pts;
            var n = ring.length;
            var j = n - 1;
            for (var i = 0; i < n; i++) {
                var yi = ring[i][1], yj = ring[j][1];
                var xi = ring[i][0], xj = ring[j][0];
                if (((yi > y) !== (yj > y)) &&
                    (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                    inside = !inside;
                }
                j = i;
            }
        }
        return inside;
    }

    // Point-in-polygon even-odd sur un ensemble d'anneaux
    function pointInRings(x, y, rings) {
        var inside = false;
        for (var r = 0; r < rings.length; r++) {
            var ring = rings[r];
            var n = ring.length;
            var j = n - 1;
            for (var i = 0; i < n; i++) {
                var yi = ring[i][1], yj = ring[j][1];
                var xi = ring[i][0], xj = ring[j][0];
                if (((yi > y) !== (yj > y)) &&
                    (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                    inside = !inside;
                }
                j = i;
            }
        }
        return inside;
    }

    // Distance min d'un point à un ensemble d'anneaux (polylignes)
    function distToRings(x, y, rings) {
        var best = -1;
        for (var r = 0; r < rings.length; r++) {
            var ring = rings[r];
            var n = ring.length;
            for (var i = 0; i < n; i++) {
                var d = distToSegment(x, y, ring[i], ring[(i + 1) % n]);
                if (best === -1 || d < best) best = d;
            }
        }
        return best === -1 ? 999999 : best;
    }

    function distToSegment(x, y, a, b) {
        var dx = b[0] - a[0], dy = b[1] - a[1];
        var l2 = dx * dx + dy * dy;
        if (l2 < 0.000001) return dist2d(x, y, a[0], a[1]);
        var t = ((x - a[0]) * dx + (y - a[1]) * dy) / l2;
        if (t < 0) t = 0;
        if (t > 1) t = 1;
        return dist2d(x, y, a[0] + t * dx, a[1] + t * dy);
    }

    function dist2d(x1, y1, x2, y2) {
        var dx = x2 - x1, dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // ---------- Grille spatiale de segments (perf) ----------
    function buildSegmentGrid(rings, cellMm) {
        var grid = { cell: cellMm, map: {}, segs: [] };
        for (var r = 0; r < rings.length; r++) {
            var ring = rings[r];
            var n = ring.length;
            for (var i = 0; i < n; i++) {
                var a = ring[i], b = ring[(i + 1) % n];
                var idx = grid.segs.length;
                grid.segs.push([a, b]);
                var minX = Math.min(a[0], b[0]), maxX = Math.max(a[0], b[0]);
                var minY = Math.min(a[1], b[1]), maxY = Math.max(a[1], b[1]);
                var cx0 = Math.floor(minX / cellMm), cx1 = Math.floor(maxX / cellMm);
                var cy0 = Math.floor(minY / cellMm), cy1 = Math.floor(maxY / cellMm);
                for (var cx = cx0; cx <= cx1; cx++) {
                    for (var cy = cy0; cy <= cy1; cy++) {
                        var key = cx + "_" + cy;
                        if (!grid.map[key]) grid.map[key] = [];
                        grid.map[key].push(idx);
                    }
                }
            }
        }
        return grid;
    }

    // Distance min point → segments via la grille (recherche par couronnes)
    function distToSegmentsGrid(x, y, grid) {
        var cell = grid.cell;
        var cx = Math.floor(x / cell), cy = Math.floor(y / cell);
        var best = -1;
        var maxRing = 12; // 12 couronnes = 240mm de portée, largement assez
        for (var ringR = 0; ringR <= maxRing; ringR++) {
            // early exit : si on a un best et que la couronne suivante est plus loin
            if (best >= 0 && best < (ringR - 1) * cell) break;
            for (var gx = cx - ringR; gx <= cx + ringR; gx++) {
                for (var gy = cy - ringR; gy <= cy + ringR; gy++) {
                    // ne parcourir que le bord de la couronne
                    if (ringR > 0 && gx > cx - ringR && gx < cx + ringR && gy > cy - ringR && gy < cy + ringR) continue;
                    var bucket = grid.map[gx + "_" + gy];
                    if (!bucket) continue;
                    for (var k = 0; k < bucket.length; k++) {
                        var seg = grid.segs[bucket[k]];
                        var d = distToSegment(x, y, seg[0], seg[1]);
                        if (best === -1 || d < best) best = d;
                    }
                }
            }
        }
        return best === -1 ? 999999 : best;
    }

    // ---------- Regroupement en sous-formes ----------
    function groupIntoPieces(pinkRings, greenRings) {
        // profondeur de chaque anneau rose (nb d'autres anneaux roses le contenant)
        var outers = []; // indices des anneaux "extérieurs" (profondeur paire)
        for (var i = 0; i < pinkRings.length; i++) {
            var depth = 0;
            var pt = pinkRings[i][0];
            for (var j = 0; j < pinkRings.length; j++) {
                if (i === j) continue;
                if (pointInRings(pt[0], pt[1], [pinkRings[j]])) depth++;
            }
            if (depth % 2 === 0) outers.push(i);
        }

        var pieces = [];
        var pieceByOuter = {};
        for (var o = 0; o < outers.length; o++) {
            var piece = { outerIdx: outers[o], greenRings: [] };
            pieceByOuter[outers[o]] = piece;
            pieces.push(piece);
        }

        // assigner chaque anneau vert à la plus petite forme extérieure qui le contient
        for (var g = 0; g < greenRings.length; g++) {
            var gpt = greenRings[g][0];
            var best = -1, bestArea = -1;
            for (var o2 = 0; o2 < outers.length; o2++) {
                var ringIdx = outers[o2];
                if (pointInRings(gpt[0], gpt[1], [pinkRings[ringIdx]])) {
                    var area = ringAreaAbs(pinkRings[ringIdx]);
                    if (best === -1 || area < bestArea) { best = ringIdx; bestArea = area; }
                }
            }
            if (best >= 0) {
                pieceByOuter[best].greenRings.push(greenRings[g]);
            }
        }

        // ne garder que les pièces avec du vert
        var out = [];
        for (var p = 0; p < pieces.length; p++) {
            if (pieces[p].greenRings.length > 0) out.push(pieces[p]);
        }
        return out;
    }

    function ringAreaAbs(ring) {
        var area = 0;
        var n = ring.length;
        for (var i = 0; i < n; i++) {
            var a = ring[i], b = ring[(i + 1) % n];
            area += a[0] * b[1] - b[0] * a[1];
        }
        return Math.abs(area / 2);
    }

    // ---------- Aides placement ----------
    function minDistToPlaced(cand, placed) {
        var best = 999999;
        for (var i = 0; i < placed.length; i++) {
            var d = dist2d(cand.x, cand.y, placed[i].x, placed[i].y);
            if (d < best) best = d;
        }
        return best;
    }

    function worstCoveredPoint(coverPts, placed) {
        var worst = { x: 0, y: 0, dist: 0 };
        for (var i = 0; i < coverPts.length; i++) {
            var pt = coverPts[i];
            var best = 999999;
            for (var j = 0; j < placed.length; j++) {
                var d = dist2d(pt[0], pt[1], placed[j].x, placed[j].y);
                if (d < best) best = d;
            }
            if (placed.length === 0) best = 999999;
            if (best > worst.dist) { worst = { x: pt[0], y: pt[1], dist: best }; }
        }
        return worst;
    }

    // ============================================================
    // ILLUSTRATOR — utilitaires
    // ============================================================
    function findLayer(doc, name) {
        for (var i = 0; i < doc.layers.length; i++) {
            if (doc.layers[i].name === name) return doc.layers[i];
        }
        return null;
    }

    function ensureLayer(doc, name) {
        var l = findLayer(doc, name);
        if (l) { l.locked = false; l.visible = true; return l; }
        l = doc.layers.add();
        l.name = name;
        return l;
    }

    // Récupère tous les items hors calques gérés (à déplacer vers DECOUPE)
    function collectSourcePaths(doc) {
        var out = [];
        for (var i = 0; i < doc.layers.length; i++) {
            var layer = doc.layers[i];
            if (layer.name === LAYER_DECOUPE || layer.name === LAYER_OFFSET || layer.name === LAYER_PREVIEW) continue;
            if (layer.locked || !layer.visible) continue;
            for (var j = 0; j < layer.pageItems.length; j++) {
                out.push(layer.pageItems[j]);
            }
        }
        return out;
    }

    // Applique fn à tous les PathItem feuilles d'un calque (traverse groupes/compound)
    function forEachLeafPath(container, fn) {
        var items = container.pageItems;
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            try {
                if (it.typename === "GroupItem") {
                    forEachLeafPath(it, fn);
                } else if (it.typename === "CompoundPathItem") {
                    for (var p = 0; p < it.pathItems.length; p++) fn(it.pathItems[p]);
                } else if (it.typename === "PathItem") {
                    fn(it);
                }
            } catch (e) {}
        }
    }

    function removeAllItems(layer) {
        for (var i = layer.pageItems.length - 1; i >= 0; i--) {
            try { layer.pageItems[i].remove(); } catch (e) {}
        }
    }

    function selectAllOn(layer) {
        for (var i = 0; i < layer.pageItems.length; i++) {
            try { layer.pageItems[i].selected = true; } catch (e) {}
        }
    }

    // Remplit un item (et tous ses sous-tracés) avec une couleur
    function setFillDeep(item, col) {
        function apply(p) {
            try { p.filled = true; p.fillColor = col; } catch (e) {}
        }
        try {
            if (item.typename === "PathItem") {
                apply(item);
            } else if (item.typename === "CompoundPathItem") {
                for (var p = 0; p < item.pathItems.length; p++) apply(item.pathItems[p]);
            } else if (item.typename === "GroupItem") {
                forEachLeafPath(item, apply);
            }
        } catch (e) {}
    }

    function makeCMYK(c, m, y, k) {
        var col = new CMYKColor();
        col.cyan = c; col.magenta = m; col.yellow = y; col.black = k;
        return col;
    }

    function drawCircle(layer, cxMm, cyMm, rMm, strokeCol) {
        var rPt = mmToPt(rMm);
        var cxPt = mmToPt(cxMm), cyPt = mmToPt(cyMm);
        // ellipse(top, left, width, height)
        var circle = layer.pathItems.ellipse(cyPt + rPt, cxPt - rPt, rPt * 2, rPt * 2);
        circle.filled = false;
        circle.stroked = true;
        circle.strokeColor = strokeCol;
        circle.strokeWidth = 1;
        return circle;
    }

})(params);
