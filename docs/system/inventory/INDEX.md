<!-- Generado por scripts/regen a partir de las fichas. No editar a mano. -->

# Inventario del modelo estructural

Una fila por elemento. Relaciones: una línea `ORIGEN relación DESTINO` (buscable con grep).

| ID | Tipo | Nombre | Estado | Impl. | Evidencia | Ficha |
|----|------|--------|--------|-------|-----------|-------|
| ACT-001 | actor | Desarrollador | active | - | declared-doc | [ACT-001-desarrollador.md](../../../docs/system/actors/ACT-001-desarrollador.md) |
| ACT-002 | actor | Agente IA (cliente MCP) | active | - | declared-doc | [ACT-002-agente-ia-cliente-mcp.md](../../../docs/system/actors/ACT-002-agente-ia-cliente-mcp.md) |
| ACT-003 | actor | Repositorio Git anfitrión | active | - | declared-doc | [ACT-003-repositorio-git-anfitrion.md](../../../docs/system/actors/ACT-003-repositorio-git-anfitrion.md) |
| ACT-004 | actor | Proveedor de embeddings | proposed | - | declared-doc | [ACT-004-proveedor-de-embeddings.md](../../../docs/system/actors/ACT-004-proveedor-de-embeddings.md) |
| API-001 | interface | Servidor MCP ai-submind | active | none | declared-doc | [API-001-servidor-mcp-ai-submind.md](../../../docs/system/interfaces/API-001-servidor-mcp-ai-submind.md) |
| API-002 | interface | API HTTP de la UI | active | none | declared-doc | [API-002-api-http-de-la-ui.md](../../../docs/system/interfaces/API-002-api-http-de-la-ui.md) |
| API-003 | interface | CLI ai-submind | active | none | declared-doc | [API-003-cli-ai-submind.md](../../../docs/system/interfaces/API-003-cli-ai-submind.md) |
| DEC-001 | decision | Stack Node.js ≥22 + TypeScript ESM distribuido como paquete npm ai-submind (npx) | active | - | declared-doc | [DEC-001-stack-node-typescript-npx.md](../../../docs/system/decisions/DEC-001-stack-node-typescript-npx.md) |
| DEC-002 | decision | Formato de conocimiento propio derivado de UMJ: un archivo por modelo + layout separado | active | - | declared-doc | [DEC-002-formato-conocimiento-derivado-de-umj.md](../../../docs/system/decisions/DEC-002-formato-conocimiento-derivado-de-umj.md) |
| DEC-003 | decision | IDs legibles por humanos con garantía y mantenimiento de referencias | active | - | declared-doc | [DEC-003-ids-legibles-con-mantenimiento-de-referencias.md](../../../docs/system/decisions/DEC-003-ids-legibles-con-mantenimiento-de-referencias.md) |
| DEC-004 | decision | Motor de conocimiento propio embebido en lugar de TerminusDB | active | - | declared-doc | [DEC-004-motor-de-conocimiento-propio-embebido.md](../../../docs/system/decisions/DEC-004-motor-de-conocimiento-propio-embebido.md) |
| DEC-005 | decision | Daemon único por proyecto con proxy MCP stdio | active | - | declared-doc | [DEC-005-proceso-daemon-y-proxy-mcp.md](../../../docs/system/decisions/DEC-005-proceso-daemon-y-proxy-mcp.md) |
| DEC-006 | decision | Visualización con @joint/core y componentes propios; política de REA y clean-room | active | - | declared-doc | [DEC-006-visualizacion-jointjs-core-y-politica-rea.md](../../../docs/system/decisions/DEC-006-visualizacion-jointjs-core-y-politica-rea.md) |
| DEC-007 | decision | Búsqueda léxica siempre disponible y semántica local opcional | active | - | declared-doc | [DEC-007-busqueda-lexica-y-semantica-opcional.md](../../../docs/system/decisions/DEC-007-busqueda-lexica-y-semantica-opcional.md) |
| ENT-001 | entity | Configuración del proyecto ai-submind | active | none | declared-doc | [ENT-001-configuracion-del-proyecto-ai-submind.md](../../../docs/system/domain/entities/ENT-001-configuracion-del-proyecto-ai-submind.md) |
| ENT-002 | entity | Modelo | active | none | declared-doc | [ENT-002-modelo.md](../../../docs/system/domain/entities/ENT-002-modelo.md) |
| ENT-003 | entity | Elemento de modelo | active | none | declared-doc | [ENT-003-elemento-de-modelo.md](../../../docs/system/domain/entities/ENT-003-elemento-de-modelo.md) |
| ENT-004 | entity | Diagrama | active | none | declared-doc | [ENT-004-diagrama.md](../../../docs/system/domain/entities/ENT-004-diagrama.md) |
| ENT-005 | entity | Layout de diagrama | active | none | declared-doc | [ENT-005-layout-de-diagrama.md](../../../docs/system/domain/entities/ENT-005-layout-de-diagrama.md) |
| FEAT-001 | feature | CLI y daemon por proyecto | active | none | declared-doc | [FEAT-001-cli-y-daemon-por-proyecto.md](../../../docs/system/features/FEAT-001-cli-y-daemon-por-proyecto.md) |
| FEAT-002 | feature | Motor de conocimiento embebido | active | none | declared-doc | [FEAT-002-motor-de-conocimiento-embebido.md](../../../docs/system/features/FEAT-002-motor-de-conocimiento-embebido.md) |
| FEAT-003 | feature | Formato de conocimiento, layout y validación | active | none | declared-doc | [FEAT-003-formato-de-conocimiento-layout-y-validacion.md](../../../docs/system/features/FEAT-003-formato-de-conocimiento-layout-y-validacion.md) |
| FEAT-004 | feature | Consultas estructuradas y búsqueda léxica | active | none | declared-doc | [FEAT-004-consultas-estructuradas-y-busqueda-lexica.md](../../../docs/system/features/FEAT-004-consultas-estructuradas-y-busqueda-lexica.md) |
| FEAT-005 | feature | Búsqueda semántica | proposed | none | declared-doc | [FEAT-005-busqueda-semantica.md](../../../docs/system/features/FEAT-005-busqueda-semantica.md) |
| FEAT-006 | feature | Administración del conocimiento vía MCP | active | none | declared-doc | [FEAT-006-administracion-del-conocimiento-via-mcp.md](../../../docs/system/features/FEAT-006-administracion-del-conocimiento-via-mcp.md) |
| FEAT-007 | feature | Visor web JointJS de diagramas de clases | active | none | declared-doc | [FEAT-007-visor-web-jointjs-de-diagramas-de-clases.md](../../../docs/system/features/FEAT-007-visor-web-jointjs-de-diagramas-de-clases.md) |
| FEAT-008 | feature | Integridad con Git | active | none | declared-doc | [FEAT-008-integridad-con-git.md](../../../docs/system/features/FEAT-008-integridad-con-git.md) |
| FEAT-009 | feature | Visor de diagramas de secuencia | active | none | declared-doc | [FEAT-009-visor-de-diagramas-de-secuencia.md](../../../docs/system/features/FEAT-009-visor-de-diagramas-de-secuencia.md) |
| NFR-001 | quality-attribute | Portabilidad | active | - | declared-doc | [NFR-001-portabilidad.md](../../../docs/system/quality/NFR-001-portabilidad.md) |
| NFR-002 | quality-attribute | Funcionamiento sin red | active | - | declared-doc | [NFR-002-funcionamiento-sin-red.md](../../../docs/system/quality/NFR-002-funcionamiento-sin-red.md) |
| NFR-003 | quality-attribute | Diff y merge amigables con Git | active | - | declared-doc | [NFR-003-diff-y-merge-amigables-con-git.md](../../../docs/system/quality/NFR-003-diff-y-merge-amigables-con-git.md) |
| NFR-004 | quality-attribute | Seguridad de red local | active | - | declared-doc | [NFR-004-seguridad-de-red-local.md](../../../docs/system/quality/NFR-004-seguridad-de-red-local.md) |
| NFR-005 | quality-attribute | Concurrencia de escritura | active | - | declared-doc | [NFR-005-concurrencia-de-escritura.md](../../../docs/system/quality/NFR-005-concurrencia-de-escritura.md) |
| NFR-006 | quality-attribute | Confinamiento de rutas | active | - | declared-doc | [NFR-006-confinamiento-de-rutas.md](../../../docs/system/quality/NFR-006-confinamiento-de-rutas.md) |
| NFR-007 | quality-attribute | Rendimiento | proposed | - | inferred | [NFR-007-rendimiento.md](../../../docs/system/quality/NFR-007-rendimiento.md) |
| NFR-008 | quality-attribute | Modularidad | active | - | declared-doc | [NFR-008-modularidad.md](../../../docs/system/quality/NFR-008-modularidad.md) |
| NFR-009 | quality-attribute | Cumplimiento de licencias | active | - | declared-doc | [NFR-009-cumplimiento-de-licencias.md](../../../docs/system/quality/NFR-009-cumplimiento-de-licencias.md) |
| NFR-010 | quality-attribute | Observabilidad | proposed | - | inferred | [NFR-010-observabilidad.md](../../../docs/system/quality/NFR-010-observabilidad.md) |
| NFR-011 | quality-attribute | Compatibilidad del formato | proposed | - | inferred | [NFR-011-compatibilidad-del-formato.md](../../../docs/system/quality/NFR-011-compatibilidad-del-formato.md) |
| REQ-001 | requirement | Lanzar ai-submind en el proyecto anfitrión | active | - | declared-doc | [REQ-001-lanzar-ai-submind-en-el-proyecto-anfitrion.md](../../../docs/system/requirements/REQ-001-lanzar-ai-submind-en-el-proyecto-anfitrion.md) |
| REQ-002 | requirement | Inicializar knowledge/ | active | - | declared-doc | [REQ-002-inicializar-knowledge.md](../../../docs/system/requirements/REQ-002-inicializar-knowledge.md) |
| REQ-003 | requirement | Exponer servidor MCP | active | - | declared-doc | [REQ-003-exponer-servidor-mcp.md](../../../docs/system/requirements/REQ-003-exponer-servidor-mcp.md) |
| REQ-004 | requirement | Servir UI web local | active | - | declared-doc | [REQ-004-servir-ui-web-local.md](../../../docs/system/requirements/REQ-004-servir-ui-web-local.md) |
| REQ-005 | requirement | Persistir con serialización canónica | active | - | declared-doc | [REQ-005-persistir-con-serializacion-canonica.md](../../../docs/system/requirements/REQ-005-persistir-con-serializacion-canonica.md) |
| REQ-006 | requirement | Cargar e indexar knowledge/ al arrancar | active | - | declared-doc | [REQ-006-cargar-e-indexar-knowledge-al-arrancar.md](../../../docs/system/requirements/REQ-006-cargar-e-indexar-knowledge-al-arrancar.md) |
| REQ-007 | requirement | Detectar cambios externos en knowledge/ | active | - | declared-doc | [REQ-007-detectar-cambios-externos-en-knowledge.md](../../../docs/system/requirements/REQ-007-detectar-cambios-externos-en-knowledge.md) |
| REQ-008 | requirement | Escritura atómica y confinada | active | - | declared-doc | [REQ-008-escritura-atomica-y-confinada.md](../../../docs/system/requirements/REQ-008-escritura-atomica-y-confinada.md) |
| REQ-009 | requirement | Especificación del formato ai-submind | active | - | declared-doc | [REQ-009-especificacion-del-formato-ai-submind.md](../../../docs/system/requirements/REQ-009-especificacion-del-formato-ai-submind.md) |
| REQ-010 | requirement | Layout separado del modelo | active | - | declared-doc | [REQ-010-layout-separado-del-modelo.md](../../../docs/system/requirements/REQ-010-layout-separado-del-modelo.md) |
| REQ-011 | requirement | Validar al leer y antes de escribir | active | - | declared-doc | [REQ-011-validar-al-leer-y-antes-de-escribir.md](../../../docs/system/requirements/REQ-011-validar-al-leer-y-antes-de-escribir.md) |
| REQ-012 | requirement | Informe de validación | active | - | declared-doc | [REQ-012-informe-de-validacion.md](../../../docs/system/requirements/REQ-012-informe-de-validacion.md) |
| REQ-013 | requirement | Extensibilidad de tipos de diagrama | active | - | declared-doc | [REQ-013-extensibilidad-de-tipos-de-diagrama.md](../../../docs/system/requirements/REQ-013-extensibilidad-de-tipos-de-diagrama.md) |
| REQ-014 | requirement | Listar modelos y diagramas | active | - | declared-doc | [REQ-014-listar-modelos-y-diagramas.md](../../../docs/system/requirements/REQ-014-listar-modelos-y-diagramas.md) |
| REQ-015 | requirement | Obtener elemento por id | active | - | declared-doc | [REQ-015-obtener-elemento-por-id.md](../../../docs/system/requirements/REQ-015-obtener-elemento-por-id.md) |
| REQ-016 | requirement | Buscar elementos por atributos | active | - | declared-doc | [REQ-016-buscar-elementos-por-atributos.md](../../../docs/system/requirements/REQ-016-buscar-elementos-por-atributos.md) |
| REQ-017 | requirement | Relaciones de un elemento | active | - | declared-doc | [REQ-017-relaciones-de-un-elemento.md](../../../docs/system/requirements/REQ-017-relaciones-de-un-elemento.md) |
| REQ-018 | requirement | Análisis de impacto | active | - | declared-doc | [REQ-018-analisis-de-impacto.md](../../../docs/system/requirements/REQ-018-analisis-de-impacto.md) |
| REQ-019 | requirement | Caminos entre elementos | active | - | declared-doc | [REQ-019-caminos-entre-elementos.md](../../../docs/system/requirements/REQ-019-caminos-entre-elementos.md) |
| REQ-020 | requirement | Búsqueda semántica | proposed | - | declared-doc | [REQ-020-busqueda-semantica.md](../../../docs/system/requirements/REQ-020-busqueda-semantica.md) |
| REQ-021 | requirement | Crear modelo | active | - | declared-doc | [REQ-021-crear-modelo.md](../../../docs/system/requirements/REQ-021-crear-modelo.md) |
| REQ-022 | requirement | Operar en modo degradado con archivos inválidos | active | - | declared-doc | [REQ-022-operar-en-modo-degradado-con-archivos-invalidos.md](../../../docs/system/requirements/REQ-022-operar-en-modo-degradado-con-archivos-invalidos.md) |
| REQ-023 | requirement | Crear o actualizar elemento | active | - | declared-doc | [REQ-023-crear-o-actualizar-elemento.md](../../../docs/system/requirements/REQ-023-crear-o-actualizar-elemento.md) |
| REQ-024 | requirement | Eliminar elemento | active | - | declared-doc | [REQ-024-eliminar-elemento.md](../../../docs/system/requirements/REQ-024-eliminar-elemento.md) |
| REQ-025 | requirement | Gestionar diagramas | active | - | declared-doc | [REQ-025-gestionar-diagramas.md](../../../docs/system/requirements/REQ-025-gestionar-diagramas.md) |
| REQ-026 | requirement | Operaciones por lotes atómicas | active | - | declared-doc | [REQ-026-operaciones-por-lotes-atomicas.md](../../../docs/system/requirements/REQ-026-operaciones-por-lotes-atomicas.md) |
| REQ-027 | requirement | Ejecución en seco | proposed | - | inferred | [REQ-027-ejecucion-en-seco.md](../../../docs/system/requirements/REQ-027-ejecucion-en-seco.md) |
| REQ-028 | requirement | Navegar y renderizar diagramas de clases | active | - | declared-doc | [REQ-028-navegar-y-renderizar-diagramas-de-clases.md](../../../docs/system/requirements/REQ-028-navegar-y-renderizar-diagramas-de-clases.md) |
| REQ-029 | requirement | Ajustar y persistir layout | active | - | declared-doc | [REQ-029-ajustar-y-persistir-layout.md](../../../docs/system/requirements/REQ-029-ajustar-y-persistir-layout.md) |
| REQ-030 | requirement | Refresco en vivo de la UI | active | - | declared-doc | [REQ-030-refresco-en-vivo-de-la-ui.md](../../../docs/system/requirements/REQ-030-refresco-en-vivo-de-la-ui.md) |
| REQ-031 | requirement | Detalle de elemento | active | - | declared-doc | [REQ-031-detalle-de-elemento.md](../../../docs/system/requirements/REQ-031-detalle-de-elemento.md) |
| REQ-032 | requirement | UI sin edición de modelo | active | - | declared-doc | [REQ-032-ui-sin-edicion-de-modelo.md](../../../docs/system/requirements/REQ-032-ui-sin-edicion-de-modelo.md) |
| REQ-033 | requirement | Ver estado de validación en la UI | active | - | declared-doc | [REQ-033-ver-estado-de-validacion-en-la-ui.md](../../../docs/system/requirements/REQ-033-ver-estado-de-validacion-en-la-ui.md) |
| REQ-034 | requirement | Detectar conflictos de merge | active | - | declared-doc | [REQ-034-detectar-conflictos-de-merge.md](../../../docs/system/requirements/REQ-034-detectar-conflictos-de-merge.md) |
| REQ-035 | requirement | Detectar IDs duplicados tras merge | active | - | declared-doc | [REQ-035-detectar-ids-duplicados-tras-merge.md](../../../docs/system/requirements/REQ-035-detectar-ids-duplicados-tras-merge.md) |
| REQ-036 | requirement | Detectar referencias rotas tras merge | active | - | declared-doc | [REQ-036-detectar-referencias-rotas-tras-merge.md](../../../docs/system/requirements/REQ-036-detectar-referencias-rotas-tras-merge.md) |
| REQ-037 | requirement | Daemon único por proyecto | active | - | declared-doc | [REQ-037-daemon-unico-por-proyecto.md](../../../docs/system/requirements/REQ-037-daemon-unico-por-proyecto.md) |
| REQ-038 | requirement | Búsqueda léxica | active | - | declared-doc | [REQ-038-busqueda-lexica.md](../../../docs/system/requirements/REQ-038-busqueda-lexica.md) |
| REQ-039 | requirement | Renombrar id con reescritura de referencias | active | - | declared-doc | [REQ-039-renombrar-id-con-reescritura-de-referencias.md](../../../docs/system/requirements/REQ-039-renombrar-id-con-reescritura-de-referencias.md) |
| REQ-040 | requirement | Explorar y ajustar layout de diagramas de secuencia | active | - | declared-doc | [REQ-040-explorar-y-ajustar-layout-de-diagramas-de-secuencia.md](../../../docs/system/requirements/REQ-040-explorar-y-ajustar-layout-de-diagramas-de-secuencia.md) |
| VAL-001 | validation | Conformidad con el JSON Schema del formato | active | none | declared-doc | [VAL-001-conformidad-con-el-json-schema-del-formato.md](../../../docs/system/domain/validations/VAL-001-conformidad-con-el-json-schema-del-formato.md) |
| VAL-002 | validation | Unicidad y formato de IDs de elemento | active | none | declared-doc | [VAL-002-unicidad-y-formato-de-ids-de-elemento.md](../../../docs/system/domain/validations/VAL-002-unicidad-y-formato-de-ids-de-elemento.md) |
| VAL-003 | validation | Integridad referencial de idref | active | none | declared-doc | [VAL-003-integridad-referencial-de-idref.md](../../../docs/system/domain/validations/VAL-003-integridad-referencial-de-idref.md) |
| VAL-004 | validation | Versión de formato soportada | active | none | declared-doc | [VAL-004-version-de-formato-soportada.md](../../../docs/system/domain/validations/VAL-004-version-de-formato-soportada.md) |
| VAL-005 | validation | Coherencia del layout | active | none | declared-doc | [VAL-005-coherencia-del-layout.md](../../../docs/system/domain/validations/VAL-005-coherencia-del-layout.md) |
| VAL-006 | validation | Integridad de archivo | active | none | declared-doc | [VAL-006-integridad-de-archivo.md](../../../docs/system/domain/validations/VAL-006-integridad-de-archivo.md) |
| VAL-007 | validation | Reglas semánticas del modelo derivadas de UMJ | active | none | inferred | [VAL-007-reglas-semanticas-del-modelo-derivadas-de-umj.md](../../../docs/system/domain/validations/VAL-007-reglas-semanticas-del-modelo-derivadas-de-umj.md) |

