# Structural model conventions

## Identifiers

- Format `PREFIX-NNN` (three or more digits): `REQ-001`, `FEAT-012`. Prefixes in `schema.yaml`.
- Unique, permanent, independent of name, location or order. Never reused.
- Every assigned ID appears in the append-only ledger `inventory/id-ledger.txt`
  (environment: `.ai/registry/id-ledger.txt`). Always reserve with `scripts/sysq claim <PREFIX>`.

## Files

- One card per element: `<type directory>/<ID>-<slug>.md`; `slug` in kebab-case, without accents.
- Renaming the slug is allowed (the ID does not change); changing type is not: retire it and create another.
- The `README.md` and `INDEX.md` of each directory are not cards.

## Front matter

YAML subset (validated by `scripts/smtools/miniyaml.py` without dependencies):
block maps and lists, inline lists `[A, B]`, scalars, empty `{}`, `#` comments.
Not supported: `|`, `>`, anchors, or unquoted strings containing `: ` (use quotes).
Dates (`2026-10-14`) are read as ISO text, not as date objects. Inside inline lists,
items with an apostrophe must be double-quoted (`["l'x", b]`).

Common fields (required in bold):

| Field | Values |
|-------|--------|
| **id** | `PREFIX-NNN` |
| **type** | the one in `schema.yaml` for the prefix |
| **name** | canonical name (domain term) |
| **status** | `proposed` · `active` · `deprecated` · `retired` |
| **evidence** | `verified-code` · `declared-doc` · `inferred` · `unknown` |
| summary | one line |
| aliases | synonyms and alternative terms (for `sysq find`) |
| tags | free labels in kebab-case |
| implementation | implementable types only: `none` · `partial` · `implemented` · `verified` |
| code | implementation paths: `path` or `path#symbol` (must exist) |
| test_code | test paths: `path` or `path#symbol` (must exist) |
| relations | map `key: [IDs]` with the keys allowed for the type |
| uncertainties | list of open questions |
| commits | real relevant hashes (never invented) |

Checked rules: `implemented`/`verified` require `code`; `verified` requires reachable tests
(a TST or `test_code`, own or from the elements it relates to); `evidence: verified-code` requires `code` or `test_code`.

## Relations

- Declared **only at the source**, with the canonical direction from `schema.yaml`
  (e.g. `REQ.features → FEAT`, never `FEAT.requirements`). Inverses are computed.
- Relation inventory: one line `SOURCE key TARGET` in `inventory/INDEX.md`,
  searchable with `grep "FEAT-001" docs/system/inventory/INDEX.md`.

## Domain terms and code symbols

- The canonical term is the `name`; synonyms in `aliases`; the glossary maps term → ID.
- Code symbols are linked from the card (`code: [src/x.ts#createUser]`).
  Optionally, code can cite the ID in a comment (`// FUN-004`) for reverse search;
  `scripts/sysq show <ID>` lists those mentions.

## Search (complete with respect to the inventory)

| Question | Command |
|----------|---------|
| Is there something called X? | `scripts/sysq find X` |
| Definition, relations, code, tests, history and mentions of an ID | `scripts/sysq show ID` |
| What breaks if I change ID? | `scripts/sysq impact ID` |
| Everything of a type | `scripts/sysq list PREFIX` |
| Free text | `rg -n "term" docs/system` |

## Current state vs. history

The card describes the present. Do not add history sections: use `git log -p -- <card>`.
Decisions that change behavior are recorded as DEC and linked through `relations`.
