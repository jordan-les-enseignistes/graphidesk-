use tauri::{
    WindowEvent,
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState},
    Manager,
};
mod ressources;

use std::sync::atomic::{AtomicBool, Ordering};
use std::process::Command;
use std::fs;
use std::env;

// État global pour savoir si on doit minimiser au lieu de fermer
static MINIMIZE_ON_CLOSE: AtomicBool = AtomicBool::new(true);

// Commande pour définir le comportement de fermeture depuis le frontend
#[tauri::command]
fn set_minimize_on_close(minimize: bool) {
    MINIMIZE_ON_CLOSE.store(minimize, Ordering::SeqCst);
}

// Commande pour récupérer le comportement actuel
#[tauri::command]
fn get_minimize_on_close() -> bool {
    MINIMIZE_ON_CLOSE.load(Ordering::SeqCst)
}

// Commande pour vraiment quitter l'application
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

// ===== COMMANDES FABRIK =====

// Récupérer le chemin Illustrator depuis les paramètres ou utiliser la valeur par défaut
#[tauri::command]
fn get_illustrator_path() -> String {
    // Chemin par défaut - sera remplacé par la config utilisateur
    let default_path = r"C:\Program Files\Adobe\Adobe Illustrator 2026\Support Files\Contents\Windows\Illustrator.exe";
    default_path.to_string()
}

// Vérifier si Illustrator existe au chemin spécifié
#[tauri::command]
fn check_illustrator_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

// Écrit un fichier BINAIRE (base64) dans le dossier temp et retourne son chemin
// (utilisé pour le PSD photomontage du module Mesure)
#[tauri::command]
fn save_temp_binary(file_name: String, content_base64: String) -> Result<String, String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&content_base64)
        .map_err(|e| format!("Erreur décodage base64 : {}", e))?;
    let temp_dir = env::temp_dir();
    let file_path = temp_dir.join(&file_name);
    if let Some(parent) = file_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(&file_path, &bytes)
        .map_err(|e| format!("Erreur écriture fichier : {}", e))?;
    Ok(file_path.to_string_lossy().to_string())
}

// Écrit une fiche VT (json + photos) dans Documents\GraphiDesk\fiches_vt\{dossier}
// Le plugin InDesign "Cotes BAT" scanne ce dossier et charge la fiche la plus récente.
// On passe par USERPROFILE\Documents pour matcher os.homedir() côté UXP.
// v2 multi-faces : extra_photos = photos supplémentaires (fiche_vt_2.jpg...).
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct FichePhoto {
    file_name: String,
    content_base64: String,
}

#[tauri::command]
fn save_fiche_vt(
    folder_name: String,
    json_content: String,
    photo_base64: String,
    extra_photos: Option<Vec<FichePhoto>>,
) -> Result<String, String> {
    use base64::Engine;
    let userprofile =
        env::var("USERPROFILE").map_err(|_| "Variable USERPROFILE introuvable".to_string())?;
    let dir = std::path::Path::new(&userprofile)
        .join("Documents")
        .join("GraphiDesk")
        .join("fiches_vt")
        .join(&folder_name);
    fs::create_dir_all(&dir).map_err(|e| format!("Erreur création dossier : {}", e))?;
    fs::write(dir.join("fiche_vt.json"), &json_content)
        .map_err(|e| format!("Erreur écriture JSON : {}", e))?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&photo_base64)
        .map_err(|e| format!("Erreur décodage base64 : {}", e))?;
    fs::write(dir.join("fiche_vt.jpg"), &bytes)
        .map_err(|e| format!("Erreur écriture photo : {}", e))?;
    for photo in extra_photos.unwrap_or_default() {
        if photo.file_name.contains("..") || photo.file_name.contains('/') || photo.file_name.contains('\\') {
            return Err("Nom de photo invalide".into());
        }
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(&photo.content_base64)
            .map_err(|e| format!("Erreur décodage base64 : {}", e))?;
        fs::write(dir.join(&photo.file_name), &bytes)
            .map_err(|e| format!("Erreur écriture photo : {}", e))?;
    }
    Ok(dir.to_string_lossy().replace('\\', "/"))
}

