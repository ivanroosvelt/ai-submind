import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { saveDraft, loadDraft, DB_NAME, LEGACY_DRAFT_URI } from "./storage.js";
import type { WorkspaceSnapshot } from "./workspace.js";

async function resetDb(): Promise<void> {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

async function putRaw(value: unknown): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve) => {
    const tx = db.transaction("drafts", "readwrite");
    tx.objectStore("drafts").put(value, "current");
    tx.oncomplete = () => resolve();
  });
  db.close();
}

describe("drafts", () => {
  beforeEach(resetDb);

  it("returns null when nothing was saved", async () => {
    expect(await loadDraft()).toBeNull();
  });

  it("round-trips a workspace snapshot", async () => {
    const snapshot: WorkspaceSnapshot = {
      files: { "a.flo": "entity a\n", "kb/n.md": "---\n" },
      saved: { "a.flo": "entity a\n" },
      active: "kb/n.md",
      dir: null,
    };
    await saveDraft(snapshot);
    expect(await loadDraft()).toEqual(snapshot);
  });

  it("opens a draft from before workspaces as diagrama.flo", async () => {
    await putRaw("flow viejo {\n}\n");
    expect(await loadDraft()).toEqual({
      files: { [LEGACY_DRAFT_URI]: "flow viejo {\n}\n" },
      saved: {},
      active: LEGACY_DRAFT_URI,
      dir: null,
    });
  });

  it("ignores a snapshot without files", async () => {
    await putRaw({ files: {}, saved: {}, active: "", dir: null });
    expect(await loadDraft()).toBeNull();
  });
});
