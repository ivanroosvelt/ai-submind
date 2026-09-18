import { VERSION } from "@flo/core";
import { renderApp } from "./app";

const root = document.querySelector<HTMLDivElement>("#app");
if (root) {
  renderApp(root, VERSION);
}
