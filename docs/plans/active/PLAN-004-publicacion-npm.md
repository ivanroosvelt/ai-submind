---
id: PLAN-004
title: "Publicar ai-submind 0.1.0 en npm (Apache-2.0)"
status: in_progress
created: 2026-10-16
updated: 2026-10-16
class: T2
related: [DEC-019, DEC-001, NFR-001, NFR-009, API-003, FEAT-001]
blockers: []
next_action: "S1: revisión independiente de la licencia (change-verifier) y commit; después el usuario responde las dudas de S2 (URL del repositorio, idioma del README de npm)."
stages:
  - id: S1
    name: "Licencia Apache-2.0 (DEC-019)"
    status: executed
    evidence: "2026-10-16 LICENSE (texto oficial apache.org, sha256 cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30), NOTICE (Copyright 2026 Iván López), package.json/package-lock.json license Apache-2.0 y NOTICE en files; npm pack --dry-run incluye LICENSE y NOTICE; test/e2e/npx.test.ts lo comprueba. scripts/check verde (entorno 0/0, modelo 99 elementos 0/0, 332 Vitest); change-verifier aprobado con observaciones H1-H7, corregidas (bitácora). Pendiente: commit."
  - id: S2
    name: "Metadatos del paquete y README para npm"
    status: proposed
    evidence: ""
  - id: S3
    name: "CI multiplataforma: Linux, macOS y Windows (NFR-001)"
    status: proposed
    evidence: ""
  - id: S4
    name: "Flujo de release: tag → npm publish con provenance (trusted publishing)"
    status: proposed
    evidence: ""
  - id: S5
    name: "Ensayo: npm publish --dry-run y prueba del tarball final"
    status: proposed
    evidence: ""
  - id: S6
    name: "Publicación de 0.1.0 (requiere autorización explícita del usuario)"
    status: proposed
    evidence: ""
  - id: S7
    name: "Verificación desde el registro y cierre"
    status: proposed
    evidence: ""
---

# PLAN-004 · Publicar ai-submind 0.1.0 en npm (Apache-2.0)

## Objetivo
Que `npx ai-submind@0.1.0` funcione desde el registro público de npm en Linux, macOS y Windows con Node ≥22,
con licencia Apache-2.0, procedencia verificable (provenance) y un proceso de release repetible.

## Alcance
- Incluye: licencia (DEC-019), metadatos de `package.json`, README visible en npm, CI en tres sistemas
  operativos, workflow de publicación por tag, ensayo, publicación de 0.1.0 y comprobación posterior.
- Excluye: búsqueda semántica (FEAT-005), migraciones de formato (DEC-010), prueba automática de render de la UI,
  sitio web o documentación aparte del README.

## Análisis (salida de task-intake e impact-analysis)
Clase: T2 · Criterios de aceptación:
1. `npm view ai-submind@0.1.0 license` = `Apache-2.0` y el tarball incluye `LICENSE`, `NOTICE` y `dist/ui/THIRD-PARTY-LICENSES.md`.
2. El e2e (`test/e2e/npx.test.ts`) pasa en CI con ubuntu, macos y windows.
3. La versión publicada tiene attestation de provenance de GitHub Actions.
4. `npx ai-submind@0.1.0 init` + `serve` + `mcp` funcionan en un repo limpio instalando desde el registro.

Elementos: DEC-019, DEC-001, NFR-001, NFR-009, API-003, FEAT-001.

Perspectivas:
- Aplican: contratos (nombre del bin, `exports` y formato 1.0 pasan a ser públicos: a partir de aquí, cambiar el formato exige la política de versiones de spec §11 y DEC-010); seguridad (token de npm o trusted publishing, sin secretos en el repo, `permissions` mínimos en el workflow, `id-token: write` solo en el job de publicación); arquitectura y dependencias (el árbol de producción queda fijado por el lockfile solo en desarrollo: quien instala resuelve rangos → revisar rangos exactos, H4 de S12); pruebas (matriz de SO); documentación (README para npm); migraciones (la primera versión publicada fija la base 0.x; la semántica 0.x de spec §11 aplica); impacto sobre componentes existentes (`package.json`, CI); decisiones (DEC-019; repositorio público y URL).
- No aplican: actores (sin actores nuevos); reglas de negocio, estados y datos (sin cambios de comportamiento ni de persistencia); entradas/validaciones (sin cambios en el formato); entorno de IA (solo se añade un workflow de CI, sin agentes ni skills).

