# ai-submind knowledge format · version 1.1

Normative specification of the contents of `knowledge/` managed by ai-submind. The JSON Schema
2020-12 files in [`schema/1.1/`](schema/1.1/) are the canonical source of the **structure** (keys, types,
enumerations and key order) of the current version; those of the earlier supported version 1.0 are kept in
[`schema/1.0/`](schema/1.0/) (§11). This document is the canonical source of the **semantics**
(identifiers, references, consistency rules, canonical serialization and versioning).

The words **must**, **must not** and **may** are normative.

## 1. Origin and citation

The format is derived from UMJ (*UML JSON*), proposed in:

> Malanowska, A. and Pawłowski, F. (2026). *Unifying Non-Uniform Formats of UML Model Interchange Using
> JSON*. Proceedings of the 21st International Conference on Evaluation of Novel Approaches to Software
> Engineering (ENASE 2026), pp. 394–401. SciTePress. DOI
> [10.5220/0014828700004015](https://doi.org/10.5220/0014828700004015).

That work is published under CC BY-NC-ND 4.0; this specification does not reproduce its text or its tables:
it takes its ideas (identifiers with `id` and references `{"idref": ...}`, the model as the root and owner of
the relationships, the event order of an interaction given by the array order, diagrams as
sets of references) and redefines them in its own words, adapted to ai-submind. The differences
are listed in §12. Product decisions that support it: DEC-002 (format), DEC-003 (IDs) and DEC-020
(cross-diagram relations and version 1.1).

## 2. Structure of `knowledge/`

```
knowledge/
  ai-submind.json             # manifest (§5)
  models/<model-id>.json      # one file per model (§6)
  layout/<diagram-id>.json    # one file per diagram with layout (§8)
  .ai-submind/                # local derived data; ignored by git and by the validator
```

- The name of each model file **must** be `<model id>.json`; that of a layout file,
  `<diagram id>.json` (`FILE_ID_MISMATCH`).
- Any other file or directory outside `.ai-submind/` produces the warning `UNKNOWN_FILE`.
- All files are JSON in UTF-8 without BOM (§9).

## 3. Identifiers

### 3.1 Grammar

There are two classes of ID, both in a **single global namespace** for the whole of `knowledge/`: there
cannot be two elements, models or diagrams with the same `id`, even if they are in different files
(`ID_DUPLICATE`). Comparison is case-sensitive.

| Class | Used by | Regular expression (ECMA-262, flag `u`) | Length |
|-------|---------|-----------------------------------------|--------|
| file ID | models and diagrams | `^[a-z0-9]+(-[a-z0-9]+)*$` | 1..64 |
| element ID | everything else | `^[\p{L}\p{N}_$]([\p{L}\p{N}_$().-]*[\p{L}\p{N}_$)])?$`, without `..` | 1..256 |

- File IDs are restricted to lowercase ASCII because they name files (case-insensitive file systems,
  portability across operating systems).
- The characters `:`, `/`, `#`, `@` and spaces are reserved for future use
  (e.g. paths or qualified references) and are not allowed.
- Every file ID also satisfies the element ID grammar.

### 3.2 Stability

- The `id` is stable: changing `name` does **not** change the `id`.
- Changing an `id` is only valid through the engine's `rename` operation, which rewrites in a single
  transaction all references (models, diagrams, layout keys and file names).
  A manual edit that changes an `id` leaves broken references that the validator reports; they are never
  repaired silently.
- Rules of `rename(old, new)`:
  - **Scope**: IDs that start with `old.` (attributes, operations, parameters, ends, lifelines, messages,
    fragments…) are also renamed, replacing that prefix with `new.`. Derived relationship IDs that mention
    `old` in another position (e.g. `Truck--extends--Car`) do **not** change: they are stable and opaque
    after their creation.
  - **Collision**: if `new` or any resulting ID already exists, the operation fails (`RENAME_COLLISION`) and
    writes nothing.
  - **Blocking**: if any document of `knowledge/` is not loaded as writable (`conflicted`,
    `invalid_parse`, `SCHEMA_VIOLATION` or read-only because of its version), the operation fails
    (`RENAME_BLOCKED`): it cannot be guaranteed that it contains no references.
  - `new` must satisfy the grammar of its ID class (§3.1).
- Identifiers from external tools (imports) are preserved in `external_id` (§7.1).

### 3.3 Derivation (normative for the engine when creating elements without an explicit `id`)

Helper functions:

- `seg(text)`: normalizes to NFC, replaces each run of whitespace with `_`, removes the characters that
  are not a letter (`\p{L}`), digit (`\p{N}`), `_`, `$` or `-`, and trims trailing `-`;
  if the result is empty or starts with `-`, prepends `_`.
- `slug(text)`: decomposes into NFD, removes diacritics, lowercases, replaces each run of characters
  outside `[a-z0-9]` with `-`, truncates to 64 characters and then trims `-` at both ends.
- Every ID is written in NFC; the grammar (§3.1) rejects stray combining marks, so an ID in NFD
  fails schema validation.
- If a compound ID exceeds 256 characters (64 for file IDs), its last derived segment is truncated (without touching
  `()` or the owner prefix) until it fits, counting the possible collision suffix, and the trailing characters that
  cannot end an ID (§3.1) are trimmed. If not even one character of the segment fits, derivation fails
  (`INVALID_ID`).

| Element | Derived ID | Example |
|---------|------------|---------|
| model, diagram | `slug(name)` (empty → `model` / `diagram`) | `garage`, `overview` |
| package, actor, class, interface, data type, enumeration, primitive type, interaction | `seg(name)` | `Car`, `RentCar` |
| attribute | `<owner>.<seg(name)>` | `Car.yearOfProduction` |
| operation | `<owner>.<seg(name)>()` | `Car.start()` |
| parameter | `<operation>.<seg(name)>` | `Car.refuel().liters` |
| named / unnamed association | `seg(name)` / `<end1.element>--<end2.element>` | `Garage--Car` |
| association ends | `<association>.end1`, `<association>.end2` | `Garage--Car.end1` |
| generalization | `<specific>--extends--<general>` | `Truck--extends--Car` |
| realization | `<client>--implements--<supplier>` | `Car--implements--Drivable` |
| named / unnamed dependency | `seg(name)` / `<client>--uses--<supplier>` | `Garage--uses--Mechanic` |
| lifeline | `<interaction>.<seg(name)>` (empty name → `seg` of the name of the represented classifier, or `lifeline`) | `RentCar.car` |
| message | `<interaction>.<seg(name)>` (empty → `msg`) | `RentCar.start` |
| occurrence specification of a message | `<message>.send` / `<message>.receive` | `RentCar.start.send` |
| other occurrence specification | `<interaction>.occ` | |
| combined fragment | `<interaction>.<operator>` | `RentCar.opt` |
| interaction operand | `<fragment>.op<n>` (n = position when created, from 1; never renumbered) | `RentCar.opt.op1` |
| interaction use | `<interaction>.ref--<used interaction>` | `RentCar.ref--Payment` |
| execution specification | `<start>.exec` (no `start` → `<interaction>.exec`) | `RentCar.rent.receive.exec` |

Collisions: if the derived ID already exists, `-2`, `-3`, … (the lowest free one) is appended to the end of the last
segment, before `()` if present: `Car-2`, `Car.start-2()`. Derivation only applies on creation; it is never
recomputed.

## 4. References

- A reference is always an object `{"idref": "<id>"}` and nothing else. This uniform shape makes it possible to
  find all references of a document without knowing its type (`rename` relies on it).
- Every reference **must** resolve to an existing `id` in `knowledge/` (`REF_UNRESOLVED`) of a type
  allowed by the key that contains it (`REF_TYPE_MISMATCH`; table in §10.2).
- Since IDs are global, a reference may point to an element of **another model** without additional
  syntax (e.g. primitive types shared in a `types` model). Only `links` (§7.1) and the layout `diagram` may
  point to a model or a diagram as a whole.
- The keys of layout maps (§8) are IDs, not `idref` objects; `rename` rewrites them too.

## 5. Manifest `ai-submind.json`

Schema: [`ai-submind.schema.json`](schema/1.1/ai-submind.schema.json).

| Key | Type | Req. | Meaning |
|-----|------|------|---------|
| `format_version` | text `MAJOR.MINOR` | yes | format version of the manifest (§11) |
| `name` | text | no | human-readable name of the knowledge project |
| `documentation` | text | no | free description in Markdown |

Its presence indicates that `knowledge/` is initialized. `ai-submind init` creates it and never overwrites it.

## 6. Model (`models/<model-id>.json`)

Schema: [`model.schema.json`](schema/1.1/model.schema.json). The tables summarize the semantics; types,
requiredness and exact key order are in the schema.

### 6.1 Common conventions

- **Named element**: has `name` (non-empty text, except in lifelines and messages, where it may be empty) and, if the schema
  requires it, `visibility` ∈ `public`, `private`, `protected`, `package`.
- **Unknown value**: an absent optional field means *unspecified*. No default values are imposed
  (an absent `is_static` does not mean `false`). The reader also accepts an explicit `null` with the
  same meaning; canonical serialization omits it (§9).
- **Collections**: an absent collection is equivalent to an empty one; canonical serialization omits empty ones.
- **Multiplicity**: text `n`, `n..m`, `n..*` or `*` with `n ≤ m` (e.g. `1`, `0..1`, `1..*`).
- **Extensions** (every element with an `id`, the model and the diagrams): see §7.

### 6.2 Model root

| Key | Contents |
|-----|----------|
| `format_version` | format version (§11) |
| `id`, `name`, `visibility` | file ID, name, optional visibility |
| `elements` | object with the collections of table 6.3; the model owns all its elements and relationships |
| `diagrams` | list of diagrams (§6.6) |

### 6.3 Collections of `elements`

| Key | Element | Own contents |
|-----|---------|--------------|
| `packages` | package | `members`: references to the top-level elements it groups (it does not own them) |
| `actors` | actor | name only (extension: UMJ has no actors; they are used in lifelines and future use cases) |
| `classes` | class | `is_abstract`, `attributes`, `operations` |
| `interfaces` | interface | `attributes`, `operations` |
| `data_types` | data type | `attributes`, `operations` |
| `enumerations` | enumeration | `literals`: ordered list of unique texts |
| `primitive_types` | primitive type | `kind`: optional free text with the source base type |
| `associations` | association | `type` ∈ `association`, `aggregation`, `composition`; `direction` ∈ `directed`, `undirected`; `end1`, `end2` |
| `generalizations` | generalization | `specific` (child), `general` (parent) |
| `dependencies` | dependency | `client` (depends), `supplier` (what it depends on), optional `name` |
| `realizations` | realization | `client` (implementing classifier), `supplier` (interface) |
| `interactions` | interaction | `lifelines`, `messages`, `fragments`, `executions` (§6.5) |

### 6.4 Classifier features

| Element | Contents |
|---------|----------|
| attribute | `type` (ref), `multiplicity`, `default_value` (text), flags `is_static`, `is_ordered`, `is_unique`, `is_read_only`, `is_derived`, `is_derived_union` |
| operation | `parameters` (ordered), `return_type` (ref), `exceptions` (refs), flags `is_static`, `is_abstract`, `is_query`, `behavior` (ref to an interaction; 1.1) |
| parameter | `direction` ∈ `in`, `out`, `inout`; `type` (ref), `multiplicity`, `default_value` |
| association end | `element` (ref, required), `role`, `multiplicity`, `navigability` (boolean), `visibility` |

Rules:
- A `directed` association goes from `end1` to `end2`.
- In `aggregation` and `composition`, `end1` is the whole (diamond side) and `end2` the part.
- The lists `attributes`, `operations`, `parameters` and `literals` are **ordered**: their order is the
  presentation order and is not reordered.
- `behavior` (since 1.1, DEC-020): the interaction that describes the behavior of the operation (UML
  `Operation.method`); it may be in another model. At most one per operation. It is the class → sequence
  direction of the relation whose sequence → class direction is `messages[].signature` (§6.5); several operations
  may share an interaction. In the schema it follows `return_type`.

### 6.5 Interactions (sequence)

| Element | Contents |
|---------|----------|
| lifeline | `name`, `represents` (optional ref to a classifier or actor) |
| message | `name`, `sort`, `kind`, `arguments` (texts), `send_event`, `receive_event` (refs to occurrence specifications), `signature` (ref to an operation) |
| `occurrence` fragment | `covered`: ref to a lifeline |
| `combined_fragment` fragment | optional `name`, `operator`, `covered` (refs to lifelines), `operands` (ordered) |
| interaction operand | `guard` (optional text), `fragments` (ordered) |
| `interaction_use` fragment | optional `name`, `covered` (refs to lifelines), `interaction` (ref), `arguments` |
| execution specification | `covered` (ref to a lifeline), `start`, `finish` (refs to `occurrence` fragments) |

- `sort` ∈ `synch_call`, `asynch_call`, `asynch_signal`, `create_message`, `delete_message`, `reply`.
- `kind` ∈ `complete` (requires `send_event` and `receive_event`), `lost` (only `send_event`),
  `found` (only `receive_event`), `unknown` (no restriction).
- `operator` ∈ `alt`, `opt`, `par`, `loop`, `critical`, `neg`, `assert`, `strict`, `seq`, `ignore`,
  `consider`, `break`. The bounds of `loop` are expressed in `guard` (e.g. `[1..3]`).
- Each fragment declares its class in `type`. A single event occurs at each instant: the **order of
  `fragments`** (in the interaction and in each operand) is the temporal order and **is not reordered**.
- `lifelines` is ordered: its order is the default horizontal order (the layout may change it).
- `messages` is a set (sorted by `id`): the temporal order is given by their occurrence specifications.
- A synchronous message without a reply is valid (`reply` is not required).
- `executions` is a set (sorted by `id`) of execution specifications (activations, DEC-018): the lifeline
  `covered` is active from the occurrence `start` to the occurrence `finish`, both of the same interaction
  and covering `covered`; `start` is not after `finish` in the temporal order, that is, the order of the
  `fragments` flattened depth first (operands in order). `start` may equal `finish`. Executions take no part
  in the temporal order; an occurrence they use may also be the event of a message (it is not an event of
  the execution). Executions may nest (overlap on the same lifeline). Amendment of format 1.0 before its
  release (2026-10-15, DEC-018): the version stays `1.0`.

### 6.6 Diagrams

| Key | Contents |
|-----|----------|
| `id`, `name` | file ID (names its layout) and name |
| `kind` | `class` or `sequence`; registry extensible per format version |
| `elements` | references to the elements shown (set) |

- `class`: may show packages, actors, classes, interfaces, data types, enumerations, primitive
  types, associations, generalizations, dependencies and realizations (`DIAGRAM_ELEMENT_NOT_ALLOWED`).
  Attributes and operations are shown with their classifier.
- `sequence`: exactly one interaction; shows all its lifelines, messages and fragments.
- A diagram may show elements from other models (global IDs).

## 7. Own extensions

### 7.1 Element metadata

Allowed on every element with an `id`, on the model and on the diagrams; always optional.

| Key | Type | Use |
|-----|------|-----|
| `stereotypes` | list of unique texts | UML stereotypes without `«»` (e.g. `entity`, `service`) |
| `tags` | list of unique texts | free labels for filtering and searching |
| `documentation` | Markdown text | description for people and agents; included in lexical search |
| `code_refs` | list of `{path, symbol?}` | links to the code of the host repository |
| `external_id` | text | original ID in an external tool (DEC-003) |
| `links` | set of references (1.1) | elements, models or diagrams this one drills down to (DEC-020) |

`code_refs[].path` is a path relative to the repository root with `/` as separator and no trailing slash;
it must not start with `/` or `~`, or contain `:`, `\`, control characters, empty segments (`//`) or
`.` or `..` segments (`CODE_REF_INVALID`). Schema errors inside `code_refs[].path` are reported
with the code `CODE_REF_INVALID` instead of `SCHEMA_VIOLATION`. If the path does not exist, the warning
`CODE_REF_MISSING` is emitted (it does not block: code evolves separately). `symbol` is optional and free
(name of a class, function, etc.).

`links` (since 1.1, DEC-020) is a set of references `{"idref": ...}` without duplicates (`SCHEMA_VIOLATION`)
whose target may be **any element, model or diagram** of `knowledge/`, in this or another model file: "see also /
drills down to" (e.g. a lifeline or a fragment linked to the diagram of a sub-flow, a class linked to the model
that details it). It adds no UML semantics; prefer `behavior` (§6.4) for the behavior of an operation. A link to
the element, model or diagram that carries it is `LINK_SELF` (§10.3); links to its own model or diagram, or
between elements of the same file, are valid, and so are cycles between flows. In the schema it follows
`external_id`. Not allowed on the manifest or on layouts.

