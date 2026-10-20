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

/// Contenu d'un fichier du dossier, en base64. `relatif` doit rester DANS le
/// dossier : pas de « .. », pas de chemin absolu.
#[tauri::command]
pub fn verif_lire_fichier(dossier: String, relatif: String) -> Result<String, String> {
    use base64::Engine;
    if relatif.contains("..") || Path::new(&relatif).is_absolute() || relatif.contains(':') {
        return Err("Chemin invalide".into());
    }
    let racine = PathBuf::from(&dossier);
    let chemin = racine.join(relatif.replace('/', std::path::MAIN_SEPARATOR_STR));
    let meta = fs::metadata(&chemin).map_err(|e| format!("Fichier introuvable : {}", e))?;
    if meta.len() > MAX_OCTETS {
        return Err(format!("Fichier trop lourd ({} Mo) : non transmis", meta.len() / 1024 / 1024));
    }
    let octets = fs::read(&chemin).map_err(|e| format!("Lecture impossible : {}", e))?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&octets))
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
