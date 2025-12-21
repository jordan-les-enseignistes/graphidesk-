import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "sonner";
import type { Profile } from "@/types";
import { Users, Plus, Edit, UserX, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBadgeClassName } from "@/lib/badgeColors";

export default function Utilisateurs() {
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [toggleConfirm, setToggleConfirm] = useState<Profile | null>(null);

  // Form state
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [initials, setInitials] = useState("");
  const [role, setRole] = useState<"admin" | "graphiste">("graphiste");
  const [password, setPassword] = useState("");

  // Récupérer tous les utilisateurs (y compris inactifs)
  const { data: users, isLoading } = useQuery({
    queryKey: ["users-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");

      if (error) throw error;
      return data as Profile[];
    },
  });

  // Créer un utilisateur
  const createUser = useMutation({
    mutationFn: async (userData: {
      email: string;
      password: string;
      full_name: string;
      initials: string;
      role: "admin" | "graphiste";
    }) => {
      // Créer un client Supabase isolé pour ne pas affecter la session principale
      const { createClient } = await import("@supabase/supabase-js");
      const isolatedClient = createClient(
        "https://wkdubjbozmdohzezhmsp.supabase.co",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrZHViamJvem1kb2h6ZXpobXNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNjAxOTcsImV4cCI6MjA4MTYzNjE5N30.T308WxKcKYv2dkTtXSkDY9M9tma47XrSuadJ7EYfB54",
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
          },
        }
      );

      // Créer l'utilisateur via le client isolé
      const { data, error } = await isolatedClient.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            full_name: userData.full_name,
            initials: userData.initials.toUpperCase(),
            role: userData.role,
          },
        },
      });

      if (error) {
        throw error;
      }

      // Si l'utilisateur existe déjà avec un compte non confirmé
      if (data.user && !data.user.identities?.length) {
        throw new Error("Un utilisateur avec cet email existe déjà");
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-all"] });
      toast.success("Utilisateur créé avec succès");
      resetForm();
      setShowCreateModal(false);
    },
    onError: (error: Error) => {
      if (error.message.includes("already registered")) {
        toast.error("Cet email est déjà utilisé");
      } else if (error.message.includes("existe déjà")) {
        toast.error(error.message);
      } else {
        toast.error("Erreur lors de la création: " + error.message);
      }
    },
  });

  // Mettre à jour un utilisateur
  const updateUser = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Profile>;
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update(data)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-all"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Utilisateur mis à jour");
      resetForm();
      setEditingUser(null);
    },
    onError: () => {
      toast.error("Erreur lors de la mise à jour");
    },
  });

  // Toggle actif/inactif
  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users-all"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success(
        variables.is_active ? "Utilisateur réactivé" : "Utilisateur désactivé"
      );
      setToggleConfirm(null);
    },
    onError: () => {
      toast.error("Erreur lors de la modification");
    },
  });

  const resetForm = () => {
    setEmail("");
    setFullName("");
    setInitials("");
    setRole("graphiste");
    setPassword("");
  };

  const openEditModal = (user: Profile) => {
    setFullName(user.full_name);
    setInitials(user.initials);
    setRole(user.role);
    setEditingUser(user);
  };

  const handleCreateSubmit = () => {
    if (!email || !password || !fullName || !initials) {
      toast.error("Tous les champs sont requis");
      return;
    }

    createUser.mutate({
      email,
      password,
      full_name: fullName,
      initials: initials.toUpperCase(),
      role,
    });
  };

  const handleEditSubmit = () => {
    if (!fullName || !initials || !editingUser) {
      toast.error("Tous les champs sont requis");
      return;
    }

    updateUser.mutate({
      id: editingUser.id,
      data: {
        full_name: fullName,
        initials: initials.toUpperCase(),
        role,
      },
    });
  };

  const roleOptions = [
    { value: "graphiste", label: "Graphiste" },
    { value: "admin", label: "Admin" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
            <Users className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Utilisateurs</h1>
            <p className="text-sm text-gray-500">
              Gestion des comptes utilisateurs
            </p>
          </div>
        </div>

        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvel utilisateur
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Initiales</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <div className="flex items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    <span className="ml-2 text-gray-500">Chargement...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : !users?.length ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-gray-500">
                  Aucun utilisateur
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow
                  key={user.id}
                  className={!user.is_active ? "bg-gray-50 opacity-60" : ""}
                >
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell className="text-gray-500">{user.email}</TableCell>
                  <TableCell>
                    <span className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
                      getBadgeClassName(user.badge_color)
                    )}>
                      {user.initials}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.role === "admin" ? "default" : "secondary"}
                    >
                      {user.role === "admin" ? "Admin" : "Graphiste"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.is_active ? (
                      <Badge variant="success">Actif</Badge>
                    ) : (
                      <Badge variant="destructive">Inactif</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditModal(user)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setToggleConfirm(user)}
                        className={
                          user.is_active
                            ? "text-red-600 hover:text-red-700"
                            : "text-green-600 hover:text-green-700"
                        }
                      >
                        {user.is_active ? (
                          <UserX className="h-4 w-4" />
                        ) : (
                          <UserCheck className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal création */}
      <Dialog open={showCreateModal} onOpenChange={(open) => {
        if (!open) resetForm();
        setShowCreateModal(open);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvel utilisateur</DialogTitle>
            <DialogDescription>
              Créez un nouveau compte utilisateur pour l'application.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                type="email"
                placeholder="email@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-password">Mot de passe</Label>
              <Input
                id="create-password"
                type="password"
                placeholder="Minimum 6 caractères"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-name">Nom complet</Label>
              <Input
                id="create-name"
                placeholder="Prénom Nom"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-initials">Initiales</Label>
              <Input
                id="create-initials"
                placeholder="Ex: JD, C, Q"
                value={initials}
                onChange={(e) => setInitials(e.target.value.toUpperCase())}
                maxLength={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-role">Rôle</Label>
              <Select
                id="create-role"
                options={roleOptions}
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "graphiste")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              resetForm();
              setShowCreateModal(false);
            }}>
              Annuler
            </Button>
            <Button
              onClick={handleCreateSubmit}
              disabled={createUser.isPending}
            >
              {createUser.isPending ? "Création..." : "Créer l'utilisateur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal édition */}
      <Dialog
        open={!!editingUser}
        onOpenChange={(open) => {
          if (!open) {
            resetForm();
            setEditingUser(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={editingUser?.email ?? ""} disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-name">Nom complet</Label>
              <Input
                id="edit-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-initials">Initiales</Label>
              <Input
                id="edit-initials"
                value={initials}
                onChange={(e) => setInitials(e.target.value.toUpperCase())}
                maxLength={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-role">Rôle</Label>
              <Select
                id="edit-role"
                options={roleOptions}
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "graphiste")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setEditingUser(null);
              }}
            >
              Annuler
            </Button>
            <Button onClick={handleEditSubmit} disabled={updateUser.isPending}>
              {updateUser.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation toggle */}
      <ConfirmDialog
        open={!!toggleConfirm}
        onOpenChange={(open) => !open && setToggleConfirm(null)}
        title={
          toggleConfirm?.is_active
            ? "Désactiver l'utilisateur"
            : "Réactiver l'utilisateur"
        }
        description={
          toggleConfirm?.is_active
            ? `${toggleConfirm?.full_name} ne pourra plus se connecter.`
            : `${toggleConfirm?.full_name} pourra à nouveau se connecter.`
        }
        confirmText={toggleConfirm?.is_active ? "Désactiver" : "Réactiver"}
        variant={toggleConfirm?.is_active ? "danger" : "info"}
        icon="warning"
        onConfirm={() =>
          toggleConfirm &&
          toggleActive.mutate({
            id: toggleConfirm.id,
            is_active: !toggleConfirm.is_active,
          })
        }
        loading={toggleActive.isPending}
      />
    </div>
  );
}
