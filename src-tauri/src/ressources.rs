// ============================================================
// Kit du nouvel arrivant — installation des ressources de l'atelier
// ============================================================
// Le graphiste ne doit RIEN savoir de l'endroit où Adobe range ses
// préréglages. Ce module résout la destination pour chaque type de ressource,
// y dépose le fichier, et sait dire ce qui est déjà installé.
//
// Deux pièges constatés sur les postes de l'atelier, qui interdisent d'écrire
// le moindre chemin en dur :
//   1. les dossiers Adobe sont LOCALISÉS  — « Nuancier » en français,
//      « Swatches » en anglais ;
//   2. leur numéro de version bouge à chaque millésime — « Adobe Illustrator
//      30 Settings », « InDesign\Version 21.0 ».
// On les retrouve donc en parcourant, en prenant toujours la version la plus
// récente, et on remonte une erreur qui DIT ce qui a été cherché plutôt qu'un
// « fichier introuvable » inexploitable par téléphone.

use serde::Serialize;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

/// Où atterrit une ressource, selon sa catégorie.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Cible {
    /// Préréglages « Nuancier » d'Illustrator — programme ET profil utilisateur
    NuancierIllustrator,
    /// Panneau « Scripts » d'InDesign
    ScriptIndesign,
    /// Aucun dossier système ne convient : on range dans Documents
    Documents,
}

impl Cible {
    fn depuis_categorie(categorie: &str) -> Cible {
        match categorie {
            "nuancier" => Cible::NuancierIllustrator,
            "script_indesign" => Cible::ScriptIndesign,
            _ => Cible::Documents,
        }
    }
}

fn appdata() -> Result<PathBuf, String> {
    env::var("APPDATA")
        .map(PathBuf::from)
        .map_err(|_| "Variable APPDATA introuvable".to_string())
}

/// Sous-dossiers d'un répertoire, triés du plus récent au plus ancien d'après
/// le premier nombre trouvé dans leur nom. « Adobe Illustrator 30 Settings »
/// passe donc avant « ... 29 Settings », et « Version 21.0 » avant « 20.0 ».
fn sous_dossiers_par_version_decroissante(racine: &Path, motif: &str) -> Vec<PathBuf> {
    let motif = motif.to_lowercase();
    let mut trouves: Vec<(f64, PathBuf)> = Vec::new();
    let Ok(entrees) = fs::read_dir(racine) else {
        return Vec::new();
    };
    for e in entrees.flatten() {
        if !e.path().is_dir() {
            continue;
        }
        let nom = e.file_name().to_string_lossy().to_string();
        if !nom.to_lowercase().contains(&motif) {
            continue;
        }
        trouves.push((numero_de_version(&nom), e.path()));
    }
    trouves.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    trouves.into_iter().map(|(_, p)| p).collect()
}

/// Premier nombre (décimal accepté) d'un nom de dossier, 0 s'il n'y en a pas.
fn numero_de_version(nom: &str) -> f64 {
    let mut courant = String::new();
    for c in nom.chars() {
        if c.is_ascii_digit() || (c == '.' && !courant.is_empty()) {
            courant.push(c);
        } else if !courant.is_empty() {
            break;
        }
    }
    courant.trim_end_matches('.').parse().unwrap_or(0.0)
}

/// Premier sous-dossier portant l'un des noms donnés (comparaison insensible à
/// la casse). C'est ce qui absorbe la localisation des dossiers Adobe.
fn sous_dossier_nomme(racine: &Path, noms: &[&str]) -> Option<PathBuf> {
    let entrees = fs::read_dir(racine).ok()?;
    for e in entrees.flatten() {
        if !e.path().is_dir() {
            continue;
        }
        let nom = e.file_name().to_string_lossy().to_lowercase();
        if noms.iter().any(|n| n.to_lowercase() == nom) {
            return Some(e.path());
        }
    }
    None
}

/// Le sous-dossier de langue d'un réglage Adobe (fr_FR, en_US...). Il n'y en a
/// qu'un en pratique, mais son nom dépend de l'installation.
fn dossier_de_langue(racine: &Path) -> Option<PathBuf> {
    let entrees = fs::read_dir(racine).ok()?;
    let mut candidats: Vec<PathBuf> = entrees
        .flatten()
        .map(|e| e.path())
        .filter(|p| {
            p.is_dir()
                && p.file_name()
                    .map(|n| {
                        let n = n.to_string_lossy();
                        n.len() == 5 && n.as_bytes()[2] == b'_'
                    })
                    .unwrap_or(false)
        })
        .collect();
    candidats.sort();
    candidats.into_iter().next()
}

/// Dossiers « Nuancier » d'Illustrator, par ordre de préférence.
///
/// ⚠ Il y en a DEUX, et c'est la source d'une erreur qu'on a payée :
///   1. côté PROGRAMME — <programme>\Adobe Illustrator <année>\Presets\<langue>\
///      Nuancier. C'est là que vivent les bibliothèques livrées par Adobe, et
///      c'est là que l'atelier a toujours rangé les siennes. Écriture soumise
///      aux droits administrateur.
///   2. côté UTILISATEUR — %APPDATA%\Adobe\Adobe Illustrator <NN> Settings\
///      <langue>\x64\Nuancier. Pas de droits particuliers.
/// On regarde donc les deux pour dire si une ressource est installée : ne
/// consulter que le second faisait passer pour « absents » des nuanciers
/// présents depuis toujours.
fn dossiers_nuancier_illustrator() -> Vec<PathBuf> {
    let mut out = Vec::new();

    // --- côté programme ---
    for base in [env::var("PROGRAMFILES").ok(), env::var("ProgramW6432").ok()]
        .into_iter()
        .flatten()
    {
        let adobe = PathBuf::from(base).join("Adobe");
        for prog in sous_dossiers_par_version_decroissante(&adobe, "Adobe Illustrator") {
            let presets = prog.join("Presets");
            let Some(langue) = dossier_de_langue(&presets) else {
                continue;
            };
            if let Some(d) = sous_dossier_nomme(&langue, &["Nuancier", "Swatches"]) {
                if !out.contains(&d) {
                    out.push(d);
                }
            }
        }
    }

    // --- côté utilisateur ---
    if let Ok(appdata) = appdata() {
        let adobe = appdata.join("Adobe");
        for r in sous_dossiers_par_version_decroissante(&adobe, "Adobe Illustrator") {
            // « Adobe Illustrator Library 30 Settings » existe aussi : ce n'est
            // pas le dossier de préréglages, on ne le retient pas.
            if r.file_name()
                .map(|n| n.to_string_lossy().contains("Library"))
                .unwrap_or(false)
            {
                continue;
            }
            let Some(langue) = dossier_de_langue(&r) else {
                continue;
            };
            // « x64 » sur les versions récentes ; certaines installations n'ont
            // pas ce niveau, on accepte les deux.
            let base = if langue.join("x64").is_dir() {
                langue.join("x64")
            } else {
                langue.clone()
            };
            if let Some(d) = sous_dossier_nomme(&base, &["Nuancier", "Swatches"]) {
                if !out.contains(&d) {
                    out.push(d);
                }
            }
        }
    }
    out
}

