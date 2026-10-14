"""Validación y generación del entorno de orquestación de IA."""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

from .common import (ID_IN_TEXT_RE, ID_RE, PLACEHOLDER_RE, Report, as_list, check_ledger,
                     read_front_matter, read_yaml, rel, write_or_check)

COMPONENTS = ".ai/registry/components.yaml"
CAPABILITIES = ".ai/registry/capabilities.yaml"
COVERAGE = ".ai/registry/coverage.yaml"
LEDGER = ".ai/registry/id-ledger.txt"
AGENTS_INDEX = ".ai/registry/agents-index.md"
SKILLS_INDEX = ".ai/registry/skills-index.md"
COPILOT = ".github/copilot-instructions.md"
ENV_PREFIXES = {"AGT", "SKL", "CAP", "EDR", "PLAN", "REP"}

CAP_STATUSES = {"covered", "partial", "gap", "deferred"}
COMPONENT_STATUSES = {"proposed", "active", "deprecated", "retired"}
EDR_STATUSES = {"proposed", "accepted", "superseded", "deprecated"}
PLAN_STATUSES = {"proposed", "ready", "in_progress", "blocked", "verified", "completed", "cancelled", "superseded"}
PLAN_ACTIVE = {"proposed", "ready", "in_progress", "blocked", "verified"}
PLAN_ARCHIVED = {"completed", "cancelled", "superseded"}
STAGE_STATUSES = {"proposed", "ready", "in_progress", "blocked", "executed", "verified", "cancelled"}
REPORT_STATUSES = {"current", "archived"}

# Herramientas conocidas de Claude Code (revisar en environment-audit si cambian).
KNOWN_TOOLS = {"Read", "Write", "Edit", "MultiEdit", "Glob", "Grep", "Bash", "WebFetch", "WebSearch",
               "NotebookEdit", "Agent", "Task", "TodoWrite", "Skill", "ToolSearch", "LSP"}
REQUIRED_SECTIONS = {"agents": ["Responsabilidad", "Entradas", "Salidas", "Límites", "Finalización"],
                     "skills": ["Entradas", "Procedimiento", "Salida", "Límites"]}
NAME_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
LINK_RE = re.compile(r"\[[^\]]*\]\(([^)\s]+)\)")
TICK_PATH_RE = re.compile(r"`((?:AGENTS\.md|CLAUDE\.md|\.ai/|\.claude/|\.github/|docs/|scripts/)[^`\s]*)`")
BEGIN = "<!-- BEGIN AGENTS.md"
END = "<!-- END AGENTS.md -->"

# Archivos de instrucciones: sus referencias rotas son errores, no avisos.
INSTRUCTION_GLOBS = ["AGENTS.md", "CLAUDE.md", ".github/copilot-instructions.md",
                     ".claude/agents/*.md", ".claude/skills/*/SKILL.md", ".ai/policies/*.md"]
DOC_GLOBS = [".ai/**/*.md", "docs/**/*.md"]


def _md_files(root: Path, globs: list[str]) -> list[Path]:
    seen: dict[Path, None] = {}
    for g in globs:
        for p in sorted(root.glob(g)):
            if p.is_file() and "docs/templates/" not in rel(root, p):
                seen[p] = None
    return list(seen)


def load_components(root: Path, report: Report) -> dict[str, dict]:
    data = read_yaml(root / COMPONENTS, report, root) or {}
    comps: dict[str, dict] = {}
    for kind, prefix in (("agents", "AGT"), ("skills", "SKL")):
        for c in as_list(data.get(kind)):
            cid = str(c.get("id", ""))
            m = ID_RE.match(cid)
            if not m or m.group(1) != prefix:
                report.error("COMP-ID", f"ID inválido para {kind}: {cid!r}", COMPONENTS)
                continue
            if cid in comps:
                report.error("COMP-DUP", f"ID duplicado {cid}", COMPONENTS)
                continue
            c["kind"] = kind
            comps[cid] = c
    return comps


