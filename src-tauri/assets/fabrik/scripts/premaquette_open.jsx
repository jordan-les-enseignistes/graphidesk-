// ============================================================
// GraphiDesk — Ouverture de la prémaquette provisoire (Mesure photo)
// ============================================================
// params injectés :
//   svgPath : chemin du SVG généré par le module Mesure
//
// Ouvre le SVG dans Illustrator puis répartit le contenu sur de
// VRAIS calques :
//   - "Artwork"  : les cadres (groupe SVG CADRES)
//   - "Mesures"  : le titre + les cotes (groupe SVG TEXTES)
// L'utilisateur peut ainsi masquer/supprimer le calque Mesures en un clic.

(function (params) {
    try {
        if (!params || !params.svgPath) {
            throw new Error("Chemin du SVG manquant.");
        }
        var f = new File(params.svgPath);
        if (!f.exists) {
            throw new Error("Fichier SVG introuvable : " + params.svgPath);
        }

        var doc = app.open(f);

        // ⚠️ L'ouverture d'un SVG crée TOUJOURS un document RVB — l'atelier
        // travaille pour l'impression : conversion CMJN immédiate et
        // systématique (règle absolue : jamais de RVB).
        try { app.executeMenuCommand("doc-color-cmyk"); } catch (eC) {}

        // Calque d'origine (import SVG) → "Artwork"
        var artLayer = doc.layers[0];
        artLayer.name = "Artwork";
        artLayer.locked = false;

        // Nouveau calque "Mesures" au-dessus
        var mesLayer = doc.layers.add();
        mesLayer.name = "Mesures";

        // Déplacer le groupe TEXTES (nom hérité de l'id SVG) vers Mesures
        var moved = 0;
        for (var i = doc.groupItems.length - 1; i >= 0; i--) {
            var g = doc.groupItems[i];
            try {
                if (g.name === "TEXTES") {
                    g.move(mesLayer, ElementPlacement.PLACEATBEGINNING);
                    moved++;
                }
            } catch (e) {}
        }

        try { mesLayer.zOrder(ZOrderMethod.BRINGTOFRONT); } catch (e) {}

        app.redraw();

        if (moved === 0) {
            alert("Prémaquette ouverte.\n\n⚠️ Groupe TEXTES non trouvé : les cotes n'ont pas pu être déplacées sur leur calque (elles restent dans Artwork).");
        }

        return { success: true };
    } catch (error) {
        alert("❌ Erreur ouverture prémaquette : " + error.message);
        return { success: false, error: error.message };
    }
})(params);
