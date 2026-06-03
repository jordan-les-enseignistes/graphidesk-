import { useState } from "react";
import {
  useRoles,
  useRolePermissions,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  useTogglePermission,
} from "@/hooks/useRoles";
import { PERMISSIONS, PERMISSION_CATEGORIES, type PermissionCategory } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Shield, Plus, Pencil, Trash2, Lock } from "lucide-react";
import type { Role } from "@/types";
import { toast } from "sonner";
import { getContrastTextColor } from "@/lib/utils";

// Palette de couleurs prédéfinies pour les rôles (hex)
const ROLE_COLORS = [
  "#dc2626", // red
  "#ea580c", // orange
  "#d97706", // amber
  "#65a30d", // lime
  "#16a34a", // green
  "#0d9488", // teal
  "#0891b2", // cyan
  "#2563eb", // blue
  "#3b82f6", // blue light
  "#7c3aed", // violet
  "#c026d3", // fuchsia
  "#db2777", // pink
  "#6b7280", // gray
  "#475569", // slate
] as const;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function RolesManager() {
  const { data: roles, isLoading } = useRoles();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();

  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);

  const handleCreate = () => {
    setEditingRole(null);
    setIsCreating(true);
  };

  const handleEdit = (role: Role) => {
    setIsCreating(false);
    setEditingRole(role);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteRole.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Gestion des rôles
          </CardTitle>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau rôle
          </Button>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-gray-500 dark:text-slate-400">
            Les rôles définissent quels onglets et actions sont accessibles à chaque utilisateur.
            Les rôles système (Administrateur, Graphiste) ne peuvent pas être supprimés.
          </p>

          {isLoading ? (
            <div className="py-8 text-center text-gray-500 dark:text-slate-400">Chargement...</div>
          ) : roles && roles.length > 0 ? (
            <div className="space-y-2">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-slate-700 p-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: role.couleur }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge
                          className="text-xs border-0"
                          style={{
                            backgroundColor: role.couleur,
                            color: getContrastTextColor(role.couleur),
                          }}
                        >
                          {role.label}
                        </Badge>
                        {role.is_system && (
                          <Badge variant="secondary" className="text-xs">
                            <Lock className="mr-1 h-3 w-3" />
                            Système
                          </Badge>
                        )}
                        {role.is_graphiste && (
                          <Badge variant="outline" className="text-xs">
                            Graphiste
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{role.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(role)}
                      title="Modifier le rôle"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                      onClick={() => setDeleteTarget(role)}
                      disabled={role.is_system}
                      title={role.is_system ? "Les rôles système ne peuvent pas être supprimés" : "Supprimer le rôle"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 dark:text-slate-400 py-4">Aucun rôle défini.</p>
          )}
        </CardContent>
      </Card>

      {/* Dialog de création / édition */}
      {(isCreating || editingRole) && (
        <RoleEditDialog
          role={editingRole}
          isCreating={isCreating}
          onClose={() => {
            setIsCreating(false);
            setEditingRole(null);
          }}
          onSubmit={async (data) => {
            if (isCreating) {
              const created = await createRole.mutateAsync(data);
              // Après création, on bascule en mode édition pour configurer les permissions
              setIsCreating(false);
              setEditingRole(created);
            } else if (editingRole) {
              await updateRole.mutateAsync({ id: editingRole.id, updates: data });
              // Fermer la modale après la mise à jour
              setEditingRole(null);
            }
          }}
        />
      )}

      {/* Confirmation suppression */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Supprimer le rôle "${deleteTarget?.label ?? ""}"`}
        description="Les utilisateurs ayant ce rôle ne seront plus liés à aucun rôle. Vous pourrez leur en réassigner un. Cette action est irréversible."
        confirmText="Supprimer"
        variant="danger"
        icon="delete"
        onConfirm={handleDelete}
        loading={deleteRole.isPending}
      />
    </>
  );
}

// =========================================================
// Dialog d'édition / création d'un rôle
// =========================================================

interface RoleFormData {
  slug: string;
  label: string;
  is_graphiste: boolean;
  couleur: string;
}

interface RoleEditDialogProps {
  role: Role | null;
  isCreating: boolean;
  onClose: () => void;
  onSubmit: (data: RoleFormData) => Promise<void>;
}

function RoleEditDialog({ role, isCreating, onClose, onSubmit }: RoleEditDialogProps) {
  const [formData, setFormData] = useState<RoleFormData>({
    slug: role?.slug ?? "",
    label: role?.label ?? "",
    is_graphiste: role?.is_graphiste ?? false,
    couleur: role?.couleur ?? ROLE_COLORS[7], // blue par défaut
  });
  const [saving, setSaving] = useState(false);

  const handleLabelChange = (label: string) => {
    setFormData((prev) => ({
      ...prev,
      label,
      // Auto-générer le slug uniquement en mode création et si l'utilisateur n'a pas touché au slug
      slug: isCreating ? slugify(label) : prev.slug,
    }));
  };

  const handleSubmit = async () => {
    if (!formData.label.trim()) {
      toast.error("Le libellé est obligatoire");
      return;
    }
    if (!formData.slug.trim()) {
      toast.error("Le slug est obligatoire");
      return;
    }
    setSaving(true);
    try {
      await onSubmit(formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <Shield className="h-5 w-5" />
            {isCreating ? "Nouveau rôle" : `Modifier "${role?.label}"`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Libellé */}
          <div className="space-y-2">
            <Label htmlFor="label">Libellé du rôle *</Label>
            <Input
              id="label"
              value={formData.label}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder="Ex: Gestionnaire dossier mairie"
              disabled={role?.is_system}
            />
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <Label htmlFor="slug">Slug technique *</Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: slugify(e.target.value) })}
              placeholder="gestionnaire-dossier-mairie"
              disabled={role?.is_system}
            />
            <p className="text-xs text-gray-400 dark:text-slate-500">
              Identifiant technique non visible par les utilisateurs.
            </p>
          </div>

          {/* Couleur */}
          <div className="space-y-2">
            <Label>Couleur du badge</Label>
            <div className="flex flex-wrap gap-2">
              {ROLE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, couleur: color })}
                  className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                    formData.couleur === color
                      ? "border-gray-900 dark:border-white scale-110"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Flag is_graphiste */}
          <label className="flex items-start gap-3 rounded-lg border dark:border-slate-700 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50">
            <input
              type="checkbox"
              checked={formData.is_graphiste}
              onChange={(e) => setFormData({ ...formData, is_graphiste: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <div className="font-medium">Apparaît dans la liste des graphistes</div>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Coche cette case si les utilisateurs avec ce rôle doivent apparaître dans les dropdowns
                de graphistes, les statistiques par graphiste, etc.
              </p>
            </div>
          </label>

          {/* Section permissions (seulement en mode édition, après création) */}
          {!isCreating && role && (
            <div className="border-t dark:border-slate-700 pt-4">
              <RolePermissionsEditor roleId={role.id} />
            </div>
          )}

          {isCreating && (
            <p className="text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded p-3">
              💡 Une fois le rôle créé, tu pourras configurer ses permissions dans la fenêtre suivante.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !formData.label.trim()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? "Enregistrement..." : isCreating ? "Créer" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =========================================================
// Éditeur de permissions pour un rôle donné (checkboxes par catégorie)
// =========================================================

function RolePermissionsEditor({ roleId }: { roleId: string }) {
  const { data: rolePerms, isLoading } = useRolePermissions(roleId);
  const togglePerm = useTogglePermission();

  const enabledSet = new Set((rolePerms ?? []).map((rp) => rp.permission_key));

  const handleToggle = (key: string, currentlyEnabled: boolean) => {
    togglePerm.mutate({ roleId, permissionKey: key, enabled: !currentlyEnabled });
  };

  if (isLoading) {
    return <p className="text-sm text-gray-500 dark:text-slate-400">Chargement des permissions...</p>;
  }

  const categories: PermissionCategory[] = ["access", "manage"];

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-semibold">Permissions</Label>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
          Coche les permissions accordées à ce rôle.
        </p>
      </div>

      {categories.map((cat) => {
        const catInfo = PERMISSION_CATEGORIES[cat];
        const perms = PERMISSIONS.filter((p) => p.category === cat);

        return (
          <div key={cat} className="space-y-2">
            <div className="flex items-baseline justify-between border-b dark:border-slate-700 pb-1">
              <h4 className="font-medium text-sm uppercase tracking-wider text-gray-600 dark:text-slate-300">
                {catInfo.label}
              </h4>
              <span className="text-xs text-gray-400 dark:text-slate-500">
                {perms.filter((p) => enabledSet.has(p.key)).length} / {perms.length}
              </span>
            </div>
            <div className="space-y-1">
              {perms.map((perm) => {
                const enabled = enabledSet.has(perm.key);
                return (
                  <label
                    key={perm.key}
                    className="flex items-start gap-3 rounded p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50"
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => handleToggle(perm.key, enabled)}
                      disabled={togglePerm.isPending}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{perm.label}</div>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{perm.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
