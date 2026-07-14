use tauri::{
    WindowEvent,
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState},
    Manager,
};
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

// Écrit une fiche VT (json + photo) dans Documents\GraphiDesk\fiches_vt\{dossier}
// Le plugin InDesign "Cotes BAT" scanne ce dossier et charge la fiche la plus récente.
// On passe par USERPROFILE\Documents pour matcher os.homedir() côté UXP.
#[tauri::command]
fn save_fiche_vt(
    folder_name: String,
    json_content: String,
    photo_base64: String,
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
    Ok(dir.to_string_lossy().replace('\\', "/"))
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

    // Parser les params JSON existants et ajouter les chemins d'actions
    let params_with_actions = if params == "{}" || params.is_empty() {
        format!(
            r#"{{
    "vectoTexteActionPath": "{}",
    "vectoContourActionPath": "{}",
    "offsetActionPath": "{}",
    "pathfinderUnionActionPath": "{}",
    "cutContourActionPath": "{}"
}}"#,
            vecto_texte_path,
            vecto_contour_path,
            offset_path,
            pathfinder_path,
            cutcontour_path
        )
    } else {
        // Insérer les chemins dans les params existants
        let params_trimmed = params.trim();
        if params_trimmed.ends_with("}") {
            let without_closing = &params_trimmed[..params_trimmed.len()-1];
            format!(
                "{},\n    \"vectoTexteActionPath\": \"{}\",\n    \"vectoContourActionPath\": \"{}\",\n    \"offsetActionPath\": \"{}\",\n    \"pathfinderUnionActionPath\": \"{}\",\n    \"cutContourActionPath\": \"{}\"\n}}",
                without_closing,
                vecto_texte_path,
                vecto_contour_path,
                offset_path,
                pathfinder_path,
                cutcontour_path
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
const COTES_BAT_PLUGIN_ID: &str = "com.izy.cotesbat";

fn uxp_registry_path() -> Result<std::path::PathBuf, String> {
    let appdata = env::var("APPDATA").map_err(|_| "Variable APPDATA introuvable".to_string())?;
    Ok(std::path::Path::new(&appdata)
        .join("Adobe")
        .join("UXP")
        .join("PluginsInfo")
        .join("v1")
        .join("ID.json"))
}

// Versions du plugin Cotes BAT enregistrées dans le registre UXP d'InDesign
fn installed_plugin_versions() -> Vec<String> {
    let mut out = Vec::new();
    let Ok(reg) = uxp_registry_path() else { return out };
    let Ok(txt) = fs::read_to_string(&reg) else { return out };
    let Ok(json) = serde_json::from_str::<serde_json::Value>(&txt) else { return out };
    if let Some(plugins) = json.get("plugins").and_then(|p| p.as_array()) {
        for p in plugins {
            if p.get("pluginId").and_then(|v| v.as_str()) == Some(COTES_BAT_PLUGIN_ID) {
                if let Some(v) = p.get("versionString").and_then(|v| v.as_str()) {
                    out.push(v.to_string());
                }
            }
        }
    }
    out
}

fn indesign_is_running() -> bool {
    Command::new("tasklist")
        .args(["/FI", "IMAGENAME eq InDesign.exe", "/NH"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).contains("InDesign.exe"))
        .unwrap_or(false)
}

#[derive(serde::Serialize)]
struct IndesignPluginStatus {
    embedded_version: String,
    installed_versions: Vec<String>,
    indesign_running: bool,
    upia_available: bool,
}

// État du plugin : version livrée avec GraphiDesk vs versions installées
#[tauri::command]
fn get_indesign_plugin_status(app: tauri::AppHandle) -> Result<IndesignPluginStatus, String> {
    let assets = resolve_assets_dir(&app, "indesign")?;
    let embedded_version = fs::read_to_string(assets.join("version.txt"))
        .map_err(|e| format!("version.txt du plugin introuvable : {}", e))?
        .trim()
        .to_string();
    Ok(IndesignPluginStatus {
        embedded_version,
        installed_versions: installed_plugin_versions(),
        indesign_running: indesign_is_running(),
        upia_available: std::path::Path::new(UPIA_PATH).exists(),
    })
}

// Installe (ou met à jour) le plugin via UPIA puis purge les anciennes
// versions du registre UXP (UPIA laisse les doublons -> InDesign charge
// la plus ancienne et les mises à jour semblent ne jamais prendre).
#[tauri::command]
fn install_indesign_plugin(app: tauri::AppHandle) -> Result<String, String> {
    if indesign_is_running() {
        return Err("Ferme InDesign avant d'installer le plugin (sinon l'ancienne version resterait chargée).".into());
    }
    if !std::path::Path::new(UPIA_PATH).exists() {
        return Err("Installateur Adobe (UPIA) introuvable — Creative Cloud est-il installé ?".into());
    }
    let assets = resolve_assets_dir(&app, "indesign")?;
    let ccx = assets.join("Cotes-BAT.ccx");
    if !ccx.exists() {
        return Err(format!("Plugin introuvable : {}", ccx.display()));
    }
    let embedded = fs::read_to_string(assets.join("version.txt"))
        .map_err(|e| format!("version.txt introuvable : {}", e))?
        .trim()
        .to_string();

    let output = Command::new(UPIA_PATH)
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

    // purge des anciennes versions (registre + dossiers)
    if let Ok(reg) = uxp_registry_path() {
        if let Ok(txt) = fs::read_to_string(&reg) {
            if let Ok(mut json) = serde_json::from_str::<serde_json::Value>(&txt) {
                if let Some(plugins) = json.get_mut("plugins").and_then(|p| p.as_array_mut()) {
                    plugins.retain(|p| {
                        let is_old = p.get("pluginId").and_then(|v| v.as_str())
                            == Some(COTES_BAT_PLUGIN_ID)
                            && p.get("versionString").and_then(|v| v.as_str())
                                != Some(embedded.as_str());
                        if is_old {
                            // supprimer le dossier de la vieille version
                            if let Some(v) = p.get("versionString").and_then(|v| v.as_str()) {
                                if let Some(ext_dir) = reg
                                    .parent() // v1
                                    .and_then(|p| p.parent()) // PluginsInfo
                                    .and_then(|p| p.parent()) // UXP
                                {
                                    let folder = ext_dir
                                        .join("Plugins")
                                        .join("External")
                                        .join(format!("{}_{}", COTES_BAT_PLUGIN_ID, v));
                                    let _ = fs::remove_dir_all(folder);
                                }
                            }
                        }
                        !is_old
                    });
                    if let Ok(new_txt) = serde_json::to_string_pretty(&json) {
                        let _ = fs::write(&reg, new_txt);
                    }
                }
            }
        }
    }

    Ok(embedded)
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
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Quand une nouvelle instance est lancée, on affiche la fenêtre existante
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![
            set_minimize_on_close,
            get_minimize_on_close,
            quit_app,
            get_illustrator_path,
            check_illustrator_exists,
            run_illustrator_script,
            get_fabrik_assets_path,
            save_and_open_in_illustrator,
            save_temp_file,
            save_temp_binary,
            save_fiche_vt,
            get_indesign_plugin_status,
            install_indesign_plugin,
            open_file_with
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