def check_components(root: Path, comps: dict[str, dict], report: Report) -> dict[str, dict]:
    """Valida el formato nativo de Claude Code y la coherencia con el registro."""
    natives: dict[str, dict] = {}
    names = {}
    for cid, c in comps.items():
        path = root / str(c.get("path", ""))
        where = rel(root, path)
        if c.get("status") not in COMPONENT_STATUSES:
            report.error("COMP-STATUS", f"{cid}: estado inválido {c.get('status')!r}", COMPONENTS)
        if c.get("status") == "retired":
            # lifecycle.md: el archivo nativo se elimina para que la plataforma no lo cargue.
            if c.get("path") and path.exists():
                report.error("COMP-RETIRED-PRESENT", f"{cid} retirado pero su archivo nativo sigue existiendo", where)
            continue
        if not c.get("path") or not path.is_file():
            report.error("COMP-MISSING", f"{cid}: archivo nativo no existe: {c.get('path')}", COMPONENTS)
            continue
        fm, body = read_front_matter(path, report, root)
        if fm is None:
            continue
        name = str(fm.get("name", ""))
        desc = str(fm.get("description", ""))
        expected = path.parent.name if c["kind"] == "skills" else path.stem
        if not NAME_RE.match(name) or len(name) > 64:
            report.error("NATIVE-NAME", f"name inválido (minúsculas, guiones, ≤64): {name!r}", where)
        if name != expected:
            report.error("NATIVE-NAME", f"name '{name}' debe coincidir con '{expected}'", where)
        if name != c.get("name"):
            report.error("COMP-NAME", f"{cid}: registro dice '{c.get('name')}', archivo dice '{name}'", COMPONENTS)
        if not desc:
            report.error("NATIVE-DESC", "falta 'description' (la usa la plataforma para activar el componente)", where)
        elif len(desc) > 1024:
            report.error("NATIVE-DESC", f"description supera 1024 caracteres ({len(desc)})", where)
        if c["kind"] == "agents" and fm.get("tools"):
            for tool in (t.strip() for t in str(fm["tools"]).split(",")):
                if tool and tool.split("(")[0] not in KNOWN_TOOLS and not tool.startswith("mcp__"):
                    report.warn("NATIVE-TOOL", f"herramienta desconocida '{tool}' (¿errata o herramienta nueva?)", where)
        for section in REQUIRED_SECTIONS[c["kind"]]:
            if not re.search(rf"^## {section}\b", body, re.M):
                report.error("COMP-SECTION", f"falta la sección '## {section}'", where)
        if f"ID: {cid}" not in body:
            report.error("COMP-ID-BODY", f"el cuerpo debe declarar 'ID: {cid}'", where)
        if "AGENTS.md" not in body:
            report.error("COMP-CANON", "el componente debe referenciar AGENTS.md", where)
        if name in names:
            report.error("COMP-DUP", f"name '{name}' repetido ({names[name]})", where)
        names[name] = cid
        natives[cid] = {"fm": fm, "body": body, "path": where}
    registered = {str(c.get("path")) for c in comps.values()}
    for p in [*root.glob(".claude/agents/*.md"), *root.glob(".claude/skills/*/SKILL.md")]:
        if rel(root, p) not in registered:
            report.error("COMP-UNREGISTERED", "componente nativo no registrado en components.yaml", rel(root, p))
    return natives


def load_capabilities(root: Path, comps: dict, report: Report, edrs: dict[str, str] | None = None) -> dict[str, dict]:
    data = read_yaml(root / CAPABILITIES, report, root) or {}
    caps: dict[str, dict] = {}
    for c in as_list(data.get("capabilities")):
        cid = str(c.get("id", ""))
        if not ID_RE.match(cid) or not cid.startswith("CAP-"):
            report.error("CAP-ID", f"ID de capacidad inválido: {cid!r}", CAPABILITIES)
            continue
        if cid in caps:
            report.error("CAP-DUP", f"capacidad duplicada {cid}", CAPABILITIES)
        caps[cid] = c
        st = c.get("status")
        if st not in CAP_STATUSES:
            report.error("CAP-STATUS", f"{cid}: estado inválido {st!r}", CAPABILITIES)
        providers = [str(p) for p in as_list(c.get("providers"))]
        for p in providers:
            if p not in comps:
                report.error("CAP-PROVIDER", f"{cid}: proveedor {p} no registrado", CAPABILITIES)
        active = [p for p in providers if comps.get(p, {}).get("status") == "active"]
        if st == "covered" and not active:
            report.error("CAP-UNCOVERED", f"{cid} marcada 'covered' sin proveedores activos", CAPABILITIES)
        accepted = str(c.get("accepted_by") or "")
        if st in ("gap", "deferred", "partial"):
            if not c.get("notes"):
                report.error("CAP-NOTES", f"{cid} '{st}' sin 'notes' que expliquen qué la desbloquea", CAPABILITIES)
            if not accepted:
                report.warn("CAP-OPEN", f"{cid} ({c.get('name')}): {st} sin aceptar — {c.get('notes', '')}", CAPABILITIES)
        if accepted:
            if st not in ("gap", "deferred", "partial"):
                report.error("CAP-ACCEPTED", f"{cid}: 'accepted_by' solo aplica a capacidades abiertas", CAPABILITIES)
            elif edrs is not None and edrs.get(accepted) != "accepted":
                report.error("CAP-ACCEPTED", f"{cid}: 'accepted_by' debe ser una EDR existente con status accepted "
                             f"({accepted}: {edrs.get(accepted, 'no existe')})", CAPABILITIES)
    used = {str(p) for c in caps.values() for p in as_list(c.get("providers"))}
    for cid, comp in comps.items():
        if cid not in used and comp.get("status") == "active":
            report.warn("COMP-NO-CAP", f"{cid} no aporta ninguna capacidad registrada", COMPONENTS)
    return caps


