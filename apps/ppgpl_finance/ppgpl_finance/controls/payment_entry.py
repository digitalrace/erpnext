# Copyright (c) 2026, Power Partner Global Pvt Ltd
"""Payment Entry controls: category, approval level, locks, bank-account and payment-day checks."""

import frappe
from frappe import _
from frappe.utils import add_days, flt, getdate

from ppgpl_finance.controls import approval
from ppgpl_finance.controls.alerts import log_exception

USER_CHOSEN = ("Non-PO", "Recurring Bill", "Statutory", "Advance")
# ERPNext needs a bank reference on every bank payment, even in draft. Until the payment is
# released in net banking the reference holds this placeholder; Mark Paid needs the real UTR.
UTR_PLACEHOLDER = "UTR-PENDING"
LOCKED_FIELDS = [
	"payment_type",
	"party_type",
	"party",
	"paid_from",
	"paid_to",
	"paid_amount",
	"base_paid_amount",
	"party_bank_account",
	"ppgpl_payment_category",
	"ppgpl_off_cycle",
]


def derive_category(doc):
	if doc.payment_type == "Receive":
		return None
	if doc.payment_type == "Internal Transfer":
		return "Internal Transfer"
	if doc.party_type == "Employee":
		return "Employee"
	if doc.party_type == "Customer":
		return "Refund"
	if doc.party_type == "Supplier":
		if doc.party and frappe.db.get_value("Supplier", doc.party, "is_internal_supplier"):
			return "Inter-company"
		refs = {r.reference_doctype for r in doc.get("references") or [] if flt(r.allocated_amount)}
		if refs & {"Purchase Invoice", "Journal Entry"}:
			return "Against Invoice"
		if "Purchase Order" in refs:
			return "Advance"
		return doc.ppgpl_payment_category if doc.ppgpl_payment_category in USER_CHOSEN else "Non-PO"
	return doc.ppgpl_payment_category or "Non-PO"


def compute_level(doc):
	settings = approval.get_settings()
	category = doc.ppgpl_payment_category or derive_category(doc)
	if not category:
		return None, None
	force = bool(doc.ppgpl_off_cycle and settings.off_cycle_needs_cmd)
	return approval.get_level("Payment Entry", doc.base_paid_amount or doc.paid_amount, category, force, settings), None


def next_payment_day(from_date=None):
	days = approval.parse_payment_days(approval.get_settings().payment_days)
	d = getdate(from_date)
	if not days:
		return d
	for i in range(7):
		if add_days(d, i).weekday() in days:
			return getdate(add_days(d, i))
	return d


def before_validate(doc, method=None):
	if doc.docstatus == 0 and doc.payment_type in ("Pay", "Internal Transfer"):
		if not (doc.reference_no or "").strip():
			doc.reference_no = UTR_PLACEHOLDER
		if not doc.reference_date:
			doc.reference_date = next_payment_day(doc.posting_date)


def validate(doc, method=None):
	doc.ppgpl_payment_category = derive_category(doc)
	if not doc.ppgpl_payment_category:
		doc.ppgpl_approval_level = None
		doc.ppgpl_approver = None
		return

	level, _reason = compute_level(doc)
	approval.set_level(doc, level)
	approval.assert_unchanged(
		doc,
		LOCKED_FIELDS,
		child_table="references",
		child_fields=["reference_doctype", "reference_name", "allocated_amount"],
	)
	approval.stamp_approval(doc)

	# Early check when the maker sends the payment for approval
	if doc.get("workflow_state") == "Pending Check" and approval.previous_state(doc) in (None, "Draft", "Rejected"):
		check_bank_account(doc)


def check_bank_account(doc):
	settings = approval.get_settings()
	if doc.party_bank_account:
		state = frappe.db.get_value("Bank Account", doc.party_bank_account, "workflow_state")
		if state and state != "Approved":
			frappe.throw(
				_("Bank account {0} is {1}. Only a CMD-approved bank account can be paid (SOP Section 8).").format(
					frappe.bold(doc.party_bank_account), frappe.bold(state)
				),
				title=_("Bank account not approved"),
			)
		return
	if (
		settings.require_approved_bank_account
		and doc.payment_type == "Pay"
		and doc.party_type == "Supplier"
		and frappe.db.get_value("Account", doc.paid_from, "account_type") == "Bank"
	):
		frappe.throw(
			_("Select the supplier's approved bank account in Party Bank Account before sending for check."),
			title=_("Supplier bank account required"),
		)


def before_submit(doc, method=None):
	if doc.payment_type == "Receive":
		return
	if not doc.ppgpl_approved_by:
		frappe.throw(_("This payment has no recorded approval. It must go through the approval workflow."))
	if (doc.reference_no or "").strip().upper() == UTR_PLACEHOLDER and frappe.db.get_value("Account", doc.paid_from, "account_type") == "Bank":
		frappe.throw(
			_("Enter the bank UTR / reference number from net banking in Cheque/Reference No, and the release date, then save before Mark Paid."),
			title=_("UTR required"),
		)
	check_bank_account(doc)
	# Payment day check: release outside the payment days is allowed but logged
	settings = approval.get_settings()
	days = approval.parse_payment_days(settings.payment_days)
	release_date = getdate(doc.reference_date or doc.posting_date)
	doc.ppgpl_released_off_cycle = 1 if (days and release_date.weekday() not in days) else 0


def on_submit(doc, method=None):
	if doc.payment_type == "Receive":
		return
	party = doc.party_name or doc.party or ""
	if doc.ppgpl_payment_category == "Non-PO":
		log_exception(
			"Non-PO payment",
			doc,
			amount=doc.base_paid_amount,
			party=party,
			details=_("Non-PO payment of {0} to {1}").format(approval.money(doc.base_paid_amount), party),
		)
	if doc.ppgpl_off_cycle or doc.ppgpl_released_off_cycle:
		reason = doc.ppgpl_off_cycle_reason or _("Released on a day that is not a payment day")
		log_exception(
			"Off-cycle payment",
			doc,
			amount=doc.base_paid_amount,
			party=party,
			details=_("Off-cycle payment of {0} to {1}. Reason: {2}").format(
				approval.money(doc.base_paid_amount), party, reason
			),
		)
