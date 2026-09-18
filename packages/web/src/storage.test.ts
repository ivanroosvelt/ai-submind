import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { saveDraft, loadDraft, DB_NAME } from "./storage.js";

async function resetDb(): Promise<void> {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

describe("draft autosave (IndexedDB)", () => {
  beforeEach(resetDb);

  it("returns null when nothing has been saved yet", async () => {
    expect(await loadDraft()).toBeNull();
  });

  it("round-trips a saved draft", async () => {
    await saveDraft("diagram flowchart\n\nstart[Inicio]\n");
    expect(await loadDraft()).toBe("diagram flowchart\n\nstart[Inicio]\n");
  });

  it("overwrites the previous draft on a second save", async () => {
    await saveDraft("diagram flowchart\n\na[A]\n");
    await saveDraft("diagram flowchart\n\nb[B]\n");
    expect(await loadDraft()).toBe("diagram flowchart\n\nb[B]\n");
  });
});
