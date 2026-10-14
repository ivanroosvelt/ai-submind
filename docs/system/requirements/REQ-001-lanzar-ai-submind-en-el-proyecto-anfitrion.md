---
id: REQ-001
type: requirement
name: "Lanzar ai-submind en el proyecto anfitrión"
status: active
evidence: declared-doc
summary: "ACT-001 puede ejecutar `npx ai-submind` (o `ai-submind serve`) en un proyecto"
aliases: ["npx", "serve", "arrancar"]
tags: [cli]
relations:
  actors: [ACT-001]
  features: [FEAT-001]
  constraints: [NFR-001, NFR-006]
  depends_on: []
  decisions: []
uncertainties:
  - "P11: puerto por defecto y apertura automática del navegador."
---

# REQ-001 · Lanzar ai-submind en el proyecto anfitrión

## Enunciado

ACT-001 puede ejecutar `npx ai-submind` (o `ai-submind serve`) en un proyecto para arrancar el daemon sobre su `knowledge/`.

## Fuente

Usuario [U]; DEC-001, DEC-005. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Dado un cwd dentro de un repo git, cuando se ejecuta el comando, entonces la raíz es `git rev-parse --show-toplevel` (sin git: el cwd) y se usa `<raíz>/knowledge` o `--knowledge <dir>` confinado a la raíz.
2. Dado el arranque, cuando termina la carga, entonces informa por stderr la ruta de `knowledge/`, archivos cargados/inválidos y la URL de la UI.
3. Dado Node < 22, cuando se ejecuta, entonces termina con código ≠ 0 y mensaje explícito.
4. Dado un daemon ya activo para el proyecto, cuando se ejecuta de nuevo, entonces reutiliza ese daemon (REQ-037).

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

-
