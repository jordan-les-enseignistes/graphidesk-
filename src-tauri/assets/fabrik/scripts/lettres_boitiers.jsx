/**
 * LETTRES BOÎTIERS - Script de génération automatique
 *
 * Ce script génère 3 fichiers PDF à partir d'un document Illustrator contenant
 * des tracés vectoriels de lettres :
 *
 * 1. TRANCHES : Le fichier source tel quel (juste renommé)
 * 2. SEMELLES : Le fichier avec aérations (groupes de 6 ronds) et évacuations (trous 4mm)
 * 3. PLEXI : Le fichier source tel quel (juste renommé avec suffixe différent)
 *
 * LOGIQUE DE PLACEMENT :
 * - Scanne l'intérieur réel des tracés pour trouver les zones pleines
 * - Place les aérations dans le tiers supérieur, centrées dans la matière
 * - Place l'évacuation en bas au centre de la zone la plus large
 *
 * Paramètres attendus :
 * - destinationPath : Chemin du dossier de destination
 * - dossierName : Nom du dossier client
 * - batNumber : Numéro du BAT
 */

(function (params) {
    try {
        // ===== VALIDATION =====
        if (!app || app.documents.length === 0) {
            throw new Error("Aucun document Illustrator n'est ouvert.\n\nVeuillez ouvrir votre fichier PDF contenant les lettres.");
        }

        var doc = app.activeDocument;

        // Validation des paramètres
        if (!params.destinationPath) {
            throw new Error("Le chemin de destination n'est pas défini.");
        }
        if (!params.dossierName) {
            throw new Error("Le nom du dossier n'est pas défini.");
        }
        if (!params.batNumber) {
            throw new Error("Le numéro de BAT n'est pas défini.");
        }

        // ===== CONSTANTES =====
        var AERATION_SMALL_CIRCLE_DIAMETER = 3.356; // mm
        var AERATION_GROUP_WIDTH = 18; // mm (pour 6 cercles)
        var AERATION_GROUP_HEIGHT = 15; // mm
        var EVACUATION_DIAMETER = 4; // mm
        var MIN_SOLID_WIDTH_MM = 20; // mm - largeur minimale de matière pour placer une aération
        var MARGIN_FROM_EDGE_MM = 8; // mm - marge minimale depuis le bord du tracé

        // Conversion mm vers points
        function mmToPoints(mm) {
            return mm * 2.83465;
        }

        // Conversion points vers mm
        function pointsToMM(pts) {
            return pts / 2.83465;
        }

        // ===== GÉNÉRATION DES NOMS DE FICHIERS =====
        var baseNameTranches = "LETTRES_BOITIERS_TRANCHES_" + params.dossierName + "_N" + params.batNumber;
        var baseNameSemelles = "LETTRES_BOITIERS_SEMELLES_-1.5mm_" + params.dossierName + "_N" + params.batNumber;
        var baseNamePlexi = "LETTRES_BOITIERS_PLEXI_+3.2-0.8mm_" + params.dossierName + "_N" + params.batNumber;

        // ===== FONCTIONS UTILITAIRES =====

        /**
         * Crée un groupe d'aération (6 cercles : 5 en cercle + 1 au centre)
         * Disposition hexagonale :
         *      o   o
         *    o   o   o
         *      o
         * (5 autour en pentagone + 1 au centre)
         */
        function createAerationGroup(doc, centerX, centerY) {
            var group = doc.groupItems.add();
            var smallRadius = mmToPoints(AERATION_SMALL_CIRCLE_DIAMETER / 2);

            // Rayon du cercle sur lequel sont placés les 5 points extérieurs
            var outerRadius = mmToPoints(5); // 5mm du centre

            // Couleur verte pour les aérations
            var greenColor = new CMYKColor();
            greenColor.cyan = 85;
            greenColor.magenta = 10;
            greenColor.yellow = 100;
            greenColor.black = 0;

            // Positions des 6 cercles (1 au centre + 5 en pentagone autour)
            var positions = [
                // Centre
                { x: centerX, y: centerY }
            ];

            // 5 cercles autour en pentagone (angles réguliers de 72°)
            // On commence en haut (90°) et on tourne dans le sens horaire
            for (var i = 0; i < 5; i++) {
                var angle = (90 + i * 72) * Math.PI / 180; // Convertir en radians
                positions.push({
                    x: centerX + outerRadius * Math.cos(angle),
                    y: centerY + outerRadius * Math.sin(angle)
                });
            }

            for (var i = 0; i < positions.length; i++) {
                var circle = doc.pathItems.ellipse(
                    positions[i].y + smallRadius,  // top
                    positions[i].x - smallRadius,  // left
                    smallRadius * 2,               // width
                    smallRadius * 2                // height
                );
                circle.filled = false;
                circle.stroked = true;
                circle.strokeColor = greenColor;
                circle.strokeWidth = 0.5; // 0.5pt de contour
                circle.move(group, ElementPlacement.PLACEATEND);
            }

            return group;
        }

        /**
         * Crée un trou d'évacuation (cercle noir de 4mm)
         */
        function createEvacuation(doc, centerX, centerY) {
            var radius = mmToPoints(EVACUATION_DIAMETER / 2);

            // Couleur noire pour les évacuations
            var blackColor = new CMYKColor();
            blackColor.cyan = 0;
            blackColor.magenta = 0;
            blackColor.yellow = 0;
            blackColor.black = 100;

            var circle = doc.pathItems.ellipse(
                centerY + radius,   // top
                centerX - radius,   // left
                radius * 2,         // width
                radius * 2          // height
            );
            circle.filled = false;
            circle.stroked = true;
            circle.strokeColor = blackColor;
            circle.strokeWidth = 0.5; // 0.5pt de contour

            return circle;
        }

        /**
         * Algorithme de Ray Casting pour tester si un point est à l'intérieur d'un polygone
         * Compte le nombre d'intersections d'un rayon horizontal avec les segments du tracé
         */
        function isPointInsidePath(pathPoints, testX, testY) {
            var inside = false;
            var n = pathPoints.length;

            for (var i = 0, j = n - 1; i < n; j = i++) {
                var xi = pathPoints[i].x;
                var yi = pathPoints[i].y;
                var xj = pathPoints[j].x;
                var yj = pathPoints[j].y;

                if (((yi > testY) !== (yj > testY)) &&
                    (testX < (xj - xi) * (testY - yi) / (yj - yi) + xi)) {
                    inside = !inside;
                }
            }

            return inside;
        }

        /**
         * Calcule un point sur une courbe de Bézier cubique
         */
        function bezierPoint(t, p0, p1, p2, p3) {
            var u = 1 - t;
            var tt = t * t;
            var uu = u * u;
            var uuu = uu * u;
            var ttt = tt * t;

            return {
                x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
                y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
            };
        }

        /**
         * Extrait les points d'un PathItem en échantillonnant les courbes de Bézier
         * pour une meilleure précision avec les formes courbes (O, Q, G, etc.)
         */
        function extractPathPoints(pathItem) {
            var points = [];
            var samplesPerSegment = 8; // Nombre de points par segment de courbe

            function extractFromPath(path) {
                var pathPoints = path.pathPoints;
                var n = pathPoints.length;

                for (var i = 0; i < n; i++) {
                    var current = pathPoints[i];
                    var next = pathPoints[(i + 1) % n];

                    var p0 = { x: current.anchor[0], y: current.anchor[1] };
                    var p1 = { x: current.rightDirection[0], y: current.rightDirection[1] };
                    var p2 = { x: next.leftDirection[0], y: next.leftDirection[1] };
                    var p3 = { x: next.anchor[0], y: next.anchor[1] };

                    // Échantillonner la courbe de Bézier
                    for (var s = 0; s < samplesPerSegment; s++) {
                        var t = s / samplesPerSegment;
                        points.push(bezierPoint(t, p0, p1, p2, p3));
                    }
                }
            }

            if (pathItem.typename === "PathItem") {
                extractFromPath(pathItem);
            } else if (pathItem.typename === "CompoundPathItem") {
                // Pour un CompoundPath, on prend le tracé externe (le plus grand)
                var largestPath = null;
                var largestArea = 0;

                for (var i = 0; i < pathItem.pathItems.length; i++) {
                    var subPath = pathItem.pathItems[i];
                    var bounds = subPath.geometricBounds;
                    var area = (bounds[2] - bounds[0]) * (bounds[1] - bounds[3]);
                    if (area > largestArea) {
                        largestArea = area;
                        largestPath = subPath;
                    }
                }

                if (largestPath) {
                    extractFromPath(largestPath);
                }
            }

            return points;
        }

        /**
         * Extrait tous les tracés internes (trous) d'un CompoundPath
         * avec échantillonnage des courbes de Bézier
         */
        function extractHolePaths(pathItem) {
            var holes = [];
            var samplesPerSegment = 8;

            function extractFromPath(path) {
                var points = [];
                var pathPoints = path.pathPoints;
                var n = pathPoints.length;

                for (var i = 0; i < n; i++) {
                    var current = pathPoints[i];
                    var next = pathPoints[(i + 1) % n];

                    var p0 = { x: current.anchor[0], y: current.anchor[1] };
                    var p1 = { x: current.rightDirection[0], y: current.rightDirection[1] };
                    var p2 = { x: next.leftDirection[0], y: next.leftDirection[1] };
                    var p3 = { x: next.anchor[0], y: next.anchor[1] };

                    for (var s = 0; s < samplesPerSegment; s++) {
                        var t = s / samplesPerSegment;
                        points.push(bezierPoint(t, p0, p1, p2, p3));
                    }
                }
                return points;
            }

            if (pathItem.typename === "CompoundPathItem") {
                var largestArea = 0;
                var largestIndex = -1;

                // Trouver le tracé externe (le plus grand)
                for (var i = 0; i < pathItem.pathItems.length; i++) {
                    var subPath = pathItem.pathItems[i];
                    var bounds = subPath.geometricBounds;
                    var area = (bounds[2] - bounds[0]) * (bounds[1] - bounds[3]);
                    if (area > largestArea) {
                        largestArea = area;
                        largestIndex = i;
                    }
                }

                // Extraire les points de tous les tracés sauf le plus grand (les trous)
                for (var i = 0; i < pathItem.pathItems.length; i++) {
                    if (i !== largestIndex) {
                        var subPath = pathItem.pathItems[i];
                        holes.push(extractFromPath(subPath));
                    }
                }
            }

            return holes;
        }

        /**
         * Teste si un point est dans la matière (à l'intérieur du tracé externe mais pas dans un trou)
         */
        function isPointInSolidArea(pathItem, testX, testY) {
            var outerPoints = extractPathPoints(pathItem);

            // D'abord vérifier si le point est dans le tracé externe
            if (!isPointInsidePath(outerPoints, testX, testY)) {
                return false;
            }

            // Ensuite vérifier que le point n'est pas dans un trou
            var holes = extractHolePaths(pathItem);
            for (var h = 0; h < holes.length; h++) {
                if (isPointInsidePath(holes[h], testX, testY)) {
                    return false; // Le point est dans un trou
                }
            }

            return true;
        }

        /**
         * Scanne une ligne horizontale et retourne les segments de matière
         * Retourne un tableau de { left, right, width, centerX } pour chaque segment solide
         */
        function scanHorizontalLine(pathItem, y, bounds) {
            var left = bounds[0];
            var right = bounds[2];
            var segments = [];
            var step = mmToPoints(1); // Échantillonner tous les 1mm pour plus de précision

            var inSolid = false;
            var segmentStart = 0;

            for (var x = left; x <= right; x += step) {
                var isSolid = isPointInSolidArea(pathItem, x, y);

                if (isSolid && !inSolid) {
                    // Début d'un segment solide
                    segmentStart = x;
                    inSolid = true;
                } else if (!isSolid && inSolid) {
                    // Fin d'un segment solide
                    var segWidth = (x - step) - segmentStart;
                    segments.push({
                        left: segmentStart,
                        right: x - step,
                        width: segWidth,
                        centerX: segmentStart + (segWidth / 2)
                    });
                    inSolid = false;
                }
            }

            // Fermer le dernier segment si on est encore dans du solide
            if (inSolid) {
                var segWidth = right - segmentStart;
                segments.push({
                    left: segmentStart,
                    right: right,
                    width: segWidth,
                    centerX: segmentStart + (segWidth / 2)
                });
            }

            return segments;
        }

        /**
         * Trouve la meilleure position pour une aération dans un segment
         * en s'assurant d'avoir assez de marge depuis les bords
         */
        function findBestAerationPosition(segment, aerationGroupWidth) {
            var margin = mmToPoints(MARGIN_FROM_EDGE_MM);
            var minRequired = (2 * margin) + aerationGroupWidth;

            if (segment.width < minRequired) {
                // Pas assez de place avec les marges, mais on place quand même au centre
                // si le segment est assez large pour le groupe lui-même
                if (segment.width >= aerationGroupWidth) {
                    return segment.centerX;
                }
                return null;
            }

            // Centrer l'aération dans le segment avec les marges
            return segment.centerX;
        }

        /**
         * Analyse un tracé et trouve les positions optimales pour les aérations et évacuations
         * en scannant réellement l'intérieur de la forme
         */
        function analyzePathForPlacements(pathItem) {
            var bounds = pathItem.geometricBounds; // [left, top, right, bottom]
            var left = bounds[0];
            var top = bounds[1];
            var right = bounds[2];
            var bottom = bounds[3];

            var height = top - bottom;
            var aerationGroupWidth = mmToPoints(AERATION_GROUP_WIDTH);
            var minSolidWidth = mmToPoints(MIN_SOLID_WIDTH_MM);

            var result = {
                aerations: [],
                evacuation: null
            };

            // === TROUVER LA POSITION DES AÉRATIONS (tiers supérieur) ===
            // Scanner à environ 25-30% depuis le haut
            var scanY = top - (height * 0.27);
            var topSegments = scanHorizontalLine(pathItem, scanY, bounds);

            // Filtrer les segments assez larges pour une aération
            var validSegments = [];
            for (var s = 0; s < topSegments.length; s++) {
                if (topSegments[s].width >= minSolidWidth) {
                    validSegments.push(topSegments[s]);
                }
            }

            // Placer une aération par segment valide (centré dans chaque segment)
            for (var v = 0; v < validSegments.length; v++) {
                var seg = validSegments[v];
                var aerX = findBestAerationPosition(seg, aerationGroupWidth);
                if (aerX !== null) {
                    result.aerations.push({
                        x: aerX,
                        y: scanY
                    });
                }
            }

            // Si aucune aération n'a pu être placée, essayer avec le segment le plus large
            if (result.aerations.length === 0 && topSegments.length > 0) {
                // Trouver le segment le plus large
                var widestSegment = topSegments[0];
                for (var w = 1; w < topSegments.length; w++) {
                    if (topSegments[w].width > widestSegment.width) {
                        widestSegment = topSegments[w];
                    }
                }
                // Placer l'aération au centre de ce segment
                result.aerations.push({
                    x: widestSegment.centerX,
                    y: scanY
                });
            }

            // === TROUVER LA POSITION DE L'ÉVACUATION (bas de la lettre) ===
            // L'évacuation doit être à exactement 3mm du bord inférieur
            var evacuationMargin = mmToPoints(3); // 3mm du bord
            var evacuationRadius = mmToPoints(EVACUATION_DIAMETER / 2);

            // Scanner à 3mm + rayon du trou depuis le bas pour trouver où placer le centre
            var evacuationScanY = bottom + evacuationMargin + evacuationRadius;
            var bottomSegments = scanHorizontalLine(pathItem, evacuationScanY, bounds);

            // Si pas de segment trouvé à cette hauteur, essayer un peu plus haut
            if (bottomSegments.length === 0) {
                evacuationScanY = bottom + mmToPoints(8);
                bottomSegments = scanHorizontalLine(pathItem, evacuationScanY, bounds);
            }

            if (bottomSegments.length > 0) {
                // Trouver le segment le plus large en bas
                var widestBottomSegment = bottomSegments[0];
                for (var b = 1; b < bottomSegments.length; b++) {
                    if (bottomSegments[b].width > widestBottomSegment.width) {
                        widestBottomSegment = bottomSegments[b];
                    }
                }

                result.evacuation = {
                    x: widestBottomSegment.centerX,
                    y: evacuationScanY
                };
            } else {
                // Dernier recours : centrer horizontalement
                result.evacuation = {
                    x: left + (right - left) / 2,
                    y: bottom + evacuationMargin + evacuationRadius
                };
            }

            return result;
        }

        /**
         * Collecte tous les tracés fermés du document (PathItems et CompoundPathItems)
         */
        function collectAllClosedPaths(doc) {
            var paths = [];

            // Fonction récursive pour parcourir les groupes
            function collectFromItem(item) {
                if (item.typename === "PathItem") {
                    if (item.closed && !item.guides) {
                        paths.push(item);
                    }
                } else if (item.typename === "CompoundPathItem") {
                    // Pour les CompoundPath, on prend le compound lui-même
                    paths.push(item);
                } else if (item.typename === "GroupItem") {
                    for (var i = 0; i < item.pageItems.length; i++) {
                        collectFromItem(item.pageItems[i]);
                    }
                }
            }

            // Parcourir tous les calques
            for (var l = 0; l < doc.layers.length; l++) {
                var layer = doc.layers[l];
                if (!layer.locked && layer.visible) {
                    for (var i = 0; i < layer.pageItems.length; i++) {
                        collectFromItem(layer.pageItems[i]);
                    }
                }
            }

            return paths;
        }

        /**
         * Sauvegarde le document actuel en PDF
         */
        function saveAsPDF(doc, filePath) {
            var pdfOptions = new PDFSaveOptions();
            pdfOptions.compatibility = PDFCompatibility.ACROBAT7;
            pdfOptions.preserveEditability = true;
            pdfOptions.generateThumbnails = true;

            var file = new File(filePath);
            doc.saveAs(file, pdfOptions);
        }

        /**
         * Ajuste le plan de travail pour englober tous les éléments avec une marge
         */
        function adjustArtboardToContent(doc, marginMM) {
            var margin = mmToPoints(marginMM);

            // Calculer les bounds de tous les éléments visibles
            var minX = Infinity, minY = Infinity;
            var maxX = -Infinity, maxY = -Infinity;

            for (var i = 0; i < doc.pageItems.length; i++) {
                var item = doc.pageItems[i];
                if (item.hidden || item.guides) continue;

                var bounds = item.geometricBounds; // [left, top, right, bottom]
                if (bounds[0] < minX) minX = bounds[0];
                if (bounds[1] > maxY) maxY = bounds[1]; // top est plus grand en Y
                if (bounds[2] > maxX) maxX = bounds[2];
                if (bounds[3] < minY) minY = bounds[3]; // bottom est plus petit en Y
            }

            // Appliquer la marge
            minX -= margin;
            minY -= margin;
            maxX += margin;
            maxY += margin;

            // Ajuster le premier plan de travail
            if (doc.artboards.length > 0) {
                var artboard = doc.artboards[0];
                artboard.artboardRect = [minX, maxY, maxX, minY]; // [left, top, right, bottom]
            }
        }

        // ===== PROCESSUS PRINCIPAL =====

        // 1. Sauvegarder l'état original
        var originalDocPath = doc.fullName;

        // 2. Ajuster le plan de travail avec une marge de 20mm autour du contenu
        adjustArtboardToContent(doc, 20);

        // 3. GÉNÉRER LE FICHIER TRANCHES (copie simple)
        var tranchesPath = params.destinationPath + "/" + baseNameTranches + ".pdf";
        saveAsPDF(doc, tranchesPath);

        // 3. GÉNÉRER LE FICHIER PLEXI (copie simple avec nom différent)
        var plexiPath = params.destinationPath + "/" + baseNamePlexi + ".pdf";
        saveAsPDF(doc, plexiPath);

        // 4. GÉNÉRER LE FICHIER SEMELLES (avec aérations et évacuations)
        // Collecter tous les tracés fermés
        var closedPaths = collectAllClosedPaths(doc);

        if (closedPaths.length === 0) {
            throw new Error("Aucun tracé fermé trouvé dans le document.\n\nAssurez-vous que votre fichier contient des lettres vectorielles avec des tracés fermés.");
        }

        // Créer un calque pour les aérations et évacuations
        var aerationLayer;
        try {
            aerationLayer = doc.layers.getByName("Aerations_Evacuations");
        } catch (e) {
            aerationLayer = doc.layers.add();
            aerationLayer.name = "Aerations_Evacuations";
        }

        // Pour chaque tracé fermé, ajouter les aérations et évacuations
        var aerationsCreated = 0;
        var evacuationsCreated = 0;

        for (var p = 0; p < closedPaths.length; p++) {
            var pathItem = closedPaths[p];
            var placements = analyzePathForPlacements(pathItem);

            // Créer les aérations
            for (var a = 0; a < placements.aerations.length; a++) {
                var aerPos = placements.aerations[a];
                var aerGroup = createAerationGroup(doc, aerPos.x, aerPos.y);
                aerGroup.move(aerationLayer, ElementPlacement.PLACEATEND);
                aerationsCreated++;
            }

            // Créer l'évacuation
            if (placements.evacuation) {
                var evacCircle = createEvacuation(doc, placements.evacuation.x, placements.evacuation.y);
                evacCircle.move(aerationLayer, ElementPlacement.PLACEATEND);
                evacuationsCreated++;
            }
        }

        // Sauvegarder le fichier Semelles
        var semellesPath = params.destinationPath + "/" + baseNameSemelles + ".pdf";
        saveAsPDF(doc, semellesPath);

        // 5. NE PAS supprimer le calque d'aérations pour que l'utilisateur puisse vérifier
        // Le fichier reste ouvert avec les aérations/évacuations visibles pour contrôle

        // ===== RÉSUMÉ =====
        var summary = "GENERATION TERMINEE !\n\n";
        summary += "===================================\n\n";
        summary += "Fichiers crees :\n\n";
        summary += "1. TRANCHES\n   " + baseNameTranches + ".pdf\n\n";
        summary += "2. SEMELLES\n   " + baseNameSemelles + ".pdf\n";
        summary += "   -> " + aerationsCreated + " groupe(s) d'aeration (6 trous chacun)\n";
        summary += "   -> " + evacuationsCreated + " evacuation(s)\n\n";
        summary += "3. PLEXI\n   " + baseNamePlexi + ".pdf\n\n";
        summary += "===================================\n\n";
        summary += "Destination :\n" + params.destinationPath + "\n\n";
        summary += "Le document actuel affiche les aerations\n";
        summary += "et evacuations pour verification.\n\n";
        summary += "VERIFICATION RECOMMANDEE :\n";
        summary += "- Controler le positionnement des aerations\n";
        summary += "- Verifier les evacuations (3mm du bord bas)";

        alert(summary);

        return {
            success: true,
            message: "Génération terminée",
            files: {
                tranches: tranchesPath,
                semelles: semellesPath,
                plexi: plexiPath
            },
            stats: {
                paths: closedPaths.length,
                aerations: aerationsCreated,
                evacuations: evacuationsCreated
            }
        };

    } catch (error) {
        alert("Erreur : " + error.message);
        return { success: false, error: error.message };
    }
})(params);
