import { describe, it, expect } from "vitest";
import { markdownHtml } from "./note-view.js";

describe("markdownHtml", () => {
  it("títulos, párrafos, listas, énfasis y código inline escapado", () => {
    const html = markdownHtml("# Hola\n\nUn **fuerte** y *suave* con `a<b`.\n\n- uno\n- dos\n\n1. tres", () => "");
    expect(html).toBe(
      "<h1>Hola</h1><p>Un <strong>fuerte</strong> y <em>suave</em> con <code>a&lt;b</code>.</p>" +
        "<ul><li>uno</li><li>dos</li></ul><ol><li>tres</li></ol>"
    );
  });

  it("una cerca flo se reemplaza por sus diagramas; otra cerca queda como código", () => {
    const calls: [number, number][] = [];
    const body = "texto\n```flo\nflow x {}\n```\n```js\n1 < 2\n```";
    const html = markdownHtml(body, (start, end) => (calls.push([start, end]), "<svg/>"));
    expect(calls).toEqual([[2, 3]]);
    expect(html).toBe("<p>texto</p><svg/><pre><code>1 &lt; 2</code></pre>");
  });

  it("una cerca flo sin diagramas se muestra como código", () => {
    expect(markdownHtml("```flo\nroto\n```", () => "")).toBe("<pre><code>roto</code></pre>");
  });

  it("solo enlaza http(s)", () => {
    expect(markdownHtml("[a](https://x.cl) [b](javascript:alert(1))", () => "")).toBe(
      '<p><a href="https://x.cl" target="_blank" rel="noopener">a</a> [b](javascript:alert(1))</p>'
    );
  });
});