// Écrit un fichier BINAIRE à l'emplacement choisi par l'utilisateur.
// Le chemin vient de la boîte d'enregistrement native : c'est l'utilisateur
// qui décide où, on se contente d'écrire.
#[tauri::command]
fn save_binary_to(path: String, content_base64: String) -> Result<String, String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&content_base64)
        .map_err(|e| format!("Erreur décodage base64 : {}", e))?;
    let p = std::path::Path::new(&path);
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Erreur création du dossier : {}", e))?;
    }
    fs::write(p, &bytes).map_err(|e| format!("Erreur écriture : {}", e))?;
    Ok(p.to_string_lossy().to_string())
}

// Ramène la fenêtre GraphiDesk au premier plan.
// Après un script Illustrator, c'est Illustrator qui a le focus : sans ça,
// l'utilisateur doit basculer à la main pour voir le résultat.
#[tauri::command]
fn focus_main_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
    Ok(())
}

// Écrit un fichier BINAIRE (base64) sous Documents\GraphiDesk\{rel_path}
// (installation des ressources atelier : nuanciers, gabarits...)
#[tauri::command]
fn save_documents_file(rel_path: String, content_base64: String) -> Result<String, String> {
    use base64::Engine;
    if rel_path.contains("..") {
        return Err("Chemin invalide".into());
    }
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&content_base64)
        .map_err(|e| format!("Erreur décodage base64 : {}", e))?;
    let userprofile =
        env::var("USERPROFILE").map_err(|_| "Variable USERPROFILE introuvable".to_string())?;
    let file_path = std::path::Path::new(&userprofile)
        .join("Documents")
        .join("GraphiDesk")
        .join(&rel_path);
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Erreur création dossier : {}", e))?;
    }
    fs::write(&file_path, &bytes).map_err(|e| format!("Erreur écriture fichier : {}", e))?;
    Ok(file_path.to_string_lossy().replace('\\', "/"))
}

/// Supprime des fichiers du dossier temp — les sorties d'un relevé Illustrator
/// AVANT de le relancer.
///
/// ⚠ Sans cette purge côté application, GraphiDesk relisait la sortie du
/// relevé PRÉCÉDENT : le script l'effaçait bien lui-même, mais seulement au
/// moment de s'exécuter, alors que l'application commence à guetter le
/// résultat 500 ms après le lancement — et qu'un Illustrator déjà ouvert
/// reçoit le script en différé. Le relevé suivant lisait alors celui d'avant :
/// « ça marche au deuxième ou au troisième essai ».
#[tauri::command]
fn supprimer_temp(file_names: Vec<String>) -> Result<(), String> {
    for nom in file_names {
        if nom.contains("..") {
            return Err("Chemin invalide".into());
        }
        let chemin = env::temp_dir().join(&nom);
        if chemin.exists() {
            fs::remove_file(&chemin)
                .map_err(|e| format!("Impossible d'effacer {} : {}", nom, e))?;
        }
    }
    Ok(())
}

// Lit un fichier du dossier temp et le retourne en base64
// (canal de retour des scripts Illustrator : export de sélection biblio...)
#[tauri::command]
fn read_temp_binary(file_name: String) -> Result<String, String> {
    use base64::Engine;
    if file_name.contains("..") {
        return Err("Chemin invalide".into());
    }
    let path = env::temp_dir().join(&file_name);
    let bytes = fs::read(&path).map_err(|e| format!("Lecture impossible : {}", e))?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}


/// Reponse brute d'une page publique Google, telle que le webview ne peut pas
/// l'obtenir lui-meme (Google n'autorise pas le CORS sur ces adresses).
#[derive(serde::Serialize)]
struct ReponseWeb {
    statut: u16,
    type_contenu: String,
    corps: String,
}

