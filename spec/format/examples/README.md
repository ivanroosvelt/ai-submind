# Format 1.0 examples

Test corpus for the validator and the serializer (PLAN-002 S4), run by
`test/format/corpus.test.ts` as part of `npm test`. All valid `.json` files
are in canonical form (§9 of the spec), except `canonical/input/`.

| Directory | Contents | Expected result |
|-----------|----------|-----------------|
| `valid/garage/knowledge/` | complete `knowledge/`: manifest, two models (`garage` uses primitive types from the `types` model by global ID), three diagrams and two layouts. Includes: package, actor, class, interface, data type, enumeration, primitive type, attribute (with all six flags), operation, parameter (`in`, `out`, `inout`), association (all three variants, directed and undirected), generalization, dependency, realization, interaction, lifeline (also with an empty name), messages of all six `sort` and all four `kind` values (including a synchronous call without reply), occurrence specification, execution specifications (nested, one ending at a call without reply), nested combined fragment with several operands, interaction use, class and sequence diagrams, layout with full `style` and vertices, and all five extensions (§7). It does not include every value of `operator` or `visibility`. | no errors or warnings; reading and rewriting produces no differences |
| `invalid/<case>/knowledge/` | a minimal `knowledge/` with a single defect | exactly the set of codes in `invalid/<case>/expected.json` (errors and warnings; repetitions not counted) |
| `canonical/input/` → `canonical/expected/` | valid document with unordered keys, `null`, empty collections and unsorted sets | rewriting `input` produces `expected` byte for byte |

Whether `code_refs` paths exist (`CODE_REF_MISSING`) depends on the host repository: the corpus
is evaluated without that check (the example paths do not exist in this repository).

`expected.json`: `{"description": "...", "codes": ["CODE", ...]}`: a **set** of codes from §10.4, without repetitions and
sorted. `PATH_OUTSIDE_KNOWLEDGE` has no static case (it requires a symbolic link or a path requested through the API): it is tested with
fixtures generated in `test/format/rules.test.ts`. Neither does `CODE_REF_MISSING` (see above).

The `garage` model re-expresses, in its own words and structure, the *Car* example of the UMJ paper (§1 of the
spec) and extends it; it does not copy its listing.
