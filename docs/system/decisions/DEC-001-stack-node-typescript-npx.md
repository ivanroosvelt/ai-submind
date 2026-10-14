---
id: DEC-001
type: decision
name: "Stack Node.js ≥22 + TypeScript ESM distribuido como paquete npm ai-submind (npx)"
status: active
evidence: declared-doc
summary: "submind se distribuye como paquete npm `ai-submind` (TypeScript ESM, Node ≥22) ejecutable con npx; raíz del proyecto anfitrión = git root del cwd."
aliases: [stack, npx, cli, node, typescript, ai-submind, paquete]
tags: [arquitectura, stack]
relations:
  affects: [REQ-001, REQ-002, NFR-001, NFR-008, FEAT-001, ENT-001, API-003]
  supersedes: []
uncertainties:
  - "Gestor de paquetes y estructura del repo (paquete único vs monorepo con workspaces) se fija en PLAN-002 S1."
  - "Licencia de ai-submind sin definir."
---

# DEC-001 · Stack Node.js ≥22 + TypeScript ESM distribuido como paquete npm ai-submind (npx)

## Contexto
- Usuario: "será un comando npx o similar que permita correr el servidor a partir del proyecto donde es lanzado" [declarado].
- Usuario eligió "Node ≥22 TS, raíz = git root" (2026-10-14) [declarado].
- Usuario (2026-10-14): nombre de paquete `ai-submind` [declarado]. `submind` está ocupado en npm (v1.2.80); `ai-submind` libre [verificado: `npm view`, 2026-10-14].
- SDK MCP oficial, JointJS y Ajv son ecosistema JS/TS [verificado: npm, tech-research 2026-10-14].

## Alternativas consideradas
1. Node ≥22 + TS, raíz = git root — LTS vigente, `npx` universal; requiere build.
2. Node ≥20, raíz = cwd — más compatible; raíz ambigua en subdirectorios.
3. Bun — más rápido; menor alcance que npx.

## Decisión
- Paquete npm `ai-submind` con bin `ai-submind` (`npx ai-submind`), TypeScript estricto, ESM, `engines.node >=22`.
  Nombre del producto, paquete, comando, servidor MCP y artefactos en el proyecto anfitrión: `ai-submind`
  (`knowledge/ai-submind.json`, `knowledge/.ai-submind/`). `submind` queda solo como nombre de este repositorio.
- Raíz del proyecto anfitrión: `git rev-parse --show-toplevel` desde el cwd; si no hay git, el cwd.
- Directorio de conocimiento: `<raíz>/knowledge` por defecto, configurable con `--knowledge <dir>`;
  siempre confinado dentro de la raíz.
- Módulos propios, desacoplados por interfaces (núcleo de formato, motor, consultas, MCP, servidor HTTP, UI).

## Consecuencias
- Positivas: una sola lengua en todo el stack; distribución trivial.
- Negativas / costes: build TS→JS y bundling de la UI en la publicación.

## Elementos afectados
`schema.yaml` (`code_roots`), CAP-011 (deja de estar diferida).

## Verificación
Pendiente: `npx` local de un tarball empaquetado en un repo de prueba (PLAN-002).