/// Recupere une page publique de docs.google.com (onglet Suivi VT).
///
/// Trois garde-fous volontaires :
/// - l'adresse est bornee a docs.google.com : cette commande ne doit pas
///   pouvoir servir de passe-plat vers n'importe quel site ;
/// - un delai maximum, sans quoi une requete qui n'aboutit jamais laisserait
///   l'interface en chargement perpetuel (constate le 09/09/2026) ;
/// - les echecs sont journalises cote Rust, donc lisibles sans ouvrir les
///   outils de developpement.
#[tauri::command]
async fn lire_page_google(url: String) -> Result<ReponseWeb, String> {
    const PREFIXE: &str = "https://docs.google.com/";
    if !url.starts_with(PREFIXE) {
        return Err(format!("Adresse refusee (hors {}) : {}", PREFIXE, url));
    }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("Client HTTP indisponible : {}", e))?;
    let reponse = client.get(&url).send().await.map_err(|e| {
        eprintln!("[suivi-vt] echec reseau sur {} : {}", url, e);
        format!("Le document n'a pas pu etre contacte : {}", e)
    })?;
    let statut = reponse.status().as_u16();
    let type_contenu = reponse
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    let corps = reponse.text().await.map_err(|e| {
        eprintln!("[suivi-vt] lecture du corps impossible sur {} : {}", url, e);
        format!("Reponse illisible : {}", e)
    })?;
    eprintln!(
        "[suivi-vt] {} -> {} ({}, {} octets)",
        url,
        statut,
        type_contenu,
        corps.len()
    );
    Ok(ReponseWeb {
        statut,
        type_contenu,
        corps,
    })
}

// Ouvre un fichier avec une application donnée (Photoshop, etc.)
#[tauri::command]
fn open_file_with(app_path: String, file_path: String) -> Result<(), String> {
    if !std::path::Path::new(&app_path).exists() {
        return Err(format!("Application non trouvée : {}", app_path));
    }
    if !std::path::Path::new(&file_path).exists() {
        return Err(format!("Fichier non trouvé : {}", file_path));
    }
    Command::new(&app_path)
        .arg(&file_path)
        .spawn()
        .map_err(|e| format!("Erreur lancement : {}", e))?;
    Ok(())
}

// Écrit un fichier dans le dossier temp et retourne son chemin
// (utilisé pour préparer un fichier avant de le traiter via script Illustrator)
#[tauri::command]
fn save_temp_file(file_name: String, content: String) -> Result<String, String> {
    let temp_dir = env::temp_dir();
    let file_path = temp_dir.join(&file_name);
    if let Some(parent) = file_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(&file_path, &content)
        .map_err(|e| format!("Erreur écriture fichier temporaire : {}", e))?;
    // forward slashes pour utilisation directe dans un script JSX
    Ok(file_path.to_string_lossy().replace('\\', "/"))
}

