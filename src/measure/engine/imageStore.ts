// ============================================================
// Persistance des photos en IndexedDB (une entrée par photo)
// ============================================================
// Le document (faces, zones, calibrations) est persisté en localStorage
// (léger). Les photos, trop volumineuses, sont stockées ici : à la
// réouverture du module, la session complète est restaurée.
//
// v1.5 multi-faces : clé = photoId. L'ancienne entrée unique ("current")
// est lue une dernière fois pour la migration puis réécrite sous l'id
// conventionnel LEGACY_PHOTO_ID.

const DB_NAME = "graphidesk-measure";
const STORE = "photo";
const LEGACY_KEY = "current";

interface StoredPhoto {
  name: string;
  blob: Blob;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePhotoBlob(photoId: string, name: string, blob: Blob): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ name, blob } satisfies StoredPhoto, photoId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function loadPhotoBlob(photoId: string): Promise<StoredPhoto | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(photoId);
      req.onsuccess = () => {
        db.close();
        const val = req.result as StoredPhoto | undefined;
        resolve(val && val.blob instanceof Blob ? val : null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    return null;
  }
}

/** Migration : lit l'ancienne entrée unique v1 (clé "current"), la réécrit
 *  sous `legacyId` et supprime l'ancienne clé. Renvoie la photo ou null. */
export async function migrateLegacyBlob(legacyId: string): Promise<StoredPhoto | null> {
  const old = await loadPhotoBlob(LEGACY_KEY);
  if (!old) return null;
  try {
    await savePhotoBlob(legacyId, old.name, old.blob);
    await deletePhotoBlob(LEGACY_KEY);
  } catch {
    // best effort — au pire l'ancienne clé traîne
  }
  return old;
}

export async function deletePhotoBlob(photoId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(photoId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // best effort
  }
}

/** Vide TOUTES les photos de la session (reset complet) */
export async function clearPhotoBlobs(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // best effort
  }
}