### 7.2 Layout

UMJ does not define layout; ai-submind stores it separately (§8) so that moving a node does not pollute the model.

## 8. Layout (`layout/<diagram-id>.json`)

Schema: [`layout.schema.json`](schema/1.1/layout.schema.json).

| Key | Contents |
|-----|----------|
| `format_version` | version (§11) |
| `diagram` | ref to the diagram; must match the file name |
| `nodes` | map `id → {x, y, width?, height?, style?}` |
| `edges` | map `id → {vertices?, style?}`; `vertices` is the ordered list of intermediate points |

- Coordinates and sizes are integers in diagram pixels, |value| ≤ 10 000 000; sizes ≥ 1.
- `x`, `y` are the top-left corner of the node. `width` and `height` are a **minimum** size: a node is drawn
  (and laid out) with the larger of that size and the size its content needs; content is never clipped.
- `style` allows `fill`, `stroke` and `text` as a lowercase `#rrggbb` color.
- `class` diagram: `nodes` keys = packages, actors and classifiers shown; `edges` keys =
  relationships shown. `sequence` diagram: `nodes` keys = lifelines (`x` and `width` set their
  horizontal position, `y` the header top, `height` the minimum length from the header top); `edges` keys =
  messages (only `style` is used). Vertical positions always follow the temporal order: `y` is written by the
  layout (the margin, or the row of the create message of a created lifeline) and is not read back; rows,
  executions and fragments are never persisted (DEC-018).
