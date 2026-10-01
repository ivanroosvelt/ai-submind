/**
 * Diálogos propios sobre <dialog> nativo (decisión #60), en vez de
 * prompt/alert/confirm: no bloquean la página y se ven como la app.
 * Escape o "Cancelar" = null.
 */
function openDialog(message: string, options: { input?: string; cancel: boolean }): Promise<string | null> {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "flo-dialog";
    let done = false;
    const finish = (value: string | null) => {
      if (done) return;
      done = true;
      dialog.close?.();
      dialog.remove();
      resolve(value);
    };

    const form = document.createElement("form");
    const text = document.createElement("p");
    text.textContent = message;
    form.append(text);
    const input = options.input === undefined ? null : document.createElement("input");
    if (input) {
      input.value = options.input!;
      form.append(input);
    }
    const buttons = document.createElement("p");
    buttons.className = "flo-dialog-buttons";
    if (options.cancel) {
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.value = "cancel";
      cancel.textContent = "Cancelar";
      cancel.addEventListener("click", () => finish(null));
      buttons.append(cancel);
    }
    const ok = document.createElement("button");
    ok.type = "submit";
    ok.value = "ok";
    ok.textContent = "Aceptar";
    buttons.append(ok);
    form.append(buttons);
    dialog.append(form);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      finish(input ? input.value : "ok");
    });
    // Escape: el <dialog> nativo dispara `cancel`.
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish(null);
    });

    document.body.append(dialog);
    // ponytail: jsdom no implementa showModal; ahí se abre sin modal.
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    if (input) input.select();
    (input ?? ok).focus();
  });
}

export function ask(message: string, initial = ""): Promise<string | null> {
  return openDialog(message, { input: initial, cancel: true });
}

export async function confirmDialog(message: string): Promise<boolean> {
  return (await openDialog(message, { cancel: true })) !== null;
}

export async function notify(message: string): Promise<void> {
  await openDialog(message, { cancel: false });
}
