// ============================================================
// relief3d_export_lisses.jsx — relevé des lisses dessinées
// ============================================================
// params : { origX, origY, sf }  (repère renvoyé par l'export des lettres)
//
// Le graphiste sélectionne SES lisses dans sa maquette (aucune convention
// de calque à respecter) : on relève, pour chacune, son centre, sa
// longueur, son épaisseur et son inclinaison, exprimés dans le repère des
// lettres (mm, origine coin haut-gauche, y vers le bas).
//
// Les lisses étant des barres, on cherche l'arête la plus longue du tracé :
// elle donne la direction ; la dimension perpendiculaire donne l'épaisseur.
// Le document du graphiste n'est jamais modifié.
//
// Sortie : <temp>/graphidesk_3d/lisses.json

(function (params) {
    var DIR = Folder.temp + "/graphidesk_3d";
    var MM = 2.834645669;

    function ecrire(txt) {
        var d = new Folder(DIR);
        if (!d.exists) d.create();
        // écriture en deux temps : GraphiDesk ne doit jamais lire un fichier
        // à moitié écrit (voir relief3d_export_selection.jsx)
        var tmp = new File(DIR + "/lisses.json.tmp");
        tmp.encoding = "UTF-8"; tmp.open("w"); tmp.write(txt); tmp.close();
        var cible = new File(DIR + "/lisses.json");
        if (cible.exists) cible.remove();
        tmp.rename(cible.name);
    }

    try { var o = new File(DIR + "/lisses.json"); if (o.exists) o.remove(); } catch (e0) {}

    try {
        if (app.documents.length === 0) throw new Error("Aucun document ouvert.");
        var doc = app.activeDocument;
        if (!doc.selection || doc.selection.length === 0) {
            throw new Error("Sélectionne d'abord tes lisses dans la maquette.");
        }
        // Repère des lettres : on le relit sur le disque (meta.json écrit
        // par l'export des lettres) plutôt que de dépendre de ce que
        // l'application a transmis — sinon un ancien relevé décalerait
        // toutes les lisses sans que personne comprenne pourquoi.
        var origX = 0, origY = 0, sf = 1, lu = false;
        try {
            var fm = new File(DIR + "/meta.json");
            if (fm.exists) {
                fm.encoding = "UTF-8"; fm.open("r");
                var txt = fm.read(); fm.close();
                var mX = txt.match(/"origX"\s*:\s*(-?[0-9.]+)/);
                var mY = txt.match(/"origY"\s*:\s*(-?[0-9.]+)/);
                var mS = txt.match(/"sf"\s*:\s*([0-9.]+)/);
                if (mX && mY) {
                    origX = parseFloat(mX[1]);
                    origY = parseFloat(mY[1]);
                    if (mS) sf = parseFloat(mS[1]);
                    lu = true;
                }
            }
        } catch (eM) {}
        if (!lu) {
            if (params && typeof params.origX === "number") {
                origX = params.origX; origY = params.origY; sf = params.sf || 1;
            } else {
                throw new Error("Récupère d'abord ton enseigne (le repère des lettres est manquant).");
            }
        }

        // Une sélection contient souvent des GROUPES : sans descendre dedans,
        // on relèverait la boîte englobante du groupe entier — c'est ce qui
        // produisait une seule barre grise énorme. On aplatit donc d'abord.
        var sel = [];
        function aplatir(item, profondeur) {
            if (profondeur > 8) return;
            try {
                if (item.typename === "GroupItem") {
                    for (var g = 0; g < item.pageItems.length; g++) {
                        aplatir(item.pageItems[g], profondeur + 1);
                    }
                } else if (item.typename === "CompoundPathItem") {
                    for (var c = 0; c < item.pathItems.length; c++) {
                        aplatir(item.pathItems[c], profondeur + 1);
                    }
                } else {
                    sel.push(item);
                }
            } catch (eA) {}
        }
        for (var s = 0; s < doc.selection.length; s++) aplatir(doc.selection[s], 0);

        var out = [];
        for (var i = 0; i < sel.length; i++) {
            try {
                var it = sel[i];
                var pts = [];
                if (it.typename === "PathItem" && it.pathPoints.length >= 3) {
                    for (var p = 0; p < it.pathPoints.length; p++) {
                        var a = it.pathPoints[p].anchor;
                        pts.push([a[0], a[1]]);
                    }
                }
                var cx, cy, longueur, epaisseur, angle;
                if (pts.length >= 3) {
                    // arête la plus longue = direction de la barre
                    var best = -1, bi = 0;
                    for (var e = 0; e < pts.length; e++) {
                        var q = pts[(e + 1) % pts.length];
                        var dx = q[0] - pts[e][0], dy = q[1] - pts[e][1];
                        var d2 = dx * dx + dy * dy;
                        if (d2 > best) { best = d2; bi = e; }
                    }
                    var q2 = pts[(bi + 1) % pts.length];
                    var vx = q2[0] - pts[bi][0], vy = q2[1] - pts[bi][1];
                    var norme = Math.sqrt(vx * vx + vy * vy);
                    if (norme < 1e-6) continue;
                    vx /= norme; vy /= norme;
                    // étendue le long de la barre et perpendiculairement
                    var uMin = 1e12, uMax = -1e12, wMin = 1e12, wMax = -1e12;
                    for (var k = 0; k < pts.length; k++) {
                        var u = pts[k][0] * vx + pts[k][1] * vy;
                        var w = -pts[k][0] * vy + pts[k][1] * vx;
                        if (u < uMin) uMin = u; if (u > uMax) uMax = u;
                        if (w < wMin) wMin = w; if (w > wMax) wMax = w;
                    }
                    longueur = uMax - uMin;
                    epaisseur = wMax - wMin;
                    var uc = (uMin + uMax) / 2, wc = (wMin + wMax) / 2;
                    cx = uc * vx - wc * vy;
                    cy = uc * vy + wc * vx;
                    // repère Illustrator : y vers le HAUT → angle inversé
                    angle = -Math.atan2(vy, vx) * 180 / Math.PI;
                    if (angle > 90) angle -= 180;
                    if (angle < -90) angle += 180;
                } else {
                    // repli : boîte englobante (barre horizontale)
                    var b = it.visibleBounds; // [g, h, d, b]
                    cx = (b[0] + b[2]) / 2;
                    cy = (b[1] + b[3]) / 2;
                    longueur = b[2] - b[0];
                    epaisseur = b[1] - b[3];
                    angle = 0;
                }

                out.push('{"xMm":' + (((cx - origX) * sf) / MM).toFixed(2) +
                    ',"yMm":' + (((origY - cy) * sf) / MM).toFixed(2) +
                    ',"longueurMm":' + ((longueur * sf) / MM).toFixed(2) +
                    ',"epaisseurMm":' + ((epaisseur * sf) / MM).toFixed(2) +
                    ',"angleDeg":' + angle.toFixed(2) + '}');
            } catch (eI) {}
        }

        if (out.length === 0) throw new Error("Aucune barre exploitable dans la sélection.");
        ecrire('{"lisses":[' + out.join(",") + ']}');
    } catch (eG) {
        ecrire('{"erreur":"' + String(eG.message ? eG.message : eG).replace(/"/g, "'") + '"}');
    }
})(params);
