import { useState, useEffect } from "react";
import {
  useEmailConfig,
  useUpdateEmailConfig,
  useEmailLogs,
  useSendHeuresSupEmail,
  type Destinataire,
} from "@/hooks/useEmailHeuresSup";
import { cn } from "@/lib/utils";
import {
  Mail,
  X,
  Plus,
  Trash2,
  Send,
  Settings,
  History,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";

const MOIS_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  annee: number;
  mois: number;
  semaines: number[];
}

export function EmailConfigModal({ isOpen, onClose, annee, mois, semaines }: Props) {
  const { data: config, isLoading: loadingConfig } = useEmailConfig();
  const { data: logs } = useEmailLogs(5);
  const updateConfig = useUpdateEmailConfig();
  const sendEmail = useSendHeuresSupEmail();

  const [activeTab, setActiveTab] = useState<"send" | "config" | "history">("send");
  const [destinataires, setDestinataires] = useState<Destinataire[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newType, setNewType] = useState<"to" | "cc">("to");
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => {
    if (config?.destinataires) {
      setDestinataires(config.destinataires);
    }
  }, [config?.destinataires]);

  if (!isOpen) return null;

  const handleAddDestinataire = () => {
    if (!newEmail || !newEmail.includes("@")) return;

    const newDest: Destinataire = {
      email: newEmail.trim(),
      type: newType,
      label: newLabel.trim() || undefined,
    };

    const updated = [...destinataires, newDest];
    setDestinataires(updated);
    setNewEmail("");
    setNewLabel("");
  };

  const handleRemoveDestinataire = (index: number) => {
    const updated = destinataires.filter((_, i) => i !== index);
    setDestinataires(updated);
  };

  const handleSaveConfig = () => {
    updateConfig.mutate({ destinataires });
  };

  const hasConfigChanges = JSON.stringify(destinataires) !== JSON.stringify(config?.destinataires);

  const handleSendEmail = () => {
    if (destinataires.length === 0) {
      return;
    }

    // Sauvegarder d'abord la config si elle a changé
    if (JSON.stringify(destinataires) !== JSON.stringify(config?.destinataires)) {
      updateConfig.mutate({ destinataires }, {
        onSuccess: () => {
          sendEmail.mutate({ annee, mois, semaines });
        },
      });
    } else {
      sendEmail.mutate({ annee, mois, semaines });
    }
  };

  const toDestinataires = destinataires.filter(d => d.type === "to");
  const ccDestinataires = destinataires.filter(d => d.type === "cc");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl w-full max-w-2xl mx-4 shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Envoi par email</h2>
              <p className="text-sm text-gray-500">
                {MOIS_LABELS[mois - 1]} {annee} - Semaines {semaines.join(", ")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("send")}
            className={cn(
              "flex-1 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === "send"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Send className="h-4 w-4 inline mr-2" />
            Envoyer
          </button>
          <button
            onClick={() => setActiveTab("config")}
            className={cn(
              "flex-1 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === "config"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Settings className="h-4 w-4 inline mr-2" />
            Destinataires
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={cn(
              "flex-1 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === "history"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <History className="h-4 w-4 inline mr-2" />
            Historique
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loadingConfig ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : activeTab === "send" ? (
            <div className="space-y-4">
              {/* Résumé de l'envoi */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">Récapitulatif</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>Période : {MOIS_LABELS[mois - 1]} {annee}</li>
                  <li>Semaines : {semaines.join(", ")}</li>
                  <li>Destinataires : {toDestinataires.length} principal(aux), {ccDestinataires.length} en copie</li>
                </ul>
              </div>

              {/* Liste des destinataires */}
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Destinataires</h3>
                {destinataires.length === 0 ? (
                  <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Aucun destinataire configuré</p>
                    <p className="text-sm">Allez dans l'onglet "Destinataires" pour en ajouter</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {toDestinataires.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-gray-500 uppercase">À</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {toDestinataires.map((d, i) => (
                            <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                              {d.label || d.email}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {ccDestinataires.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-gray-500 uppercase">Cc</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {ccDestinataires.map((d, i) => (
                            <span key={i} className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm">
                              {d.label || d.email}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Contenu de l'email */}
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Contenu</h3>
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                  <p><strong>Objet :</strong> Récapitulatif heures supplémentaires pôle graphique - Semaine{semaines.length > 1 ? "s" : ""} {semaines.join(", ")} {MOIS_LABELS[mois - 1]} {annee}</p>
                  <p className="mt-2"><strong>Corps :</strong> Tableau récapitulatif par graphiste avec total HS</p>
                  <p><strong>Pièce jointe :</strong> Détail jour par jour (CSV pour Excel)</p>
                </div>
              </div>
            </div>
          ) : activeTab === "config" ? (
            <div className="space-y-4">
              {/* Liste des destinataires existants */}
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Destinataires configurés</h3>
                {destinataires.length === 0 ? (
                  <p className="text-gray-500 text-sm py-4 text-center bg-gray-50 rounded-lg">
                    Aucun destinataire configuré
                  </p>
                ) : (
                  <div className="space-y-2">
                    {destinataires.map((d, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-xs font-medium",
                            d.type === "to" ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-600"
                          )}>
                            {d.type === "to" ? "À" : "Cc"}
                          </span>
                          <span className="text-sm">{d.email}</span>
                          {d.label && (
                            <span className="text-xs text-gray-400">({d.label})</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveDestinataire(i)}
                          className="p-1 hover:bg-red-100 rounded text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ajouter un destinataire */}
              <div className="border-t pt-4">
                <h3 className="font-medium text-gray-900 mb-2">Ajouter un destinataire</h3>
                <div className="grid gap-3">
                  <div className="flex gap-2">
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value as "to" | "cc")}
                      className="px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="to">À (principal)</option>
                      <option value="cc">Cc (copie)</option>
                    </select>
                    <input
                      type="email"
                      placeholder="Email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="flex-1 px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Libellé (optionnel, ex: Comptable)"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      className="flex-1 px-3 py-2 border rounded-lg text-sm"
                    />
                    <button
                      onClick={handleAddDestinataire}
                      disabled={!newEmail || !newEmail.includes("@")}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Ajouter
                    </button>
                  </div>
                </div>
              </div>

              {/* Bouton sauvegarder */}
              {hasConfigChanges && (
                <div className="border-t pt-4">
                  <button
                    onClick={handleSaveConfig}
                    disabled={updateConfig.isPending}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {updateConfig.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    Sauvegarder les modifications
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="font-medium text-gray-900 mb-2">Derniers envois</h3>
              {!logs || logs.length === 0 ? (
                <p className="text-gray-500 text-sm py-8 text-center bg-gray-50 rounded-lg">
                  Aucun envoi effectué
                </p>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          {log.status === "sent" ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : log.status === "failed" ? (
                            <XCircle className="h-4 w-4 text-red-500" />
                          ) : (
                            <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                          )}
                          <span className="font-medium text-sm">
                            {MOIS_LABELS[log.mois - 1]} {log.annee}
                          </span>
                          <span className="text-xs text-gray-400">
                            Sem. {log.semaines.join(", ")}
                          </span>
                        </div>
                        {log.error_message && (
                          <p className="text-xs text-red-500 mt-1">{log.error_message}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(log.sent_at).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === "send" && (
          <div className="p-4 border-t bg-gray-50">
            <button
              onClick={handleSendEmail}
              disabled={sendEmail.isPending || destinataires.length === 0}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {sendEmail.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Envoyer maintenant
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
