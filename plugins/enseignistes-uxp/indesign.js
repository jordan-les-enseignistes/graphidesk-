/*
 * indesign.js
 * Toutes les opérations sur le document InDesign.
 * Portage fidèle des fonctions de la V5 (.jsx) vers l'API DOM UXP.
 * Rappel : en UXP, les écritures DOM sont synchrones et directes,
 * exactement comme en ExtendScript (pas de transaction, pas d'await).
 */

const { app, FitOptions } = require("indesign");

/* Vrai si l'objet sélectionné est un bloc texte. */
function isTextFrame(o) {
  if (!o) return false;
  if (o.constructorName) return o.constructorName === "TextFrame";
  try {
    var TextFrame = require("indesign").TextFrame;
    return o instanceof TextFrame;
  } catch (e) {
    return false;
  }
}

/* Bloc texte actuellement sélectionné, ou null. */
function getSelectedTextFrame() {
  if (!app.documents.length) return null;
  var sel = app.selection;
  if (!sel || !sel.length) return null;
  return isTextFrame(sel[0]) ? sel[0] : null;
}

/* Augmente la hauteur du bloc seulement si le texte déborde. */
function adjustFrameHeightIfOverflow(frame) {
  if (frame.overflows) {
    var gb = frame.geometricBounds; // [y1, x1, y2, x2]
    while (frame.overflows) {
      gb[2] += 1;
      frame.geometricBounds = gb;
    }
  }
}

/* Ajuste la hauteur au contenu en conservant la largeur d'origine. */
function fitFrameHeightOnly(frame) {
  var originalBounds = frame.geometricBounds;
  frame.fit(FitOptions.FRAME_TO_CONTENT);
  var newBounds = frame.geometricBounds;
  frame.geometricBounds = [newBounds[0], originalBounds[1], newBounds[2], originalBounds[3]];
}

/* Écrit le texte dans le bloc sélectionné et ajuste la hauteur si débordement. */
function applyToSelection(texte) {
  var frame = getSelectedTextFrame();
  if (!frame) {
    return { ok: false, message: "Veuillez sélectionner un bloc texte." };
  }
  frame.contents = texte;
  adjustFrameHeightIfOverflow(frame);
  return { ok: true };
}

/*
 * Duplique le bloc de gauche (le numéro) + le bloc courant, sous la ligne
 * courante, en incrémentant la numérotation. Portage de duplicateLeftOrigAndFit.
 */
function duplicateLeftOrigAndFit() {
  var original = getSelectedTextFrame();
  if (!original) {
    return { ok: false, message: "Veuillez sélectionner un bloc de texte." };
  }

  var ob = original.geometricBounds;
  var page = original.parentPage;

  var siblings = page.textFrames.everyItem().getElements();
  var leftFrames = [];
  for (var i = 0; i < siblings.length; i++) {
    var f = siblings[i];
    var b = f.geometricBounds;
    if (Math.abs(b[0] - ob[0]) < 2 && b[3] < ob[1]) {
      leftFrames.push(f);
    }
  }
  if (leftFrames.length === 0) {
    return { ok: false, message: "Aucun bloc de numérotation trouvé à gauche." };
  }

  leftFrames.sort(function (a, b) {
    return b.geometricBounds[3] - a.geometricBounds[3];
  });

  var left = leftFrames[0];
  var dupLeft = left.duplicate();
  var dupOrig = original.duplicate();
  dupOrig.contents = "xxxx";

  var obHeight = ob[2] - ob[0];
  var topOffset = ob[0] + obHeight + 2;

  // Positionnement initial dupOrig
  var dob = dupOrig.geometricBounds;
  var height = dob[2] - dob[0];
  dupOrig.geometricBounds = [topOffset, dob[1], topOffset + height, dob[3]];

  // Redimensionnement hauteur uniquement
  fitFrameHeightOnly(dupOrig);

  // Numérotation
  var n = parseInt(left.contents, 10);
  var num = isNaN(n) ? 0 : n;
  var newNum = num + 1;
  dupLeft.contents = newNum + " :";

  // Décalage horizontal si numéro 10
  if (newNum === 10) {
    var gbX = dupOrig.geometricBounds;
    var h = gbX[2] - gbX[0];
    dupOrig.geometricBounds = [gbX[0], gbX[1] + 3, gbX[0] + h, gbX[3]];
  }

  // Positionnement dupLeft
  var dlb = dupLeft.geometricBounds;
  var leftHeight = dlb[2] - dlb[0];
  dupLeft.geometricBounds = [topOffset, dlb[1], topOffset + leftHeight, dlb[3]];

  // Fit largeur uniquement dupLeft
  var fixedH = dupLeft.geometricBounds[2] - dupLeft.geometricBounds[0];
  dupLeft.fit(FitOptions.FRAME_TO_CONTENT);
  var fitted = dupLeft.geometricBounds;
  dupLeft.geometricBounds = [fitted[0], fitted[1], fitted[0] + fixedH, fitted[3]];

  app.select(dupLeft);
  return { ok: true };
}

module.exports = {
  getSelectedTextFrame: getSelectedTextFrame,
  applyToSelection: applyToSelection,
  duplicateLeftOrigAndFit: duplicateLeftOrigAndFit
};