def check_coverage(root: Path, caps: dict, report: Report) -> None:
    data = read_yaml(root / COVERAGE, report, root) or {}
    keys = set()
    for p in as_list(data.get("perspectives")):
        key = p.get("key")
        if key in keys:
            report.error("COV-DUP", f"perspectiva duplicada {key}", COVERAGE)
        keys.add(key)
        cs = [str(c) for c in as_list(p.get("capabilities"))]
        if not cs:
            report.error("COV-EMPTY", f"perspectiva '{key}' sin capacidades asignadas", COVERAGE)
        for c in cs:
            if c not in caps:
                report.error("COV-CAP", f"perspectiva '{key}' referencia {c} inexistente", COVERAGE)
    referenced = {str(c) for p in as_list(data.get("perspectives")) for c in as_list(p.get("capabilities"))}
    for c in caps:
        if c not in referenced:
            report.warn("CAP-NO-PERSPECTIVE", f"{c} no está asociada a ninguna perspectiva", COVERAGE)


def check_entrypoints(root: Path, report: Report) -> None:
    for f in ("AGENTS.md", "CLAUDE.md", COPILOT):
        if not (root / f).is_file():
            report.error("ENTRY-MISSING", "punto de entrada obligatorio no existe", f)
    claude = root / "CLAUDE.md"
    if claude.is_file() and not re.search(r"^@AGENTS\.md\s*$", claude.read_text(encoding="utf-8"), re.M):
        report.error("ENTRY-IMPORT", "CLAUDE.md debe importar AGENTS.md con una línea '@AGENTS.md'", "CLAUDE.md")


def render_copilot(root: Path) -> str | None:
    """Reinserta AGENTS.md entre marcadores en copilot-instructions.md."""
    path, agents = root / COPILOT, root / "AGENTS.md"
    if not path.is_file() or not agents.is_file():
        return None
    text = path.read_text(encoding="utf-8")
    canon = agents.read_text(encoding="utf-8")
    if BEGIN not in text or END not in text:
        return None
    digest = hashlib.sha256(canon.encode()).hexdigest()[:16]
    head = text[: text.index(BEGIN)]
    tail = text[text.index(END) + len(END):]
    block = f"{BEGIN} · generado por scripts/regen · sha256:{digest} · no editar -->\n{canon.rstrip()}\n{END}"
    return head + block + tail


def _component_rows(comps, natives, caps, kind):
    rows = []
    for cid, c in sorted(comps.items()):
        if c["kind"] != kind:
            continue
        desc = str(natives.get(cid, {}).get("fm", {}).get("description", "")).replace("|", "\\|")
        provided = sorted(k for k, cap in caps.items() if cid in [str(p) for p in as_list(cap.get("providers"))])
        path = f"`{c.get('path')}`" if c.get("status") != "retired" else "— (retirado)"
        caps_txt = ", ".join(provided) or "—"
        rows.append(f"| {cid} | `{c.get('name')}` | {c.get('status')} | {caps_txt} | {path} | {desc} |")
    return rows


def render_index(comps, natives, caps, kind) -> str:
    title = "Agentes" if kind == "agents" else "Skills"
    lines = ["<!-- Generado por scripts/regen desde components.yaml, capabilities.yaml y los archivos nativos. No editar. -->",
             "", f"# Índice de {title.lower()}", "",
             "Fuente canónica de IDs: `.ai/registry/components.yaml`. Definición: archivo nativo.", "",
             "| ID | Nombre | Estado | Capacidades | Archivo | Descripción |",
             "|----|--------|--------|-------------|---------|-------------|"]
    rows = _component_rows(comps, natives, caps, kind)
    lines += rows or ["| — | — | — | — | — | Sin componentes registrados |"]
    return "\n".join(lines) + "\n"


