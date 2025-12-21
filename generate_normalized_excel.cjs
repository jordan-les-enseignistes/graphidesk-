const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'supabase', 'migrations', 'SUIVI_GRAPHISTES (2).xlsx');
const workbook = XLSX.readFile(filePath);

console.log("=== GÉNÉRATION DU FICHIER EXCEL NORMALISÉ ===\n");

// Liste de tous les graphistes (actifs et anciens)
const graphistes = [
  // Actifs
  "JORDAN", "CAROLE", "JULIETTE", "QUENTIN",
  // Anciens
  "HUGO", "AUDREY", "LAURIE", "GUILLAUME", "MARION",
  "LUCIE", "PAUL", "FRANK", "JB", "MICKAEL", "DAVID", "MARIE"
];

// Données pour les nouvelles feuilles
const dossiersActifs = [];
const archives = [];

// En-têtes
const headerDossiers = ["Graphiste", "Nom", "Date création", "Statut", "Commentaires"];

// Fonction pour nettoyer et valider une ligne
function isValidDossier(nom) {
  if (!nom) return false;
  const nomStr = String(nom).trim();
  if (nomStr.length < 3) return false;
  if (['VRAI', 'FAUX', 'TRUE', 'FALSE'].includes(nomStr.toUpperCase())) return false;
  if (nomStr.toUpperCase().includes('DOSSIER')) return false;
  if (nomStr.toUpperCase().includes('ARCHIVE')) return false;
  return true;
}

// Fonction pour parser une date Excel
function parseDate(dateValue) {
  if (!dateValue) return null;

  // Si c'est un nombre (date Excel)
  if (typeof dateValue === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + dateValue * 86400000);
    return date.toISOString().split('T')[0];
  }

  // Si c'est une chaîne de date
  const dateStr = String(dateValue).trim();
  if (dateStr === '') return null;

  // Format DD/MM/YYYY
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    return `${year}-${month}-${day}`;
  }

  // Format DD/MM (sans année - ajouter l'année courante)
  const matchShort = dateStr.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (matchShort) {
    const day = matchShort[1].padStart(2, '0');
    const month = matchShort[2].padStart(2, '0');
    const year = new Date().getFullYear();
    return `${year}-${month}-${day}`;
  }

  // Format YYYY-MM-DD (déjà correct)
  const matchIso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (matchIso) {
    return dateStr;
  }

  return null;
}

// Traiter chaque feuille de graphiste
console.log("--- Traitement des graphistes ---\n");

graphistes.forEach(graphisteName => {
  const sheet = workbook.Sheets[graphisteName];
  if (!sheet) {
    console.log(`⚠️  Feuille "${graphisteName}" non trouvée`);
    return;
  }

  const rawData = XLSX.utils.sheet_to_json(sheet, {
    defval: null,
    raw: false,
    header: 1
  });

  let dossiersCount = 0;
  let archivesCount = 0;

  // Parcourir les lignes (en sautant les 2 premières lignes d'en-tête)
  for (let i = 2; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row) continue;

    const nom = row[1]; // Colonne B
    if (!isValidDossier(nom)) continue;

    const nomStr = String(nom).trim();
    const dateRaw = row[2]; // Colonne C
    const statutRaw = row[6]; // Colonne G
    const commentairesRaw = row[7]; // Colonne H
    const termineRaw = row[8]; // Colonne I

    const date = parseDate(dateRaw);
    const statut = statutRaw ? String(statutRaw).trim() : "";
    const commentaires = commentairesRaw ? String(commentairesRaw).trim() : "";

    // Déterminer si c'est une archive
    const isArchive = termineRaw &&
      ['VRAI', 'TRUE', 'OUI', 'YES', '1'].includes(String(termineRaw).toUpperCase().trim());

    const dossierData = [graphisteName, nomStr, date || "", statut, commentaires];

    if (isArchive) {
      archives.push(dossierData);
      archivesCount++;
    } else {
      dossiersActifs.push(dossierData);
      dossiersCount++;
    }
  }

  console.log(`✓ ${graphisteName}: ${dossiersCount} actifs, ${archivesCount} archives`);
});

// Traiter la feuille ARCHIVE globale
console.log("\n--- Traitement de la feuille ARCHIVE ---\n");

const archiveSheet = workbook.Sheets['ARCHIVE'];
if (archiveSheet) {
  const archiveData = XLSX.utils.sheet_to_json(archiveSheet, {
    defval: null,
    raw: false,
    header: 1
  });

  let archiveCount = 0;

  for (let i = 2; i < archiveData.length; i++) {
    const row = archiveData[i];
    if (!row) continue;

    const nom = row[1];
    if (!isValidDossier(nom)) continue;

    const nomStr = String(nom).trim();
    const initialesRaw = row[0];
    const dateRaw = row[2];
    const statutRaw = row[6];
    const commentairesRaw = row[7];

    // Mapper les initiales au nom du graphiste
    let graphiste = "INCONNU";
    if (initialesRaw) {
      const initiales = String(initialesRaw).trim().toUpperCase();
      const mapping = {
        'J': 'JORDAN', 'JORDAN': 'JORDAN',
        'C': 'CAROLE', 'CAROLE': 'CAROLE',
        'JU': 'JULIETTE', 'JULIETTE': 'JULIETTE',
        'Q': 'QUENTIN', 'QUENTIN': 'QUENTIN',
        'H': 'HUGO', 'HUGO': 'HUGO',
        'A': 'AUDREY', 'AUDREY': 'AUDREY',
        'L': 'LAURIE', 'LAURIE': 'LAURIE',
        'G': 'GUILLAUME', 'GUILLAUME': 'GUILLAUME',
        'MA': 'MARION', 'MARION': 'MARION',
        'LU': 'LUCIE', 'LUCIE': 'LUCIE',
        'P': 'PAUL', 'PAUL': 'PAUL',
        'F': 'FRANK', 'FRANK': 'FRANK',
        'JB': 'JB',
        'MI': 'MICKAEL', 'MICKAEL': 'MICKAEL', 'M': 'MICKAEL',
        'D': 'DAVID', 'DAVID': 'DAVID',
        'MR': 'MARIE', 'MARIE': 'MARIE'
      };
      graphiste = mapping[initiales] || initiales;
    }

    const date = parseDate(dateRaw);
    const statut = statutRaw ? String(statutRaw).trim() : "";
    const commentaires = commentairesRaw ? String(commentairesRaw).trim() : "";

    archives.push([graphiste, nomStr, date || "", statut, commentaires]);
    archiveCount++;
  }

  console.log(`✓ ARCHIVE: ${archiveCount} dossiers ajoutés`);
}