// Écrit un fichier (SVG de prémaquette, etc.) dans le dossier temp
// et l'ouvre directement dans Illustrator
#[tauri::command]
fn save_and_open_in_illustrator(
    illustrator_path: String,
    file_name: String,
    content: String,
) -> Result<String, String> {
    if !std::path::Path::new(&illustrator_path).exists() {
        return Err(format!("Illustrator non trouvé : {}", illustrator_path));
    }

    let temp_dir = env::temp_dir();
    let file_path = temp_dir.join(&file_name);

    fs::write(&file_path, &content)
        .map_err(|e| format!("Erreur écriture fichier temporaire : {}", e))?;

    Command::new(&illustrator_path)
        .arg(&file_path)
        .spawn()
        .map_err(|e| format!("Erreur lancement Illustrator : {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

// Exécuter un script JSX dans Illustrator
#[tauri::command]
async fn run_illustrator_script(
    app: tauri::AppHandle,
    illustrator_path: String,
    script_name: String,
    params: String
) -> Result<String, String> {
    // Déterminer le chemin des assets FabRik
    // En mode dev: utiliser le chemin relatif depuis l'exe
    // En mode release: utiliser resource_dir
    let assets_dir = if cfg!(debug_assertions) {
        // Mode développement - remonter depuis target/debug vers src-tauri/assets
        let exe_dir = env::current_exe()
            .map_err(|e| format!("Erreur chemin exe: {}", e))?;
        let target_debug = exe_dir.parent()
            .ok_or("Impossible de trouver le dossier parent de l'exe")?;
        let target = target_debug.parent()
            .ok_or("Impossible de trouver le dossier target")?;
        let src_tauri = target.parent()
            .ok_or("Impossible de trouver le dossier src-tauri")?;
        src_tauri.join("assets").join("fabrik")
    } else {
        // Mode release - utiliser resource_dir
        let resource_path = app.path().resource_dir()
            .map_err(|e| format!("Erreur chemin ressources: {}", e))?;
        resource_path.join("assets").join("fabrik")
    };

    let scripts_dir = assets_dir.join("scripts");
    let actions_dir = assets_dir.join("actions");

    // Vérifier que les dossiers existent
    if !scripts_dir.exists() {
        return Err(format!("Dossier scripts non trouvé: {}", scripts_dir.display()));
    }
    if !actions_dir.exists() {
        return Err(format!("Dossier actions non trouvé: {}", actions_dir.display()));
    }

    // Créer un fichier temporaire pour le script avec les paramètres
    let temp_dir = env::temp_dir();
    let temp_script_path = temp_dir.join("fabrik_temp_script.jsx");

    // Lire le script original
    let script_path = scripts_dir.join(&script_name);
    let script_content = fs::read_to_string(&script_path)
        .map_err(|e| format!("Erreur lecture script {} (chemin: {}): {}", script_name, script_path.display(), e))?;

    // Construire les chemins d'actions avec des forward slashes pour JavaScript
    let vecto_texte_path = actions_dir.join("Vecto_Texte.aia").to_string_lossy().replace("\\", "/");
    let vecto_contour_path = actions_dir.join("Vecto_Contour.aia").to_string_lossy().replace("\\", "/");
    let offset_path = actions_dir.join("OffsetSet.aia").to_string_lossy().replace("\\", "/");
    let pathfinder_path = actions_dir.join("PathfinderUnion.aia").to_string_lossy().replace("\\", "/");
    let cutcontour_path = actions_dir.join("CutContour.aia").to_string_lossy().replace("\\", "/");
    let aligncentre_path = actions_dir.join("AlignCentre.aia").to_string_lossy().replace("\\", "/");

    // Parser les params JSON existants et ajouter les chemins d'actions
    let params_with_actions = if params == "{}" || params.is_empty() {
        format!(
            r#"{{
    "vectoTexteActionPath": "{}",
    "vectoContourActionPath": "{}",
    "offsetActionPath": "{}",
    "pathfinderUnionActionPath": "{}",
    "cutContourActionPath": "{}",
    "alignCentreActionPath": "{}"
}}"#,
            vecto_texte_path,
            vecto_contour_path,
            offset_path,
            pathfinder_path,
            cutcontour_path,
            aligncentre_path
        )
    } else {
        // Insérer les chemins dans les params existants
        let params_trimmed = params.trim();
        if params_trimmed.ends_with("}") {
            let without_closing = &params_trimmed[..params_trimmed.len()-1];
            format!(
                "{},\n    \"vectoTexteActionPath\": \"{}\",\n    \"vectoContourActionPath\": \"{}\",\n    \"offsetActionPath\": \"{}\",\n    \"pathfinderUnionActionPath\": \"{}\",\n    \"cutContourActionPath\": \"{}\",\n    \"alignCentreActionPath\": \"{}\"\n}}",
                without_closing,
                vecto_texte_path,
                vecto_contour_path,
                offset_path,
                pathfinder_path,
                cutcontour_path,
                aligncentre_path
            )
        } else {
            params
        }
    };

    // Créer le script complet avec les paramètres
    let full_script = format!(
        r#"// Parametres generes par GraphiDesk FabRik
// Chemins des actions:
// - Vecto Texte: {}
// - Offset: {}
var params = {};
// Script original
{}"#,
        vecto_texte_path,
        offset_path,
        params_with_actions,
        script_content
    );

    // Écrire le script temporaire
    fs::write(&temp_script_path, &full_script)
        .map_err(|e| format!("Erreur écriture script temporaire: {}", e))?;

    // Exécuter Illustrator avec le script
    let output = Command::new(&illustrator_path)
        .arg("-run")
        .arg(temp_script_path.to_string_lossy().to_string())
        .output()
        .map_err(|e| format!("Erreur exécution Illustrator: {}", e))?;

    if output.status.success() {
        Ok(format!("Script exécuté avec succès. Chemin temp: {}", temp_script_path.display()))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Erreur Illustrator: {}", stderr))
    }
}

// ===== PLUGIN INDESIGN COTES BAT =====

// Résout le dossier assets (dev : relatif à l'exe ; release : resource_dir)
fn resolve_assets_dir(app: &tauri::AppHandle, sub: &str) -> Result<std::path::PathBuf, String> {
    if cfg!(debug_assertions) {
        let exe_dir = env::current_exe().map_err(|e| format!("Erreur chemin exe: {}", e))?;
        let src_tauri = exe_dir
            .parent()
            .and_then(|p| p.parent())
            .and_then(|p| p.parent())
            .ok_or("Impossible de remonter jusqu'à src-tauri")?;
        Ok(src_tauri.join("assets").join(sub))
    } else {
        let resource_path = app
            .path()
            .resource_dir()
            .map_err(|e| format!("Erreur chemin ressources: {}", e))?;
        Ok(resource_path.join("assets").join(sub))
    }
}

const UPIA_PATH: &str = r"C:\Program Files\Common Files\Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent\UnifiedPluginInstallerAgent.exe";

/// Une extension UXP livrée avec GraphiDesk.
///
/// Les deux outils InDesign de l'atelier sont de même nature — c'est la
/// remarque de Jordan du 09/09/2026 : « c'est pareil en soi ». Ils sont donc
/// décrits ici, et tout le reste (état, installation, désinstallation) les
/// traite indifféremment.
struct PluginUxp {
    id: &'static str,
    nom: &'static str,
    fichier: &'static str,
}

const PLUGINS_UXP: &[PluginUxp] = &[
    PluginUxp {
        id: "com.izy.cotesbat",
        nom: "Cotes BAT",
        fichier: "Cotes-BAT.ccx",
    },
    PluginUxp {
        id: "com.izy.enseignistes",
        nom: "Rédaction des BAT",
        fichier: "BAT-Enseignistes.ccx",
    },
];

fn plugin_par_id(id: &str) -> Result<&'static PluginUxp, String> {
    PLUGINS_UXP
        .iter()
        .find(|p| p.id == id)
        .ok_or_else(|| format!("Extension inconnue : {}", id))
}

