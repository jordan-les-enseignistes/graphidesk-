// Fonds perdus intelligents de l'outil Adhésif — côté Illustrator.
//
// Le calcul se fait dans GraphiDesk, pas ici. Ce script :
//   1. relève les tracés des calques Artwork, CutContour et FondPerdu → <temp>/graphidesk_fp_geometrie.json
//   2. attend la réponse de GraphiDesk (<temp>/graphidesk_fp_correctifs.json) en affichant une barre de progression,
//      alimentée par <temp>/graphidesk_fp_progression.json
//   3. pose les correctifs sur le calque FondPerdu (groupe « Correctifs FP (GraphiDesk) »), affiche le message de fin
//      et écrit <temp>/graphidesk_fp_fin.json
//
// params.etape :
//   "tout"   : les trois à la suite, dans LE MÊME lancement que l'automatisation adhésif (full_automation.jsx l'enchaîne
//              à sa fin) — Illustrator ne demande donc aucune confirmation supplémentaire
//   "export" : le relevé seul            } étapes séparées, gardées pour les essais
//   "dessin" : la pose seule (params.correctifs, params.doutes)
//
// Règles : on ne modifie JAMAIS le calque CutContour ni le calque Artwork. Chaque correctif est un tracé FERMÉ,
// rempli avec la couleur exacte de l'objet dont il prolonge le débord (ou du blanc = pas d'encre).
(function (params) {
    var FICHIER_GEO = "graphidesk_fp_geometrie.json";
    var FICHIER_FIN = "graphidesk_fp_fin.json";
    var FICHIER_PROGRESSION = "graphidesk_fp_progression.json";
    var FICHIER_CORRECTIFS = "graphidesk_fp_correctifs.json";
    var SILENCE_MAX = 30000;                                    // ms sans signe de vie de GraphiDesk (il en donne un par seconde) avant d'abandonner
    var ATTENTE_MAX = 300000;                                   // ms d'attente au total (GraphiDesk borne lui-même son calcul à 3 min)
    var GROUPE = "Correctifs FP (GraphiDesk)";
    var CALQUE_DOUTES = "FP a verifier (a supprimer)";

    // ---------- utilitaires ----------
    function ecrire(nom, texte) {
        var tmp = new File(Folder.temp + "/" + nom + ".tmp");
        tmp.encoding = "UTF-8";
        tmp.open("w");
        tmp.write(texte);
        tmp.close();
        var cible = new File(Folder.temp + "/" + nom);
        if (cible.exists) cible.remove();
        tmp.rename(nom);
    }
    function chaine(s) {                                        // chaîne JSON (ES3 : pas de JSON.stringify)
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
    function lireJson(nom) {                                    // null si le fichier n'existe pas (encore) ou n'est pas fini d'écrire
        var f = new File(Folder.temp + "/" + nom), texte;
        if (!f.exists) return null;
        try {
            f.encoding = "UTF-8";
            if (!f.open("r")) return null;
            texte = f.read();
            f.close();
            if (!texte) return null;
            return eval("(" + texte + ")");                     // ES3 : pas de JSON.parse ; le fichier vient de GraphiDesk
        } catch (e) { try { f.close(); } catch (e2) {} return null; }
    }
    // Barre de progression : une petite palette au milieu de l'écran, mise à jour pendant que le script travaille.
    // Si elle ne peut pas s'afficher, le script continue sans elle.
    function creerBarre() {
        var w = null, libelle = null, jauge = null;
        try {
            w = new Window("palette", "GraphiDesk \u2014 Fonds perdus", undefined, { closeButton: false });
            w.orientation = "column"; w.alignChildren = "fill"; w.margins = 18; w.spacing = 10;
            libelle = w.add("statictext", undefined, "Fonds perdus : pr\u00e9paration\u2026");
            libelle.preferredSize.width = 400;
            jauge = w.add("progressbar", undefined, 0, 1000);
            jauge.preferredSize = [400, 14];
            w.center(); w.show(); w.update();
        } catch (e) { w = null; }
        return {
            // fraction : 0 à 1 (null = inchangée) ; texte : libellé (null = inchangé)
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
    var barre = { maj: function () {}, fermer: function () {} };   // remplacée par une vraie barre à l'étape « tout »
    // La barre ouverte par full_automation.jsx couvre tout l'outil : ici, on n'en occupe que la fin (de `base` à 1).
    function suiteDe(vraie, base) {
        return {
            maj: function (f, t) { vraie.maj(f === null || f === undefined ? null : base + (1 - base) * f, t); },
            fermer: function () { vraie.fermer(); }
        };
    }
    var cheminsLus = 0, cheminsAttendus = 0;                    // avancement du relevé (c'est lui qui dure, côté Illustrator)
    function n3(v) { return String(Math.round(v * 1000) / 1000); }
    function n1(v) { return String(Math.round(v * 10) / 10); }
    function calque(doc, nom) {
        for (var i = 0; i < doc.layers.length; i++) if (String(doc.layers[i].name) === nom) return doc.layers[i];
        return null;
    }
    function decrire(c) {                                       // description d'une couleur = son identité pour le calcul
        try {
            var t = c.typename;
            if (t === "CMYKColor") return "cmyk:" + n1(c.cyan) + "," + n1(c.magenta) + "," + n1(c.yellow) + "," + n1(c.black);
            if (t === "RGBColor") return "rgb:" + Math.round(c.red) + "," + Math.round(c.green) + "," + Math.round(c.blue);
            if (t === "GrayColor") return "gris:" + n1(c.gray);
            if (t === "SpotColor") return "ton:" + c.spot.name + ":" + n1(c.tint);
            if (t === "GradientColor") return "grad:" + c.gradient.name;
            if (t === "PatternColor") return "motif:" + c.pattern.name;
            if (t === "NoColor") return null;
            return "autre:" + t;
        } catch (e) { return null; }
    }
    function sousChemin(p) {                                    // un PathItem → {"f":fermé,"p":[[ancre x,y, poignée gauche x,y, poignée droite x,y],…]}
        var pts = p.pathPoints, n = pts.length, m = [], i, q, a, l, r;
        cheminsLus++;
        if (cheminsAttendus && cheminsLus % 20 === 0) {
            barre.maj(0.45 * Math.min(1, cheminsLus / cheminsAttendus),
                "Fonds perdus : relev\u00e9 des trac\u00e9s\u2026 " + Math.round(100 * Math.min(1, cheminsLus / cheminsAttendus)) + " %");
        }
        for (i = 0; i < n; i++) {
            q = pts[i]; a = q.anchor; l = q.leftDirection; r = q.rightDirection;
            m.push("[" + n3(a[0]) + "," + n3(a[1]) + "," + n3(l[0]) + "," + n3(l[1]) + "," + n3(r[0]) + "," + n3(r[1]) + "]");
        }
        return "{\"f\":" + (p.closed ? 1 : 0) + ",\"p\":[" + m.join(",") + "]}";
    }
    function rectangle(b) {                                     // boîte [gauche, haut, droite, bas] → sous-chemin rectangulaire
        var x0 = n3(b[0]), y0 = n3(b[1]), x1 = n3(b[2]), y1 = n3(b[3]);
        function pt(x, y) { return "[" + x + "," + y + "," + x + "," + y + "," + x + "," + y + "]"; }
        return "{\"f\":1,\"p\":[" + pt(x0, y0) + "," + pt(x1, y0) + "," + pt(x1, y1) + "," + pt(x0, y1) + "]}";
    }

    // Parcours d'un calque, du DESSUS vers le dessous. Chaque objet « feuille » reçoit un rang ; le même parcours,
    // rejoué à l'étape « dessin », retrouve l'objet d'un rang donné pour lui emprunter sa couleur exacte.
    //   surFeuille(item, sorte, masques)  avec sorte = "chemin" | "compose" | "image" | "texte"
    function parcourir(conteneur, masques, surFeuille, surMasque) {
        var items = conteneur.pageItems, i, it, t, k, enfants, masque, mEnfants;
        for (i = 0; i < items.length; i++) {
            it = items[i];
            try { if (it.hidden) continue; } catch (e0) {}
            t = it.typename;
            if (t === "GroupItem") {
                if (String(it.name) === GROUPE) continue;        // nos propres correctifs d'un passage précédent
                mEnfants = masques;
                if (it.clipped) {
                    masque = null; enfants = it.pageItems;
                    for (k = 0; k < enfants.length; k++) {
                        try {
                            if (enfants[k].typename === "PathItem" && enfants[k].clipping) { masque = enfants[k]; break; }
                            if (enfants[k].typename === "CompoundPathItem" && enfants[k].pathItems.length && enfants[k].pathItems[0].clipping) { masque = enfants[k]; break; }
                        } catch (e1) {}
                    }
                    if (masque) mEnfants = masques.concat([surMasque(masque)]);
                }
                parcourir(it, mEnfants, surFeuille, surMasque);
            } else if (t === "PathItem") {
                if (it.guides || it.clipping) continue;
                if (!it.filled && !it.stroked) continue;
                surFeuille(it, "chemin", masques);
            } else if (t === "CompoundPathItem") {
                if (!it.pathItems.length) continue;
                if (it.pathItems[0].clipping) continue;
                if (!it.pathItems[0].filled && !it.pathItems[0].stroked) continue;
                surFeuille(it, "compose", masques);
            } else if (t === "TextFrame") {
                surFeuille(it, "texte", masques);
            } else {
                surFeuille(it, "image", masques);                // image liée ou incorporée, symbole, filet de dégradé…
            }
        }
    }

    function exporterCalque(lay, listeMasques) {
        var feuilles = [], rang = 0;
        if (!lay) return "[]";
        parcourir(lay, [], function (it, sorte, masques) {
            var sc = [], apparence = null, eo = 0, f = null, s = null, k;
            try {
                if (sorte === "chemin") { sc.push(sousChemin(it)); apparence = it; }
                else if (sorte === "compose") {
                    for (k = 0; k < it.pathItems.length; k++) sc.push(sousChemin(it.pathItems[k]));
                    apparence = it.pathItems[0];
                } else sc.push(rectangle(it.geometricBounds));
                if (apparence) {
                    eo = apparence.evenodd ? 1 : 0;
                    if (apparence.filled) f = decrire(apparence.fillColor);
                    if (apparence.stroked && apparence.strokeWidth > 0) s = { c: decrire(apparence.strokeColor), w: apparence.strokeWidth };
                }
            } catch (e) { rang++; return; }
            feuilles.push("{\"i\":" + rang + ",\"g\":" + chaine(sorte) + ",\"f\":" + (f ? chaine(f) : "null") +
                ",\"s\":" + (s && s.c ? "{\"c\":" + chaine(s.c) + ",\"w\":" + n3(s.w) + "}" : "null") +
                ",\"eo\":" + eo + ",\"m\":[" + masques.join(",") + "],\"c\":[" + sc.join(",") + "]}");
            rang++;
        }, function (masque) {
            var sc = [], k;
            if (masque.typename === "PathItem") sc.push(sousChemin(masque));
            else for (k = 0; k < masque.pathItems.length; k++) sc.push(sousChemin(masque.pathItems[k]));
            listeMasques.push("[" + sc.join(",") + "]");
            return listeMasques.length - 1;
        });
        return "[" + feuilles.join(",") + "]";
    }

    function exporterCoupe(lay) {
        var sc = [];
        function creuser(conteneur) {
            var items = conteneur.pageItems, i, it, k;
            for (i = 0; i < items.length; i++) {
                it = items[i];
                try { if (it.hidden) continue; } catch (e0) {}
                if (it.typename === "GroupItem") creuser(it);
                else if (it.typename === "PathItem") { if (!it.guides) sc.push(sousChemin(it)); }
                else if (it.typename === "CompoundPathItem") for (k = 0; k < it.pathItems.length; k++) sc.push(sousChemin(it.pathItems[k]));
            }
        }
        if (lay) creuser(lay);
        return "[" + sc.join(",") + "]";
    }

    // ---------- étape « export » ----------
    function exporter() {
        if (!app.documents.length) throw new Error("Aucun document Illustrator n'est ouvert.");
        var doc = app.activeDocument;
        var art = calque(doc, "Artwork"), coupe = calque(doc, "CutContour"), fp = calque(doc, "FondPerdu");
        if (!art || !coupe || !fp) throw new Error("Calques Artwork / CutContour / FondPerdu introuvables.");
        var masques = [];
        cheminsLus = 0;
        try { cheminsAttendus = doc.pathItems.length; } catch (eN) { cheminsAttendus = 0; }
        barre.maj(0, "Fonds perdus : relev\u00e9 des trac\u00e9s\u2026");
        var jsonArt = exporterCalque(art, masques);
        var jsonFp = exporterCalque(fp, masques);
        var jsonCoupe = exporterCoupe(coupe);
        barre.maj(0.45, "Fonds perdus : calcul des correctifs\u2026");
        ecrire(FICHIER_GEO, "{\"ok\":true,\"version\":1,\"jeton\":" + chaine(params.jeton || "") + ",\"doc\":" + chaine(doc.name) + ",\"art\":" + jsonArt + ",\"fp\":" + jsonFp +
            ",\"coupe\":" + jsonCoupe + ",\"masques\":[" + masques.join(",") + "]}");
    }

    // ---------- attente des correctifs calculés par GraphiDesk ----------
    function attendreCorrectifs() {
        var debut = new Date().getTime(), dernierSigne = debut, vu = -1, battement = -1, maintenant, o;
        var jeton = String(params.jeton || "");
        while (true) {
            $.sleep(200);
            maintenant = new Date().getTime();
            o = lireJson(FICHIER_CORRECTIFS);
            if (o && String(o.jeton) === jeton) return o;
            o = lireJson(FICHIER_PROGRESSION);
            if (o && String(o.jeton) === jeton && (o.n !== battement || o.f !== vu)) {      // signe de vie de GraphiDesk
                battement = o.n; if (o.f > vu) vu = o.f; dernierSigne = maintenant;
                barre.maj(0.45 + 0.45 * vu, "Fonds perdus : calcul des correctifs\u2026 " + Math.round(vu * 100) + " %");
            } else barre.maj(null, null);                       // garde la palette vivante
            if (maintenant - dernierSigne > SILENCE_MAX) throw new Error("GraphiDesk ne r\u00e9pond pas (est-il toujours ouvert ?)");
            if (maintenant - debut > ATTENTE_MAX) throw new Error("le calcul a d\u00e9pass\u00e9 le d\u00e9lai pr\u00e9vu");
        }
    }

    // ---------- étape « tout » : relevé, attente du calcul, pose — à la suite de l'automatisation adhésif ----------
    function tout() {
        var releveFait = false, reponse;
        params.correctifs = []; params.doutes = []; params.erreurFP = "";
        barre = params.barre ? suiteDe(params.barre, 0.25) : creerBarre();
        try {
            exporter();
            releveFait = true;
            reponse = attendreCorrectifs();
            if (reponse.erreur) params.erreurFP = String(reponse.erreur);
            else { params.correctifs = reponse.correctifs || []; params.doutes = reponse.doutes || []; }
        } catch (e) {
            params.erreurFP = e && e.message ? e.message : String(e);
            // GraphiDesk guette le relevé : s'il n'a pas pu se faire, on le lui dit pour qu'il n'attende pas
            if (!releveFait) { try { ecrire(FICHIER_GEO, "{\"ok\":false,\"erreur\":" + chaine(params.erreurFP) + "}"); } catch (e2) {} }
        }
        barre.maj(0.9, "Fonds perdus : pose des correctifs\u2026");
        dessiner();
    }

    // ---------- étape « dessin » ----------
    function dessiner() {
        var doc = app.activeDocument;
        var art = calque(doc, "Artwork"), fp = calque(doc, "FondPerdu");
        var correctifs = params.correctifs || [], doutes = params.doutes || [];
        var poses = 0, i, k, j, c, couleur, forme, p, cp, sub, grp;

        // les objets du visuel, dans l'ordre du relevé : rang → objet (pour lui emprunter sa couleur)
        var feuilles = [];
        if (art) parcourir(art, [], function (it) { feuilles.push(it); }, function () { return 0; });

        var blanc;
        if (doc.documentColorSpace === DocumentColorSpace.RGB) { blanc = new RGBColor(); blanc.red = 255; blanc.green = 255; blanc.blue = 255; }
        else { blanc = new CMYKColor(); blanc.cyan = 0; blanc.magenta = 0; blanc.yellow = 0; blanc.black = 0; }

        if (fp) {
            var verrou = fp.locked, visible = fp.visible;
            fp.locked = false; fp.visible = true;
            for (i = fp.groupItems.length - 1; i >= 0; i--) {
                if (String(fp.groupItems[i].name) === GROUPE) { try { fp.groupItems[i].locked = false; fp.groupItems[i].remove(); } catch (e0) {} }
            }
            if (correctifs.length) {
                grp = fp.groupItems.add();                       // ajouté tout en haut du calque : au-dessus des décalages de 5 mm
                grp.name = GROUPE;
                for (i = 0; i < correctifs.length; i++) {
                    c = correctifs[i];
                    barre.maj(0.9 + 0.08 * i / correctifs.length, null);
                    couleur = null;
                    if (c.blanc) couleur = blanc;
                    else {
                        try {
                            var src = feuilles[c.source];
                            var app0 = src.typename === "CompoundPathItem" ? src.pathItems[0] : src;
                            couleur = c.contour ? app0.strokeColor : app0.fillColor;
                        } catch (e1) { couleur = null; }
                    }
                    if (!couleur) continue;                      // couleur introuvable : on ne pose rien plutôt qu'une mauvaise teinte
                    for (k = 0; k < c.formes.length; k++) {
                        forme = c.formes[k];
                        try {
                            if (forme.length === 1) {
                                p = grp.pathItems.add();
                                p.setEntirePath(forme[0]);
                                p.closed = true; p.filled = true; p.stroked = false; p.fillColor = couleur;
                            } else {
                                cp = grp.compoundPathItems.add();
                                for (j = 0; j < forme.length; j++) {
                                    sub = cp.pathItems.add();
                                    sub.setEntirePath(forme[j]);
                                    sub.closed = true;
                                }
                                cp.pathItems[0].filled = true; cp.pathItems[0].stroked = false; cp.pathItems[0].fillColor = couleur;
                            }
                            poses++;
                        } catch (e2) {}
                    }
                }
                if (!grp.pageItems.length) grp.remove();
            }
            fp.locked = verrou; fp.visible = visible;
        }

        // doutes : un calque non imprimable, tout en haut, avec un cercle rouge autour de chaque endroit à vérifier
        var ancien = calque(doc, CALQUE_DOUTES);
        if (ancien) { try { ancien.locked = false; ancien.visible = true; ancien.remove(); } catch (e3) {} }
        if (doutes.length) {
            try {
                var ld = doc.layers.add(); ld.name = CALQUE_DOUTES; ld.printable = false;
                var rouge;
                if (doc.documentColorSpace === DocumentColorSpace.RGB) { rouge = new RGBColor(); rouge.red = 255; rouge.green = 0; rouge.blue = 0; }
                else { rouge = new CMYKColor(); rouge.cyan = 0; rouge.magenta = 100; rouge.yellow = 100; rouge.black = 0; }
                for (i = 0; i < doutes.length; i++) {
                    var b = doutes[i].boite;                     // [gauche, haut, droite, bas] en points
                    var cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
                    var d = Math.max(Math.abs(b[2] - b[0]), Math.abs(b[1] - b[3])) + 28;
                    var cercle = ld.pathItems.ellipse(cy + d / 2, cx - d / 2, d, d);
                    cercle.filled = false; cercle.stroked = true; cercle.strokeColor = rouge; cercle.strokeWidth = 3;
                }
                ld.zOrder(ZOrderMethod.BRINGTOFRONT);
            } catch (e4) {}
        }

        barre.maj(1, null);
        barre.fermer();
        app.redraw();
        var msg = params.messageFin ? String(params.messageFin) + "\n\n" : "";
        msg += "FONDS PERDUS :\n";
        if (params.erreurFP) msg += "• Correction automatique impossible : " + params.erreurFP + "\n  Les fonds perdus sont ceux de l'outil habituel.\n";
        else if (!poses) msg += "• Aucun croisement de couleurs à corriger.\n";
        else msg += "• " + poses + " correctif(s) posé(s) sur le calque FondPerdu,\n  dans le groupe « " + GROUPE + " ».\n";
        if (doutes.length) msg += "• " + doutes.length + " endroit(s) à vérifier, cerclé(s) en rouge\n  (calque « " + CALQUE_DOUTES + " », à supprimer ensuite).\n";
        ecrire(FICHIER_FIN, "{\"ok\":true,\"poses\":" + poses + ",\"doutes\":" + doutes.length + ",\"erreurFP\":" + chaine(params.erreurFP || "") + "}");
        if (!params.silencieux) alert(msg);
    }

    try {
        if (params.etape === "tout") tout();
        else if (params.etape === "export") exporter();
        else if (params.etape === "dessin") dessiner();
        else throw new Error("Étape inconnue : " + params.etape);
    } catch (erreur) {
        var texte = erreur && erreur.message ? erreur.message : String(erreur);
        barre.fermer();
        try { ecrire(params.etape === "export" ? FICHIER_GEO : FICHIER_FIN, "{\"ok\":false,\"erreur\":" + chaine(texte) + "}"); } catch (e9) {}
        if (params.etape !== "export" && !params.silencieux) alert((params.messageFin ? String(params.messageFin) + "\n\n" : "") + "Fonds perdus intelligents : " + texte);
    }
})(params);
