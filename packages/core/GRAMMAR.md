# Gramática `.flo` (MVP: flowchart + sequence)

    Diagram      ::= BlankLine* Header Newline Body EOF
    Header       ::= "diagram" Kind
    Kind         ::= "flowchart" | "sequence"
    Body         ::= (BlankLine | Statement)*
    BlankLine    ::= Newline
    Statement    ::= (FlowchartStatement | SequenceStatement) Newline

    (* --- flowchart --- *)
    FlowchartStatement ::= NodeDecl | EdgeDecl
    NodeDecl     ::= Ident Shape
    Shape        ::= "[" Text "]" | "(" Text ")" | "{" Text "}"
    EdgeDecl     ::= Ident "->" Ident (":" Text)?

    (* --- sequence --- *)
    SequenceStatement  ::= ParticipantDecl | MessageDecl
    ParticipantDecl ::= "participant" Ident ("as" Text)?
    MessageDecl  ::= Ident "->" Ident ":" Text

    Ident        ::= (letra ASCII | "_") (letra ASCII | dígito | "_")*
    Text         ::= cualquier carácter excepto el delimitador de cierre
                      y el salto de línea; se recorta espacio inicial/final
    Comment      ::= "//" cualquier carácter hasta fin de línea
                      (se descarta antes de tokenizar, no genera token)

## Reglas léxicas especiales

- Se permiten líneas en blanco (incluida una línea que queda vacía porque
  un comentario fue eliminado por el lexer, p. ej. `// título\n`) antes
  del header `diagram <tipo>`. El parser las salta antes de revisar E003
  (archivo vacío) o E004 (falta `diagram`), así que un comentario inicial
  no se confunde con contenido inválido.
- Después de `[`, `(`, `{` o `:`, el lexer entra en modo texto: todo lo
  que sigue hasta el delimitador de cierre (o hasta fin de línea, para
  `:`) es un único token `TEXT`, sin tokenizar palabra por palabra.
- La palabra `as` es una palabra reservada global del lexer, no una
  palabra clave contextual: el lexer entra en modo texto cada vez que
  emite un `IDENT` con valor `as`, sin importar el tipo de diagrama ni la
  posición (por ejemplo, también dispara dentro de un `flowchart`, donde
  `as` no tiene significado gramatical). El resto de la línea se lee
  entonces como un único token `TEXT` (igual que después de `:`). Es la
  única forma en que un alias de participante puede tener espacios (`as
  Base de datos`).
- Un id de nodo/participante no puede reusarse con una forma distinta
  (flowchart) ni declararse dos veces (sequence) — es un error, no una
  redefinición silenciosa.
- En `flowchart`, toda arista debe referenciar nodos declarados en algún
  lugar del mismo archivo — el orden no importa: un nodo declarado más
  abajo en el archivo puede ser referenciado por una arista anterior sin
  error. Esta comprobación corre como una pasada posterior, una vez que
  `nodes` y `edges` están completos; solo se marca un id que nunca llega
  a declararse en todo el archivo (E017). A diferencia de `sequence`, no
  hay autodeclaración de nodos en `flowchart`.
- En `sequence`, un participante usado en un mensaje sin haber sido
  declarado explícitamente con `participant` se autodeclara con su id
  como label. Declarar explícitamente un participante ya autodeclarado
  por un mensaje previo es un caso no soportado en esta ronda (error
  E023) — se documenta como limitación conocida, no un bug.

## Fuera de esta gramática (futuro, no en este plan)

Subgrafos, loops/alt de secuencia, notas, estilos. El principio de
bloques con `{ }` para anidamiento (spec §4) queda reservado para cuando
se agreguen — no se inventa sintaxis de bloques en esta ronda porque el
spec no la especifica con ejemplos concretos.

## Códigos de diagnóstico

| Código | Origen | Significado |
|---|---|---|
| E001 | lexer | falta el delimitador de cierre antes de fin de línea |
| E002 | lexer | carácter inesperado |
| E003 | parser (header) | archivo vacío |
| E004 | parser (header) | falta la palabra `diagram` al inicio |
| E005 | parser (header) | tipo de diagrama desconocido |
| E006 | parser (header) | contenido inesperado después del tipo |
| E010 | parser (flowchart) | se esperaba un identificador |
| E011 | parser (flowchart) | se esperaba el texto del nodo |
| E012 | parser (flowchart) | falta el delimitador de cierre del nodo |
| E013 | parser (flowchart) | nodo redeclarado con otra forma |
| E014 | parser (flowchart) | se esperaba el id del nodo destino |
| E015 | parser (flowchart) | se esperaba una forma de nodo o `->` |
| E016 | parser (flowchart/sequence) | contenido inesperado al final de la línea |
| E017 | parser (flowchart) | id de nodo no declarado en una arista |
| E020 | parser (sequence) | se esperaba `participant` o un id |
| E021 | parser (sequence) | se esperaba el id del participante |
| E022 | parser (sequence) | se esperaba el texto del alias después de `as` |
| E023 | parser (sequence) | participante redeclarado |
| E024 | parser (sequence) | se esperaba `->` |
| E025 | parser (sequence) | se esperaba el id del participante destino |
| E026 | parser (sequence) | se esperaba `:` seguido del mensaje |
| E027 | parser (sequence) | se esperaba el texto del mensaje |