- A key that does not correspond to an element shown is the warning `LAYOUT_ORPHAN`, not an error.
- An element shown without a layout entry is placed by the automatic layout and is not persisted until
  a person moves it.
- The file does not exist until the first layout modification (REQ-010).

## 9. Canonical serialization

Every write by the engine produces exactly this form; reading and rewriting a canonical document produces
no differences.

1. UTF-8 without BOM, LF line endings, final newline, 2-space indentation, separator `": "`;
   no trailing whitespace. Each key and each array element on its own line, except references,
   which are written on a single line: `{"idref": "Car"}`. Empty arrays and objects that must be written
   (required) are written `[]` / `{}`.
2. Key order: the order of `properties` in the object's schema; for a fragment, that of the concrete
   subschema according to its `type` (`occurrence`, `combinedFragment`, `interactionUse`). In maps (`nodes`,
   `edges`), keys sorted by code point.
3. Non-required keys whose value is `null`, empty text (`""`), an empty array or an empty object are omitted
   (including empty entries of `nodes`/`edges`). Required keys are always written
   (e.g. `"name": ""` in a lifeline).
4. **Ordered** arrays (significant order, preserved): `attributes`, `operations`, `parameters`,
   `literals`, `lifelines`, `fragments`, `operands`, `arguments`, `exceptions`, `vertices`.