/// Panneau Scripts d'InDesign.
/// %APPDATA%\Adobe\InDesign\Version <NN.N>\<langue>\Scripts\Scripts Panel
fn dossier_scripts_indesign() -> Result<PathBuf, String> {
    let racine = appdata()?.join("Adobe").join("InDesign");
    let versions = sous_dossiers_par_version_decroissante(&racine, "Version");
    for v in &versions {
        let Some(langue) = dossier_de_langue(v) else {
            continue;
        };
        let Some(scripts) = sous_dossier_nomme(&langue, &["Scripts"]) else {
            continue;
        };
        // Le panneau lui-même : Adobe le crée au premier lancement, mais s'il
        // manque on peut le créer sans risque — InDesign le lit tel quel.
        let panneau = sous_dossier_nomme(&scripts, &["Scripts Panel", "Panneau Scripts"])
            .unwrap_or_else(|| scripts.join("Scripts Panel"));
        fs::create_dir_all(&panneau)
            .map_err(|e| format!("Création du panneau Scripts impossible : {}", e))?;
        return Ok(panneau);
    }
    Err(format!(
        "Panneau Scripts d'InDesign introuvable sous {}. Ouvre InDesign une \
         première fois — il crée ses dossiers au premier lancement.",
        racine.to_string_lossy()
    ))
}

fn dossier_documents() -> Result<PathBuf, String> {
    let profil =
        env::var("USERPROFILE").map_err(|_| "Variable USERPROFILE introuvable".to_string())?;
    Ok(PathBuf::from(profil)
        .join("Documents")
        .join("Les Enseignistes"))
}

/// Tous les emplacements où une ressource de cette catégorie peut se trouver,
/// du plus canonique au plus secondaire. Sert à répondre « déjà installé ? »
/// sans se limiter à l'endroit où NOUS aurions écrit.
fn dossiers_cible(cible: Cible) -> Result<Vec<PathBuf>, String> {
    match cible {
        Cible::NuancierIllustrator => {
            let d = dossiers_nuancier_illustrator();
            if d.is_empty() {
                Err("Dossier des nuanciers Illustrator introuvable, ni dans les \
                     préréglages du programme ni dans ton profil. Ouvre Illustrator \
                     une première fois."
                    .to_string())
            } else {
                Ok(d)
            }
        }
        Cible::ScriptIndesign => dossier_scripts_indesign().map(|d| vec![d]),
        Cible::Documents => dossier_documents().map(|d| vec![d]),
    }
}

fn dossier_cible(cible: Cible) -> Result<PathBuf, String> {
    dossiers_cible(cible).map(|mut d| d.remove(0))
}

/// Échappe un chemin pour l'insérer dans une chaîne PowerShell entre
/// apostrophes : dans ce mode PowerShell n'interprète rien, sauf l'apostrophe
/// elle-même, qui se double.
fn pour_powershell(p: &Path) -> String {
    p.to_string_lossy().replace('\'', "''")
}

/// Rejoue une opération de fichier AVEC les droits administrateur, via
/// l'invite UAC de Windows.
///
/// ⚠ Les préréglages d'Illustrator vivent dans « Program Files » : c'est là
/// que l'atelier range ses nuanciers, et Windows y interdit l'écriture aux
/// programmes ordinaires. Plutôt que de relancer TOUT GraphiDesk en
/// administrateur, on n'élève que cette opération-là — l'invite est explicite
/// et rien d'autre ne tourne avec ces droits.
#[cfg(windows)]
fn executer_eleve(commande: &str) -> Result<(), String> {
    let sortie = hidden_command_res("powershell")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &format!(
                "Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden \
                 -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-Command',\"{}\"",
                commande.replace('"', "`\"")
            ),
        ])
        .output()
        .map_err(|e| format!("Élévation impossible : {}", e))?;
    if sortie.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&sortie.stderr).trim().to_string())
    }
}

#[cfg(not(windows))]
fn executer_eleve(_commande: &str) -> Result<(), String> {
    Err("Élévation disponible uniquement sous Windows".into())
}

/// Comme `hidden_command` du module principal : sans ce drapeau, lancer
/// PowerShell depuis une appli graphique fait clignoter une console noire.
#[cfg(windows)]
fn hidden_command_res(programme: &str) -> std::process::Command {
    use std::os::windows::process::CommandExt;
    let mut c = std::process::Command::new(programme);
    c.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    c
}

/// Refus de tout nom de fichier qui pourrait sortir du dossier visé.
fn nom_de_fichier_sur(nom: &str) -> Result<&str, String> {
    let propre = nom.trim();
    if propre.is_empty()
        || propre.contains("..")
        || propre.contains('/')
        || propre.contains('\\')
        || propre.contains(':')
    {
        return Err(format!("Nom de fichier invalide : « {} »", nom));
    }
    Ok(propre)
}

/// SHA-256 en hexadécimal, implémenté ici pour ne pas ajouter une dépendance
/// à une application qui n'en a besoin que pour comparer deux fichiers.
fn sha256_hex(donnees: &[u8]) -> String {
    const K: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
        0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
        0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
        0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
        0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
        0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
        0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
        0xc67178f2,
    ];
    let mut h: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
        0x5be0cd19,
    ];
    let mut msg = donnees.to_vec();
    let bits = (donnees.len() as u64) * 8;
    msg.push(0x80);
    while msg.len() % 64 != 56 {
        msg.push(0);
    }
    msg.extend_from_slice(&bits.to_be_bytes());

    for bloc in msg.chunks(64) {
        let mut w = [0u32; 64];
        for i in 0..16 {
            w[i] = u32::from_be_bytes([bloc[4 * i], bloc[4 * i + 1], bloc[4 * i + 2], bloc[4 * i + 3]]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16]
                .wrapping_add(s0)
                .wrapping_add(w[i - 7])
                .wrapping_add(s1);
        }
        let (mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut hh) =
            (h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7]);
        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let t1 = hh
                .wrapping_add(s1)
                .wrapping_add(ch)
                .wrapping_add(K[i])
                .wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let t2 = s0.wrapping_add(maj);
            hh = g;
            g = f;
            f = e;
            e = d.wrapping_add(t1);
            d = c;
            c = b;
            b = a;
            a = t1.wrapping_add(t2);
        }
        for (i, v) in [a, b, c, d, e, f, g, hh].iter().enumerate() {
            h[i] = h[i].wrapping_add(*v);
        }
    }
    h.iter().map(|x| format!("{:08x}", x)).collect()
}

