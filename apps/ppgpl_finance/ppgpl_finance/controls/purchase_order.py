# Copyright (c) 2026, Power Partner Global Pvt Ltd
"""Purchase Order controls: approval level, first-order and capex rules, locks."""

import frappe
from frappe import _

from ppgpl_finance.controls import approval


def compute_level(doc):
	settings = approval.get_settings()
	reasons = []
	if settings.first_order_needs_cmd and doc.supplier:
		earlier = frappe.db.exists(
			"Purchase Order",
			{"supplier": doc.supplier, "docstatus": 1, "name": ["!=", doc.name or ""]},
		)
		if not earlier:
			reasons.append(_("First order with this supplier"))
	if settings.capex_needs_cmd:
		for item in doc.get("items") or []:
			is_asset = item.get("is_fixed_asset")
			if is_asset is None and item.item_code:
				is_asset = frappe.db.get_value("Item", item.item_code, "is_fixed_asset")
			if is_asset:
				reasons.append(_("Capital purchase (fixed-asset item)"))
				break
	reason = "; ".join(reasons)
	level = approval.get_level("Purchase Order", doc.base_grand_total or doc.grand_total, "All", bool(reasons), settings)
	return level, reason


def validate(doc, method=None):
	level, reason = compute_level(doc)
	approval.set_level(doc, level, reason)
	doc.ppgpl_requires_cmd = 1 if reason else 0
	approval.assert_unchanged(
		doc,
		["supplier", "base_grand_total", "grand_total"],
		child_table="items",
		child_fields=["item_code", "qty", "rate"],
	)