5. **Set** arrays (sorted): collections of `elements`, `diagrams`, `messages`, `executions` and the reference lists
   `members`, `covered`, `links` and diagram `elements` by `id`/`idref` in code point order;
   `stereotypes` and `tags` by value; `code_refs` by `path` and then `symbol` (without `symbol` comes first).
   "Code point order" compares strings by UTF-16 code units, like the ECMAScript `<` operator.
   Single references (e.g. `behavior`, `return_type`) are not arrays: written on one line as any reference.
6. Numbers: integers without fractional part or exponent.
7. Text: the escaping of ECMAScript `JSON.stringify`: `\"`, `\\`, `\b`, `\f`, `\n`, `\r`, `\t`; the
   other control characters U+0000–U+001F as `\u00xx` with lowercase hexadecimal; lone
   surrogates as `\udxxx`; the rest of Unicode (including U+007F) is written literally.

## 10. Validation

### 10.1 Phases

1. **File** (VAL-006): path inside `knowledge/`, UTF-8, no Git conflict markers
   (lines starting with `<<<<<<<`, `=======` or `>>>>>>>`), syntactically valid JSON.
2. **Version** (VAL-004, §11).
3. **Schema** (VAL-001): JSON Schema 2020-12 of the document's version.
4. **Referential and semantic** (VAL-002, VAL-003, VAL-005, VAL-007) over the whole of `knowledge/`.