#[derive(Serialize)]
pub struct StatutRessource {
    /// Dossier de destination, ou None s'il n'a pas pu être résolu
    pub dossier: Option<String>,
    /// Message expliquant pourquoi le dossier est introuvable
    pub erreur: Option<String>,
    /// La ressource est-elle déjà présente à destination ?
    pub installee: bool,
    /// Empreinte du fichier réellement présent sur le poste. Comparée à celle
    /// de la librairie, elle dit si une MISE À JOUR est à faire — la taille et
    /// la date, elles, mentent dès qu'un fichier est réenregistré.
    pub empreinte: Option<String>,
    /// Fichiers du même « genre » déjà présents, susceptibles d'être des
    /// versions périmées à faire disparaître. JAMAIS supprimés d'office.
    pub voisins: Vec<String>,
}

/// Racine d'un nom de fichier versionné : « BAT_Les_Enseignistes_V5.1.jsx »
/// donne « bat_les_enseignistes ». Sert à repérer les versions concurrentes.
fn racine_versionnee(nom: &str) -> String {
    let sans_ext = nom.rsplit_once('.').map(|(a, _)| a).unwrap_or(nom);
    let bas = sans_ext.to_lowercase();
    // on coupe au premier segment qui ressemble à « v5 », « v5.1 », « 5.1 »
    let mut garde: Vec<&str> = Vec::new();
    for seg in bas.split(['_', '-', ' ']) {
        let candidat = seg.strip_prefix('v').unwrap_or(seg);
        let versionne = !candidat.is_empty()
            && candidat
                .chars()
                .all(|c| c.is_ascii_digit() || c == '.')
            && candidat.chars().any(|c| c.is_ascii_digit());
        if versionne {
            break;
        }
        garde.push(seg);
    }
    garde.join("_")
}

#[tauri::command]
pub fn statut_ressource(categorie: String, fichier_nom: String) -> StatutRessource {
    let cible = Cible::depuis_categorie(&categorie);
    let dossiers = match dossiers_cible(cible) {
        Ok(d) => d,
        Err(e) => {
            return StatutRessource {
                dossier: None,
                erreur: Some(e),
                installee: false,
                empreinte: None,
                voisins: Vec::new(),
            }
        }
    };
    let dossier = dossiers[0].clone();
    let Ok(nom) = nom_de_fichier_sur(&fichier_nom) else {
        return StatutRessource {
            dossier: Some(dossier.to_string_lossy().to_string()),
            erreur: Some(format!("Nom de fichier invalide : « {} »", fichier_nom)),
            installee: false,
            empreinte: None,
            voisins: Vec::new(),
        };
    };
    // ⚠ « Installé » veut dire « présent quelque part où Illustrator ou
    // InDesign va le chercher » — pas « présent là où NOUS écririons ». Les
    // nuanciers de l'atelier vivent dans les préréglages du programme depuis
    // toujours ; ne regarder que le profil utilisateur les déclarait absents.
    let present = dossiers.iter().map(|d| d.join(nom)).find(|c| c.is_file());
    let installee = present.is_some();
    let empreinte = present
        .as_ref()
        .and_then(|c| fs::read(c).ok())
        .map(|o| sha256_hex(&o));
    // Versions concurrentes : même racine, nom différent.
    let racine = racine_versionnee(nom);
    let mut voisins = Vec::new();
    if !racine.is_empty() {
        for d in &dossiers {
            if let Ok(entrees) = fs::read_dir(d) {
                for e in entrees.flatten() {
                    let autre = e.file_name().to_string_lossy().to_string();
                    if autre != nom
                        && racine_versionnee(&autre) == racine
                        && !voisins.contains(&autre)
                    {
                        voisins.push(autre);
                    }
                }
            }
        }
    }
    voisins.sort();
    StatutRessource {
        dossier: Some(dossier.to_string_lossy().to_string()),
        erreur: None,
        installee,
        empreinte,
        voisins,
    }
}

/// Dépose la ressource à sa destination. Renvoie le chemin absolu écrit.
#[tauri::command]
pub fn installer_ressource(
    categorie: String,
    fichier_nom: String,
    contenu_base64: String,
) -> Result<String, String> {
    use base64::Engine;
    let nom = nom_de_fichier_sur(&fichier_nom)?;
    let dossiers = dossiers_cible(Cible::depuis_categorie(&categorie))?;
    let octets = base64::engine::general_purpose::STANDARD
        .decode(&contenu_base64)
        .map_err(|e| format!("Contenu illisible (base64) : {}", e))?;

    // ⚠ Un nuancier DOIT atterrir dans les préréglages du programme : c'est là
    // que l'atelier les range et là qu'Illustrator va les chercher. Se rabattre
    // en douce sur le profil utilisateur afficherait « installé » pour un
    // fichier qu'Illustrator ne proposerait jamais. On demande donc les droits
    // administrateur, et on échoue franchement si on ne les obtient pas.
    let strict = Cible::depuis_categorie(&categorie) == Cible::NuancierIllustrator;
    let candidats: &[PathBuf] = if strict { &dossiers[..1] } else { &dossiers };

    let mut refus = Vec::new();
    for dossier in candidats {
        let _ = fs::create_dir_all(dossier);
        let chemin = dossier.join(nom);
        match fs::write(&chemin, &octets) {
            Ok(()) => return Ok(chemin.to_string_lossy().to_string()),
            Err(e) => refus.push(format!("{} ({})", chemin.display(), e)),
        }
    }

    // Écriture refusée : on repasse par une élévation ponctuelle.
    let dossier = &candidats[0];
    let chemin = dossier.join(nom);
    let tampon = env::temp_dir().join(format!("graphidesk_install_{}", nom));
    fs::write(&tampon, &octets).map_err(|e| format!("Fichier temporaire impossible : {}", e))?;
    let commande = format!(
        "New-Item -ItemType Directory -Force -LiteralPath '{}' | Out-Null; \
         Copy-Item -LiteralPath '{}' -Destination '{}' -Force",
        pour_powershell(dossier),
        pour_powershell(&tampon),
        pour_powershell(&chemin)
    );
    let eleve = executer_eleve(&commande);
    let _ = fs::remove_file(&tampon);
    if chemin.is_file() {
        return Ok(chemin.to_string_lossy().to_string());
    }
    Err(format!(
        "Impossible d'installer « {} » dans {}.\n{}\n{}",
        nom,
        dossier.display(),
        refus.join("\n"),
        match eleve {
            Err(e) if !e.is_empty() => format!("Élévation refusée : {}", e),
            _ => "L'autorisation administrateur a été refusée ou annulée.".to_string(),
        }
    ))
}

