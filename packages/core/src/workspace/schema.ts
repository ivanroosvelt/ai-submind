import { isMap, isScalar, isSeq } from "yaml";
import { isIdentifier, parseYamlSource } from "../parser/yaml.js";
import { diagnosticAt, sortDiagnostics, type Diagnostic } from "../diagnostics.js";
import type { ParsedDocument } from "../ast.js";

/** El esquema vive en la raíz del workspace con este uri exacto (decisión #20). */
export const SCHEMA_URI = "knowledge.schema.yaml";

export interface KnowledgeSchema {
  typeTags: Set<string>;
  relationTypes: Set<string>;
}

/** "missing" = no hay documento de esquema; "invalid" = lo hay y tiene diagnósticos. */
export type Vocabulary = KnowledgeSchema | "missing" | "invalid";

const FIELDS = { type_tags: "typeTags", relation_types: "relationTypes" } as const;

/** `type_tags` y `relation_types`, ambas listas de identificadores y obligatorias. */
export function parseSchema(source: string): { schema: KnowledgeSchema | null; diagnostics: Diagnostic[] } {
  const yaml = parseYamlSource(source, 1);
  if (yaml.diagnostics.length > 0) return { schema: null, diagnostics: yaml.diagnostics };

  const diagnostics: Diagnostic[] = [];
  const invalid = (node: unknown, message: string, fallback?: unknown): void => {
    diagnostics.push(diagnosticAt("E068", message, yaml.rangeOf(node, fallback)));
  };
  const schema: KnowledgeSchema = { typeTags: new Set(), relationTypes: new Set() };

  if (!isMap(yaml.contents)) {
    invalid(yaml.contents, "el esquema debe ser un mapa con 'type_tags' y 'relation_types'");
    return { schema: null, diagnostics };
  }
  const present = new Set<string>();
  for (const pair of yaml.contents.items) {
    const key = isScalar(pair.key) ? String(pair.key.value) : "?";
    if (key !== "type_tags" && key !== "relation_types") {
      invalid(pair.key, `campo desconocido '${key}' en el esquema`);
      continue;
    }
    present.add(key);
    if (!isSeq(pair.value)) {
      invalid(pair.value, `'${key}' debe ser una lista de identificadores`, pair.key);
      continue;
    }
    for (const item of pair.value.items) {
      if (isScalar(item) && isIdentifier(item.value)) schema[FIELDS[key]].add(item.value);
      else invalid(item, `cada valor de '${key}' debe ser un identificador`);
    }
  }
  for (const key of Object.keys(FIELDS)) {
    if (!present.has(key)) invalid(null, `falta '${key}' en el esquema`);
  }
  return { schema: diagnostics.length === 0 ? schema : null, diagnostics: sortDiagnostics(diagnostics) };
}

/** E065 / E066 para las entidades de conocimiento de un documento. */
export function checkVocabulary(document: ParsedDocument, schema: KnowledgeSchema, diagnostics: Diagnostic[]): void {
  for (const entity of document.entities) {
    const knowledge = entity.knowledge;
    if (!knowledge) continue;
    knowledge.typeTags.forEach((tag, index) => {
      if (!schema.typeTags.has(tag)) {
        diagnostics.push(
          diagnosticAt("E065", `el type_tag '${tag}' no está declarado en '${SCHEMA_URI}'`, knowledge.typeTagRanges[index])
        );
      }
    });
    for (const relation of knowledge.relations) {
      if (!schema.relationTypes.has(relation.type)) {
        diagnostics.push(
          diagnosticAt("E066", `el tipo de relación '${relation.type}' no está declarado en '${SCHEMA_URI}'`, relation.typeRange)
        );
      }
    }
  }
}