Cobertura: CAP de seguridad parcial → el workflow de publicación se revisa con change-verifier y aprobación humana (cambio de CI/secretos, AGENTS.md §11).

Hechos:
- `ai-submind` está libre en npm (`npm view ai-submind` → 404, 2026-10-16).
- El remoto git es `https://github.com/ivanroosvelt/tejo.git`, no `submind`.
- Hay un único workflow (`.github/workflows/validate.yml`, solo ubuntu); el e2e ya pasó en Linux (NFR-001).
- El `README.md` raíz está en español y describe el repositorio (EDR-007), no el uso del paquete.

Inferencias:
- Para que la provenance y el enlace del repositorio de npm sean útiles, el repositorio de GitHub tiene que ser público.
- En Windows, `scripts/check` (bash + Python) no corre tal cual; basta con `npm ci && npm run build && npx vitest run` en ese runner.

Dudas (bloquean S2 y S4; la 4 bloquea S4):
1. URL pública del repositorio: ¿renombrar `tejo` a `submind`, otro repositorio, o mantener `tejo`? ¿Se hará público?
2. README de npm: ¿en inglés (lo habitual en npm) con el README del repositorio aparte, o el mismo README en español?
3. Publicación: ¿trusted publishing (OIDC, sin token; recomendado) o token `NPM_TOKEN` en los secretos del repo? Cualquiera de las dos requiere que el usuario configure su cuenta de npm; ver criterios de entrada de S4 (la primera publicación probablemente no admite OIDC).
4. Rama de release: ¿se publica desde `v2` o se integra antes en `master`?

## Etapas

### S1 · Licencia Apache-2.0 (DEC-019)
- Depende de: —
- Criterios de entrada: titular confirmado (Iván López, proyecto personal, 2026-10-16).
- Acciones: `LICENSE` oficial, `NOTICE`, `license` en `package.json` y el lockfile, `NOTICE` en `files`; DEC-019; NFR-009, DEC-001 y context.md al día; README (documenter).
- Pruebas: `test/e2e/npx.test.ts` (LICENSE y NOTICE en el tarball); `scripts/check`.
- Criterios de salida: check verde y change-verifier aprobado; commit.

### S2 · Metadatos del paquete y README para npm
- Depende de: S1, dudas 1 y 2.
- Acciones: quitar `private`; `version` 0.1.0; `author`, `repository`, `homepage`, `bugs`, `keywords`;
  `publishConfig: { access: "public", provenance: true }`; `prepublishOnly` con `npm run check` (no hay `prepack`: `dist/` lo construye el globalSetup de Vitest, así que un `npm publish` manual sin él publicaría un `dist/` desactualizado);
  revisar si las dependencias de producción van con rango o exactas; README de npm (instalación, `npx ai-submind init/serve/mcp`, configuración MCP de un cliente, licencia).
- Pruebas: e2e (el README entra en el tarball); `npm pack --dry-run` sin archivos inesperados.
- Criterios de salida: `npm publish --dry-run` sin avisos de metadatos.

### S3 · CI multiplataforma (NFR-001)
- Depende de: S1.
- Acciones: job de matriz `os: [ubuntu-latest, macos-latest, windows-latest]` con Node 22 y 24 que corre `npm ci` + `npm run build` + Vitest (el e2e incluido); `scripts/check` sigue solo en ubuntu.
- Pruebas: workflow en verde en los tres SO; corregir lo que falle en Windows (H3/H4 de S13: shims `.cmd`, kill por pid).
- Criterios de salida: NFR-001 con evidencia de los tres SO (IDs de ejecución).
- Integración: cambio de CI → aprobación humana (AGENTS.md §11).

