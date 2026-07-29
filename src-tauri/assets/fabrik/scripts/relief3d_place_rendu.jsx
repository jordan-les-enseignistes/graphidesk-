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

        if (app.documents.length === 0) {
            // pas de document ouvert : on en crée un en MILLIMÈTRES et en CMJN
            // (sans preset, documents.add crée un document en POINTS)
            var preset = new DocumentPreset();
            preset.units = RulerUnits.Millimeters;
            preset.colorMode = DocumentColorSpace.CMYK;
            preset.width = 420 * MM;
            preset.height = 297 * MM;
            app.documents.addDocument(DocumentColorSpace.CMYK, preset);
        }
        var doc = app.activeDocument;

        // image importée (liée puis incorporée : le PNG est temporaire)
        var place = doc.placedItems.add();
        place.file = f;
        try { place.embed(); } catch (eE) {}
        // embed() remplace l'objet : on reprend l'élément réellement présent
        var item = doc.selection && doc.selection.length ? doc.selection[0] : place;
        try { if (!item || !item.width) item = doc.pageItems[0]; } catch (eI) {}

        // mise à l'échelle sur la largeur réelle de l'enseigne
        var largeurPt = (params.largeurMm > 0 ? params.largeurMm : 1000) * MM;
        var ratio = (largeurPt / item.width) * 100;
        item.resize(ratio, ratio);

        // nouveau plan de travail à droite du plus à droite
        var maxRight = -1e9, top = 0;
        for (var a = 0; a < doc.artboards.length; a++) {
            var r = doc.artboards[a].artboardRect; // [g, h, d, b]
            if (r[2] > maxRight) { maxRight = r[2]; top = r[1]; }
        }
        var marge = 20 * MM;
        var nx = maxRight + GAP_MM * MM;
        var rNew = [
            nx,
            top,
            nx + item.width + 2 * marge,
            top - item.height - 2 * marge
        ];
        var ab = doc.artboards.add(rNew);
        try { ab.name = params.nom || "Simulation 3D"; } catch (eN) {}
        doc.artboards.setActiveArtboardIndex(doc.artboards.length - 1);

        // positionnement ABSOLU dans ce plan (position = [gauche, haut])
        item.position = [nx + marge, top - marge];

        try { app.executeMenuCommand("fitall"); } catch (eF) {}
        app.redraw();

        return { success: true };
    } catch (error) {
        alert("❌ Placement du rendu 3D : " + error.message);
        return { success: false, error: error.message };
    }
})(params);
