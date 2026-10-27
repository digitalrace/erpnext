# Copyright (c) 2026, Power Partner Global Pvt Ltd
"""Actions called from the PPGPL reports."""

import frappe
from frappe import _

from ppgpl_finance.controls import data

MAKER_ROLES = ("Finance Maker", "Finance Checker", "Accounts Manager", "System Manager")


def default_supplier_bank_account(supplier):
	filters = {"party_type": "Supplier", "party": supplier, "workflow_state": "Approved"}
	return frappe.db.get_value("Bank Account", {**filters, "is_default": 1}, "name") or frappe.db.get_value(
		"Bank Account", filters, "name"
	)


@frappe.whitelist()
def create_payment_entries(invoices, paid_from=None):
	"""Create draft Payment Entries (category: Against Invoice) for the selected Purchase Invoices."""
	frappe.only_for(MAKER_ROLES)
	from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry

	invoices = frappe.parse_json(invoices) or []
	already = data.invoices_in_draft_payments(invoices)
	created, skipped = [], []
	for inv in invoices:
		if inv in already:
			skipped.append(_("{0}: already in draft payment {1}").format(inv, already[inv]))
			continue
		try:
			pe = get_payment_entry("Purchase Invoice", inv, bank_account=paid_from or None)
			pe.ppgpl_payment_category = "Against Invoice"
			bank_account = default_supplier_bank_account(pe.party)
			if bank_account:
				pe.party_bank_account = bank_account
			pe.insert()
			created.append(pe.name)
		except Exception as e:
			frappe.clear_last_message()
			skipped.append(f"{inv}: {e}")
	return {"created": created, "skipped": skipped}


@frappe.whitelist()
def send_for_check(payment_entries):
	"""Bulk 'Send for Check' on draft Payment Entries created from the proposal."""
	frappe.only_for(MAKER_ROLES)
	from frappe.model.workflow import apply_workflow

	done, failed = [], []
	for name in frappe.parse_json(payment_entries) or []:
		try:
			apply_workflow(frappe.get_doc("Payment Entry", name), "Send for Check")
			done.append(name)
		except Exception as e:
			frappe.clear_last_message()
			failed.append(f"{name}: {e}")
	return {"done": done, "failed": failed}
