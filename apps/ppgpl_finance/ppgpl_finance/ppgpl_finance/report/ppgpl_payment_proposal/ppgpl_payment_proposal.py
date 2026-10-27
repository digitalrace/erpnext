# Copyright (c) 2026, Power Partner Global Pvt Ltd
"""Payment proposal for the Tuesday/Friday run (SOP Section 5)."""

import frappe
from frappe import _
from frappe.utils import add_days, cint, date_diff, flt, getdate, nowdate

from ppgpl_finance.controls import approval, data

MSME = ("Micro", "Small", "Medium")


def execute(filters=None):
	filters = frappe._dict(filters or {})
	settings = approval.get_settings()
	as_on = getdate(filters.as_on or nowdate())
	horizon = cint(filters.horizon_days or settings.proposal_horizon_days or 7)
	invoices = data.open_invoices(filters.company, due_by=add_days(as_on, horizon), include_all=cint(filters.show_all))
	in_draft = data.invoices_in_draft_payments([i.name for i in invoices])

	rows = []
	for inv in invoices:
		if inv.is_return:
			continue
		age = date_diff(as_on, inv.posting_date)
		overdue = date_diff(as_on, inv.due_date)
		is_msme = inv.msme in MSME
		if is_msme and age >= cint(inv.msme_days) - 7:
			priority, reason = 1, _("MSME payment limit")
		elif overdue > 0:
			priority, reason = 2, _("Overdue")
		else:
			priority, reason = 3, _("Due")
		rows.append(
			{
				"priority": priority,
				"reason": reason,
				"invoice": inv.name,
				"supplier": inv.supplier,
				"supplier_name": inv.supplier_name,
				"msme": inv.msme if is_msme else "",
				"project": inv.project,
				"bill_no": inv.bill_no,
				"due_date": inv.due_date,
				"days_overdue": max(overdue, 0),
				"msme_age": age if is_msme else None,
				"outstanding": flt(inv.outstanding_amount),
				"approval": approval.get_level("Payment Entry", inv.outstanding_amount, "Against Invoice", settings=settings),
				"in_payment": in_draft.get(inv.name),
			}
		)
	rows.sort(key=lambda r: (r["priority"], str(r["due_date"]), r["invoice"]))

	total = sum(r["outstanding"] for r in rows)
	summary = [
		{"value": len(rows), "label": _("Invoices"), "datatype": "Int"},
		{"value": total, "label": _("Total due"), "datatype": "Currency", "indicator": "Blue"},
		{"value": sum(r["outstanding"] for r in rows if r["priority"] == 1), "label": _("MSME priority"), "datatype": "Currency", "indicator": "Red"},
		{"value": sum(r["outstanding"] for r in rows if r["approval"] == "CMD"), "label": _("Needs CMD"), "datatype": "Currency", "indicator": "Orange"},
		{"value": data.bank_balance(filters.company), "label": _("Bank balance (books)"), "datatype": "Currency", "indicator": "Green"},
	]
	return columns(), rows, None, None, summary


def columns():
	return [
		{"fieldname": "priority", "label": _("Priority"), "fieldtype": "Int", "width": 70},
		{"fieldname": "reason", "label": _("Why"), "fieldtype": "Data", "width": 150},
		{"fieldname": "invoice", "label": _("Invoice"), "fieldtype": "Link", "options": "Purchase Invoice", "width": 165},
		{"fieldname": "supplier_name", "label": _("Supplier"), "fieldtype": "Data", "width": 190},
		{"fieldname": "msme", "label": _("MSME"), "fieldtype": "Data", "width": 70},
		{"fieldname": "project", "label": _("Project"), "fieldtype": "Link", "options": "Project", "width": 95},
		{"fieldname": "bill_no", "label": _("Bill No"), "fieldtype": "Data", "width": 100},
		{"fieldname": "due_date", "label": _("Due"), "fieldtype": "Date", "width": 95},
		{"fieldname": "days_overdue", "label": _("Days overdue"), "fieldtype": "Int", "width": 90},
		{"fieldname": "msme_age", "label": _("MSME age"), "fieldtype": "Int", "width": 80},
		{"fieldname": "outstanding", "label": _("Outstanding"), "fieldtype": "Currency", "width": 120},
		{"fieldname": "approval", "label": _("Approves"), "fieldtype": "Data", "width": 80},
		{"fieldname": "in_payment", "label": _("Draft payment"), "fieldtype": "Link", "options": "Payment Entry", "width": 150},
		{"fieldname": "supplier", "label": _("Supplier ID"), "fieldtype": "Link", "options": "Supplier", "width": 120},
	]
