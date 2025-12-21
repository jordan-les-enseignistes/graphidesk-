(function (params) {
    try {
        // Vérification de la présence d'Illustrator
        if (!app) {
            throw new Error("Illustrator n'est pas disponible.");
        }

        // Récupération des paramètres
        var parts = params.parts || [];
        
        if (parts.length === 0) {
            throw new Error("Aucune partie définie pour le caisson multi-parties.");
        }
        
        // Conversion mm vers points (1mm = 2.83465 points)
        function mmToPoints(mm) {
            return mm * 2.83465;
        }
        
        // Variables pour le message final
        var totalParts = parts.length;
        var partsSummary = [];
        var filesCreated = [];
        
        // Générer un fichier pour chaque partie
        for (var i = 0; i < parts.length; i++) {
            var part = parts[i];
            var partIndex = i + 1;
            
            // Validation des dimensions de la partie
            var largeur = parseFloat(part.largeur) || 0;
            var hauteur = parseFloat(part.hauteur) || 0;
            
            if (largeur <= 0 || hauteur <= 0) {
                throw new Error("Les dimensions largeur et hauteur de la partie " + partIndex + " doivent être supérieures à 0.");
            }
            
            // === GESTION DES ÉPAISSEURS VARIABLES (comme caisson simple) ===
            var epaisseurHaut, epaisseurBas, epaisseurGauche, epaisseurDroite;
            
            if (part.isMultiThickness && part.thickness) {
                // Mode multi-épaisseurs pour cette partie
                epaisseurHaut = parseFloat(part.thickness.haut) || 0;
                epaisseurBas = parseFloat(part.thickness.bas) || 0;
                epaisseurGauche = parseFloat(part.thickness.gauche) || 0;
                epaisseurDroite = parseFloat(part.thickness.droite) || 0;
            } else {
                // Mode épaisseur unique pour cette partie
                var profondeur = parseFloat(part.profondeur) || 0;
                epaisseurHaut = epaisseurBas = profondeur;
                epaisseurGauche = epaisseurDroite = (part.type === 'left' || part.type === 'right') ? profondeur : 0;
            }
            
            // Validation des épaisseurs
            if (epaisseurHaut < 0 || epaisseurBas < 0) {
                throw new Error("Les épaisseurs haut et bas de la partie " + partIndex + " doivent être supérieures ou égales à 0.");
            }
            
            if (part.type === 'left' && epaisseurGauche < 0) {
                throw new Error("L'épaisseur gauche de la partie " + partIndex + " doit être supérieure ou égale à 0.");
            }
            
            if (part.type === 'right' && epaisseurDroite < 0) {
                throw new Error("L'épaisseur droite de la partie " + partIndex + " doit être supérieure ou égale à 0.");
            }
            
            // Vérifier qu'au moins un côté a une épaisseur > 0
            if (epaisseurHaut === 0 && epaisseurBas === 0 && epaisseurGauche === 0 && epaisseurDroite === 0) {
                throw new Error("Au moins un côté de la partie " + partIndex + " doit avoir une épaisseur supérieure à 0.");
            }
            
            // Calcul des dimensions selon le type de partie ET les épaisseurs variables
            var largeurFinale = largeur;
            var hauteurFinale = hauteur + epaisseurHaut + epaisseurBas;
            
            if (part.type === 'left') {
                largeurFinale += epaisseurGauche;
            } else if (part.type === 'right') {
                largeurFinale += epaisseurDroite;
            }
            
            // === CRÉATION D'UN NOUVEAU DOCUMENT POUR CETTE PARTIE ===
            var docPreset = new DocumentPreset();
            docPreset.units = RulerUnits.Millimeters;
            docPreset.width = 1000; // Taille temporaire en mm
            docPreset.height = 1000; // Taille temporaire en mm
            
            var doc = app.documents.addDocument(DocumentColorSpace.CMYK, docPreset);
            
            // Forcer les unités du document en mm
            doc.rulerUnits = RulerUnits.Millimeters;
            app.preferences.setRealPreference('rulerUnits', 6); // 6 = millimètres
            
            // Création de la structure de calques
            prepareLayersStructure(doc);
            
            // Configuration du plan de travail
            setupArtboard(doc, largeurFinale, hauteurFinale);
            
            // Génération du caisson pour cette partie avec épaisseurs variables
            generateCaisson(doc, part, largeur, hauteur, largeurFinale, hauteurFinale, 
                          epaisseurHaut, epaisseurBas, epaisseurGauche, epaisseurDroite);
            
            // ✅ NOUVEAUTÉ V2.1 : Génération des trous de perçage pour cette partie
            var shouldAddDrillingHoles = params.drillingHoles !== false; // Par défaut true
            if (shouldAddDrillingHoles) {
                generateDrillingHoles(doc, part, mmToPoints(largeurFinale), mmToPoints(hauteurFinale), 
                                    mmToPoints(epaisseurHaut), mmToPoints(epaisseurBas), 
                                    mmToPoints(epaisseurGauche), mmToPoints(epaisseurDroite));
            }
            
            // Nommer le document avec le bon nom de fichier
            var fileName = getPartFileName(part.type, partIndex);
            doc.name = fileName.replace('.ai', ''); // Enlever l'extension pour le nom du document
            
            app.redraw();
            
            // Ajout au résumé
            var partName = getPartTypeName(part.type);
            var epaisseurInfo = "";
            if (part.isMultiThickness && part.thickness) {
                epaisseurInfo = " (H:" + epaisseurHaut + " B:" + epaisseurBas + " G:" + epaisseurGauche + " D:" + epaisseurDroite + "mm)";
            } else {
                epaisseurInfo = " (" + epaisseurHaut + "mm)";
            }
            
            partsSummary.push(partName + ": " + largeurFinale + "×" + hauteurFinale + "mm" + epaisseurInfo);
            filesCreated.push(fileName);
        }
        
        var drillingInfo = params.drillingHoles !== false ? "\n• Trous de perçage Ø3mm (verts)" : "";
        
        var message = "✅ CAISSON MULTI-PARTIES GÉNÉRÉ AVEC SUCCÈS !\n\n" +
                     "🧩 Configuration :\n" +
                     "• Nombre de parties : " + totalParts + "\n" +
                     "• Fichiers créés : " + totalParts + "\n\n" +
                     "📐 Détail des parties :\n" +
                     "• " + partsSummary.join("\n• ") + "\n\n" +
                     "📄 Fichiers générés :\n" +
                     "• " + filesCreated.join("\n• ") + "\n\n" +
                     "🎨 Tracés créés :\n" +
                     "• Contour rose : découpe avec angles défoncés variables\n" +
                     "• Rainures bleues : pliage selon épaisseurs et type de partie" + drillingInfo + "\n\n" +
                     "✅ Votre caisson multi-parties est prêt !";
        
        alert(message);
        
        return { success: true, message: "Caisson multi-parties généré avec succès" };
        
    } catch (error) {
        alert("❌ Erreur lors de la génération du caisson multi-parties : " + error.message);
        return { success: false, error: error.message };
    }
    
    // ===== FONCTIONS MISES À JOUR =====
    
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
        // ✅ NOUVEAUTÉ V2.1 : Calque Perçage
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
            // ✅ Calque Perçage en 3ème position
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
    
    function getPartTypeName(type) {
        switch (type) {
            case 'left': return "Partie gauche";
            case 'center': return "Partie centrale";
            case 'right': return "Partie droite";
            default: return "Partie";
        }
    }
    
    function getPartFileName(type, index) {
        switch (type) {
            case 'left': return "Partie_Gauche.ai";
            case 'center': return "Partie_Centrale_" + index + ".ai";
            case 'right': return "Partie_Droite.ai";
            default: return "Partie_" + index + ".ai";
        }
    }
    
    function generateCaisson(doc, part, largeur, hauteur, largeurFinale, hauteurFinale, 
                           epaisseurHaut, epaisseurBas, epaisseurGauche, epaisseurDroite) {
        try {
            var contourLayer = doc.layers.getByName("Contour");
            var rainureLayer = doc.layers.getByName("Rainures");
            
            // Conversion en points
            var largeurPoints = mmToPoints(largeur);
            var hauteurPoints = mmToPoints(hauteur);
            var largeurFinalePoints = mmToPoints(largeurFinale);
            var hauteurFinalePoints = mmToPoints(hauteurFinale);
            var epaisseurHautPoints = mmToPoints(epaisseurHaut);
            var epaisseurBasPoints = mmToPoints(epaisseurBas);
            var epaisseurGauchePoints = mmToPoints(epaisseurGauche);
            var epaisseurDroitePoints = mmToPoints(epaisseurDroite);
            
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
            
            // ===== CONTOUR PRINCIPAL (ROSE) avec épaisseurs variables =====
            createMainContour(contourLayer, part, largeurFinalePoints, hauteurFinalePoints, 
                            epaisseurHautPoints, epaisseurBasPoints, epaisseurGauchePoints, epaisseurDroitePoints, couleurRose);
            
            // ===== RAINURES (BLEU) avec épaisseurs variables =====
            createRainures(rainureLayer, part, largeurPoints, hauteurPoints, largeurFinalePoints, hauteurFinalePoints,
                         epaisseurHautPoints, epaisseurBasPoints, epaisseurGauchePoints, epaisseurDroitePoints, couleurBleu);
            
        } catch (error) {
            throw new Error("Erreur lors de la génération de la partie : " + error.message);
        }
    }
    
    // ✅ NOUVEAUTÉ V2.1 : Fonction de génération des trous de perçage pour multi-caisson
    function generateDrillingHoles(doc, part, largeurFinalePoints, hauteurFinalePoints, 
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
            
            // Paramètres de perçage (conformes à l'aperçu visuel)
            var rayonTrou = mmToPoints(1.5); // Rayon 1.5mm (diamètre 3mm)
            var distanceAngle = mmToPoints(50); // 50mm des angles
            var distanceBord = mmToPoints(25); // 25mm du bord extérieur
            var espacementMax = mmToPoints(750); // Espacement max 750mm
            
            // Calcul des découpes pour les "vrais" angles
            var decoupeHaut = epaisseurHautPoints > 0 ? (epaisseurHautPoints - mmToPoints(1)) : 0;
            var decoupeBas = epaisseurBasPoints > 0 ? (epaisseurBasPoints - mmToPoints(1)) : 0;
            var decoupeGauche = epaisseurGauchePoints > 0 ? (epaisseurGauchePoints - mmToPoints(1)) : 0;
            var decoupeDroite = epaisseurDroitePoints > 0 ? (epaisseurDroitePoints - mmToPoints(1)) : 0;
            
            // ===== RABAT DU HAUT (toujours présent si épaisseur > 0) =====
            if (epaisseurHautPoints > 0) {
                var rabatY = hauteurFinalePoints/2 - distanceBord;
                var startX, endX;
                
                // Calcul selon le type de partie
                if (part.type === 'left') {
                    startX = -largeurFinalePoints/2 + decoupeGauche + distanceAngle;
                    endX = largeurFinalePoints/2 - distanceAngle;
                } else if (part.type === 'right') {
                    startX = -largeurFinalePoints/2 + distanceAngle;
                    endX = largeurFinalePoints/2 - decoupeDroite - distanceAngle;
                } else {
                    // Partie centrale
                    startX = -largeurFinalePoints/2 + distanceAngle;
                    endX = largeurFinalePoints/2 - distanceAngle;
                }
                
                var availableLength = endX - startX;
                
                if (availableLength > 0) {
                    var holePositions = calculateHolePositions(startX, endX, espacementMax);
                    for (var i = 0; i < holePositions.length; i++) {
                        createDrillingHole(percageLayer, holePositions[i], rabatY, rayonTrou, couleurVerte);
                    }
                }
            }
            
            // ===== RABAT DU BAS (toujours présent si épaisseur > 0) =====
            if (epaisseurBasPoints > 0) {
                var rabatY = -hauteurFinalePoints/2 + distanceBord;
                var startX, endX;
                
                // Calcul selon le type de partie
                if (part.type === 'left') {
                    startX = -largeurFinalePoints/2 + decoupeGauche + distanceAngle;
                    endX = largeurFinalePoints/2 - distanceAngle;
                } else if (part.type === 'right') {
                    startX = -largeurFinalePoints/2 + distanceAngle;
                    endX = largeurFinalePoints/2 - decoupeDroite - distanceAngle;
                } else {
                    // Partie centrale
                    startX = -largeurFinalePoints/2 + distanceAngle;
                    endX = largeurFinalePoints/2 - distanceAngle;
                }
                
                var availableLength = endX - startX;
                
                if (availableLength > 0) {
                    var holePositions = calculateHolePositions(startX, endX, espacementMax);
                    for (var i = 0; i < holePositions.length; i++) {
                        createDrillingHole(percageLayer, holePositions[i], rabatY, rayonTrou, couleurVerte);
                    }
                }
            }
            
            // ===== RABAT DE GAUCHE (seulement pour partie gauche) =====
            if (part.type === 'left' && epaisseurGauchePoints > 0) {
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
            
            // ===== RABAT DE DROITE (seulement pour partie droite) =====
            if (part.type === 'right' && epaisseurDroitePoints > 0) {
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
            // Méthode fallback (celle qui fonctionne avec Illustrator 2025)
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
    
    function createMainContour(layer, part, largeurFinalePoints, hauteurFinalePoints, 
                             epaisseurHautPoints, epaisseurBasPoints, epaisseurGauchePoints, epaisseurDroitePoints, couleur) {
        
        var contourPath = layer.pathItems.add();
        
        // Calcul de la taille des découpes (épaisseur - 1mm) pour chaque côté
        var decoupeHaut = epaisseurHautPoints - mmToPoints(1);
        var decoupeBas = epaisseurBasPoints - mmToPoints(1);
        var decoupeGauche = epaisseurGauchePoints - mmToPoints(1);
        var decoupeDroite = epaisseurDroitePoints - mmToPoints(1);
        
        var pathPoints = [];
        
        if (part.type === 'left') {
            // Partie gauche : découpes angles côté GAUCHE (là où il n'y a PAS de rabat)
            pathPoints = [
                [-largeurFinalePoints/2 + decoupeGauche, hauteurFinalePoints/2],
                [largeurFinalePoints/2, hauteurFinalePoints/2],
                [largeurFinalePoints/2, -hauteurFinalePoints/2],
                [-largeurFinalePoints/2 + decoupeGauche, -hauteurFinalePoints/2],
                [-largeurFinalePoints/2 + decoupeGauche, -hauteurFinalePoints/2 + decoupeBas],
                [-largeurFinalePoints/2, -hauteurFinalePoints/2 + decoupeBas],
                [-largeurFinalePoints/2, hauteurFinalePoints/2 - decoupeHaut],
                [-largeurFinalePoints/2 + decoupeGauche, hauteurFinalePoints/2 - decoupeHaut]
            ];
        } else if (part.type === 'right') {
            // Partie droite : découpes angles côté DROIT (là où il n'y a PAS de rabat)
            pathPoints = [
                [-largeurFinalePoints/2, hauteurFinalePoints/2],
                [largeurFinalePoints/2 - decoupeDroite, hauteurFinalePoints/2],
                [largeurFinalePoints/2 - decoupeDroite, hauteurFinalePoints/2 - decoupeHaut],
                [largeurFinalePoints/2, hauteurFinalePoints/2 - decoupeHaut],
                [largeurFinalePoints/2, -hauteurFinalePoints/2 + decoupeBas],
                [largeurFinalePoints/2 - decoupeDroite, -hauteurFinalePoints/2 + decoupeBas],
                [largeurFinalePoints/2 - decoupeDroite, -hauteurFinalePoints/2],
                [-largeurFinalePoints/2, -hauteurFinalePoints/2]
            ];
        } else {
            // ✅ CORRECTION PARTIE CENTRALE : contour complet avec découpes seulement haut/bas
            pathPoints = [
                [-largeurFinalePoints/2, hauteurFinalePoints/2],                    // Coin haut-gauche COMPLET
                [largeurFinalePoints/2, hauteurFinalePoints/2],                     // Coin haut-droite COMPLET
                [largeurFinalePoints/2, hauteurFinalePoints/2 - decoupeHaut],       // Début découpe haut-droite
                [largeurFinalePoints/2, -hauteurFinalePoints/2 + decoupeBas],       // Fin découpe bas-droite
                [largeurFinalePoints/2, -hauteurFinalePoints/2],                    // Coin bas-droite COMPLET
                [-largeurFinalePoints/2, -hauteurFinalePoints/2],                   // Coin bas-gauche COMPLET
                [-largeurFinalePoints/2, -hauteurFinalePoints/2 + decoupeBas],      // Début découpe bas-gauche
                [-largeurFinalePoints/2, hauteurFinalePoints/2 - decoupeHaut]       // Fin découpe haut-gauche
            ];
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
    
    function createRainures(layer, part, largeurPoints, hauteurPoints, largeurFinalePoints, hauteurFinalePoints,
                          epaisseurHautPoints, epaisseurBasPoints, epaisseurGauchePoints, epaisseurDroitePoints, couleur) {
        
        var decalage1mm = mmToPoints(1);
        
        // ===== CALCUL DE LA POSITION DE LA FACE VISIBLE (même logique que caisson simple) =====
        var faceLeft = -largeurFinalePoints / 2 + epaisseurGauchePoints;
        var faceRight = largeurFinalePoints / 2 - epaisseurDroitePoints;
        var faceTop = hauteurFinalePoints / 2 - epaisseurHautPoints;
        var faceBottom = -hauteurFinalePoints / 2 + epaisseurBasPoints;
        
        // ===== RAINURES PRINCIPALES (délimitent la face visible) =====
        
        // Rainures horizontales (toujours - haut et bas de la face)
        var rainureHautMain = layer.pathItems.add();
        rainureHautMain.setEntirePath([
            [-largeurFinalePoints / 2, faceTop],
            [largeurFinalePoints / 2, faceTop]
        ]);
        rainureHautMain.filled = false;
        rainureHautMain.stroked = true;
        rainureHautMain.strokeColor = couleur;
        rainureHautMain.strokeWidth = 1;
        
        var rainureBasMain = layer.pathItems.add();
        rainureBasMain.setEntirePath([
            [-largeurFinalePoints / 2, faceBottom],
            [largeurFinalePoints / 2, faceBottom]
        ]);
        rainureBasMain.filled = false;
        rainureBasMain.stroked = true;
        rainureBasMain.strokeColor = couleur;
        rainureBasMain.strokeWidth = 1;
        
        // Rainures verticales selon le type
        if (part.type === 'left') {
            // Partie gauche : rainure verticale du côté où il y a un rabat
            var rainureGaucheMain = layer.pathItems.add();
            rainureGaucheMain.setEntirePath([
                [faceLeft, hauteurFinalePoints / 2],
                [faceLeft, -hauteurFinalePoints / 2]
            ]);
            rainureGaucheMain.filled = false;
            rainureGaucheMain.stroked = true;
            rainureGaucheMain.strokeColor = couleur;
            rainureGaucheMain.strokeWidth = 1;
        } else if (part.type === 'right') {
            // Partie droite : rainure verticale du côté où il y a un rabat
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
        // Partie centrale : pas de rainures verticales principales
        
        // ===== RAINURES DÉCALÉES 1MM (pour le pliage) =====
        
        // Calcul des limites pour s'arrêter aux angles défoncés (variables selon l'épaisseur)
        var decoupeHaut = epaisseurHautPoints - mmToPoints(1);
        var decoupeBas = epaisseurBasPoints - mmToPoints(1);
        var decoupeGauche = epaisseurGauchePoints - mmToPoints(1);
        var decoupeDroite = epaisseurDroitePoints - mmToPoints(1);
        
        var limiteHauteur = (hauteurFinalePoints / 2) - decoupeHaut;
        var limiteBas = (-hauteurFinalePoints / 2) + decoupeBas;
        var limiteDroite = (largeurFinalePoints / 2) - decoupeDroite;
        var limiteGauche = (-largeurFinalePoints / 2) + decoupeGauche;
        
        // Rainures horizontales décalées 1mm (s'arrêtent aux découpes variables)
        var rainureHautDecalee = layer.pathItems.add();
        var rainureBasDecalee = layer.pathItems.add();
        
        if (part.type === 'left') {
            rainureHautDecalee.setEntirePath([
                [limiteGauche, faceTop + decalage1mm],
                [largeurFinalePoints / 2, faceTop + decalage1mm]
            ]);
            rainureBasDecalee.setEntirePath([
                [limiteGauche, faceBottom - decalage1mm],
                [largeurFinalePoints / 2, faceBottom - decalage1mm]
            ]);
        } else if (part.type === 'right') {
            rainureHautDecalee.setEntirePath([
                [-largeurFinalePoints / 2, faceTop + decalage1mm],
                [limiteDroite, faceTop + decalage1mm]
            ]);
            rainureBasDecalee.setEntirePath([
                [-largeurFinalePoints / 2, faceBottom - decalage1mm],
                [limiteDroite, faceBottom - decalage1mm]
            ]);
        } else {
            // Partie centrale : toute la largeur
            rainureHautDecalee.setEntirePath([
                [-largeurFinalePoints / 2, faceTop + decalage1mm],
                [largeurFinalePoints / 2, faceTop + decalage1mm]
            ]);
            rainureBasDecalee.setEntirePath([
                [-largeurFinalePoints / 2, faceBottom - decalage1mm],
                [largeurFinalePoints / 2, faceBottom - decalage1mm]
            ]);
        }
        
        rainureHautDecalee.filled = false;
        rainureHautDecalee.stroked = true;
        rainureHautDecalee.strokeColor = couleur;
        rainureHautDecalee.strokeWidth = 1;
        
        rainureBasDecalee.filled = false;
        rainureBasDecalee.stroked = true;
        rainureBasDecalee.strokeColor = couleur;
        rainureBasDecalee.strokeWidth = 1;
        
        // Rainures verticales décalées 1mm
        if (part.type === 'left') {
            var rainureGaucheDecalee = layer.pathItems.add();
            rainureGaucheDecalee.setEntirePath([
                [faceLeft - decalage1mm, limiteHauteur],
                [faceLeft - decalage1mm, limiteBas]
            ]);
            rainureGaucheDecalee.filled = false;
            rainureGaucheDecalee.stroked = true;
            rainureGaucheDecalee.strokeColor = couleur;
            rainureGaucheDecalee.strokeWidth = 1;
        } else if (part.type === 'right') {
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
        // Partie centrale : pas de rainures verticales décalées
    }
    
})(params);