import shutil
import tempfile
import unittest
from pathlib import Path

from smtools import env
from smtools.common import Report

ROOT = Path(__file__).resolve().parents[2]
COPY = ["AGENTS.md", "CLAUDE.md", ".github", ".ai", ".claude", "docs", "scripts"]


class EnvTestBase(unittest.TestCase):
    """Copies the real repository to a temporary directory and mutates it."""

    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.root)
        for name in COPY:
            src = ROOT / name
            if src.is_dir():
                shutil.copytree(src, self.root / name, ignore=shutil.ignore_patterns("__pycache__"))
            elif src.exists():
                shutil.copy(src, self.root / name)

    def check(self):
        report = Report()
        env.check_environment(self.root, report)
        return report

    def codes(self, report, level="error"):
        return sorted({f.code for f in report.findings if f.level == level})


class RealRepoTest(unittest.TestCase):
    def test_repository_environment_has_no_errors(self):
        report = Report()
        env.check_environment(ROOT, report)
        self.assertEqual(report.errors, [], report.render("repo"))


class MutationTest(EnvTestBase):
    def test_baseline_copy_is_clean(self):
        self.assertEqual(self.check().errors, [])

    def test_agents_md_change_desyncs_copilot(self):
        with (self.root / "AGENTS.md").open("a") as fh:
            fh.write("\nNew rule.\n")
        self.assertIn("GENERATED-STALE", self.codes(self.check()))
        env.regen_environment(self.root, Report())
        self.assertEqual(self.check().errors, [])

    def test_claude_md_without_import(self):
        p = self.root / "CLAUDE.md"
        p.write_text(p.read_text().replace("@AGENTS.md", "AGENTS.md"))
        self.assertIn("ENTRY-IMPORT", self.codes(self.check()))

    def test_unregistered_native_agent(self):
        (self.root / ".claude/agents/rogue.md").write_text("---\nname: rogue\ndescription: x\n---\nAGENTS.md\n")
        self.assertIn("COMP-UNREGISTERED", self.codes(self.check()))

    def test_native_name_mismatch_and_missing_id(self):
        p = self.root / ".claude/skills/task-intake/SKILL.md"
        p.write_text(p.read_text().replace("name: task-intake", "name: Task_Intake").replace("ID: SKL-001", ""))
        codes = self.codes(self.check())
        for c in ("NATIVE-NAME", "COMP-NAME", "COMP-ID-BODY"):
            self.assertIn(c, codes)

    def test_capability_with_unknown_provider(self):
        p = self.root / env.CAPABILITIES
        p.write_text(p.read_text().replace("providers: [SKL-001]", "providers: [SKL-099]"))
        codes = self.codes(self.check())
        self.assertIn("CAP-PROVIDER", codes)
        self.assertIn("CAP-UNCOVERED", codes)

    def test_plan_rules(self):
        active = self.root / "docs/plans/active"
        (active / "PLAN-002-x.md").write_text(
            "---\nid: PLAN-002\ntitle: x\nstatus: completed\nstages:\n  - id: S1\n    status: executed\n---\n")
        (active / "PLAN-003-y.md").write_text(
            "---\nid: PLAN-003\ntitle: y\nstatus: in_progress\nstages:\n  - id: S1\n    status: verified\n---\n")
        with (self.root / env.LEDGER).open("a") as fh:
            fh.write("PLAN-002\nPLAN-003\n")
        codes = self.codes(self.check())
        for c in ("PLAN-LOCATION", "PLAN-INCOMPLETE", "STAGE-EVIDENCE", "PLAN-NEXT"):
            self.assertIn(c, codes)

    def test_broken_references(self):
        with (self.root / "AGENTS.md").open("a") as fh:
            fh.write("\nSee `docs/missing.md` and [x](nothing.md) and SKL-099.\n")
        env.regen_environment(self.root, Report())
        codes = self.codes(self.check())
        for c in ("PATH-BROKEN", "LINK-BROKEN", "ID-BROKEN"):
            self.assertIn(c, codes)

    def test_duplicated_instruction_warns(self):
        line = next(l for l in (self.root / "AGENTS.md").read_text().splitlines() if len(l) > 80)
        with (self.root / "CLAUDE.md").open("a") as fh:
            fh.write("\n" + line + "\n")
        self.assertIn("DUP-INSTRUCTION", self.codes(self.check(), "warning"))

    def test_retired_component_without_file_is_valid(self):
        comp = self.root / env.COMPONENTS
        comp.write_text(comp.read_text().replace(
            "name: decision-record\n    path: .claude/skills/decision-record/SKILL.md\n    status: active",
            "name: decision-record\n    path: .claude/skills/decision-record/SKILL.md\n    status: retired"))
        self.assertIn("COMP-RETIRED-PRESENT", self.codes(self.check()))
        shutil.rmtree(self.root / ".claude/skills/decision-record")
        self.assertNotIn("COMP-MISSING", self.codes(self.check()))
        self.assertNotIn("COMP-RETIRED-PRESENT", self.codes(self.check()))

    def test_open_capability_needs_acceptance_or_warns(self):
        caps = self.root / env.CAPABILITIES
        caps.write_text(caps.read_text().replace("    accepted_by: EDR-005\n", "", 1))
        self.assertIn("CAP-OPEN", self.codes(self.check(), "warning"))

    def test_accepted_by_requires_existing_accepted_edr(self):
        caps = self.root / env.CAPABILITIES
        caps.write_text(caps.read_text().replace("accepted_by: EDR-005", "accepted_by: EDR-999", 1))
        self.assertIn("CAP-ACCEPTED", self.codes(self.check()))

    def test_retired_component_keeps_strict_clean(self):
        comp = self.root / env.COMPONENTS
        comp.write_text(comp.read_text().replace(
            "path: .claude/agents/environment-steward.md\n    status: active",
            "path: .claude/agents/environment-steward.md\n    status: retired"))
        (self.root / ".claude/agents/environment-steward.md").unlink()
        env.regen_environment(self.root, Report())
        report = self.check()
        self.assertNotIn("PATH-BROKEN", self.codes(report, "warning"))
        self.assertNotIn("PATH-BROKEN", self.codes(report))

    def test_unknown_tool_and_missing_section(self):
        p = self.root / ".claude/agents/change-verifier.md"
        p.write_text(p.read_text().replace("tools: Read, Grep, Glob, Bash", "tools: Read, Frobnicate")
                     .replace("## Finalización", "## Fin"))  # Spanish heading required by env.REQUIRED_SECTIONS
        report = self.check()
        self.assertIn("NATIVE-TOOL", self.codes(report, "warning"))
        self.assertIn("COMP-SECTION", self.codes(report))


if __name__ == "__main__":
    unittest.main()
