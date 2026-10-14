import shutil
import tempfile
import textwrap
import unittest
from pathlib import Path

from smtools import model as m
from smtools.common import Report

ROOT = Path(__file__).resolve().parents[2]


def card(id_, type_, name, extra=""):
    return textwrap.dedent(f"""\
        ---
        id: {id_}
        type: {type_}
        name: "{name}"
        status: active
        evidence: declared-doc
        """) + textwrap.dedent(extra) + "---\n\n# " + name + "\n"


class ModelTestBase(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.root)
        (self.root / "docs/system").mkdir(parents=True)
        shutil.copy(ROOT / m.SCHEMA_PATH, self.root / m.SCHEMA_PATH)
        report = Report()
        for spec in m.load_schema(self.root, report)["types"].values():
            (self.root / spec["dir"]).mkdir(parents=True, exist_ok=True)
        (self.root / "docs/system/inventory").mkdir(exist_ok=True)
        (self.root / "docs/system/traceability").mkdir(exist_ok=True)
        self.ledger = []

    def add(self, rel_dir, filename, content, ledger=True):
        (self.root / rel_dir / filename).write_text(content, encoding="utf-8")
        if ledger:
            self.ledger.append(filename.split("-")[0] + "-" + filename.split("-")[1].split(".")[0])

    def check(self):
        (self.root / m.LEDGER_PATH).write_text("\n".join(self.ledger) + "\n", encoding="utf-8")
        m.regen_model(self.root, Report())
        report = Report()
        m.check_model(self.root, report)
        return report

    def codes(self, report, level="error"):
        return sorted({f.code for f in report.findings if f.level == level})

    def valid_chain(self):
        (self.root / "src").mkdir()
        (self.root / "src/users.py").write_text("def create_user():\n    pass\n")
        (self.root / "tests").mkdir()
        (self.root / "tests/test_users.py").write_text("def test_create_user(): pass\n")
        self.add("docs/system/actors", "ACT-001-admin.md", card("ACT-001", "actor", "Admin"))
        self.add("docs/system/requirements", "REQ-001-signup.md", card("REQ-001", "requirement", "Signup", """\
            relations:
              actors: [ACT-001]
              features: [FEAT-001]
            """))
        self.add("docs/system/features", "FEAT-001-users.md", card("FEAT-001", "feature", "Users", """\
            implementation: verified
            code: [src/users.py]
            relations:
              functions: [FUN-001]
            """))
        self.add("docs/system/domain/functions", "FUN-001-create.md", card("FUN-001", "function", "Create user", """\
            implementation: verified
            code: [src/users.py#create_user]
            test_code: [tests/test_users.py#test_create_user]
            relations:
              tests: [TST-001]
            """))
        self.add("docs/system/quality/tests", "TST-001-users.md", card("TST-001", "test", "User tests", """\
            implementation: implemented
            test_code: [tests/test_users.py]
            """))


