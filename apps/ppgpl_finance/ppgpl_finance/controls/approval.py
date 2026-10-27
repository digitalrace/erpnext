# Copyright (c) 2026, Power Partner Global Pvt Ltd
"""Approval routing for SOP PPGPL/FIN/SOP/2026-27/001.

Every controlled document carries `ppgpl_approval_level` (L2, L3 or CMD), recomputed by the
server on every save from PPGPL Finance Settings. The workflows only read that field, so limits
and the rollout phase can change without editing any workflow.
"""

import frappe
from frappe import _
from frappe.utils import flt, fmt_money

SETTINGS = "PPGPL Finance Settings"
LEVELS = ("L2", "L3", "CMD")
PHASE_MULTIPLIER = {
	"Phase 1 - CMD approves all": 0.0,
	"Phase 2 - Half limits": 0.5,
	"Phase 3 - Full limits": 1.0,
}
WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

# Defaults loaded on install (SOP Section 3, as approved by the CMD)
DEFAULT_LIMITS = [
	# document, category, L2, L3, note
	("Payment Entry", "Against Invoice", 100000, 250000, "Matched PO + GRN + invoice"),
	("Payment Entry", "Advance", 0, 100000, "Advance before delivery"),
	("Payment Entry", "Non-PO", 25000, 100000, "Urgent service or repair"),
	("Payment Entry", "Recurring Bill", 200000, 200000, "Electricity, rent, phone; within 10% of last month"),
	("Payment Entry", "Statutory", 200000, 0, "GST, TDS, PF, ESI, PT"),
	("Payment Entry", "Employee", 100000, 250000, "Approved expense claims and advances"),
	("Payment Entry", "Refund", 0, 0, "Customer refunds: CMD"),
	("Payment Entry", "Internal Transfer", 0, 0, "Between own accounts: CMD"),
	("Payment Entry", "Inter-company", 0, 0, "Between group entities: CMD"),
	("Purchase Order", "All", 100000, 200000, "Within project budget"),
	("Journal Entry", "All", 50000, 0, "Ledger adjustments"),
	("Expense Claim", "All", 10000, 50000, "Employee expense claims"),
	("Employee Advance", "All", 0, 25000, "Employee and salary advances"),
]


def get_settings():
	return frappe.get_cached_doc(SETTINGS)


def parse_payment_days(value):
	days = []
	for part in (value or "").replace(";", ",").split(","):
		p = part.strip().lower()
		if not p:
			continue
		match = [d for d in WEEKDAYS if d.startswith(p[:3])]
		if match:
			days.append(WEEKDAYS.index(match[0]))
	return sorted(set(days))


def multiplier(settings=None):
	settings = settings or get_settings()
	return PHASE_MULTIPLIER.get(settings.rollout_phase, 0.0)


def get_limits(document_type, category="All", settings=None):
	"""Effective (L2, L3) limits after the rollout-phase multiplier."""
	settings = settings or get_settings()
	row = None
	for r in settings.approval_limits:
		if r.document_type == document_type and r.category == category:
			row = r
			break
	if not row:
		for r in settings.approval_limits:
			if r.document_type == document_type and r.category == "All":
				row = r
				break
	if not row:
		return 0.0, 0.0
	m = multiplier(settings)
	return flt(row.l2_limit) * m, flt(row.l3_limit) * m


def get_level(document_type, amount, category="All", force_cmd=False, settings=None):
	if force_cmd:
		return "CMD"
	l2, l3 = get_limits(document_type, category, settings)
	amount = flt(amount)
	if l2 > 0 and amount <= l2:
		return "L2"
	if l3 > 0 and amount <= l3:
		return "L3"
	return "CMD"


def approver_label(level, settings=None):
	settings = settings or get_settings()
	if level == "L2":
		return f"L2 – {settings.l2_name or settings.l2_user or _('Admin Director')}"
	if level == "L3":
		return f"L3 – {settings.l3_name or settings.l3_user or _('Director, BD & Finance')}"
	if level == "CMD":
		return f"CMD – {settings.cmd_name or settings.cmd_user or _('CMD')}"
	return ""


