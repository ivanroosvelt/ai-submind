import { isMap, isScalar, isSeq } from "yaml";
import { diagnosticAt, sortDiagnostics, type Diagnostic } from "../diagnostics.js";
import { isIdentifier, parseYamlSource, type YamlSource } from "./yaml.js";
import { parseDocument } from "./document.js";
import type {
  CustomTagValue,
  DocumentUri,
  EntityDecl,
  KnowledgeMeta,
  MemoryType,
  ParsedDocument,
  Range,
  UseDecl,
} from "../ast.js";

const MEMORY_TYPES: readonly string[] = ["working", "short_term", "long_term"];
const REQUIRED = ["id", "title", "memory_type"];
const CONTEXT_TAG = /^[^:]+:.+$/;
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})\s*$/;

/** El `---` de apertura: ancla de E060, E062 y del E068 por esquema ausente. */
export function openingRange(): Range {
  return { start: { line: 1, column: 1 }, end: { line: 1, column: 4 } };
}

function closesFence(line: string, marker: string): boolean {
  const match = FENCE_CLOSE.exec(line);
  return match !== null && match[1][0] === marker[0] && match[1].length >= marker.length;
}

/**
 * Líneas de contenido `[start, end)` (índices 0-based) de cada bloque de
 * código cercado cuyo info-string es `flo` (decisión #28). Una cerca sin
 * cerrar llega a fin de archivo, como en CommonMark; lo de adentro de
 * cualquier cerca no abre otra.
 */
function floFences(lines: string[], from: number): { start: number; end: number }[] {
  const fences: { start: number; end: number }[] = [];
  for (let index = from; index < lines.length; index++) {
    const open = FENCE_OPEN.exec(lines[index]);
    if (!open) continue;
    let end = index + 1;
    while (end < lines.length && !closesFence(lines[end], open[1])) end++;
    if (open[2] === "flo") fences.push({ start: index + 1, end });
    index = end;
  }
  return fences;
}

function isDelimiter(line: string): boolean {
  return line.trimEnd() === "---";
}

/**
 * Un `.md` del workspace (spec de conocimiento §3). Devuelve null si la
 * primera línea no es `---`: no es un documento del workspace (decisión
 * #21). Su entidad va primera en `entities` (decisión #22).
 */
export function parseMarkdownDocument(
  source: string,
  uri: DocumentUri
): { document: ParsedDocument; diagnostics: Diagnostic[] } | null {
  const lines = source.split("\n");
  if (!isDelimiter(lines[0])) return null;

  const document: ParsedDocument = { uri, uses: [], entities: [], blocks: [] };
  const diagnostics: Diagnostic[] = [];
  const close = lines.findIndex((line, index) => index > 0 && isDelimiter(line));
  if (close === -1) {
    diagnostics.push(diagnosticAt("E060", "falta el '---' que cierra el frontmatter", openingRange()));
    return { document, diagnostics };
  }

  // El '\n' final evita que, con CRLF, el '\r' de la última línea del
  // frontmatter quede sin línea siguiente y la librería `yaml` lo trate
  // como parte del valor en vez de como fin de línea.
  const yaml = parseYamlSource(lines.slice(1, close).join("\n") + "\n", 2);
  const range: Range = { start: { line: 1, column: 1 }, end: { line: close + 1, column: 4 } };
  const body = lines.slice(close + 1).join("\n");
  const entity = readFrontmatter(yaml, uri, range, body, document.uses, diagnostics);
  if (entity) document.entities.push(entity);

  // Cada cerca se parsea sola (un bloque sin cerrar no se traga la
  // siguiente) sobre líneas vacías hasta su posición: los rangos salen
  // exactos sin desplazar nada.
  for (const fence of floFences(lines, close + 1)) {
    const embedded = parseDocument("\n".repeat(fence.start) + lines.slice(fence.start, fence.end).join("\n"), uri);
    document.uses.push(...embedded.document.uses);
    document.entities.push(...embedded.document.entities);
    document.blocks.push(...embedded.document.blocks);
    diagnostics.push(...embedded.diagnostics);
  }

  return { document, diagnostics: sortDiagnostics(diagnostics) };
}

/**
 * Valida el frontmatter campo por campo (decisión #27): un campo inválido
 * da un diagnóstico y no impide leer los demás. Hay entidad si y solo si
 * `id` es válido; con un error de sintaxis YAML no se valida nada.
 */
