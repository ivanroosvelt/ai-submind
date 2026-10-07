# Sintaxis de `.flo`

Guía de la sintaxis `.flo` para quien escribe diagramas. Para la gramática
formal (EBNF) y la tabla completa de códigos de error, ver
[`packages/core/GRAMMAR.md`](../packages/core/GRAMMAR.md) — ese archivo es
referencia interna del parser, este es para uso diario.

Los comentarios empiezan con `//` y van hasta el fin de la línea:

```
// esto es un comentario
entity user [Usuario]
```

Ojo: esto solo vale fuera de modo texto. Adentro del texto de una entidad
(`[ ]`, `{ }`, `( )`) o después de `:` en una arista, `//` ya no abre un
comentario — queda pegado como parte del texto o la etiqueta.

## Un documento tiene entidades y bloques

Un archivo `.flo` declara un **catálogo de entidades** y uno o más
**bloques** (`flow` o `sequence`) que las conectan. Las entidades son la
identidad y la representación (id, forma, label); los bloques solo tienen
aristas — no se declaran nodos adentro de un bloque:

```
entity user (Usuario)
entity api  [API Gateway]
entity db   {Base de datos}

flow login "Inicio de sesión" {
  user -> api : POST /login
  api  -> db  : buscar credenciales
  db   -> api : perfil
}
```

Renombrar una entidad o cambiarle la forma es editar una línea: se ve
igual en todos los bloques que la usan. Un archivo puede tener varios
`flow`/`sequence`, con nombre y título propios, y todos se muestran en el
preview.

## `entity`

Tres formas, igual que antes, más la opción de no tener forma:

```
entity start (Inicio)      // rectángulo redondeado
entity check {¿Válido?}    // rombo
entity home  [Home]        // rectángulo
entity mail                // sin forma: rectángulo con "mail" como label
```

El id es solo letras ASCII, dígitos y `_`, y no puede empezar con dígito.
El texto entre `[ ]`, `{ }` o `( )` puede tener espacios y acentos — es
libre excepto el delimitador de cierre y el salto de línea.

`type` y `tags` son metadatos opcionales, en línea o en un cuerpo `{ }`:

```
entity api [API] type: service, tags: http interno

entity gw [Pasarela de pago] {
  type: external
  tags: http pagos
}
```

`type` acepta un identificador; `tags`, uno o más separados por espacio.
El core los valida sintácticamente pero no interpreta sus valores — son
para filtrar y agrupar en la UI. Dentro del cuerpo también pueden ir
juntas en una misma línea, separadas por `,` (`type: external, tags: http
pagos`), o cada una en la suya como en el ejemplo de arriba.

## `flow`

Un bloque `flow` con nombre y título opcional entre comillas; adentro,
solo aristas, con etiqueta opcional después de `:`:

```
entity a [A]
entity b [B]
entity c [C]

flow f "Ejemplo" {
  a -> b
  b -> c : con etiqueta
}
```

El nombre del bloque (`f`) es su id dentro del documento y debe ser
único. Toda arista debe referenciar entidades declaradas en algún lugar
del mismo archivo — el orden no importa. Las columnas/nodos se dibujan en
el orden en que se declararon las entidades, no en el orden de las
aristas.

## `sequence`

Igual forma que `flow`, pero la etiqueta después de `:` es **obligatoria**
en cada arista:

```
entity user [Usuario]
entity api  [API]
entity db   [Base de datos]

sequence s "Detalle" {
  user -> api : POST /login
  api  -> db  : SELECT usuario
}
```

Las columnas se ordenan igual que en `flow`: por orden de declaración de
las entidades en el catálogo, no por orden de aparición en los mensajes.

## Errores más comunes

**`E030`** — una arista referencia un id que no tiene `entity`:

```
entity user [Usuario]

flow f {
  user -> api
}
```

Fix: declarar la entidad que falta (`entity api [API]`) en cualquier
parte del archivo.

**`E040`** al abrir un archivo con la sintaxis vieja (`diagram <tipo>`) —
esa sintaxis ya no existe. Para migrar un archivo:

- La línea `diagram flowchart` / `diagram sequence` se borra.
- Cada nodo pasa a ser una entidad de nivel superior: `start[Inicio]` pasa
  a `entity start [Inicio]`.
- Las aristas van dentro de `flow nombre { ... }` (o `sequence nombre {
  ... }`), con las mismas reglas de antes.
- `participant x as Y` pasa a `entity x [Y]` (fuera del bloque).

Ejemplo, sintaxis vieja:

```
diagram flowchart

start[Inicio]
check{¿Válido?}

start -> check
```

sintaxis nueva:

```
entity start [Inicio]
entity check {¿Válido?}

flow f {
  start -> check
}
```

## Uso desde código

```ts
import { render } from "@tejo/core";

const { diagrams, diagnostics } = render(source);
// un elemento por bloque: { name, title, kind: "flow" | "sequence", svg }
```

`diagnostics` siempre trae **todos** los errores encontrados en una sola
pasada — el parser no se detiene en el primero. `diagrams` trae un
elemento por cada bloque que se pudo parsear, con su SVG, aunque el
documento tenga errores en otras partes.