fn uxp_registry_path() -> Result<std::path::PathBuf, String> {
    let appdata = env::var("APPDATA").map_err(|_| "Variable APPDATA introuvable".to_string())?;
    Ok(std::path::Path::new(&appdata)
        .join("Adobe")
        .join("UXP")
        .join("PluginsInfo")
        .join("v1")
        .join("ID.json"))
}

/// Version livrée, lue DANS le .ccx.
///
/// ⚠ Elle était auparavant recopiée dans un `version.txt` à tenir à jour à la
/// main. Un fichier qui doit rester synchrone avec un autre finit toujours par
/// diverger : le manifeste du paquet est la seule source qui ne peut pas mentir.
fn version_embarquee(ccx: &std::path::Path) -> Result<String, String> {
    let fichier = fs::File::open(ccx)
        .map_err(|e| format!("Extension introuvable ({}) : {}", ccx.display(), e))?;
    let mut archive = zip::ZipArchive::new(fichier)
        .map_err(|e| format!("Paquet illisible ({}) : {}", ccx.display(), e))?;
    let mut manifeste = archive
        .by_name("manifest.json")
        .map_err(|e| format!("manifest.json absent du paquet : {}", e))?;
    let mut texte = String::new();
    {
        use std::io::Read;
        manifeste
            .read_to_string(&mut texte)
            .map_err(|e| format!("manifest.json illisible : {}", e))?;
    }
    let json: serde_json::Value =
        serde_json::from_str(&texte).map_err(|e| format!("manifest.json invalide : {}", e))?;
    json.get("version")
        .and_then(|v| v.as_str())
        .map(|v| v.to_string())
        .ok_or_else(|| "manifest.json sans version".to_string())
}

/// Versions d'une extension enregistrées dans le registre UXP d'InDesign.
fn versions_installees(id: &str) -> Vec<String> {
    let mut out = Vec::new();
    let Ok(reg) = uxp_registry_path() else { return out };
    let Ok(txt) = fs::read_to_string(&reg) else { return out };
    let Ok(json) = serde_json::from_str::<serde_json::Value>(&txt) else { return out };
    if let Some(plugins) = json.get("plugins").and_then(|p| p.as_array()) {
        for p in plugins {
            if p.get("pluginId").and_then(|v| v.as_str()) == Some(id) {
                if let Some(v) = p.get("versionString").and_then(|v| v.as_str()) {
                    out.push(v.to_string());
                }
            }
        }
    }
    out
}

