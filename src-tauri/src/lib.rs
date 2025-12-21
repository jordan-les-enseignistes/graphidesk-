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
            get_fabrik_assets_path
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
