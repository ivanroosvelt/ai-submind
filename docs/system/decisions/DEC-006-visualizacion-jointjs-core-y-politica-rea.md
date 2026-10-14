---
id: DEC-006
type: decision
name: "Visualización con @joint/core y componentes propios; política de REA y clean-room"
status: active
evidence: declared-doc
summary: "UI con JointJS core (MPL-2.0) y shapes/herramientas UML propias; capacidades tipo JointJS+ se reimplementan clean-room; REA solo para artefactos sin fuente con licencia que lo permita."
aliases: [jointjs, ui, visor, rea, clean-room, licencias]
tags: [ui, licencias, seguridad]
relations:
  affects: [REQ-028, REQ-029, REQ-032, REQ-040, NFR-009, FEAT-007, FEAT-009, API-002]
  supersedes: []
uncertainties:
  - "Framework de la UI (vanilla TS vs librería ligera) se fija en la etapa de UI."
---

# DEC-006 · Visualización con JointJS core y política de REA

## Contexto
- Usuario: "jointjs para visualización a usuarios"; "cada parte del sistema será modular, implementación propia";
  REA "para todas las features, deben ser regeneradas con el enfoque que tenemos" [declarado].
- `@joint/core` 4.3.3 y `@joint/layout-directed-graph` 4.3.0 son MPL-2.0; core no incluye shapes UML;
  JointJS+ es comercial (navigator, inspector, stencil, undo, export…) [verificado: npm, tech-research].
- REA (`rea-agents` 6.5.0, MIT) analiza artefactos distribuidos (JS empaquetado, nativos, .NET, WASM…);
  su propia guía desaconseja usarlo sobre repos con código fuente [verificado: tech-research].
- Usuario eligió UI "Explorar + ajustar layout" para la primera iteración [declarado].

## Decisión
- UI: `@joint/core` como dependencia; shapes UML (clase, interfaz, enum, relaciones; lifelines y
  mensajes de secuencia) y herramientas (zoom/pan, selección, auto-layout, export SVG, minimapa)
  implementadas en módulos propios.
- Auto-layout inicial con `@joint/layout-directed-graph` (dagre); layout de secuencia propio.
- Política de ingeniería inversa:
  - Software con código abierto: estudiar el código fuente respetando su licencia; REA no aplica.
  - Software comercial/propietario (p. ej. JointJS+): solo clean-room a partir de documentación
    pública y comportamiento observable; prohibido descompilar o copiar su código.
  - REA se usa para artefactos sin fuente cuando la licencia lo permita, registrando el hallazgo.
- Dependencias con licencia copyleft fuerte (p. ej. elkjs EPL) requieren revisión antes de usarse.

## Consecuencias
- Positivas: sin dependencias comerciales; riesgos legales acotados.
- Negativas / costes: más trabajo propio en UI.

## Elementos afectados
UI, empaquetado, licencias.

## Verificación
Pendiente: auditoría de licencias de dependencias (`npm ls` + licencias) en la etapa de empaquetado.
