---
id: FEAT-009
type: feature
name: "Sequence diagram viewer"
status: active
evidence: verified-code
summary: "Rendering and layout adjustment of sequence diagrams in the UI, with a pure geometry module shared with the MCP auto-layout tool (DEC-018)."
aliases: ["sequence", "sequence diagram", "lifeline", "activation", "execution specification"]
tags: [ui]
implementation: implemented
code:
  - src/layout/sequence-layout.ts#sequenceGeometry
  - src/layout/sequence-layout.ts#autoLayoutSequence
  - src/ui/main.ts
  - src/ui/shapes.ts
  - src/mcp/tools.ts#createMcpServer
test_code:
  - test/layout/sequence-layout.test.ts
  - test/daemon/ui-api.test.ts
  - test/mcp/tools.test.ts
relations:
  entities: [ENT-004, ENT-005]
  functions: []
  interfaces: [API-002]
  integrations: []
  depends_on: [FEAT-007, FEAT-008]
  decisions: [DEC-006, DEC-017, DEC-018]
uncertainties:
  - "Rendering, dragging and navigation are not covered by automated tests (no browser in the suite); checked in the browser by the user on 2026-10-15 (rent-car, check-fuel; PLAN-002 S11)."
---

# FEAT-009 · Sequence diagram viewer

## Description
Own shapes for lifeline, activation, messages, combined fragments and interaction use; own sequence layout; class ↔ lifeline navigation (DEC-006). PLAN-002 S11.

Implementation (DEC-018): `src/layout/sequence-layout.ts` is pure (no DOM, no Node built-ins) and computes the
whole geometry from the diagram view (`Query.diagram`) and its layout: lifeline headers `name : Classifier` sized
with the metrics of `src/layout/size.ts`; one row per event in temporal order (the fragments flattened depth
first), a receive right after the send of the same message on another lifeline sharing its row, a self-message
looping over two rows; messages by sort (synchronous: filled head; asynchronous: open head; reply and create:
dashed; create ends at the header of the created lifeline, which starts at that row; delete ends the lifeline with
an X); lost/found with a filled circle; executions as boxes from their start row to their finish row, nested ones
shifted; combined fragments over their covered lifelines with operator tab, guards and dashed operand separators,
nested ones indented; interaction use as an opaque `ref` box with the used interaction's name. Lifeline x comes
from the layout (default: array order packed by widths and neighbouring message labels); `height` is a minimum
length and never clips events. `autoLayoutSequence` packs lifelines in their current x order (keeps styles and
explicit sizes, drops orphan entries, message entries keep only `style`); with `keep` (manual adjustment) every
existing entry is kept as is, orphans and their `y` included (spec §8), and only lifelines without an entry get one.
Executions nest when one starts while another of its lifeline runs or lies within it; one starting at another's
finish is chained, not nested.
The UI draws that geometry: lifelines move only horizontally and their end handle only vertically; on drop the
layout is saved through `PUT /api/layout` (save queue), changing only that lifeline's entry, and redrawn; the
length is measured from the drawn header top; the Auto-layout button and the MCP tool
`auto_layout_diagram` use the same module. Navigation: references in the detail select the target or, if it has
no cell, the closest element that has one (the message of an occurrence, then its owners up the chain: operand →
fragment, → interaction), on the current canvas first, otherwise in the first diagram that shows one of them (lifeline → represented class; class “Referenced by” → lifeline in its
sequence diagram; interaction use → used interaction, also by double click). Simplifications marked `ponytail:`
in the code: only labels of messages between neighbouring lifelines make room; a destroyed lifeline ignores
`height`; messages follow a dragged lifeline on drop, not while dragging.

## Behavior
REQ-040.

## States and transitions
No states of its own.

## Dependencies
FEAT-007, FEAT-008.

## Risks
Complexity of nested fragments; long labels of messages that span several lifelines may overlap them.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
