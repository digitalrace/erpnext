# Copyright (c) 2026, Power Partner Global Pvt Ltd
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt


class PPGPLFinanceSettings(Document):
	def validate(self):
		from ppgpl_finance.controls.approval import parse_payment_days

		if not parse_payment_days(self.payment_days):
			frappe.throw(_("Enter at least one weekday in Payment days, for example: Tuesday, Friday"))

		seen = set()
		for row in self.approval_limits:
			key = (row.document_type, row.category)
			if key in seen:
				frappe.throw(_("Row {0}: {1} / {2} appears twice in Approval limits").format(row.idx, *key))
			seen.add(key)
			if flt(row.l2_limit) < 0 or flt(row.l3_limit) < 0:
				frappe.throw(_("Row {0}: limits cannot be negative").format(row.idx))

		people = [u for u in (self.l1_user, self.l2_user, self.l3_user, self.cmd_user) if u]
		if len(people) != len(set(people)):
			frappe.throw(_("L1, L2, L3 and CMD must be different people (SOP Section 2: segregation of duties)"))

	def on_update(self):
		# the cached copy is refreshed only after on_update; routing below must see the new values
		frappe.clear_document_cache(self.doctype, self.name)
		from ppgpl_finance.controls.approval import recompute_open_documents
		from ppgpl_finance.setup.install import apply_erpnext_controls, assign_roles

		assign_roles(self)
		apply_erpnext_controls(self)
		recompute_open_documents()