// Traiter FRANCHISES
console.log("\n--- Traitement de FRANCHISES ---\n");

const franchisesSheet = workbook.Sheets['FRANCHISES'];
const franchisesData = [];
const headerFranchises = ["Nom"];
graphistes.filter(g => ['JORDAN', 'CAROLE', 'JULIETTE', 'QUENTIN'].includes(g)).forEach(g => headerFranchises.push(g));

if (franchisesSheet) {
  const rawFranchises = XLSX.utils.sheet_to_json(franchisesSheet, {
    defval: null,
    raw: false,
    header: 1
  });

  for (let i = 1; i < rawFranchises.length; i++) {
    const row = rawFranchises[i];
    if (!row || !row[0]) continue;

    const nom = String(row[0]).trim();
    if (nom.length < 2) continue;

    // Colonnes: Nom, Jordan, Carole, Juliette, Quentin
    franchisesData.push([
      nom,
      row[1] || "",
      row[2] || "",
      row[3] || "",
      row[4] || ""
    ]);
  }

  console.log(`✓ FRANCHISES: ${franchisesData.length} franchises`);
}

// Traiter PROJETS_INTERNE
console.log("\n--- Traitement de PROJETS_INTERNE ---\n");

const projetsSheet = workbook.Sheets['PROJETS_INTERNE'];
const projetsData = [];
const headerProjets = ["Commercial", "Tâche", "Demande", "Graphiste", "Terminé"];

if (projetsSheet) {
  const rawProjets = XLSX.utils.sheet_to_json(projetsSheet, {
    defval: null,
    raw: false,
    header: 1
  });

  for (let i = 1; i < rawProjets.length; i++) {
    const row = rawProjets[i];
    if (!row) continue;

    const tache = row[1] ? String(row[1]).trim() : "";
    if (tache.length < 2) continue;

    projetsData.push([
      row[0] ? String(row[0]).trim() : "",
      tache,
      row[2] ? String(row[2]).trim() : "",
      row[3] ? String(row[3]).trim() : "",
      row[4] ? String(row[4]).trim() : ""
    ]);
  }

  console.log(`✓ PROJETS_INTERNE: ${projetsData.length} projets`);
}

// Créer le nouveau workbook
console.log("\n--- Création du fichier normalisé ---\n");

const newWorkbook = XLSX.utils.book_new();

// Feuille DOSSIERS_ACTIFS
const wsActifs = XLSX.utils.aoa_to_sheet([headerDossiers, ...dossiersActifs]);
XLSX.utils.book_append_sheet(newWorkbook, wsActifs, "DOSSIERS_ACTIFS");
console.log(`✓ DOSSIERS_ACTIFS: ${dossiersActifs.length} lignes`);

// Feuille ARCHIVES
const wsArchives = XLSX.utils.aoa_to_sheet([headerDossiers, ...archives]);
XLSX.utils.book_append_sheet(newWorkbook, wsArchives, "ARCHIVES");
console.log(`✓ ARCHIVES: ${archives.length} lignes`);

// Feuille FRANCHISES
const wsFranchises = XLSX.utils.aoa_to_sheet([headerFranchises, ...franchisesData]);
XLSX.utils.book_append_sheet(newWorkbook, wsFranchises, "FRANCHISES");
console.log(`✓ FRANCHISES: ${franchisesData.length} lignes`);

// Feuille PROJETS
const wsProjets = XLSX.utils.aoa_to_sheet([headerProjets, ...projetsData]);
XLSX.utils.book_append_sheet(newWorkbook, wsProjets, "PROJETS");
console.log(`✓ PROJETS: ${projetsData.length} lignes`);

// Sauvegarder le fichier
const outputPath = path.join(__dirname, 'supabase', 'migrations', 'SUIVI_GRAPHISTES_NORMALISE.xlsx');
XLSX.writeFile(newWorkbook, outputPath);

console.log(`\n=== FICHIER CRÉÉ: ${outputPath} ===`);
console.log("\nStructure du nouveau fichier:");
console.log("1. DOSSIERS_ACTIFS - Tous les dossiers actifs de tous les graphistes");
console.log("2. ARCHIVES - Tous les dossiers terminés/archivés");
console.log("3. FRANCHISES - Les franchises avec assignations");
console.log("4. PROJETS - Les projets internes");
