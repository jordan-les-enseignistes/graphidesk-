(function (params) {
    try {
        if (!app) {
            throw new Error("Illustrator n'est pas disponible.");
        }

        var largeur = parseFloat(params.largeur) || 0;
        var hauteur = parseFloat(params.hauteur) || 0;
        var epaisseurTotale = parseFloat(params.epaisseur) || 60;
        // Entraxe potences : null = automatique (aux extrémités),
        // 0 = monopotence centrée (encoche unique), >0 = entraxe personnalisé en mm
        var entraxePotences = params.entraxePotences !== null && params.entraxePotences !== undefined
            ? parseFloat(params.entraxePotences)
            : null;

        if (largeur <= 0 || hauteur <= 0) {
            throw new Error("Les dimensions largeur et hauteur doivent être supérieures à 0.");
        }
        
        if (epaisseurTotale <= 0) {
            throw new Error("L'épaisseur doit être supérieure à 0.");
        }
        
        var epaisseurParFace = epaisseurTotale / 2;
        var largeurFinale = largeur + (2 * epaisseurParFace);
        var hauteurFinale = hauteur + (2 * epaisseurParFace);
        
        function mmToPoints(mm) {
            return mm * 2.83465;
        }
        
        var docPreset = new DocumentPreset();
        docPreset.units = RulerUnits.Millimeters;
        docPreset.width = 1000;
        docPreset.height = 1000;
        
        var doc = app.documents.addDocument(DocumentColorSpace.CMYK, docPreset);
        doc.rulerUnits = RulerUnits.Millimeters;
        app.preferences.setRealPreference('rulerUnits', 6);
        doc.name = "Caisson_Double_Face_TEST";
        
        prepareLayersStructure(doc);
        
        var espacement = mmToPoints(10); // Espacement de 10mm entre les deux faces
        var largeurFinalePoints = mmToPoints(largeurFinale);
        var offsetGauche = -(largeurFinalePoints/2 + espacement/2);
        var offsetDroite = (largeurFinalePoints/2 + espacement/2);
        
        var margin = mmToPoints(20);
        var planLargeur = (2 * mmToPoints(largeurFinale)) + espacement + (2 * margin);
        var planHauteur = mmToPoints(hauteurFinale) + (2 * margin);
        
        var artboard = doc.artboards[0];
        artboard.artboardRect = [-planLargeur/2, planHauteur/2, planLargeur/2, -planHauteur/2];
        
        // Génération face gauche
        generateSingleFace(doc, largeur, hauteur, epaisseurParFace, largeurFinale, hauteurFinale, offsetGauche, false, entraxePotences);

        // Génération face droite (en miroir)
        generateSingleFace(doc, largeur, hauteur, epaisseurParFace, largeurFinale, hauteurFinale, offsetDroite, true, entraxePotences);
        
        app.redraw();
        
        var entraxeInfo;
        if (entraxePotences === null) {
            entraxeInfo = "Automatique (aux extrémités)";
        } else if (entraxePotences === 0) {
            entraxeInfo = "Monopotence centrée (encoche unique)";
        } else {
            entraxeInfo = "Personnalisé : " + entraxePotences + " mm";
        }

        var message = "✅ CAISSON DOUBLE FACE GÉNÉRÉ !\n\n" +
                     "📄 Configuration :\n" +
                     "• Face visible : " + largeur + " × " + hauteur + " mm\n" +
                     "• Épaisseur par face : " + epaisseurParFace + " mm\n" +
                     "• Format fini : " + largeurFinale + " × " + hauteurFinale + " mm\n" +
                     "• Entraxe potences : " + entraxeInfo + "\n\n" +
                     "🎨 Tracés créés :\n" +
                     "• Contour rose : découpe avec encoches potences\n" +
                     "• Rainures bleues : délimitation et pliage\n" +
                     "• Trous verts : perçage Ø3mm\n\n" +
                     "✅ DEUX FACES : recto + verso en miroir\n" +
                     "• Espacement entre faces : 10mm";
        
        alert(message);
        
        return { success: true, message: "Face test générée avec succès" };
        
    } catch (error) {
        alert("❌ Erreur : " + error.message);
        return { success: false, error: error.message };
    }
    
    function generateSingleFace(doc, largeur, hauteur, epaisseur, largeurFinale, hauteurFinale, offsetX, miroir, entraxePotences) {
        var largeurPoints = mmToPoints(largeur);
        var hauteurPoints = mmToPoints(hauteur);
        var largeurFinalePoints = mmToPoints(largeurFinale);
        var hauteurFinalePoints = mmToPoints(hauteurFinale);
        var epaisseurPoints = mmToPoints(epaisseur);

        createContourWithEncoches(doc, offsetX, largeurFinalePoints, hauteurFinalePoints, epaisseurPoints, miroir, entraxePotences);
        createRainures(doc, offsetX, largeurPoints, hauteurPoints, largeurFinalePoints, hauteurFinalePoints, epaisseurPoints, miroir, entraxePotences);
        createDrillingHoles(doc, offsetX, largeurFinalePoints, hauteurFinalePoints, epaisseurPoints, miroir);
    }
    
    function createContourWithEncoches(doc, offsetX, largeurFinalePoints, hauteurFinalePoints, epaisseurPoints, miroir, entraxePotences) {
        var contourLayer = doc.layers.getByName("Contour");

        var couleurRose = new CMYKColor();
        couleurRose.cyan = 0;
        couleurRose.magenta = 100;
        couleurRose.yellow = 0;
        couleurRose.black = 0;

        var decoupeStandard = epaisseurPoints - mmToPoints(1);
        var encocheLargeur = mmToPoints(16);
        var encocheHauteur = mmToPoints(34);

        var contour = contourLayer.pathItems.add();
        var pathPoints = [];

        // Fonction pour appliquer le miroir si nécessaire
        function applyMirror(x, y) {
            if (miroir) {
                return [offsetX - (x - offsetX), y];
            }
            return [x, y];
        }

        // Coordonnées de base
        var bordDroit = offsetX + (largeurFinalePoints/2);
        var bordGauche = offsetX + (-largeurFinalePoints/2);
        var limitAngleHaut = hauteurFinalePoints/2 - decoupeStandard;
        var limitAngleBas = -hauteurFinalePoints/2 + decoupeStandard;

        if (entraxePotences !== null && entraxePotences >= 0) {
            // ===== MODE PERSONNALISÉ / MONOPOTENCE : encoches centrées qui creusent vers l'intérieur =====
            var entraxePoints = mmToPoints(entraxePotences);
            var encocheHauteTop = (entraxePoints / 2) + (encocheHauteur / 2);
            var encocheHauteBottom = (entraxePoints / 2) - (encocheHauteur / 2);
            var encocheBasseTop = -(entraxePoints / 2) + (encocheHauteur / 2);
            var encocheBasseBottom = -(entraxePoints / 2) - (encocheHauteur / 2);
            // Si l'entraxe est plus petit que la hauteur d'encoche, les deux
            // encoches se chevauchent : on creuse une encoche unique (monopotence)
            var encocheUnique = entraxePoints < encocheHauteur;

            // Départ coin haut-gauche
            pathPoints.push(applyMirror(bordGauche + decoupeStandard, hauteurFinalePoints/2));
            pathPoints.push(applyMirror(bordDroit - decoupeStandard, hauteurFinalePoints/2));

            // Coin haut-droite avec découpe
            pathPoints.push(applyMirror(bordDroit - decoupeStandard, limitAngleHaut));
            pathPoints.push(applyMirror(bordDroit, limitAngleHaut));

            if (encocheUnique) {
                // Encoche unique centrée (de encocheHauteTop à encocheBasseBottom)
                pathPoints.push(applyMirror(bordDroit, encocheHauteTop));
                pathPoints.push(applyMirror(bordDroit - encocheLargeur, encocheHauteTop));
                pathPoints.push(applyMirror(bordDroit - encocheLargeur, encocheBasseBottom));
                pathPoints.push(applyMirror(bordDroit, encocheBasseBottom));
            } else {
                // Descente sur le bord droit jusqu'à l'encoche haute
                pathPoints.push(applyMirror(bordDroit, encocheHauteTop));

                // Encoche haute : creuser vers l'intérieur
                pathPoints.push(applyMirror(bordDroit - encocheLargeur, encocheHauteTop));
                pathPoints.push(applyMirror(bordDroit - encocheLargeur, encocheHauteBottom));
                pathPoints.push(applyMirror(bordDroit, encocheHauteBottom));

                // Descente sur le bord droit jusqu'à l'encoche basse
                pathPoints.push(applyMirror(bordDroit, encocheBasseTop));

                // Encoche basse : creuser vers l'intérieur
                pathPoints.push(applyMirror(bordDroit - encocheLargeur, encocheBasseTop));
                pathPoints.push(applyMirror(bordDroit - encocheLargeur, encocheBasseBottom));
                pathPoints.push(applyMirror(bordDroit, encocheBasseBottom));
            }

            // Descente sur le bord droit jusqu'au coin bas
            pathPoints.push(applyMirror(bordDroit, limitAngleBas));

            // Coin bas-droite avec découpe
            pathPoints.push(applyMirror(bordDroit - decoupeStandard, limitAngleBas));
            pathPoints.push(applyMirror(bordDroit - decoupeStandard, -hauteurFinalePoints/2));

            // Côté bas
            pathPoints.push(applyMirror(bordGauche + decoupeStandard, -hauteurFinalePoints/2));

            // Coin bas-gauche avec découpe
            pathPoints.push(applyMirror(bordGauche + decoupeStandard, limitAngleBas));
            pathPoints.push(applyMirror(bordGauche, limitAngleBas));

            // Côté gauche (sans encoches)
            pathPoints.push(applyMirror(bordGauche, limitAngleHaut));

            // Coin haut-gauche avec découpe
            pathPoints.push(applyMirror(bordGauche + decoupeStandard, limitAngleHaut));

            pathPoints.push(pathPoints[0]);

        } else {
            // ===== MODE AUTO : tracé identique au backup original =====
            var rabatTop = (hauteurFinalePoints/2) - epaisseurPoints + mmToPoints(1);
            var rabatBottom = (-hauteurFinalePoints/2) + epaisseurPoints - mmToPoints(1);
            var debutEncoche = Math.min(rabatTop, limitAngleHaut);
            var finEncocheBas = Math.max(rabatBottom, limitAngleBas);

            // Départ coin haut-gauche
            pathPoints.push(applyMirror(bordGauche + decoupeStandard, hauteurFinalePoints/2));
            pathPoints.push(applyMirror(bordDroit - decoupeStandard, hauteurFinalePoints/2));

            // Coin haut-droite avec découpe
            pathPoints.push(applyMirror(bordDroit - decoupeStandard, limitAngleHaut));

            // Descente directe du coin vers l'encoche
            pathPoints.push(applyMirror(bordDroit - decoupeStandard, debutEncoche));

            // Encoche haut-droite - va jusqu'au bord extérieur
            pathPoints.push(applyMirror(bordDroit - encocheLargeur, debutEncoche));
            pathPoints.push(applyMirror(bordDroit - encocheLargeur, debutEncoche - encocheHauteur));
            pathPoints.push(applyMirror(bordDroit, debutEncoche - encocheHauteur));

            pathPoints.push(applyMirror(bordDroit, finEncocheBas + encocheHauteur));

            // Encoche bas-droite
            pathPoints.push(applyMirror(bordDroit - encocheLargeur, finEncocheBas + encocheHauteur));
            pathPoints.push(applyMirror(bordDroit - encocheLargeur, finEncocheBas));
            pathPoints.push(applyMirror(bordDroit - decoupeStandard, finEncocheBas));

            // Descente verticale jusqu'au coin
            pathPoints.push(applyMirror(bordDroit - decoupeStandard, limitAngleBas));

            // Coin bas-droite
            pathPoints.push(applyMirror(bordDroit - decoupeStandard, -hauteurFinalePoints/2));

            // Côté bas
            pathPoints.push(applyMirror(bordGauche + decoupeStandard, -hauteurFinalePoints/2));

            // Coin bas-gauche
            pathPoints.push(applyMirror(bordGauche + decoupeStandard, limitAngleBas));
            pathPoints.push(applyMirror(bordGauche, limitAngleBas));

            // Côté gauche (sans encoches)
            pathPoints.push(applyMirror(bordGauche, rabatTop));
            pathPoints.push(applyMirror(bordGauche, limitAngleHaut));
            pathPoints.push(applyMirror(bordGauche + decoupeStandard, limitAngleHaut));

            pathPoints.push(pathPoints[0]);
        }

        contour.setEntirePath(pathPoints);
        contour.filled = false;
        contour.stroked = true;
        contour.strokeColor = couleurRose;
        contour.strokeWidth = 1;
        contour.closed = true;
    }
    
    // ✅ RAINURES
    function createRainures(doc, offsetX, largeurPoints, hauteurPoints, largeurFinalePoints, hauteurFinalePoints, epaisseurPoints, miroir, entraxePotences) {
        var rainureLayer = doc.layers.getByName("Rainures");

        var couleurBleu = new CMYKColor();
        couleurBleu.cyan = 100;
        couleurBleu.magenta = 0;
        couleurBleu.yellow = 0;
        couleurBleu.black = 0;

        // Fonction pour appliquer le miroir si nécessaire
        function applyMirror(x, y) {
            if (miroir) {
                return [offsetX - (x - offsetX), y];
            }
            return [x, y];
        }

        var decalage1mm = mmToPoints(1);
        var encocheLargeur = mmToPoints(16);

        var faceLeft = offsetX + (-largeurFinalePoints / 2) + epaisseurPoints;
        var faceRight = offsetX + (largeurFinalePoints / 2) - epaisseurPoints;
        var faceTop = hauteurFinalePoints / 2 - epaisseurPoints;
        var faceBottom = -hauteurFinalePoints / 2 + epaisseurPoints;

        // En mode personnalisé, les rainures vont jusqu'au bout (pas d'encoche aux extrémités)
        // En mode auto, elles s'arrêtent avant l'encoche
        var limiteRainureDroite;
        if (entraxePotences !== null && entraxePotences >= 0) {
            // Mode personnalisé / monopotence : rainures jusqu'au bord droit
            limiteRainureDroite = offsetX + (largeurFinalePoints / 2);
        } else {
            // Mode auto : s'arrêter avant l'encoche
            limiteRainureDroite = offsetX + (largeurFinalePoints / 2) - encocheLargeur;
        }

        // RAINURE HORIZONTALE HAUT
        var rainureHaut = rainureLayer.pathItems.add();
        rainureHaut.setEntirePath([
            applyMirror(offsetX + (-largeurFinalePoints / 2), faceTop),
            applyMirror(limiteRainureDroite, faceTop)
        ]);
        rainureHaut.filled = false;
        rainureHaut.stroked = true;
        rainureHaut.strokeColor = couleurBleu;
        rainureHaut.strokeWidth = 1;

        // RAINURE HORIZONTALE BAS
        var rainureBas = rainureLayer.pathItems.add();
        rainureBas.setEntirePath([
            applyMirror(offsetX + (-largeurFinalePoints / 2), faceBottom),
            applyMirror(limiteRainureDroite, faceBottom)
        ]);
        rainureBas.filled = false;
        rainureBas.stroked = true;
        rainureBas.strokeColor = couleurBleu;
        rainureBas.strokeWidth = 1;
        
        // RAINURE VERTICALE GAUCHE
        var rainureGauche = rainureLayer.pathItems.add();
        rainureGauche.setEntirePath([
            applyMirror(faceLeft, hauteurFinalePoints / 2),
            applyMirror(faceLeft, -hauteurFinalePoints / 2)
        ]);
        rainureGauche.filled = false;
        rainureGauche.stroked = true;
        rainureGauche.strokeColor = couleurBleu;
        rainureGauche.strokeWidth = 1;
        
        // RAINURE VERTICALE DROITE
        var rainureDroite = rainureLayer.pathItems.add();
        rainureDroite.setEntirePath([
            applyMirror(faceRight, hauteurFinalePoints / 2),
            applyMirror(faceRight, -hauteurFinalePoints / 2)
        ]);
        rainureDroite.filled = false;
        rainureDroite.stroked = true;
        rainureDroite.strokeColor = couleurBleu;
        rainureDroite.strokeWidth = 1;
        
        // RAINURES DÉCALÉES 1MM
        var decoupeStandard = epaisseurPoints - mmToPoints(1);
        var limiteHaut = (hauteurFinalePoints / 2) - decoupeStandard;
        var limiteBas = (-hauteurFinalePoints / 2) + decoupeStandard;
        var limiteDroite = offsetX + (largeurFinalePoints / 2) - decoupeStandard;
        var limiteGauche = offsetX + (-largeurFinalePoints / 2) + decoupeStandard;
        
        var rainureHautDec = rainureLayer.pathItems.add();
        rainureHautDec.setEntirePath([
            applyMirror(limiteGauche, faceTop + decalage1mm),
            applyMirror(limiteDroite, faceTop + decalage1mm)
        ]);
        rainureHautDec.filled = false;
        rainureHautDec.stroked = true;
        rainureHautDec.strokeColor = couleurBleu;
        rainureHautDec.strokeWidth = 1;
        
        var rainureBasDec = rainureLayer.pathItems.add();
        rainureBasDec.setEntirePath([
            applyMirror(limiteGauche, faceBottom - decalage1mm),
            applyMirror(limiteDroite, faceBottom - decalage1mm)
        ]);
        rainureBasDec.filled = false;
        rainureBasDec.stroked = true;
        rainureBasDec.strokeColor = couleurBleu;
        rainureBasDec.strokeWidth = 1;
        
        var rainureGaucheDec = rainureLayer.pathItems.add();
        rainureGaucheDec.setEntirePath([
            applyMirror(faceLeft - decalage1mm, limiteHaut),
            applyMirror(faceLeft - decalage1mm, limiteBas)
        ]);
        rainureGaucheDec.filled = false;
        rainureGaucheDec.stroked = true;
        rainureGaucheDec.strokeColor = couleurBleu;
        rainureGaucheDec.strokeWidth = 1;
        
        var rainureDroiteDec = rainureLayer.pathItems.add();
        rainureDroiteDec.setEntirePath([
            applyMirror(faceRight + decalage1mm, limiteHaut),
            applyMirror(faceRight + decalage1mm, limiteBas)
        ]);
        rainureDroiteDec.filled = false;
        rainureDroiteDec.stroked = true;
        rainureDroiteDec.strokeColor = couleurBleu;
        rainureDroiteDec.strokeWidth = 1;
    }
    
    function createDrillingHoles(doc, offsetX, largeurFinalePoints, hauteurFinalePoints, epaisseurPoints, miroir) {
        var percageLayer = doc.layers.getByName("Perçage");
        
        var couleurVerte = new CMYKColor();
        couleurVerte.cyan = 50;
        couleurVerte.magenta = 0;
        couleurVerte.yellow = 100;
        couleurVerte.black = 0;
        
        // Fonction pour appliquer le miroir si nécessaire
        function applyMirrorX(x) {
            if (miroir) {
                return offsetX - (x - offsetX);
            }
            return x;
        }
        
        var rayonTrou = mmToPoints(1.5);
        var distanceAngle = mmToPoints(50);
        var distanceBord = mmToPoints(10); // Distance des trous par rapport au bord
        var espacementMax = mmToPoints(750);
        var decoupeStandard = epaisseurPoints - mmToPoints(1);
        
        var rabatY = hauteurFinalePoints/2 - distanceBord;
        var startX = offsetX + (-largeurFinalePoints/2) + decoupeStandard + distanceAngle;
        var endX = offsetX + (largeurFinalePoints/2) - decoupeStandard - distanceAngle;
        var holePositions = calculateHolePositions(startX, endX, espacementMax);
        
        for (var i = 0; i < holePositions.length; i++) {
            createDrillingHole(percageLayer, applyMirrorX(holePositions[i]), rabatY, rayonTrou, couleurVerte);
        }
        
        var rabatYBas = -hauteurFinalePoints/2 + distanceBord;
        for (var i = 0; i < holePositions.length; i++) {
            createDrillingHole(percageLayer, applyMirrorX(holePositions[i]), rabatYBas, rayonTrou, couleurVerte);
        }
        
        var startY = hauteurFinalePoints/2 - decoupeStandard - distanceAngle;
        var endY = -hauteurFinalePoints/2 + decoupeStandard + distanceAngle;
        var holePositionsY = calculateHolePositions(endY, startY, espacementMax);
        
        var rabatXGauche = offsetX + (-largeurFinalePoints/2) + distanceBord;
        for (var i = 0; i < holePositionsY.length; i++) {
            createDrillingHole(percageLayer, applyMirrorX(rabatXGauche), holePositionsY[i], rayonTrou, couleurVerte);
        }
        
        var rabatXDroite = offsetX + (largeurFinalePoints/2) - distanceBord;
        for (var i = 0; i < holePositionsY.length; i++) {
            createDrillingHole(percageLayer, applyMirrorX(rabatXDroite), holePositionsY[i], rayonTrou, couleurVerte);
        }
    }
    
    function calculateHolePositions(start, end, maxSpacing) {
        var totalLength = Math.abs(end - start);
        if (totalLength <= 0) return [];
        
        var segments = Math.ceil(totalLength / maxSpacing);
        var actualSpacing = totalLength / segments;
        var positions = [];
        var direction = (end > start) ? 1 : -1;
        
        for (var i = 0; i <= segments; i++) {
            positions.push(start + (i * actualSpacing * direction));
        }
        
        return positions;
    }
    
    function createDrillingHole(layer, x, y, radius, color) {
        try {
            var hole = layer.pathItems.add();
            var circlePoints = [];
            
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
        } catch (error) {}
    }
    
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

})(params);
