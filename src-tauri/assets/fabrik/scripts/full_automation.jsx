(function (params) {
    try {
        if (!app || app.documents.length === 0) {
            throw new Error("Aucun document Illustrator n'est ouvert.");
        }

        var doc = app.activeDocument;

        // ===== ÉTAPE 1: VECTORISATION CONDITIONNELLE =====
        try {
            var textItems = [];
            var contourItems = [];
            
            for (var i = 0; i < doc.textFrames.length; i++) {
                if (!doc.textFrames[i].locked && !doc.textFrames[i].hidden) {
                    textItems.push(doc.textFrames[i]);
                }
            }
            
            for (var j = 0; j < doc.pathItems.length; j++) {
                var pathItem = doc.pathItems[j];
                if (!pathItem.locked && !pathItem.hidden && pathItem.stroked) {
                    contourItems.push(pathItem);
                }
            }
            
            if (textItems.length > 0) {
                doc.selection = null;
                for (var t = 0; t < textItems.length; t++) {
                    textItems[t].selected = true;
                }
                
                var vectoTexteFile = new File(params.vectoTexteActionPath);
                if (vectoTexteFile.exists) {
                    app.loadAction(vectoTexteFile);
                    app.doScript("vecto_texte", "Ensemble 4");
                    app.unloadAction("Ensemble 4", "");
                }
            }
            
            if (contourItems.length > 0) {
                doc.selection = null;
                for (var c = 0; c < contourItems.length; c++) {
                    contourItems[c].selected = true;
                }
                
                var vectoContourFile = new File(params.vectoContourActionPath);
                if (vectoContourFile.exists) {
                    app.loadAction(vectoContourFile);
                    app.doScript("vecto_contour", "Ensemble 5");
                    app.unloadAction("Ensemble 5", "");
                }
            }
            
        } catch (vectoError) {
            // Continue en cas d'erreur
        }

        doc.selection = null;

        // ===== ÉTAPE 2: PHASE 1 =====
        prepareLayersStructure(doc);
        processArtworkLayer(doc);
        duplicateToCutContour(doc);

        // ===== ÉTAPE 3: PHASE 2 =====
        executePhase2Logic(doc, params);

        // ===== ÉTAPE 4: FINALISATION CUTCONTOUR =====
        finalizeCutContour(doc, params);

        app.redraw();

        alert("🎉 AUTOMATISATION TERMINÉE ! 🎉\n\n" +
              "═══════════════════════════════════\n" +
              "📋 ACTION MANUELLE REQUISE :\n" +
              "• Appliquer la nuance \"CutContour\"\n" +
              "  du nuancier \"Colorado\"\n\n" +
              "⚠️  VÉRIFICATIONS IMPORTANTES :\n" +
              "• Contrôler les fonds perdus\n" +
              "• Vérifier les tracés\n" +
              "• Valider la laize de votre adhésif\n\n" +
              "✅ Votre fichier de fabrication est prêt !");

        return { success: true, message: "Automatisation terminée" };

    } catch (error) {
        alert("❌ Erreur : " + error.message);
        return { success: false, error: error.message };
    }

    // ===== FONCTIONS =====
    function prepareLayersStructure(doc) {
        function findLayer(name) {
            for (var i = 0; i < doc.layers.length; i++) {
                if (doc.layers[i].name === name) return doc.layers[i];
            }
            return null;
        }

        function ensureLayer(name) {
            var existing = findLayer(name);
            if (existing) return existing;
            var newLayer = doc.layers.add();
            newLayer.name = name;
            return newLayer;
        }

        var fondPerduLayer = ensureLayer("FondPerdu");
        var artworkLayer = ensureLayer("Artwork");
        var cutContourLayer = ensureLayer("CutContour");

        var originalLayer = findLayer("Calque 1");
        if (originalLayer) {
            for (var i = originalLayer.pageItems.length - 1; i >= 0; i--) {
                var item = originalLayer.pageItems[i];
                try {
                    item.move(artworkLayer, ElementPlacement.PLACEATBEGINNING);
                } catch (e) {}
            }
            try {
                originalLayer.remove();
            } catch (e) {}
        }

        try {
            cutContourLayer.zOrder(ZOrderMethod.SENDTOFRONT);
            artworkLayer.zOrder(ZOrderMethod.BRINGFORWARD);
            fondPerduLayer.zOrder(ZOrderMethod.SENDTOBACK);
        } catch (e) {}
    }

    function mmToPoints(mm) {
        return mm * 2.83465;
    }

    function processArtworkLayer(doc) {
        try {
            var artworkLayer = doc.layers.getByName("Artwork");

            var items = [];
            for (var i = 0; i < artworkLayer.pageItems.length; i++) {
                items.push(artworkLayer.pageItems[i]);
            }

            if (items.length === 0) return;

            var group = artworkLayer.groupItems.add();
            for (var i = items.length - 1; i >= 0; i--) {
                try {
                    items[i].moveToBeginning(group);
                } catch (e) {}
            }

            try {
                group.resize(1000, 1000);
            } catch (e) {}

            var margin = mmToPoints(20);
            var ab = doc.artboards[0];
            var bounds = group.visibleBounds;
            var left = bounds[0] - margin;
            var top = bounds[1] + margin;
            var right = bounds[2] + margin;
            var bottom = bounds[3] - margin;
            ab.artboardRect = [left, top, right, bottom];

        } catch (err) {
            throw new Error("Erreur regroupement/mise à l'échelle : " + err.message);
        }
    }

    function duplicateToCutContour(doc) {
        var artworkLayer = doc.layers.getByName("Artwork");
        var cutContourLayer = doc.layers.getByName("CutContour");

        for (var i = 0; i < artworkLayer.pageItems.length; i++) {
            try {
                var item = artworkLayer.pageItems[i];
                item.duplicate(cutContourLayer, ElementPlacement.PLACEATBEGINNING);
            } catch (e) {}
        }
    }

    function executePhase2Logic(doc, params) {
        var cutContourLayer = doc.layers.getByName("CutContour");
        var artworkLayer = doc.layers.getByName("Artwork");
        var fondPerduLayer = doc.layers.getByName("FondPerdu");

        if (!cutContourLayer || !artworkLayer || !fondPerduLayer)
            throw new Error("Un ou plusieurs calques sont manquants.");

        cutContourLayer.locked = true;

        for (var i = 0; i < artworkLayer.pageItems.length; i++) {
            try {
                artworkLayer.pageItems[i].duplicate(fondPerduLayer, ElementPlacement.PLACEATBEGINNING);
            } catch (e) {}
        }

        artworkLayer.locked = true;

        var toDelete = [];
        
        function collectWhiteItems(item) {
            if (item.typename === "GroupItem") {
                for (var g = 0; g < item.pageItems.length; g++) {
                    collectWhiteItems(item.pageItems[g]);
                }
            } else if (item.typename === "CompoundPathItem") {
                for (var p = 0; p < item.pathItems.length; p++) {
                    collectWhiteItems(item.pathItems[p]);
                }
            } else {
                try {
                    var shouldDelete = false;
                    
                    if (item.filled && item.fillColor) {
                        if (item.fillColor.typename === "CMYKColor") {
                            var c = item.fillColor.cyan;
                            var m = item.fillColor.magenta;
                            var y = item.fillColor.yellow;
                            var k = item.fillColor.black;
                            
                            if (c === 0 && m === 0 && y === 0 && k === 0) {
                                shouldDelete = true;
                            }
                        }
                        
                        try {
                            if (item.fillColor.typename === "SpotColor" && 
                                item.fillColor.spot && 
                                item.fillColor.spot.name === "Blanc") {
                                shouldDelete = true;
                            }
                        } catch (e) {}
                    }
                    
                    if (item.stroked && item.strokeColor) {
                        if (item.strokeColor.typename === "CMYKColor") {
                            var sc = item.strokeColor.cyan;
                            var sm = item.strokeColor.magenta;
                            var sy = item.strokeColor.yellow;
                            var sk = item.strokeColor.black;
                            
                            if (sc === 0 && sm === 0 && sy === 0 && sk === 0) {
                                shouldDelete = true;
                            }
                        }
                        
                        try {
                            if (item.strokeColor.typename === "SpotColor" && 
                                item.strokeColor.spot && 
                                item.strokeColor.spot.name === "Blanc") {
                                shouldDelete = true;
                            }
                        } catch (e) {}
                    }
                    
                    if (shouldDelete) {
                        toDelete.push(item);
                    }
                } catch (e) {}
            }
        }
        
        for (var j = 0; j < fondPerduLayer.pageItems.length; j++) {
            collectWhiteItems(fondPerduLayer.pageItems[j]);
        }
        
        for (var k = 0; k < toDelete.length; k++) {
            try {
                toDelete[k].remove();
            } catch (e) {}
        }

        doc.selection = null;
        for (var m = 0; m < fondPerduLayer.pageItems.length; m++) {
            var item = fondPerduLayer.pageItems[m];
            if (!item.locked && !item.hidden) {
                item.selected = true;
            }
        }

        if (params.offsetActionPath && doc.selection.length > 0) {
            var offsetActionFile = new File(params.offsetActionPath);
            if (offsetActionFile.exists) {
                app.loadAction(offsetActionFile);
                app.doScript("Offset5mm", "OffsetSet");
                app.unloadAction("OffsetSet", "");
            }
        }

        fondPerduLayer.locked = true;
        cutContourLayer.locked = false;
    }

    function finalizeCutContour(doc, params) {
        try {
            var cutContourLayer = doc.layers.getByName("CutContour");
            
            cutContourLayer.locked = false;
            app.redraw();
            
            doc.selection = null;
            for (var i = 0; i < cutContourLayer.pageItems.length; i++) {
                cutContourLayer.pageItems[i].selected = true;
            }
            
            if (params.pathfinderUnionActionPath) {
                var unionFile = new File(params.pathfinderUnionActionPath);
                if (unionFile.exists) {
                    app.loadAction(unionFile);
                    app.doScript("PathfinderUnion", "Ensemble 6");
                    app.unloadAction("Ensemble 6", "");
                }
            }
            
            app.redraw();
            
            doc.selection = null;
            if (cutContourLayer.pageItems.length > 0) {
                cutContourLayer.pageItems[0].selected = true;
            }
            
            if (doc.selection.length > 0) {
                var obj = doc.selection[0];
                
                var cutColor = new CMYKColor();
                cutColor.cyan = 0;
                cutColor.magenta = 100;
                cutColor.yellow = 100;
                cutColor.black = 0;
                
                function applyColorToItem(item) {
                    if (item.typename === "GroupItem") {
                        for (var g = 0; g < item.pageItems.length; g++) {
                            applyColorToItem(item.pageItems[g]);
                        }
                    } else if (item.typename === "CompoundPathItem") {
                        for (var p = 0; p < item.pathItems.length; p++) {
                            applyColorToItem(item.pathItems[p]);
                        }
                    } else {
                        try {
                            item.filled = false;
                            item.stroked = true;
                            item.strokeColor = cutColor;
                        } catch (e) {}
                    }
                }
                
                applyColorToItem(obj);
            }
            
            doc.selection = null;
            cutContourLayer.locked = false;
            
        } catch (e) {}
    }

})(params);