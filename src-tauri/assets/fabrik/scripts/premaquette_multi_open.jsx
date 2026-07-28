// ============================================================
// GraphiDesk — Prémaquette MULTI-FACES (Mesure photo v1.5)
// ============================================================
// params : { faces: [ { svgPath, nom }, ... ] }  (1..N faces)
//
// UN SEUL document Illustrator, UN PLAN DE TRAVAIL PAR FACE (nommé) :
//   - la face 1 est ouverte normalement (SVG → doc), convertie CMJN ;
//   - chaque face suivante est ouverte à part, son contenu copié au
//     presse-papiers (seule méthode 100 % fidèle) puis collé sur un
//     nouveau plan de travail créé à droite (repositionnement ABSOLU
//     par bounds mesurés — « coller sur place » est relatif au plan actif) ;
//   - calques Artwork / Mesures partagés : les groupes TEXTES de chaque
//     face partent sur "Mesures" (masquables en un clic).
// Les lettres GD_ZONE_* étant CONTINUES sur le projet, le recalage VT
// fonctionne sur ce fichier unique sans modification.

(function (params) {
    var GAP_MM = 30;
    var MM = 2.834645669;

    try {
        if (!params || !params.faces || !params.faces.length) {
            throw new Error("Aucune face à ouvrir.");
        }

        // ---------- FACE 1 : ouverture classique ----------
        var f0 = new File(params.faces[0].svgPath);
        if (!f0.exists) throw new Error("SVG introuvable : " + params.faces[0].svgPath);
        var doc = app.open(f0);

        // conversion CMJN (jamais de RVB) — la commande peut invalider la
        // référence document : resynchroniser (leçon v1.4.17)
        try { app.executeMenuCommand("doc-color-cmyk"); } catch (eC) {}
        try { doc = app.activeDocument; } catch (eD) {}
        if (!doc) throw new Error("Document introuvable après conversion CMJN");

        // calques Artwork / Mesures
        var artLayer = doc.layers[0];
        artLayer.name = "Artwork";
        artLayer.locked = false;
        var mesLayer = doc.layers.add();
        mesLayer.name = "Mesures";

        function deplacerTextes(scope) {
            var moved = 0;
            for (var i = doc.groupItems.length - 1; i >= 0; i--) {
                var g = doc.groupItems[i];
                try {
                    if (g.name === "TEXTES" && g.layer === artLayer) {
                        g.move(mesLayer, ElementPlacement.PLACEATBEGINNING);
                        moved++;
                        if (scope === "premier") break;
                    }
                } catch (e) {}
            }
            return moved;
        }
        var textesOk = deplacerTextes("tous");

        try { doc.artboards[0].name = params.faces[0].nom || "Face 1"; } catch (eN) {}

        // ---------- FACES SUIVANTES : copie → nouveau plan de travail ----------
        var facesOk = 1;
        var erreurs = "";
        for (var fi = 1; fi < params.faces.length; fi++) {
            var face = params.faces[fi];
            try {
                var fsvg = new File(face.svgPath);
                if (!fsvg.exists) throw new Error("SVG introuvable");
                var src = app.open(fsvg);

                // dimensions du plan source + position du contenu PAR RAPPORT au plan
                var abS = src.artboards[0].artboardRect; // [g, h, d, b]
                var wS = abS[2] - abS[0];
                var hS = abS[1] - abS[3];
                src.artboards.setActiveArtboardIndex(0);
                app.executeMenuCommand("selectallinartboard");
                var selS = src.selection;
                var bS = null;
                for (var s1 = 0; s1 < selS.length; s1++) {
                    var vb = selS[s1].visibleBounds;
                    if (!bS) bS = [vb[0], vb[1], vb[2], vb[3]];
                    else {
                        if (vb[0] < bS[0]) bS[0] = vb[0];
                        if (vb[1] > bS[1]) bS[1] = vb[1];
                        if (vb[2] > bS[2]) bS[2] = vb[2];
                        if (vb[3] < bS[3]) bS[3] = vb[3];
                    }
                }
                if (!bS) throw new Error("face vide");
                var offX = bS[0] - abS[0]; // contenu → bord gauche du plan source
                var offY = abS[1] - bS[1]; // bord haut du plan source → contenu
                app.executeMenuCommand("copy");
                src.close(SaveOptions.DONOTSAVECHANGES);

                // nouveau plan de travail à droite du plus à droite
                app.activeDocument = doc;
                var maxRight = -1e9, topRef = 0;
                for (var a = 0; a < doc.artboards.length; a++) {
                    var r = doc.artboards[a].artboardRect;
                    if (r[2] > maxRight) { maxRight = r[2]; topRef = r[1]; }
                }
                var nx = maxRight + GAP_MM * MM;
                var rNew = [nx, topRef, nx + wS, topRef - hS];
                var abNew = doc.artboards.add(rNew);
                try { abNew.name = face.nom || ("Face " + (fi + 1)); } catch (eN2) {}
                doc.artboards.setActiveArtboardIndex(doc.artboards.length - 1);

                // coller sur le calque Artwork puis REPOSITIONNER EN ABSOLU
                doc.activeLayer = artLayer;
                app.executeMenuCommand("pasteInPlace");
                var colles = [];
                for (var c = 0; c < doc.selection.length; c++) colles.push(doc.selection[c]);
                var bP = null;
                for (var c2 = 0; c2 < colles.length; c2++) {
                    var vb2 = colles[c2].visibleBounds;
                    if (!bP) bP = [vb2[0], vb2[1], vb2[2], vb2[3]];
                    else {
                        if (vb2[0] < bP[0]) bP[0] = vb2[0];
                        if (vb2[1] > bP[1]) bP[1] = vb2[1];
                        if (vb2[2] > bP[2]) bP[2] = vb2[2];
                        if (vb2[3] < bP[3]) bP[3] = vb2[3];
                    }
                }
                var dx = (rNew[0] + offX) - bP[0];
                var dy = (rNew[1] - offY) - bP[1];
                for (var c3 = 0; c3 < colles.length; c3++) {
                    try { colles[c3].translate(dx, dy); } catch (eT) {}
                }

                // groupes TEXTES de cette face → calque Mesures
                for (var c4 = 0; c4 < colles.length; c4++) {
                    try {
                        if (colles[c4].typename === "GroupItem" && colles[c4].name === "TEXTES") {
                            colles[c4].move(mesLayer, ElementPlacement.PLACEATBEGINNING);
                            textesOk++;
                        }
                    } catch (eM) {}
                }
                doc.selection = null;
                facesOk++;
            } catch (eF) {
                erreurs += "\n• " + (face.nom || "Face " + (fi + 1)) + " : " + (eF && eF.message ? eF.message : eF);
            }
        }

        try { mesLayer.zOrder(ZOrderMethod.BRINGTOFRONT); } catch (eZ) {}
        try { doc.artboards.setActiveArtboardIndex(0); } catch (eA) {}
        try { app.executeMenuCommand("fitall"); } catch (eFit) {}
        app.redraw();

        var msg = "Prémaquette ouverte : " + facesOk + "/" + params.faces.length +
            " face(s), un plan de travail par face.\n" +
            "Calques : Artwork / Mesures (cotes masquables en un clic).";
        if (erreurs) msg += "\n\n⚠ Problèmes :" + erreurs;
        if (facesOk === params.faces.length && !erreurs && textesOk < params.faces.length) {
            msg += "\n\n⚠ Certaines cotes n'ont pas rejoint le calque Mesures.";
        }
        alert(msg);

        return { success: true };
    } catch (error) {
        alert("❌ Erreur ouverture prémaquette : " + error.message);
        return { success: false, error: error.message };
    }
})(params);
