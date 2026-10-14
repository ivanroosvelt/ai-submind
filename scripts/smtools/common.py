"""Utilidades compartidas por los validadores y generadores."""

from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

from . import miniyaml

ID_RE = re.compile(r"^([A-Z]+)-(\d{3,})$")
ID_IN_TEXT_RE = re.compile(r"\b([A-Z]{2,5})-(\d{3,})\b")
PLACEHOLDER_RE = re.compile(r"(\*|<|>|NNN|XXX|\{|\})")


@dataclass
class Finding:
    level: str  # "error" | "warning"
    code: str
    message: str
    path: str = ""


@dataclass
class Report:
    findings: list[Finding] = field(default_factory=list)

    def error(self, code: str, message: str, path: str | Path = "") -> None:
        self.findings.append(Finding("error", code, message, str(path)))

    def warn(self, code: str, message: str, path: str | Path = "") -> None:
        self.findings.append(Finding("warning", code, message, str(path)))

    @property
    def errors(self) -> list[Finding]:
        return [f for f in self.findings if f.level == "error"]

    @property
    def warnings(self) -> list[Finding]:
        return [f for f in self.findings if f.level == "warning"]

    def render(self, title: str, strict: bool = False) -> str:
        out = [f"== {title} =="]
        for f in sorted(self.findings, key=lambda f: (f.level != "error", f.path, f.code)):
            where = f" [{f.path}]" if f.path else ""
            out.append(f"{f.level.upper():7} {f.code}{where}: {f.message}")
        out.append(f"Resultado: {len(self.errors)} error(es), {len(self.warnings)} advertencia(s)"
                   + (" — modo strict: las advertencias cuentan como error" if strict and self.warnings else ""))
        return "\n".join(out)


def repo_root(start: Path | None = None) -> Path:
    here = (start or Path(__file__)).resolve()
    for p in [here, *here.parents]:
        if (p / "AGENTS.md").exists() and (p / "scripts").is_dir():
            return p
    raise SystemExit("No se encontró la raíz del repositorio (AGENTS.md + scripts/)")


def rel(root: Path, path: Path) -> str:
    try:
        return path.resolve().relative_to(root.resolve()).as_posix()
    except ValueError:
        return path.as_posix()


def read_yaml(path: Path, report: Report, root: Path):
    try:
        return miniyaml.parse(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        report.error("FILE-MISSING", "archivo requerido no existe", rel(root, path))
    except miniyaml.YamlError as exc:
        report.error("YAML-INVALID", str(exc), rel(root, path))
    return None


def read_front_matter(path: Path, report: Report, root: Path):
    """Devuelve (dict front matter, body). dict es None si falla."""
    text = path.read_text(encoding="utf-8")
    try:
        fm_text, body = miniyaml.split_front_matter(text)
        if fm_text is None:
            report.error("FM-MISSING", "falta front matter '---'", rel(root, path))
            return None, text
        data = miniyaml.parse(fm_text)
    except miniyaml.YamlError as exc:
        report.error("FM-INVALID", str(exc), rel(root, path))
        return None, text
    if not isinstance(data, dict):
        report.error("FM-INVALID", "el front matter debe ser un mapa", rel(root, path))
        return None, body
    return data, body


def as_list(value) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def read_ledger(path: Path) -> list[str]:
    if not path.exists():
        return []
    ids = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.split("#", 1)[0].strip()
        if line:
            ids.append(line)
    return ids


def check_ledger(ledger_path: Path, current_ids: set[str], prefixes: set[str],
                 report: Report, root: Path) -> None:
    """El ledger es append-only: todo ID asignado alguna vez figura en él."""
    where = rel(root, ledger_path)
    if not ledger_path.exists():
        report.error("LEDGER-MISSING", "no existe el registro de IDs asignados", where)
        return
    ledger = read_ledger(ledger_path)
    seen = set()
    for i in ledger:
        m = ID_RE.match(i)
        if not m or m.group(1) not in prefixes:
            report.error("LEDGER-ID", f"ID inválido o de prefijo ajeno en ledger: {i}", where)
        if i in seen:
            report.error("LEDGER-DUP", f"ID repetido en ledger: {i}", where)
        seen.add(i)
    for i in sorted(current_ids - seen):
        report.error("LEDGER-UNREGISTERED",
                     f"{i} existe pero no está en el ledger (añadirlo; usar `scripts/sysq next`)", where)
    for i in sorted(seen - current_ids):
        report.warn("LEDGER-NO-CARD",
                    f"{i} figura en el ledger sin ficha: si es una reserva sin usar, ignorar; si la ficha se borró, "
                    f"restaurarla con status retired", where)


def next_id(ledger_path: Path, prefix: str) -> str:
    nums = [int(m.group(2)) for i in read_ledger(ledger_path)
            if (m := ID_RE.match(i)) and m.group(1) == prefix]
    return f"{prefix}-{(max(nums) + 1 if nums else 1):03d}"


def check_code_ref(root: Path, ref: str, report: Report, where: str, code: str) -> None:
    """Valida `ruta` o `ruta#símbolo` relativa a la raíz del repositorio."""
    path_part, _, symbol = str(ref).partition("#")
    target = (root / path_part).resolve()
    if root.resolve() not in [target, *target.parents]:
        report.error(code, f"ruta fuera del repositorio: {ref}", where)
        return
    if not target.exists():
        report.error(code, f"ruta referenciada no existe: {path_part}", where)
        return
    if symbol:
        if target.is_dir():
            report.error(code, f"símbolo sobre directorio: {ref}", where)
            return
        text = target.read_text(encoding="utf-8", errors="replace")
        if not re.search(rf"(?<![\w$]){re.escape(symbol)}(?![\w$])", text):
            report.error(code, f"símbolo '{symbol}' no encontrado en {path_part}", where)


def git(root: Path, *args: str) -> str | None:
    try:
        out = subprocess.run(["git", *args], cwd=root, capture_output=True, text=True, check=True)
        return out.stdout
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def write_or_check(path: Path, content: str, check: bool, report: Report, root: Path,
                   regen_hint: str = "ejecutar scripts/regen") -> bool:
    """En modo check informa si el archivo generado está desactualizado."""
    current = path.read_text(encoding="utf-8") if path.exists() else None
    if current == content:
        return False
    if check:
        report.error("GENERATED-STALE", f"archivo generado desactualizado: {regen_hint}", rel(root, path))
        return True
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return True
