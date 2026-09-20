# Fase 5 — Deploy, docs de usuario y prep de npm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preparar `@flo/core` para publicarse en npm (sin ejecutar el publish real), desplegar `@flo/web` a GitHub Pages, y escribir documentación de sintaxis `.flo` orientada a usuario final.

**Architecture:** Tres piezas independientes que no se tocan entre sí: (1) metadata + LICENSE en `packages/core/package.json` verificados con `npm pack --dry-run`, sin login ni publish real — eso queda para la Fase 6; (2) un workflow nuevo de GitHub Actions (`deploy.yml`, separado de `ci.yml`) que hace build de `@flo/web` y publica `dist/` a GitHub Pages, más el `base` correcto en la config de Vite para el subpath `/submind/`; (3) `docs/SYNTAX.md`, una guía de sintaxis para usuarios finales (distinta de `GRAMMAR.md`, que es la referencia formal interna). README se actualiza al final para reflejar las tres piezas y mover "publicar a npm" al roadmap como Fase 6.

**Tech Stack:** pnpm workspaces, TypeScript, Vite, GitHub Actions (`actions/deploy-pages`).

**Spec:** [`docs/superpowers/specs/2026-09-17-flo-diagram-tool-design.md`](../specs/2026-09-17-flo-diagram-tool-design.md) (sección "Fase 5 — Pulido, publicación y documentación", líneas 177-182). Nota: el spec original agrupa "publicación en npm" dentro de la Fase 5; por decisión del usuario en esta ronda, el `npm publish` real se separa a una Fase 6 futura — este plan solo prepara el paquete.

## Global Constraints

- Node 20+, pnpm fijado por `packageManager` en el `package.json` raíz (`pnpm@9.12.0`).
- No se ejecuta `npm publish` ni `npm login` en este plan — no hay sesión npm en esta máquina (verificado: `npm whoami` falla con `ENEEDAUTH`). Solo se prepara el paquete.
- El remote de git ya existe: `https://github.com/ivanroosvelt/submind.git` — el deploy a Pages usa ese repo.
- `ci.yml` no se modifica — el deploy es un workflow separado.
- Todo el texto de README y docs nuevas va en español, seteando el mismo tono que el README actual.

---

### Task 1: Preparar `@flo/core` para publicación en npm

**Files:**
- Modify: `packages/core/package.json`
- Create: `LICENSE`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: nada que otras tasks consuman — es independiente.

- [ ] **Step 1: Crear `LICENSE` (MIT) en la raíz del repo**

