// Nombre publicado en npm: "tejo" sin scope lo rechaza el registro (#67).
export const PKG = "@ivanroosveltlt/tejo";

export const BLOCK_START = "<!-- tejo:start -->";
export const BLOCK_END = "<!-- tejo:end -->";

// El texto de las skills no se copia: lo imprime `tejo guide` de la última versión (#68).

// Lo que `init` registra en `.mcp.json`: cada sesión arranca la última versión (#68).
export const PKG_LATEST = `${PKG}@latest`;

/** `.claude/skills/tejo/SKILL.md`: mínima; las instrucciones vigentes salen de `tejo guide notes` (#68). */
export function skill(folder: string): string {
  return `---
name: tejo
description: Project knowledge base in ${folder}/ (.md notes and .flo diagrams). Use it before deciding or answering anything about the project, and to record decisions, incidents, rules or what you learned.
---

# tejo

The project's knowledge base lives in \`${folder}/\`. The \`tejo\` MCP server (registered in \`.mcp.json\`) exposes it with query, get_node, list_tags, check and write_node.

Before reading or writing notes, get the current instructions and follow them:

\`\`\`bash
npx -y ${PKG_LATEST} guide notes ${folder}
\`\`\`

## Without the MCP server

- Read and edit the .md files in \`${folder}/\` directly, with the same format.
- After editing, run \`npx ${PKG} check ${folder}\`: it exits with 1 and lists the errors if there are any.
- \`npx ${PKG} view ${folder}\` opens the viewer so the user can see the graph and the diagrams.
`;
}

/** `.claude/skills/tejo-map/SKILL.md`: mínima; el texto vigente sale de `tejo guide map` (#68). */
export function mapSkill(folder: string): string {
  return `---
name: tejo-map
description: Map this project into its knowledge base in ${folder}/ (notes, relations and .flo flows) with a resumable plan. Use it when asked to map, document or onboard the project into tejo, or to resume an unfinished map.
---

# tejo-map

Get the current mapping instructions and follow them. If the request names a path (\`/tejo-map packages/core\`), add \`--scope <path>\`; otherwise map the whole project.

\`\`\`bash
npx -y ${PKG_LATEST} guide map ${folder}
\`\`\`

Without the MCP server, edit the files under \`${folder}/\` directly and run \`npx ${PKG} check ${folder}\` after each write.
`;
}

/** El bloque de `AGENTS.md`, con sus marcadores. */
export function agentsBlock(folder: string): string {
  return `${BLOCK_START}
## Knowledge base (tejo)

The project's knowledge (decisions, rules, incidents, diagrams) lives in \`${folder}/\`. Check it before deciding and record what's new: use the \`tejo\` MCP server or the \`tejo\` skill. To map the whole project into it (resumable plan in \`${folder}/map-plan.md\`), use the MCP prompt \`map\` or the \`tejo-map\` skill. \`npx ${PKG} check ${folder}\` validates the folder and \`npx ${PKG} view ${folder}\` opens the viewer.
${BLOCK_END}
`;
}

/** Primera nota de una carpeta vacía; tiene que pasar `tejo check`. */
export const WELCOME_NOTE = `---
id: bienvenida
title: "Bienvenida a la base de conocimiento"
memory_type: long_term
type_tags: [guia]
---
Esta carpeta guarda lo que sabe el proyecto: cada nota \`.md\` empieza con un
frontmatter (\`id\`, \`title\`, \`memory_type\`, tags y \`relations\`) y su cuerpo es
markdown libre. Los bloques \`\`\`flo dentro de una nota son diagramas.

- \`npx ${PKG} view\` abre el visor sobre esta carpeta.
- \`npx ${PKG} check\` lista los errores.
- Los agentes la usan por el servidor MCP \`tejo\` (ver \`.mcp.json\`).
`;

/** Aviso que `tejo mcp` suma a sus instrucciones si los archivos de `init` difieren (#68). En inglés: lo lee el agente. */
export function staleNotice(folder: string, files: string[]): string {
  return `## tejo files out of date
These files written by \`tejo init\` are missing or out of date: ${files.map((file) => `\`${file}\``).join(", ")}. Tell the user to run \`npx ${PKG_LATEST} init ${folder}\` to refresh them; their notes are not touched.`;
}