function readFrontmatter(
  yaml: YamlSource,
  uri: DocumentUri,
  range: Range,
  body: string,
  uses: UseDecl[],
  diagnostics: Diagnostic[]
): EntityDecl | null {
  diagnostics.push(...yaml.diagnostics);
  if (yaml.diagnostics.length > 0) return null;

  // Un frontmatter vacío (`---` seguido de `---`) es un mapa sin campos.
  const contents = isMap(yaml.contents) ? yaml.contents : null;
  if (yaml.contents !== null && contents === null) {
    diagnostics.push(diagnosticAt("E063", "el frontmatter debe ser un mapa de campos", yaml.rangeOf(yaml.contents)));
    return null;
  }

  const invalid = (node: unknown, message: string, fallback?: unknown): void => {
    diagnostics.push(diagnosticAt("E063", message, yaml.rangeOf(node, fallback)));
  };
  const listOf = (node: unknown, key: string, fallback: unknown): unknown[] => {
    if (isSeq(node)) return node.items;
    invalid(node, `'${key}' debe ser una lista`, fallback);
    return [];
  };

  const knowledge: KnowledgeMeta = {
    memoryType: null,
    typeTags: [],
    typeTagRanges: [],
    contextTags: [],
    customTags: {},
    relations: [],
    body,
  };
  let id: { value: string; range: Range } | null = null;
  let title: string | null = null;
  const present = new Set<string>();

  for (const pair of contents?.items ?? []) {
    const key = isScalar(pair.key) ? String(pair.key.value) : "?";
    const value = pair.value;
    present.add(key);
    switch (key) {
      case "id":
        if (isScalar(value) && isIdentifier(value.value)) id = { value: value.value, range: yaml.rangeOf(value) };
        else invalid(value, "'id' debe ser un identificador: letras, dígitos y '_', sin empezar con dígito", pair.key);
        break;
      case "title":
        if (isScalar(value) && typeof value.value === "string" && value.value.trim() !== "") title = value.value;
        else invalid(value, "'title' debe ser un texto no vacío", pair.key);
        break;
      case "memory_type":
        if (isScalar(value) && MEMORY_TYPES.includes(value.value as string)) {
          knowledge.memoryType = value.value as MemoryType;
        } else {
          diagnostics.push(
            diagnosticAt(
              "E064",
              "'memory_type' debe ser 'working', 'short_term' o 'long_term'",
              yaml.rangeOf(value, pair.key)
            )
          );
        }
        break;
      case "type_tags":
        for (const item of listOf(value, key, pair.key)) {
          if (isScalar(item) && isIdentifier(item.value)) {
            knowledge.typeTags.push(item.value);
            knowledge.typeTagRanges.push(yaml.rangeOf(item));
          } else {
            invalid(item, "cada 'type_tags' debe ser un identificador");
          }
        }
        break;
      case "context_tags":
        for (const item of listOf(value, key, pair.key)) {
          if (isScalar(item) && typeof item.value === "string" && CONTEXT_TAG.test(item.value)) {
            knowledge.contextTags.push(item.value);
          } else {
            invalid(item, "cada 'context_tags' debe tener la forma 'clave:valor'");
          }
        }
        break;
      case "custom_tags":
        if (!isMap(value)) {
          invalid(value, "'custom_tags' debe ser un mapa de clave a valor", pair.key);
          break;
        }
        for (const tag of value.items) {
          const tagValue = isScalar(tag.value) ? tag.value.value : undefined;
          if (isScalar(tag.key) && ["string", "number", "boolean"].includes(typeof tagValue)) {
            knowledge.customTags[String(tag.key.value)] = tagValue as CustomTagValue;
          } else {
            invalid(tag.value, "cada valor de 'custom_tags' debe ser un texto, un número o un booleano", tag.key);
          }
        }
        break;
      case "use":
        for (const item of listOf(value, key, pair.key)) {
          if (isScalar(item) && typeof item.value === "string" && item.value !== "") {
            const itemRange = yaml.rangeOf(item);
            uses.push({ path: item.value, range: itemRange, pathRange: itemRange });
          } else {
            invalid(item, "cada 'use' debe ser una ruta");
          }
        }
        break;
      case "relations":
        for (const item of listOf(value, key, pair.key)) readRelation(yaml, item, knowledge, diagnostics);
        break;
      default:
        diagnostics.push(diagnosticAt("E067", `campo desconocido '${key}' en el frontmatter`, yaml.rangeOf(pair.key)));
    }
  }

  for (const field of REQUIRED) {
    if (!present.has(field)) {
      diagnostics.push(diagnosticAt("E062", `falta el campo obligatorio '${field}'`, openingRange()));
    }
  }

  if (!id) return null;
  return {
    id: id.value,
    label: title ?? id.value,
    shape: "rectangle",
    type: null,
    tags: [],
    uri,
    range,
    nameRange: id.range,
    knowledge,
  };
}

/** `{ target, type }`; solo entra a `relations` si ambos son válidos. */
function readRelation(yaml: YamlSource, item: unknown, knowledge: KnowledgeMeta, diagnostics: Diagnostic[]): void {
  if (!isMap(item)) {
    diagnostics.push(diagnosticAt("E063", "cada relación debe ser un mapa con 'target' y 'type'", yaml.rangeOf(item)));
    return;
  }
  let target: unknown = undefined;
  let type: unknown = undefined;
  const keys = new Map<string, unknown>();
  for (const pair of item.items) {
    const key = isScalar(pair.key) ? String(pair.key.value) : "?";
    if (key === "target" || key === "type") {
      keys.set(key, pair.key);
      if (key === "target") target = pair.value;
      else type = pair.value;
    } else {
      diagnostics.push(diagnosticAt("E067", `campo desconocido '${key}' en la relación`, yaml.rangeOf(pair.key)));
    }
  }
  for (const field of ["target", "type"]) {
    if (!keys.has(field)) {
      diagnostics.push(diagnosticAt("E062", `a la relación le falta '${field}'`, yaml.rangeOf(item)));
    }
  }
  if (!keys.has("target") || !keys.has("type")) return;

  const targetNode = isScalar(target) && typeof target.value === "string" && target.value !== "" ? target : null;
  const typeNode = isScalar(type) && isIdentifier(type.value) ? type : null;
  if (!targetNode) {
    diagnostics.push(diagnosticAt("E063", "'target' debe ser una ruta o un id", yaml.rangeOf(target, keys.get("target"))));
  }
  if (!typeNode) {
    diagnostics.push(diagnosticAt("E063", "'type' debe ser un identificador", yaml.rangeOf(type, keys.get("type"))));
  }
  if (!targetNode || !typeNode) return;
  knowledge.relations.push({
    type: typeNode.value as string,
    target: targetNode.value as string,
    resolved: null,
    range: yaml.rangeOf(targetNode),
    typeRange: yaml.rangeOf(typeNode),
  });
}
