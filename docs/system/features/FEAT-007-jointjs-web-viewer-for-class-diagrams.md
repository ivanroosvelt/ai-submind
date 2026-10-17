---
id: FEAT-007
type: feature
name: "JointJS web viewer for class diagrams"
status: active
evidence: verified-code
summary: "Local UI with @joint/core to explore class diagrams and adjust and persist their layout."
aliases: ["ui", "viewer", "jointjs"]
tags: [ui]
implementation: implemented
code:
  - src/ui/main.ts
  - src/ui/shapes.ts
  - src/layout/size.ts#nodeBox
  - src/layout/class-layout.ts#autoLayout
  - src/daemon/ui-api.ts#uiRoutes
  - src/query/query.ts#Query
test_code:
  - test/layout/layout.test.ts
  - test/daemon/ui-api.test.ts
  - test/query/query.test.ts
relations:
  entities: [ENT-004, ENT-005]
  functions: []
  interfaces: [API-002]
  integrations: []
  depends_on: [FEAT-001, FEAT-002]
  decisions: [DEC-006, DEC-017]
uncertainties:
  - "Rendering, interaction and live refresh are not covered by automated tests (no browser in the suite); verified by hand in a browser (PLAN-002 S9); drill-down and ↗ markers checked by the user on 2026-10-17 (PLAN-005 S6)."
---

# FEAT-007 · JointJS web viewer for class diagrams

## Description
UI with `@joint/core` and own UML shapes, dagre auto-layout, zoom/pan, selection, detail, navigation, live refresh; it only writes layout (DEC-006). PLAN-002 S9.

Implementation (DEC-017): plain TypeScript in `src/ui/` bundled by Vite into `dist/ui/` and served by the daemon
(API-002). Shapes: class, interface, data type, enumeration, primitive type, package (folder; members are not
nested) and actor; links: association (aggregation/composition diamonds, direction arrow, name, roles and
multiplicities), generalization, realization and dependency. Node text and size come from `src/layout/size.ts`
(fixed monospace metrics), never from DOM measurement; an explicit `width`/`height` in the layout is a minimum
(`boxSize`, spec §8); nodes without a layout entry are placed by the shared
dagre module below the placed ones. Dragging a node or editing link vertices (vertex tool on the selected
link) saves the whole on-screen layout after 400 ms through `PUT /api/layout`; a 409 shows a notice and
reloads (REQ-029). The «Auto-layout» button recomputes the whole layout with the shared module (the same result
as the MCP tool `auto_layout_diagram`) and saves it through the same `PUT` (REQ-032). SSE events refresh the tree, the findings panel and the open diagram, except the page's own
writes (REQ-030). The detail panel shows every property, `null` as “unknown”, references as links to shown
elements and the relations that reach the element (`GET /api/relations`), navigable when their source is shown
(REQ-031). Drill-down (REQ-042): a node with a target in the view's `targets` (API-002; a classifier whose
operation has `behavior`, or that or one of its attributes/operations has `links`) shows a ↗ above its top-right
corner (tooltip), and a relation link with a target a ↗ after its name at the midpoint; double click opens the
first target (an element through `reveal`, a diagram directly, a model's first diagram, or a notice if it has none)
and the detail lists every target under «Navigates to» (with nothing selected, the open diagram's own links).
Saves run one after another; an event stream refused with 401 (daemon restarted) shows “Session
expired” and stops retrying. Sequence diagrams: FEAT-009.

## Behavior
REQ-028..033, REQ-042.

## States and transitions
No UI states of its own beyond selection and view.

## Dependencies
FEAT-001 (the daemon serves the UI), FEAT-002.

## Risks
Own effort on shapes and tools (without JointJS+).

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