/// Retire du registre UXP — et du disque — toutes les versions d'une extension
/// sauf, éventuellement, celle à conserver.
///
/// ⚠ UPIA laisse cohabiter plusieurs versions ; InDesign charge alors la plus
/// ancienne et les mises à jour semblent ne jamais prendre. Ce ménage est donc
/// indispensable après une installation — et c'est exactement le geste d'une
/// désinstallation, à ceci près qu'on ne garde rien.
fn purger_versions(id: &str, garder: Option<&str>) -> usize {
    let mut retirees = 0;
    let Ok(reg) = uxp_registry_path() else { return 0 };
    let Ok(txt) = fs::read_to_string(&reg) else { return 0 };
    let Ok(mut json) = serde_json::from_str::<serde_json::Value>(&txt) else { return 0 };
    if let Some(plugins) = json.get_mut("plugins").and_then(|p| p.as_array_mut()) {
        // ⚠ UPIA inscrit parfois DEUX FOIS la même version, au même chemin.
        // GraphiDesk lisait alors « v0.7.0 + v0.7.0 installée » et proposait
        // une mise à jour sans fin : réinstaller ajoutait un doublon de plus
        // au lieu d'en retirer. On ne garde donc qu'UNE entrée.
        let mut deja_gardee = false;
        plugins.retain(|p| {
            if p.get("pluginId").and_then(|v| v.as_str()) != Some(id) {
                return true;
            }
            let version = p.get("versionString").and_then(|v| v.as_str());
            if version == garder && !deja_gardee {
                deja_gardee = true;
                return true;
            }
            // ⚠ Un doublon pointe sur le MÊME dossier que l'entrée conservée :
            // n'effacer le dossier que s'il appartient à une autre version.
            if version != garder {
                if let (Some(v), Some(uxp)) = (
                    version,
                    reg.parent().and_then(|p| p.parent()).and_then(|p| p.parent()),
                ) {
                    let dossier = uxp
                        .join("Plugins")
                        .join("External")
                        .join(format!("{}_{}", id, v));
                    let _ = fs::remove_dir_all(dossier);
                }
            }
            retirees += 1;
            false
        });
        if let Ok(new_txt) = serde_json::to_string_pretty(&json) {
            let _ = fs::write(&reg, new_txt);
        }
    }
    retirees
}

