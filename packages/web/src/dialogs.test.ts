import { describe, it, expect } from "vitest";
import { ask, confirmDialog, notify } from "./dialogs.js";

const open = () => document.querySelector<HTMLDialogElement>("dialog.flo-dialog")!;
const button = (value: string) => open().querySelector<HTMLButtonElement>(`button[value="${value}"]`)!;

describe("dialogs (#60)", () => {
  it("ask resolves the typed text and removes the dialog", async () => {
    const answer = ask("Nombre:", "viejo");
    expect(open().querySelector("input")!.value).toBe("viejo");
    open().querySelector("input")!.value = "nuevo";
    button("ok").click();
    expect(await answer).toBe("nuevo");
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("ask resolves null on Cancelar and on Escape", async () => {
    const cancelled = ask("Nombre:");
    button("cancel").click();
    expect(await cancelled).toBeNull();
    const escaped = ask("Nombre:");
    open().dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(await escaped).toBeNull();
  });

  it("shows the message as text, never as HTML", async () => {
    const answer = ask("<b>x</b>");
    expect(open().querySelector("p")!.textContent).toBe("<b>x</b>");
    expect(open().querySelector("b")).toBeNull();
    button("cancel").click();
    await answer;
  });

  it("confirmDialog resolves true on Aceptar and false on Cancelar", async () => {
    const yes = confirmDialog("¿Seguro?");
    button("ok").click();
    expect(await yes).toBe(true);
    const no = confirmDialog("¿Seguro?");
    button("cancel").click();
    expect(await no).toBe(false);
  });

  it("notify has only Aceptar", async () => {
    const done = notify("Listo");
    expect(open().querySelector('button[value="cancel"]')).toBeNull();
    button("ok").click();
    await expect(done).resolves.toBeUndefined();
  });
});
