# Copyright (c) 2026, Power Partner Global Pvt Ltd
"""Number cards on the Finance Control workspace."""

import frappe

from ppgpl_finance.controls import data


# Number Card methods are whitelisted HTTP endpoints. Do not rely on Desk visibility
# or Number Card's public flag as an authorization boundary.
FINANCE_ROLES = (
    "Finance Maker",
    "Finance Checker",
    "Finance Approver L3",
    "CMD Approver",
    "Accounts Manager",
    "System Manager",
)


def _require_finance_access():
    frappe.only_for(FINANCE_ROLES)


def _company(filters):
	filters = frappe.parse_json(filters) if filters else {}
	return (filters or {}).get("company") if isinstance(filters, dict) else None


@frappe.whitelist()
def bank_balance(filters=None):
	_require_finance_access()
	return {"value": data.bank_balance(_company(filters)), "fieldtype": "Currency"}


@frappe.whitelist()
def payables_due_7_days(filters=None):
	_require_finance_access()
	days = frappe.get_cached_doc("PPGPL Finance Settings").proposal_horizon_days or 7
	return {"value": data.payables_due(_company(filters), days), "fieldtype": "Currency"}


@frappe.whitelist()
def msme_overdue(filters=None):
	_require_finance_access()
	days = frappe.get_cached_doc("PPGPL Finance Settings").msme_alert_days or 30
	rows = data.msme_overdue(_company(filters), days)
	return {"value": sum(r.outstanding_amount for r in rows), "fieldtype": "Currency"}


@frappe.whitelist()
def receivables_over_90(filters=None):
	_require_finance_access()
	return {"value": data.receivables_over(_company(filters), 90), "fieldtype": "Currency"}


@frappe.whitelist()
def pending_with_cmd(filters=None):
	_require_finance_access()
	return {"value": data.pending_with_cmd_count(), "fieldtype": "Int"}


@frappe.whitelist()
def pending_with_me(filters=None):
	_require_finance_access()
	return {"value": data.my_queue_count(), "fieldtype": "Int"}