Rules between phases:
- An error in phase 1 or 3 leaves the document **not loaded**: it does not take part in phase 4 or in
  queries, and references to IDs that only existed in it are reported as `REF_UNRESOLVED`. The other
  documents are still loaded (REQ-036).
- `FORMAT_VERSION_UNSUPPORTED` (phase 2) does not stop loading: the document switches to **tolerant reading**
  (§11), becomes read-only and does take part in phase 4 (it counts for `ID_DUPLICATE` and as a reference
  target).
- `FORMAT_VERSION_OUTDATED` is a warning: the document is validated with the schema of its own version.
- Warnings never prevent loading or writing.

### 10.2 Types allowed per reference

"Classifier" = class, interface, data type, enumeration or primitive type.

| Key | Allows |
|-----|--------|
| `packages[].members` | package, actor, classifier, association, generalization, dependency, realization, interaction |
| `attributes[].type`, `parameters[].type`, `return_type`, `exceptions[]` | classifier |
| `end1.element`, `end2.element` | classifier or actor |
| `generalizations[].specific`, `.general` | classifier or actor, both from the same collection |
| `realizations[].client` / `.supplier` | class or data type / interface |
| `dependencies[].client`, `.supplier` | any element (not a model or diagram) |
| `lifelines[].represents` | classifier or actor |
| `messages[].send_event`, `.receive_event` | `occurrence` fragment of the same interaction |
| `executions[].start`, `.finish` | `occurrence` fragment of the same interaction |
| `messages[].signature` | operation |
| `covered` (any fragment, execution) | lifeline of the same interaction |
| `interaction_use.interaction` | interaction other than the one containing it |
| `operations[].behavior` (1.1) | interaction (any model) |
| `links[]` (1.1, any carrier) | any element, model or diagram other than the carrier (§10.3) |
| `diagrams[].elements` | according to `kind` (§6.6) |
| layout `diagram` | diagram |

