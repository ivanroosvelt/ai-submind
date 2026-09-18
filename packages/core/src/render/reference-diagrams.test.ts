import { describe, it, expect } from "vitest";
import { render } from "./index.js";

describe("reference diagrams (visual snapshot)", () => {
  it("renders the login flowchart from the spec (branching decision)", () => {
    const source = [
      "diagram flowchart",
      "",
      "start[Inicio]",
      "check{Login valido}",
      "home[Mostrar home]",
      "error[Mostrar error]",
      "",
      "start -> check",
      "check -> home : si",
      "check -> error : no",
      "",
    ].join("\n");

    const { svg, diagnostics } = render(source);

    expect(diagnostics).toEqual([]);
    expect(svg).toMatchSnapshot();
  });

  it("renders the login sequence diagram from the spec (three participants)", () => {
    const source = [
      "diagram sequence",
      "",
      "participant user as Usuario",
      "participant api as API",
      "participant db as Base de datos",
      "",
      "user -> api : POST /login",
      "api -> db : SELECT usuario",
      "db -> api : fila",
      "api -> user : 200 OK",
      "",
    ].join("\n");

    const { svg, diagnostics } = render(source);

    expect(diagnostics).toEqual([]);
    expect(svg).toMatchSnapshot();
  });

  it("renders a flowchart with a single node and no edges", () => {
    const source = ["diagram flowchart", "", "solo[Nodo unico]", ""].join("\n");

    const { svg, diagnostics } = render(source);

    expect(diagnostics).toEqual([]);
    expect(svg).toMatchSnapshot();
  });

  it("renders a sequence diagram with auto-declared participants (no explicit 'participant' lines)", () => {
    const source = ["diagram sequence", "", "a -> b : hola", "b -> a : chau", ""].join("\n");

    const { svg, diagnostics } = render(source);

    expect(diagnostics).toEqual([]);
    expect(svg).toMatchSnapshot();
  });
});
