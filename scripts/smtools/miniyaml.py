"""Parser de un subconjunto estricto de YAML, sin dependencias externas.

Subconjunto admitido (ver docs/system/conventions.md):
- Mapas en bloque (`clave: valor`) y secuencias en bloque (`- valor`).
- Elementos de secuencia que son mapas (`- clave: valor` + claves siguientes).
- Listas en línea de escalares: `[A, B, "c d"]`. Mapa vacío en línea: `{}`.
- Escalares: cadenas sin comillas, "dobles" (escapes JSON), 'simples',
  enteros, true/false, null/~.
- Comentarios con `#` al inicio o precedidos de espacio.

No admitido (se rechaza con error): tabuladores de indentación, escalares de
bloque (`|`, `>`), anclas/alias, mapas en línea no vacíos, cadenas sin
comillas que contengan ": ".
"""

from __future__ import annotations

import json
import re

KEY_RE = re.compile(r"^([A-Za-z0-9_][A-Za-z0-9_.\-]*):(?:\s+(.*))?$")
INT_RE = re.compile(r"^-?\d+$")


class YamlError(ValueError):
    pass


def _strip_comment(line: str) -> str:
    quote, escaped = None, False
    for i, ch in enumerate(line):
        if quote:
            if escaped:
                escaped = False
            elif ch == "\\" and quote == '"':
                escaped = True
            elif ch == quote:
                quote = None
        elif ch in "\"'" and (i == 0 or line[i - 1] in " \t[,:-"):
            quote = ch
        elif ch == "#" and (i == 0 or line[i - 1] in " \t"):
            return line[:i].rstrip()
    return line.rstrip()


def _split_inline(body: str, lineno: int) -> list[str]:
    parts, buf, quote = [], [], None
    for ch in body:
        if quote:
            buf.append(ch)
            if ch == quote:
                quote = None
        elif ch in "\"'":
            quote = ch
            buf.append(ch)
        elif ch == ",":
            parts.append("".join(buf).strip())
            buf = []
        elif ch in "[]{}":
            raise YamlError(f"línea {lineno}: estructuras anidadas en línea no admitidas")
        else:
            buf.append(ch)
    if quote:
        raise YamlError(f"línea {lineno}: comilla sin cerrar")
    tail = "".join(buf).strip()
    if tail or parts:
        parts.append(tail)
    if any(p == "" for p in parts):
        raise YamlError(f"línea {lineno}: elemento vacío en lista en línea")
    return parts


def parse_scalar(text: str, lineno: int = 0):
    text = text.strip()
    if text == "" or text in ("~", "null"):
        return None
    if text.startswith("["):
        if not text.endswith("]"):
            raise YamlError(f"línea {lineno}: lista en línea sin cerrar")
        return [parse_scalar(p, lineno) for p in _split_inline(text[1:-1], lineno)]
    if text.startswith("{"):
        if text == "{}":
            return {}
        raise YamlError(f"línea {lineno}: mapas en línea no vacíos no admitidos")
    if text.startswith('"'):
        if len(text) < 2 or not text.endswith('"'):
            raise YamlError(f"línea {lineno}: cadena con comillas dobles sin cerrar")
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise YamlError(f"línea {lineno}: cadena inválida: {exc}") from None
    if text.startswith("'"):
        if len(text) < 2 or not text.endswith("'"):
            raise YamlError(f"línea {lineno}: cadena con comillas simples sin cerrar")
        return text[1:-1].replace("''", "'")
    if text in ("|", ">") or text[0] in "&*!|>%@`":
        raise YamlError(f"línea {lineno}: sintaxis YAML no admitida: {text!r}")
    if text == "true":
        return True
    if text == "false":
        return False
    if INT_RE.match(text):
        return int(text)
    if ": " in text or text.endswith(":"):
        raise YamlError(f"línea {lineno}: usa comillas en cadenas que contienen ': '")
    return text


def parse(text: str):
    lines = []
    for n, raw in enumerate(text.splitlines(), 1):
        if raw.strip() in ("---", "...") and not lines:
            continue
        content = _strip_comment(raw)
        if not content.strip():
            continue
        lead = content[: len(content) - len(content.lstrip())]
        if "\t" in lead:
            raise YamlError(f"línea {n}: tabulador en indentación")
        lines.append([n, len(lead), content.strip()])
    if not lines:
        return None
    value, i = _parse_block(lines, 0, lines[0][1])
    if i != len(lines):
        raise YamlError(f"línea {lines[i][0]}: indentación inconsistente")
    return value


def _is_seq_item(content: str) -> bool:
    return content == "-" or content.startswith("- ")


def _parse_block(lines, i, indent):
    if _is_seq_item(lines[i][2]):
        return _parse_seq(lines, i, indent)
    return _parse_map(lines, i, indent)


def _parse_seq(lines, i, indent):
    result = []
    while i < len(lines):
        n, ind, content = lines[i]
        if ind < indent:
            break
        if ind > indent:
            raise YamlError(f"línea {n}: indentación inesperada")
        if not _is_seq_item(content):
            break
        rest = content[1:].strip()
        if rest == "":
            if i + 1 < len(lines) and lines[i + 1][1] > indent:
                value, i = _parse_block(lines, i + 1, lines[i + 1][1])
                result.append(value)
            else:
                result.append(None)
                i += 1
        elif KEY_RE.match(rest) and not rest.startswith(("'", '"')):
            lines[i] = [n, indent + 2, rest]
            value, i = _parse_map(lines, i, indent + 2)
            result.append(value)
        else:
            result.append(parse_scalar(rest, n))
            i += 1
    return result, i


def _parse_map(lines, i, indent):
    result = {}
    while i < len(lines):
        n, ind, content = lines[i]
        if ind < indent:
            break
        if ind > indent:
            raise YamlError(f"línea {n}: indentación inesperada")
        if _is_seq_item(content):
            break
        m = KEY_RE.match(content)
        if not m:
            raise YamlError(f"línea {n}: se esperaba 'clave: valor': {content!r}")
        key, rest = m.group(1), m.group(2)
        if key in result:
            raise YamlError(f"línea {n}: clave duplicada {key!r}")
        i += 1
        if rest is None or rest.strip() == "":
            if i < len(lines) and (
                lines[i][1] > indent or (lines[i][1] == indent and _is_seq_item(lines[i][2]))
            ):
                value, i = _parse_block(lines, i, lines[i][1])
                result[key] = value
            else:
                result[key] = None
        else:
            result[key] = parse_scalar(rest, n)
    return result, i


def split_front_matter(text: str):
    """Devuelve (front_matter_text, body) o (None, text) si no hay front matter."""
    if not text.startswith("---\n"):
        return None, text
    end = text.find("\n---\n", 4)
    if end == -1:
        if text.endswith("\n---"):
            end = len(text) - 4
        else:
            raise YamlError("front matter sin cierre '---'")
    return text[4:end], text[end + 5 :]
