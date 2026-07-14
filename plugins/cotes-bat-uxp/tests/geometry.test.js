/* Tests Node purs pour lib/geometry.js — node tests/geometry.test.js */
const assert = require("assert");
const g = require("../lib/geometry");

let pass = 0;
function ok(cond, msg) { assert.ok(cond, msg); pass++; }
function eq(a, b, msg) { assert.deepStrictEqual(a, b, msg); pass++; }
function close(a, b, msg) { assert.ok(Math.abs(a - b) < 1e-6, msg + " (" + a + " vs " + b + ")"); pass++; }

/* --- lettres --- */
eq(g.letterFromIndex(0), "A", "0->A");
eq(g.letterFromIndex(25), "Z", "25->Z");
eq(g.letterFromIndex(26), "AA", "26->AA");
eq(g.letterFromIndex(27), "AB", "27->AB");
eq(g.indexFromLetter("A"), 0, "A->0");
eq(g.indexFromLetter("Z"), 25, "Z->25");
eq(g.indexFromLetter("AA"), 26, "AA->26");
eq(g.indexFromLetter(""), -1, "vide->-1");
eq(g.indexFromLetter("  c "), 2, "casse/espaces");
for (let i = 0; i < 60; i++) eq(g.indexFromLetter(g.letterFromIndex(i)), i, "roundtrip " + i);

/* --- tri par position --- */
const blocks = [
  { id: "bas-droite", bounds: [200, 200, 260, 280] },
  { id: "haut-gauche", bounds: [10, 10, 70, 90] },
  { id: "haut-droite", bounds: [12, 200, 72, 280] },
  { id: "bas-gauche", bounds: [205, 10, 265, 90] }
];
const sorted = g.sortBlocks(blocks).map(function (b) { return b.id; });
eq(sorted, ["haut-gauche", "haut-droite", "bas-gauche", "bas-droite"], "ordre lecture");

/* --- coins depuis une boîte --- */
const c = g.cornersFromBounds([100, 100, 300, 500]); // [y1,x1,y2,x2]
eq(c.length, 4, "4 coins");
eq(c[0], { x: 100, y: 100 }, "coin haut-gauche");

/* --- cote sur un rectangle droit : croix horizontale/verticale centrée --- */
const sq = g.computeCote(g.cornersFromBounds([100, 100, 300, 500]), "A", {});
eq(sq.lines.length, 2, "2 lignes");
close(sq.center.x, 300, "centre x");
close(sq.center.y, 200, "centre y");
// une ligne verticale (x constant = 300) et une horizontale (y constant = 200)
const vert = sq.lines.filter(function (l) { return Math.abs(l.x1 - l.x2) < 1e-6; })[0];
const horiz = sq.lines.filter(function (l) { return Math.abs(l.y1 - l.y2) < 1e-6; })[0];
ok(vert && Math.abs(vert.x1 - 300) < 1e-6, "ligne verticale au centre x");
ok(horiz && Math.abs(horiz.y1 - 200) < 1e-6, "ligne horizontale au centre y");
// horizontale du bord gauche (100) au bord droit (500)
ok(horiz && Math.abs(Math.min(horiz.x1, horiz.x2) - 100) < 1e-6, "horiz part de x=100");
ok(horiz && Math.abs(Math.max(horiz.x1, horiz.x2) - 500) < 1e-6, "horiz va à x=500");
ok(sq.diamond.length === 4, "losange 4 points");
ok(sq.strokeWeight > 0, "strokeWeight présent");
ok(sq.letterHeight > 0, "letterHeight présent");

/* --- forme inclinée (parallélogramme à la plume) : croix inclinée, centrée --- */
const para = g.computeCote([
  { x: 0, y: 0 }, { x: 400, y: 100 }, { x: 400, y: 300 }, { x: 0, y: 200 }
], "B", {});
close(para.center.x, 200, "centre parallélogramme x");
close(para.center.y, 150, "centre parallélogramme y");
// la "largeur" (bimédiane reliant milieux gauche/droite) est inclinée : dy != 0
const tilted = para.lines.some(function (l) { return Math.abs(l.y2 - l.y1) > 1e-6 && Math.abs(l.x2 - l.x1) > 1e-6; });
ok(tilted, "au moins une bimédiane inclinée (suit la forme)");

/* --- placement : repère toujours centré, plafonné pour tenir dans la zone --- */
eq([sq.center.x, sq.center.y], [300, 200], "repère centré = centroïde");
// bandeau très fin : le repère reste lisible et se décale LE LONG de la flèche
const band = g.computeCote(g.cornersFromBounds([0, 0, 12, 400]), "C", {});
ok(band.centered === false, "petite zone -> repère décalé");
ok(band.badge >= 12, "repère gardé lisible (non rétréci)");
ok(band.center.x > 200 && band.center.x < 400, "décalé le long de la flèche, hors croisement, pas à la pointe");
ok(Math.abs(band.center.y - 6) < 1e-6, "reste SUR le tracé (axe horizontal)");
// grande zone : centré
ok(sq.centered === true, "grande zone -> repère centré");

/* --- adaptation à la surface --- */
const small = g.computeCote(g.cornersFromBounds([0, 0, 60, 60]), "A", {});
const big = g.computeCote(g.cornersFromBounds([0, 0, 600, 600]), "A", {});
ok(small.strokeWeight < big.strokeWeight, "trait petit < trait grand");
// têtes de flèche dessinées : 4 triangles, taille proportionnelle à la zone
ok(sq.heads.length === 4, "4 têtes de flèche (2 par flèche)");
sq.heads.forEach(function (t) { ok(t.length === 3, "tête = triangle (3 points)"); });
const headSpanSmall = Math.abs(small.heads[0][0][0] - small.heads[0][1][0]) + Math.abs(small.heads[0][0][1] - small.heads[0][1][1]);
const headSpanBig = Math.abs(big.heads[0][0][0] - big.heads[0][1][0]) + Math.abs(big.heads[0][0][1] - big.heads[0][1][1]);
ok(headSpanSmall < headSpanBig, "têtes plus petites sur petite zone");
ok(small.letterHeight < big.letterHeight, "lettre petite < lettre grande");
const dSmall = small.diamond[2][1] - small.diamond[0][1];
const dBig = big.diamond[2][1] - big.diamond[0][1];
ok(dSmall < dBig, "losange petit < losange grand");

console.log("OK — " + pass + " assertions passées.");
