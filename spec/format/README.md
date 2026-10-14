# Formato de conocimiento ai-submind · versión 1.0

Especificación normativa del contenido de `knowledge/` que gestiona ai-submind. Los JSON Schema
2020-12 de [`schema/1.0/`](schema/1.0/) son la fuente canónica de la **estructura** (claves, tipos,
enumeraciones y orden de claves); este documento es la fuente canónica de la **semántica**
(identificadores, referencias, reglas de coherencia, serialización canónica y versionado).

Las palabras **debe**, **no debe** y **puede** son normativas.

## 1. Origen y cita

El formato se deriva de UMJ (*UML JSON*), propuesto en:

> Malanowska, A. y Pawłowski, F. (2026). *Unifying Non-Uniform Formats of UML Model Interchange Using
> JSON*. Proceedings of the 21st International Conference on Evaluation of Novel Approaches to Software
> Engineering (ENASE 2026), pp. 394–401. SciTePress. DOI
> [10.5220/0014828700004015](https://doi.org/10.5220/0014828700004015).

Ese trabajo se publica bajo CC BY-NC-ND 4.0; esta especificación no reproduce su texto ni sus tablas:
toma sus ideas (identificadores con `id` y referencias `{"idref": ...}`, el modelo como raíz y dueño de
las relaciones, el orden de eventos de una interacción dado por el orden del array, los diagramas como
conjuntos de referencias) y las redefine con palabras propias, adaptadas a ai-submind. Las diferencias
se listan en la §12. Decisiones del producto que la sustentan: DEC-002 (formato) y DEC-003 (IDs).

## 2. Estructura de `knowledge/`

```
knowledge/
  ai-submind.json             # manifiesto (§5)
  models/<model-id>.json      # un archivo por modelo (§6)
  layout/<diagram-id>.json    # un archivo por diagrama con layout (§8)
  .ai-submind/                # derivados locales; ignorado por git y por el validador
```

- El nombre de cada archivo de modelo **debe** ser `<id del modelo>.json`; el de layout,
  `<id del diagrama>.json` (`FILE_ID_MISMATCH`).
- Cualquier otro archivo o directorio fuera de `.ai-submind/` produce el aviso `UNKNOWN_FILE`.
- Todos los archivos son JSON en UTF-8 sin BOM (§9).

## 3. Identificadores

### 3.1 Gramática

Hay dos clases de ID, ambas en un **único espacio de nombres global** para todo `knowledge/`: no puede
haber dos elementos, modelos ni diagramas con el mismo `id`, aunque estén en archivos distintos
(`ID_DUPLICATE`). La comparación distingue mayúsculas.

| Clase | Usada por | Expresión regular (ECMA-262, flag `u`) | Longitud |
|-------|-----------|----------------------------------------|----------|
| ID de archivo | modelos y diagramas | `^[a-z0-9]+(-[a-z0-9]+)*$` | 1..64 |
| ID de elemento | todo lo demás | `^[\p{L}\p{N}_$]([\p{L}\p{N}_$().-]*[\p{L}\p{N}_$)])?$`, sin `..` | 1..256 |

- Los ID de archivo se limitan a ASCII en minúsculas porque nombran archivos (sistemas de archivos que no
  distinguen mayúsculas, portabilidad entre sistemas operativos).
- Los caracteres `:`, `/`, `#`, `@` y los espacios quedan reservados para usos futuros
  (p. ej. caminos o referencias cualificadas) y no se admiten.
- Todo ID de archivo cumple también la gramática de ID de elemento.

### 3.2 Estabilidad

- El `id` es estable: cambiar `name` **no** cambia el `id`.
- Cambiar un `id` solo es válido mediante la operación `rename` del motor, que reescribe en una sola
  transacción todas las referencias (modelos, diagramas, claves de layout y nombres de archivo).
  Una edición manual que cambie un `id` deja referencias rotas que el validador informa; nunca se
  reparan en silencio.
- Reglas de `rename(viejo, nuevo)`:
  - **Ámbito**: también se renombran los ID que empiezan por `viejo.` (atributos, operaciones, parámetros,
    extremos, lifelines, mensajes, fragmentos…), sustituyendo ese prefijo por `nuevo.`. Los ID de relaciones
    derivados que mencionan `viejo` en otra posición (p. ej. `Truck--extends--Car`) **no** cambian: son
    estables y opacos tras su creación.
  - **Colisión**: si `nuevo` o cualquier ID resultante ya existe, la operación falla (`RENAME_COLLISION`) y
    no escribe nada.
  - **Bloqueo**: si algún documento de `knowledge/` no está cargado como escribible (`conflicted`,
    `invalid_parse`, `SCHEMA_VIOLATION` o solo lectura por versión), la operación falla
    (`RENAME_BLOCKED`): no puede garantizarse que no contenga referencias.
  - `nuevo` debe cumplir la gramática de su clase de ID (§3.1).
- Los identificadores de herramientas externas (importaciones) se conservan en `external_id` (§7.1).

### 3.3 Derivación (normativa para el motor al crear elementos sin `id` explícito)

Funciones auxiliares:

- `seg(texto)`: normaliza a NFC, sustituye cada secuencia de espacios en blanco por `_`, elimina los
  caracteres que no sean letra (`\p{L}`), dígito (`\p{N}`), `_`, `$` o `-`, y recorta los `-` del final;
  si el resultado está vacío o empieza por `-`, antepone `_`.
- `slug(texto)`: descompone en NFD, elimina diacríticos, pasa a minúsculas, sustituye cada secuencia de
  caracteres fuera de `[a-z0-9]` por `-`, trunca a 64 caracteres y después recorta los `-` de los extremos.
- Todo ID se escribe en NFC; la gramática (§3.1) rechaza marcas combinantes sueltas, por lo que un ID en NFD
  falla la validación de schema.
- Si un ID compuesto supera 256 caracteres, se trunca su último segmento derivado (sin tocar `()` ni el
  prefijo del dueño) hasta que quepa, contando el posible sufijo de colisión, y se recortan los `-` finales.

| Elemento | ID derivado | Ejemplo |
|----------|-------------|---------|
| modelo, diagrama | `slug(name)` (vacío → `model` / `diagram`) | `garaje`, `vista-general` |
| paquete, actor, clase, interfaz, data type, enumeración, primitive type, interacción | `seg(name)` | `Car`, `RentCar` |
| atributo | `<dueño>.<seg(name)>` | `Car.yearOfProduction` |
| operación | `<dueño>.<seg(name)>()` | `Car.start()` |
| parámetro | `<operación>.<seg(name)>` | `Car.refuel().liters` |
| asociación con nombre / sin nombre | `seg(name)` / `<end1.element>--<end2.element>` | `Garage--Car` |
| extremos de asociación | `<asociación>.end1`, `<asociación>.end2` | `Garage--Car.end1` |
| generalización | `<specific>--extends--<general>` | `Truck--extends--Car` |
| realización | `<client>--implements--<supplier>` | `Car--implements--Drivable` |
| dependencia con nombre / sin nombre | `seg(name)` / `<client>--uses--<supplier>` | `Garage--uses--Mechanic` |
| lifeline | `<interacción>.<seg(name)>` (nombre vacío → `seg` del nombre del clasificador representado, o `lifeline`) | `RentCar.car` |
| mensaje | `<interacción>.<seg(name)>` (vacío → `msg`) | `RentCar.start` |
| occurrence specification de un mensaje | `<mensaje>.send` / `<mensaje>.receive` | `RentCar.start.send` |
| otra occurrence specification | `<interacción>.occ` | |
| combined fragment | `<interacción>.<operator>` | `RentCar.opt` |
| interaction operand | `<fragmento>.op<n>` (n = posición al crearlo, desde 1; no se renumera) | `RentCar.opt.op1` |
| interaction use | `<interacción>.ref--<interacción usada>` | `RentCar.ref--Payment` |

Colisiones: si el ID derivado ya existe, se añade `-2`, `-3`, … (el menor libre) al final del último
segmento, antes de `()` si lo hay: `Car-2`, `Car.start-2()`. La derivación solo se aplica al crear; nunca
se recalcula.

## 4. Referencias

- Una referencia es siempre un objeto `{"idref": "<id>"}` y nada más. Esta forma uniforme permite encontrar
  todas las referencias de un documento sin conocer su tipo (lo usa `rename`).
- Toda referencia **debe** resolver a un `id` existente en `knowledge/` (`REF_UNRESOLVED`) y de un tipo
  admitido por la clave que la contiene (`REF_TYPE_MISMATCH`; tabla en §10.2).
- Como los ID son globales, una referencia puede apuntar a un elemento de **otro modelo** sin sintaxis
  adicional (p. ej. tipos primitivos compartidos en un modelo `tipos`).
- Las claves de los mapas de layout (§8) son ID, no objetos `idref`; `rename` también las reescribe.

## 5. Manifiesto `ai-submind.json`

Schema: [`ai-submind.schema.json`](schema/1.0/ai-submind.schema.json).

| Clave | Tipo | Oblig. | Significado |
|-------|------|--------|-------------|
| `format_version` | texto `MAYOR.MENOR` | sí | versión del formato del manifiesto (§11) |
| `name` | texto | no | nombre legible del proyecto de conocimiento |
| `documentation` | texto | no | descripción libre en Markdown |

Su presencia indica que `knowledge/` está inicializado. `ai-submind init` lo crea y nunca lo sobrescribe.

## 6. Modelo (`models/<model-id>.json`)

Schema: [`model.schema.json`](schema/1.0/model.schema.json). Las tablas resumen la semántica; tipos,
obligatoriedad y orden exacto de claves están en el schema.

### 6.1 Convenciones comunes

- **Elemento con nombre**: lleva `name` (texto no vacío, salvo en lifelines y mensajes, donde puede estar vacío) y, si el schema lo
  exige, `visibility` ∈ `public`, `private`, `protected`, `package`.
- **Valor desconocido**: un campo opcional ausente significa *no especificado*. No se imponen valores por
  defecto (un `is_static` ausente no significa `false`). El lector acepta también `null` explícito con el
  mismo significado; la serialización canónica lo omite (§9).
- **Colecciones**: una colección ausente equivale a vacía; la serialización canónica omite las vacías.
- **Multiplicidad**: texto `n`, `n..m`, `n..*` o `*` con `n ≤ m` (p. ej. `1`, `0..1`, `1..*`).
- **Extensiones** (todo elemento con `id`, el modelo y los diagramas): ver §7.

### 6.2 Raíz del modelo

| Clave | Contenido |
|-------|-----------|
| `format_version` | versión del formato (§11) |
| `id`, `name`, `visibility` | ID de archivo, nombre, visibilidad opcional |
| `elements` | objeto con las colecciones de la tabla 6.3; el modelo es dueño de todos sus elementos y relaciones |
| `diagrams` | lista de diagramas (§6.6) |

### 6.3 Colecciones de `elements`

| Clave | Elemento | Contenido propio |
|-------|----------|------------------|
| `packages` | paquete | `members`: referencias a elementos de primer nivel que agrupa (no los posee) |
| `actors` | actor | solo nombre (extensión: UMJ no tiene actores; se usan en lifelines y futuros casos de uso) |
| `classes` | clase | `is_abstract`, `attributes`, `operations` |
| `interfaces` | interfaz | `attributes`, `operations` |
| `data_types` | data type | `attributes`, `operations` |
| `enumerations` | enumeración | `literals`: lista ordenada de textos únicos |
| `primitive_types` | tipo primitivo | `kind`: texto libre opcional con el tipo base de origen |
| `associations` | asociación | `type` ∈ `association`, `aggregation`, `composition`; `direction` ∈ `directed`, `undirected`; `end1`, `end2` |
| `generalizations` | generalización | `specific` (hijo), `general` (padre) |
| `dependencies` | dependencia | `client` (depende), `supplier` (de quién depende), `name` opcional |
| `realizations` | realización | `client` (clasificador que implementa), `supplier` (interfaz) |
| `interactions` | interacción | `lifelines`, `messages`, `fragments` (§6.5) |

### 6.4 Características de clasificadores

| Elemento | Contenido |
|----------|-----------|
| atributo | `type` (ref), `multiplicity`, `default_value` (texto), indicadores `is_static`, `is_ordered`, `is_unique`, `is_read_only`, `is_derived`, `is_derived_union` |
| operación | `parameters` (ordenada), `return_type` (ref), `exceptions` (refs), indicadores `is_static`, `is_abstract`, `is_query` |
| parámetro | `direction` ∈ `in`, `out`, `inout`; `type` (ref), `multiplicity`, `default_value` |
| extremo de asociación | `element` (ref, obligatorio), `role`, `multiplicity`, `navigability` (booleano), `visibility` |

Reglas:
- Una asociación `directed` va de `end1` a `end2`.
- En `aggregation` y `composition`, `end1` es el todo (lado del rombo) y `end2` la parte.
- Las listas `attributes`, `operations`, `parameters` y `literals` son **ordenadas**: su orden es el de
  presentación y no se reordena.

### 6.5 Interacciones (secuencia)

| Elemento | Contenido |
|----------|-----------|
| lifeline | `name`, `represents` (ref opcional a clasificador o actor) |
| mensaje | `name`, `sort`, `kind`, `arguments` (textos), `send_event`, `receive_event` (refs a occurrence specifications), `signature` (ref a operación) |
| fragmento `occurrence` | `covered`: ref a una lifeline |
| fragmento `combined_fragment` | `name` opcional, `operator`, `covered` (refs a lifelines), `operands` (ordenados) |
| interaction operand | `guard` (texto opcional), `fragments` (ordenados) |
| fragmento `interaction_use` | `name` opcional, `covered` (refs a lifelines), `interaction` (ref), `arguments` |

- `sort` ∈ `synch_call`, `asynch_call`, `asynch_signal`, `create_message`, `delete_message`, `reply`.
- `kind` ∈ `complete` (exige `send_event` y `receive_event`), `lost` (solo `send_event`),
  `found` (solo `receive_event`), `unknown` (sin restricción).
- `operator` ∈ `alt`, `opt`, `par`, `loop`, `critical`, `neg`, `assert`, `strict`, `seq`, `ignore`,
  `consider`, `break`. Los límites de `loop` se expresan en `guard` (p. ej. `[1..3]`).
- Cada fragmento declara su clase en `type`. En cada instante ocurre un solo evento: el **orden de
  `fragments`** (en la interacción y en cada operando) es el orden temporal y **no se reordena**.
- `lifelines` es ordenada: su orden es el orden horizontal por defecto (el layout puede cambiarlo).
- `messages` es un conjunto (ordenado por `id`): el orden temporal lo dan sus occurrence specifications.
- Un mensaje síncrono sin respuesta es válido (no se exige `reply`).

### 6.6 Diagramas

| Clave | Contenido |
|-------|-----------|
| `id`, `name` | ID de archivo (nombra su layout) y nombre |
| `kind` | `class` o `sequence`; registro extensible por versión de formato |
| `elements` | referencias a los elementos mostrados (conjunto) |

- `class`: puede mostrar paquetes, actores, clases, interfaces, data types, enumeraciones, tipos
  primitivos, asociaciones, generalizaciones, dependencias y realizaciones (`DIAGRAM_ELEMENT_NOT_ALLOWED`).
  Atributos y operaciones se muestran con su clasificador.
- `sequence`: exactamente una interacción; muestra todas sus lifelines, mensajes y fragmentos.
- Un diagrama puede mostrar elementos de otros modelos (ID globales).

## 7. Extensiones propias

### 7.1 Metadatos de elemento

Admitidas en todo elemento con `id`, en el modelo y en los diagramas; siempre opcionales.

| Clave | Tipo | Uso |
|-------|------|-----|
| `stereotypes` | lista de textos únicos | estereotipos UML sin `«»` (p. ej. `entity`, `service`) |
| `tags` | lista de textos únicos | etiquetas libres para filtrar y buscar |
| `documentation` | texto Markdown | descripción para personas y agentes; entra en la búsqueda léxica |
| `code_refs` | lista de `{path, symbol?}` | enlaces al código del repositorio anfitrión |
| `external_id` | texto | ID original en una herramienta externa (DEC-003) |

`code_refs[].path` es una ruta relativa a la raíz del repositorio con `/` como separador y sin barra final;
no puede empezar por `/` ni `~`, contener `:`, `\`, caracteres de control, segmentos vacíos (`//`) ni
segmentos `.` o `..` (`CODE_REF_INVALID`). Los errores de schema dentro de `code_refs[].path` se informan
con el código `CODE_REF_INVALID` en lugar de `SCHEMA_VIOLATION`. Si la ruta no existe se emite el aviso
`CODE_REF_MISSING` (no bloquea: el código evoluciona por separado). `symbol` es opcional y libre
(nombre de clase, función, etc.).

### 7.2 Layout

UMJ no define layout; ai-submind lo guarda aparte (§8) para que mover un nodo no ensucie el modelo.

## 8. Layout (`layout/<diagram-id>.json`)

Schema: [`layout.schema.json`](schema/1.0/layout.schema.json).

| Clave | Contenido |
|-------|-----------|
| `format_version` | versión (§11) |
| `diagram` | ref al diagrama; debe coincidir con el nombre del archivo |
| `nodes` | mapa `id → {x, y, width?, height?, style?}` |
| `edges` | mapa `id → {vertices?, style?}`; `vertices` es la lista ordenada de puntos intermedios |

- Coordenadas y tamaños son enteros en píxeles de diagrama, |valor| ≤ 10 000 000; tamaños ≥ 1.
- `style` admite `fill`, `stroke` y `text` como color `#rrggbb` en minúsculas.
- Diagrama `class`: claves de `nodes` = paquetes, actores y clasificadores mostrados; claves de `edges` =
  relaciones mostradas. Diagrama `sequence`: claves de `nodes` = lifelines (`x` y `width` fijan su
  posición horizontal, `y` la cabecera, `height` la longitud); claves de `edges` = mensajes.
- Una clave que no corresponde a un elemento mostrado es el aviso `LAYOUT_ORPHAN`, no un error.
- Un elemento mostrado sin entrada de layout se coloca con el layout automático y no se persiste hasta que
  una persona lo mueve.
- El archivo no existe hasta la primera modificación del layout (REQ-010).

## 9. Serialización canónica

Toda escritura del motor produce exactamente esta forma; leer y volver a escribir un documento canónico no
produce diferencias.

1. UTF-8 sin BOM, fin de línea LF, salto de línea final, indentación de 2 espacios, separador `": "`;
   sin espacios finales. Cada clave y cada elemento de array en su propia línea, salvo las referencias,
   que se escriben en una sola línea: `{"idref": "Car"}`. Arrays y objetos vacíos que deban escribirse
   (obligatorios) se escriben `[]` / `{}`.
2. Orden de claves: el orden de `properties` en el schema del objeto; para un fragmento, el del subschema
   concreto según su `type` (`occurrence`, `combinedFragment`, `interactionUse`). En mapas (`nodes`,
   `edges`), claves ordenadas por punto de código.
3. Se omiten las claves no obligatorias cuyo valor sea `null`, texto vacío (`""`), array vacío u objeto
   vacío (incluidas las entradas vacías de `nodes`/`edges`). Las obligatorias se escriben siempre
   (p. ej. `"name": ""` en una lifeline).
4. Arrays **ordenados** (orden significativo, se conservan): `attributes`, `operations`, `parameters`,
   `literals`, `lifelines`, `fragments`, `operands`, `arguments`, `exceptions`, `vertices`.
5. Arrays **conjunto** (se ordenan): colecciones de `elements`, `diagrams`, `messages` y las listas de
   referencias `members`, `covered` y diagrama `elements` por `id`/`idref` en orden de punto de código;
   `stereotypes` y `tags` por valor; `code_refs` por `path` y luego `symbol` (sin `symbol` va primero).
   "Orden de punto de código" compara las cadenas por unidades UTF-16, como el operador `<` de ECMAScript.
6. Números: enteros sin parte decimal ni exponente.
7. Texto: el escape de `JSON.stringify` de ECMAScript: `\"`, `\\`, `\b`, `\f`, `\n`, `\r`, `\t`; los
   demás caracteres de control U+0000–U+001F como `\u00xx` con hexadecimal en minúsculas; sustitutos
   sueltos como `\udxxx`; el resto de Unicode (incluido U+007F) se escribe literal.

## 10. Validación

### 10.1 Fases

1. **Archivo** (VAL-006): ruta dentro de `knowledge/`, UTF-8, sin marcadores de conflicto de Git
   (líneas que empiezan por `<<<<<<<`, `=======` o `>>>>>>>`), JSON sintácticamente válido.
2. **Versión** (VAL-004, §11).
3. **Schema** (VAL-001): JSON Schema 2020-12 de la versión del documento.
4. **Referencial y semántica** (VAL-002, VAL-003, VAL-005, VAL-007) sobre el conjunto de `knowledge/`.

Reglas entre fases:
- Un error de las fases 1 o 3 deja el documento **sin cargar**: no participa en la fase 4 ni en las
  consultas, y las referencias a ID que solo existían en él se informan como `REF_UNRESOLVED`. El resto de
  documentos sigue cargándose (REQ-036).
- `FORMAT_VERSION_UNSUPPORTED` (fase 2) no detiene la carga: el documento pasa a **lectura tolerante**
  (§11), queda en solo lectura y sí participa en la fase 4 (cuenta para `ID_DUPLICATE` y como destino de
  referencias).
- `FORMAT_VERSION_OUTDATED` es un aviso: el documento se valida con el schema de su propia versión.
- Los avisos nunca impiden cargar ni escribir.

### 10.2 Tipos admitidos por referencia

"Clasificador" = clase, interfaz, data type, enumeración o tipo primitivo.

| Clave | Admite |
|-------|--------|
| `packages[].members` | paquete, actor, clasificador, asociación, generalización, dependencia, realización, interacción |
| `attributes[].type`, `parameters[].type`, `return_type`, `exceptions[]` | clasificador |
| `end1.element`, `end2.element` | clasificador o actor |
| `generalizations[].specific`, `.general` | clasificador o actor, ambos de la misma colección |
| `realizations[].client` / `.supplier` | clase o data type / interfaz |
| `dependencies[].client`, `.supplier` | cualquier elemento (no modelo ni diagrama) |
| `lifelines[].represents` | clasificador o actor |
| `messages[].send_event`, `.receive_event` | fragmento `occurrence` de la misma interacción |
| `messages[].signature` | operación |
| `covered` (cualquier fragmento) | lifeline de la misma interacción |
| `interaction_use.interaction` | interacción distinta de la que lo contiene |
| `diagrams[].elements` | según `kind` (§6.6) |
| layout `diagram` | diagrama |

### 10.3 Reglas semánticas

- Un elemento pertenece como máximo a un paquete; sin ciclos de paquetes (`PACKAGE_MEMBERSHIP`).
- Sin ciclos de generalización y `specific ≠ general` (`GENERALIZATION_CYCLE`).
- Eventos de mensaje según `kind` (§6.5) (`MESSAGE_EVENTS`); una occurrence specification es evento de
  como máximo un mensaje (`OCCURRENCE_REUSED`); la que no es evento de ningún mensaje genera el aviso
  `OCCURRENCE_UNUSED`.
- Multiplicidad con `n ≤ m` (`MULTIPLICITY_INVALID`).

### 10.4 Códigos

Formato del informe: `{code, severity, file, pointer, message}` con `pointer` en JSON Pointer (RFC 6901).

| Código | Severidad | Fase | Significado |
|--------|-----------|------|-------------|
| `PATH_OUTSIDE_KNOWLEDGE` | error | 1 | ruta fuera de `knowledge/` |
| `FILE_ENCODING` | error | 1 | no es UTF-8 o tiene BOM |
| `MERGE_CONFLICT` | error | 1 | marcadores de conflicto; documento `conflicted`, escrituras bloqueadas |
| `JSON_PARSE` | error | 1 | JSON inválido; documento `invalid_parse` |
| `FORMAT_VERSION_UNSUPPORTED` | error | 2 | versión mayor que la soportada; documento de solo lectura |
| `FORMAT_VERSION_OUTDATED` | aviso | 2 | versión anterior soportada; migración explícita disponible |
| `SCHEMA_VIOLATION` | error | 3 | no cumple el schema (incluye versión ausente o mal formada) |
| `UNKNOWN_FILE` | aviso | 1 | archivo no previsto en `knowledge/` |
| `FILE_ID_MISMATCH` | error | 4 | nombre de archivo ≠ `id` del modelo o `diagram` del layout |
| `ID_DUPLICATE` | error | 4 | `id` repetido en `knowledge/`; se informan todas las apariciones |
| `REF_UNRESOLVED` | error | 4 | referencia a un `id` inexistente |
| `REF_TYPE_MISMATCH` | error | 4 | referencia a un tipo no admitido (§10.2) |
| `DIAGRAM_ELEMENT_NOT_ALLOWED` | error | 4 | elemento no admitido por el `kind` del diagrama |
| `PACKAGE_MEMBERSHIP` | error | 4 | elemento en varios paquetes o ciclo de paquetes |
| `GENERALIZATION_CYCLE` | error | 4 | ciclo de generalización |
| `MESSAGE_EVENTS` | error | 4 | eventos incompatibles con `kind` del mensaje |
| `OCCURRENCE_REUSED` | error | 4 | occurrence specification usada por dos eventos |
| `OCCURRENCE_UNUSED` | aviso | 4 | occurrence specification sin mensaje |
| `MULTIPLICITY_INVALID` | error | 4 | límite inferior mayor que el superior |
| `CODE_REF_INVALID` | error | 3 | ruta de `code_refs` absoluta o con `..` / `\` |
| `CODE_REF_MISSING` | aviso | 4 | ruta de `code_refs` inexistente |
| `LAYOUT_ORPHAN` | aviso | 4 | entrada de layout de un elemento no mostrado |

Códigos de operación (API, no de validación): `AMBIGUOUS_ID` (consulta sobre un `id` duplicado),
`RENAME_COLLISION` y `RENAME_BLOCKED` (§3.2).

## 11. Versionado

- Cada archivo declara `format_version` = `MAYOR.MENOR`. Esta especificación define `1.0`.
- Un cambio **menor** solo añade claves o valores opcionales; un cambio **mayor** puede romper.
- Versión igual a la soportada → carga normal.
- Versión anterior soportada → carga con aviso `FORMAT_VERSION_OUTDATED`; solo se actualiza mediante una
  migración explícita (nunca al escribir por otro motivo).
- Versión posterior a la soportada (mayor o menor) → `FORMAT_VERSION_UNSUPPORTED`: el documento se carga
  siempre en **solo lectura** con **lectura tolerante**: se interpreta con el schema de la versión soportada
  más alta ignorando claves y valores desconocidos (no se informan como `SCHEMA_VIOLATION`); los elementos
  sin `id` válido o sin la forma mínima reconocible se descartan de las consultas. Toda escritura sobre el
  documento se rechaza, y también las operaciones que tendrían que modificarlo (p. ej. `rename`).
- Los documentos de `knowledge/` pueden tener versiones distintas entre sí; cada uno se evalúa por separado.

## 12. Diferencias respecto de UMJ

| UMJ | ai-submind 1.0 | Motivo |
|-----|----------------|--------|
| Un único documento con el modelo | un archivo por modelo + manifiesto + layout separado | diffs y merges en Git (DEC-002) |
| ID arbitrarios de la herramienta de origen | ID legibles, globales, con derivación determinista; el original va a `external_id` | legibilidad y consultas (DEC-003) |
| `null` explícito para valores desconocidos | ausencia (o `null`) = desconocido; la forma canónica omite | archivos compactos, mismo significado |
| La clase lista sus `generalizations` e `interfaces` además del modelo | solo en `generalizations`/`realizations` del modelo; las inversas las calcula el motor | una sola fuente; sin incoherencias |
| Paquete con `elements` por categorías | paquete con `members` (refs de cualquier tipo de primer nivel) | más simple; el tipo se resuelve por ID |
| `visibility` en todos los elementos con nombre | obligatoria en paquetes, clasificadores, interacciones, atributos y operaciones; opcional en modelo, actor, asociación y extremo de asociación; ausente en generalización, dependencia, realización, parámetro, lifeline, mensaje, fragmentos y diagramas | pertinente en UML; menos ruido |
| Indicadores de atributo también en operaciones | operación: `is_static`, `is_abstract`, `is_query` | solo los significativos |
| `exceptions` como textos | referencias a clasificadores | integridad referencial |
| Extremo de asociación con `name` y `role` | solo `role` | eran redundantes |
| Sin actores | colección `actors` | lifelines de actores y futuros casos de uso |
| Fragmentos distinguidos por su forma | clave `type` explícita | validación y errores precisos |
| `class_diagrams` / `sequence_diagrams` con refs por categoría | `diagrams` con `kind` y `elements` | registro extensible de tipos de diagrama |
| Diagrama de secuencia con varias interacciones | exactamente una | layout y render inequívocos |
| Diagramas con `visibility` y `description` | sin `visibility`; `documentation` | coherencia con las extensiones |
| Sin multiplicidad ni valor por defecto en atributos/parámetros | `multiplicity`, `default_value` | necesarios para clases útiles |
| Sin layout | `layout/<diagram-id>.json` | requisito del visor (REQ-010) |
| Agregación sin lado explícito | `end1` = todo | semántica inequívoca |

## 13. Ejemplos

[`examples/`](examples/README.md): un `knowledge/` válido completo (garaje: todas las construcciones) y
casos inválidos con el código esperado.
