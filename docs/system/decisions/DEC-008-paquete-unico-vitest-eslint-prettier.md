---
id: DEC-008
type: decision
name: "Paquete npm único con Vitest, ESLint (typescript-eslint) y Prettier"
status: active
evidence: declared-doc
summary: "ai-submind es un único paquete npm en la raíz del repo (src/ por módulos, test/ aparte); pruebas con Vitest, lint con ESLint + typescript-eslint con tipos, formato con Prettier."
aliases: [andamiaje, vitest, eslint, prettier, tsconfig, monorepo, paquete-unico]
tags: [arquitectura, stack, pruebas]
relations:
  affects: [NFR-008]
  supersedes: []
uncertainties:
  - "Build de la UI (Vite) se configura en PLAN-002 S9, cuando exista código de UI."
  - "Source maps de dist/ apuntan a src/, no publicado: decidir en PLAN-002 S12 (incluir src o quitar maps)."
---

# DEC-008 · Paquete npm único con Vitest, ESLint (typescript-eslint) y Prettier

## Contexto
- DEC-001 dejó abiertos estructura del repo y herramientas de desarrollo para PLAN-002 [declarado].
- Usuario (2026-10-14) elige paquete único, Vitest y ESLint + typescript-eslint + Prettier [declarado].
- Versiones instaladas: TypeScript 6.0.3, Vitest 5.0.4, ESLint 10.12.0, typescript-eslint 8.71.2
  (peer `typescript <6.1.0`), Prettier 3.9.10 [verificado: `npm ls`, 2026-10-14].

## Alternativas consideradas
1. Estructura: **paquete único** vs monorepo con npm workspaces (`packages/{core,cli,mcp,ui}`) —
   el monorepo da límites duros entre módulos a costa de más configuración y bundling de internos.
2. Pruebas: **Vitest** vs `node:test` — `node:test` no tiene dependencias, pero la UI (S9/S11) necesitaría
   otra herramienta; Vitest comparte Vite con el futuro build de la UI.
3. Lint/formato: **ESLint + typescript-eslint + Prettier** vs Biome — Biome es más ligero, pero con
   menos reglas basadas en tipos (promesas flotantes, `any` inseguro), relevantes en daemon y MCP.

## Decisión
- Un `package.json` en la raíz (`ai-submind`, ESM, `engines.node >=22`, bin `dist/cli/main.js`,
  `files: [dist, spec]`). `"private": true` hasta PLAN-002 S12 para impedir publicaciones accidentales.
- Código en `src/<módulo>/` (format, engine, query, cli, daemon, mcp, ui) desacoplado por interfaces
  (DEC-001); pruebas en `test/**/*.test.ts`. `code_roots: [src/]` en `schema.yaml`.
- TypeScript estricto (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`, módulos `NodeNext`); build con `tsc -p tsconfig.build.json` a `dist/`.
- ESLint con `strictTypeChecked` + `stylisticTypeChecked` y `eslint-config-prettier`.
- Prettier solo sobre código y configuración del producto (`.prettierignore` en lista blanca):
  `spec/` contiene ejemplos canónicos byte a byte y no se reformatea.
- `npm run check` = typecheck + lint + formato + pruebas; `scripts/check` lo ejecuta (EDR-006).
- Node para desarrollo: `^22.13.0 || >=24` (mínimo de ESLint 10 y Vitest 5); el runtime publicado
  mantiene `engines.node >=22` (DEC-001). Se declara en `devEngines` de `package.json`.
- Dependencias de desarrollo con versión exacta (`--save-exact`) y `package-lock.json` versionado.

## Consecuencias
- Positivas: publicación y `npx` triviales; una sola cadena de herramientas para núcleo y UI.
- Negativas / costes: límites entre módulos solo por convención (sin workspaces); más dependencias
  de desarrollo que `node:test` (auditoría de licencias en S12).

## Elementos afectados
DEC-001 (resuelve su duda de estructura), NFR-008, `docs/system/schema.yaml` (`code_roots`), `scripts/check`.

## Verificación
2026-10-14: `npm run check` (typecheck, lint, formato, 1 prueba Vitest) y `npm run build` en verde;
`node dist/cli/main.js` imprime `ai-submind`; `scripts/check` ejecuta la sección de producto.
