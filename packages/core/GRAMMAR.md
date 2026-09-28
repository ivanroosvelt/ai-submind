# Gramática `.flo` (catálogo de entidades + bloques nombrados)

    Document     ::= (BlankLine | Use | EntityDecl | Block)* EOF
    BlankLine    ::= Newline
    Use          ::= "use" String Newline

    EntityDecl   ::= "entity" Ident Shape? PropList? EntityBody? Newline
    Shape        ::= "[" Text "]" | "(" Text ")" | "{" Text "}"
    PropList     ::= Prop ("," Prop)*
    Prop         ::= "type" ":" Ident | "tags" ":" Ident+
    EntityBody   ::= "{" Newline (PropList? Newline)* "}"

    Block        ::= ("flow" | "sequence") Ident String? "{" Newline BlockLine* "}" Newline
    BlockLine    ::= (Edge)? Newline
    Edge         ::= Ident "->" Ident (":" Text)?     (* en sequence ":" Text es obligatorio *)

    Ident        ::= (letra ASCII | "_") (letra ASCII | dígito | "_")*
    Text         ::= cualquier carácter excepto el delimitador de cierre
                      y el salto de línea; se recorta espacio inicial/final
    String       ::= '"' (carácter excepto '"' y newline)* '"'
    Comment      ::= "//" cualquier carácter hasta fin de línea
                      (se descarta antes de tokenizar, no genera token)

Un documento es una lista de declaraciones de nivel superior: entidades
(el catálogo) y bloques `flow`/`sequence` (las vistas). No hay header de
documento ni declaración de nodos dentro de un bloque — los nodos de un
bloque se derivan de las entidades que sus aristas referencian.

## Reglas léxicas y de parseo

- El lexer es pasivo: `next()`/`peek()` producen tokens de código simples
  (`LBRACKET`, `LPAREN`, `LBRACE`, `COLON`, `IDENT`, etc.) sin ningún
  efecto lateral. El modo texto lo pide explícitamente el *parser*,
  llamando a `lexer.readTextUntil(closer)`: después del delimitador de
  apertura de `Shape` y después de `:` en `Edge`. Fuera de esas llamadas
  explícitas, `[`, `(`, `{` y `:` son tokens comunes como cualquier otro.
- `entity`, `flow`, `sequence` y `use` son palabras clave **solo al
  inicio de una línea de nivel superior**; dentro de un bloque son
  identificadores comunes como cualquier otro (`flow -> entity` es una
  arista válida si ambos ids fueron declarados como entidades). Ninguna
  palabra es reservada en el lexer.
- `{` tras el id de una entidad es ambiguo entre abrir un cuerpo o la
  forma `{decisión}`: si el resto de la línea está vacío o es un
  comentario, abre el cuerpo (`EntityBody`); si no, es la forma. Se
  decide mirando la línea cruda (`Lexer.restOfLineIsBlank()`), no con
  heurísticas sobre el texto ya leído.
- Sin `Shape`, una entidad es válida: un rectángulo con su id como label.
- `type` admite un identificador; `tags`, uno o más (separados por
  espacio). Ambas propiedades pueden ir en línea (`type: x, tags: a b`) o
  dentro del cuerpo; dentro del cuerpo también pueden ir juntas en una
  misma línea separadas por `,` (`type: x, tags: a b`), o cada una en la
  suya. Una propiedad repetida es `E044`; una propiedad que no es `type`
  ni `tags` es `E034`.
- El `}` que cierra un bloque o el cuerpo de una entidad va en su propia
  línea.
- Un bloque solo contiene aristas; sus nodos se derivan de las entidades
  que referencia. Los ids de entidad son únicos en todo el workspace: la
  primera declaración de un id gana (documentos ordenados por uri, dentro
  de cada documento en orden de fuente) y las siguientes se reportan con
  `E031`. Cada documento ve un **catálogo alcanzable**: sus propias
  entidades más las de los documentos que nombra con `use`,
  transitivamente (los ciclos se cortan, no son error; repetir un `use` no
  hace nada). Toda referencia debe resolver a una entidad de ese catálogo,
  declarada antes o después en el archivo (`E030` si no resuelve; si la
  entidad existe en un documento no alcanzable, el mensaje lo nombra). Una
  ruta de `use` es relativa al documento que la declara (`/` inicial = la
  raíz del workspace); si sale de la raíz o no nombra un documento del
  workspace es `E032`. Los nombres de bloque son únicos dentro del
  documento (`E033` para los repetidos).
- Orden de nodos/columnas en el render: el orden del catálogo alcanzable
  (primero las entidades de los documentos usados, en post-orden de
  `use`; al final las del propio documento, en orden de declaración), no
  el orden en que aparecen en las aristas; las referencias sin resolver
  van al final, en orden de aparición, y se dibujan con trazo punteado.
- Recuperación de errores: una línea que no parsea se descarta sin
  escanear el resto de esa línea (no genera un `E016`/`E010` espurio por
  cada token sobrante). Una racha de líneas inválidas consecutivas de
  nivel superior produce un solo `E040` (en la primera; la racha la corta
  el siguiente statement válido). Si falta el `}` de un bloque o del
  cuerpo de una entidad, se reporta `E052`/`E045` (anclado en el `{` que
  abrió) y se conserva lo que se llegó a parsear. Dentro de un cuerpo, una
  línea que empieza con `entity`, `flow`, `sequence` o `use` y no es una
  arista (en un bloque, si no sigue de `->`) se trata como el statement de
  nivel superior siguiente en vez de como contenido del cuerpo: cierra el
  bloque/cuerpo abierto con `E052`/`E045` sin consumir esa línea, así que
  el resto del documento se sigue parseando con normalidad en vez de
  arrastrarse como si fuera parte del cuerpo sin cerrar.