// CREATE_NO_WINDOW : sans ce flag, lancer un programme console (tasklist,
// UPIA...) depuis une appli graphique fait FLASHER une fenêtre de terminal
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn hidden_command(program: &str) -> Command {
    #[allow(unused_mut)]
    let mut cmd = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

fn indesign_is_running() -> bool {
    hidden_command("tasklist")
        .args(["/FI", "IMAGENAME eq InDesign.exe", "/NH"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).contains("InDesign.exe"))
        .unwrap_or(false)
}

#[derive(serde::Serialize)]
struct IndesignPluginStatus {
    id: String,
    nom: String,
    embedded_version: String,
    installed_versions: Vec<String>,
    indesign_running: bool,
    upia_available: bool,
}

// État des extensions : version livrée avec GraphiDesk vs versions installées.
// ⚠️ async : une commande SYNCHRONE s'exécute sur le thread principal de
// l'app et `tasklist` peut prendre plusieurs secondes → fenêtre gelée
// (clics mis en file par Windows et rejoués après).
#[tauri::command]
async fn get_indesign_plugin_status(
    app: tauri::AppHandle,
) -> Result<Vec<IndesignPluginStatus>, String> {
    let assets = resolve_assets_dir(&app, "indesign")?;
    let indesign_running = indesign_is_running();
    let upia_available = std::path::Path::new(UPIA_PATH).exists();
    let mut sortie = Vec::new();
    for p in PLUGINS_UXP {
        // une extension absente des assets ne doit pas masquer les autres
        let Ok(embedded_version) = version_embarquee(&assets.join(p.fichier)) else {
            continue;
        };
        sortie.push(IndesignPluginStatus {
            id: p.id.to_string(),
            nom: p.nom.to_string(),
            embedded_version,
            installed_versions: versions_installees(p.id),
            indesign_running,
            upia_available,
        });
    }
    Ok(sortie)
}

// Installe (ou met à jour) une extension via UPIA, puis purge les anciennes
// versions du registre UXP.
#[tauri::command]
async fn install_indesign_plugin(app: tauri::AppHandle, id: String) -> Result<String, String> {
    let plugin = plugin_par_id(&id)?;
    if indesign_is_running() {
        return Err(format!(
            "Ferme InDesign avant d'installer « {} » (sinon l'ancienne version resterait chargée).",
            plugin.nom
        ));
    }
    if !std::path::Path::new(UPIA_PATH).exists() {
        return Err(
            "Installateur Adobe (UPIA) introuvable — Creative Cloud est-il installé ?".into(),
        );
    }
    let assets = resolve_assets_dir(&app, "indesign")?;
    let ccx = assets.join(plugin.fichier);
    if !ccx.exists() {
        return Err(format!("Extension introuvable : {}", ccx.display()));
    }
    let embedded = version_embarquee(&ccx)?;

    let output = hidden_command(UPIA_PATH)
        .arg("/install")
        .arg(&ccx)
        .output()
        .map_err(|e| format!("Erreur lancement UPIA : {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    if !stdout.contains("Successful") {
        return Err(format!(
            "Échec de l'installation : {}",
            if stdout.trim().is_empty() {
                String::from_utf8_lossy(&output.stderr).to_string()
            } else {
                stdout.to_string()
            }
        ));
    }

    purger_versions(plugin.id, Some(embedded.as_str()));
    Ok(embedded)
}

/// Retire une extension du poste : registre UXP et dossiers.
///
/// ⚠ Comme l'installation, exige InDesign fermé : le registre est relu au
/// démarrage, et retirer une extension chargée laisserait un panneau fantôme.
#[tauri::command]
async fn desinstaller_plugin_indesign(id: String) -> Result<String, String> {
    let plugin = plugin_par_id(&id)?;
    if indesign_is_running() {
        return Err(format!(
            "Ferme InDesign avant de désinstaller « {} ».",
            plugin.nom
        ));
    }
    let versions = versions_installees(plugin.id);
    if versions.is_empty() {
        return Err(format!(
            "« {} » n'est pas installée sur ce poste.",
            plugin.nom
        ));
    }
    let retirees = purger_versions(plugin.id, None);
    Ok(format!(
        "« {} » retirée de ce poste ({} version(s)).",
        plugin.nom, retirees
    ))
}

// Obtenir le chemin des assets FabRik
#[tauri::command]
fn get_fabrik_assets_path(app: tauri::AppHandle) -> Result<String, String> {
    let resource_path = app.path().resource_dir()
        .map_err(|e| format!("Erreur: {}", e))?;

    let fabrik_path = resource_path.join("assets").join("fabrik");
    Ok(fabrik_path.to_string_lossy().to_string())
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build());

    // Instance unique : en PRODUCTION uniquement. En développement, l'app de
    // test se fermerait silencieusement (exit 0) dès que la version installée
    // tourne — y compris masquée dans la barre système.
    #[cfg(not(debug_assertions))]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        // Quand une nouvelle instance est lancée, on affiche la fenêtre existante
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }));

    builder
        .invoke_handler(tauri::generate_handler![
            set_minimize_on_close,
            lire_page_google,
            get_minimize_on_close,
            quit_app,
            get_illustrator_path,
            check_illustrator_exists,
            run_illustrator_script,
            get_fabrik_assets_path,
            save_and_open_in_illustrator,
            save_temp_file,
            save_temp_binary,
            save_documents_file,
            read_temp_binary,
            supprimer_temp,
            save_fiche_vt,
            save_binary_to,
            focus_main_window,
            get_indesign_plugin_status,
            install_indesign_plugin,
            desinstaller_plugin_indesign,
            open_file_with,
            ressources::statut_ressource,
            ressources::installer_ressource,
            ressources::desinstaller_ressource,
            ressources::personnaliser_gabarit,
            ressources::personnaliser_dossier,
            ressources::zipper_dossier,
            ressources::dossier_temporaire,
            ressources::supprimer_ressources_perimees,
            ressources::creer_arborescence,
            ressources::lister_archive,
            ressources::identite_presente,
            ressources::extraire_entree
        ])
        .setup(|app| {
            // Créer le menu du tray
            let quit_item = MenuItem::with_id(app, "quit", "Quitter GraphiDesk", true, None::<&str>)?;
            let show_item = MenuItem::with_id(app, "show", "Afficher", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            // Créer l'icône du tray
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("GraphiDesk")
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    // Double-clic ou clic gauche pour afficher la fenêtre
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Si l'option "minimiser au lieu de fermer" est activée
                if MINIMIZE_ON_CLOSE.load(Ordering::SeqCst) {
                    // Empêcher la fermeture
                    api.prevent_close();
                    // Cacher la fenêtre (elle reste dans le tray)
                    let _ = window.hide();
                }
                // Sinon, laisser la fermeture se faire normalement
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
