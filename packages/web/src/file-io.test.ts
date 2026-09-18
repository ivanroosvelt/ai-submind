import { describe, it, expect, vi, afterEach } from "vitest";
import { hasFileSystemAccess, openFloFile, saveFloFile, downloadText } from "./file-io.js";

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker;
  delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker;
});

describe("hasFileSystemAccess", () => {
  it("is false when the browser has no File System Access API", () => {
    expect(hasFileSystemAccess()).toBe(false);
  });

  it("is true when window.showOpenFilePicker exists", () => {
    window.showOpenFilePicker = vi.fn();
    expect(hasFileSystemAccess()).toBe(true);
  });
});

describe("openFloFile", () => {
  it("reads the picked file's content via the File System Access API", async () => {
    const file = new File(["diagram flowchart\n"], "diagrama.flo", { type: "text/plain" });
    const handle = { getFile: vi.fn().mockResolvedValue(file) } as unknown as FileSystemFileHandle;
    window.showOpenFilePicker = vi.fn().mockResolvedValue([handle]);

    const result = await openFloFile();

    expect(result).toEqual({ source: "diagram flowchart\n", handle });
  });

  it("falls back to an <input type=file> picker and reads its content", async () => {
    const clickSpy = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(function (this: HTMLInputElement) {
        const file = new File(["diagram sequence\n"], "diagrama.flo", { type: "text/plain" });
        Object.defineProperty(this, "files", { value: [file], configurable: true });
        this.dispatchEvent(new Event("change"));
      });

    const result = await openFloFile();

    expect(result).toEqual({ source: "diagram sequence\n", handle: null });
    clickSpy.mockRestore();
  });

  it("returns null when the user cancels the native open picker", async () => {
    window.showOpenFilePicker = vi
      .fn()
      .mockRejectedValue(new DOMException("The user aborted a request.", "AbortError"));

    const result = await openFloFile();

    expect(result).toBeNull();
  });

  it("resolves null when the user cancels the fallback file picker", async () => {
    const clickSpy = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(function (this: HTMLInputElement) {
        this.dispatchEvent(new Event("cancel"));
      });

    const result = await openFloFile();

    expect(result).toBeNull();
    clickSpy.mockRestore();
  });
});

describe("saveFloFile", () => {
  it("writes through an existing handle without prompting again", async () => {
    window.showOpenFilePicker = vi.fn();
    const writable = { write: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined) };
    const handle = { createWritable: vi.fn().mockResolvedValue(writable) } as unknown as FileSystemFileHandle;

    const result = await saveFloFile("diagram flowchart\n", handle);

    expect(writable.write).toHaveBeenCalledWith("diagram flowchart\n");
    expect(writable.close).toHaveBeenCalledTimes(1);
    expect(result).toBe(handle);
  });

  it("prompts for a new file when there is no handle yet", async () => {
    const writable = { write: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined) };
    const handle = { createWritable: vi.fn().mockResolvedValue(writable) } as unknown as FileSystemFileHandle;
    window.showOpenFilePicker = vi.fn();
    window.showSaveFilePicker = vi.fn().mockResolvedValue(handle);

    const result = await saveFloFile("diagram sequence\n", null);

    expect(window.showSaveFilePicker).toHaveBeenCalledTimes(1);
    expect(result).toBe(handle);
  });

  it("downloads a .flo file when the browser has no File System Access API", async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const result = await saveFloFile("diagram flowchart\n", null);

    expect(result).toBeNull();
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("returns null without falling back to a download when the user cancels the save picker", async () => {
    window.showOpenFilePicker = vi.fn();
    window.showSaveFilePicker = vi
      .fn()
      .mockRejectedValue(new DOMException("The user aborted a request.", "AbortError"));
    const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const result = await saveFloFile("diagram sequence\n", null);

    expect(result).toBeNull();
    expect(anchorClickSpy).not.toHaveBeenCalled();
  });
});

describe("downloadText", () => {
  it("triggers a download with the given filename and mime type", () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const createUrlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");

    downloadText("hola", "a.flo", "text/plain");

    const blob = createUrlSpy.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("text/plain");
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
