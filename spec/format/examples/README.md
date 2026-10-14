# Ejemplos del formato 1.0

Corpus de prueba del validador y del serializador (PLAN-002 S4). Todos los archivos `.json` válidos
están en forma canónica (§9 de la spec), salvo `canonical/input/`.

| Directorio | Contenido | Resultado esperado |
|------------|-----------|--------------------|
| `valid/garaje/knowledge/` | `knowledge/` completo: manifiesto, dos modelos (`garaje` usa tipos primitivos del modelo `tipos` por ID global), tres diagramas y dos layouts. Incluye: paquete, actor, clase, interfaz, data type, enumeración, tipo primitivo, atributo (con los seis indicadores), operación, parámetro (`in`, `out`, `inout`), asociación (las tres variantes, dirigida y no dirigida), generalización, dependencia, realización, interacción, lifeline (también con nombre vacío), mensajes de los seis `sort` y los cuatro `kind` (incluida llamada síncrona sin respuesta), occurrence specification, combined fragment anidado con varios operandos, interaction use, diagramas de clases y secuencia, layout con `style` completo y vértices, y las cinco extensiones (§7). No incluye todos los valores de `operator` ni de `visibility`. | sin errores ni avisos; leer y reescribir no produce diferencias |
| `invalid/<caso>/knowledge/` | un `knowledge/` mínimo con un único defecto | exactamente el conjunto de códigos de `invalid/<caso>/expected.json` (errores y avisos; sin contar repeticiones) |
| `canonical/input/` → `canonical/expected/` | documento válido con claves desordenadas, `null`, colecciones vacías y conjuntos sin ordenar | reescribir `input` produce byte a byte `expected` |

La existencia de rutas de `code_refs` (`CODE_REF_MISSING`) depende del repositorio anfitrión: el corpus
se evalúa sin esa comprobación (las rutas del ejemplo no existen en este repositorio).

`expected.json`: `{"description": "...", "codes": ["CODIGO", ...]}`: **conjunto** de códigos de la §10.4, sin repetir y
ordenado. `PATH_OUTSIDE_KNOWLEDGE` no tiene caso estático (requiere un enlace simbólico o una ruta pedida por API): se prueba en
S4/S7 con fixtures generados. `CODE_REF_MISSING` tampoco (ver arriba).

El modelo `garaje` reexpresa con palabras y estructura propias el ejemplo *Car* del paper UMJ (§1 de la
spec) y lo amplía; no copia su listado.