def check_decisions(root: Path, report: Report) -> dict[str, str]:
    ids: dict[str, str] = {}
    for p in sorted((root / ".ai/decisions").glob("*.md")):
        if p.name in ("README.md", "INDEX.md"):
            continue
        fm, _ = read_front_matter(p, report, root)
        if fm is None:
            continue
        i = str(fm.get("id", ""))
        where = rel(root, p)
        if not ID_RE.match(i) or not i.startswith("EDR-"):
            report.error("EDR-ID", f"ID inválido {i!r}", where)
            continue
        if not p.name.startswith(i + "-"):
            report.error("FILE-NAME", f"el archivo debe empezar por '{i}-'", where)
        if fm.get("status") not in EDR_STATUSES:
            report.error("EDR-STATUS", f"estado inválido {fm.get('status')!r}", where)
        for k in ("title", "date"):
            if not fm.get(k):
                report.error("FIELD-MISSING", f"falta '{k}'", where)
        if i in ids:
            report.error("ID-DUP", f"{i} duplicado", where)
        ids[i] = str(fm.get("status"))
    return ids


def check_plans(root: Path, report: Report) -> set[str]:
    ids = set()
    for sub, allowed in (("active", PLAN_ACTIVE), ("archive", PLAN_ARCHIVED)):
        for p in sorted((root / "docs/plans" / sub).glob("*.md")):
            if p.name in ("README.md", "INDEX.md"):
                continue
            where = rel(root, p)
            fm, _ = read_front_matter(p, report, root)
            if fm is None:
                continue
            i = str(fm.get("id", ""))
            if not ID_RE.match(i) or not i.startswith("PLAN-"):
                report.error("PLAN-ID", f"ID inválido {i!r}", where)
                continue
            if not p.name.startswith(i + "-"):
                report.error("FILE-NAME", f"el archivo debe empezar por '{i}-'", where)
            if i in ids:
                report.error("ID-DUP", f"{i} duplicado", where)
            ids.add(i)
            st = fm.get("status")
            if st not in PLAN_STATUSES:
                report.error("PLAN-STATUS", f"estado inválido {st!r}", where)
            elif st not in allowed:
                report.error("PLAN-LOCATION", f"plan '{st}' no debe estar en docs/plans/{sub}/", where)
            stages = as_list(fm.get("stages"))
            if not stages:
                report.error("PLAN-STAGES", "el plan no define 'stages'", where)
            for s in stages:
                if not isinstance(s, dict) or s.get("status") not in STAGE_STATUSES:
                    report.error("STAGE-STATUS", f"etapa con estado inválido: {s!r}", where)
                elif s.get("status") == "verified" and not s.get("evidence"):
                    report.error("STAGE-EVIDENCE", f"etapa {s.get('id')} 'verified' sin 'evidence'", where)
            if st in ("completed", "verified"):
                pending = [s.get("id") for s in stages if isinstance(s, dict)
                           and s.get("status") not in ("verified", "cancelled")]
                if pending:
                    report.error("PLAN-INCOMPLETE", f"plan '{st}' con etapas sin verificar: {pending}", where)
            if sub == "active" and not fm.get("next_action"):
                report.error("PLAN-NEXT", "plan activo sin 'next_action' (punto de reanudación)", where)
            if st == "blocked" and not fm.get("blockers"):
                report.warn("PLAN-BLOCKERS", "plan bloqueado sin 'blockers'", where)
    return ids


def check_reports(root: Path, report: Report) -> set[str]:
    ids = set()
    for sub, expected in (("current", "current"), ("archive", "archived")):
        for p in sorted((root / "docs/reports" / sub).glob("*.md")):
            if p.name in ("README.md", "INDEX.md"):
                continue
            where = rel(root, p)
            fm, _ = read_front_matter(p, report, root)
            if fm is None:
                continue
            i = str(fm.get("id", ""))
            if not ID_RE.match(i) or not i.startswith("REP-"):
                report.error("REP-ID", f"ID inválido {i!r}", where)
                continue
            if fm.get("status") != expected:
                report.error("REP-STATUS", f"en {sub}/ el estado debe ser '{expected}'", where)
            if i in ids:
                report.error("ID-DUP", f"{i} duplicado", where)
            ids.add(i)
    return ids


