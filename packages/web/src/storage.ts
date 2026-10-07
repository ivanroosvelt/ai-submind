import type { WorkspaceSnapshot } from "./workspace.js";

export const DB_NAME = "flo-editor";
const STORE_NAME = "drafts";
const DRAFT_KEY = "current";

/** Uri con la que se abre un borrador de antes de la Fase F (un string). */
export const LEGACY_DRAFT_URI = "diagrama.flo";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDraft(snapshot: WorkspaceSnapshot): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(snapshot, DRAFT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadDraft(): Promise<WorkspaceSnapshot | null> {
  const db = await openDb();
  const stored = await new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(DRAFT_KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  if (typeof stored === "string") {
    return { files: { [LEGACY_DRAFT_URI]: stored }, saved: {}, active: LEGACY_DRAFT_URI, dir: null, local: false };
  }
  const snapshot = stored as WorkspaceSnapshot | undefined;
  return snapshot && Object.keys(snapshot.files ?? {}).length > 0 ? snapshot : null;
}