/// Retire la ressource de CE POSTE (et de nulle part ailleurs). Ne touche pas
/// à la librairie partagée — c'est une opération volontairement distincte.
#[tauri::command]
pub fn desinstaller_ressource(categorie: String, fichier_nom: String) -> Result<String, String> {
    let nom = nom_de_fichier_sur(&fichier_nom)?;
    let dossiers = dossiers_cible(Cible::depuis_categorie(&categorie))?;
    let presents: Vec<PathBuf> = dossiers
        .iter()
        .map(|d| d.join(nom))
        .filter(|c| c.is_file())
        .collect();
    if presents.is_empty() {
        return Err(format!("« {} » n'est pas installé sur ce poste.", nom));
    }
    let mut restants = Vec::new();
    for chemin in &presents {
        if fs::remove_file(chemin).is_err() {
            restants.push(chemin.clone());
        }
    }
    if !restants.is_empty() {
        let commande = restants
            .iter()
            .map(|c| format!("Remove-Item -LiteralPath '{}' -Force", pour_powershell(c)))
            .collect::<Vec<_>>()
            .join("; ");
        let _ = executer_eleve(&commande);
    }
    let encore: Vec<String> = presents
        .iter()
        .filter(|c| c.is_file())
        .map(|c| c.display().to_string())
        .collect();
    if encore.is_empty() {
        Ok(presents
            .iter()
            .map(|c| c.display().to_string())
            .collect::<Vec<_>>()
            .join("\n"))
    } else {
        Err(format!(
            "Suppression refusée (droits administrateur) :\n{}",
            encore.join("\n")
        ))
    }
}

/// Supprime des versions périmées, et RIEN d'autre : chaque nom est vérifié
/// contre le dossier de la catégorie avant d'y toucher.
#[tauri::command]
pub fn supprimer_ressources_perimees(
    categorie: String,
    fichiers: Vec<String>,
) -> Result<usize, String> {
    let dossier = dossier_cible(Cible::depuis_categorie(&categorie))?;
    let mut n = 0;
    for f in fichiers {
        let nom = nom_de_fichier_sur(&f)?;
        let chemin = dossier.join(nom);
        if chemin.is_file() {
            fs::remove_file(&chemin)
                .map_err(|e| format!("Suppression de {} impossible : {}", chemin.display(), e))?;
            n += 1;
        }
    }
    Ok(n)
}

/// Dossier racine commun à TOUTES les entrées d'un zip, s'il existe — le
/// « NOMDUDOSSIER/ » que l'explorateur Windows ajoute en zippant un dossier.
/// Renvoie None dès qu'une entrée est à la racine de l'archive : il n'y a
/// alors rien à retirer.
fn racine_commune_du_zip(noms: &[String]) -> Option<String> {
    let mut racine: Option<String> = None;
    for n in noms {
        let n = n.trim_start_matches('/');
        let (tete, reste) = n.split_once('/')?;
        // une entrée « dossier/ » seule ne prouve pas que tout est dedans,
        // mais une entrée sans aucun « / » prouve le contraire (gérée ci-dessus)
        if tete.is_empty() || (reste.is_empty() && noms.len() == 1) {
            return None;
        }
        match &racine {
            None => racine = Some(tete.to_string()),
            Some(r) if r == tete => {}
            Some(_) => return None,
        }
    }
    racine.map(|r| format!("{}/", r))
}

/// Déplie un squelette de dossier (.zip) dans `destination`, en remplaçant le
/// jeton NOMDUDOSSIER par le nom du chantier — dossiers ET noms de fichiers.
/// Une seule règle, visible dans le zip lui-même : rien à configurer ailleurs.
#[tauri::command]
pub fn creer_arborescence(
    destination: String,
    nom_dossier: String,
    zip_base64: String,
) -> Result<String, String> {
    use base64::Engine;
    use std::io::Cursor;

    let nom = nom_dossier.trim();
    if nom.is_empty() {
        return Err("Donne un nom de dossier.".into());
    }
    if nom.contains(['/', '\\', ':', '*', '?', '"', '<', '>', '|']) {
        return Err(format!(
            "« {} » contient un caractère interdit dans un nom de dossier Windows.",
            nom
        ));
    }
    let racine = Path::new(&destination).join(nom);
    if racine.exists() {
        return Err(format!(
            "{} existe déjà — choisis un autre nom ou un autre emplacement.",
            racine.display()
        ));
    }

    let octets = base64::engine::general_purpose::STANDARD
        .decode(&zip_base64)
        .map_err(|e| format!("Squelette illisible (base64) : {}", e))?;
    let mut archive = zip::ZipArchive::new(Cursor::new(octets))
        .map_err(|e| format!("Squelette illisible (zip) : {}", e))?;

    // ⚠ Deux façons de zipper, deux archives différentes, et le graphiste ne
    // saura jamais laquelle il a produite :
    //   - l'explorateur Windows / Compress-Archive englobent le dossier
    //     d'origine et séparent avec des « \ » (contraire au format zip) ;
    //   - les autres partent du CONTENU, avec des « / ».
    // On normalise les séparateurs puis on retire l'éventuel dossier racine
    // commun, sinon on créerait un dossier imbriqué deux fois.
    let noms: Vec<String> = (0..archive.len())
        .filter_map(|i| archive.by_index(i).ok().map(|e| e.name().replace('\\', "/")))
        .collect();
    let racine_commune = racine_commune_du_zip(&noms);

    for i in 0..archive.len() {
        let mut entree = archive
            .by_index(i)
            .map_err(|e| format!("Entrée {} illisible : {}", i, e))?;
        let interne = entree.name().replace('\\', "/");
        // ⚠ garde-fou « zip slip » : sans lui, une archive piégée écrirait
        // n'importe où sur le poste via des « .. ».
        if interne.split('/').any(|s| s == ".." || s.contains(':')) {
            continue;
        }
        let sans_racine = match &racine_commune {
            Some(r) => interne.strip_prefix(r).unwrap_or(&interne),
            None => &interne,
        };
        let relatif = sans_racine.trim_matches('/').replace("NOMDUDOSSIER", nom);
        if relatif.is_empty() {
            continue;
        }
        let cible = racine.join(&relatif);
        if entree.is_dir() || interne.ends_with('/') {
            fs::create_dir_all(&cible)
                .map_err(|e| format!("Création de {} impossible : {}", cible.display(), e))?;
            continue;
        }
        if let Some(parent) = cible.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Création de {} impossible : {}", parent.display(), e))?;
        }
        let mut sortie = fs::File::create(&cible)
            .map_err(|e| format!("Écriture de {} impossible : {}", cible.display(), e))?;
        std::io::copy(&mut entree, &mut sortie)
            .map_err(|e| format!("Copie de {} interrompue : {}", cible.display(), e))?;
    }
    Ok(racine.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_lue_dans_le_nom_du_dossier() {
        assert_eq!(numero_de_version("Adobe Illustrator 30 Settings"), 30.0);
        assert_eq!(numero_de_version("Version 21.0"), 21.0);
        assert_eq!(numero_de_version("Adobe Illustrator"), 0.0);
    }

    #[test]
    fn racine_commune_aux_versions_dun_meme_script() {
        assert_eq!(
            racine_versionnee("BAT_Les_Enseignistes_V5.0.jsx"),
            racine_versionnee("BAT_Les_Enseignistes_V5.1.jsx")
        );
        assert_eq!(
            racine_versionnee("BAT_Les_Enseignistes_V5.0.jsx"),
            "bat_les_enseignistes"
        );
        // deux scripts DIFFÉRENTS ne doivent pas se croire versions l'un de l'autre
        assert_ne!(
            racine_versionnee("BAT_Les_Enseignistes_V5.0.jsx"),
            racine_versionnee("VT_Les_Enseignistes_V5.0.jsx")
        );
    }

    #[test]
    fn noms_de_fichiers_qui_sortent_du_dossier_refuses() {
        assert!(nom_de_fichier_sur("../evil.jsx").is_err());
        assert!(nom_de_fichier_sur("sous/dossier.jsx").is_err());
        assert!(nom_de_fichier_sur(r"C:\evil.jsx").is_err());
        assert!(nom_de_fichier_sur("RAL-Classic.ase").is_ok());
    }
}