class ModelValidationTest(ModelTestBase):
    def test_empty_model_is_valid(self):
        report = self.check()
        self.assertEqual(report.findings, [])

    def test_valid_chain(self):
        self.valid_chain()
        report = self.check()
        self.assertEqual(self.codes(report), [], report.render("x"))
        self.assertEqual(self.codes(report, "warning"), [], report.render("x"))

    def test_broken_and_disallowed_relations(self):
        self.add("docs/system/requirements", "REQ-001-x.md", card("REQ-001", "requirement", "X", """\
            relations:
              features: [FEAT-009]
              functions: [FUN-001]
              actors: [FEAT-001]
            """))
        self.assertEqual(self.codes(self.check()), ["REL-BROKEN", "REL-KEY", "REL-TARGET"])

    def test_identity_rules(self):
        self.add("docs/system/actors", "ACT-001-a.md", card("ACT-001", "actor", "A"))
        self.add("docs/system/actors", "ACT-002-b.md", card("ACT-001", "actor", "B"), ledger=False)
        self.add("docs/system/actors", "ACT-003-c.md", card("REQ-003", "requirement", "C"), ledger=False)
        self.add("docs/system/actors", "other-name.md", card("ACT-004", "actor", "D"), ledger=False)
        self.add("docs/system/actors", "ACT-005-e.md", card("ACT-005", "requirement", "E"))
        codes = self.codes(self.check())
        for expected in ("ID-DUP", "ID-PREFIX", "FILE-NAME", "TYPE-MISMATCH", "LEDGER-UNREGISTERED"):
            self.assertIn(expected, codes)

    def test_implementation_requires_code_and_tests(self):
        self.add("docs/system/domain/functions", "FUN-001-x.md", card("FUN-001", "function", "X", """\
            implementation: verified
            """))
        self.add("docs/system/domain/entities", "ENT-001-y.md",
                 card("ENT-001", "entity", "Y").replace("declared-doc", "verified-code"))
        codes = self.codes(self.check())
        self.assertEqual(codes, ["EVIDENCE-NO-CODE", "IMPL-NO-CODE", "VERIFIED-NO-TESTS"])

    def test_code_refs_and_symbols(self):
        (self.root / "src").mkdir()
        (self.root / "src/a.py").write_text("def real_fn(): pass\n")
        self.add("docs/system/domain/functions", "FUN-001-x.md", card("FUN-001", "function", "X", """\
            code: [src/a.py#real_fn, src/a.py#missing_fn, src/nope.py, ../outside.py]
            """))
        report = self.check()
        msgs = [f.message for f in report.findings if f.code == "CODE-REF"]
        self.assertEqual(len(msgs), 3, msgs)

    def test_foreign_or_unknown_prefix_reports_instead_of_crashing(self):
        self.add("docs/system/actors", "FOO-001-x.md", card("FOO-001", "actor", "X"), ledger=False)
        self.add("docs/system/actors", "REQ-002-y.md", card("REQ-002", "requirement", "Y", """\
            relations:
              features: [FEAT-001]
            """), ledger=False)
        self.assertIn("ID-PREFIX", self.codes(self.check()))

    def test_dependency_does_not_count_as_tests(self):
        self.valid_chain()
        self.add("docs/system/features", "FEAT-002-other.md", card("FEAT-002", "feature", "Other", """\
            implementation: verified
            code: [src/users.py]
            relations:
              depends_on: [FEAT-001]
            """))
        self.assertIn("VERIFIED-NO-TESTS", self.codes(self.check()))

    def test_not_implementable_type_rejects_implementation(self):
        self.add("docs/system/actors", "ACT-001-a.md", card("ACT-001", "actor", "A", "implementation: none\n"))
        self.assertIn("IMPL-NOT-APPLICABLE", self.codes(self.check()))

    def test_warnings(self):
        self.add("docs/system/actors", "ACT-001-a.md", card("ACT-001", "actor", "A"))
        self.add("docs/system/requirements", "REQ-001-r.md", card("REQ-001", "requirement", "R", """\
            relations:
              actors: [ACT-001]
            """))
        self.add("docs/system/features", "FEAT-001-f.md", card("FEAT-001", "feature", "F"))
        self.assertEqual(self.codes(self.check(), "warning"), ["FEAT-NO-REQ", "ORPHAN", "REQ-UNREALIZED"])

    def test_stale_generated_files_fail(self):
        self.valid_chain()
        self.check()
        (self.root / m.INVENTORY_PATH).write_text("edited by hand\n")
        report = Report()
        m.check_model(self.root, report)
        self.assertIn("GENERATED-STALE", self.codes(report))

    def test_ledger_no_card_warns(self):
        self.ledger.append("REQ-007")
        self.assertIn("LEDGER-NO-CARD", self.codes(self.check(), "warning"))

    def test_matrix_traces_requirement_to_tests(self):
        self.valid_chain()
        self.check()
        matrix = (self.root / m.MATRIX_PATH).read_text()
        self.assertIn("| REQ-001 | FEAT-001 | FUN-001 | — | TST-001 | — |", matrix)
        inventory = (self.root / m.INVENTORY_PATH).read_text()
        self.assertIn("`REQ-001 features FEAT-001`", inventory)


class TemplatesTest(ModelTestBase):
    """Every card template, once instantiated, yields a valid card."""

    def test_card_templates_instantiate(self):
        report = Report()
        schema = m.load_schema(self.root, report)
        by_type = {spec["type"]: (prefix, spec) for prefix, spec in schema["types"].items()}
        for tpl in sorted((ROOT / "docs/templates").glob("*.md")):
            text = tpl.read_text(encoding="utf-8")
            if not text.startswith("---\n") or "\ntype: " not in text:
                continue
            type_ = text.split("\ntype: ", 1)[1].split("\n", 1)[0].strip()
            prefix, spec = by_type[type_]
            self.add(spec["dir"], f"{prefix}-001-template.md", text.replace(f"{prefix}-XXX", f"{prefix}-001"))
        self.assertEqual(len(self.ledger), len(schema["types"]) - 1)  # DEC uses the shared template
        report = self.check()
        self.assertEqual(self.codes(report), [], report.render("templates"))


class RealRepoTest(unittest.TestCase):
    def test_repository_model_has_no_errors(self):
        report = Report()
        m.check_model(ROOT, report)
        self.assertEqual(report.errors, [], report.render("repo"))


if __name__ == "__main__":
    unittest.main()
