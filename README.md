# ai-submind

`ai-submind` is a local manager for knowledge diagrams (class and sequence diagrams in the first scope). The
knowledge lives in `knowledge/` inside your project and is versioned with Git as the single source of truth. AI
agents query and change it through MCP; people explore it in a web UI. Full context in
[docs/system/context.md](docs/system/context.md).

## Status

Base product complete ([PLAN-002](docs/plans/archive/PLAN-002-gestor-diagramas-base.md), closed 2026-10-16):

- Implemented: knowledge format 1.0 and its validation ([spec/format/](spec/format/README.md)), embedded
  engine, structured queries and lexical search, CLI with a per-project daemon, MCP server, web UI (JointJS) for
  class and sequence diagrams, and Git integrity (diagnosis after a merge, no automatic repair:
  [FEAT-008](docs/system/features/FEAT-008-git-integrity.md)).
- Knowledge format 1.1 ([PLAN-005](docs/plans/archive/PLAN-005-flujos-de-flujos.md)): an operation's
  `behavior` points to the interaction that describes it, and a `links` extension on any element, model or diagram
  links it to the flow behind it ([DEC-020](docs/system/decisions/DEC-020-cross-diagram-behavior-links-and-format-1-1.md)).
  Format 1.0 documents still load (warning `FORMAT_VERSION_OUTDATED`) and are upgraded only explicitly with
  `migrate` ([guide](spec/format/migrations/1.0-to-1.1/README.md)).