#[cfg(test)]
mod tests_arborescence {
    use super::*;

    /// Construit un zip du squelette réel de l'atelier, dans l'un des deux
    /// styles rencontrés : l'explorateur Windows englobe le dossier d'origine
    /// et sépare avec des « \ » ; les autres outils partent du contenu.
    fn zip_squelette(avec_racine: bool) -> String {
        use base64::Engine;
        use std::io::Write;
        let sep = if avec_racine { "\\" } else { "/" };
        let prefixe = if avec_racine { "NOMDUDOSSIER\\" } else { "" };
        let dossiers = [
            "FAB_",
            "MAQUETTE",
            "MAQUETTE\\FP",
            "PROVISOIRE",
            "PROVISOIRE\\FAB-PROVISOIRE-CO----",
            "PROVISOIRE\\MAQUETTE-PROVISOIRE",
            "DOSSIER MAIRIE",
            "VT",
        ];
        let fichiers = [
            "BAT_NOMDUDOSSIER.indd",
            "DOSSIER MAIRIE\\BAT_MAIRIE_NOMDUDOSSIER.indd",
            "VT\\VT_NOMDUDOSSIER.indd",
        ];
        let mut buf = std::io::Cursor::new(Vec::new());
        {
            let mut w = zip::ZipWriter::new(&mut buf);
            let opts: zip::write::FileOptions<()> = zip::write::FileOptions::default();
            for d in dossiers {
                let n = format!("{}{}{}", prefixe, d.replace('\\', sep), sep);
                w.add_directory(n, opts).unwrap();
            }
            for f in fichiers {
                let n = format!("{}{}", prefixe, f.replace('\\', sep));
                w.start_file(n, opts).unwrap();
                w.write_all(b"contenu factice").unwrap();
            }
            w.finish().unwrap();
        }
        base64::engine::general_purpose::STANDARD.encode(buf.into_inner())
    }

    fn arbre(racine: &Path) -> Vec<String> {
        let mut out = Vec::new();
        let mut pile = vec![racine.to_path_buf()];
        while let Some(d) = pile.pop() {
            for e in fs::read_dir(&d).unwrap().flatten() {
                let p = e.path();
                let rel = p
                    .strip_prefix(racine)
                    .unwrap()
                    .to_string_lossy()
                    .replace('\\', "/");
                if p.is_dir() {
                    out.push(format!("{}/", rel));
                    pile.push(p);
                } else {
                    out.push(rel);
                }
            }
        }
        out.sort();
        out
    }

    /// Les deux façons de zipper le MÊME squelette doivent produire le même
    /// dossier de chantier. C'est le seul moyen de ne pas dépendre de l'outil
    /// avec lequel Jordan a fait son zip.
    #[test]
    fn les_deux_styles_de_zip_donnent_le_meme_dossier() {
        let sortie = std::env::temp_dir().join("graphidesk_test_arbo");
        let _ = fs::remove_dir_all(&sortie);
        fs::create_dir_all(&sortie).unwrap();

        let mut resultats = Vec::new();
        for (i, avec_racine) in [true, false].iter().enumerate() {
            let dest = sortie.join(format!("cas{}", i));
            fs::create_dir_all(&dest).unwrap();
            let cree = creer_arborescence(
                dest.to_string_lossy().to_string(),
                "CHANTIER_TEST".into(),
                zip_squelette(*avec_racine),
            )
            .expect("dépliage");
            resultats.push(arbre(Path::new(&cree)));
        }
        assert_eq!(resultats[0], resultats[1], "les deux zips divergent");
        // les dossiers VIDES doivent survivre : c'est tout l'intérêt du zip
        assert!(resultats[0].contains(&"FAB_/".to_string()), "{:?}", resultats[0]);
        assert!(resultats[0].contains(&"MAQUETTE/FP/".to_string()));
        assert!(resultats[0].contains(&"PROVISOIRE/MAQUETTE-PROVISOIRE/".to_string()));
        // et les gabarits doivent être là, RENOMMÉS au nom du chantier
        assert!(
            resultats[0].contains(&"VT/VT_CHANTIER_TEST.indd".to_string()),
            "{:?}",
            resultats[0]
        );
        assert!(resultats[0].contains(&"BAT_CHANTIER_TEST.indd".to_string()));
        // aucun dossier imbriqué en double
        assert!(!resultats[0].iter().any(|p| p.starts_with("CHANTIER_TEST")));
        let _ = fs::remove_dir_all(&sortie);
    }

    #[test]
    fn racine_commune_detectee_ou_absente() {
        let avec = vec!["NOMDUDOSSIER/a.txt".into(), "NOMDUDOSSIER/b/".into()];
        assert_eq!(racine_commune_du_zip(&avec).as_deref(), Some("NOMDUDOSSIER/"));
        let sans = vec!["a.txt".into(), "b/c.txt".into()];
        assert_eq!(racine_commune_du_zip(&sans), None);
        let deux = vec!["x/a.txt".into(), "y/b.txt".into()];
        assert_eq!(racine_commune_du_zip(&deux), None);
    }

    /// Un squelette dont les trois gabarits portent des identités différentes :
    /// le BAT du graphiste, un VT qui ne contient qu'un prénom enfoui dans les
    /// métadonnées d'un logo, et le BAT d'une autre société.
    fn zip_avec_identite() -> String {
        use base64::Engine;
        use std::io::Write;
        let contenus: [(&str, &[u8]); 3] = [
            ("BAT_NOMDUDOSSIER.indd", b"bloc contact Jordan NEAU jordan@les-enseignistes.fr"),
            ("VT/VT_NOMDUDOSSIER.indd", b"%%For: (Jordan JMJCOM) logo importe"),
            ("DOSSIER MAIRIE/BAT_MAIRIE_NOMDUDOSSIER.indd", b"florent@mr-enseignes.fr"),
        ];
        let mut buf = std::io::Cursor::new(Vec::new());
        {
            let mut w = zip::ZipWriter::new(&mut buf);
            let opts: zip::write::FileOptions<()> = zip::write::FileOptions::default();
            for (nom, contenu) in contenus {
                w.start_file(nom, opts).unwrap();
                w.write_all(contenu).unwrap();
            }
            w.finish().unwrap();
        }
        base64::engine::general_purpose::STANDARD.encode(buf.into_inner())
    }

