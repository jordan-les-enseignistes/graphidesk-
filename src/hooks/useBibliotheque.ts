// ============================================================
// Bibliothèque de visuels récurrents (Injecteur de fichiers)
// ============================================================
// Un item = fichier .ai (Storage) + vignette PNG + variantes de taille.
// Tout le monde (authentifié) lit, ajoute et supprime — décision Jordan.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const BUCKET = "biblio-items";

export interface BiblioVariante {
  label: string;
  largeurMm: number;
  hauteurMm: number;
  /** mode plan : décalage du contenu dans le plan de travail (mm dessinés) */
  offXMm?: number;
  offYMm?: number;
}

export interface BiblioItem {
  id: string;
  nom: string;
  /** "objet" = visuel redimensionné à l'injection — "plan" = plan de travail
   *  complet réinjecté tel quel (cotes du graphiste incluses) */
  type: "objet" | "plan";
  categorie: string;
  sous_categorie: string | null;
  variantes: BiblioVariante[];
  fichier_path: string;
  preview_path: string;
  created_by: string | null;
  created_at: string;
  /** corbeille : date de suppression douce (null = actif) */
  deleted_at: string | null;
}

const biblioKeys = {
  all: ["biblio_items"] as const,
  corbeille: ["biblio_corbeille"] as const,
  favoris: ["biblio_favoris"] as const,
  stats: ["biblio_stats"] as const,
};

export function useBiblioItems() {
  return useQuery({
    queryKey: biblioKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("biblio_items")
        .select("*")
        .is("deleted_at", null)
        .order("categorie")
        .order("sous_categorie")
        .order("nom");
      if (error) throw error;
      // purge opportuniste de la corbeille (> 30 jours) — sans bloquer
      void purgeCorbeille();
      return data as BiblioItem[];
    },
  });
}

/** Items a la corbeille (suppression douce < 30 jours) */
export function useBiblioCorbeille() {
  return useQuery({
    queryKey: biblioKeys.corbeille,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("biblio_items")
        .select("*")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return data as BiblioItem[];
    },
  });
}

/** Purge definitive des items en corbeille depuis plus de 30 jours */
async function purgeCorbeille(): Promise<void> {
  try {
    const limite = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { data } = await supabase
      .from("biblio_items")
      .select("id, fichier_path, preview_path")
      .not("deleted_at", "is", null)
      .lt("deleted_at", limite);
    if (!data?.length) return;
    const paths = data.flatMap((d) => [d.fichier_path, d.preview_path]);
    await supabase.storage.from(BUCKET).remove(paths);
    await supabase
      .from("biblio_items")
      .delete()
      .in("id", data.map((d) => d.id));
  } catch {
    /* best-effort */
  }
}

/** URL signée (1 h) de la vignette d'un item */
export async function previewUrl(previewPath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(previewPath, 3600);
  if (error || !data) throw new Error(error?.message ?? "vignette indisponible");
  return data.signedUrl;
}

/** Télécharge le .ai d'un item (bytes) */
export async function downloadItemFile(fichierPath: string): Promise<Uint8Array> {
  const { data, error } = await supabase.storage.from(BUCKET).download(fichierPath);
  if (error || !data) throw new Error(error?.message ?? "fichier indisponible");
  return new Uint8Array(await data.arrayBuffer());
}

export interface NewBiblioItem {
  nom: string;
  type: "objet" | "plan";
  categorie: string;
  sous_categorie: string | null;
  variantes: BiblioVariante[];
  /** .ai exporté par Illustrator */
  fichierBytes: Uint8Array;
  /** vignette PNG */
  previewBytes: Uint8Array;
}

export function useAddBiblioItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: NewBiblioItem) => {
      const id = crypto.randomUUID();
      const fichierPath = `${id}/item.ai`;
      const previewPath = `${id}/preview.png`;

      const up1 = await supabase.storage
        .from(BUCKET)
        .upload(fichierPath, new Blob([item.fichierBytes as BlobPart]), {
          contentType: "application/postscript",
          upsert: true,
        });
      if (up1.error) throw new Error(`Upload fichier : ${up1.error.message}`);

      const up2 = await supabase.storage
        .from(BUCKET)
        .upload(previewPath, new Blob([item.previewBytes as BlobPart]), {
          contentType: "image/png",
          upsert: true,
        });
      if (up2.error) throw new Error(`Upload vignette : ${up2.error.message}`);

      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("biblio_items").insert({
        id,
        nom: item.nom,
        type: item.type,
        categorie: item.categorie,
        sous_categorie: item.sous_categorie,
        variantes: item.variantes,
        fichier_path: fichierPath,
        preview_path: previewPath,
        created_by: auth.user?.id ?? null,
      });
      if (error) {
        await supabase.storage.from(BUCKET).remove([fichierPath, previewPath]);
        throw new Error(error.message);
      }
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: biblioKeys.all }),
  });
}