## Relaciones

- `API-001 consumers ACT-002`
- `API-001 entities ENT-002`
- `API-001 entities ENT-003`
- `API-001 entities ENT-004`
- `API-001 validations VAL-001`
- `API-001 validations VAL-002`
- `API-001 validations VAL-003`
- `API-001 validations VAL-006`
- `API-001 validations VAL-007`
- `API-002 consumers ACT-001`
- `API-002 entities ENT-002`
- `API-002 entities ENT-004`
- `API-002 entities ENT-005`
- `API-002 validations VAL-005`
- `API-003 consumers ACT-001`
- `API-003 consumers ACT-002`
- `API-003 entities ENT-001`
- `DEC-001 affects REQ-001`
- `DEC-001 affects REQ-002`
- `DEC-001 affects NFR-001`
- `DEC-001 affects NFR-008`
- `DEC-001 affects FEAT-001`
- `DEC-001 affects ENT-001`
- `DEC-001 affects API-003`
- `DEC-002 affects REQ-005`
- `DEC-002 affects REQ-009`
- `DEC-002 affects REQ-010`
- `DEC-002 affects REQ-013`
- `DEC-002 affects REQ-021`
- `DEC-002 affects NFR-003`
- `DEC-002 affects NFR-011`
- `DEC-002 affects VAL-001`
- `DEC-002 affects VAL-004`
- `DEC-002 affects VAL-005`
- `DEC-002 affects VAL-007`
- `DEC-002 affects FEAT-003`
- `DEC-002 affects ENT-001`
- `DEC-002 affects ENT-002`
- `DEC-002 affects ENT-003`
- `DEC-002 affects ENT-004`
- `DEC-002 affects ENT-005`
- `DEC-003 affects REQ-023`
- `DEC-003 affects REQ-035`
- `DEC-003 affects REQ-039`
- `DEC-003 affects VAL-002`
- `DEC-003 affects VAL-003`
- `DEC-003 affects ENT-003`
- `DEC-003 affects FEAT-006`
- `DEC-004 affects REQ-006`
- `DEC-004 affects REQ-007`
- `DEC-004 affects REQ-008`
- `DEC-004 affects REQ-011`
- `DEC-004 affects REQ-017`
- `DEC-004 affects REQ-018`
- `DEC-004 affects REQ-019`
- `DEC-004 affects REQ-022`
- `DEC-004 affects REQ-026`
- `DEC-004 affects NFR-005`
- `DEC-004 affects NFR-007`
- `DEC-004 affects FEAT-002`
- `DEC-004 affects FEAT-004`
- `DEC-004 affects FEAT-008`
- `DEC-005 affects REQ-001`
- `DEC-005 affects REQ-003`
- `DEC-005 affects REQ-004`
- `DEC-005 affects REQ-037`
- `DEC-005 affects NFR-004`
- `DEC-005 affects NFR-005`
- `DEC-005 affects NFR-006`
- `DEC-005 affects FEAT-001`
- `DEC-005 affects API-001`
- `DEC-005 affects API-002`
- `DEC-005 affects API-003`
- `DEC-006 affects REQ-028`
- `DEC-006 affects REQ-029`
- `DEC-006 affects REQ-032`
- `DEC-006 affects REQ-040`
- `DEC-006 affects NFR-009`
- `DEC-006 affects FEAT-007`
- `DEC-006 affects FEAT-009`
- `DEC-006 affects API-002`
- `DEC-007 affects REQ-016`
- `DEC-007 affects REQ-020`
- `DEC-007 affects REQ-038`
- `DEC-007 affects NFR-002`
- `DEC-007 affects ACT-004`
- `DEC-007 affects FEAT-004`
- `DEC-007 affects FEAT-005`
- `ENT-001 validations VAL-001`
- `ENT-001 validations VAL-004`
- `ENT-001 validations VAL-006`
- `ENT-002 related ENT-003`
- `ENT-002 related ENT-004`
- `ENT-002 validations VAL-001`
- `ENT-002 validations VAL-002`
- `ENT-002 validations VAL-003`
- `ENT-002 validations VAL-006`
- `ENT-002 validations VAL-007`
- `ENT-003 validations VAL-001`
- `ENT-003 validations VAL-002`
- `ENT-003 validations VAL-003`
- `ENT-003 validations VAL-007`
- `ENT-004 related ENT-003`
- `ENT-004 validations VAL-001`
- `ENT-004 validations VAL-002`
- `ENT-004 validations VAL-003`
- `ENT-005 related ENT-004`
- `ENT-005 validations VAL-001`
- `ENT-005 validations VAL-005`
- `ENT-005 validations VAL-006`
- `FEAT-001 depends_on FEAT-002`
- `FEAT-001 entities ENT-001`
- `FEAT-001 interfaces API-003`
- `FEAT-002 depends_on FEAT-003`
- `FEAT-002 entities ENT-001`
- `FEAT-002 entities ENT-002`
- `FEAT-002 entities ENT-003`
- `FEAT-002 entities ENT-004`
- `FEAT-002 entities ENT-005`
- `FEAT-003 entities ENT-001`
- `FEAT-003 entities ENT-002`
- `FEAT-003 entities ENT-003`
- `FEAT-003 entities ENT-004`
- `FEAT-003 entities ENT-005`
- `FEAT-004 depends_on FEAT-002`
- `FEAT-004 interfaces API-001`
- `FEAT-005 depends_on FEAT-004`
- `FEAT-005 interfaces API-001`
- `FEAT-006 depends_on FEAT-001`
- `FEAT-006 depends_on FEAT-002`
- `FEAT-006 entities ENT-002`
- `FEAT-006 entities ENT-003`
- `FEAT-006 entities ENT-004`
- `FEAT-006 interfaces API-001`
- `FEAT-007 depends_on FEAT-001`
- `FEAT-007 depends_on FEAT-002`
- `FEAT-007 entities ENT-004`
- `FEAT-007 entities ENT-005`
- `FEAT-007 interfaces API-002`
- `FEAT-008 depends_on FEAT-002`
- `FEAT-008 depends_on FEAT-003`
- `FEAT-009 depends_on FEAT-007`
- `FEAT-009 depends_on FEAT-008`
- `FEAT-009 entities ENT-004`
- `FEAT-009 entities ENT-005`
- `FEAT-009 interfaces API-002`
- `REQ-001 actors ACT-001`
- `REQ-001 constraints NFR-001`
- `REQ-001 constraints NFR-006`
- `REQ-001 features FEAT-001`
- `REQ-002 actors ACT-001`
- `REQ-002 actors ACT-002`
- `REQ-002 constraints VAL-004`
- `REQ-002 features FEAT-001`
- `REQ-003 actors ACT-002`
- `REQ-003 constraints NFR-004`
- `REQ-003 constraints NFR-010`
- `REQ-003 depends_on REQ-037`
- `REQ-003 features FEAT-001`
- `REQ-003 features FEAT-004`
- `REQ-003 features FEAT-006`
- `REQ-004 actors ACT-001`
- `REQ-004 constraints NFR-004`
- `REQ-004 depends_on REQ-037`
- `REQ-004 features FEAT-001`
- `REQ-004 features FEAT-007`
- `REQ-005 constraints NFR-003`
- `REQ-005 features FEAT-002`
- `REQ-005 features FEAT-003`
- `REQ-006 constraints NFR-007`
- `REQ-006 constraints VAL-006`
- `REQ-006 features FEAT-002`
- `REQ-007 actors ACT-001`
- `REQ-007 actors ACT-003`
- `REQ-007 constraints NFR-005`
- `REQ-007 constraints NFR-007`
- `REQ-007 depends_on REQ-006`
- `REQ-007 features FEAT-002`
- `REQ-008 constraints NFR-006`
- `REQ-008 features FEAT-002`
- `REQ-009 constraints NFR-009`
- `REQ-009 constraints VAL-001`
- `REQ-009 features FEAT-003`
- `REQ-010 constraints VAL-005`
- `REQ-010 constraints NFR-003`
- `REQ-010 features FEAT-003`
- `REQ-011 constraints VAL-001`
- `REQ-011 constraints VAL-002`
- `REQ-011 constraints VAL-003`
- `REQ-011 constraints VAL-004`
- `REQ-011 constraints VAL-005`
- `REQ-011 constraints VAL-006`
- `REQ-011 constraints VAL-007`
- `REQ-011 features FEAT-003`
- `REQ-011 features FEAT-002`
- `REQ-012 actors ACT-001`
- `REQ-012 actors ACT-002`
- `REQ-012 depends_on REQ-011`
- `REQ-012 features FEAT-003`
- `REQ-012 features FEAT-001`
- `REQ-013 constraints NFR-011`
- `REQ-013 features FEAT-003`
- `REQ-014 actors ACT-002`
- `REQ-014 features FEAT-004`
- `REQ-015 actors ACT-002`
- `REQ-015 constraints VAL-002`
- `REQ-015 features FEAT-004`
- `REQ-016 actors ACT-002`
- `REQ-016 features FEAT-004`
- `REQ-017 actors ACT-002`
- `REQ-017 features FEAT-004`
- `REQ-018 actors ACT-002`
- `REQ-018 depends_on REQ-017`
- `REQ-018 features FEAT-004`
- `REQ-019 actors ACT-002`
- `REQ-019 depends_on REQ-017`
- `REQ-019 features FEAT-004`
- `REQ-020 actors ACT-002`
- `REQ-020 actors ACT-004`
- `REQ-020 constraints NFR-002`
- `REQ-020 depends_on REQ-038`
- `REQ-020 features FEAT-005`
- `REQ-021 actors ACT-002`
- `REQ-021 constraints VAL-002`
- `REQ-021 features FEAT-006`
- `REQ-022 actors ACT-002`
- `REQ-022 constraints VAL-006`
- `REQ-022 features FEAT-002`
- `REQ-023 actors ACT-002`
- `REQ-023 constraints VAL-001`
- `REQ-023 constraints VAL-002`
- `REQ-023 constraints VAL-003`
- `REQ-023 constraints NFR-005`
- `REQ-023 features FEAT-006`
- `REQ-024 actors ACT-002`
- `REQ-024 constraints VAL-003`
- `REQ-024 features FEAT-006`
- `REQ-025 actors ACT-002`
- `REQ-025 constraints VAL-003`
- `REQ-025 features FEAT-006`
- `REQ-026 actors ACT-002`
- `REQ-026 constraints NFR-005`
- `REQ-026 depends_on REQ-011`
- `REQ-026 features FEAT-006`
- `REQ-026 features FEAT-002`
- `REQ-027 actors ACT-002`
- `REQ-027 features FEAT-006`
- `REQ-028 actors ACT-001`
- `REQ-028 constraints NFR-007`
- `REQ-028 depends_on REQ-004`
- `REQ-028 features FEAT-007`
- `REQ-029 actors ACT-001`
- `REQ-029 constraints VAL-005`
- `REQ-029 constraints NFR-005`
- `REQ-029 depends_on REQ-010`
- `REQ-029 depends_on REQ-028`
- `REQ-029 features FEAT-007`
- `REQ-030 actors ACT-001`
- `REQ-030 depends_on REQ-007`
- `REQ-030 features FEAT-007`
- `REQ-031 actors ACT-001`
- `REQ-031 depends_on REQ-028`
- `REQ-031 features FEAT-007`
- `REQ-032 actors ACT-001`
- `REQ-032 features FEAT-007`
- `REQ-033 actors ACT-001`
- `REQ-033 depends_on REQ-012`
- `REQ-033 features FEAT-007`
- `REQ-034 actors ACT-003`
- `REQ-034 constraints VAL-006`
- `REQ-034 features FEAT-008`
- `REQ-035 actors ACT-003`
- `REQ-035 constraints VAL-002`
- `REQ-035 features FEAT-008`
- `REQ-036 actors ACT-003`
- `REQ-036 constraints VAL-003`
- `REQ-036 features FEAT-008`
- `REQ-037 actors ACT-001`
- `REQ-037 actors ACT-002`
- `REQ-037 constraints NFR-004`
- `REQ-037 constraints NFR-005`
- `REQ-037 features FEAT-001`
- `REQ-038 actors ACT-002`
- `REQ-038 constraints NFR-002`
- `REQ-038 features FEAT-004`
- `REQ-039 actors ACT-002`
- `REQ-039 constraints VAL-002`
- `REQ-039 constraints VAL-003`
- `REQ-039 depends_on REQ-026`
- `REQ-039 features FEAT-006`
- `REQ-039 features FEAT-002`
- `REQ-040 actors ACT-001`
- `REQ-040 constraints VAL-005`
- `REQ-040 constraints VAL-007`
- `REQ-040 depends_on REQ-028`
- `REQ-040 depends_on REQ-029`
- `REQ-040 features FEAT-009`
