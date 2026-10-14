"""Carga, validación y generación de índices del modelo estructural del producto."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from .common import (ID_RE, Report, as_list, check_code_ref, check_ledger, git, read_front_matter,
                     read_yaml, rel, write_or_check)

SCHEMA_PATH = "docs/system/schema.yaml"
LEDGER_PATH = "docs/system/inventory/id-ledger.txt"
INVENTORY_PATH = "docs/system/inventory/INDEX.md"
MATRIX_PATH = "docs/system/traceability/MATRIX.md"
SKIP_NAMES = {"README.md", "INDEX.md"}
# Relaciones de composición por las que una pieza "contiene" pruebas (no dependencias ni consumidores).
TEST_PATH_KEYS = {"tests", "validations", "functions", "entities", "interfaces", "integrations"}


@dataclass
class Element:
    id: str
    prefix: str
    fields: dict
    path: str
    relations: dict[str, list[str]] = field(default_factory=dict)

    @property
    def name(self) -> str:
        return str(self.fields.get("name", ""))

    @property
    def status(self) -> str:
        return str(self.fields.get("status", ""))


@dataclass
class Model:
    schema: dict
    elements: dict[str, Element]

    def incoming(self) -> dict[str, list[tuple[str, str]]]:
        inc: dict[str, list[tuple[str, str]]] = {i: [] for i in self.elements}
        for e in self.elements.values():
            for key, targets in e.relations.items():
                for t in targets:
                    inc.setdefault(t, []).append((e.id, key))
        return inc


def load_schema(root: Path, report: Report) -> dict | None:
    schema = read_yaml(root / SCHEMA_PATH, report, root)
    if schema is None:
        return None
    if not isinstance(schema, dict) or not isinstance(schema.get("types"), dict):
        report.error("SCHEMA-INVALID", "schema.yaml debe definir 'types'", SCHEMA_PATH)
        return None
    for prefix, spec in schema["types"].items():
        if not isinstance(spec, dict) or "dir" not in spec or "type" not in spec:
            report.error("SCHEMA-INVALID", f"tipo {prefix} requiere 'type' y 'dir'", SCHEMA_PATH)
            return None
        spec.setdefault("relations", {})
        for key, targets in (spec["relations"] or {}).items():
            for t in as_list(targets):
                if t not in schema["types"]:
                    report.error("SCHEMA-INVALID", f"{prefix}.{key} apunta a prefijo desconocido {t}", SCHEMA_PATH)
    return schema


def load_model(root: Path, report: Report) -> Model | None:
    schema = load_schema(root, report)
    if schema is None:
        return None
    elements: dict[str, Element] = {}
    for prefix, spec in schema["types"].items():
        base = root / spec["dir"]
        if not base.is_dir():
            report.error("DIR-MISSING", f"directorio del tipo {prefix} no existe", spec["dir"])
            continue
        # Solo el directorio propio; los subdirectorios pertenecen a otros tipos.
        for path in sorted(base.glob("*.md")):
            if path.name in SKIP_NAMES:
                continue
            _load_card(root, path, prefix, spec, schema, elements, report)
    return Model(schema, elements)


def _load_card(root, path, prefix, spec, schema, elements, report):
    where = rel(root, path)
    fm, _ = read_front_matter(path, report, root)
    if fm is None:
        return
    for key in schema.get("common_required", []):
        if fm.get(key) in (None, ""):
            report.error("FIELD-MISSING", f"falta campo obligatorio '{key}'", where)
    allowed = set(schema.get("common_required", [])) | set(schema.get("common_optional", []))
    allowed |= set(as_list(spec.get("extra_fields")))
    for key in fm:
        if key not in allowed:
            report.warn("FIELD-UNKNOWN", f"campo no definido en schema.yaml: '{key}'", where)
    eid = str(fm.get("id", ""))
    m = ID_RE.match(eid)
    if not m:
        report.error("ID-FORMAT", f"ID con formato inválido: {eid!r}", where)
        return
    if m.group(1) != prefix:
        report.error("ID-PREFIX", f"{eid} está en el directorio de {prefix} ({spec['dir']})", where)
        return
    if not path.name.startswith(eid + "-") and path.stem != eid:
        report.error("FILE-NAME", f"el nombre del archivo debe empezar por '{eid}-'", where)
    if fm.get("type") and fm.get("type") != spec["type"]:
        report.error("TYPE-MISMATCH", f"type '{fm.get('type')}' no coincide con '{spec['type']}'", where)
    if fm.get("status") and fm["status"] not in schema["statuses"]:
        report.error("STATUS-INVALID", f"estado inválido: {fm['status']}", where)
    if fm.get("evidence") and fm["evidence"] not in schema["evidence_levels"]:
        report.error("EVIDENCE-INVALID", f"evidencia inválida: {fm['evidence']}", where)
    impl = fm.get("implementation")
    if impl is not None:
        if not spec.get("implementable"):
            report.error("IMPL-NOT-APPLICABLE", f"el tipo {prefix} no admite 'implementation'", where)
        elif impl not in schema["implementation_states"]:
            report.error("IMPL-INVALID", f"implementation inválido: {impl}", where)
    rels = fm.get("relations") or {}
    if not isinstance(rels, dict):
        report.error("REL-INVALID", "'relations' debe ser un mapa clave: [IDs]", where)
        rels = {}
    clean: dict[str, list[str]] = {}
    for key, targets in rels.items():
        if key not in (spec.get("relations") or {}):
            report.error("REL-KEY", f"relación '{key}' no permitida para {prefix} (ver schema.yaml)", where)
            continue
        clean[key] = [str(t) for t in as_list(targets)]
    if eid in elements:
        report.error("ID-DUP", f"{eid} duplicado (también en {elements[eid].path})", where)
        return
    elements[eid] = Element(eid, m.group(1), fm, where, clean)


def check_model(root: Path, report: Report, since: str | None = None) -> Model | None:
    model = load_model(root, report)
    if model is None:
        return None
    schema, elements = model.schema, model.elements
    incoming = model.incoming()
    for e in elements.values():
        spec = schema["types"][e.prefix]
        # Relaciones: destino existente, prefijo permitido, sin autorreferencia.
        for key, targets in e.relations.items():
            allowed = as_list(spec["relations"][key])
            for t in targets:
                tm = ID_RE.match(t)
                if not tm:
                    report.error("REL-TARGET", f"{key}: '{t}' no es un ID", e.path)
                elif tm.group(1) not in allowed:
                    report.error("REL-TARGET", f"{key}: {t} no es de tipo permitido {allowed}", e.path)
                elif t not in elements:
                    report.error("REL-BROKEN", f"{key}: {t} no existe", e.path)
                elif t == e.id:
                    report.error("REL-SELF", f"{key}: autorreferencia", e.path)
                elif elements[t].status == "retired" and e.status != "retired":
                    report.warn("REL-RETIRED", f"{key}: {t} está retirado", e.path)
        # Evidencia de implementación distinta de evidencia documental.
        code = as_list(e.fields.get("code"))
        test_code = as_list(e.fields.get("test_code"))
        for ref in code:
            check_code_ref(root, ref, report, e.path, "CODE-REF")
        for ref in test_code:
            check_code_ref(root, ref, report, e.path, "TEST-REF")
        impl = e.fields.get("implementation")
        if impl in ("implemented", "verified") and not code and e.prefix != "TST":
            report.error("IMPL-NO-CODE", f"implementation={impl} sin rutas en 'code'", e.path)
        if e.prefix == "TST" and impl in ("implemented", "verified") and not test_code:
            report.error("IMPL-NO-CODE", f"prueba {impl} sin rutas en 'test_code'", e.path)
        has_tests = bool(test_code) or _reaches_tests(e, elements)
        if impl == "verified" and not has_tests and e.prefix != "TST":
            report.error("VERIFIED-NO-TESTS", "implementation=verified sin pruebas alcanzables (TST o test_code propio o de sus elementos)", e.path)
        if impl == "implemented" and not has_tests and e.prefix in ("FUN", "API", "VAL", "INT"):
            report.warn("IMPL-NO-TESTS", "implementado sin pruebas referenciadas", e.path)
        if e.fields.get("evidence") == "verified-code" and not code and not test_code:
            report.error("EVIDENCE-NO-CODE", "evidence=verified-code sin 'code' ni 'test_code'", e.path)
        if e.status == "active" and e.fields.get("evidence") == "unknown":
            report.warn("ACTIVE-UNKNOWN", "elemento activo con evidencia 'unknown'", e.path)
        # Huérfanos y huecos de trazabilidad.
        if not any(e.relations.values()) and not incoming.get(e.id) and e.status != "retired":
            report.warn("ORPHAN", f"{e.id} no tiene relaciones entrantes ni salientes", e.path)
        if e.prefix == "REQ" and e.status == "active" and not e.relations.get("features"):
            report.warn("REQ-UNREALIZED", "requerimiento activo sin características", e.path)
        if e.prefix == "FEAT" and not any(k == "features" for _, k in incoming.get(e.id, [])):
            report.warn("FEAT-NO-REQ", "característica sin requerimiento que la origine", e.path)
    check_ledger(root / LEDGER_PATH, set(elements), set(schema["types"]), report, root)
    write_or_check(root / INVENTORY_PATH, render_inventory(model), True, report, root)
    write_or_check(root / MATRIX_PATH, render_matrix(model), True, report, root)
    if since:
        check_diff_sync(root, schema, since, report)
    return model


def _reaches_tests(start: Element, elements: dict[str, Element]) -> bool:
    """Una pieza está probada si alcanza (por relaciones salientes) un TST o código de prueba."""
    seen, stack = {start.id}, [start]
    while stack:
        cur = stack.pop()
        for key, targets in cur.relations.items():
            if key not in TEST_PATH_KEYS:
                continue
            for t in targets:
                el = elements.get(t)
                if el is None or t in seen:
                    continue
                if el.prefix == "TST" or as_list(el.fields.get("test_code")):
                    return True
                seen.add(t)
                stack.append(el)
    return False


def check_diff_sync(root: Path, schema: dict, since: str, report: Report) -> None:
    """Aviso si el diff toca código del producto sin tocar el modelo estructural."""
    roots = [r.rstrip("/") + "/" for r in as_list(schema.get("code_roots"))]
    if not roots:
        return
    out = git(root, "diff", "--name-only", since)
    if out is None:
        report.warn("DIFF-UNAVAILABLE", f"no se pudo calcular el diff contra {since}")
        return
    untracked = git(root, "ls-files", "--others", "--exclude-standard") or ""
    changed = [l for l in (out + untracked).splitlines() if l]
    code = [p for p in changed if any(p.startswith(r) for r in roots)]
    model = [p for p in changed if p.startswith("docs/system/")]
    if code and not model:
        report.warn("MODEL-NOT-UPDATED",
                    f"{len(code)} archivo(s) de código cambiaron sin cambios en docs/system/ "
                    f"(p. ej. {code[0]}); confirmar que el modelo no requiere actualización")


# --- Generadores -----------------------------------------------------------

HEADER = "<!-- Generado por scripts/regen a partir de las fichas. No editar a mano. -->\n"


def render_inventory(model: Model) -> str:
    els = sorted(model.elements.values(), key=lambda e: (e.prefix, e.id))
    lines = [HEADER, "# Inventario del modelo estructural", "",
             "Una fila por elemento. Relaciones: una línea `ORIGEN relación DESTINO` (buscable con grep).", ""]
    if not els:
        lines += ["_Sin elementos registrados todavía._", ""]
    else:
        lines += ["| ID | Tipo | Nombre | Estado | Impl. | Evidencia | Ficha |",
                  "|----|------|--------|--------|-------|-----------|-------|"]
        for e in els:
            lines.append(f"| {e.id} | {e.fields.get('type', '')} | {e.name} | {e.status} | "
                         f"{e.fields.get('implementation') or '-'} | {e.fields.get('evidence', '')} | "
                         f"[{e.path.rsplit('/', 1)[-1]}](../../../{e.path}) |")
        lines += ["", "## Relaciones", ""]
        rels = [f"{e.id} {k} {t}" for e in els for k, ts in sorted(e.relations.items()) for t in ts]
        lines += [f"- `{r}`" for r in rels] or ["_Sin relaciones._"]
        lines.append("")
    return "\n".join(lines)


def render_matrix(model: Model) -> str:
    el = model.elements
    inc = model.incoming()
    lines = [HEADER, "# Matriz de trazabilidad", "",
             "Requerimiento → Característica → Elementos → Validaciones → Pruebas → Decisiones.", ""]
    reqs = sorted((e for e in el.values() if e.prefix == "REQ"), key=lambda e: e.id)
    if not reqs:
        lines += ["_Sin requerimientos registrados todavía._", ""]
    else:
        lines += ["| REQ | FEAT | Elementos | Validaciones | Pruebas | Decisiones |",
                  "|-----|------|-----------|--------------|---------|------------|"]
        for r in reqs:
            feats = r.relations.get("features", []) or ["—"]
            for f in feats:
                fe = el.get(f)
                parts = []
                if fe:
                    for k in ("entities", "functions", "interfaces", "integrations"):
                        parts += fe.relations.get(k, [])
                vals, tests, decs = set(r.relations.get("constraints", [])), set(), set(r.relations.get("decisions", []))
                for x in [f, *parts]:
                    xe = el.get(x)
                    if not xe:
                        continue
                    vals |= set(xe.relations.get("validations", []))
                    tests |= set(xe.relations.get("tests", []))
                    decs |= set(xe.relations.get("decisions", []))
                    decs |= {s for s, k in inc.get(x, []) if k == "affects"}
                for v in list(vals):
                    if v in el:
                        tests |= set(el[v].relations.get("tests", []))
                fmt = lambda xs: ", ".join(sorted(xs)) or "—"
                lines.append(f"| {r.id} | {f} | {fmt(parts)} | {fmt(vals)} | {fmt(tests)} | {fmt(decs)} |")
        lines.append("")
    reached = {t for e in el.values() for ts in e.relations.values() for t in ts} | {e.id for e in reqs}
    loose = sorted(i for i, e in el.items() if i not in reached and e.prefix in ("FEAT", "FUN", "ENT", "API", "INT"))
    lines += ["## Elementos sin trazabilidad entrante", ""]
    lines += [f"- {i}" for i in loose] or ["_Ninguno._"]
    lines.append("")
    return "\n".join(lines)


def regen_model(root: Path, report: Report) -> list[str]:
    model = load_model(root, report)
    if model is None:
        return []
    changed = []
    if write_or_check(root / INVENTORY_PATH, render_inventory(model), False, report, root):
        changed.append(INVENTORY_PATH)
    if write_or_check(root / MATRIX_PATH, render_matrix(model), False, report, root):
        changed.append(MATRIX_PATH)
    return changed
