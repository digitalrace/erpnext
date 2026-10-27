"""Static regression tests for finance security and install safety.

These tests do not require a running Frappe site. Runtime permission/workflow
integration must additionally be tested on a disposable ERPNext v16 site.
"""
import ast
import unittest
from pathlib import Path

PACKAGE = Path(__file__).resolve().parents[1]


class FinanceSecurityStaticTests(unittest.TestCase):
    def test_all_number_card_endpoints_require_finance_role(self):
        source = (PACKAGE / "controls" / "cards.py").read_text(encoding="utf-8")
        tree = ast.parse(source)
        names = {
            node.name: node for node in tree.body
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        }
        endpoints = {
            "bank_balance", "payables_due_7_days", "msme_overdue",
            "receivables_over_90", "pending_with_cmd", "pending_with_me",
        }
        self.assertTrue(endpoints.issubset(names))
        for name in endpoints:
            with self.subTest(endpoint=name):
                calls = [
                    n for n in ast.walk(names[name])
                    if isinstance(n, ast.Call) and isinstance(n.func, ast.Name)
                    and n.func.id == "_require_finance_access"
                ]
                self.assertTrue(calls, f"{name} lacks server-side role guard")

    def test_existing_supplier_and_bank_accounts_are_not_auto_approved(self):
        source = (PACKAGE / "setup" / "workflows.py").read_text(encoding="utf-8")
        tree = ast.parse(source)
        states = next(
            node.value for node in tree.body
            if isinstance(node, ast.Assign)
            and any(isinstance(t, ast.Name) and t.id == "EXISTING_RECORD_STATES" for t in node.targets)
        )
        parsed = ast.literal_eval(states)
        self.assertNotIn("Supplier", parsed)
        self.assertNotIn("Bank Account", parsed)

    def test_installer_does_not_override_frozen_period_policy(self):
        source = (PACKAGE / "setup" / "install.py").read_text(encoding="utf-8")
        self.assertNotIn('"role_allowed_for_frozen_entries", "CMD Approver"', source)
        self.assertNotIn('"frozen_accounts_modifier", "CMD Approver"', source)

    def test_installer_does_not_force_buying_settings_globally(self):
        source = (PACKAGE / "setup" / "install.py").read_text(encoding="utf-8")
        self.assertNotIn('set_single_value("Buying Settings"', source)


    def test_finance_cards_are_not_public(self):
        source = (PACKAGE / "setup" / "install.py").read_text(encoding="utf-8")
        self.assertIn('"is_public": 0,', source)

    def test_finance_workspace_is_not_public(self):
        source = (PACKAGE / "setup" / "install.py").read_text(encoding="utf-8")
        self.assertIn('"public": 0,', source)


    def test_install_hook_does_not_run_setup_automatically(self):
        source = (PACKAGE / "setup" / "install.py").read_text(encoding="utf-8")
        hook = source.split("def after_install():", 1)[1].split("\ndef after_migrate():", 1)[0]
        self.assertNotIn("run_setup(", hook)

    def test_migrate_hook_does_not_run_setup_automatically(self):
        source = (PACKAGE / "setup" / "install.py").read_text(encoding="utf-8")
        hook = source.split("def after_migrate():", 1)[1].split("\ndef before_uninstall():", 1)[0]
        self.assertNotIn("run_setup(", hook)

    def test_existing_workflows_are_skipped_without_force(self):
        source = (PACKAGE / "setup" / "install.py").read_text(encoding="utf-8")
        tree = ast.parse(source)
        fn = next(
            node for node in tree.body
            if isinstance(node, ast.FunctionDef) and node.name == "make_workflows"
        )
        checks = [
            node for node in ast.walk(fn)
            if isinstance(node, ast.If)
            and isinstance(node.test, ast.BoolOp)
            and isinstance(node.test.op, ast.And)
        ]
        self.assertTrue(checks, "Expected a guard for existing workflows and force=False")
        self.assertIn("if exists and not force:", source)


    def test_setup_api_rejects_force_workflows(self):
        source = (PACKAGE / "setup" / "install.py").read_text(encoding="utf-8")
        self.assertIn("if frappe.utils.cint(force_workflows):", source)
        self.assertIn("Forced workflow replacement is disabled", source)

    def test_setup_api_does_not_grant_cmd_approver_setup_access(self):
        source = (PACKAGE / "setup" / "install.py").read_text(encoding="utf-8")
        self.assertIn('frappe.only_for("System Manager")', source)
        self.assertNotIn('frappe.only_for(("System Manager", "CMD Approver"))', source)

    def test_settings_doc_does_not_allow_cmd_approver_to_write(self):
        import json
        settings_path = (
            PACKAGE / "ppgpl_finance" / "doctype" /
            "ppgpl_finance_settings" / "ppgpl_finance_settings.json"
        )
        data = json.loads(settings_path.read_text(encoding="utf-8"))
        row = next(
            (r for r in data.get("permissions", []) if r.get("role") == "CMD Approver"),
            None,
        )
        self.assertIsNotNone(row)
        self.assertEqual(row.get("write"), 0)
        self.assertEqual(row.get("create"), 0)
        self.assertEqual(row.get("delete"), 0)


if __name__ == "__main__":
    unittest.main()
