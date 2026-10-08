import { INSTRUCTIONS } from "@tejo/mcp";

// Nombre publicado en npm: "tejo" sin scope lo rechaza el registro (#67).
export const PKG = "@ivanroosveltlt/tejo";

export const BLOCK_START = "<!-- tejo:start -->";
export const BLOCK_END = "<!-- tejo:end -->";

/** `.claude/skills/tejo/SKILL.md`: las mismas instrucciones que el MCP manda al conectar (#63, #65). */
export function skill(folder: string): string {
  return `---
name: tejo
description: Base de conocimiento del proyecto en ${folder}/ (notas .md y diagramas .flo). Úsala antes de decidir o responder algo sobre el proyecto, y para anotar decisiones, incidentes, reglas o lo aprendido.
---

# tejo

La base de conocimiento del proyecto vive en \`${folder}/\`. El servidor MCP \`tejo\` (registrado en \`.mcp.json\`) la expone con las herramientas query, get_node, list_tags, check y write_node.

${INSTRUCTIONS}

## Sin el servidor MCP

- Puedes leer y editar los .md de \`${folder}/\` directamente con el mismo formato.
- Después de editar, corre \`npx ${PKG} check ${folder}\`: sale con 1 y lista los errores si los hay.
- \`npx ${PKG} view ${folder}\` abre el visor para que la persona vea el grafo y los diagramas.
`;
}

/** El bloque de `AGENTS.md`, con sus marcadores. */
export function agentsBlock(folder: string): string {
  return `${BLOCK_START}
## Base de conocimiento (tejo)

El conocimiento del proyecto (decisiones, reglas, incidentes, diagramas) está en \`${folder}/\`. Consúltalo antes de decidir y anota lo nuevo: usa el servidor MCP \`tejo\` o la skill \`tejo\`. \`npx ${PKG} check ${folder}\` valida la carpeta y \`npx ${PKG} view ${folder}\` abre el visor.
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
