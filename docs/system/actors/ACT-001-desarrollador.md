---
id: ACT-001
type: actor
name: "Desarrollador"
status: active
evidence: declared-doc
summary: "Persona que lanza ai-submind en su proyecto, explora diagramas en la UI y ajusta su layout."
aliases: ["usuario", "developer", "persona"]
tags: [persona]
relations:
  specializes: []
uncertainties: []
---

# ACT-001 · Desarrollador

## Descripción
Persona que trabaja en el proyecto anfitrión: ejecuta `npx ai-submind`, abre la UI local y versiona
`knowledge/` con Git. No hay roles internos ni autenticación de usuarios finales (usuario único local) [inferido].

## Objetivos
Entender y documentar el sistema mediante diagramas versionados junto al código.

## Permisos

| Recurso / operación | Permitido | Condiciones |
|---------------------|-----------|-------------|
| CLI (`serve`, `mcp`, `init`, `status`, `stop`, validar) | sí | API-003 |
| UI: leer modelos, diagramas, validación | sí | API-002, loopback + token |
| UI: modificar layout | sí | solo layout (REQ-029) |
| UI: crear/modificar/eliminar elementos del modelo | no | REQ-032 (DEC-006) |
| Editar `knowledge/` a mano, commit, merge | sí | fuera de ai-submind; se revalida (REQ-007) |
