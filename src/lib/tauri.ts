import { invoke } from "@tauri-apps/api/core";

// Définir si la croix minimise ou ferme l'application
export async function setMinimizeOnClose(minimize: boolean): Promise<void> {
  await invoke("set_minimize_on_close", { minimize });
}

// Récupérer le comportement actuel
export async function getMinimizeOnClose(): Promise<boolean> {
  return await invoke("get_minimize_on_close");
}

// Quitter vraiment l'application (bypass le minimize on close)
export async function quitApp(): Promise<void> {
  await invoke("quit_app");
}