```
MIT License

Copyright (c) 2026 Ivan Roosvelt

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Actualizar `packages/core/package.json` con metadata de publicación**

Reemplazar el contenido completo por:

```json
{
  "name": "@flo/core",
  "version": "0.1.0",
  "description": "Lexer, parser, AST y renderer a SVG para .flo, un lenguaje de diagramas con gramática determinista (flowchart y sequence).",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": [
    "dist"
  ],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/ivanroosvelt/submind.git",
    "directory": "packages/core"
  },
  "keywords": [
    "diagram",
    "flowchart",
    "sequence-diagram",
    "parser",
    "svg"
  ],
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "dagre": "^0.8.5"
  },
  "devDependencies": {
    "@types/dagre": "^0.7.52",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3: Verificar que el tarball solo incluye `dist/` + metadata**

Run:
```bash
pnpm --filter @flo/core build
cd packages/core && npm pack --dry-run
```
Expected: la lista de archivos del dry-run muestra solo `dist/**`, `package.json`, `LICENSE` (npm la toma automáticamente de la raíz del paquete si existe ahí — si el dry-run NO la incluye porque `LICENSE` vive en la raíz del monorepo y no en `packages/core/`, copiar `LICENSE` también a `packages/core/LICENSE`) y `README.md` si existe en esa carpeta. No debe aparecer nada de `src/` ni `*.test.ts`.

Si el dry-run no incluye la licencia, correr:
```bash
cp LICENSE packages/core/LICENSE
```
y repetir el dry-run para confirmar que ahora aparece.

- [ ] **Step 4: Commit**

```bash
git add LICENSE packages/core/package.json packages/core/LICENSE 2>/dev/null
git commit -m "chore(core): prepara @flo/core para publicación npm (metadata, LICENSE)"
```

---

### Task 2: `base` de Vite para GitHub Pages

**Files:**
- Create: `packages/web/vite.config.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `dist/index.html` con assets referenciados bajo `/submind/` en vez de `/` — Task 3 (el workflow de deploy) depende de que el build ya sirva bien bajo ese subpath.

- [ ] **Step 1: Crear `packages/web/vite.config.ts`**

```ts
import { defineConfig } from "vite";

export default defineConfig({
  base: "/submind/",
});
```

- [ ] **Step 2: Verificar que el build referencia el subpath correcto**

Run:
```bash
pnpm --filter @flo/web build
grep -o '"/submind/assets/[^"]*"' packages/web/dist/index.html
```
Expected: al menos una coincidencia (el/los `<script>`/`<link>` del bundle apuntan a `/submind/assets/...`).

- [ ] **Step 3: Verificar que el editor sigue funcionando localmente**

Run:
```bash
pnpm --filter @flo/web serve
```
Abrir la URL que imprime `vite preview` (va a ser algo como `http://localhost:4173/submind/`, porque el `base` también aplica en preview) y confirmar visualmente que el editor carga (toolbar + panes), sin errores 404 en la consola del navegador para JS/CSS. Cerrar el server después (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add packages/web/vite.config.ts
git commit -m "feat(web): fija base de Vite a /submind/ para GitHub Pages"
```

---

### Task 3: Workflow de deploy a GitHub Pages

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `packages/web/dist` generado por `pnpm build` (depende de Task 2 para que el `base` ya esté fijado antes del primer deploy real).
- Produces: nada que otra task consuma.

- [ ] **Step 1: Crear `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [master]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: packages/web/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Validar el YAML**

Run:
```bash
python3 -c "import yaml, sys; yaml.safe_load(open('.github/workflows/deploy.yml'))" 2>&1 || node -e "require('yaml').parse(require('fs').readFileSync('.github/workflows/deploy.yml','utf8'))"
```
Expected: sin errores de parseo. Si ninguna de las dos herramientas está disponible, al menos correr `cat .github/workflows/deploy.yml` y revisar la indentación a ojo contra el bloque de arriba.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci(web): agrega workflow de deploy a GitHub Pages"
```

- [ ] **Step 4: Nota para el usuario (paso manual, no automatizable desde acá)**

Este workflow no queda activo hasta que se habilite Pages en el repo: Settings → Pages → Build and deployment → Source: "GitHub Actions". Eso requiere acceso a la UI de GitHub con las credenciales del usuario — dejarlo anotado en el README (Task 5) en vez de intentarlo desde la sesión.

---

### Task 4: `docs/SYNTAX.md` — guía de sintaxis para usuario final

**Files:**
- Create: `docs/SYNTAX.md`

**Interfaces:**
- Consumes: nada (es contenido nuevo, referencia el comportamiento ya implementado en `@flo/core`, documentado en `packages/core/GRAMMAR.md`).
- Produces: el link que README (Task 5) agrega.

- [ ] **Step 1: Escribir `docs/SYNTAX.md`**

```markdown
# Sintaxis de `.flo`

Guía de la sintaxis `.flo` para quien escribe diagramas. Para la gramática
formal (EBNF) y la tabla completa de códigos de error, ver
[`packages/core/GRAMMAR.md`](../packages/core/GRAMMAR.md) — ese archivo es
referencia interna del parser, este es para uso diario.

Todo archivo `.flo` empieza con una línea `diagram <tipo>`, donde `<tipo>`
es `flowchart` o `sequence`. Pueden precederla líneas en blanco o
comentarios, pero no otro contenido.

Los comentarios empiezan con `//` y van hasta el fin de la línea, en
cualquier tipo de diagrama:

```
// esto es un comentario
diagram flowchart
```

## Flowchart

Dos tipos de statement: declarar un nodo, o conectar dos nodos con una
arista.

**Nodos** — un id seguido de una forma con el texto adentro:

```
start[Inicio]      // rectángulo
check{¿Válido?}    // rombo
home(Home)         // óvalo
```

El id (`start`, `check`, `home`) es solo letras ASCII, dígitos y `_`, y no
puede empezar con dígito. El texto entre `[ ]`, `{ }` o `( )` puede tener
espacios y acentos — es libre excepto el delimitador de cierre y el salto
de línea.

**Aristas** — conectan dos ids ya declarados en el archivo (en cualquier
orden, no hace falta declarar antes de referenciar), con una etiqueta
opcional después de `:`:

```
start -> check
check -> home : sí
```

Un id no puede reusarse con una forma distinta a la que ya tenía. Toda
arista debe referenciar ids que existan en algún lugar del archivo.

## Sequence

Dos tipos de statement: declarar un participante (opcional), o un mensaje
entre dos participantes.

**Participantes** — con alias opcional después de `as`:

```
participant user as Usuario
participant db as Base de datos
```

El alias (después de `as`) puede tener espacios — es texto libre hasta
fin de línea, igual que el texto de un nodo.

**Mensajes** — la etiqueta después de `:` es obligatoria (a diferencia de
flowchart, donde es opcional):

```
user -> api : POST /login
api -> db : SELECT usuario
```

Si un participante se usa en un mensaje sin haber sido declarado antes con
`participant`, se autodeclara con su id como label — no hace falta
declarar todos los participantes de antemano. Pero declarar explícitamente
un participante que ya fue autodeclarado por un mensaje anterior es un
error.

## Errores

El editor (`@flo/web`) subraya los errores en el momento, con un tooltip
que explica cada uno. Si preferís usar `@flo/core` directo:

```ts
import { parse } from "@flo/core";

const { diagram, diagnostics } = parse(source);
```

`diagnostics` siempre trae **todos** los errores encontrados en una sola
pasada — el parser no se detiene en el primero. `diagram` es `null` solo
si la línea `diagram <tipo>` es inválida; con errores más abajo en el
archivo, `diagram` sigue trayendo lo que se pudo parsear.
```

- [ ] **Step 2: Verificar que los ejemplos parsean sin errores**

Run:
```bash
cat <<'EOF' > /tmp/flo-syntax-check.mjs
import { parse } from "./packages/core/dist/index.js";

const flowchart = `diagram flowchart

start[Inicio]
check{¿Válido?}
home(Home)

start -> check
check -> home : sí
`;

const sequence = `diagram sequence

participant user as Usuario
participant db as Base de datos

user -> api : POST /login
api -> db : SELECT usuario
`;

for (const [name, src] of [["flowchart", flowchart], ["sequence", sequence]]) {
  const { diagnostics } = parse(src);
  if (diagnostics.length > 0) {
    console.error(`${name}: FALLÓ`, diagnostics);
    process.exitCode = 1;
  } else {
    console.log(`${name}: OK`);
  }
}
EOF
pnpm --filter @flo/core build
node /tmp/flo-syntax-check.mjs
rm /tmp/flo-syntax-check.mjs
```
Expected: `flowchart: OK` y `sequence: OK`, exit code 0. Si algún ejemplo falla, corregir el ejemplo en `docs/SYNTAX.md` (no el parser) hasta que pase.

- [ ] **Step 3: Commit**

```bash
git add docs/SYNTAX.md
git commit -m "docs: agrega guía de sintaxis .flo para usuario final"
```

---

### Task 5: Actualizar README

**Files:**
- Modify: `README.md:8-14` (bloque de estado), `README.md:121-126` (Documentación), `README.md:128-132` (Roadmap)

**Interfaces:**
- Consumes: nada nuevo — enlaza `docs/SYNTAX.md` (Task 4) y menciona el deploy (Task 3) y la prep de npm (Task 1).
- Produces: nada.

- [ ] **Step 1: Reemplazar el bloque de estado (líneas 8-14)**

Old:
```markdown
> **Estado actual:** Fase 0 (monorepo + CI), Fase 1 (lenguaje: lexer,
> parser, AST, diagnostics), Fase 2 (layout con `dagre` + render a SVG),
> Fase 3 (editor web: CodeMirror 6 + preview en vivo) y Fase 4
> (persistencia: File System Access API + fallback de descarga, autosave
> a IndexedDB, exportación a SVG/PNG) completas para los tipos
> `flowchart` y `sequence`. Falta publicar `@flo/core` a npm y desplegar
> el editor — eso es la próxima fase (ver [Roadmap](#roadmap)).
```

New:
```markdown
> **Estado actual:** Fases 0-4 completas (monorepo + CI, lenguaje, layout
> + render SVG, editor web, persistencia y exportación) para los tipos
> `flowchart` y `sequence`. Fase 5 completa: editor deployado en
> [GitHub Pages](https://ivanroosvelt.github.io/submind/), guía de
> sintaxis para usuario final en [`docs/SYNTAX.md`](docs/SYNTAX.md), y
> `@flo/core` preparado para publicarse en npm. Falta ejecutar el
> `npm publish` real — eso es la Fase 6 (ver [Roadmap](#roadmap)).
```

- [ ] **Step 2: Reemplazar la sección Documentación (líneas 121-126)**

Old:
```markdown
## Documentación

- [`docs/superpowers/specs/2026-09-17-flo-diagram-tool-design.md`](docs/superpowers/specs/2026-09-17-flo-diagram-tool-design.md) — diseño y alcance del proyecto completo (todas las fases).
- [`docs/superpowers/plans/2026-09-17-flo-lenguaje-mvp.md`](docs/superpowers/plans/2026-09-17-flo-lenguaje-mvp.md) — plan de implementación de Fase 0 + Fase 1.
- [`docs/superpowers/plans/2026-09-17-flo-layout-render-svg.md`](docs/superpowers/plans/2026-09-17-flo-layout-render-svg.md) — plan de implementación de Fase 2 (layout + render a SVG).
- [`packages/core/GRAMMAR.md`](packages/core/GRAMMAR.md) — gramática formal (EBNF), reglas léxicas especiales y tabla de códigos de diagnóstico (E001–E027).
```

New:
```markdown
## Documentación

- [`docs/SYNTAX.md`](docs/SYNTAX.md) — sintaxis de `.flo` para usuario final, con ejemplos.
- [`docs/superpowers/specs/2026-09-17-flo-diagram-tool-design.md`](docs/superpowers/specs/2026-09-17-flo-diagram-tool-design.md) — diseño y alcance del proyecto completo (todas las fases).
- [`docs/superpowers/plans/2026-09-17-flo-lenguaje-mvp.md`](docs/superpowers/plans/2026-09-17-flo-lenguaje-mvp.md) — plan de implementación de Fase 0 + Fase 1.
- [`docs/superpowers/plans/2026-09-17-flo-layout-render-svg.md`](docs/superpowers/plans/2026-09-17-flo-layout-render-svg.md) — plan de implementación de Fase 2 (layout + render a SVG).
- [`docs/superpowers/plans/2026-09-18-flo-persistencia-exportacion.md`](docs/superpowers/plans/2026-09-18-flo-persistencia-exportacion.md) — plan de implementación de Fase 4 (persistencia y exportación).
- [`docs/superpowers/plans/2026-09-18-flo-fase5-deploy-docs.md`](docs/superpowers/plans/2026-09-18-flo-fase5-deploy-docs.md) — plan de implementación de Fase 5 (deploy, docs de usuario, prep de npm).
- [`packages/core/GRAMMAR.md`](packages/core/GRAMMAR.md) — gramática formal (EBNF), reglas léxicas especiales y tabla de códigos de diagnóstico (E001–E027).
```

- [ ] **Step 3: Reemplazar la sección Roadmap (líneas 128-132)**

Old:
```markdown
## Roadmap

- **Fase 5** — publicación de `@flo/core` a npm, documentación de usuario final, deploy del editor.

Detalle completo de cada fase en el spec enlazado arriba.
```

New:
```markdown
## Roadmap

- **Fase 6** — `npm publish` real de `@flo/core` (el paquete ya está preparado; falta correr `npm login && npm publish --access public` desde `packages/core` con una cuenta npm autenticada, y habilitar GitHub Pages en Settings → Pages → Source: "GitHub Actions" para que el workflow de deploy quede activo).

Detalle completo de cada fase en el spec enlazado arriba.
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README refleja Fase 5 completa (deploy, docs de usuario, prep npm)"
```
