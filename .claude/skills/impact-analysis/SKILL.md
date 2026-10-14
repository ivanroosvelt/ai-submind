---
name: impact-analysis
description: Determina qué elementos del producto y del entorno afecta un cambio en submind, qué se rompería, qué integraciones previas o posteriores requiere y qué fichas hay que actualizar. Incluye análisis de diffs de Git. Usar antes de implementar cambios T1/T2 y al revisar un diff existente.
---

# impact-analysis

ID: SKL-002 · Canónico: `AGENTS.md` §6 (fase 2) y §9

## Activación
Cambios T1/T2; revisión de un diff o rama; antes de retirar un elemento o componente.

## Entradas
IDs de partida (de `task-intake`) y/o un rango de Git (`<base>..HEAD`, o cambios sin confirmar).

## Procedimiento
1. **Diff** (si existe): `git status --short`, `git diff --stat <base>`, `git diff <base> -- <ruta>`.
   Clasificar archivos: código del producto / modelo / entorno / otros. Nunca alterar el estado de Git.
2. **Del código al modelo**: por cada archivo de código cambiado, `scripts/sysq find <ruta o símbolo>`
   para encontrar las fichas que lo declaran en `code`/`test_code`.
   Archivos sin ficha → posible hueco del modelo (anotarlo).
3. **Cierre transitivo**: `scripts/sysq impact <ID>` por cada ID afectado. Lo que *depende de* él es
   lo que puede romperse; revisar cada uno (contratos API, validaciones, pruebas).
4. **Integraciones** (marcar las que apliquen, con orden pre/post):
   esquema antes que servicio · migración de datos antes de habilitar función · contrato compartido
   antes que consumidores · regenerar clientes tras cambiar API · e2e tras conectar sistemas ·
   permisos tras nuevos actores · trazabilidad tras cambiar dominio · `scripts/regen` tras tocar fichas.
5. **Riesgos**: compatibilidad hacia atrás, datos existentes, seguridad, rendimiento.
6. **Fichas a actualizar**: lista explícita de IDs (y nuevas a crear).

## Salida
Tabla: elemento · tipo de impacto (directo/transitivo) · acción (actualizar/crear/retirar/revisar) ·
integración pre/post · riesgo. Más archivos de código sin ficha.

## Calidad
Cada afirmación de impacto cita un ID, una ruta o la salida de `sysq`. Lo no verificable se marca
como inferido.

## Límites
Solo lectura. Dependencias: `scripts/sysq`, Git.
