import unittest
from pathlib import Path

from smtools import miniyaml
from smtools.miniyaml import YamlError, parse

ROOT = Path(__file__).resolve().parents[2]


class ParseTest(unittest.TestCase):
    def test_block_map_and_inline_list(self):
        self.assertEqual(parse("a: 1\nb: [X-001, \"c d\"]\nc:\n"), {"a": 1, "b": ["X-001", "c d"], "c": None})

    def test_nested_map(self):
        self.assertEqual(parse("rel:\n  x: [A]\n  y: []\n"), {"rel": {"x": ["A"], "y": []}})

    def test_sequence_of_maps(self):
        text = "items:\n  - id: S1\n    status: ok\n  - id: S2\n"
        self.assertEqual(parse(text), {"items": [{"id": "S1", "status": "ok"}, {"id": "S2"}]})

    def test_sequence_at_same_indent_as_key(self):
        self.assertEqual(parse("k:\n- a\n- b\n"), {"k": ["a", "b"]})

    def test_scalars(self):
        self.assertEqual(parse("a: true\nb: false\nc: null\nd: ~\ne: 'it''s'\nf: -3\n"),
                         {"a": True, "b": False, "c": None, "d": None, "e": "it's", "f": -3})

    def test_comments(self):
        self.assertEqual(parse("# c\na: x # comment\nb: \"x # no\"\n"), {"a": "x", "b": "x # no"})

    def test_escaped_quote_in_double_quotes(self):
        self.assertEqual(parse('a: "say \\"hi\\" # x"\n'), {"a": 'say "hi" # x'})

    def test_apostrophe_inside_plain_scalar(self):
        self.assertEqual(parse("a: l'agent # c\n"), {"a": "l'agent"})

    def test_empty_map(self):
        self.assertEqual(parse("relations: {}\n"), {"relations": {}})

    def test_rejections(self):
        for bad in ("a: |\n  x\n", "a: &x 1\n", "a: b: c\n", "a: {b: 1}\n", "a: [[1]]\n",
                    "a: 1\na: 2\n", "a:\n\tb: 1\n", "a: \"x\n", "a: [x, , y]\n"):
            with self.subTest(bad=bad), self.assertRaises(YamlError):
                parse(bad)

    def test_front_matter_split(self):
        fm, body = miniyaml.split_front_matter("---\na: 1\n---\n# T\n")
        self.assertEqual((fm, body), ("a: 1", "# T\n"))
        self.assertEqual(miniyaml.split_front_matter("# no fm\n"), (None, "# no fm\n"))
        with self.assertRaises(YamlError):
            miniyaml.split_front_matter("---\na: 1\n")


def _dates_as_text(value):
    """Documented divergence: the subset reads dates as ISO text."""
    import datetime
    if isinstance(value, dict):
        return {k: _dates_as_text(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_dates_as_text(v) for v in value]
    if isinstance(value, datetime.date):
        return value.isoformat()
    return value


class PyYamlAgreementTest(unittest.TestCase):
    """The subset must be interpreted like standard YAML on the real files."""

    def test_repo_files_match_pyyaml(self):
        try:
            import yaml
        except ImportError:
            self.skipTest("PyYAML not installed")
        docs = [p.read_text(encoding="utf-8") for p in ROOT.glob(".ai/registry/*.yaml")]
        docs.append((ROOT / "docs/system/schema.yaml").read_text(encoding="utf-8"))
        md = [*ROOT.glob(".claude/**/*.md"), *ROOT.glob(".ai/decisions/*.md"), *ROOT.glob("docs/**/*.md")]
        for p in md:
            text = p.read_text(encoding="utf-8")
            if "docs/templates" in p.as_posix() or not text.startswith("---\n"):
                continue
            fm, _ = miniyaml.split_front_matter(text)
            docs.append(fm)
        self.assertGreater(len(docs), 10)
        for d in docs:
            with self.subTest(doc=d[:60]):
                self.assertEqual(parse(d), _dates_as_text(yaml.safe_load(d)))


if __name__ == "__main__":
    unittest.main()