### 10.3 Semantic rules

- An element belongs to at most one package; no package cycles (`PACKAGE_MEMBERSHIP`).
- No generalization cycles and `specific ≠ general` (`GENERALIZATION_CYCLE`).
- Message events according to `kind` (§6.5) (`MESSAGE_EVENTS`); an occurrence specification is the event of
  at most one message (`OCCURRENCE_REUSED`); one that is not the event of any message produces the warning
  `OCCURRENCE_UNUSED` unless an execution uses it.
- The `start` and `finish` of an execution cover its `covered` lifeline (`EXECUTION_COVERAGE`) and `start` is not
  after `finish` in temporal order (`EXECUTION_ORDER`). Both are checked only when `start` and `finish` are
  occurrences of the same interaction (otherwise §10.2 applies).
- Multiplicity with `n ≤ m` (`MULTIPLICITY_INVALID`).
- A `links` entry must not point to the element, model or diagram that carries it (`LINK_SELF`).

### 10.4 Codes

Report format: `{code, severity, file, pointer, message, subjects?}` with `pointer` as a JSON Pointer (RFC 6901)
and, in phase 4, `subjects`: the IDs the finding is about (empty when it is not about IDs, e.g. `MULTIPLICITY_INVALID`).

| Code | Severity | Phase | Meaning |
|------|----------|-------|---------|
| `PATH_OUTSIDE_KNOWLEDGE` | error | 1 | path outside `knowledge/` |
| `FILE_ENCODING` | error | 1 | not UTF-8 or has a BOM |
| `MERGE_CONFLICT` | error | 1 | conflict markers; document `conflicted`, writes blocked |
| `JSON_PARSE` | error | 1 | invalid JSON; document `invalid_parse` |
| `FORMAT_VERSION_UNSUPPORTED` | error | 2 | version later than the supported one, or earlier without migration; read-only document |
| `FORMAT_VERSION_OUTDATED` | warning | 2 | earlier supported version; explicit migration available |
| `SCHEMA_VIOLATION` | error | 3 | does not satisfy the schema (includes a missing or malformed version) |
| `UNKNOWN_FILE` | warning | 1 | unexpected file in `knowledge/` |
| `FILE_ID_MISMATCH` | error | 4 | file name ≠ `id` of the model or `diagram` of the layout |
| `ID_DUPLICATE` | error | 4 | `id` repeated in `knowledge/`; all occurrences are reported |
| `REF_UNRESOLVED` | error | 4 | reference to a nonexistent `id` |
| `REF_TYPE_MISMATCH` | error | 4 | reference to a type that is not allowed (§10.2) |
| `DIAGRAM_ELEMENT_NOT_ALLOWED` | error | 4 | element not allowed by the diagram's `kind` |
| `PACKAGE_MEMBERSHIP` | error | 4 | element in several packages or package cycle |
| `GENERALIZATION_CYCLE` | error | 4 | generalization cycle |
| `MESSAGE_EVENTS` | error | 4 | events incompatible with the message's `kind` |
| `OCCURRENCE_REUSED` | error | 4 | occurrence specification used by two events |
| `OCCURRENCE_UNUSED` | warning | 4 | occurrence specification without a message or execution |
| `EXECUTION_COVERAGE` | error | 4 | `start` or `finish` of an execution does not cover its `covered` lifeline |
| `EXECUTION_ORDER` | error | 4 | an execution finishes before it starts in temporal order |
| `MULTIPLICITY_INVALID` | error | 4 | lower bound greater than the upper bound |
| `LINK_SELF` | error | 4 | a `links` entry points to its own carrier (1.1) |
| `CODE_REF_INVALID` | error | 3 | `code_refs` path that is absolute or contains `..` / `\` |
| `CODE_REF_MISSING` | warning | 4 | nonexistent `code_refs` path |
| `LAYOUT_ORPHAN` | warning | 4 | layout entry for an element not shown |

Operation codes (API, not validation): `AMBIGUOUS_ID` (query or write on a duplicated `id`, or a
write that adds a reference to it),
`RENAME_COLLISION` and `RENAME_BLOCKED` (§3.2), `CREATE_BLOCKED` (a write that adds IDs while a document is
not loaded as writable, which may already hold them), `MIGRATION_REQUIRED` (a write that would add a key of a later
version, e.g. `behavior` or `links`, to a 1.0 document, or change the `format_version` of an existing document; the
message names `migrate`) and `MIGRATE_BLOCKED` (§11).

## 11. Versioning

- Each file declares `format_version` = `MAJOR.MINOR`. This specification defines `1.1` (current) and keeps
  `1.0` as an earlier supported version.
- A **minor** change only adds optional keys or values; a **major** change may break.
- Version equal to the supported one → normal load.
- Earlier supported version → load with warning `FORMAT_VERSION_OUTDATED`; the document is validated with the
  schema of its own version and stays writable within that version: writes keep its `format_version` and may not
  add keys of a later version (`MIGRATION_REQUIRED`). Its version only changes through the explicit migration
  (never when writing for another reason).
- Earlier version that is not supported (no schema or migration; in 1.1, every `0.x` version) → treated
  as a later version.
- Version later than the supported one (major or minor) → `FORMAT_VERSION_UNSUPPORTED`: the document is always
  loaded **read-only** with **tolerant reading**: it is interpreted with the schema of the highest supported
  version, ignoring unknown keys and values (they are not reported as `SCHEMA_VIOLATION`); elements
  without a valid `id` or without the minimal recognizable shape are dropped from queries. Every write to the
  document is rejected, as are the operations that would have to modify it (e.g. `rename`).
- The documents of `knowledge/` may have different versions from one another; each one is evaluated separately.
- The engine creates new documents (models, layouts, manifest) with the current version; an explicit `put` of a
  whole document and `rename` keep the version the document declares.
- Migrations (DEC-010): each version change ships a guide `migrations/<from>-to-<to>/` for agents and
  people, with a before/after example; the explicit `migrate` operation is the only write that changes the
  `format_version` of an existing document, and the only write allowed on a document whose version is not writable.

### 11.1 Version 1.1 and `migrate` 1.0 → 1.1

- 1.1 is a minor change (DEC-020): it only adds the optional keys `behavior` (§6.4) and `links` (§7.1), the semantic
  rule `LINK_SELF` and the reference types of §10.2. Every valid 1.0 document is valid 1.1 once its
  `format_version` is changed. A 1.0 reader (ai-submind 0.1.x) opens 1.1 documents read-only with tolerant reading.
- `migrate` (engine, MCP and CLI) rewrites `format_version` from `1.0` to `1.1` in every 1.0 document of
  `knowledge/` (models, layouts and manifest), in canonical form, and changes nothing else. The batch is validated
  as a whole and written sequentially; re-running it is idempotent (no 1.0 document → nothing written). It supports
  `dryRun`, which reports the documents that would change. Documents of any other version are left untouched.
- If a 1.0 document is not loaded (an error of phase 1 or 3), `migrate` fails with `MIGRATE_BLOCKED` and writes
  nothing: fix or restore the document first. Phase 4 findings do not block (the migration does not change them).
- Guide: [`migrations/1.0-to-1.1/`](migrations/1.0-to-1.1/README.md).

## 12. Differences from UMJ

| UMJ | ai-submind 1.1 | Reason |
|-----|----------------|--------|
| A single document with the model | one file per model + manifest + separate layout | diffs and merges in Git (DEC-002) |
| Arbitrary IDs from the source tool | readable, global IDs with deterministic derivation; the original goes to `external_id` | readability and queries (DEC-003) |
| Explicit `null` for unknown values | absence (or `null`) = unknown; the canonical form omits it | compact files, same meaning |
| The class lists its `generalizations` and `interfaces` in addition to the model | only in the model's `generalizations`/`realizations`; the engine computes the inverses | a single source; no inconsistencies |
| Package with `elements` by category | package with `members` (refs of any top-level type) | simpler; the type is resolved by ID |
| `visibility` on every named element | required on packages, classifiers, interactions, attributes and operations; optional on model, actor, association and association end; absent on generalization, dependency, realization, parameter, lifeline, message, fragments and diagrams | relevant in UML; less noise |
| Attribute flags also on operations; `is_query` also on attributes | operation: `is_static`, `is_abstract`, `is_query`; attribute: no `is_query` | only the meaningful ones |
| `exceptions` as texts | references to classifiers | referential integrity |
| Association end with `name` and `role` | `role` only | they were redundant |
| No actors | `actors` collection | actor lifelines and future use cases |
| Fragments distinguished by their shape | explicit `type` key | precise validation and errors |
| Execution specifications not taken from UMJ (UML: a fragment in the temporal order) | `executions` set on the interaction with `covered`, `start`, `finish` | activations explicit and validated; a position among fragments would mean nothing (DEC-018) |
| `class_diagrams` / `sequence_diagrams` with refs by category | `diagrams` with `kind` and `elements` | extensible registry of diagram types |
| Sequence diagram with several interactions | exactly one | unambiguous layout and rendering |
| Diagrams with `visibility` and `description` | no `visibility`; `documentation` | consistency with the extensions |
| No multiplicity or default value on attributes/parameters | `multiplicity`, `default_value` | needed for useful classes |
| No layout | `layout/<diagram-id>.json` | requirement of the viewer (REQ-010) |
| Aggregation without an explicit side | `end1` = whole | unambiguous semantics |
| No reference from an operation to the interaction that describes it (UML: `Operation.method`) | `behavior` on operations (1.1) | class → sequence navigation, typed (DEC-020) |
| No references to a whole model or diagram | `links` extension on every element with `id`, model and diagram (1.1) | flows of flows across files (DEC-020) |

## 13. Examples

[`examples/`](examples/README.md) (source repository only; not shipped in the npm package): a complete valid `knowledge/` (garage: every construct) and
invalid cases with the expected code. Migration guides with their own before/after examples:
[`migrations/`](migrations/1.0-to-1.1/README.md).