### S4 · Flujo de release
- Depende de: S2, S3, duda 3.
- Criterios de entrada: comprobar en docs.npmjs.com (no verificado): trusted publishing se configura sobre un paquete ya existente (la primera publicación de 0.1.0 iría con token granular de un solo uso o manual con 2FA) y exige npm CLI ≥ 11.5.1 (Node 22 trae npm 10: actualizar npm en el job o usar Node 24).
- Seguridad: environment de GitHub `npm` con revisor obligatorio para el job de publicación; protección de tags `v*`; acciones fijadas por SHA; 2FA obligatorio en la cuenta de npm; rama de release definida (`v2` no comparte historia con `master`, rama por defecto; EDR-002).
- Acciones: un workflow nuevo de release en push de tag `v*`: comprobación de que el tag coincide con `version`, `npm ci`, `npm run check`, `npm publish --provenance --access public`, con `permissions: { contents: read, id-token: write }`; `CHANGELOG.md`; documentar el proceso de release en el README del repositorio.
- Pruebas: ejecución del workflow con `npm publish --dry-run` (sin publicar) desde una rama.
- Criterios de salida: workflow revisado por change-verifier y aprobado por el usuario.

### S5 · Ensayo
- Depende de: S4.
- Acciones: `npm publish --dry-run`; instalar el tarball final en repos limpios en macOS (local) y en Linux/Windows (CI); revisar la página que mostrará npm (README, licencia, archivos).
- Criterios de salida: criterios de aceptación 1, 2 y 4 cumplidos con el tarball.

### S6 · Publicación de 0.1.0
- Depende de: S5 y **autorización explícita del usuario en esa conversación** (operación externa, AGENTS.md §11).
- Acciones: el usuario configura trusted publishing en npm (o el secreto); tag `v0.1.0` y push → workflow de release.
- Criterios de salida: `npm view ai-submind@0.1.0` muestra versión, licencia y provenance.

### S7 · Verificación desde el registro y cierre
- Depende de: S6.
- Acciones: `npx ai-submind@0.1.0` en un repo limpio (init, serve, mcp, stop); actualizar DEC-001, NFR-001, NFR-009, context.md y el README; archivar el plan.
- Criterios de salida: criterio de aceptación 4 con evidencia; `scripts/check` verde; plan archivado.

## Riesgos y bloqueos
- Una versión publicada no se puede reutilizar (unpublish solo durante 72 h y el número queda quemado): ensayar con `--dry-run` antes.
- Desde 0.1.0 el formato 1.0 y la interfaz MCP pasan a ser contratos públicos.
- `spec/format/README.md` reescribe UMJ (CC BY-NC-ND 4.0) con palabras propias y lo cita (DEC-002); se publica en el tarball. Mantener la cita y no copiar texto literal.
- En Windows el e2e nunca se ha ejecutado: S3 puede sacar fallos de portabilidad.

## Bitácora
- 2026-10-16 · creado. Usuario: «elige la licencia que me respalde más» → Apache-2.0 (DEC-019), titular Iván López, proyecto personal. S1 executed.
- 2026-10-16 · change-verifier sobre S1 + modelo al día + plan: aprobado con observaciones H1-H7. Corregidas: H1 prueba de la licencia propia (campo, sha256 de LICENSE, NOTICE) en test/package/licenses.test.ts; H2 DEC-019 sin DEC-001 en «Affected elements» (citado en Context); H3 plan in_progress; H4 criterios de entrada de S4 sobre trusted publishing (sin verificar en la red); H5 controles de seguridad del release en S4 y duda 4 (rama); H6 motivo de `prepublishOnly` en S2. H7 ya cubierta (S2, duda 2, riesgos).

## Resultado (al cerrar)
