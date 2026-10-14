"""Parser for a strict subset of YAML, with no external dependencies.

Supported subset (see docs/system/conventions.md):
- Block maps (`key: value`) and block sequences (`- value`).
- Sequence items that are maps (`- key: value` + following keys).
- Inline lists of scalars: `[A, B, "c d"]`. Inline empty map: `{}`.
- Scalars: unquoted strings, "double" (JSON escapes), 'single',
  integers, true/false, null/~.
- Comments with `#` at line start or preceded by whitespace.

Not supported (rejected with an error): tab indentation, block scalars
(`|`, `>`), anchors/aliases, non-empty inline maps, unquoted strings
containing ": ".
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
            raise YamlError(f"line {lineno}: nested inline structures are not supported")
        else:
            buf.append(ch)
    if quote:
        raise YamlError(f"line {lineno}: unclosed quote")
    tail = "".join(buf).strip()
    if tail or parts:
        parts.append(tail)
    if any(p == "" for p in parts):
        raise YamlError(f"line {lineno}: empty item in inline list")
    return parts


def parse_scalar(text: str, lineno: int = 0):
    text = text.strip()
    if text == "" or text in ("~", "null"):
        return None
    if text.startswith("["):
        if not text.endswith("]"):
            raise YamlError(f"line {lineno}: unclosed inline list")
        return [parse_scalar(p, lineno) for p in _split_inline(text[1:-1], lineno)]
    if text.startswith("{"):
        if text == "{}":
            return {}
        raise YamlError(f"line {lineno}: non-empty inline maps are not supported")
    if text.startswith('"'):
        if len(text) < 2 or not text.endswith('"'):
            raise YamlError(f"line {lineno}: unclosed double-quoted string")
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise YamlError(f"line {lineno}: invalid string: {exc}") from None
    if text.startswith("'"):
        if len(text) < 2 or not text.endswith("'"):
            raise YamlError(f"line {lineno}: unclosed single-quoted string")
        return text[1:-1].replace("''", "'")
    if text in ("|", ">") or text[0] in "&*!|>%@`":
        raise YamlError(f"line {lineno}: unsupported YAML syntax: {text!r}")
    if text == "true":
        return True
    if text == "false":
        return False
    if INT_RE.match(text):
        return int(text)
    if ": " in text or text.endswith(":"):
        raise YamlError(f"line {lineno}: quote strings that contain ': '")
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
            raise YamlError(f"line {n}: tab in indentation")
        lines.append([n, len(lead), content.strip()])
    if not lines:
        return None
    value, i = _parse_block(lines, 0, lines[0][1])
    if i != len(lines):
        raise YamlError(f"line {lines[i][0]}: inconsistent indentation")
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
            raise YamlError(f"line {n}: unexpected indentation")
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
            raise YamlError(f"line {n}: unexpected indentation")
        if _is_seq_item(content):
            break
        m = KEY_RE.match(content)
        if not m:
            raise YamlError(f"line {n}: expected 'key: value': {content!r}")
        key, rest = m.group(1), m.group(2)
        if key in result:
            raise YamlError(f"line {n}: duplicate key {key!r}")
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
    """Return (front_matter_text, body), or (None, text) if there is no front matter."""
    if not text.startswith("---\n"):
        return None, text
    end = text.find("\n---\n", 4)
    if end == -1:
        if text.endswith("\n---"):
            end = len(text) - 4
        else:
            raise YamlError("front matter without closing '---'")
    return text[4:end], text[end + 5 :]
