# Sintaxis de `.flo`

Guía de la sintaxis `.flo` para quien escribe diagramas. Para la gramática
formal (EBNF) y la tabla completa de códigos de error, ver
[`packages/core/GRAMMAR.md`](../packages/core/GRAMMAR.md) — ese archivo es
referencia interna del parser, este es para uso diario.

Todo archivo `.flo` empieza con una línea `diagram <tipo>`, donde `<tipo>`
es `flowchart` o `sequence`. Pueden precederla líneas en blanco o
comentarios, pero no otro contenido.

Los comentarios empiezan con `//` y van hasta el fin de la línea, en
cualquier tipo de diagrama:

```
// esto es un comentario
diagram flowchart
```

Ojo: esto solo vale fuera de modo texto. Adentro del texto de un nodo
(`[ ]`, `{ }`, `( )`) o después de `:` o `as`, `//` ya no abre un
comentario — queda pegado como parte del texto o la etiqueta. Por ejemplo,
en `user -> api : POST /x  // nota`, `// nota` termina siendo parte de la
etiqueta, no un comentario. Usá comentarios en su propia línea, o antes de
que empiece el texto.

## Flowchart

Dos tipos de statement: declarar un nodo, o conectar dos nodos con una
arista.

**Nodos** — un id seguido de una forma con el texto adentro:

```
start[Inicio]      // rectángulo
check{¿Válido?}    // rombo
home(Home)         // rectángulo redondeado
```

El id (`start`, `check`, `home`) es solo letras ASCII, dígitos y `_`, y no
puede empezar con dígito. El texto entre `[ ]`, `{ }` o `( )` puede tener
espacios y acentos — es libre excepto el delimitador de cierre y el salto
de línea.

**Aristas** — conectan dos ids ya declarados en el archivo (en cualquier
orden, no hace falta declarar antes de referenciar), con una etiqueta
opcional después de `:`:

```
start -> check
check -> home : sí
```

Un id no puede reusarse con una forma distinta a la que ya tenía. Toda
arista debe referenciar ids que existan en algún lugar del archivo.

## Sequence

Dos tipos de statement: declarar un participante (opcional), o un mensaje
entre dos participantes.

**Participantes** — con alias opcional después de `as`:

```
participant user as Usuario
participant db as Base de datos
```

El alias (después de `as`) puede tener espacios — es texto libre hasta
fin de línea, igual que el texto de un nodo.

Ojo: `as` es una palabra reservada en cualquier tipo de diagrama, no solo
en `sequence`. Si usás `as` como id o como parte de un nombre en un
`flowchart`, el lexer igual entra en modo texto y el resto de la línea se
lee como un solo token de texto — evitá usar `as` fuera de un
`participant`.

**Mensajes** — la etiqueta después de `:` es obligatoria (a diferencia de
flowchart, donde es opcional):

```
user -> api : POST /login
api -> db : SELECT usuario
```

Si un participante se usa en un mensaje sin haber sido declarado antes con
`participant`, se autodeclara con su id como label — no hace falta
declarar todos los participantes de antemano. Pero declarar explícitamente
un participante que ya fue autodeclarado por un mensaje anterior es un
error.

## Errores

El editor (`@flo/web`) subraya los errores en el momento, con un tooltip
que explica cada uno. Si preferís usar `@flo/core` directo:

```ts
import { parse } from "@flo/core";

const { diagram, diagnostics } = parse(source);
```

`diagnostics` siempre trae **todos** los errores encontrados en una sola
pasada — el parser no se detiene en el primero. `diagram` es `null` solo
si la línea `diagram <tipo>` es inválida; con errores más abajo en el
archivo, `diagram` sigue trayendo lo que se pudo parsear.
