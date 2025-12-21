import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import type { Contact, ContactInsert, ContactUpdate } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Contact as ContactIcon,
  Search,
  Phone,
  Mail,
  Building2,
  User,
  Users,
  X,
  Plus,
  Pencil,
  Trash2,
  Filter,
  ChevronDown,
} from "lucide-react";

// Fonction pour normaliser le texte (enlever les accents)
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Fonction pour formater le numéro de téléphone avec espaces (XX XX XX XX XX)
function formatPhoneNumber(phone: string): string {
  // Nettoyer le numéro (garder uniquement les chiffres)
  const digits = phone.replace(/\D/g, "");
  // Grouper par paires avec espaces
  return digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

// Hook pour récupérer tous les contacts
function useContacts() {
  return useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("type", { ascending: true })
        .order("nom", { ascending: true });

      if (error) throw error;
      return data as Contact[];
    },
  });
}

// Hook pour créer un contact
function useCreateContact() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);

  return useMutation({
    mutationFn: async (contact: Omit<ContactInsert, "created_by">) => {
      const { data, error } = await supabase
        .from("contacts")
        .insert({ ...contact, created_by: profile?.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact ajouté");
    },
    onError: (error) => {
      console.error("Erreur création contact:", error);
      toast.error("Erreur lors de l'ajout du contact");
    },
  });
}

// Hook pour modifier un contact
function useUpdateContact() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);

  return useMutation({
    mutationFn: async ({ id, ...updates }: ContactUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("contacts")
        .update({ ...updates, updated_by: profile?.id })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact modifié");
    },
    onError: (error) => {
      console.error("Erreur modification contact:", error);
      toast.error("Erreur lors de la modification");
    },
  });
}

// Hook pour supprimer un contact
function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact supprimé");
    },
    onError: (error) => {
      console.error("Erreur suppression contact:", error);
      toast.error("Erreur lors de la suppression");
    },
  });
}

// Types de filtre
type FilterType = "tous" | "interne" | "externe";

