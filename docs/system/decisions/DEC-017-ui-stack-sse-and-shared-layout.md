---
id: DEC-017
type: decision
name: "UI stack: plain TypeScript, Vite, SSE and a shared deterministic layout"
status: active
evidence: declared-doc
summary: "The UI is plain TypeScript over @joint/core bundled with Vite; live refresh uses SSE; node sizes come from a pure function of the text and dagre (@dagrejs/dagre) runs in a module shared by the UI and the MCP auto-layout tool."
aliases: [ui framework, sse, vite, dagre, shape size, auto-layout]
tags: [ui, contracts, dependencies]
relations:
  affects: [FEAT-007, API-001, API-002, REQ-028, REQ-029, REQ-030]
  supersedes: []
uncertainties: []
---

# DEC-017 · UI stack, SSE and shared deterministic layout

## Context
- DEC-006 left the UI framework open and chose `@joint/layout-directed-graph` for auto-layout [declared].
- API-002 left SSE vs WebSocket open (REQ-030) [declared].
- DEC-015: the MCP auto-layout tool needs the node sizes of the UI shapes, but it runs in the daemon,
  without a browser to measure text [declared].
- DEC-008 deferred the UI build to S9 and named Vite [declared].
- `@dagrejs/dagre` 3.1.1 is MIT, depends only on `@dagrejs/graphlib` and runs in Node; `@joint/core` 4.3.3 is
  MPL-2.0; `vite` 8.3.4 is MIT [verified: npm view, 2026-10-15].
- The user chose on 2026-10-15: plain TypeScript, SSE, deterministic sizes and Vite [declared].

## Alternatives considered
1. **Framework**: **plain TypeScript** (chosen; the UI outside the canvas is a tree, a detail panel and a
   findings panel); Preact; Lit.
2. **Live refresh**: **SSE** (chosen; one-way is enough because the UI only writes layout through `PUT /api/layout`, and the
   session cookie travels with `EventSource`); WebSocket (needs a hand-made upgrade or the `ws` dependency).
3. **Node sizes without a browser**: **pure function of the text with fixed font metrics, shared by UI and
   daemon** (chosen); a tool that only clears layout entries (the agent cannot fix a reproducible layout);
   sizes measured and stored by the UI (results depend on whether the UI opened the diagram).
4. **Bundler**: esbuild (one dependency, no dev server); **Vite** (chosen, as DEC-008 anticipated).

## Decision
- The UI is plain TypeScript and DOM APIs over `@joint/core`, with own UML shapes (DEC-006), bundled by Vite
  into `dist/ui/` and served by the daemon behind the same token, Host and Origin checks (DEC-014).
- Live refresh: `text/event-stream` endpoint fed by the engine `change` events.
- Shape sizes are computed by a pure function of the displayed text with fixed metrics of the UI font; the UI
  renders with that size instead of measuring the DOM.
- Auto-layout is a pure module over `@dagrejs/dagre` used by the UI (diagrams or nodes without layout) and by
  the MCP auto-layout tool (which persists the result). This replaces `@joint/layout-directed-graph` from
  DEC-006; the rest of DEC-006 stands.

## Consequences
- Positive: the same layout in the UI and from MCP; no DOM in the daemon; no UI framework to maintain.
- Negative / costs: text whose glyphs exceed the fixed metrics may overflow its box (mitigated by the chosen
  font and margins); Vite adds build-time dependencies.

## Affected elements
FEAT-007, API-001 (auto-layout tool), API-002, REQ-028..030; DEC-006 (auto-layout library), DEC-008 (UI build).

## Verification
PLAN-002 S9 tests: same size and layout from the UI module and the MCP tool; SSE event after an engine change.
