//! Vérif FAB : lecture SEULE d'un dossier de production sur le serveur.
//!
//! Volontairement minimal : lister et lire. Aucune commande de ce module
//! n'écrit, ne déplace ni ne supprime quoi que ce soit — l'assistant de
//! vérification ne peut donc rien abîmer dans un dossier client.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

#[derive(serde::Serialize)]
pub struct EntreeDossier {
    /// chemin relatif au dossier analysé, séparateurs « / »
    chemin: String,
    est_dossier: bool,
    taille: u64,
    /// secondes depuis 1970 (0 si inconnu)
    modifie: u64,
}

const MAX_ENTREES: usize = 3000;
const MAX_PROFONDEUR: usize = 8;
/// au-delà, un fichier n'est pas transmis (une vidéo, une archive…)
const MAX_OCTETS: u64 = 60 * 1024 * 1024;

fn parcourir(racine: &Path, dossier: &Path, profondeur: usize, sortie: &mut Vec<EntreeDossier>) {
    if profondeur > MAX_PROFONDEUR || sortie.len() >= MAX_ENTREES {
        return;
    }
    let Ok(lecture) = fs::read_dir(dossier) else { return };
    let mut enfants: Vec<_> = lecture.flatten().collect();
    enfants.sort_by_key(|e| e.file_name());
    for e in enfants {
        if sortie.len() >= MAX_ENTREES {
            return;
        }
        let nom = e.file_name().to_string_lossy().to_string();
        // fichiers système sans intérêt pour la vérification
        if nom.eq_ignore_ascii_case("Thumbs.db") || nom.eq_ignore_ascii_case("desktop.ini") || nom.starts_with("~$") || nom.starts_with("._") {
            continue;
        }
        let Ok(meta) = e.metadata() else { continue };
        let chemin = e.path();
        let relatif = chemin
            .strip_prefix(racine)
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or(nom.clone());
        let modifie = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);
        sortie.push(EntreeDossier { chemin: relatif, est_dossier: meta.is_dir(), taille: if meta.is_dir() { 0 } else { meta.len() }, modifie });
        if meta.is_dir() {
            parcourir(racine, &chemin, profondeur + 1, sortie);
        }
    }
}

/// Inventaire complet d'un dossier (sous-dossiers compris).
#[tauri::command]
pub fn verif_lister_dossier(chemin: String) -> Result<Vec<EntreeDossier>, String> {
    let racine = PathBuf::from(&chemin);
    if !racine.is_dir() {
        return Err(format!("Dossier introuvable : {}", chemin));
    }
    let mut sortie = Vec::new();
    parcourir(&racine, &racine, 0, &mut sortie);
    Ok(sortie)
}

/// Chemin d'un fichier du dossier. `relatif` doit rester DANS le dossier :
/// pas de « .. », pas de chemin absolu.
fn chemin_dans(dossier: &str, relatif: &str) -> Result<PathBuf, String> {
    if relatif.contains("..") || Path::new(relatif).is_absolute() || relatif.contains(':') {
        return Err("Chemin invalide".into());
    }
    Ok(PathBuf::from(dossier).join(relatif.replace('/', std::path::MAIN_SEPARATOR_STR)))
}

/// Contenu d'un fichier du dossier, en base64.
#[tauri::command]
pub fn verif_lire_fichier(dossier: String, relatif: String) -> Result<String, String> {
    use base64::Engine;
    let chemin = chemin_dans(&dossier, &relatif)?;
    let meta = fs::metadata(&chemin).map_err(|e| format!("Fichier introuvable : {}", e))?;
    if meta.len() > MAX_OCTETS {
        return Err(format!("Fichier trop lourd ({} Mo) : non transmis", meta.len() / 1024 / 1024));
    }
    let octets = fs::read(&chemin).map_err(|e| format!("Lecture impossible : {}", e))?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&octets))
}

/* ------------------------------------------------------------------ PDF lourds */
//
// Un PDF de FAB pèse vite plusieurs centaines de Mo (images en pleine définition,
// données d'édition d'Illustrator). Le charger en entier ferait exploser la mémoire :
// pdf.js le lit alors par morceaux, à la demande (verif_lire_plage), et pdf-lib ne
// reçoit que son squelette (verif_squelette_pdf) : tout ce qui sert aux mesures
// (boîtes, couleurs, tons directs, contenu des pages), sans les données des images.

/// au-delà, une plage demandée est refusée (pdf.js lit par blocs de 1 Mo)
const MAX_PLAGE: u64 = 16 * 1024 * 1024;
/// un squelette plus lourd n'a plus rien de léger : on renonce
const MAX_SQUELETTE: usize = 60 * 1024 * 1024;
/// les flux plus petits sont gardés tels quels
const SEUIL_FLUX: u64 = 32 * 1024;

