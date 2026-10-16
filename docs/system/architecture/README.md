# Architecture

Narrative view of the architecture: components, layers, dependencies and deployment. **It does not duplicate
cards**: it describes the structure and links IDs (FEAT, API, INT, DEC).

Status: **base product implemented** (see [../context.md](../context.md)). Single npm package
`ai-submind` (DEC-001, DEC-008): modules in `src/<module>/` (format, engine, query, layout, cli, daemon, mcp, ui),
tests in `test/`, `code_roots: [src/]` in [../schema.yaml](../schema.yaml). Daemon process + MCP proxy
(DEC-005). Module boundaries and the absence of cycles are checked by dependency-cruiser (NFR-008, DEC-009).
Component diagram: not drawn yet.
