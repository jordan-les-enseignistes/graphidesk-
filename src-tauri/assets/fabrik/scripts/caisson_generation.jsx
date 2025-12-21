(function (params) {
    try {
        // Vérification de la présence d'Illustrator
        if (!app) {
            throw new Error("Illustrator n'est pas disponible.");
        }

        // Créer un nouveau document avec les bonnes unités
        var docPreset = new DocumentPreset();
        docPreset.units = RulerUnits.Millimeters;
        docPreset.width = 1000; // Taille temporaire en mm
        docPreset.height = 1000; // Taille temporaire en mm
        
        var doc = app.documents.addDocument(DocumentColorSpace.CMYK, docPreset);
        
        // Forcer les unités du document en mm
        doc.rulerUnits = RulerUnits.Millimeters;
        app.preferences.setRealPreference('rulerUnits', 6); // 6 = millimètres
        
        // Récupération des paramètres
        var largeur = parseFloat(params.largeur) || 0;
        var hauteur = parseFloat(params.hauteur) || 0;
        var thickness = params.thickness || {};
        
        // Support de l'ancien format (profondeur unique) ET nouveau format (épaisseurs variables)
        var epaisseurHaut, epaisseurBas, epaisseurGauche, epaisseurDroite;
        
        if (thickness && thickness.isMulti) {
            // Mode multi-épaisseurs : PRIORITÉ aux valeurs individuelles
            epaisseurHaut = parseFloat(thickness.haut) || 0;
            epaisseurBas = parseFloat(thickness.bas) || 0;
            epaisseurGauche = parseFloat(thickness.gauche) || 0;
            epaisseurDroite = parseFloat(thickness.droite) || 0;
        } else {
            // Mode épaisseur unique (rétrocompatibilité)
            var profondeur = parseFloat(params.profondeur) || parseFloat(thickness.haut) || 0;
            epaisseurHaut = profondeur;
            epaisseurBas = profondeur;
            epaisseurGauche = profondeur;
            epaisseurDroite = profondeur;
        }
        
        // Validation des dimensions
        if (largeur <= 0 || hauteur <= 0) {
            throw new Error("Les dimensions largeur et hauteur doivent être supérieures à 0.");
        }
        
        // MODIFICATION : Permettre 0 pour les coffrages
        if (epaisseurHaut < 0 || epaisseurBas < 0 || epaisseurGauche < 0 || epaisseurDroite < 0) {
            throw new Error("Les épaisseurs doivent être supérieures ou égales à 0 (0 = coffrage sans rabat).");
        }
        
        // Vérifier qu'au moins un côté a une épaisseur > 0
        if (epaisseurHaut === 0 && epaisseurBas === 0 && epaisseurGauche === 0 && epaisseurDroite === 0) {
            throw new Error("Au moins un côté doit avoir une épaisseur supérieure à 0.");
        }
        
        // Calcul des dimensions finales
        var largeurFinale = largeur + epaisseurGauche + epaisseurDroite;
        var hauteurFinale = hauteur + epaisseurHaut + epaisseurBas;
        
        // Conversion mm vers points (1mm = 2.83465 points)
        function mmToPoints(mm) {
            return mm * 2.83465;
        }
        
        var largeurPoints = mmToPoints(largeur);
        var hauteurPoints = mmToPoints(hauteur);
        var largeurFinalePoints = mmToPoints(largeurFinale);
        var hauteurFinalePoints = mmToPoints(hauteurFinale);
        var epaisseurHautPoints = mmToPoints(epaisseurHaut);
        var epaisseurBasPoints = mmToPoints(epaisseurBas);
        var epaisseurGauchePoints = mmToPoints(epaisseurGauche);
        var epaisseurDroitePoints = mmToPoints(epaisseurDroite);
        
        // Création de la structure de calques
        prepareLayersStructure(doc);
        
        // Configuration du plan de travail
        setupArtboard(doc, largeurFinale, hauteurFinale);
        
        // Génération du caisson avec épaisseurs variables
        generateCaisson(doc, largeurPoints, hauteurPoints, largeurFinalePoints, hauteurFinalePoints, 
                       epaisseurHautPoints, epaisseurBasPoints, epaisseurGauchePoints, epaisseurDroitePoints);
        
        // ✅ NOUVEAUTÉ V2.1 : Génération des trous de perçage
        var shouldAddDrillingHoles = params.drillingHoles !== false; // Par défaut true
        if (shouldAddDrillingHoles) {
            generateDrillingHoles(doc, largeurFinalePoints, hauteurFinalePoints, 
                                epaisseurHautPoints, epaisseurBasPoints, epaisseurGauchePoints, epaisseurDroitePoints);
        }
        
        app.redraw();
        
        // Message de succès adaptatif
        var epaisseurInfo = "";
        if (thickness.isMulti) {
            epaisseurInfo = "Épaisseurs : Haut:" + epaisseurHaut + "mm, Bas:" + epaisseurBas + "mm, Gauche:" + epaisseurGauche + "mm, Droite:" + epaisseurDroite + "mm";
        } else {
            epaisseurInfo = "Épaisseur : " + epaisseurHaut + "mm";
        }
        
        var drillingInfo = shouldAddDrillingHoles ? "\n• Trous de perçage Ø3mm (verts)" : "";
        
        var message = "✅ CAISSON SIMPLE GÉNÉRÉ AVEC SUCCÈS !\n\n" +
                     "📐 Dimensions :\n" +
                     "• Face visible : " + largeur + " × " + hauteur + " mm\n" +
                     "• " + epaisseurInfo + "\n" +
                     "• Format fini : " + largeurFinale + " × " + hauteurFinale + " mm\n\n" +
                     "🎨 Tracés créés :\n" +
                     "• Contour rose : découpe avec angles défoncés\n" +
                     "• Rainures bleues : délimitation et pliage" + drillingInfo + "\n\n" +
                     "📄 Document créé en mm\n" +
                     "✅ Votre fichier de fabrication est prêt !";
        
        alert(message);
        
        return { success: true, message: "Caisson généré avec succès" };
        
    } catch (error) {
        alert("❌ Erreur lors de la génération du caisson : " + error.message);
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

        var contourLayer = ensureLayer("Contour");
        var rainureLayer = ensureLayer("Rainures");
        var percageLayer = ensureLayer("Perçage");

        var originalLayer = findLayer("Calque 1");
        if (originalLayer) {
            try {
                originalLayer.remove();
            } catch (e) {}
        }

        try {
            contourLayer.zOrder(ZOrderMethod.SENDTOFRONT);
            rainureLayer.zOrder(ZOrderMethod.BRINGFORWARD);
            percageLayer.zOrder(ZOrderMethod.BRINGFORWARD);
        } catch (e) {}
    }

    function setupArtboard(doc, largeurFinale, hauteurFinale) {
        try {
            var artboard = doc.artboards[0];
            
            var margin = mmToPoints(20);
            var planLargeur = mmToPoints(largeurFinale) + (2 * margin);
            var planHauteur = mmToPoints(hauteurFinale) + (2 * margin);
            
            var left = -planLargeur / 2;
            var top = planHauteur / 2;
            var right = planLargeur / 2;
            var bottom = -planHauteur / 2;
            
            artboard.artboardRect = [left, top, right, bottom];
            
        } catch (error) {
            throw new Error("Erreur lors de la configuration du plan de travail : " + error.message);
        }
    }
    
    function generateCaisson(doc, largeurPoints, hauteurPoints, largeurFinalePoints, hauteurFinalePoints, 
                           epaisseurHautPoints, epaisseurBasPoints, epaisseurGauchePoints, epaisseurDroitePoints) {
        try {
            var contourLayer = doc.layers.getByName("Contour");
            var rainureLayer = doc.layers.getByName("Rainures");
            
            // Création des couleurs
            var couleurRose = new CMYKColor();
            couleurRose.cyan = 0;
            couleurRose.magenta = 100;
            couleurRose.yellow = 0;
            couleurRose.black = 0;
            
            var couleurBleu = new CMYKColor();
            couleurBleu.cyan = 100;
            couleurBleu.magenta = 0;
            couleurBleu.yellow = 0;
            couleurBleu.black = 0;
            
            // ===== CONTOUR PRINCIPAL (ROSE) =====
            createMainContour(contourLayer, largeurFinalePoints, hauteurFinalePoints, 
                            epaisseurHautPoints, epaisseurBasPoints, epaisseurGauchePoints, epaisseurDroitePoints, couleurRose);
            
            // ===== RAINURES (BLEU) =====
            createRainures(rainureLayer, largeurPoints, hauteurPoints, largeurFinalePoints, hauteurFinalePoints,
                         epaisseurHautPoints, epaisseurBasPoints, epaisseurGauchePoints, epaisseurDroitePoints, couleurBleu);
            
        } catch (error) {
            throw new Error("Erreur lors de la génération du caisson : " + error.message);
        }
    }
    
    // ✅ FONCTION FINALE : Génération des trous de perçage avec fallback
    function generateDrillingHoles(doc, largeurFinalePoints, hauteurFinalePoints, 
                                 epaisseurHautPoints, epaisseurBasPoints, epaisseurGauchePoints, epaisseurDroitePoints) {
        try {
            // Recherche sécurisée du calque
            var percageLayer = null;
            for (var i = 0; i < doc.layers.length; i++) {
                if (doc.layers[i].name === "Perçage") {
                    percageLayer = doc.layers[i];
                    break;
                }
            }
            
            if (!percageLayer) {
                percageLayer = doc.layers.add();
                percageLayer.name = "Perçage";
            }
            
            // Couleur verte pour les trous de perçage
            var couleurVerte = new CMYKColor();
            couleurVerte.cyan = 50;
            couleurVerte.magenta = 0;
            couleurVerte.yellow = 100;
            couleurVerte.black = 0;
            
            // Paramètres de perçage
            var rayonTrou = mmToPoints(1.5); // Rayon 1.5mm (diamètre 3mm)
            var distanceAngle = mmToPoints(50); // 50mm des angles
            var distanceBord = mmToPoints(25); // 25mm du bord extérieur
            var espacementMax = mmToPoints(750); // Espacement max 750mm
            
            // Calcul des découpes pour les "vrais" angles
            var decoupeHaut = epaisseurHautPoints > 0 ? (epaisseurHautPoints - mmToPoints(1)) : 0;
            var decoupeBas = epaisseurBasPoints > 0 ? (epaisseurBasPoints - mmToPoints(1)) : 0;
            var decoupeGauche = epaisseurGauchePoints > 0 ? (epaisseurGauchePoints - mmToPoints(1)) : 0;
            var decoupeDroite = epaisseurDroitePoints > 0 ? (epaisseurDroitePoints - mmToPoints(1)) : 0;
            
            // ===== RABAT DU HAUT =====
            if (epaisseurHautPoints > 0) {
                var rabatY = hauteurFinalePoints/2 - distanceBord;
                var startX = -largeurFinalePoints/2 + decoupeGauche + distanceAngle;
                var endX = largeurFinalePoints/2 - decoupeDroite - distanceAngle;
                var availableLength = endX - startX;
                
                if (availableLength > 0) {
                    var holePositions = calculateHolePositions(startX, endX, espacementMax);
                    for (var i = 0; i < holePositions.length; i++) {
                        createDrillingHole(percageLayer, holePositions[i], rabatY, rayonTrou, couleurVerte);
                    }
                }
            }
            
            // ===== RABAT DU BAS =====
            if (epaisseurBasPoints > 0) {
                var rabatY = -hauteurFinalePoints/2 + distanceBord;
                var startX = -largeurFinalePoints/2 + decoupeGauche + distanceAngle;
                var endX = largeurFinalePoints/2 - decoupeDroite - distanceAngle;
                var availableLength = endX - startX;
                
                if (availableLength > 0) {
                    var holePositions = calculateHolePositions(startX, endX, espacementMax);
                    for (var i = 0; i < holePositions.length; i++) {
                        createDrillingHole(percageLayer, holePositions[i], rabatY, rayonTrou, couleurVerte);
                    }
                }
            }
            
            // ===== RABAT DE GAUCHE =====
            if (epaisseurGauchePoints > 0) {
                var rabatX = -largeurFinalePoints/2 + distanceBord;
                var startY = hauteurFinalePoints/2 - decoupeHaut - distanceAngle;
                var endY = -hauteurFinalePoints/2 + decoupeBas + distanceAngle;
                var availableLength = startY - endY;
                
                if (availableLength > 0) {
                    var holePositions = calculateHolePositions(endY, startY, espacementMax);
                    for (var i = 0; i < holePositions.length; i++) {
                        createDrillingHole(percageLayer, rabatX, holePositions[i], rayonTrou, couleurVerte);
                    }
                }
            }
            
            // ===== RABAT DE DROITE =====
            if (epaisseurDroitePoints > 0) {
                var rabatX = largeurFinalePoints/2 - distanceBord;
                var startY = hauteurFinalePoints/2 - decoupeHaut - distanceAngle;
                var endY = -hauteurFinalePoints/2 + decoupeBas + distanceAngle;
                var availableLength = startY - endY;
                
                if (availableLength > 0) {
                    var holePositions = calculateHolePositions(endY, startY, espacementMax);
                    for (var i = 0; i < holePositions.length; i++) {
                        createDrillingHole(percageLayer, rabatX, holePositions[i], rayonTrou, couleurVerte);
                    }
                }
            }
            
        } catch (error) {
            throw new Error("Erreur lors de la génération des trous de perçage : " + error.message);
        }
    }
    
    // ✅ Fonction pour calculer les positions des trous avec espacement optimal
    function calculateHolePositions(start, end, maxSpacing) {
        var totalLength = Math.abs(end - start);
        
        if (totalLength <= 0) return [];
        
        // Calculer le nombre de segments nécessaires
        var segments = Math.ceil(totalLength / maxSpacing);
        var actualSpacing = totalLength / segments;
        
        var positions = [];
        var direction = (end > start) ? 1 : -1;
        
        // Placer les trous aux positions calculées
        for (var i = 0; i <= segments; i++) {
            positions.push(start + (i * actualSpacing * direction));
        }
        
        return positions;
    }
    
    // ✅ FONCTION CORRIGÉE : Création d'un trou avec méthode fallback pour Illustrator 2025
    function createDrillingHole(layer, x, y, radius, color) {
        try {
            // MÉTHODE FALLBACK DIRECTE (celle qui fonctionne)
            var hole = layer.pathItems.add();
            var circlePoints = [];
            
            // Créer un cercle parfait avec 12 points pour plus de précision
            for (var i = 0; i < 12; i++) {
                var angle = (i / 12) * 2 * Math.PI;
                circlePoints.push([
                    x + radius * Math.cos(angle),
                    y + radius * Math.sin(angle)
                ]);
            }
            
            hole.setEntirePath(circlePoints);
            hole.filled = false;
            hole.stroked = true;
            hole.strokeColor = color;
            hole.strokeWidth = 1;
            hole.closed = true;
            
            return hole;
        } catch (error) {
            // Si même le fallback échoue, continuer sans ce trou
        }
    }
    
    function createMainContour(layer, largeurFinalePoints, hauteurFinalePoints, 
                             epaisseurHautPoints, epaisseurBasPoints, epaisseurGauchePoints, epaisseurDroitePoints, couleur) {
        
        var contourPath = layer.pathItems.add();
        
        // Calcul de la taille des découpes (épaisseur - 1mm) pour chaque côté
        var decoupeHaut = epaisseurHautPoints > 0 ? (epaisseurHautPoints - mmToPoints(1)) : 0;
        var decoupeBas = epaisseurBasPoints > 0 ? (epaisseurBasPoints - mmToPoints(1)) : 0;
        var decoupeGauche = epaisseurGauchePoints > 0 ? (epaisseurGauchePoints - mmToPoints(1)) : 0;
        var decoupeDroite = epaisseurDroitePoints > 0 ? (epaisseurDroitePoints - mmToPoints(1)) : 0;
        
        // Construction intelligente du contour selon les épaisseurs
        var pathPoints = [];
        
        // Coin haut-gauche
        if (epaisseurGauche > 0 && epaisseurHaut > 0) {
            pathPoints.push([-largeurFinalePoints/2 + decoupeGauche, hauteurFinalePoints/2]);
        } else {
            pathPoints.push([-largeurFinalePoints/2, hauteurFinalePoints/2]);
        }
        
        // Coin haut-droite
        if (epaisseurDroite > 0 && epaisseurHaut > 0) {
            pathPoints.push([largeurFinalePoints/2 - decoupeDroite, hauteurFinalePoints/2]);
            pathPoints.push([largeurFinalePoints/2 - decoupeDroite, hauteurFinalePoints/2 - decoupeHaut]);
            pathPoints.push([largeurFinalePoints/2, hauteurFinalePoints/2 - decoupeHaut]);
        } else {
            pathPoints.push([largeurFinalePoints/2, hauteurFinalePoints/2]);
        }
        
        // Coin bas-droite
        if (epaisseurDroite > 0 && epaisseurBas > 0) {
            pathPoints.push([largeurFinalePoints/2, -hauteurFinalePoints/2 + decoupeBas]);
            pathPoints.push([largeurFinalePoints/2 - decoupeDroite, -hauteurFinalePoints/2 + decoupeBas]);
            pathPoints.push([largeurFinalePoints/2 - decoupeDroite, -hauteurFinalePoints/2]);
        } else {
            pathPoints.push([largeurFinalePoints/2, -hauteurFinalePoints/2]);
        }
        
        // Coin bas-gauche
        if (epaisseurGauche > 0 && epaisseurBas > 0) {
            pathPoints.push([-largeurFinalePoints/2 + decoupeGauche, -hauteurFinalePoints/2]);
            pathPoints.push([-largeurFinalePoints/2 + decoupeGauche, -hauteurFinalePoints/2 + decoupeBas]);
            pathPoints.push([-largeurFinalePoints/2, -hauteurFinalePoints/2 + decoupeBas]);
        } else {
            pathPoints.push([-largeurFinalePoints/2, -hauteurFinalePoints/2]);
        }
        
        // Retour au coin haut-gauche
        if (epaisseurGauche > 0 && epaisseurHaut > 0) {
            pathPoints.push([-largeurFinalePoints/2, hauteurFinalePoints/2 - decoupeHaut]);
            pathPoints.push([-largeurFinalePoints/2 + decoupeGauche, hauteurFinalePoints/2 - decoupeHaut]);
        }
        
        // Application des points au tracé
        contourPath.setEntirePath(pathPoints);
        
        // Style du contour
        contourPath.filled = false;
        contourPath.stroked = true;
        contourPath.strokeColor = couleur;
        contourPath.strokeWidth = 1;
        contourPath.closed = true;
        
        return contourPath;
    }
    
    function createRainures(layer, largeurPoints, hauteurPoints, largeurFinalePoints, hauteurFinalePoints,
                          epaisseurHautPoints, epaisseurBasPoints, epaisseurGauchePoints, epaisseurDroitePoints, couleur) {
        
        var decalage1mm = mmToPoints(1);
        
        // Position réelle de la face visible selon les épaisseurs
        var faceLeft = -largeurFinalePoints / 2 + epaisseurGauchePoints;
        var faceRight = largeurFinalePoints / 2 - epaisseurDroitePoints;
        var faceTop = hauteurFinalePoints / 2 - epaisseurHautPoints;
        var faceBottom = -hauteurFinalePoints / 2 + epaisseurBasPoints;
        
        // ===== RAINURES PRINCIPALES (seulement si épaisseur > 0) =====
        
        if (epaisseurHaut > 0) {
            var rainureHautMain = layer.pathItems.add();
            rainureHautMain.setEntirePath([
                [-largeurFinalePoints / 2, faceTop],
                [largeurFinalePoints / 2, faceTop]
            ]);
            rainureHautMain.filled = false;
            rainureHautMain.stroked = true;
            rainureHautMain.strokeColor = couleur;
            rainureHautMain.strokeWidth = 1;
        }
        
        if (epaisseurBas > 0) {
            var rainureBasMain = layer.pathItems.add();
            rainureBasMain.setEntirePath([
                [-largeurFinalePoints / 2, faceBottom],
                [largeurFinalePoints / 2, faceBottom]
            ]);
            rainureBasMain.filled = false;
            rainureBasMain.stroked = true;
            rainureBasMain.strokeColor = couleur;
            rainureBasMain.strokeWidth = 1;
        }
        
        if (epaisseurGauche > 0) {
            var rainureGaucheMain = layer.pathItems.add();
            rainureGaucheMain.setEntirePath([
                [faceLeft, hauteurFinalePoints / 2],
                [faceLeft, -hauteurFinalePoints / 2]
            ]);
            rainureGaucheMain.filled = false;
            rainureGaucheMain.stroked = true;
            rainureGaucheMain.strokeColor = couleur;
            rainureGaucheMain.strokeWidth = 1;
        }
        
        if (epaisseurDroite > 0) {
            var rainureDroiteMain = layer.pathItems.add();
            rainureDroiteMain.setEntirePath([
                [faceRight, hauteurFinalePoints / 2],
                [faceRight, -hauteurFinalePoints / 2]
            ]);
            rainureDroiteMain.filled = false;
            rainureDroiteMain.stroked = true;
            rainureDroiteMain.strokeColor = couleur;
            rainureDroiteMain.strokeWidth = 1;
        }
        
        // ===== RAINURES DÉCALÉES 1MM (seulement si épaisseurs > 0) =====
        
        var decoupeHaut = epaisseurHautPoints > 0 ? (epaisseurHautPoints - mmToPoints(1)) : 0;
        var decoupeBas = epaisseurBasPoints > 0 ? (epaisseurBasPoints - mmToPoints(1)) : 0;
        var decoupeGauche = epaisseurGauchePoints > 0 ? (epaisseurGauchePoints - mmToPoints(1)) : 0;
        var decoupeDroite = epaisseurDroitePoints > 0 ? (epaisseurDroitePoints - mmToPoints(1)) : 0;
        
        var limiteHauteur = (hauteurFinalePoints / 2) - decoupeHaut;
        var limiteBas = (-hauteurFinalePoints / 2) + decoupeBas;
        var limiteDroite = (largeurFinalePoints / 2) - decoupeDroite;
        var limiteGauche = (-largeurFinalePoints / 2) + decoupeGauche;
        
        if (epaisseurHaut > 0) {
            var rainureHautDecalee = layer.pathItems.add();
            rainureHautDecalee.setEntirePath([
                [limiteGauche, faceTop + decalage1mm],
                [limiteDroite, faceTop + decalage1mm]
            ]);
            rainureHautDecalee.filled = false;
            rainureHautDecalee.stroked = true;
            rainureHautDecalee.strokeColor = couleur;
            rainureHautDecalee.strokeWidth = 1;
        }
        
        if (epaisseurBas > 0) {
            var rainureBasDecalee = layer.pathItems.add();
            rainureBasDecalee.setEntirePath([
                [limiteGauche, faceBottom - decalage1mm],
                [limiteDroite, faceBottom - decalage1mm]
            ]);
            rainureBasDecalee.filled = false;
            rainureBasDecalee.stroked = true;
            rainureBasDecalee.strokeColor = couleur;
            rainureBasDecalee.strokeWidth = 1;
        }
        
        if (epaisseurGauche > 0) {
            var rainureGaucheDecalee = layer.pathItems.add();
            rainureGaucheDecalee.setEntirePath([
                [faceLeft - decalage1mm, limiteHauteur],
                [faceLeft - decalage1mm, limiteBas]
            ]);
            rainureGaucheDecalee.filled = false;
            rainureGaucheDecalee.stroked = true;
            rainureGaucheDecalee.strokeColor = couleur;
            rainureGaucheDecalee.strokeWidth = 1;
        }
        
        if (epaisseurDroite > 0) {
            var rainureDroiteDecalee = layer.pathItems.add();
            rainureDroiteDecalee.setEntirePath([
                [faceRight + decalage1mm, limiteHauteur],
                [faceRight + decalage1mm, limiteBas]
            ]);
            rainureDroiteDecalee.filled = false;
            rainureDroiteDecalee.stroked = true;
            rainureDroiteDecalee.strokeColor = couleur;
            rainureDroiteDecalee.strokeWidth = 1;
        }
    }
    
})(params);