def _strip_embedded(text: str) -> str:
    if BEGIN in text and END in text:
        return text[: text.index(BEGIN)] + text[text.index(END) + len(END):]
    return text


def check_references(root: Path, known_ids: set[str], report: Report) -> None:
    """Enlaces Markdown, rutas entre backticks e IDs del entorno deben resolver."""
    strict = set(_md_files(root, INSTRUCTION_GLOBS))
    for path in _md_files(root, INSTRUCTION_GLOBS + DOC_GLOBS):
        where = rel(root, path)
        text = _strip_embedded(path.read_text(encoding="utf-8"))
        # Bloques de código y comentarios HTML pueden contener ejemplos.
        text = re.sub(r"```.*?```", "", text, flags=re.S)
        text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
        add = report.error if path in strict else report.warn
        for target in LINK_RE.findall(text):
            if re.match(r"^[a-z]+:", target) or target.startswith("#") or PLACEHOLDER_RE.search(target):
                continue
            t = target.split("#", 1)[0]
            if t and not (path.parent / t).exists():
                add("LINK-BROKEN", f"enlace roto: {target}", where)
        for target in TICK_PATH_RE.findall(text):
            if PLACEHOLDER_RE.search(target):
                continue
            if not (root / target.split("#", 1)[0]).exists():
                add("PATH-BROKEN", f"ruta referenciada no existe: {target}", where)
        for prefix, num in ID_IN_TEXT_RE.findall(text):
            i = f"{prefix}-{num}"
            if prefix in ENV_PREFIXES and i not in known_ids:
                add("ID-BROKEN", f"{i} referenciado pero no existe", where)


def check_duplicates(root: Path, report: Report) -> None:
    """Detecta reglas copiadas de AGENTS.md en adaptadores y componentes."""
    canon_path = root / "AGENTS.md"
    if not canon_path.is_file():
        return
    norm = lambda s: re.sub(r"\s+", " ", s.strip(" -*>#\t")).lower()
    canon = {norm(l) for l in canon_path.read_text(encoding="utf-8").splitlines() if len(norm(l)) >= 50}
    targets = [root / "CLAUDE.md", root / COPILOT, *root.glob(".claude/agents/*.md"),
               *root.glob(".claude/skills/*/SKILL.md")]
    for t in targets:
        if not t.is_file():
            continue
        lines = _strip_embedded(t.read_text(encoding="utf-8")).splitlines()
        dups = [l for l in lines if norm(l) in canon]
        if dups:
            report.warn("DUP-INSTRUCTION", f"{len(dups)} línea(s) copiadas de AGENTS.md; referenciar en lugar de duplicar: "
                        f"{dups[0].strip()[:60]!r}", rel(root, t))


def check_environment(root: Path, report: Report) -> None:
    check_entrypoints(root, report)
    comps = load_components(root, report)
    natives = check_components(root, comps, report)
    edrs = check_decisions(root, report)
    caps = load_capabilities(root, comps, report, edrs)
    check_coverage(root, caps, report)
    plans = check_plans(root, report)
    reps = check_reports(root, report)
    all_ids = set(comps) | set(caps) | set(edrs) | plans | reps
    check_ledger(root / LEDGER, all_ids, ENV_PREFIXES, report, root)
    check_references(root, all_ids, report)
    check_duplicates(root, report)
    copilot = render_copilot(root)
    if copilot is None:
        report.error("ADAPTER-MARKERS", f"faltan marcadores '{BEGIN}' / '{END}'", COPILOT)
    else:
        write_or_check(root / COPILOT, copilot, True, report, root)
    write_or_check(root / AGENTS_INDEX, render_index(comps, natives, caps, "agents"), True, report, root)
    write_or_check(root / SKILLS_INDEX, render_index(comps, natives, caps, "skills"), True, report, root)


def regen_environment(root: Path, report: Report) -> list[str]:
    comps = load_components(root, report)
    natives = check_components(root, comps, Report())
    caps = load_capabilities(root, comps, Report())
    changed = []
    copilot = render_copilot(root)
    if copilot is not None and write_or_check(root / COPILOT, copilot, False, report, root):
        changed.append(COPILOT)
    for path, kind in ((AGENTS_INDEX, "agents"), (SKILLS_INDEX, "skills")):
        if write_or_check(root / path, render_index(comps, natives, caps, kind), False, report, root):
            changed.append(path)
    return changed
