# Copyright (c) 2026, Power Partner Global Pvt Ltd
"""Vendor master controls (SOP Section 8): supplier approval and bank-account call-back."""

import frappe
from frappe import _
from frappe.model.workflow import get_workflow_name
from frappe.utils import now_datetime

from ppgpl_finance.controls.alerts import log_exception
from ppgpl_finance.controls.approval import previous_state

BANK_FIELDS = ("bank_account_no", "branch_code", "iban", "bank")
MSME = ("Micro", "Small", "Medium")


def _masked(account_no):
	account_no = (account_no or "").strip()
	return ("XXXX" + account_no[-4:]) if len(account_no) > 4 else account_no


# ---------------------------------------------------------------- Supplier
def supplier_validate(doc, method=None):
	if not get_workflow_name("Supplier"):
		return
	state = doc.get("workflow_state") or "Draft"
	if state != "Approved":
		doc.disabled = 1
	if state == "Pending Approval" and previous_state(doc) != "Pending Approval":
		if not doc.get("ppgpl_msme_category"):
			frappe.throw(_("Set MSME category (choose Not MSME if the supplier has no Udyam registration) before sending for approval."))
		if doc.get("ppgpl_msme_category") in MSME and not doc.get("ppgpl_udyam_no"):
			frappe.throw(_("Enter the Udyam registration number for an MSME supplier."))
		if not doc.get("ppgpl_kyc_complete"):
			frappe.throw(_("Tick KYC complete once GST certificate, PAN and cancelled cheque are on file."))


# ---------------------------------------------------------------- Bank Account
def bank_account_validate(doc, method=None):
	if not get_workflow_name("Bank Account"):
		return
	state = doc.get("workflow_state")
	prev = previous_state(doc)
	user = frappe.session.user

	if state == "Change Requested" and prev != "Change Requested":
		doc.ppgpl_callback_note = None
		doc.ppgpl_callback_by = None
		doc.ppgpl_callback_on = None
		doc.ppgpl_approved_by = None
		doc.ppgpl_approved_on = None

	if state == "Pending CMD Approval" and prev == "Pending Call-back":
		if not (doc.ppgpl_callback_note or "").strip():
			frappe.throw(_("Record the call-back (number called, person spoken to, what was confirmed) before forwarding to the CMD."))
		doc.ppgpl_callback_by = user
		doc.ppgpl_callback_on = now_datetime()

	if state == "Approved" and prev != "Approved":
		doc.ppgpl_approved_by = user
		doc.ppgpl_approved_on = now_datetime()


def bank_account_after_insert(doc, method=None):
	if doc.get("is_company_account") or doc.get("party_type") not in ("Supplier", "Employee", "Customer"):
		return
	log_exception(
		"Bank account added",
		doc,
		party=doc.get("party"),
		details=_("New bank account for {0} {1}: {2}, A/c {3}, IFSC {4}. It cannot be paid until the call-back is recorded and the CMD approves.").format(
			_(doc.party_type), doc.party, doc.get("bank") or "", _masked(doc.bank_account_no), doc.get("branch_code") or "-"
		),
	)


def bank_account_on_update(doc, method=None):
	before = doc.get_doc_before_save()
	if not before:
		return
	if doc.get("workflow_state") == "Change Requested" and before.get("workflow_state") != "Change Requested":
		log_exception(
			"Bank account change requested",
			doc,
			party=doc.get("party"),
			details=_("Change requested for bank account {0} of {1} by {2}").format(doc.name, doc.get("party") or "", frappe.session.user),
		)
	changed = [f for f in BANK_FIELDS if (before.get(f) or "") != (doc.get(f) or "")]
	if changed:
		log_exception(
			"Bank account changed",
			doc,
			party=doc.get("party"),
			details=_("Bank details of {0} changed by {1}: A/c {2} → {3}, IFSC {4} → {5}").format(
				doc.name,
				frappe.session.user,
				_masked(before.get("bank_account_no")),
				_masked(doc.get("bank_account_no")),
				before.get("branch_code") or "-",
				doc.get("branch_code") or "-",
			),
		)
