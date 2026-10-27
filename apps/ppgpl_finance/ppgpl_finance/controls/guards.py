# Copyright (c) 2026, Power Partner Global Pvt Ltd
"""Stop documents being submitted around the approval workflow (for example through the API)."""

import frappe
from frappe import _
from frappe.model.workflow import get_workflow_name

from ppgpl_finance.controls.approval import get_state_docstatus


def before_submit(doc, method=None):
	if doc.doctype == "Payment Entry" and doc.payment_type == "Receive":
		return
	if frappe.flags.in_install or frappe.flags.in_migrate or frappe.flags.in_patch:
		return
	if not get_workflow_name(doc.doctype):
		return
	if str(get_state_docstatus(doc.doctype, doc.get("workflow_state"))) != "1":
		frappe.throw(
			_("{0} can only be submitted through its approval workflow. Use the Actions menu.").format(_(doc.doctype)),
			title=_("Approval required"),
		)
