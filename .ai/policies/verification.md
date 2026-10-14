# Política de verificación y evidencias

## Bloqueante vs. advertencia

- **Error** (bloquea cierre y CI): entradas faltantes, adaptador desincronizado, ID duplicado o
  no registrado en ledger, relación rota o no permitida, ruta de código/prueba inexistente,
  `implemented`/`verified` sin código, `verified` sin pruebas, archivo generado desactualizado,
  plan en carpeta incorrecta o completado con etapas sin verificar, formato nativo inválido.
- **Advertencia** (se revisa y se justifica en el cierre): huérfanos, capacidades parciales o
  diferidas, requerimientos sin características, elementos implementados sin pruebas,
  instrucciones duplicadas, código cambiado sin cambio de modelo (`--since`).
- `--strict` convierte advertencias en errores; se usa al cerrar planes T2. Las capacidades abiertas
  aceptadas por una EDR (`accepted_by` en `capabilities.yaml`) no generan advertencia; las no
  aceptadas sí, y bloquean el cierre estricto hasta resolverlas o aceptarlas.

## Evidencia válida

| Afirmación | Evidencia mínima |
|------------|------------------|
| "Implementado" | Ruta en `code` que existe (el validador lo comprueba) |
| "Verificado" | Prueba que se ejecutó y pasó: comando + resultado en el plan/informe/PR |
| "Validadores en verde" | Salida de `scripts/check` con 0 errores |
| "Integrado" | Commit existente (hash real) o PR fusionado |
| "No aplica" | Motivo explícito |

Una ficha documental **no** es evidencia de implementación. Haber editado archivos **no** es
evidencia de nada.

## Registro de evidencias

- T1: en el mensaje final y en el commit.
- T2: campo `evidence` de cada etapa del plan + sección de bitácora.
- Bootstrap y auditorías: informe en `docs/reports/current/`.

## Limitaciones conocidas de los validadores

- No detectan contradicciones semánticas entre textos; solo duplicación literal de líneas.
- La comprobación de símbolos (`ruta#símbolo`) es textual (palabra completa), no semántica.
- La detección de "modelo no actualizado" depende de `code_roots` en `docs/system/schema.yaml`
  (vacío mientras no haya código).
- "Pruebas alcanzables" (`verified`) sigue relaciones de composición fijas (`tests`, `validations`,
  `functions`, `entities`, `interfaces`, `integrations`) sin distinguir tipo de origen: p. ej. una FUN
  puede heredar pruebas de una ENT que solo usa. Revisión humana en esos casos.
- Secciones obligatorias: agentes usan `## Salidas`, skills `## Salida` (formatos distintos a propósito).
- No validan que el contenido de un skill sea correcto, solo su forma y referencias: la calidad
  del contenido requiere revisión (`change-verifier` o persona).
