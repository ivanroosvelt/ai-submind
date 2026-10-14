# Product structural model

Textual, atomic and verifiable representation of **what submind is**: actors, requirements,
features, domain, interfaces, integrations, decisions and tests.

- **Current state** here; **history** in Git (`git log -- docs/system/`).
- **Code** is the authority on implemented behavior; each card declares which source is
  authoritative in its `evidence` field.
- Conventions (IDs, names, front matter, relations, search): [conventions.md](conventions.md).
- Schema of types and relations: [schema.yaml](schema.yaml).

## Where to start

1. [context.md](context.md) — what is and is not known about the product.
2. [inventory/INDEX.md](inventory/INDEX.md) — all elements and relations (generated).
3. [traceability/MATRIX.md](traceability/MATRIX.md) — REQ → FEAT → elements → validations → tests → decisions (generated).
4. [glossary.md](glossary.md) — domain terms → IDs.

## Directories

| Prefix | Type | Directory |
|--------|------|-----------|
| ACT | actor | [actors/](actors/) |
| REQ | requirement | [requirements/](requirements/) |
| NFR | quality attribute / non-functional requirement | [quality/](quality/) |
| FEAT | feature | [features/](features/) |
| ENT | domain entity | [domain/entities/](domain/entities/) |
| FUN | function / behavior | [domain/functions/](domain/functions/) |
| VAL | validation / rule | [domain/validations/](domain/validations/) |
| API | interface contract | [interfaces/](interfaces/) |
| INT | integration | [integrations/](integrations/) |
| DEC | product decision | [decisions/](decisions/) |
| TST | test or test suite | [quality/tests/](quality/tests/) |

Architecture view (narrative, links IDs): [architecture/](architecture/).

## Queries

```sh
scripts/sysq find <term>      # by name, alias, tag, path or symbol
scripts/sysq show <ID>        # card + incoming/outgoing relations + history + mentions
scripts/sysq impact <ID>      # what would break if it changed
scripts/sysq claim <PREFIX>   # reserve the next ID
```