export default function Annuaire() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("tous");
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: contacts = [], isLoading } = useContacts();
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  // Filtrer les contacts
  const filteredContacts = contacts.filter((c) => {
    // Filtre par type
    if (filterType !== "tous" && c.type !== filterType) return false;

    // Filtre par recherche
    if (!search) return true;
    const normalized = normalizeText(search);
    return (
      normalizeText(c.nom).includes(normalized) ||
      (c.prenom && normalizeText(c.prenom).includes(normalized)) ||
      (c.fonction && normalizeText(c.fonction).includes(normalized)) ||
      (c.entreprise && normalizeText(c.entreprise).includes(normalized)) ||
      (c.telephone && normalizeText(c.telephone).includes(normalized)) ||
      (c.email && normalizeText(c.email).includes(normalized))
    );
  });

  // Séparer internes et externes
  const internes = filteredContacts.filter((c) => c.type === "interne");
  const externes = filteredContacts.filter((c) => c.type === "externe");

  // Compteurs pour les filtres
  const countInternes = contacts.filter((c) => c.type === "interne").length;
  const countExternes = contacts.filter((c) => c.type === "externe").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
            <ContactIcon className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Annuaire</h1>
            <p className="text-sm text-gray-500">
              Répertoire des contacts internes et externes
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nouveau contact
        </button>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-3">
        {/* Recherche */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un contact..."
            className="pl-9 pr-8 py-2 w-full border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-200 focus:outline-none transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
            >
              <X className="h-3 w-3 text-gray-400" />
            </button>
          )}
        </div>

        {/* Filtre type */}
        <div className="relative">
          <button
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors border",
              filterType !== "tous"
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            )}
          >
            <Filter className="h-4 w-4" />
            {filterType === "tous"
              ? "Tous"
              : filterType === "interne"
              ? `Internes (${countInternes})`
              : `Externes (${countExternes})`}
            <ChevronDown className="h-4 w-4" />
          </button>

          {showFilterMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowFilterMenu(false)}
              />
              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border py-1 z-20 min-w-[160px]">
                <button
                  onClick={() => {
                    setFilterType("tous");
                    setShowFilterMenu(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-gray-50",
                    filterType === "tous" && "bg-blue-50 text-blue-700"
                  )}
                >
                  Tous ({contacts.length})
                </button>
                <button
                  onClick={() => {
                    setFilterType("interne");
                    setShowFilterMenu(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2",
                    filterType === "interne" && "bg-blue-50 text-blue-700"
                  )}
                >
                  <User className="h-4 w-4" />
                  Internes ({countInternes})
                </button>
                <button
                  onClick={() => {
                    setFilterType("externe");
                    setShowFilterMenu(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2",
                    filterType === "externe" && "bg-blue-50 text-blue-700"
                  )}
                >
                  <Building2 className="h-4 w-4" />
                  Externes ({countExternes})
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Contenu */}
      {filteredContacts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {contacts.length === 0
            ? "Aucun contact dans l'annuaire. Commencez par en ajouter un !"
            : "Aucun contact trouvé pour cette recherche"}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Section Internes */}
          {(filterType === "tous" || filterType === "interne") &&
            internes.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Contacts internes ({internes.length})
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {internes.map((contact) => (
                    <ContactCard
                      key={contact.id}
                      contact={contact}
                      onEdit={() => setEditingContact(contact)}
                      onDelete={() => setDeleteConfirm(contact.id)}
                    />
                  ))}
                </div>
              </div>
            )}

          {/* Section Externes */}
          {(filterType === "tous" || filterType === "externe") &&
            externes.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Contacts externes ({externes.length})
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {externes.map((contact) => (
                    <ContactCard
                      key={contact.id}
                      contact={contact}
                      onEdit={() => setEditingContact(contact)}
                      onDelete={() => setDeleteConfirm(contact.id)}
                    />
                  ))}
                </div>
              </div>
            )}
        </div>
      )}

      {/* Modal création/édition */}
      {(isCreating || editingContact) && (
        <ContactModal
          contact={editingContact}
          onClose={() => {
            setIsCreating(false);
            setEditingContact(null);
          }}
          onSave={(data) => {
            if (editingContact) {
              updateContact.mutate(
                { id: editingContact.id, ...data },
                {
                  onSuccess: () => {
                    setEditingContact(null);
                  },
                }
              );
            } else {
              createContact.mutate(data, {
                onSuccess: () => {
                  setIsCreating(false);
                },
              });
            }
          }}
          isSaving={createContact.isPending || updateContact.isPending}
        />
      )}

      {/* Modal confirmation suppression */}
      {deleteConfirm && (
        <DeleteConfirmModal
          contact={contacts.find((c) => c.id === deleteConfirm)!}
          onClose={() => setDeleteConfirm(null)}
          onConfirm={() => {
            deleteContact.mutate(deleteConfirm, {
              onSuccess: () => {
                setDeleteConfirm(null);
              },
            });
          }}
          isDeleting={deleteContact.isPending}
        />
      )}
    </div>
  );
}

