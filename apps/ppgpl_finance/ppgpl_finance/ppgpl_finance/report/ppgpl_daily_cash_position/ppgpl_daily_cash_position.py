# Copyright (c) 2026, Power Partner Global Pvt Ltd
"""Daily cash position (SOP Section 9)."""

import frappe
from frappe import _

from ppgpl_finance.controls import data


def execute(filters=None):
	filters = frappe._dict(filters or {})
	rows = data.cash_position(filters.company, filters.date)
	bank = sum(r.balance for r in rows if r.account_type == "Bank")
	cash = sum(r.balance for r in rows if r.account_type == "Cash")
	summary = [
		{"value": bank, "label": _("Bank (books)"), "datatype": "Currency", "indicator": "Blue"},
		{"value": cash, "label": _("Cash in hand"), "datatype": "Currency", "indicator": "Green"},
		{"value": sum(r.receipts for r in rows), "label": _("Receipts yesterday"), "datatype": "Currency"},
		{"value": sum(r.payments for r in rows), "label": _("Payments yesterday"), "datatype": "Currency"},
		{"value": sum(1 for r in rows if r.overdrawn), "label": _("Overdrawn / CC in use"), "datatype": "Int", "indicator": "Red"},
	]
	return columns(), rows, None, None, summary


def columns():
	return [
		{"fieldname": "account", "label": _("Account"), "fieldtype": "Link", "options": "Account", "width": 240},
		{"fieldname": "account_type", "label": _("Type"), "fieldtype": "Data", "width": 70},
		{"fieldname": "balance", "label": _("Balance"), "fieldtype": "Currency", "width": 130},
		{"fieldname": "receipts", "label": _("Receipts yesterday"), "fieldtype": "Currency", "width": 140},
		{"fieldname": "payments", "label": _("Payments yesterday"), "fieldtype": "Currency", "width": 140},
		{"fieldname": "overdrawn", "label": _("Overdrawn"), "fieldtype": "Check", "width": 90},
		{"fieldname": "float_amount", "label": _("Petty cash float"), "fieldtype": "Currency", "width": 120},
		{"fieldname": "float_left_pct", "label": _("Float left"), "fieldtype": "Percent", "width": 90},
		{"fieldname": "holder", "label": _("Float holder"), "fieldtype": "Link", "options": "User", "width": 150},
	]