#[derive(serde::Serialize)]
pub struct Plage {
    taille: u64,
    /// octets [debut, fin[ en base64
    contenu: String,
}

/// Une plage d'octets d'un fichier du dossier, et la taille totale du fichier.
#[tauri::command]
pub fn verif_lire_plage(dossier: String, relatif: String, debut: u64, fin: u64) -> Result<Plage, String> {
    use base64::Engine;
    use std::io::{Read, Seek, SeekFrom};
    let chemin = chemin_dans(&dossier, &relatif)?;
    let mut f = fs::File::open(&chemin).map_err(|e| format!("Fichier introuvable : {}", e))?;
    let taille = f.metadata().map_err(|e| e.to_string())?.len();
    let fin = fin.min(taille);
    if fin < debut || fin - debut > MAX_PLAGE {
        return Err("Plage invalide".into());
    }
    let mut octets = vec![0u8; (fin - debut) as usize];
    f.seek(SeekFrom::Start(debut)).map_err(|e| e.to_string())?;
    f.read_exact(&mut octets).map_err(|e| format!("Lecture impossible : {}", e))?;
    Ok(Plage { taille, contenu: base64::engine::general_purpose::STANDARD.encode(&octets) })
}

/// Le PDF sans les données des images ni les données privées d'Illustrator, en base64.
#[tauri::command]
pub fn verif_squelette_pdf(dossier: String, relatif: String) -> Result<String, String> {
    use base64::Engine;
    let chemin = chemin_dans(&dossier, &relatif)?;
    let f = fs::File::open(&chemin).map_err(|e| format!("Fichier introuvable : {}", e))?;
    let sq = squelette_pdf(f)?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&sq))
}

/// Parcourt le fichier une fois, par blocs, et recopie tout sauf le contenu des gros
/// flux inutiles aux mesures (le dictionnaire du flux est gardé, sa longueur mise à 0).
/// pdf-lib lit les objets dans l'ordre : la table des positions, devenue fausse, ne le gêne pas.
fn squelette_pdf<R: std::io::Read + std::io::Seek>(mut f: R) -> Result<Vec<u8>, String> {
    use std::io::SeekFrom;
    // petits blocs : les données sautées (images, données Illustrator) ne sont jamais lues
    const BLOC: usize = 64 * 1024;
    let mut sortie: Vec<u8> = Vec::new();
    let mut tampon: Vec<u8> = Vec::new();
    let mut fini = false;
    // complète le tampon jusqu'à `min` octets (si le fichier en a encore)
    fn remplir<R: std::io::Read>(f: &mut R, tampon: &mut Vec<u8>, fini: &mut bool, min: usize) -> Result<(), String> {
        while tampon.len() < min && !*fini {
            let avant = tampon.len();
            tampon.resize(avant + BLOC, 0);
            let n = f.read(&mut tampon[avant..]).map_err(|e| format!("Lecture impossible : {}", e))?;
            tampon.truncate(avant + n);
            if n == 0 {
                *fini = true;
            }
        }
        Ok(())
    }
    loop {
        remplir(&mut f, &mut tampon, &mut fini, 16 * 1024)?;
        if tampon.is_empty() {
            break;
        }
        let Some((i, eol)) = chercher_stream(&tampon) else {
            if fini {
                sortie.extend_from_slice(&tampon);
                break;
            }
            // garde la fin : le mot peut être à cheval sur deux blocs
            let garde = tampon.len().saturating_sub(16);
            sortie.extend_from_slice(&tampon[..garde]);
            tampon.drain(..garde);
            continue;
        };
        let tete = i + 6 + eol;
        sortie.extend_from_slice(&tampon[..tete]);
        tampon.drain(..tete);
        // dictionnaire du flux : depuis le dernier « obj »
        let recul = sortie.len().saturating_sub(4096);
        let d0 = recul + chercher_dernier(&sortie[recul..], b" obj").unwrap_or(0);
        let dict = String::from_utf8_lossy(&sortie[d0..]).into_owned();
        if let Some((n, pos_lg, lg_txt)) = longueur_directe(&dict) {
            let image = contient_mots(&dict, "/Subtype", "/Image");
            let mut inutile = image;
            if !image && n >= SEUIL_FLUX && !dict.contains("/Filter") {
                // flux sans filtre et binaire : données privées d'Illustrator
                remplir(&mut f, &mut tampon, &mut fini, 1024)?;
                let e = &tampon[..tampon.len().min(1024)];
                let hors = e.iter().filter(|&&c| (c < 32 && c != 9 && c != 10 && c != 13) || c > 126).count();
                inutile = hors * 10 > e.len();
            }
            if inutile && n >= SEUIL_FLUX {
                // « /Length 123456 » devient « /Length 0      » (même nombre d'octets)
                // (dict est du texte « lossy » : les positions ne valent que si tout est ASCII avant)
                if dict.len() == sortie.len() - d0 {
                    let debut = d0 + pos_lg;
                    let mut nouveau = b"/Length 0".to_vec();
                    nouveau.resize(lg_txt, b' ');
                    sortie[debut..debut + lg_txt].copy_from_slice(&nouveau);
                    let deja = (n as usize).min(tampon.len());
                    tampon.drain(..deja);
                    let reste = n - deja as u64;
                    if reste > 0 {
                        f.seek(SeekFrom::Current(reste as i64)).map_err(|e| e.to_string())?;
                    }
                    continue;
                }
            }
            // flux gardé : recopié tel quel, sans y chercher de mots-clés
            let mut reste = n as usize;
            while reste > 0 {
                remplir(&mut f, &mut tampon, &mut fini, reste.min(BLOC))?;
                if tampon.is_empty() {
                    break;
                }
                let k = reste.min(tampon.len());
                sortie.extend_from_slice(&tampon[..k]);
                tampon.drain(..k);
                reste -= k;
            }
        }
        if sortie.len() > MAX_SQUELETTE {
            return Err("PDF trop lourd, même sans ses images".into());
        }
    }
    Ok(sortie)
}