// Composant carte de contact
function ContactCard({
  contact,
  onEdit,
  onDelete,
}: {
  contact: Contact;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // Nom en majuscules, prénom avec première lettre en majuscule
  const nomMaj = contact.nom.toUpperCase();
  const displayName = contact.prenom
    ? `${contact.prenom} ${nomMaj}`
    : nomMaj;
  const initials = contact.prenom
    ? `${contact.prenom[0]}${contact.nom[0]}`
    : contact.nom.slice(0, 2);

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow group">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <span
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold flex-shrink-0 uppercase",
            contact.type === "interne"
              ? "bg-blue-100 text-blue-600"
              : "bg-orange-100 text-orange-600"
          )}
        >
          {initials}
        </span>

        {/* Infos */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 truncate">
              {displayName}
            </h3>
          </div>
          {contact.fonction && (
            <p className="text-sm text-gray-500 truncate">{contact.fonction}</p>
          )}
          {contact.type === "externe" && contact.entreprise && (
            <p className="text-xs text-gray-400 truncate flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {contact.entreprise}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
            title="Modifier"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600"
            title="Supprimer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Coordonnées */}
      <div className="mt-4 space-y-2">
        {contact.telephone ? (
          <a
            href={`tel:${contact.telephone}`}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors group/link"
          >
            <Phone className="h-4 w-4 text-gray-400 group-hover/link:text-blue-500" />
            <span>{formatPhoneNumber(contact.telephone)}</span>
          </a>
        ) : (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Phone className="h-4 w-4" />
            <span className="italic">Pas de téléphone</span>
          </div>
        )}

        {contact.email ? (
          <a
            href={`mailto:${contact.email}`}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors group/link"
          >
            <Mail className="h-4 w-4 text-gray-400 group-hover/link:text-blue-500" />
            <span className="truncate">{contact.email}</span>
          </a>
        ) : (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Mail className="h-4 w-4" />
            <span className="italic">Pas d'email</span>
          </div>
        )}
      </div>

      {/* Notes */}
      {contact.notes && (
        <p className="mt-3 text-xs text-gray-500 bg-gray-50 rounded p-2 line-clamp-2">
          {contact.notes}
        </p>
      )}
    </div>
  );
}

// Modal de création/édition
function ContactModal({
  contact,
  onClose,
  onSave,
  isSaving,
}: {
  contact: Contact | null;
  onClose: () => void;
  onSave: (data: ContactInsert) => void;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState<ContactInsert>({
    nom: contact?.nom || "",
    prenom: contact?.prenom || "",
    type: contact?.type || "interne",
    fonction: contact?.fonction || "",
    entreprise: contact?.entreprise || "",
    telephone: contact?.telephone || "",
    email: contact?.email || "",
    notes: contact?.notes || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nom.trim()) {
      toast.error("Le nom est obligatoire");
      return;
    }
    onSave({
      ...formData,
      nom: formData.nom.trim(),
      prenom: formData.prenom?.trim() || null,
      fonction: formData.fonction?.trim() || null,
      entreprise: formData.entreprise?.trim() || null,
      telephone: formData.telephone?.trim() || null,
      email: formData.email?.trim() || null,
      notes: formData.notes?.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {contact ? "Modifier le contact" : "Nouveau contact"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Type */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Type de contact
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: "interne" })}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-colors",
                  formData.type === "interne"
                    ? "bg-blue-50 border-blue-200 text-blue-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                )}
              >
                <User className="h-4 w-4" />
                Interne
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: "externe" })}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-colors",
                  formData.type === "externe"
                    ? "bg-orange-50 border-orange-200 text-orange-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                )}
              >
                <Building2 className="h-4 w-4" />
                Externe
              </button>
            </div>
          </div>

          {/* Nom / Prénom */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Prénom
              </label>
              <input
                type="text"
                value={formData.prenom || ""}
                onChange={(e) =>
                  setFormData({ ...formData, prenom: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-200 focus:outline-none"
                placeholder="Jean"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Nom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) =>
                  setFormData({ ...formData, nom: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-200 focus:outline-none"
                placeholder="Dupont"
                required
              />
            </div>
          </div>

          {/* Fonction */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              {formData.type === "interne"
                ? "Rôle dans l'entreprise"
                : "Fonction"}
            </label>
            <input
              type="text"
              value={formData.fonction || ""}
              onChange={(e) =>
                setFormData({ ...formData, fonction: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-200 focus:outline-none"
              placeholder={
                formData.type === "interne"
                  ? "Ex: Graphiste, Commercial..."
                  : "Ex: Directeur commercial..."
              }
            />
          </div>

          {/* Entreprise (externes uniquement) */}
          {formData.type === "externe" && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Entreprise
              </label>
              <input
                type="text"
                value={formData.entreprise || ""}
                onChange={(e) =>
                  setFormData({ ...formData, entreprise: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-200 focus:outline-none"
                placeholder="Nom de l'entreprise"
              />
            </div>
          )}

          {/* Coordonnées */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Téléphone
              </label>
              <input
                type="tel"
                value={formData.telephone || ""}
                onChange={(e) =>
                  setFormData({ ...formData, telephone: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-200 focus:outline-none"
                placeholder="06 12 34 56 78"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Email
              </label>
              <input
                type="email"
                value={formData.email || ""}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-200 focus:outline-none"
                placeholder="email@exemple.com"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Notes
            </label>
            <textarea
              value={formData.notes || ""}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-200 focus:outline-none resize-none"
              placeholder="Informations complémentaires..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving
                ? "Enregistrement..."
                : contact
                ? "Modifier"
                : "Ajouter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal de confirmation de suppression
function DeleteConfirmModal({
  contact,
  onClose,
  onConfirm,
  isDeleting,
}: {
  contact: Contact;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  const displayName = contact.prenom
    ? `${contact.prenom} ${contact.nom}`
    : contact.nom;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Supprimer ce contact ?
        </h2>
        <p className="text-gray-600 mb-6">
          Êtes-vous sûr de vouloir supprimer <strong>{displayName}</strong> de
          l'annuaire ? Cette action est irréversible.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {isDeleting ? "Suppression..." : "Supprimer"}
          </button>
        </div>
      </div>
    </div>
  );
}
