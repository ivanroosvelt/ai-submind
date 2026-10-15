// Text normalization for lexical search (PLAN-002 S6): folding and tokenizer.
import { describe, expect, it } from "vitest";
import { fold, tokenize } from "../../src/query/text.js";

describe("fold", () => {
  it("removes accents and case, and applies compatibility decomposition", () => {
    expect(fold("VEHÍCULO")).toBe("vehiculo");
    expect(fold("Año")).toBe("ano");
    expect(fold("ﬁle")).toBe("file");
    expect(fold("İstanbul")).toBe("istanbul");
    expect(fold("Ⅻ²")).toBe("xii2");
  });
});

describe("tokenize", () => {
  it("emits each run and its camelCase parts", () => {
    expect(tokenize("yearOfProduction")).toEqual(["yearofproduction", "year", "of", "production"]);
    expect(tokenize("HTTPServer2")).toEqual(["httpserver2", "http", "server", "2"]);
    expect(tokenize("FuelType")).toEqual(["fueltype", "fuel", "type"]);
  });

  it("splits on anything that is not a letter or digit and keeps repetitions", () => {
    expect(tokenize("Car.refuel().liters")).toEqual(["car", "refuel", "liters"]);
    expect(tokenize("Car--Engine.end1")).toEqual(["car", "engine", "end1", "end", "1"]);
    expect(tokenize("«vehículo de alquiler»")).toEqual(["vehiculo", "de", "alquiler"]);
    expect(tokenize("car Car CAR")).toEqual(["car", "car", "car"]);
  });

  it("folds accents, ñ and ligatures", () => {
    expect(tokenize("año")).toEqual(["ano"]);
    expect(tokenize("Año2024")).toEqual(["ano2024", "ano", "2024"]);
    expect(tokenize("ﬁle")).toEqual(["file"]);
    expect(tokenize("Ñandú")).toEqual(["nandu"]);
  });

  it("gives no terms for blank or punctuation-only text", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("   ")).toEqual([]);
    expect(tokenize("--().«»")).toEqual([]);
  });
});
