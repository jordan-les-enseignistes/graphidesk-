// ============================================================
// gabarit_personnaliser.jsx — met un gabarit BAT au nom du graphiste
// ============================================================
// Remplace UNIQUEMENT l'identité du graphiste (son nom sous ses différentes
// formes, et son adresse e-mail) dans un gabarit InDesign téléchargé.
//
// ⚠ Tout le reste doit rester intact : les autres adresses et les numéros de
//    téléphone présents dans le document sont ceux des COMMERCIAUX, ils ne
//    changent pas d'un graphiste à l'autre (consigne Jordan, 05/08/2026).
//    D'où des remplacements explicites, jamais de nettoyage « intelligent ».
//
// params attendus :
//   fichier        chemin du .indd à personnaliser (modifié sur place)
//   remplacements  [[avant, apres], ...] — appliqués DANS L'ORDRE reçu, ce qui
//                  permet de traiter « Jordan NEAU » avant « Jordan » seul.
//
// Écrit <temp>/graphidesk_gabarit.json : { remplacements: n, details, erreur? }

(function (params) {
  var SORTIE = Folder.temp + "/graphidesk_gabarit.json";

  function ecrire(txt) {
    var f = new File(SORTIE);
    f.encoding = "UTF-8";
    f.open("w");
    f.write(txt);
    f.close();
  }

  function echappe(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  var doc = null;
  var oldUIL = null;
  var oldFind = null;
  try {
    oldUIL = app.scriptPreferences.userInteractionLevel;
    app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;
  } catch (eU) {}

  try {
    if (!params || !params.fichier) throw new Error("aucun fichier fourni");
    var couples = params.remplacements || [];
    if (couples.length === 0) throw new Error("rien à remplacer");

    var cible = new File(params.fichier);
    if (!cible.exists) throw new Error("fichier introuvable : " + params.fichier);

    // sans fenêtre : plus rapide, et l'écran du graphiste ne clignote pas
    doc = app.open(cible, false);

    // ⚠ Les préférences de recherche sont GLOBALES et persistent d'un script
    // à l'autre : on les remet à zéro avant, et on les restaure après, sinon
    // une casse ou un « mot entier » laissé par un autre script fausse tout.
    oldFind = {
      casse: app.findChangeTextOptions.caseSensitive,
      motEntier: app.findChangeTextOptions.wholeWord,
      verrouilles: app.findChangeTextOptions.includeLockedLayersForFind,
      gabarits: app.findChangeTextOptions.includeMasterPages,
      masques: app.findChangeTextOptions.includeHiddenLayers,
      notes: app.findChangeTextOptions.includeFootnotes,
    };
    app.findTextPreferences = NothingEnum.NOTHING;
    app.changeTextPreferences = NothingEnum.NOTHING;
    app.findChangeTextOptions.caseSensitive = true; // « NEAU » ≠ « Neau »
    app.findChangeTextOptions.wholeWord = false;
    app.findChangeTextOptions.includeLockedLayersForFind = false;
    // le bloc de contact vit souvent sur un gabarit de page ; et rien
    // n'interdit qu'il soit sur un calque masqué, que la recherche ignore
    // par défaut — un nom manqué là partirait chez le client
    app.findChangeTextOptions.includeMasterPages = true;
    app.findChangeTextOptions.includeHiddenLayers = true;
    app.findChangeTextOptions.includeFootnotes = true;

    var total = 0;
    var details = [];
    for (var c = 0; c < couples.length; c++) {
      var avant = String(couples[c][0]);
      var apres = String(couples[c][1]);
      if (avant === "" || avant === apres) continue;
      app.findTextPreferences.findWhat = avant;
      app.changeTextPreferences.changeTo = apres;
      var touches = doc.changeText();
      var n = touches ? touches.length : 0;
      total += n;
      details.push('{"avant":"' + echappe(avant) + '","fois":' + n + "}");
      app.findTextPreferences = NothingEnum.NOTHING;
      app.changeTextPreferences = NothingEnum.NOTHING;
    }

    // ⚠ `save()` sans argument fait une sauvegarde INCRÉMENTALE : le document
    // affiche bien le nouveau nom, mais l'ancien reste récupérable dans le
    // fichier livré (vérifié à l'octet). `save(File)` force une sauvegarde
    // complète, qui compacte et efface l'historique.
    doc.save(cible);
    doc.close(SaveOptions.NO);
    doc = null;
    ecrire('{"remplacements":' + total + ',"details":[' + details.join(",") + "]}");
  } catch (e) {
    try {
      if (doc) doc.close(SaveOptions.NO);
    } catch (eC) {}
    ecrire('{"remplacements":0,"erreur":"' + echappe(e) + '"}');
  }

  try {
    app.findTextPreferences = NothingEnum.NOTHING;
    app.changeTextPreferences = NothingEnum.NOTHING;
    if (oldFind) {
      app.findChangeTextOptions.caseSensitive = oldFind.casse;
      app.findChangeTextOptions.wholeWord = oldFind.motEntier;
      app.findChangeTextOptions.includeLockedLayersForFind = oldFind.verrouilles;
      app.findChangeTextOptions.includeMasterPages = oldFind.gabarits;
      app.findChangeTextOptions.includeHiddenLayers = oldFind.masques;
      app.findChangeTextOptions.includeFootnotes = oldFind.notes;
    }
    if (oldUIL !== null) app.scriptPreferences.userInteractionLevel = oldUIL;
  } catch (eV) {}
})(typeof params !== "undefined" ? params : {});
