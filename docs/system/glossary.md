# Glossary

Domain term → short definition → canonical ID. The full definition lives in the card;
here it is only linked. Keep in alphabetical order.

| Term | Short definition | ID |
|------|------------------|----|
| ai-submind (command) | CLI `npx ai-submind` with `serve`, `mcp`, `init`, `status`, `stop` | API-003 |
| ai-submind.json | Manifest of `knowledge/` with format version | ENT-001 |
| Canonical serialization | Deterministic writing for minimal diffs | REQ-005 |
| Daemon | Single process per project that serves UI and MCP | REQ-037 |
| Diagram | View of a model (`kind` class or sequence) made of references | ENT-004 |
| File ID / element ID | ID grammars for models and diagrams / other elements, in a global namespace | API-004 |
| Format 1.0 (spec) | Contract of the `knowledge/` files in `spec/format/` | API-004 |
| Format extensions | `stereotypes`, `tags`, `documentation`, `code_refs`, `external_id` | API-004 |
| idref | Reference to an element by its `id` | VAL-003 |
| Knowledge engine | Own portable equivalent of TerminusDB | FEAT-002 |
| Knowledge format | Own format derived from UMJ with JSON Schema | FEAT-003 |
| Layout | Positions and vertices of a diagram, separate file | ENT-005 |
| Lexical search | Free-text search with lexical ranking | REQ-038 |
| MCP server | MCP tools for querying and management | API-001 |
| Model | Tree of elements, relations and diagrams in one file | ENT-002 |
| Model element | UML element with a readable `id` inside a model | ENT-003 |
| Rename | Change of `id` with reference rewriting | REQ-039 |
| Semantic search | Similarity search with embeddings (later) | FEAT-005 |
| stdio MCP proxy | `ai-submind mcp`: forwards stdio to the daemon | REQ-003 |
| UI HTTP API | Read and layout-only write for the UI | API-002 |
| UMJ | Reference UML interchange JSON format (ENASE 2026 paper) | DEC-002 |
| Web viewer | JointJS UI to explore and adjust layout | FEAT-007 |

Orchestration environment terms (not product terms):

| Term | Meaning |
|------|---------|
| Capability (CAP) | Ability the environment needs, provided by agents/skills |
| Card | Canonical file of a model element, with front matter and ID |
| EDR | AI environment decision record |
| G0–G3 | Impact levels of environment changes (`.ai/policies/governance.md`) |
| Ledger | Append-only record of assigned IDs |
| T0/T1/T2 | Task classes by risk (`AGENTS.md` §4) |
