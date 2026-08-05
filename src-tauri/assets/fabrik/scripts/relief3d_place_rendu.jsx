// ============================================================
// relief3d_place_rendu.jsx — pose le rendu 3D dans Illustrator
// ============================================================
// params : { pngPath, largeurMm, nom }
//
// Crée un NOUVEAU PLAN DE TRAVAIL à droite du plus à droite dans le
// document actif, y importe l'image du rendu à la largeur demandée et
// le nomme. Rien d'autre n'est touché : le travail du graphiste reste
// intact, il récupère simplement sa simulation à côté de sa maquette.

(function (params) {
    var GAP_MM = 30;
    var MM = 2.834645669;

    try {
        if (!params || !params.pngPath) throw new Error("Aucun rendu à placer.");
        var f = new File(params.pngPath);
        if (!f.exists) throw new Error("Image introuvable : " + params.pngPath);

        var largeurPt = (params.largeurMm > 0 ? params.largeurMm : 1000) * MM;
        var marge = 20 * MM;

        // Le canevas d'Illustrator est limité à 227 pouces. Une enseigne de
        // 3 m posée à l'échelle 1:1 en fait déjà 128 : ajouter un plan de
        // travail de cette taille à côté des existants sort du canevas et
        // Illustrator refuse avec l'erreur 'AOoC'. On garde donc une marge
        // de sécurité et on bascule sur un document neuf si ça ne rentre pas.
        var LIMITE_PT = 7900; // ~110 pouces de part et d'autre de l'origine

        function importer(cible) {
            var place = cible.placedItems.add();
            place.file = f;
            try { place.embed(); } catch (eE) {}
            // embed() remplace l'objet : on reprend l'élément réellement présent
            var it = cible.selection && cible.selection.length ? cible.selection[0] : place;
            try { if (!it || !it.width) it = cible.pageItems[0]; } catch (eI) {}
            var ratio = (largeurPt / it.width) * 100;
            it.resize(ratio, ratio);
            return it;
        }

        function documentNeuf() {
            var p = new DocumentPreset();
            p.units = RulerUnits.Millimeters;
            p.colorMode = DocumentColorSpace.CMYK;
            // on dimensionne le document sur le rendu lui-même
            p.width = largeurPt + 2 * marge;
            p.height = largeurPt + 2 * marge; // ajusté juste après
            var d = app.documents.addDocument(DocumentColorSpace.CMYK, p);
            var it = importer(d);
            try {
                d.artboards[0].artboardRect = [
                    0, 0, it.width + 2 * marge, -(it.height + 2 * marge)
                ];
                d.artboards[0].name = params.nom || "Simulation 3D";
            } catch (eA) {}
            it.position = [marge, -marge];
            return d;
        }

        if (app.documents.length === 0) {
            documentNeuf();
        } else {
            var doc = app.activeDocument;
            var maxRight = -1e9, top = 0;
            for (var a = 0; a < doc.artboards.length; a++) {
                var r = doc.artboards[a].artboardRect; // [g, h, d, b]
                if (r[2] > maxRight) { maxRight = r[2]; top = r[1]; }
            }
            var item = importer(doc);
            var nx = maxRight + GAP_MM * MM;
            var rNew = [
                nx,
                top,
                nx + item.width + 2 * marge,
                top - item.height - 2 * marge
            ];
            // tient-on dans le canevas ?
            var deborde = Math.abs(rNew[0]) > LIMITE_PT || Math.abs(rNew[2]) > LIMITE_PT ||
                          Math.abs(rNew[1]) > LIMITE_PT || Math.abs(rNew[3]) > LIMITE_PT;
            var pose = false;
            if (!deborde) {
                try {
                    var ab = doc.artboards.add(rNew);
                    try { ab.name = params.nom || "Simulation 3D"; } catch (eN) {}
                    doc.artboards.setActiveArtboardIndex(doc.artboards.length - 1);
                    // positionnement ABSOLU dans ce plan (position = [gauche, haut])
                    item.position = [nx + marge, top - marge];
                    pose = true;
                } catch (eAb) { pose = false; }
            }
            if (!pose) {
                // pas la place ici : on retire l'import et on ouvre un document
                try { item.remove(); } catch (eR) {}
                documentNeuf();
                var enM = Math.round(largeurPt / MM / 100) / 10;
                alert(
                    "Le rendu a été placé dans un NOUVEAU document.\n\n" +
                    "Pourquoi : ton enseigne fait " + enM + " m de large. À l'échelle 1:1,\n" +
                    "un plan de travail de cette taille ne tient plus à côté de ta\n" +
                    "maquette — Illustrator limite l'espace de travail à 227 pouces\n" +
                    "(environ 5,80 m) toutes planches confondues.\n\n" +
                    "Rien n'est perdu : le rendu est complet et à la bonne échelle,\n" +
                    "il est simplement dans son propre document.\n\n" +
                    "Pour l'avoir à côté de ta maquette : relance l'envoi en\n" +
                    "choisissant « Échelle 1:10 » dans GraphiDesk."
                );
            }
        }

        try { app.executeMenuCommand("fitall"); } catch (eF) {}
        app.redraw();

        return { success: true };
    } catch (error) {
        alert("❌ Placement du rendu 3D : " + error.message);
        return { success: false, error: error.message };
    }
})(params);