- `use` va en su propia línea, en cualquier lugar del nivel superior; la
  ruta es un string entre comillas (`E046` si no). Qué documento nombra y
  qué trae al catálogo se decide en la resolución (ver abajo).
- `{}` (con el `}` en la misma línea que el `{`, sin nada más entre
  medio) es un bloque/cuerpo vacío, sin diagnósticos. Un cuerpo con
  contenido en la misma línea que el `{` reporta un único `E016` en el
  primer token inesperado; si esa misma línea termina en `}`, el
  bloque/cuerpo se cierra ahí (una sola línea); si no, se comporta como
  siempre: se descarta el resto de la línea y el cuerpo sigue en las
  líneas siguientes.

## Documentos `.md` de conocimiento

Un `.md` es documento del workspace solo si su primera línea es `---`
(decisión #21); el frontmatter termina en la siguiente línea `---`. Es YAML
(dependencia `yaml`) y declara una entidad del catálogo:

```yaml
---
id: decision_auth        # obligatorio, identificador (misma regla que IDENT)
title: "OAuth2 + PKCE"   # obligatorio, texto no vacío → label
memory_type: long_term   # obligatorio: working | short_term | long_term
type_tags: [decision]    # identificadores declarados en el esquema
context_tags: ["project:core"]  # 'clave:valor'
custom_tags: { status: approved, level: 3 }  # escalares
use: ["../catalogo.flo"] # como 'use' en .flo
relations:
  - target: api          # id, ruta a .md, o ruta a bloque 'x.flo#nombre'
    type: affects        # declarado en el esquema
---
```

La entidad es un rectángulo con `title` como label; su `range` es el
frontmatter completo y su `nameRange` el valor de `id`.

Cada bloque de código cercado (` ``` ` o `~~~`) cuyo info-string empieza
con la palabra `flo` se parsea como un `.flo` con el uri del `.md`, con sus
líneas y columnas reales. Sus entidades van después de la del frontmatter
(decisión #22). Los demás bloques de código se ignoran.

El vocabulario vive en `knowledge.schema.yaml`, en la raíz del workspace
(uri exacto):

```yaml
type_tags: [architecture, business_rule, decision, incident, pattern]
relation_types: [enforces, visualized_by, affects, supersedes]
```

Ambas claves son obligatorias y listas de identificadores. Sin esquema, el
primer `.md` (por uri) lleva un único `E068` y no se valida vocabulario; con
un esquema inválido, los diagnósticos van en el esquema y tampoco se valida.

`relations.target` es una ruta si lo anterior a `#` contiene `/` o termina
en `.md`/`.flo`: `x.md` resuelve a la entidad de ese `.md`, `x.flo#nombre`
(o `x.md#nombre`) al bloque. Cualquier otro valor es un id del catálogo
alcanzable. Las rutas que existen cuentan como `use` implícito. Un target
que no resuelve es `E035`.

## Fuera de esta gramática (futuro, no en este plan)

subgrafos, `alt`/`loop` de secuencia, notas, estilos.

## Tabla de diagnósticos

| Código | Origen | Significado |
|---|---|---|
| E001 | lexer | falta el delimitador de cierre antes de fin de línea |
| E002 | lexer | carácter inesperado, o cadena sin cerrar |
| E010 | parser | se esperaba un identificador |
| E011 | entity | se esperaba el texto de la entidad (forma vacía) |
| E012 | entity | falta el delimitador de cierre de la forma |
| E014 | block | se esperaba el id destino |
| E016 | parser | contenido inesperado al final de la línea |
| E024 | block | se esperaba `->` |
| E026 | block (sequence) | se esperaba `:` seguido del mensaje |
| E027 | block (sequence) | se esperaba el texto del mensaje |
| E030 | resolver | entidad referenciada pero no declarada |
| E031 | resolver | entidad declarada dos veces (en el mismo documento o en otro) |
| E032 | resolver | `use` apunta a un documento inexistente o fuera de la raíz |
| E033 | resolver | nombre de bloque duplicado |
| E034 | entity | propiedad de entidad desconocida |
| E035 | resolver | `relations.target` no resuelve a una entidad, `.md` o bloque |
| E040 | document | se esperaba `entity`, `flow`, `sequence` o `use` |
| E041 | entity | se esperaba el id de la entidad |
| E042 | entity | se esperaba `:` después de la propiedad |
| E043 | entity | se esperaba el valor de la propiedad |
| E044 | entity | propiedad repetida |
| E045 | entity | falta `}` que cierra el cuerpo de la entidad |
| E046 | use | se esperaba la ruta entre comillas después de `use` |
| E050 | block | se esperaba el nombre del bloque |
| E051 | block | se esperaba `{` para abrir el bloque |
| E052 | block | falta `}` que cierra el bloque |
| E060 | markdown | frontmatter sin cerrar (falta el `---` final) |
| E061 | markdown / esquema | error de sintaxis YAML |
| E062 | markdown | falta un campo obligatorio (`id`, `title`, `memory_type`; `target`/`type` de una relación) |
| E063 | markdown | valor con tipo inválido para su campo |
| E064 | markdown | `memory_type` fuera de `working`, `short_term`, `long_term` |
| E065 | esquema | `type_tag` no declarado en el esquema |
| E066 | esquema | tipo de relación no declarado en el esquema |
| E067 | markdown | campo de frontmatter (o de relación) desconocido |
| E068 | esquema | falta `knowledge.schema.yaml` o su contenido es inválido |

**Retirados:** E003, E004, E005, E006, E013, E015, E017, E020, E021, E022,
E023, E025. No se reusan con otro significado.
