// ============================================================
// GraphiDesk FabRik \u2014 Lettres r\u00e9tro\u00e9clair\u00e9es sur entretoises (process V2 \u00ab rainure LED \u00bb, B\u00caTA)
// ============================================================
// Le calcul se fait dans GraphiDesk (src/lib/fabrik/retro/), pas ici. Ce script rel\u00e8ve les trac\u00e9s, attend la r\u00e9ponse
// de GraphiDesk en affichant une barre de progression, puis dessine. Dialogue par fichiers du dossier temporaire :
//   ici \u2192 graphidesk_retro_geometrie.json   GraphiDesk \u2192 graphidesk_retro_progression.json / graphidesk_retro_resultat.json
//   ici \u2192 graphidesk_retro_fin.json
//
// params.etape :
//   "placer"    : la d\u00e9coupe (s\u00e9lection, sinon calque DECOUPE, sinon tout le document) passe sur le calque DECOUPE (rose) ;
//                 GraphiDesk calcule la rainure ENTI\u00c8RE (calque Rainure LED, vert) et les entretoises (calque Entretoises,
//                 cercles bleus LIBRES : rien n'est fusionn\u00e9, on peut les d\u00e9placer, en ajouter, en supprimer).
//   "finaliser" : relit les entretoises telles qu'elles sont (apr\u00e8s retouche) ; l\u00e0 o\u00f9 une entretoise touche la rainure, la
//                 rainure s'arr\u00eate 1 mm avant ; v\u00e9rifie ; g\u00e9n\u00e8re le PDP (vue de face, noir) \u00e0 partir de CES entretoises.
//                 La rainure enti\u00e8re est gard\u00e9e sur un calque cach\u00e9 : on peut re-d\u00e9placer et re-finaliser autant de fois
//                 qu'on veut.
// Le trac\u00e9 de d\u00e9coupe n'est jamais modifi\u00e9 (seulement recolor\u00e9 en rose).
// ============================================================
(function (params) {
    var FICHIER_GEO = "graphidesk_retro_geometrie.json";
    var FICHIER_PROGRESSION = "graphidesk_retro_progression.json";
    var FICHIER_RESULTAT = "graphidesk_retro_resultat.json";
    var FICHIER_FIN = "graphidesk_retro_fin.json";
    var SILENCE_MAX = 30000, ATTENTE_MAX = 300000;

    // noms des calques (Jordan, 17/11/2026), du haut vers le bas
    var L_DECOUPE = "D\u00e9coupe", L_RAINURE = "Rainure LED", L_ENTRETOISES = "Entretoises";
    var L_ETROIT = "Zone inf\u00e9rieure au minimum";
    var L_ENTIERE = "Rainure enti\u00e8re (ne pas toucher)", L_VERIF = "A v\u00e9rifier (\u00e0 supprimer)";
    var NOTRES = [L_DECOUPE, L_RAINURE, L_ENTRETOISES, L_ENTIERE, L_VERIF, L_ETROIT];

    var etape = String(params.etape || "");
    var jeton = String(params.jeton || "");
    var P = params.parametres || {};
    var PDP = params.pdp || {};
    var MM = 72 / 25.4;
    var geoEcrit = false;

    // ---------- utilitaires ----------
    function ecrire(nom, texte) {
        var tmp = new File(Folder.temp + "/" + nom + ".tmp");
        tmp.encoding = "UTF-8"; tmp.open("w"); tmp.write(texte); tmp.close();
        var cible = new File(Folder.temp + "/" + nom);
        if (cible.exists) cible.remove();
        tmp.rename(nom);
    }
    function chaine(s) {
        s = String(s);
        var r = "", i, c, n;
        for (i = 0; i < s.length; i++) {
            c = s.charAt(i); n = s.charCodeAt(i);
            if (c === "\\") r += "\\\\";
            else if (c === "\"") r += "\\\"";
            else if (n === 10) r += "\\n";
            else if (n === 13) r += "\\r";
            else if (n === 9) r += "\\t";
            else if (n < 32 || n > 126) { var h = n.toString(16); while (h.length < 4) h = "0" + h; r += "\\u" + h; }
            else r += c;
        }
        return "\"" + r + "\"";
    }
    function lireJson(nom) {
        var f = new File(Folder.temp + "/" + nom), texte;
        if (!f.exists) return null;
        try {
            f.encoding = "UTF-8";
            if (!f.open("r")) return null;
            texte = f.read(); f.close();
            if (!texte) return null;
            return eval("(" + texte + ")");                     // ES3 : pas de JSON.parse ; le fichier vient de GraphiDesk
        } catch (e) { try { f.close(); } catch (e2) {} return null; }
    }
    function creerBarre() {
        var w = null, libelle = null, jauge = null;
        try {
            w = new Window("palette", "GraphiDesk \u2014 Lettres r\u00e9tro\u00e9clair\u00e9es", undefined, { closeButton: false });
            w.orientation = "column"; w.alignChildren = "fill"; w.margins = 18; w.spacing = 10;
            libelle = w.add("statictext", undefined, "Pr\u00e9paration\u2026");
            libelle.preferredSize.width = 400;
            jauge = w.add("progressbar", undefined, 0, 1000);
            jauge.preferredSize = [400, 14];
            w.center(); w.show(); w.update();
        } catch (e) { w = null; }
        return {
            maj: function (fraction, texte) {
                if (!w) return;
                try {
                    if (texte !== null && texte !== undefined && libelle.text !== texte) libelle.text = texte;
                    if (fraction !== null && fraction !== undefined) jauge.value = Math.round(Math.max(0, Math.min(1, fraction)) * 1000);
                    w.update();
                } catch (e) {}
            },
            fermer: function () { if (w) { try { w.close(); } catch (e) {} w = null; } }
        };
    }
    var barre = { maj: function () {}, fermer: function () {} };
    function n3(v) { return String(Math.round(v * 1000) / 1000); }
    function cmjn(c, m, j, n) { var k = new CMYKColor(); k.cyan = c; k.magenta = m; k.yellow = j; k.black = n; return k; }
    var JAUNE = cmjn(0, 25, 100, 0), ROSE = cmjn(0, 100, 0, 0), VERT = cmjn(100, 0, 100, 0), BLEU = cmjn(100, 60, 0, 0), ROUGE = cmjn(0, 100, 100, 0), NOIR = cmjn(0, 0, 0, 100);

    function calque(doc, nom) {
        for (var i = 0; i < doc.layers.length; i++) if (String(doc.layers[i].name) === nom) return doc.layers[i];
        return null;
    }
    function assurerCalque(doc, nom) {
        var l = calque(doc, nom);
        if (!l) { l = doc.layers.add(); l.name = nom; }
        l.locked = false; l.visible = true;
        return l;
    }
    function supprimerCalque(doc, nom) {
        var l = calque(doc, nom);
        if (l) { try { l.locked = false; l.visible = true; l.remove(); } catch (e) {} }
    }
    function vider(l) { for (var i = l.pageItems.length - 1; i >= 0; i--) { try { l.pageItems[i].locked = false; l.pageItems[i].remove(); } catch (e) {} } }
    function estNotre(nom) { for (var i = 0; i < NOTRES.length; i++) if (NOTRES[i] === nom) return true; return false; }
    // tous les trac\u00e9s \u00ab feuilles \u00bb (les sous-trac\u00e9s d'un trac\u00e9 transparent compris)
    function feuilles(conteneur, fn) {
        var items = conteneur.pageItems, i, k, it;
        for (i = 0; i < items.length; i++) {
            it = items[i];
            try {
                if (it.typename === "GroupItem") feuilles(it, fn);
                else if (it.typename === "CompoundPathItem") { for (k = 0; k < it.pathItems.length; k++) fn(it.pathItems[k]); }
                else if (it.typename === "PathItem") fn(it);
            } catch (e) {}
        }
    }
    function contour(conteneur, couleur, epaisseur) {
        feuilles(conteneur, function (p) { p.filled = false; p.stroked = true; p.strokeColor = couleur; p.strokeWidth = epaisseur; });
    }

    // ---------- relev\u00e9 ----------
    // un sous-trac\u00e9 : {"o": n\u00b0 d'objet, "f": ferm\u00e9, "p": [[ancre x,y, poign\u00e9e gauche x,y, poign\u00e9e droite x,y], \u2026]}
    function sousChemin(p, o) {
        var pts = p.pathPoints, n = pts.length, m = [], i, q, a, l, r;
        for (i = 0; i < n; i++) {
            q = pts[i]; a = q.anchor; l = q.leftDirection; r = q.rightDirection;
            m.push("[" + n3(a[0]) + "," + n3(a[1]) + "," + n3(l[0]) + "," + n3(l[1]) + "," + n3(r[0]) + "," + n3(r[1]) + "]");
        }
        return "{\"o\":" + o + ",\"f\":" + (p.closed ? 1 : 0) + ",\"p\":[" + m.join(",") + "]}";
    }
    // chaque trac\u00e9 est un objet ; les sous-trac\u00e9s d'un m\u00eame trac\u00e9 transparent forment UN objet (trous des O, A\u2026)
    function relever(conteneur) {
        var sc = [], objet = 0;
        function creuser(c) {
            var items = c.pageItems, i, k, it;
            for (i = 0; i < items.length; i++) {
                it = items[i];
                try { if (it.hidden || it.guides) continue; } catch (e0) {}
                if (it.typename === "GroupItem") creuser(it);
                else if (it.typename === "PathItem") { if (it.pathPoints.length > 1) sc.push(sousChemin(it, objet++)); }
                else if (it.typename === "CompoundPathItem") {
                    for (k = 0; k < it.pathItems.length; k++) if (it.pathItems[k].pathPoints.length > 1) sc.push(sousChemin(it.pathItems[k], objet));
                    objet++;
                }
            }
        }
        if (conteneur) creuser(conteneur);
        return "[" + sc.join(",") + "]";
    }
    // entretoises : centre et diam\u00e8tre de chaque cercle, d'apr\u00e8s ses ancres (m\u00eame rep\u00e8re que les trac\u00e9s relev\u00e9s)
    function releverEntretoises(l) {
        var out = [];
        feuilles(l, function (p) {
            var pts = p.pathPoints, n = pts.length, sx = 0, sy = 0, i, a, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
            if (n < 2) return;
            for (i = 0; i < n; i++) {
                a = pts[i].anchor; sx += a[0]; sy += a[1];
                if (a[0] < x0) x0 = a[0]; if (a[0] > x1) x1 = a[0]; if (a[1] < y0) y0 = a[1]; if (a[1] > y1) y1 = a[1];
            }
            out.push("{\"x\":" + n3((x0 + x1) / 2) + ",\"y\":" + n3((y0 + y1) / 2) + ",\"d\":" + n3(((x1 - x0) + (y1 - y0)) / 2) + "}");
        });
        return out;
    }

    // ---------- attente de la r\u00e9ponse de GraphiDesk ----------
    function attendreResultat(base) {
        var debut = new Date().getTime(), dernierSigne = debut, vu = -1, battement = -1, maintenant, o;
        while (true) {
            $.sleep(200);
            maintenant = new Date().getTime();
            o = lireJson(FICHIER_RESULTAT);
            if (o && String(o.jeton) === jeton) return o;
            o = lireJson(FICHIER_PROGRESSION);
            if (o && String(o.jeton) === jeton && (o.n !== battement || o.f !== vu)) {
                battement = o.n; if (o.f > vu) vu = o.f; dernierSigne = maintenant;
                barre.maj(base + (0.85 - base) * vu, "Calcul dans GraphiDesk\u2026 " + Math.round(vu * 100) + " %");
            } else barre.maj(null, null);
            if (maintenant - dernierSigne > SILENCE_MAX) throw new Error("GraphiDesk ne r\u00e9pond pas (est-il toujours ouvert ?)");
            if (maintenant - debut > ATTENTE_MAX) throw new Error("le calcul a d\u00e9pass\u00e9 le d\u00e9lai pr\u00e9vu");
        }
    }

    // ---------- dessin ----------
    // anomalies de dessin (formes redessin\u00e9es autrement ou abandonn\u00e9es), rapport\u00e9es dans le message de fin
    var anomalies = [];
    function propres(pts) {                              // points valides, sans doublons cons\u00e9cutifs
        var out = [], i, x, y, d;
        for (i = 0; i < pts.length; i++) {
            x = Number(pts[i][0]); y = Number(pts[i][1]);
            if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) continue;
            if (out.length) { d = out[out.length - 1]; if (Math.abs(d[0] - x) < 0.001 && Math.abs(d[1] - y) < 0.001) continue; }
            out.push([x, y]);
        }
        return out;
    }
    // un anneau dans un trac\u00e9 vide : d'un bloc ; sinon point par point ; sinon all\u00e9g\u00e9 (un point sur deux)
    function remplir(p, pts) {
        var essai = propres(pts), k, q, j, err = "";
        if (essai.length < 2) throw new Error("anneau vide");
        try { p.setEntirePath(essai); return ""; } catch (e1) { err = e1.message; }
        try {
            while (p.pathPoints.length) p.pathPoints[0].remove();
        } catch (e2) {}
        try {
            for (k = 0; k < essai.length; k++) {
                q = p.pathPoints.add();
                q.anchor = essai[k]; q.leftDirection = essai[k]; q.rightDirection = essai[k];
            }
            return "point par point (" + err + ")";
        } catch (e3) { err += " / " + e3.message; }
        for (j = 0; j < 4 && essai.length > 8; j++) {
            var moitie = [];
            for (k = 0; k < essai.length; k += 2) moitie.push(essai[k]);
            essai = moitie;
            try { p.setEntirePath(essai); return "all\u00e9g\u00e9 (" + err + ")"; } catch (e4) {}
        }
        throw new Error(err);
    }
    function dessinerForme(l, forme, couleur, nom) {     // forme = [contour, trous\u2026], points [[x, y], \u2026]
        var p, cp, j, sub, note;
        try {
            if (forme.length === 1) {
                p = l.pathItems.add();
                note = remplir(p, forme[0]);
                p.closed = true; p.filled = false; p.stroked = true; p.strokeColor = couleur; p.strokeWidth = 1;
            } else {
                cp = l.compoundPathItems.add();
                for (j = 0; j < forme.length; j++) {
                    sub = cp.pathItems.add();
                    note = remplir(sub, forme[j]) || note;
                    sub.closed = true; sub.filled = false; sub.stroked = true; sub.strokeColor = couleur; sub.strokeWidth = 1;
                }
            }
            if (note) anomalies.push(nom + " : " + note);
            return true;
        } catch (e) {
            anomalies.push(nom + " NON DESSIN\u00c9E : " + e.message + " (" + forme.length + " anneau(x), " + (forme[0] ? forme[0].length : 0) + " points)");
            try { if (p) p.remove(); if (cp) cp.remove(); } catch (e2) {}
            return false;
        }
    }
    function cercle(l, cx, cy, r, couleur, epaisseur) {    // cercle de B\u00e9zier exact, dans le rep\u00e8re des ancres
        var k = 0.5522847 * r, p = l.pathItems.add(), i, q;
        p.setEntirePath([[cx + r, cy], [cx, cy + r], [cx - r, cy], [cx, cy - r]]);
        p.closed = true;
        var tangentes = [[0, 1], [-1, 0], [0, -1], [1, 0]];
        for (i = 0; i < 4; i++) {
            q = p.pathPoints[i];
            q.rightDirection = [q.anchor[0] + tangentes[i][0] * k, q.anchor[1] + tangentes[i][1] * k];
            q.leftDirection = [q.anchor[0] - tangentes[i][0] * k, q.anchor[1] - tangentes[i][1] * k];
        }
        p.filled = false; p.stroked = true; p.strokeColor = couleur; p.strokeWidth = epaisseur;
        return p;
    }
    function trait(l, a, b) {
        var p = l.pathItems.add(); p.setEntirePath([a, b]); p.closed = false;
        p.filled = false; p.stroked = true; p.strokeColor = NOIR; p.strokeWidth = 0.5;
    }
    // zones de la rainure plus fines que le seuil LED : aplat jaune semi-transparent, calque non imprimable
    function dessinerEtroit(doc, etroit) {
        supprimerCalque(doc, L_ETROIT);
        if (!etroit || !etroit.length) return;
        var l = doc.layers.add(); l.name = L_ETROIT; l.printable = false;
        var lr = calque(doc, L_RAINURE);
        for (var i = 0; i < etroit.length; i++) {
            var f = etroit[i], p, cp, j, sub;
            if (f.length === 1) { p = l.pathItems.add(); p.setEntirePath(f[0]); p.closed = true; p.stroked = false; p.filled = true; p.fillColor = JAUNE; }
            else {
                cp = l.compoundPathItems.add();
                for (j = 0; j < f.length; j++) { sub = cp.pathItems.add(); sub.setEntirePath(f[j]); sub.closed = true; }
                cp.pathItems[0].stroked = false; cp.pathItems[0].filled = true; cp.pathItems[0].fillColor = JAUNE;
            }
        }
        try { l.opacity = 70; } catch (eO) {}
        l.locked = true;
    }
    // ordre des calques, du haut vers le bas : D\u00e9coupe, Rainure LED, Entretoises, Zone inf\u00e9rieure au minimum
    // (et \u00ab A v\u00e9rifier \u00bb tout en haut tant qu'il existe)
    function ordonner(doc) {
        var ordre = [L_ENTIERE, L_ETROIT, L_ENTRETOISES, L_RAINURE, L_DECOUPE, L_VERIF], i, l, verrou;
        for (i = 0; i < ordre.length; i++) {
            l = calque(doc, ordre[i]);
            if (!l) continue;
            verrou = l.locked;
            try { l.locked = false; l.zOrder(ZOrderMethod.BRINGTOFRONT); } catch (e) {}
            l.locked = verrou;
        }
    }
    function dessinerDoutes(doc, doutes) {
        supprimerCalque(doc, L_VERIF);
        if (!doutes || !doutes.length) return;
        var l = doc.layers.add(); l.name = L_VERIF; l.printable = false;
        for (var i = 0; i < doutes.length; i++) {
            var b = doutes[i].boite;                         // [gauche, haut, droite, bas] en points
            var d = Math.max(Math.abs(b[2] - b[0]), Math.abs(b[1] - b[3])) + 28;
            cercle(l, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2, d / 2, ROUGE, 3);
        }
        l.zOrder(ZOrderMethod.BRINGTOFRONT);
    }

    // ---------- \u00e9tape \u00ab placer \u00bb ----------
    function preparerDecoupe(doc) {
        var dec = calque(doc, L_DECOUPE), sel = [], i, j, l, it, a;
        try { a = doc.selection; for (i = 0; a && i < a.length; i++) sel.push(a[i]); } catch (e0) {}
        var source = [];
        if (sel.length) source = sel;
        else if (!dec || !dec.pageItems.length) {
            for (i = 0; i < doc.layers.length; i++) {
                l = doc.layers[i];
                if (estNotre(String(l.name)) || l.locked || !l.visible) continue;
                for (j = 0; j < l.pageItems.length; j++) {
                    it = l.pageItems[j];
                    if (it.typename === "PathItem" || it.typename === "CompoundPathItem" || it.typename === "GroupItem") source.push(it);
                }
            }
        }
        dec = assurerCalque(doc, L_DECOUPE);
        for (i = 0; i < source.length; i++) {
            try { if (source[i].layer !== dec || sel.length) source[i].move(dec, ElementPlacement.PLACEATEND); } catch (e1) {}
        }
        doc.selection = null;
        if (!dec.pageItems.length) throw new Error("Aucun trac\u00e9 de d\u00e9coupe trouv\u00e9.\nS\u00e9lectionne le contour des lettres (vectoris\u00e9, \u00e9chelle 1:1) puis relance.");
        contour(dec, ROSE, 1);
        return dec;
    }

    function placer(doc) {
        var r0 = calque(doc, L_RAINURE), e0 = calque(doc, L_ENTRETOISES);
        if ((r0 && r0.pageItems.length) || (e0 && e0.pageItems.length)) {
            if (!confirm("Ce fichier a d\u00e9j\u00e0 une rainure et des entretoises.\n\nRecalculer ? Tes retouches (entretoises d\u00e9plac\u00e9es\u2026) seront PERDUES.\n\n(Pour garder tes retouches : Annuler, puis \u00ab 2. Finaliser \u00bb dans GraphiDesk.)")) {
                ecrire(FICHIER_GEO, "{\"ok\":false,\"annule\":true,\"jeton\":" + chaine(jeton) + "}");
                geoEcrit = true;
                return null;
            }
        }
        barre = creerBarre();
        barre.maj(0.02, "Rel\u00e9v\u00e9 de la d\u00e9coupe\u2026");
        var dec = preparerDecoupe(doc);
        ecrire(FICHIER_GEO, "{\"ok\":true,\"jeton\":" + chaine(jeton) + ",\"etape\":\"placer\",\"coupe\":" + relever(dec) + "}");
        geoEcrit = true;
        var res = attendreResultat(0.1);
        if (res.erreur) throw new Error(String(res.erreur));

        barre.maj(0.86, "Dessin de la rainure\u2026");
        supprimerCalque(doc, L_ENTIERE);
        var lr = assurerCalque(doc, L_RAINURE), le = assurerCalque(doc, L_ENTRETOISES), i;
        vider(lr); vider(le);
        for (i = 0; i < res.rainure.length; i++) dessinerForme(lr, res.rainure[i], VERT, "rainure " + (i + 1));
        try { dessinerEtroit(doc, res.etroit); } catch (eE) { anomalies.push("zones inf\u00e9rieures au minimum : " + eE.message); }
        barre.maj(0.94, "Pose des entretoises\u2026");
        var r = res.diametre / 2;
        for (i = 0; i < res.entretoises.length; i++) {
            try { cercle(le, res.entretoises[i].x, res.entretoises[i].y, r, BLEU, 1); }
            catch (eC) { anomalies.push("entretoise " + (i + 1) + " : " + eC.message); }
        }
        dessinerDoutes(doc, res.doutes);
        ordonner(doc);
        barre.maj(1, null);
        return res;
    }

    // ---------- \u00e9tape \u00ab finaliser \u00bb ----------
    function nomPdp(doc) {
        function propre(s) { return String(s).replace(/^\s+|\s+$/g, "").replace(/[\\\/:*?"<>|]+/g, "").replace(/\s+/g, "_").toUpperCase(); }
        var client = propre(PDP.client || ""), bat = propre(PDP.bat || "");
        if (client) return "PDP_PAPIER_" + client + (bat ? "_N" + bat.replace(/^N/, "") : "");
        var base = String(doc.name).replace(/\.[^.]+$/, "");
        return "PDP_PAPIER_" + propre(base);
    }
    // PDP : nouveau document, d\u00e9coupe + entretoises (avec croix au centre) en noir, vue de face, \u00e0 l'\u00e9chelle 1:1
    function fairePdp(doc, dec, le) {
        var nom = nomPdp(doc), i, j;
        var pdoc = app.documents.add(DocumentColorSpace.CMYK, 1000, 1000);
        var l = pdoc.layers[0]; l.name = "PDP";
        for (i = 0; i < dec.pageItems.length; i++) dec.pageItems[i].duplicate(l, ElementPlacement.PLACEATEND);
        var avant = l.pageItems.length;
        for (i = 0; i < le.pageItems.length; i++) le.pageItems[i].duplicate(l, ElementPlacement.PLACEATEND);
        contour(l, NOIR, 0.5);
        // croix de per\u00e7age au centre de chaque entretoise (lue sur la copie : m\u00eame rep\u00e8re que le nouveau document)
        var croix = [];
        for (i = avant; i < l.pageItems.length; i++) {
            feuilles({ pageItems: [l.pageItems[i]] }, function (p) {
                var pts = p.pathPoints, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, a;
                for (j = 0; j < pts.length; j++) { a = pts[j].anchor; if (a[0] < x0) x0 = a[0]; if (a[0] > x1) x1 = a[0]; if (a[1] < y0) y0 = a[1]; if (a[1] > y1) y1 = a[1]; }
                croix.push([(x0 + x1) / 2, (y0 + y1) / 2]);
            });
        }
        var c = 3 * MM;
        for (i = 0; i < croix.length; i++) {
            trait(l, [croix[i][0] - c, croix[i][1]], [croix[i][0] + c, croix[i][1]]);
            trait(l, [croix[i][0], croix[i][1] - c], [croix[i][0], croix[i][1] + c]);
        }
        // fichier de FAB dessin\u00e9 en miroir (vue de dos) : le PDP est retourn\u00e9 pour \u00eatre vu de face
        if (PDP.miroir) {
            var g = l.groupItems.add();
            for (i = l.pageItems.length - 1; i >= 0; i--) if (l.pageItems[i] !== g) l.pageItems[i].move(g, ElementPlacement.PLACEATBEGINNING);
            g.resize(-100, 100);
        }
        // l\u00e9gende sous le dessin
        var vb = null;
        for (i = 0; i < l.pageItems.length; i++) {
            var b = l.pageItems[i].visibleBounds;
            if (!vb) vb = [b[0], b[1], b[2], b[3]];
            else { vb[0] = Math.min(vb[0], b[0]); vb[1] = Math.max(vb[1], b[1]); vb[2] = Math.max(vb[2], b[2]); vb[3] = Math.min(vb[3], b[3]); }
        }
        try {
            var t = l.textFrames.add();
            t.contents = nom + "  \u2014  vue de face  \u2014  \u00e9chelle 1:1  \u2014  " + croix.length + " entretoises";
            t.textRange.characterAttributes.size = 60;
            t.textRange.characterAttributes.fillColor = NOIR;
            t.left = vb[0]; t.top = vb[3] - 20 * MM;
        } catch (eT) {}
        // plan de travail ajust\u00e9 au dessin, avec une marge de 20 mm
        pdoc.selection = null;
        for (i = 0; i < l.pageItems.length; i++) l.pageItems[i].selected = true;
        pdoc.fitArtboardToSelectedArt(0);
        pdoc.selection = null;
        var ab = pdoc.artboards[0].artboardRect, m = 20 * MM;
        pdoc.artboards[0].artboardRect = [ab[0] - m, ab[1] + m, ab[2] + m, ab[3] - m];

        // enregistr\u00e9 \u00e0 c\u00f4t\u00e9 du fichier de FAB (s'il est enregistr\u00e9), en PDF
        var dossier = null;
        try { if (doc.saved || doc.fullName) { dossier = doc.path; if (!dossier || !dossier.exists || !String(dossier.fsName)) dossier = null; } } catch (eP) { dossier = null; }
        var chemin = "";
        if (dossier) {
            try {
                var f = new File(dossier.fsName + "/" + nom + ".pdf");
                var o = new PDFSaveOptions();
                pdoc.saveAs(f, o);
                chemin = f.fsName;
                pdoc.close(SaveOptions.DONOTSAVECHANGES);
                doc.activate();
            } catch (eS) { chemin = ""; }
        }
        return { nom: nom, chemin: chemin, entretoises: croix.length };
    }

    function finaliser(doc) {
        var dec = calque(doc, L_DECOUPE), lr = calque(doc, L_RAINURE), le = calque(doc, L_ENTRETOISES), lent = calque(doc, L_ENTIERE);
        if (!dec || !dec.pageItems.length || !le) throw new Error("Lance d'abord \u00ab 1. Placer \u00bb : calques \u00ab D\u00e9coupe \u00bb / \u00ab Entretoises \u00bb introuvables.");
        barre = creerBarre();
        barre.maj(0.02, "Rel\u00e9v\u00e9 des entretoises\u2026");
        dec.locked = false; le.locked = false; le.visible = true;
        // la rainure ENTI\u00c8RE : celle gard\u00e9e \u00e0 la premi\u00e8re finalisation, sinon celle du calque Rainure LED
        var source = (lent && lent.pageItems.length) ? lent : lr;
        var entretoises = releverEntretoises(le);
        if (!entretoises.length) throw new Error("Aucune entretoise sur le calque \u00ab Entretoises \u00bb.");
        ecrire(FICHIER_GEO, "{\"ok\":true,\"jeton\":" + chaine(jeton) + ",\"etape\":\"finaliser\",\"coupe\":" + relever(dec) +
            ",\"rainure\":" + relever(source) + ",\"entretoises\":[" + entretoises.join(",") + "]}");
        geoEcrit = true;
        var res = attendreResultat(0.1);
        if (res.erreur) throw new Error(String(res.erreur));

        barre.maj(0.86, "Rainure finale\u2026");
        var i;
        // garde la rainure enti\u00e8re (cach\u00e9e, non imprimable) pour pouvoir re-finaliser apr\u00e8s un nouveau d\u00e9placement
        if (!lent || !lent.pageItems.length) {
            lent = assurerCalque(doc, L_ENTIERE);
            for (i = 0; lr && i < lr.pageItems.length; i++) lr.pageItems[i].duplicate(lent, ElementPlacement.PLACEATEND);
        }
        lent.printable = false; lent.visible = false; lent.locked = true;
        // la nouvelle rainure est d'abord dessin\u00e9e \u00e0 part : l'ancienne n'est remplac\u00e9e que si tout s'est bien dessin\u00e9
        var provisoire = doc.layers.add(), echecs = 0;
        provisoire.name = "Rainure LED (calcul en cours)";
        for (i = 0; i < res.rainure.length; i++) if (!dessinerForme(provisoire, res.rainure[i], VERT, "rainure " + (i + 1))) echecs++;
        if (echecs) {
            try { provisoire.remove(); } catch (eP) {}
            throw new Error(echecs + " forme(s) de rainure impossibles \u00e0 dessiner : la rainure d'avant est GARD\u00c9E, rien n'a \u00e9t\u00e9 chang\u00e9.\n" + anomalies.join("\n"));
        }
        lr = assurerCalque(doc, L_RAINURE);
        vider(lr);
        for (i = provisoire.pageItems.length - 1; i >= 0; i--) provisoire.pageItems[i].move(lr, ElementPlacement.PLACEATBEGINNING);
        try { provisoire.remove(); } catch (eP2) {}
        try { dessinerEtroit(doc, res.etroit); } catch (eE) { anomalies.push("zones inf\u00e9rieures au minimum : " + eE.message); }
        contour(dec, ROSE, 1);
        contour(le, BLEU, 1);
        dessinerDoutes(doc, res.doutes);
        ordonner(doc);
        var pdp = null;
        if (!res.doutes.length) { barre.maj(0.92, "PDP\u2026"); pdp = fairePdp(doc, dec, le); }
        barre.maj(1, null);
        res.pdp = pdp;
        return res;
    }

    // ---------- bilan ----------
    function bilanPlacer(res) {
        var s = res.stats || {}, f = res.infos || {}, m = "LETTRES R\u00c9TRO\u00c9CLAIR\u00c9ES (B\u00caTA) \u2014 PLACEMENT\n\n";
        m += "\u2022 " + s.pieces + " pi\u00e8ce(s), " + s.entretoises + " entretoise(s) (calque \u00ab Entretoises \u00bb, bleu)\n";
        m += "\u2022 Rainure sur le calque \u00ab Rainure LED \u00bb (vert)" + (s.liaisons ? ", " + s.liaisons + " liaison(s)" : "") + (s.cables ? " dont " + s.cables + " passage(s) de c\u00e2ble non lumineux" : "") + "\n";
        if (f.lettresFines) m += "\u2022 " + f.lettresFines + " lettre(s) fine(s) : entretoise(s) en bout de jambage\n";
        if (res.etroit && res.etroit.length) m += "\u2022 " + res.etroit.length + " zone(s) de rainure plus fine(s) que " + (P.rainureMin || 6) + " mm, en jaune\n   (calque \u00ab " + L_ETROIT + " \u00bb, non imprimable)\n";
        if (f.bordsNonEclaires) m += "\u2022 " + f.bordsNonEclaires + " endroit(s) o\u00f9 la rainure ne rentre pas (bord non \u00e9clair\u00e9)\n";
        if (res.doutes.length) m += "\u2022 " + res.doutes.length + " point(s) BLOQUANT(S), cercl\u00e9(s) en rouge\n";
        if (PDP.horsStandard) m += "\n\u26a0 HORS STANDARD ATELIER : " + PDP.horsStandard + "\n";
        if (anomalies.length) m += "\n\u26a0 \u00c0 SIGNALER \u00c0 JORDAN (" + anomalies.length + ") :\n   " + anomalies.slice(0, 6).join("\n   ") + "\n";
        m += "\nD\u00e9place, ajoute ou supprime les entretoises si besoin (rien n'est fusionn\u00e9),\npuis \u00ab 2. Finaliser \u00bb dans GraphiDesk.";
        return m;
    }
    function bilanFinaliser(res) {
        var s = res.stats || {}, m = "LETTRES R\u00c9TRO\u00c9CLAIR\u00c9ES (B\u00caTA) \u2014 FINALISATION\n\n";
        m += "\u2022 " + s.entretoises + " entretoise(s) sur " + s.pieces + " pi\u00e8ce(s)\n";
        if (res.etroit && res.etroit.length) m += "\u2022 " + res.etroit.length + " zone(s) de rainure plus fine(s) que " + (P.rainureMin || 6) + " mm (en jaune)\n";
        if (s.ecourtees) m += "\u2022 Rainure \u00e9court\u00e9e (1 mm avant l'entretoise) \u00e0 " + s.ecourtees + " endroit(s)\n";
        if (res.doutes.length) {
            m += "\n\u26d4 " + res.doutes.length + " point(s) \u00e0 corriger, cercl\u00e9(s) en rouge :\n";
            for (var i = 0; i < res.doutes.length && i < 8; i++) m += "   - " + res.doutes[i].motif + "\n";
            m += "\nPDP NON g\u00e9n\u00e9r\u00e9 : corrige puis relance \u00ab 2. Finaliser \u00bb.";
        } else if (res.pdp && res.pdp.chemin) m += "\n\u2714 PDP enregistr\u00e9 :\n" + res.pdp.chemin;
        else if (res.pdp) m += "\n\u2714 PDP cr\u00e9\u00e9 (document ouvert, \u00e0 enregistrer sous \u00ab " + res.pdp.nom + " \u00bb :\nle fichier de FAB n'est pas encore enregistr\u00e9).";
        if (PDP.horsStandard) m += "\n\n\u26a0 HORS STANDARD ATELIER : " + PDP.horsStandard;
        if (anomalies.length) m += "\n\n\u26a0 \u00c0 SIGNALER \u00c0 JORDAN (" + anomalies.length + ") :\n   " + anomalies.slice(0, 6).join("\n   ");
        return m;
    }

    // ---------- principal ----------
    try {
        if (!app.documents.length) throw new Error("Aucun document Illustrator n'est ouvert.");
        var doc = app.activeDocument, res, msg;
        if (etape === "placer") { res = placer(doc); if (!res) return; msg = bilanPlacer(res); }
        else if (etape === "finaliser") { res = finaliser(doc); msg = bilanFinaliser(res); }
        else throw new Error("\u00c9tape inconnue : " + etape);
        barre.fermer();
        app.redraw();
        var s = res.stats || {};
        ecrire(FICHIER_FIN, "{\"ok\":true,\"jeton\":" + chaine(jeton) + ",\"entretoises\":" + (s.entretoises || 0) + ",\"pieces\":" + (s.pieces || 0) +
            ",\"doutes\":" + res.doutes.length + ",\"pdp\":" + chaine(res.pdp ? (res.pdp.chemin || res.pdp.nom) : "") + "}");
        alert(msg);
    } catch (erreur) {
        var texte = erreur && erreur.message ? erreur.message : String(erreur);
        barre.fermer();
        try {
            if (!geoEcrit) ecrire(FICHIER_GEO, "{\"ok\":false,\"jeton\":" + chaine(jeton) + ",\"erreur\":" + chaine(texte) + "}");
            else ecrire(FICHIER_FIN, "{\"ok\":false,\"jeton\":" + chaine(jeton) + ",\"erreur\":" + chaine(texte) + "}");
        } catch (e9) {}
        alert("Lettres r\u00e9tro\u00e9clair\u00e9es (" + etape + ") : " + texte + (erreur && erreur.line ? "\n(ligne " + erreur.line + " du script)" : ""));
    }
})(params);