    /// Le contenu affiché doit être celui de l'arborescence CRÉÉE : dossier
    /// racine retiré, séparateurs normalisés — quel que soit l'outil qui a
    /// fabriqué l'archive.
    #[test]
    fn contenu_liste_les_fichiers_sans_le_dossier_racine() {
        for avec_racine in [false, true] {
            let entrees = lister_archive(zip_squelette(avec_racine), vec![]).unwrap();
            let chemins: Vec<&str> = entrees.iter().map(|e| e.chemin.as_str()).collect();
            assert_eq!(
                chemins,
                vec![
                    "BAT_NOMDUDOSSIER.indd",
                    "DOSSIER MAIRIE/BAT_MAIRIE_NOMDUDOSSIER.indd",
                    "VT/VT_NOMDUDOSSIER.indd",
                ],
                "archive avec_racine={}",
                avec_racine
            );
            // les dossiers VIDES n'ont rien à livrer à l'unité
            assert!(entrees.iter().all(|e| !e.chemin.ends_with('/')));
            assert!(entrees.iter().all(|e| e.taille > 0));
        }
    }

    #[test]
    fn un_seul_fichier_extrait_au_bon_endroit() {
        for avec_racine in [false, true] {
            let dossier = std::env::temp_dir().join(format!("gd_extrait_{}", avec_racine));
            let _ = fs::remove_dir_all(&dossier);
            let cible = dossier.join("BAT a moi.indd");
            let ecrit = extraire_entree(
                zip_squelette(avec_racine),
                "VT/VT_NOMDUDOSSIER.indd".into(),
                cible.to_string_lossy().to_string(),
            )
            .unwrap();
            assert_eq!(ecrit, cible.to_string_lossy());
            assert_eq!(fs::read(&cible).unwrap(), b"contenu factice");
            // rien d'autre ne doit avoir été déplié
            let voisins: Vec<_> = fs::read_dir(&dossier).unwrap().collect();
            assert_eq!(voisins.len(), 1);
            let _ = fs::remove_dir_all(&dossier);
        }
    }

    /// Un VT ou un BAT d'une autre société n'a rien à personnaliser : proposer
    /// des coordonnées pour n'en rien faire est une fausse promesse.
    #[test]
    fn seuls_les_indesign_porteurs_dun_repere_sont_personnalisables() {
        let reperes = vec!["Jordan NEAU".to_string(), "jordan@les-enseignistes.fr".to_string()];
        let entrees = lister_archive(zip_avec_identite(), reperes.clone()).unwrap();
        let par_chemin = |c: &str| {
            entrees
                .iter()
                .find(|e| e.chemin == c)
                .unwrap_or_else(|| panic!("{} absent", c))
                .personnalisable
        };
        assert!(par_chemin("BAT_NOMDUDOSSIER.indd"), "le BAT porte le nom complet");
        assert!(!par_chemin("VT/VT_NOMDUDOSSIER.indd"), "le VT ne porte qu'un prénom");
        assert!(
            !par_chemin("DOSSIER MAIRIE/BAT_MAIRIE_NOMDUDOSSIER.indd"),
            "contact d'une autre société"
        );
        // sans repère fourni, on ne promet rien
        assert!(lister_archive(zip_avec_identite(), vec![])
            .unwrap()
            .iter()
            .all(|e| !e.personnalisable));
    }

    #[test]
    fn extraction_dune_entree_absente_est_une_erreur_lisible() {
        let err = extraire_entree(
            zip_squelette(false),
            "VT/INEXISTANT.indd".into(),
            std::env::temp_dir().join("gd_jamais.indd").to_string_lossy().to_string(),
        )
        .unwrap_err();
        assert!(err.contains("introuvable"), "message reçu : {}", err);
        assert!(!std::env::temp_dir().join("gd_jamais.indd").exists());
    }

}



#[cfg(test)]
mod tests_empreinte {
    use super::sha256_hex;

