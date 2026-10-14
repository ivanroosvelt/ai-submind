---
id: VAL-006
type: validation
name: "File integrity"
status: active
evidence: verified-code
summary: "Parseable JSON, UTF-8, no Git conflict markers and path inside knowledge/."
aliases: ["merge conflict", "invalid json"]
tags: [validation]
implementation: verified
code:
  - src/format/document.ts#parseDocument
  - src/format/knowledge.ts#readKnowledgeDir
  - src/format/knowledge.ts#resolveKnowledgePath
test_code:
  - test/format/corpus.test.ts
  - test/format/rules.test.ts
relations:
  tests: []
  decisions: []
uncertainties: []
---

# VAL-006 · File integrity

## Rule
Before validating the schema: UTF-8 file, parseable JSON, no `<<<<<<<`/`=======`/`>>>>>>>` markers, path confined to `knowledge/`.

## Applies to
Every file in `knowledge/` except `.ai-submind/`.

## Message / error code
Error; document state `invalid_parse` or `conflicted`, with line/column.

## Examples

| Input | Result |
|-------|--------|
| File with conflict markers | conflicted, writes blocked |
| Truncated JSON | invalid_parse |

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007. Exact grammar and codes: format spec (API-004, §10).
