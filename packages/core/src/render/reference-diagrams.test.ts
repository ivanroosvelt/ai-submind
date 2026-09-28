import { describe, it, expect } from "vitest";
import { render } from "./index.js";

// Los data-flo-* (decisión #26) no son geometría: se quitan antes de
// comparar, y así estos snapshots siguen sin regenerarse.
function geometry(svg: string): string {
  return svg.replace(/ data-flo-[a-z]+="[^"]*"/g, "");
}

// Los SVG de estos snapshots son los del lenguaje anterior (`diagram <kind>`)
// y NO se regeneraron: el lenguaje nuevo tiene que producirlos byte a byte.
describe("reference diagrams (visual snapshot)", () => {
  it("renders the login flowchart from the spec (branching decision)", () => {
    const source = [
      "entity start [Inicio]",
      "entity check {Login valido}",
      "entity home [Mostrar home]",
      "entity error [Mostrar error]",
      "",
      "flow login {",
      "  start -> check",
      "  check -> home : si",
      "  check -> error : no",
      "}",
      "",
    ].join("\n");

    const { diagrams, diagnostics } = render(source);

    expect(diagnostics).toEqual([]);
    expect(geometry(diagrams[0].svg)).toMatchSnapshot();
  });

  it("renders the login sequence diagram from the spec (three participants)", () => {
    const source = [
      "entity user [Usuario]",
      "entity api [API]",
      "entity db [Base de datos]",
      "",
      "sequence login {",
      "  user -> api : POST /login",
      "  api -> db : SELECT usuario",
      "  db -> api : fila",
      "  api -> user : 200 OK",
      "}",
      "",
    ].join("\n");

    const { diagrams, diagnostics } = render(source);

    expect(diagnostics).toEqual([]);
    expect(geometry(diagrams[0].svg)).toMatchSnapshot();
  });

  it("renders a sequence diagram whose entities have no shape (label = id)", () => {
    const source = ["entity a", "entity b", "", "sequence s {", "  a -> b : hola", "  b -> a : chau", "}", ""].join("\n");

    const { diagrams, diagnostics } = render(source);

    expect(diagnostics).toEqual([]);
    expect(geometry(diagrams[0].svg)).toMatchSnapshot();
  });
});