def set_level(doc, level, reason=None):
	doc.ppgpl_approval_level = level
	doc.ppgpl_approver = approver_label(level)
	if reason is not None and doc.meta.has_field("ppgpl_cmd_reason"):
		doc.ppgpl_cmd_reason = reason


def get_state_docstatus(doctype, state):
	from frappe.model.workflow import get_workflow_name

	workflow = get_workflow_name(doctype)
	if not workflow or not state:
		return None
	return frappe.db.get_value("Workflow Document State", {"parent": workflow, "state": state}, "doc_status")


def previous_state(doc):
	before = doc.get_doc_before_save()
	return before.get("workflow_state") if before else None


def is_open_for_edit(doc):
	"""True while the maker is still preparing the document."""
	return doc.is_new() or previous_state(doc) in (None, "", "Draft", "Rejected", "On Hold", "Change Requested")


def assert_unchanged(doc, fields, child_table=None, child_fields=None):
	"""Block changes to amounts and parties once a document has left Draft."""
	if is_open_for_edit(doc) or doc.docstatus != 0:
		return
	before = doc.get_doc_before_save()
	if not before:
		return
	changed = []
	for fieldname in fields:
		old, new = before.get(fieldname), doc.get(fieldname)
		if isinstance(old, (int, float)) or isinstance(new, (int, float)):
			if abs(flt(old) - flt(new)) > 0.005:
				changed.append(fieldname)
		elif (old or None) != (new or None):
			changed.append(fieldname)
	if child_table:
		sig = lambda d: sorted(  # noqa: E731
			tuple(str(flt(r.get(f), 2)) if isinstance(r.get(f), (int, float)) else str(r.get(f) or "") for f in child_fields)
			for r in d.get(child_table) or []
		)
		if sig(before) != sig(doc):
			changed.append(child_table)
	if changed:
		labels = ", ".join(_(doc.meta.get_label(f)) for f in changed)
		frappe.throw(
			_(
				"{0} cannot change while the document is with an approver ({1}). Ask the approver to Reject it, then Revise and edit."
			).format(labels, doc.workflow_state),
			title=_("Locked for approval"),
		)


def stamp_approval(doc, approved_states=("Approved",)):
	before_state = previous_state(doc)
	if doc.get("workflow_state") in approved_states and before_state not in approved_states:
		if doc.meta.has_field("ppgpl_approved_by"):
			doc.ppgpl_approved_by = frappe.session.user
			doc.ppgpl_approved_on = frappe.utils.now_datetime()
	if doc.get("workflow_state") in ("Draft", "Rejected") and doc.meta.has_field("ppgpl_approved_by"):
		doc.ppgpl_approved_by = None
		doc.ppgpl_approved_on = None


def money(amount):
	return fmt_money(amount, currency=frappe.db.get_default("currency") or "INR")


# ---------------------------------------------------------------------------
# Re-route documents already waiting when limits or the phase change
# ---------------------------------------------------------------------------
OPEN_STATES = ("Draft", "Pending Check", "Pending L3 Approval", "Pending CMD Approval", "Rejected")


def recompute_open_documents():
	from ppgpl_finance.controls import payment_entry, purchase_order, simple_approvals

	compute = {
		"Payment Entry": payment_entry.compute_level,
		"Purchase Order": purchase_order.compute_level,
		"Journal Entry": simple_approvals.journal_entry_level,
		"Expense Claim": simple_approvals.expense_claim_level,
		"Employee Advance": simple_approvals.employee_advance_level,
	}
	for doctype, fn in compute.items():
		if not frappe.db.exists("DocType", doctype) or not frappe.get_meta(doctype).has_field("ppgpl_approval_level"):
			continue
		names = frappe.get_all(
			doctype, filters={"docstatus": 0, "workflow_state": ["in", OPEN_STATES]}, pluck="name"
		) if frappe.get_meta(doctype).has_field("workflow_state") else []
		for name in names:
			doc = frappe.get_doc(doctype, name)
			level, reason = fn(doc)
			values = {"ppgpl_approval_level": level, "ppgpl_approver": approver_label(level)}
			if reason is not None and doc.meta.has_field("ppgpl_cmd_reason"):
				values["ppgpl_cmd_reason"] = reason
			frappe.db.set_value(doctype, name, values, update_modified=False)
