// ============================================================
// GraphiDesk FabRik — Script de CALIBRATION entretoises
// ============================================================
// Usage : ouvrir un fichier de prod existant (avec cercles
// d'entretoises ENTIERS, non pathfindés) dans Illustrator,
// puis Fichier > Scripts > Autre script... > ce fichier.
//
// Le script mesure les placements faits main et écrit un
// rapport .txt sur le Bureau. Envoyer le contenu à Claude
// pour calibrer le rayon de couverture par défaut.
//
// Fichiers 1:1 attendus (unités converties en mm).
// ============================================================

(function () {
    var PT_PER_MM = 2.83465;

    function ptToMm(pt) {
        return pt / PT_PER_MM;
    }

    function round1(n) {
        return Math.round(n * 10) / 10;
    }

    try {
        if (!app || app.documents.length === 0) {
            alert("Ouvre d'abord un fichier de prod dans Illustrator.");
            return;
        }

        var doc = app.activeDocument;

        // ----------------------------------------------------
        // 1. Classer les tracés : cercles (entretoises) vs formes (lettres)
        // ----------------------------------------------------
        var circles = []; // { cx, cy, d }  en mm
        var shapes = [];  // { left, top, right, bottom, w, h, path } en mm

        var MIN_CIRCLE_MM = 4;
        var MAX_CIRCLE_MM = 30;
        var MIN_SHAPE_MM = 40;

        for (var i = 0; i < doc.pathItems.length; i++) {
            var p = doc.pathItems[i];
            if (p.hidden || p.guides) continue;
            if (!p.closed) continue;

            var gb = p.geometricBounds; // [left, top, right, bottom] en pt
            var w = ptToMm(gb[2] - gb[0]);
            var h = ptToMm(gb[1] - gb[3]);
            if (w <= 0 || h <= 0) continue;

            var ratioDiff = Math.abs(w - h) / Math.max(w, h);

            if (w >= MIN_CIRCLE_MM && w <= MAX_CIRCLE_MM &&
                h >= MIN_CIRCLE_MM && h <= MAX_CIRCLE_MM &&
                ratioDiff <= 0.15) {
                circles.push({
                    cx: ptToMm((gb[0] + gb[2]) / 2),
                    cy: ptToMm((gb[1] + gb[3]) / 2),
                    d: (w + h) / 2
                });
            } else if (w >= MIN_SHAPE_MM || h >= MIN_SHAPE_MM) {
                shapes.push({
                    left: ptToMm(gb[0]),
                    top: ptToMm(gb[1]),
                    right: ptToMm(gb[2]),
                    bottom: ptToMm(gb[3]),
                    w: w,
                    h: h,
                    path: p,
                    circles: []
                });
            }
        }

        if (circles.length === 0) {
            alert("Aucun cercle d'entretoise détecté (cercles entiers de 4 à 30mm).\n" +
                  "Ce fichier a peut-être des entretoises déjà pathfindées (encoches) :\n" +
                  "utiliser un fichier où les cercles sont encore entiers (ex : Amedeo).");
            return;
        }

        // ----------------------------------------------------
        // 2. Assigner chaque cercle à la plus petite forme qui le contient (bbox)
        // ----------------------------------------------------
        for (var c = 0; c < circles.length; c++) {
            var circ = circles[c];
            var best = -1;
            var bestArea = -1;
            for (var s = 0; s < shapes.length; s++) {
                var sh = shapes[s];
                if (circ.cx >= sh.left && circ.cx <= sh.right &&
                    circ.cy <= sh.top && circ.cy >= sh.bottom) {
                    var area = sh.w * sh.h;
                    if (best === -1 || area < bestArea) {
                        best = s;
                        bestArea = area;
                    }
                }
            }
            if (best >= 0) {
                shapes[best].circles.push(circ);
            }
        }

        // ----------------------------------------------------
        // 3. Mesures par forme
        // ----------------------------------------------------
        var report = "CALIBRATION ENTRETOISES — " + doc.name + "\n";
        report += "==================================================\n\n";
        report += "Cercles detectes : " + circles.length + "\n";

        // Diamètres
        var dMin = 9999, dMax = 0, dSum = 0;
        for (var c2 = 0; c2 < circles.length; c2++) {
            var dd = circles[c2].d;
            if (dd < dMin) dMin = dd;
            if (dd > dMax) dMax = dd;
            dSum += dd;
        }
        report += "Diametre : min " + round1(dMin) + "mm / max " + round1(dMax) +
                  "mm / moyen " + round1(dSum / circles.length) + "mm\n\n";

        var allNearest = [];
        var allCoverage = [];

        for (var s2 = 0; s2 < shapes.length; s2++) {
            var sh2 = shapes[s2];
            if (sh2.circles.length === 0) continue;

            report += "--- Forme " + (s2 + 1) + " : " + round1(sh2.w) + " x " +
                      round1(sh2.h) + "mm, " + sh2.circles.length + " entretoise(s)\n";

            // 3a. Distance au plus proche voisin (entre centres, dans la même forme)
            for (var a = 0; a < sh2.circles.length; a++) {
                var nearest = -1;
                for (var b = 0; b < sh2.circles.length; b++) {
                    if (a === b) continue;
                    var dx = sh2.circles[a].cx - sh2.circles[b].cx;
                    var dy = sh2.circles[a].cy - sh2.circles[b].cy;
                    var dist = Math.sqrt(dx * dx + dy * dy);
                    if (nearest === -1 || dist < nearest) nearest = dist;
                }
                if (nearest > 0) allNearest.push(nearest);
            }

            // 3b. Couverture : distance max entre un point du contour et
            //     l'entretoise la plus proche (approx par les points d'ancrage
            //     + milieux de segments)
            var samples = [];
            try {
                var pts = sh2.path.pathPoints;
                for (var q = 0; q < pts.length; q++) {
                    var an = pts[q].anchor;
                    samples.push([ptToMm(an[0]), ptToMm(an[1])]);
                    var nxt = pts[(q + 1) % pts.length].anchor;
                    samples.push([ptToMm((an[0] + nxt[0]) / 2), ptToMm((an[1] + nxt[1]) / 2)]);
                }
            } catch (e) {}

            var covMax = 0;
            for (var m = 0; m < samples.length; m++) {
                var minD = -1;
                for (var n = 0; n < sh2.circles.length; n++) {
                    var ddx = samples[m][0] - sh2.circles[n].cx;
                    var ddy = samples[m][1] - sh2.circles[n].cy;
                    var d2 = Math.sqrt(ddx * ddx + ddy * ddy);
                    if (minD === -1 || d2 < minD) minD = d2;
                }
                if (minD > covMax) covMax = minD;
            }
            if (covMax > 0) {
                allCoverage.push(covMax);
                report += "    Couverture max (contour -> entretoise) : " + round1(covMax) + "mm\n";
            }
        }

        // ----------------------------------------------------
        // 4. Stats globales
        // ----------------------------------------------------
        report += "\n=== STATS GLOBALES ===\n";

        if (allNearest.length > 0) {
            var nMin = 9999, nMax = 0, nSum = 0;
            for (var v = 0; v < allNearest.length; v++) {
                if (allNearest[v] < nMin) nMin = allNearest[v];
                if (allNearest[v] > nMax) nMax = allNearest[v];
                nSum += allNearest[v];
            }
            report += "Espacement plus proche voisin : min " + round1(nMin) +
                      "mm / max " + round1(nMax) + "mm / moyen " +
                      round1(nSum / allNearest.length) + "mm\n";
        }

        if (allCoverage.length > 0) {
            var cMax = 0, cSum = 0;
            for (var v2 = 0; v2 < allCoverage.length; v2++) {
                if (allCoverage[v2] > cMax) cMax = allCoverage[v2];
                cSum += allCoverage[v2];
            }
            report += "Rayon de couverture observe : max " + round1(cMax) +
                      "mm / moyen " + round1(cSum / allCoverage.length) + "mm\n";
            report += ">>> Le rayon de couverture X du placement auto doit etre >= au max observe.\n";
        }

        // ----------------------------------------------------
        // 5. Écrire le rapport sur le Bureau
        // ----------------------------------------------------
        var safeName = doc.name.replace(/[^a-zA-Z0-9_-]/g, "_");
        var outFile = new File(Folder.desktop + "/calibration_" + safeName + ".txt");
        outFile.encoding = "UTF-8";
        outFile.open("w");
        outFile.write(report);
        outFile.close();

        alert("Calibration terminee !\n\n" +
              circles.length + " entretoises mesurees.\n\n" +
              "Rapport ecrit sur le Bureau :\n" + outFile.fsName +
              "\n\nEnvoyer le contenu du rapport a Claude.");

    } catch (err) {
        alert("Erreur calibration : " + err.message);
    }
})();
