# Copyright (c) 2026, Power Partner Global Pvt Ltd
"""Approved payments waiting to be released in net banking, with the bank upload file."""

import frappe
from frappe import _
from frappe.utils import flt


def execute(filters=None):
	filters = frappe._dict(filters or {})
	conditions = {"docstatus": 0, "workflow_state": "Approved"}
	if filters.company:
		conditions["company"] = filters.company
	if filters.paid_from:
		conditions["paid_from"] = filters.paid_from
	pes = frappe.get_all(
		"Payment Entry",
		filters=conditions,
		fields=[
			"name", "party_type", "party", "party_name", "base_paid_amount", "paid_from", "party_bank_account",
			"ppgpl_payment_category", "ppgpl_approved_by", "ppgpl_approved_on", "ppgpl_off_cycle", "posting_date",
		],
		order_by="ppgpl_approved_on asc",
	)
	rows = []
	for pe in pes:
		ba = frappe.db.get_value(
			"Bank Account", pe.party_bank_account, ["account_name", "bank_account_no", "branch_code", "bank"], as_dict=True
		) if pe.party_bank_account else None
		rows.append(
			{
				"payment_entry": pe.name,
				"party_name": pe.party_name or pe.party,
				"amount": flt(pe.base_paid_amount),
				"category": pe.ppgpl_payment_category,
				"beneficiary": (ba.account_name if ba else "") or pe.party_name,
				"account_no": ba.bank_account_no if ba else "",
				"ifsc": ba.branch_code if ba else "",
				"bank": ba.bank if ba else "",
				"paid_from": pe.paid_from,
				"approved_by": pe.ppgpl_approved_by,
				"approved_on": pe.ppgpl_approved_on,
				"off_cycle": pe.ppgpl_off_cycle,
			}
		)
	summary = [
		{"value": len(rows), "label": _("Payments"), "datatype": "Int"},
		{"value": sum(r["amount"] for r in rows), "label": _("Total to release"), "datatype": "Currency", "indicator": "Green"},
	]
	return columns(), rows, None, None, summary


def columns():
	return [
		{"fieldname": "payment_entry", "label": _("Payment Entry"), "fieldtype": "Link", "options": "Payment Entry", "width": 150},
		{"fieldname": "party_name", "label": _("Party"), "fieldtype": "Data", "width": 180},
		{"fieldname": "amount", "label": _("Amount"), "fieldtype": "Currency", "width": 120},
		{"fieldname": "category", "label": _("Category"), "fieldtype": "Data", "width": 120},
		{"fieldname": "beneficiary", "label": _("Beneficiary name"), "fieldtype": "Data", "width": 170},
		{"fieldname": "account_no", "label": _("Account no."), "fieldtype": "Data", "width": 140},
		{"fieldname": "ifsc", "label": _("IFSC"), "fieldtype": "Data", "width": 110},
		{"fieldname": "bank", "label": _("Bank"), "fieldtype": "Data", "width": 120},
		{"fieldname": "paid_from", "label": _("Pay from"), "fieldtype": "Link", "options": "Account", "width": 160},
		{"fieldname": "approved_by", "label": _("Approved by"), "fieldtype": "Link", "options": "User", "width": 160},
		{"fieldname": "approved_on", "label": _("Approved on"), "fieldtype": "Datetime", "width": 150},
		{"fieldname": "off_cycle", "label": _("Off-cycle"), "fieldtype": "Check", "width": 80},
	]
