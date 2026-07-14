import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// ============================================
// Sonde de performance GLOBALE (diagnostic gel ~5s sortie Mesure photo).
// Active dès le démarrage + buffered : aucune tâche longue du thread JS ne
// peut lui échapper, même pendant un démontage React. Si un gel n'apparaît
// PAS ici, il vient du thread NATIF (commande Tauri synchrone, etc.).
// ============================================
try {
  const perfObs = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (e.duration >= 300) {
        // eslint-disable-next-line no-console
        console.warn(
          `[Perf] tâche longue JS : ${Math.round(e.duration)} ms (début à t+${Math.round(e.startTime)} ms)`
        );
      }
    }
  });
  perfObs.observe({ type: "longtask", buffered: true });
} catch {
  /* longtask non supporté */
}

// ============================================
// Handler d'erreur global — affiche les erreurs JS à l'écran
// au lieu d'un écran noir silencieux (utile pour debug post-release)
// ============================================
function displayFatalError(title: string, details: string) {
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = `
    <div style="
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1e293b;
      color: #f1f5f9;
      min-height: 100vh;
      overflow: auto;
    ">
      <h1 style="color: #ef4444; margin: 0 0 16px;">⚠️ GraphiDesk - Erreur critique</h1>
      <p style="margin: 0 0 8px; color: #cbd5e1;">${title}</p>
      <pre style="
        background: #0f172a;
        padding: 16px;
        border-radius: 8px;
        overflow-x: auto;
        font-size: 12px;
        white-space: pre-wrap;
        word-break: break-word;
        color: #fbbf24;
      ">${details}</pre>
      <p style="margin-top: 16px; color: #94a3b8; font-size: 14px;">
        Merci d'envoyer cet écran (capture) à Jordan pour diagnostic.
      </p>
      <button
        onclick="window.location.reload()"
        style="
          margin-top: 12px;
          padding: 8px 16px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        "
      >Réessayer</button>
    </div>
  `;
}

window.addEventListener("error", (event) => {
  displayFatalError(
    "Erreur JavaScript non gérée",
    `Message: ${event.message}\nFichier: ${event.filename}:${event.lineno}:${event.colno}\nStack: ${event.error?.stack ?? "(stack non disponible)"}`
  );
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  const details = typeof reason === "object"
    ? `${reason?.message ?? reason}\n${reason?.stack ?? ""}`
    : String(reason);
  displayFatalError("Promesse rejetée sans handler", details);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
