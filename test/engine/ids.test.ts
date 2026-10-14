// ID derivation (spec §3.3) and grammar (§3.1).
import { describe, expect, it } from "vitest";
import { deriveId, isValidId, seg, slug, type DeriveInput } from "../../src/engine/index.js";

const none = (): boolean => false;

describe("seg and slug", () => {
  it.each([
    ["year of production", "year_of_production"],
    ["  Car  ", "_Car_"],
    ["Café", "Café"],
    ["a.b(c)", "abc"],
    ["-x", "_-x"],
    ["x--", "x"],
    ["!!!", "_"],
    ["$total", "$total"],
  ])("seg(%j) = %j", (text, expected) => {
    expect(seg(text)).toBe(expected);
  });

  it.each([
    ["Garage", "garage"],
    ["Rent a Car — Overview", "rent-a-car-overview"],
    ["Árbol de Decisión", "arbol-de-decision"],
    ["--x--", "x"],
    ["日本", ""],
  ])("slug(%j) = %j", (text, expected) => {
    expect(slug(text)).toBe(expected);
  });

  it("produces IDs in NFC that satisfy the element grammar", () => {
    expect(isValidId(seg("Café"), false)).toBe(true);
    expect(isValidId("Café", false)).toBe(false);
  });
});

describe("derivation table", () => {
  const cases: [DeriveInput, string][] = [
    [{ type: "model", name: "Garage" }, "garage"],
    [{ type: "diagram", name: "日本" }, "diagram"],
    [{ type: "model", name: "" }, "model"],
    [{ type: "class", name: "Car" }, "Car"],
    [{ type: "interaction", name: "Rent Car" }, "Rent_Car"],
    [{ type: "attribute", owner: "Car", name: "yearOfProduction" }, "Car.yearOfProduction"],
    [{ type: "operation", owner: "Car", name: "start" }, "Car.start()"],
    [{ type: "parameter", operation: "Car.refuel()", name: "liters" }, "Car.refuel().liters"],
    [{ type: "association", end1: "Garage", end2: "Car" }, "Garage--Car"],
    [{ type: "association", name: "employs", end1: "Garage", end2: "Mechanic" }, "employs"],
    [{ type: "association_end", association: "Garage--Car", end: 1 }, "Garage--Car.end1"],
    [{ type: "generalization", specific: "Truck", general: "Car" }, "Truck--extends--Car"],
    [{ type: "realization", client: "Car", supplier: "Drivable" }, "Car--implements--Drivable"],
    [{ type: "dependency", client: "Garage", supplier: "Mechanic" }, "Garage--uses--Mechanic"],
    [{ type: "lifeline", interaction: "RentCar", name: "car" }, "RentCar.car"],
    [{ type: "lifeline", interaction: "RentCar", name: "", representsName: "Car" }, "RentCar.Car"],
    [{ type: "lifeline", interaction: "RentCar", name: " " }, "RentCar.lifeline"],
    [{ type: "message", interaction: "RentCar", name: "start" }, "RentCar.start"],
    [{ type: "message", interaction: "RentCar", name: "" }, "RentCar.msg"],
    [
      { type: "occurrence", interaction: "RentCar", message: "RentCar.start", end: "send" },
      "RentCar.start.send",
    ],
    [{ type: "occurrence", interaction: "RentCar" }, "RentCar.occ"],
    [{ type: "combined_fragment", interaction: "RentCar", operator: "opt" }, "RentCar.opt"],
    [{ type: "operand", fragment: "RentCar.opt", position: 1 }, "RentCar.opt.op1"],
    [{ type: "interaction_use", interaction: "RentCar", used: "Payment" }, "RentCar.ref--Payment"],
  ];

  it.each(cases)("%j → %s", (input, expected) => {
    expect(deriveId(input, none)).toBe(expected);
  });
});

describe("collisions and length", () => {
  it("appends the lowest free suffix to the last segment, before ()", () => {
    const taken = new Set(["Car", "Car-2", "Car.start()"]);
    const exists = (id: string): boolean => taken.has(id);
    expect(deriveId({ type: "class", name: "Car" }, exists)).toBe("Car-3");
    expect(deriveId({ type: "operation", owner: "Car", name: "start" }, exists)).toBe(
      "Car.start-2()",
    );
  });

  it("truncates the last segment of an element ID to 256 code points, keeping the owner and ()", () => {
    const owner = "O".repeat(10);
    const id = deriveId({ type: "operation", owner, name: "é".repeat(300) }, none);
    expect(Array.from(id)).toHaveLength(256);
    expect(id.startsWith(`${owner}.`)).toBe(true);
    expect(id.endsWith("()")).toBe(true);
    expect(isValidId(id, false)).toBe(true);
  });

  it("counts the collision suffix when truncating and trims - left by the cut", () => {
    const base = deriveId({ type: "attribute", owner: "A", name: "x".repeat(300) }, none);
    const second = deriveId(
      { type: "attribute", owner: "A", name: "x".repeat(300) },
      (id) => id === base,
    );
    expect(Array.from(second)).toHaveLength(256);
    expect(second.endsWith("-2")).toBe(true);
    const cut = deriveId({ type: "class", name: `${"a".repeat(255)}-b` }, none);
    expect(cut).toBe("a".repeat(255));
  });

  it("keeps file IDs within 64 characters with the suffix", () => {
    const name = "m".repeat(64);
    const id = deriveId({ type: "model", name }, (x) => x === name);
    expect(id).toBe(`${"m".repeat(62)}-2`);
    expect(isValidId(id, true)).toBe(true);
  });
});

describe("derivation at the length limit (review S5 H6)", () => {
  it("trims characters that cannot end an ID after truncating", () => {
    const end1 = `${"a".repeat(255)}.b`;
    const id = deriveId({ type: "association", end1, end2: "C" }, none);
    expect(isValidId(id, false)).toBe(true);
    expect(id.endsWith(".")).toBe(false);
  });

  it("fails with INVALID_ID when the owner prefix leaves no room", () => {
    expect(() =>
      deriveId({ type: "parameter", operation: `${"o".repeat(254)}()`, name: "p" }, none),
    ).toThrow(/INVALID_ID/);
  });
});