/// Position du mot « stream » (pas « endstream ») suivi d'une fin de ligne, et la longueur de celle-ci.
fn chercher_stream(t: &[u8]) -> Option<(usize, usize)> {
    let mut depart = 0;
    while let Some(p) = t[depart..].windows(6).position(|w| w == b"stream") {
        let i = depart + p;
        let eol = match &t[i + 6..] {
            [b'\r', b'\n', ..] => 2,
            [b'\n', ..] | [b'\r', ..] => 1,
            _ => 0,
        };
        let fin_de_flux = i >= 3 && &t[i - 3..i] == b"end";
        if eol > 0 && !fin_de_flux {
            return Some((i, eol));
        }
        depart = i + 1;
    }
    None
}

fn chercher_dernier(t: &[u8], mot: &[u8]) -> Option<usize> {
    t.windows(mot.len()).rposition(|w| w == mot)
}

/// « /Subtype /Image », espaces facultatifs
fn contient_mots(dict: &str, cle: &str, valeur: &str) -> bool {
    dict.match_indices(cle).any(|(i, _)| dict[i + cle.len()..].trim_start().starts_with(valeur))
}

/// `/Length 1234` écrit en direct (pas `/Length 12 0 R`) : (valeur, position, longueur du texte)
fn longueur_directe(dict: &str) -> Option<(u64, usize, usize)> {
    let i = dict.rfind("/Length")?;
    let suite = &dict[i + 7..];
    let blancs = suite.len() - suite.trim_start().len();
    let chiffres: String = suite[blancs..].chars().take_while(|c| c.is_ascii_digit()).collect();
    if chiffres.is_empty() {
        return None;
    }
    // référence indirecte : « 12 0 R »
    let mut morceaux = suite[blancs + chiffres.len()..].split(|c: char| c.is_whitespace() || c == '/' || c == '>').filter(|m| !m.is_empty());
    if let (Some(a), Some(b)) = (morceaux.next(), morceaux.next()) {
        if a.chars().all(|c| c.is_ascii_digit()) && b == "R" {
            return None;
        }
    }
    Some((chiffres.parse().ok()?, i, 7 + blancs + chiffres.len()))
}

#[cfg(test)]
mod tests {
    /// banc sur un vrai fichier : VERIF_PDF=… VERIF_SORTIE=… cargo test squelette -- --ignored --nocapture
    #[test]
    #[ignore]
    fn squelette_fichier_reel() {
        let entree = std::env::var("VERIF_PDF").unwrap();
        let t = std::time::Instant::now();
        let sq = super::squelette_pdf(std::fs::File::open(&entree).unwrap()).unwrap();
        println!("squelette : {} octets en {:?}", sq.len(), t.elapsed());
        std::fs::write(std::env::var("VERIF_SORTIE").unwrap(), sq).unwrap();
    }
}

/* ------------------------------------------------------------------ recherche */

/// minuscules, sans accents, mots de 2 lettres et plus
fn mots(texte: &str) -> Vec<String> {
    let plat: String = texte
        .chars()
        .map(|c| match c {
            'à' | 'â' | 'ä' | 'À' | 'Â' | 'Ä' => 'a',
            'é' | 'è' | 'ê' | 'ë' | 'É' | 'È' | 'Ê' | 'Ë' => 'e',
            'î' | 'ï' | 'Î' | 'Ï' => 'i',
            'ô' | 'ö' | 'Ô' | 'Ö' => 'o',
            'ù' | 'û' | 'ü' | 'Ù' | 'Û' | 'Ü' => 'u',
            'ç' | 'Ç' => 'c',
            c if c.is_alphanumeric() => c.to_ascii_lowercase(),
            _ => ' ',
        })
        .collect();
    const VIDES: [&str; 9] = ["le", "la", "les", "de", "des", "du", "et", "sa", "sas"];
    plat.split_whitespace()
        .filter(|m| m.len() >= 2 && !VIDES.contains(m))
        .map(|m| m.to_string())
        .collect()
}

