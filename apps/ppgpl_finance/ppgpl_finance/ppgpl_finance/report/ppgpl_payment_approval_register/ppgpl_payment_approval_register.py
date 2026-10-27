# Copyright (c) 2026, Power Partner Global Pvt Ltd
"""Who approved which payment, at what level — for the monthly review and internal audit."""

import frappe
from frappe import _
from frappe.utils import add_months, flt, get_first_day, getdate, nowdate


def execute(filters=None):
	filters = frappe._dict(filters or {})
	conditions = {
		"payment_type": ["in", ["Pay", "Internal Transfer"]],
		"posting_date": ["between", [filters.from_date or get_first_day(nowdate()), filters.to_date or nowdate()]],
	}
	for key, field in (("company", "company"), ("workflow_state", "workflow_state"), ("level", "ppgpl_approval_level"), ("category", "ppgpl_payment_category")):
		if filters.get(key):
			conditions[field] = filters.get(key)
	rows = frappe.get_all(
		"Payment Entry",
		filters=conditions,
		fields=[
			"name as payment_entry", "posting_date", "party_name", "ppgpl_payment_category as category",
			"ppgpl_approval_level as level", "base_paid_amount as amount", "workflow_state", "owner as prepared_by",
			"ppgpl_approved_by as approved_by", "ppgpl_approved_on as approved_on", "ppgpl_off_cycle as off_cycle",
			"ppgpl_released_off_cycle as released_off_cycle", "reference_no",
		],
		order_by="posting_date desc, name desc",
	)
	summary = [
		{"value": len(rows), "label": _("Payments"), "datatype": "Int"},
		{"value": sum(flt(r.amount) for r in rows), "label": _("Total"), "datatype": "Currency"},
		{"value": sum(flt(r.amount) for r in rows if r.level == "CMD"), "label": _("Approved at CMD level"), "datatype": "Currency", "indicator": "Orange"},
		{"value": sum(1 for r in rows if r.off_cycle or r.released_off_cycle), "label": _("Off-cycle"), "datatype": "Int", "indicator": "Red"},
	]
	return columns(), rows, None, None, summary


def columns():
	return [
		{"fieldname": "payment_entry", "label": _("Payment Entry"), "fieldtype": "Link", "options": "Payment Entry", "width": 150},
		{"fieldname": "posting_date", "label": _("Date"), "fieldtype": "Date", "width": 95},
		{"fieldname": "party_name", "label": _("Party"), "fieldtype": "Data", "width": 170},
		{"fieldname": "category", "label": _("Category"), "fieldtype": "Data", "width": 120},
		{"fieldname": "level", "label": _("Level"), "fieldtype": "Data", "width": 60},
		{"fieldname": "amount", "label": _("Amount"), "fieldtype": "Currency", "width": 120},
		{"fieldname": "workflow_state", "label": _("State"), "fieldtype": "Data", "width": 140},
		{"fieldname": "prepared_by", "label": _("Prepared by"), "fieldtype": "Link", "options": "User", "width": 150},
		{"fieldname": "approved_by", "label": _("Approved by"), "fieldtype": "Link", "options": "User", "width": 150},
		{"fieldname": "approved_on", "label": _("Approved on"), "fieldtype": "Datetime", "width": 150},
		{"fieldname": "off_cycle", "label": _("Off-cycle"), "fieldtype": "Check", "width": 80},
		{"fieldname": "released_off_cycle", "label": _("Released off-cycle"), "fieldtype": "Check", "width": 110},
		{"fieldname": "reference_no", "label": _("UTR / Ref"), "fieldtype": "Data", "width": 130},
	]
