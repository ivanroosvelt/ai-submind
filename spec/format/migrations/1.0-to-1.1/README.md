# Migration guide · format 1.0 → 1.1

For AI agents and people. Normative rules: spec [§11.1](../../README.md#111-version-11-and-migrate-10--11);
decision: DEC-020 (guides: DEC-010).

## 1. Summary

1.1 is a **minor** version: it only adds optional keys. Nothing is renamed, removed or made required.

| Added in 1.1 | Where | Spec |
|--------------|-------|------|
| `behavior` (ref to an interaction) | operations | §6.4 |
| `links` (set of refs to any element, model or diagram) | every element with an `id`, the model, the diagrams | §7.1 |
| rule `LINK_SELF` | phase 4 | §10.3 |

Document kinds affected: manifest (`ai-submind.json`), models (`models/*.json`) and layouts (`layout/*.json`):
only their `format_version` changes.

Worked corpus: [`examples/before/knowledge/`](examples/before/knowledge/) (valid 1.0) and
[`examples/after/knowledge/`](examples/after/knowledge/) (valid, canonical 1.1); `npm test` checks that `migrate` turns
one into the other byte for byte.

## 2. Steps

Preferred: run the explicit operation, which does all of this in one batch (validated as a whole, written
sequentially; re-running it is idempotent):

- MCP: the `migrate` tool (with `dryRun` first); CLI: `ai-submind migrate` (`--dry-run` first).

By hand (only when the tool is not available), for **every** document of `knowledge/` whose `format_version` is
`"1.0"`:

1. Where `"format_version": "1.0"` → write `"format_version": "1.1"`. Nothing else changes.

Before (`knowledge/models/garage.json`, excerpt):

```json
{
  "format_version": "1.0",
  "id": "garage",
  "name": "Garage",
  ...
}
```

After:

```json
{
  "format_version": "1.1",
  "id": "garage",
  "name": "Garage",
  ...
}
```

The same applies to `knowledge/ai-submind.json` and to each `knowledge/layout/<diagram-id>.json`.

Only **after** the migration may the new keys be used (they are rejected on a 1.0 document with
`MIGRATION_REQUIRED`). Example in the garage model of the spec examples (excerpts): the operation `Garage.rent()`
is described by the interaction `RentCar`, and the lifeline `RentCar.car` drills down to the diagram `check-fuel`:

```json
{
  "id": "Garage.rent()",
  "name": "rent",
  "visibility": "public",
  "behavior": {"idref": "RentCar"},
  ...
}
```

```json
{
  "id": "RentCar.car",
  "name": "",
  "represents": {"idref": "Car"},
  "links": [
    {"idref": "check-fuel"}
  ]
}
```

## 3. Derived values

None: 1.1 adds no required field. Do not add `behavior` or `links` as part of the migration; they are modelling
decisions, not migration steps.

## 4. Invariants

- IDs, references, element order and every other key stay unchanged.
- No data is dropped.
- The result is in canonical form (spec §9); with the engine this is automatic.
- Documents with another version (e.g. a later one) are not touched.
- If a 1.0 document cannot be loaded (invalid JSON, conflict markers, schema violation), stop: fix or restore it
  first (the operation reports `MIGRATE_BLOCKED`).

## 5. Checklist

- [ ] No document of `knowledge/` declares `"format_version": "1.0"` any more.
- [ ] Validation reports zero errors and no `FORMAT_VERSION_OUTDATED`.
- [ ] The Git diff only changes `format_version` lines.