    /// Vecteurs de référence du NIST : si l'implémentation dérive, tout le
    /// module « mise à jour disponible » se met à mentir en silence.
    #[test]
    fn sha256_conforme_aux_vecteurs_connus() {
        assert_eq!(
            sha256_hex(b""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert_eq!(
            sha256_hex(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        assert_eq!(
            sha256_hex(b"abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
            "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
        );
        // au-dela d'un bloc de 64 octets (deux tours de compression)
        assert_eq!(
            sha256_hex(&[b'a'; 1000]),
            sha256_hex(&[b'a'; 1000])
        );
        assert_ne!(sha256_hex(b"a"), sha256_hex(b"b"));
    }
}

/// Lance un script dans InDesign et attend qu'il ait fini.
///
/// InDesign ne prend pas de script en ligne de commande : on passe par son
/// automation COM, pilotée depuis PowerShell. `DoScript` est synchrone, donc
/// au retour le document est réellement enregistré.
#[cfg(windows)]
fn executer_script_indesign(script: &str) -> Result<(), String> {
    let fichier = env::temp_dir().join("graphidesk_gabarit_script.jsx");
    fs::write(&fichier, script)
        .map_err(|e| format!("Script temporaire impossible : {}", e))?;

    // 1246973031 = 'jvsc', l'identifiant JavaScript de ScriptLanguage
    let ps = format!(
        "$ErrorActionPreference='Stop'; \
         try {{ $id = [Runtime.InteropServices.Marshal]::GetActiveObject('InDesign.Application') }} \
         catch {{ $id = New-Object -ComObject InDesign.Application }}; \
         $id.DoScript((Get-Content -Raw -LiteralPath '{}'), 1246973031) | Out-Null",
        pour_powershell(&fichier)
    );
    let sortie = hidden_command_res("powershell")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &ps])
        .output()
        .map_err(|e| format!("PowerShell indisponible : {}", e))?;
    let _ = fs::remove_file(&fichier);
    if sortie.status.success() {
        Ok(())
    } else {
        let err = String::from_utf8_lossy(&sortie.stderr);
        Err(if err.contains("80040154") || err.contains("Impossible de récupérer") {
            "InDesign n'a pas répondu. Vérifie qu'il est installé, puis réessaie.".to_string()
        } else {
            err.trim().to_string()
        })
    }
}

#[cfg(not(windows))]
fn executer_script_indesign(_script: &str) -> Result<(), String> {
    Err("Automation InDesign disponible uniquement sous Windows".into())
}

/// Un couple « ce qu'on cherche » / « ce qu'on met à la place », saisi par
/// l'utilisateur. On ne déduit rien : c'est lui qui décide, y compris quand il
/// prépare un gabarit pour quelqu'un d'autre.
#[derive(serde::Deserialize)]
pub struct Remplacement {
    pub avant: String,
    pub apres: String,
}

fn json_echappe(s: &str) -> String {
    s.replace('\u{5c}', "\\\\").replace('"', "\\\"")
}

/// Met un gabarit téléchargé au nom du graphiste.
///
/// ⚠ Seuls les couples fournis sont appliqués, dans l'ORDRE reçu : « Jordan
/// NEAU » doit passer avant « Jordan » seul, sans quoi le nom complet ne serait
/// jamais reconnu. Rien d'autre n'est touché — les autres adresses et les
/// numéros du document appartiennent aux commerciaux.
#[tauri::command]
pub fn personnaliser_gabarit(
    app: tauri::AppHandle,
    fichier: String,
    remplacements: Vec<Remplacement>,
) -> Result<u32, String> {
    use tauri::Manager;
    if !Path::new(&fichier).is_file() {
        return Err(format!("Fichier introuvable : {}", fichier));
    }
    if remplacements.is_empty() {
        return Err("Aucun remplacement demandé.".into());
    }
    // le script voyage avec l'application, comme les autres scripts Adobe
    let base = if cfg!(debug_assertions) {
        env::current_exe()
            .ok()
            .and_then(|p| p.parent()?.parent()?.parent().map(|p| p.to_path_buf()))
            .map(|p| p.join("assets").join("fabrik").join("scripts"))
    } else {
        app.path()
            .resource_dir()
            .ok()
            .map(|p| p.join("assets").join("fabrik").join("scripts"))
    }
    .ok_or("Dossier des scripts introuvable")?;
    let corps = fs::read_to_string(base.join("gabarit_personnaliser.jsx"))
        .map_err(|e| format!("Script de personnalisation illisible : {}", e))?;

    let couples: Vec<String> = remplacements
        .iter()
        .map(|r| {
            format!(
                "[\"{}\",\"{}\"]",
                json_echappe(&r.avant),
                json_echappe(&r.apres)
            )
        })
        .collect();
    let entete = format!(
        "var params = {{\"fichier\":\"{}\",\"remplacements\":[{}]}};\n",
        json_echappe(&fichier.replace('\u{5c}', "/")),
        couples.join(",")
    );

    let rapport = env::temp_dir().join("graphidesk_gabarit.json");
    let _ = fs::remove_file(&rapport);
    executer_script_indesign(&format!("{}{}", entete, corps))?;

    let txt = fs::read_to_string(&rapport)
        .map_err(|_| "InDesign n'a rien renvoyé — le gabarit n'a pas été personnalisé.".to_string())?;
    let json: serde_json::Value =
        serde_json::from_str(&txt).map_err(|e| format!("Rapport illisible : {}", e))?;
    if let Some(err) = json.get("erreur").and_then(|v| v.as_str()) {
        return Err(err.to_string());
    }
    Ok(json.get("remplacements").and_then(|v| v.as_u64()).unwrap_or(0) as u32)
}


/// Tous les .indd d'une arborescence, gabarits de sous-dossiers compris.
fn indd_du_dossier(racine: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    let mut pile = vec![racine.to_path_buf()];
    while let Some(d) = pile.pop() {
        let Ok(entrees) = fs::read_dir(&d) else { continue };
        for e in entrees.flatten() {
            let p = e.path();
            if p.is_dir() {
                pile.push(p);
            } else if p
                .extension()
                .map(|x| x.eq_ignore_ascii_case("indd"))
                .unwrap_or(false)
            {
                out.push(p);
            }
        }
    }
    out.sort();
    out
}

#[derive(Serialize)]
pub struct RapportPersonnalisation {
    pub fichiers: usize,
    pub remplacements: u32,
    /// Fichiers qu'InDesign a refusés, avec la raison. On ne masque pas un
    /// échec partiel : un gabarit resté au nom du précédent doit se voir.
    pub echecs: Vec<String>,
}

/// Met au nom du graphiste tous les gabarits d'une arborescence.
#[tauri::command]
pub fn personnaliser_dossier(
    app: tauri::AppHandle,
    dossier: String,
    remplacements: Vec<Remplacement>,
) -> Result<RapportPersonnalisation, String> {
    let racine = PathBuf::from(&dossier);
    if !racine.is_dir() {
        return Err(format!("Dossier introuvable : {}", dossier));
    }
    let fichiers = indd_du_dossier(&racine);
    let mut total = 0;
    let mut echecs = Vec::new();
    for f in &fichiers {
        let copie: Vec<Remplacement> = remplacements
            .iter()
            .map(|r| Remplacement {
                avant: r.avant.clone(),
                apres: r.apres.clone(),
            })
            .collect();
        match personnaliser_gabarit(app.clone(), f.to_string_lossy().to_string(), copie) {
            Ok(n) => total += n,
            Err(e) => echecs.push(format!("{} : {}", f.display(), e)),
        }
    }
    Ok(RapportPersonnalisation {
        fichiers: fichiers.len(),
        remplacements: total,
        echecs,
    })
}

/// Un fichier contenu dans une archive, chemin déjà normalisé.
#[derive(serde::Serialize)]
pub struct EntreeArchive {
    pub chemin: String,
    pub taille: u64,
    /// Le fichier porte-t-il une identité à mettre au nom du graphiste ?
    /// Faux pour un VT ou un BAT d'une autre société : demander des
    /// coordonnées pour n'en rien faire n'a aucun sens.
    pub personnalisable: bool,
}

/// Cherche des repères d'identité dans le contenu brut d'un document.
///
/// ⚠ On ne cherche que des repères FORTS — un nom complet, une adresse
/// e-mail. Un prénom seul se retrouve dans les métadonnées d'un logo importé
/// (constaté le 09/09/2026 sur VT_.indd : « %%For: (Jordan JMJCOM) »), invisible
/// dans le document et hors de portée de la recherche InDesign : le prendre
/// pour un repère ferait proposer une personnalisation sans objet.
fn contient_repere(octets: &[u8], reperes: &[String]) -> bool {
    reperes.iter().any(|r| {
        let r = r.as_bytes();
        !r.is_empty() && r.len() <= octets.len() && octets.windows(r.len()).any(|f| f == r)
    })
}

fn est_indesign(chemin: &str) -> bool {
    chemin.to_lowercase().ends_with(".indd")
}

/// Le contenu d'un fichier porte-t-il l'un des repères d'identité ?
#[tauri::command]
pub fn identite_presente(contenu_base64: String, reperes: Vec<String>) -> Result<bool, String> {
    use base64::Engine;
    let octets = base64::engine::general_purpose::STANDARD
        .decode(&contenu_base64)
        .map_err(|e| format!("Contenu illisible : {}", e))?;
    Ok(contient_repere(&octets, &reperes))
}

/// Décode le base64 et retire, s'il existe, le dossier racine commun.
/// La MÊME normalisation que `creer_arborescence` : sans elle, la liste
/// affichée ne correspondrait pas à l'arborescence effectivement créée.
fn archive_normalisee(
    zip_base64: &str,
) -> Result<(zip::ZipArchive<std::io::Cursor<Vec<u8>>>, Option<String>), String> {
    use base64::Engine;
    let octets = base64::engine::general_purpose::STANDARD
        .decode(zip_base64)
        .map_err(|e| format!("Archive illisible (base64) : {}", e))?;
    let mut archive = zip::ZipArchive::new(std::io::Cursor::new(octets))
        .map_err(|e| format!("Archive illisible (zip) : {}", e))?;
    let noms: Vec<String> = (0..archive.len())
        .filter_map(|i| archive.by_index(i).ok().map(|e| e.name().replace('\\', "/")))
        .collect();
    let racine = racine_commune_du_zip(&noms);
    Ok((archive, racine))
}

fn chemin_interne(brut: &str, racine: &Option<String>) -> Option<String> {
    let interne = brut.replace('\\', "/");
    // garde-fou « zip slip » : une archive piégée écrirait n'importe où
    if interne.split('/').any(|s| s == ".." || s.contains(':')) {
        return None;
    }
    let sans = match racine {
        Some(r) => interne.strip_prefix(r).unwrap_or(&interne).to_string(),
        None => interne,
    };
    if sans.trim().is_empty() {
        None
    } else {
        Some(sans)
    }
}

/// Liste les FICHIERS d'une archive (les dossiers vides n'ont rien à livrer
/// à l'unité). Sert au téléchargement d'un élément seul du squelette.
#[tauri::command]
pub fn lister_archive(
    zip_base64: String,
    reperes: Vec<String>,
) -> Result<Vec<EntreeArchive>, String> {
    use std::io::Read;
    let (mut archive, racine) = archive_normalisee(&zip_base64)?;
    let mut sortie = Vec::new();
    for i in 0..archive.len() {
        let mut entree = archive
            .by_index(i)
            .map_err(|e| format!("Entrée {} illisible : {}", i, e))?;
        if entree.is_dir() {
            continue;
        }
        let taille = entree.size();
        if let Some(chemin) = chemin_interne(entree.name(), &racine) {
            let personnalisable = if est_indesign(&chemin) && !reperes.is_empty() {
                let mut octets = Vec::with_capacity(taille as usize);
                entree.read_to_end(&mut octets).map_err(|e| {
                    format!("Lecture de « {} » impossible : {}", chemin, e)
                })?;
                contient_repere(&octets, &reperes)
            } else {
                false
            };
            sortie.push(EntreeArchive {
                chemin,
                taille,
                personnalisable,
            });
        }
    }
    sortie.sort_by(|a, b| a.chemin.cmp(&b.chemin));
    Ok(sortie)
}

/// Extrait UN fichier de l'archive vers `destination` (chemin complet du
/// fichier à écrire). Permet de récupérer le seul BAT sans déplier tout le
/// dossier de chantier.
#[tauri::command]
pub fn extraire_entree(
    zip_base64: String,
    entree: String,
    destination: String,
) -> Result<String, String> {
    use std::io::Read;
    let (mut archive, racine) = archive_normalisee(&zip_base64)?;
    for i in 0..archive.len() {
        let mut e = archive
            .by_index(i)
            .map_err(|er| format!("Entrée {} illisible : {}", i, er))?;
        if e.is_dir() {
            continue;
        }
        match chemin_interne(e.name(), &racine) {
            Some(c) if c == entree => {
                let mut octets = Vec::with_capacity(e.size() as usize);
                e.read_to_end(&mut octets)
                    .map_err(|er| format!("Lecture de « {} » impossible : {}", entree, er))?;
                let cible = PathBuf::from(&destination);
                if let Some(parent) = cible.parent() {
                    fs::create_dir_all(parent)
                        .map_err(|er| format!("Dossier {} impossible : {}", parent.display(), er))?;
                }
                fs::write(&cible, &octets)
                    .map_err(|er| format!("Écriture de {} impossible : {}", cible.display(), er))?;
                return Ok(cible.to_string_lossy().to_string());
            }
            _ => {}
        }
    }
    Err(format!("« {} » est introuvable dans l'archive.", entree))
}

/// Rezippe un dossier (sans l'englober) vers `destination`.
/// Sert au « Télécharger le .zip » : on déplie, on personnalise, on recompresse.
#[tauri::command]
pub fn zipper_dossier(dossier: String, destination: String) -> Result<String, String> {
    use std::io::Write;
    let racine = PathBuf::from(&dossier);
    if !racine.is_dir() {
        return Err(format!("Dossier introuvable : {}", dossier));
    }
    let sortie = fs::File::create(&destination)
        .map_err(|e| format!("Création de {} impossible : {}", destination, e))?;
    let mut w = zip::ZipWriter::new(sortie);
    let opts: zip::write::FileOptions<()> = zip::write::FileOptions::default();

    let mut pile = vec![racine.clone()];
    while let Some(d) = pile.pop() {
        let Ok(entrees) = fs::read_dir(&d) else { continue };
        for e in entrees.flatten() {
            let p = e.path();
            let rel = p
                .strip_prefix(&racine)
                .map_err(|_| "Chemin hors du dossier".to_string())?
                .to_string_lossy()
                .replace('\u{5c}', "/");
            if p.is_dir() {
                // ⚠ les dossiers VIDES doivent survivre : c'est tout l'intérêt
                // du squelette, et aucun format plat ne sait les porter
                w.add_directory(format!("{}/", rel), opts)
                    .map_err(|e| format!("Ajout de {} impossible : {}", rel, e))?;
                pile.push(p);
            } else {
                w.start_file(rel.clone(), opts)
                    .map_err(|e| format!("Ajout de {} impossible : {}", rel, e))?;
                let octets = fs::read(&p).map_err(|e| format!("Lecture de {} : {}", rel, e))?;
                w.write_all(&octets)
                    .map_err(|e| format!("Écriture de {} : {}", rel, e))?;
            }
        }
    }
    w.finish().map_err(|e| format!("Fermeture du zip : {}", e))?;
    Ok(destination)
}

/// Dossier de travail jetable, sous le temp du poste.
#[tauri::command]
pub fn dossier_temporaire(nom: String) -> Result<String, String> {
    let nom = nom_de_fichier_sur(&nom)?;
    let d = env::temp_dir().join(format!("graphidesk_travail_{}", nom));
    let _ = fs::remove_dir_all(&d);
    fs::create_dir_all(&d).map_err(|e| format!("Dossier temporaire impossible : {}", e))?;
    Ok(d.to_string_lossy().to_string())
}