/// part des mots du dossier serveur retrouvés dans le nom GraphiDesk (préfixe
/// admis à partir de 4 lettres : « ORLEANS » ↔ « orléans-sud »)
fn score(nom_dossier: &[String], mots_nom: &[String]) -> f32 {
    if nom_dossier.is_empty() {
        return 0.0;
    }
    // mots collés d'un côté, séparés de l'autre : « Sushi Man » ↔ « Sushiman »
    let joint = nom_dossier.concat();
    if joint.len() >= 4 && mots_nom.iter().any(|n| *n == joint) {
        return 1.0;
    }
    let trouves = nom_dossier
        .iter()
        .filter(|m| {
            mots_nom.iter().any(|n| {
                n == *m || (m.len() >= 4 && n.len() >= 4 && (n.starts_with(m.as_str()) || m.starts_with(n.as_str())))
            })
        })
        .count();
    trouves as f32 / nom_dossier.len() as f32
}

fn sous_dossiers(p: &Path) -> Vec<PathBuf> {
    fs::read_dir(p)
        .map(|l| {
            l.flatten()
                .filter(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false))
                .map(|e| e.path())
                .filter(|p| !p.file_name().map(|n| n.to_string_lossy().starts_with('#')).unwrap_or(true))
                .collect()
        })
        .unwrap_or_default()
}

#[derive(serde::Serialize)]
pub struct Candidat {
    chemin: String,
    score: f32,
}

/// Dossiers serveur qui ressemblent au nom d'un dossier GraphiDesk. Le serveur
/// est rangé en <racine>\<initiale>\<CLIENT>\<sous-dossier éventuel> : on ne
/// parcourt que les initiales des mots du nom, sur deux niveaux.
#[tauri::command]
pub fn verif_chercher_dossier(racine: String, nom: String) -> Result<Vec<Candidat>, String> {
    let racine = PathBuf::from(&racine);
    if !racine.is_dir() {
        return Err(format!("Racine du serveur introuvable : {}", racine.display()));
    }
    let mut mots_nom = mots(&nom);
    // et dans l'autre sens : « Sushi Man » dans GraphiDesk, « SUSHIMAN » sur le serveur
    let paires: Vec<String> = mots_nom.windows(2).map(|w| w.concat()).collect();
    let mut initiales: Vec<String> = mots_nom.iter().filter_map(|m| m.chars().next()).map(|c| {
        if c.is_ascii_digit() { "0123 chiffres".to_string() } else { c.to_ascii_uppercase().to_string() }
    }).collect();
    initiales.dedup();
    mots_nom.extend(paires);
    let mut sortie: Vec<Candidat> = Vec::new();
    for lettre in initiales.iter().take(4) {
        for client in sous_dossiers(&racine.join(lettre)) {
            let s_client = score(&mots(&client.file_name().unwrap_or_default().to_string_lossy()), &mots_nom);
            if s_client < 0.5 {
                continue;
            }
            let mut meilleur_sous = 0.0f32;
            let mots_client = mots(&client.to_string_lossy());
            for sous in sous_dossiers(&client) {
                let nom_sous = mots(&sous.file_name().unwrap_or_default().to_string_lossy());
                // les mots du client déjà comptés ne départagent pas les sous-dossiers
                let propres: Vec<String> = nom_sous.into_iter().filter(|m| !mots_client.contains(m)).collect();
                let s = score(&propres, &mots_nom);
                if s > 0.0 {
                    meilleur_sous = meilleur_sous.max(s);
                    sortie.push(Candidat { chemin: sous.to_string_lossy().to_string(), score: s_client + s });
                }
            }
            // le dossier client lui-même, s'il n'a pas de sous-dossier plus précis
            if meilleur_sous < 1.0 {
                sortie.push(Candidat { chemin: client.to_string_lossy().to_string(), score: s_client });
            }
        }
    }
    sortie.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    sortie.truncate(6);
    Ok(sortie)
}

/// Ouvre le dossier vérifié dans l'Explorateur Windows (lien du bandeau VérifIzy).
#[tauri::command]
pub fn verif_ouvrir_dossier(chemin: String) -> Result<(), String> {
    let p = PathBuf::from(&chemin);
    if !p.is_dir() {
        return Err(format!("Dossier introuvable : {chemin}"));
    }
    std::process::Command::new("explorer.exe")
        .arg(&p)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("Ouverture impossible : {e}"))
}