/** Suppression DOUCE : item envoye a la corbeille (restaurable 30 jours) */
export function useDeleteBiblioItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: BiblioItem) => {
      const { error } = await supabase
        .from("biblio_items")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", item.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: biblioKeys.all });
      qc.invalidateQueries({ queryKey: biblioKeys.corbeille });
    },
  });
}

/** Restaure un item depuis la corbeille */
export function useRestoreBiblioItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: BiblioItem) => {
      const { error } = await supabase
        .from("biblio_items")
        .update({ deleted_at: null })
        .eq("id", item.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: biblioKeys.all });
      qc.invalidateQueries({ queryKey: biblioKeys.corbeille });
    },
  });
}

/** Suppression DEFINITIVE (depuis la corbeille) */
export function useHardDeleteBiblioItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: BiblioItem) => {
      const { error } = await supabase.from("biblio_items").delete().eq("id", item.id);
      if (error) throw new Error(error.message);
      await supabase.storage.from(BUCKET).remove([item.fichier_path, item.preview_path]);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: biblioKeys.corbeille }),
  });
}

/** Met a jour la fiche d'un item (nom, categorie, variantes — pas le fichier) */
export function useUpdateBiblioItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      id: string;
      nom: string;
      categorie: string;
      sous_categorie: string | null;
      variantes: BiblioVariante[];
    }) => {
      const { error } = await supabase
        .from("biblio_items")
        .update({
          nom: p.nom,
          categorie: p.categorie,
          sous_categorie: p.sous_categorie,
          variantes: p.variantes,
        })
        .eq("id", p.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: biblioKeys.all }),
  });
}

// ============================================================
// Favoris (par utilisateur)
// ============================================================
export function useBiblioFavoris() {
  return useQuery({
    queryKey: biblioKeys.favoris,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return new Set<string>();
      const { data, error } = await supabase
        .from("biblio_favoris")
        .select("item_id")
        .eq("user_id", auth.user.id);
      if (error) throw error;
      return new Set((data ?? []).map((d) => d.item_id as string));
    },
  });
}

export function useToggleFavori() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { itemId: string; favori: boolean }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Non connecte");
      if (p.favori) {
        const { error } = await supabase
          .from("biblio_favoris")
          .upsert({ user_id: auth.user.id, item_id: p.itemId });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("biblio_favoris")
          .delete()
          .eq("user_id", auth.user.id)
          .eq("item_id", p.itemId);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: biblioKeys.favoris }),
  });
}

// ============================================================
// Journal d'injections (stats admin)
// ============================================================
export async function enregistrerInjections(itemIds: string[]): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    await supabase.from("biblio_injections").insert(
      itemIds.map((item_id) => ({ item_id, user_id: auth.user?.id ?? null }))
    );
  } catch {
    /* les stats ne doivent jamais bloquer une injection */
  }
}

export interface BiblioStats {
  parItem: Array<{ itemId: string; n: number }>;
  parUtilisateur: Array<{ userId: string; nom: string; n: number }>;
  total: number;
}

export function useBiblioStats(enabled: boolean) {
  return useQuery({
    queryKey: biblioKeys.stats,
    enabled,
    queryFn: async (): Promise<BiblioStats> => {
      const { data, error } = await supabase
        .from("biblio_injections")
        .select("item_id, user_id");
      if (error) throw error;
      const { data: profils } = await supabase.from("profiles").select("id, full_name");
      const noms = new Map((profils ?? []).map((pr) => [pr.id as string, pr.full_name as string]));
      const parItem = new Map<string, number>();
      const parUser = new Map<string, number>();
      for (const r of data ?? []) {
        parItem.set(r.item_id, (parItem.get(r.item_id) ?? 0) + 1);
        if (r.user_id) parUser.set(r.user_id, (parUser.get(r.user_id) ?? 0) + 1);
      }
      return {
        total: (data ?? []).length,
        parItem: [...parItem.entries()]
          .map(([itemId, n]) => ({ itemId, n }))
          .sort((a, b) => b.n - a.n),
        parUtilisateur: [...parUser.entries()]
          .map(([userId, n]) => ({ userId, nom: noms.get(userId) ?? "?", n }))
          .sort((a, b) => b.n - a.n),
      };
    },
  });
}