- Published on npm: [`ai-submind`](https://www.npmjs.com/package/ai-submind) (0.1.1, 2026-10-16).

## Requirements

- Node.js ≥ 22 and npm (development uses `^22.13.0 || ^24.0.0 || >=26.0.0`, see `devEngines`).
- Git (the project root is the Git root of the current directory).
- Python ≥ 3.10 only for the development scripts (`scripts/`).

## Install from the repository

```sh
npm ci
npm run build    # empties dist/ and runs tsc + vite build: binary dist/cli/main.js and the UI in dist/ui/
```

## Quick start

```sh
cd your-project                          # a Git repository
npx ai-submind init                      # creates knowledge/ai-submind.json
npx ai-submind                           # same as serve: prints the UI URL with its token
```

Or install it as a dev dependency (`npm install -D ai-submind`) so that `npx ai-submind` uses a pinned version.

To try a local build instead: `npm pack` in this repository and `npm install /path/to/ai-submind-<version>.tgz`
in the host project. The package contains `dist/` (without `*.map` source maps), `spec/format/README.md`, `spec/format/schema/`,
`spec/format/migrations/`, `LICENSE`, `NOTICE` and `CHANGELOG.md`.

## CLI

```sh
npx ai-submind <command> [options]   # or, from this repository: node dist/cli/main.js <command>
```

| Command | What it does | Options |
|---------|--------------|---------|
| `serve` (default) | Starts the project daemon (HTTP on 127.0.0.1:7777 or a free port, with a token) | `--knowledge <dir>`, `--port <n>`, `--idle <minutes>` |
| `status` | Shows the daemon status | `--knowledge <dir>` |
| `stop` | Stops the daemon | `--knowledge <dir>` |
| `init` | Creates `knowledge/` with its `ai-submind.json` manifest | `--knowledge <dir>` |
| `validate` | Validates `knowledge/`, including merge conflicts, duplicate IDs and broken references (exit code 1 on errors) | `--knowledge <dir>` |
| `migrate` | Upgrades every format 1.0 document of `knowledge/` to the current format (only `format_version` changes) | `--knowledge <dir>`, `--dry-run` |
| `mcp` | Stdio MCP server for agents, connected to the daemon (starts it if needed) | `--knowledge <dir>` |

`--knowledge` is relative to the current directory and must stay inside the project root; it defaults to
`<root>/knowledge`. Help: `npx ai-submind --help`. Contract: [API-003](docs/system/interfaces/API-003-ai-submind-cli.md).

## Web UI

`serve` prints the daemon URL with its token (`http://127.0.0.1:<port>/?token=…`); open it in a browser to load
the UI: tree of models and diagrams, class diagrams (zoom, fit to screen, selection with details, validation
findings and live refresh). The UI only writes the layout (node positions and link vertices): when you drop a
node or move a vertex, and with the «Auto-layout» button, which recomputes the whole diagram like the MCP tool
`auto_layout_diagram` (useful to fix inherited overlaps). An explicit `width`/`height` in the layout is a
minimum size: content is never clipped.

Sequence diagrams show lifelines, executions, messages (synchronous, asynchronous, reply, create, delete,
lost/found), combined fragments with operands and guards, and interaction uses («ref»). Lifelines are dragged
horizontally only (their order is their x) and their length changes with the handle at the bottom;
«Auto-layout» works here too. References in the details panel open a diagram that shows the target, and
double-clicking an interaction use opens the diagram of the used interaction.

Elements with a drill-down target (the flow behind an operation or a message, an
interaction use, or `links`) are marked ↗: double-clicking one opens its first target (a diagram that shows the
target element, the target diagram, or a model's first diagram), and the details panel lists every target under
«Navigates to».

The UI build writes `dist/ui/THIRD-PARTY-LICENSES.md` with the licenses of the bundled third-party code
(`@joint/core`, MPL-2.0; `@dagrejs/dagre`, MIT); `dist/ui/index.html` says where to get the source form of
`@joint/core` (https://github.com/clientIO/joint and the npm package `@joint/core`).

UI HTTP API in [API-002](docs/system/interfaces/API-002-ui-http-api.md); decisions in
[DEC-017](docs/system/decisions/DEC-017-ui-stack-sse-and-shared-layout.md) and
[DEC-018](docs/system/decisions/DEC-018-sequence-executions-and-layout.md).

## MCP server

Configuration for a stdio MCP client (`.mcp.json` in the host project, with the package installed; the client
must start it with a working directory inside the project). The server connects to the daemon and starts it if
it is not running:

```json
{
  "mcpServers": {
    "ai-submind": {
      "command": "npx",
      "args": ["ai-submind", "mcp"]
    }
  }
}
```

Without installing the package, use `"command": "node"` with `"args": ["/path/to/ai-submind/dist/cli/main.js", "mcp"]`.

Tools: `list_models`, `list_diagrams`, `get_element`, `find_elements`, `search`, `relations`, `impact`,
`paths`, `validate` (read; `relations` has a `links` group); `create_element`, `update_element`, `delete_element`, `edit_diagram`,
`apply_batch`, `rename`, `auto_layout_diagram`, `migrate` (write, all with `dryRun`; the first write initializes
`knowledge/` if it does not exist). Resources `ai-submind://schema/{name}`, `ai-submind://model/{id}` and
`ai-submind://diagram/{id}`. Prompt `guide`: teaches an agent the workflow and every tool and resource (in
Claude Code, `/mcp__ai-submind__guide`). Inputs, outputs and errors in
[API-001](docs/system/interfaces/API-001-ai-submind-mcp-server.md).

## Development

The repository includes an AI-assisted development environment (its process documentation is in Spanish):

- [AGENTS.md](AGENTS.md) — canonical instructions for any agent (Claude Code, Copilot, …).
- [docs/system/](docs/system/README.md) — structural model of the product (IDs, relations, traceability).
- [.ai/](.ai/README.md) — registry of agents and skills, policies and environment decisions.

```sh
npm ci
npm run check                 # types, lint, format, dependencies and tests (Vitest), including the
                              # license audit and the e2e from the tarball (test/package/, test/e2e/)
scripts/check                 # every check, including npm run check (also in CI)
scripts/sysq find <term>      # search the model
scripts/regen                 # regenerate indexes and adapters
```

## Releasing

1. Update `version` in `package.json` (`npm version <x.y.z> --no-git-tag-version`) and `CHANGELOG.md`; commit to `master`.
2. Push a tag `v<x.y.z>` from `master` (only maintainers can create `v*` tags).
3. The `release` workflow runs in the `npm` environment (no manual approval: pushing the tag is the approval),
   checks that the tag matches the version and is on `master`, runs build + checks, and publishes with provenance through npm trusted publishing. A
   prerelease (`v1.0.0-rc.1`) is published under the `next` dist-tag.

## License

Apache-2.0 ([LICENSE](LICENSE), [NOTICE](NOTICE)); decision in
[DEC-019](docs/system/decisions/DEC-019-apache-2-license.md).
