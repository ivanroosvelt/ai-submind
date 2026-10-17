// Usage guide served as the MCP prompt `guide` (API-001): hand-written workflow below, followed by a
// reference generated from the registered tools and resources, so descriptions never drift. A test fails
// when a tool or resource is registered without being mentioned here.
import { SUPPORTED_VERSION } from "../format/schema.js";

export const GUIDE = `# Using the ai-submind MCP server

ai-submind keeps a project's UML-like knowledge (models, elements, class and sequence diagrams) as JSON
files in \`knowledge/\` (format ${SUPPORTED_VERSION}). These tools are the only way to change it: never edit
those files directly.

## Orient first
1. \`list_models\` and \`list_diagrams\` show what exists, with counts, validity and layout status.
2. \`search\` (ranked, lexical) when you know words; \`find_elements\` (exact filters: type, model, package,
   diagram, owner, interaction, name, tags, stereotypes, code refs, documentation, visibility) when you
   know properties. Both are paginated (\`offset\`, \`limit\`).
3. \`get_element\` for the full content, owner, file and children of one ID.
4. Resources: \`ai-submind://model/{id}\` (a whole model document), \`ai-submind://diagram/{id}\`
   (diagram plus layout) and \`ai-submind://schema/{name}\` (JSON Schemas: the exact shape of every
   element; read \`model\` before writing an unfamiliar element type).

## Understand relationships
- \`relations\`: edges leaving or reaching an ID, filtered by \`direction\`, \`kinds\`, \`keys\` or \`groups\`
  (e.g. \`association\`, \`generalization\`, \`sequence\`, \`links\`).
- \`impact\`: what depends on an element (or what it depends on), transitively, with the files involved.
  Run it before deleting or reshaping anything.
- \`paths\`: how two elements are connected.

## Change knowledge
- \`create_element\`: a model (\`type: "model"\`, no \`parent\`), a diagram under its model, or any element
  under its container. Omit \`id\` and it is derived from the name (also for inline children); give
  explicit IDs to sequence occurrences. The first write initializes \`knowledge/\`.
- \`update_element\`: RFC 7396 merge patch (\`null\` removes a field, arrays are replaced whole). IDs never
  change here.
- \`rename\`: changes an ID and rewrites every reference, layout key and file name.
- \`delete_element\`: fails with REFERENCED while something points at it; \`cascade: true\` also removes
  references and deletes elements that cannot exist without it, and \`affected\` lists every side effect.
- \`edit_diagram\`: adds or removes the elements a diagram shows.
- \`apply_batch\`: several create/update/delete/edit_diagram operations, all or nothing. Prefer it for any
  multi-step change (e.g. a class, its association and the diagram that shows them).
- \`auto_layout_diagram\`: after changing what a diagram shows, recompute its layout. Never write
  coordinates yourself.
- \`migrate\`: upgrades format 1.0 documents; needed before using \`behavior\` or \`links\` on them.

Every write accepts \`dryRun: true\` (validate and return the result and diff without writing): use it
first for deletes, cascades, renames and large batches. On create, update, delete and edit_diagram (also
inside each \`apply_batch\` operation), pass \`expectedRevision\` (from a previous result's \`revisions\`) to
fail with REVISION_CONFLICT instead of overwriting a concurrent change.

## Flows of flows
An operation's \`behavior: {idref}\` names the interaction (sequence flow) that describes it;
\`links: [{idref}]\` on any element, model or diagram drills down to another one. Set them through
\`data\`/\`patch\`; read them with \`relations\` (group \`sequence\` or \`links\`).

## Check
\`validate\` reloads \`knowledge/\` from disk and lists every finding; run it after changes and fix errors.
Errors come back as \`isError\` results with \`{error: {code, message, details}}\`: read \`code\` and
\`details\` before retrying.
`;
