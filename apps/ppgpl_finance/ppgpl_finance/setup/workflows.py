# Copyright (c) 2026, Power Partner Global Pvt Ltd
"""Workflow definitions (SOP Sections 3, 4, 5 and 8).

Routing reads `doc.ppgpl_approval_level`, which the server sets from PPGPL Finance Settings,
so changing a limit never requires editing these workflows.
"""

MAKER = "Finance Maker"
CHECKER = "Finance Checker"
L3 = "Finance Approver L3"
CMD = "CMD Approver"

LV_L2 = 'doc.ppgpl_approval_level == "L2"'
LV_L3 = 'doc.ppgpl_approval_level == "L3"'
LV_CMD = 'doc.ppgpl_approval_level == "CMD"'
LV_NOT_CMD = 'doc.ppgpl_approval_level != "CMD"'

# Actions the preparer takes on their own document. Every other action is a check or an
# approval and must be done by someone other than the document's creator.
PREPARER_ACTIONS = {
	"Send for Check",
	"Post Receipt",
	"Mark Paid",
	"Revise",
	"Send for Match",
	"Resubmit",
	"Submit for Approval",
	"Request Change",
	"Submit Change",
}

STATE_STYLES = {
	"Draft": "",
	"Pending Check": "Warning",
	"Pending L3 Approval": "Warning",
	"Pending CMD Approval": "Danger",
	"Pending Match": "Warning",
	"Pending Manager": "Warning",
	"Pending Approval": "Warning",
	"Pending Call-back": "Warning",
	"Approved": "Success",
	"Matched": "Success",
	"Completed": "Primary",
	"Rejected": "Danger",
	"On Hold": "Danger",
	"Change Requested": "Info",
	"Cancelled": "Inverse",
}


def approval_stage(final_state, maker_role):
	"""Pending Check → (L2 | L3 | CMD) → final_state, with rejection and absent-approver cover."""
	return [
		# L2 checks every document, then approves within its limit or forwards
		("Pending Check", "Approve", final_state, CHECKER, LV_L2),
		("Pending Check", "Verify & Forward", "Pending L3 Approval", CHECKER, LV_L3),
		("Pending Check", "Verify & Forward", "Pending CMD Approval", CHECKER, LV_CMD),
		("Pending Check", "Reject", "Rejected", CHECKER, None),
		# L2 absent: L3 checks, and the document then needs the CMD (SOP Section 2)
		("Pending Check", "Check & Forward to CMD", "Pending CMD Approval", L3, None),
		# L2 and L3 absent: the CMD can act at any stage
		("Pending Check", "Approve", final_state, CMD, None),
		("Pending Check", "Reject", "Rejected", CMD, None),
		("Pending L3 Approval", "Approve", final_state, L3, LV_NOT_CMD),
		("Pending L3 Approval", "Forward to CMD", "Pending CMD Approval", L3, LV_CMD),
		("Pending L3 Approval", "Reject", "Rejected", L3, None),
		("Pending L3 Approval", "Approve", final_state, CMD, None),
		("Pending L3 Approval", "Reject", "Rejected", CMD, None),
		("Pending CMD Approval", "Approve", final_state, CMD, None),
		("Pending CMD Approval", "Reject", "Rejected", CMD, None),
		("Rejected", "Revise", "Draft", maker_role, None),
	]


def approval_states(maker_role):
	return [
		("Pending Check", 0, CHECKER),
		("Pending L3 Approval", 0, L3),
		("Pending CMD Approval", 0, CMD),
		("Rejected", 0, maker_role),
	]


def definitions():
	"""Return {workflow name: dict(document_type, states, transitions)}.

	state tuple: (state, docstatus, allow_edit role[, update_field, update_value])
	transition tuple: (state, action, next_state, allowed role, condition)
	"""
	wf = {}

	# ---------------------------------------------------------------- Payment Entry
	wf["PPGPL Payment Entry"] = dict(
		document_type="Payment Entry",
		states=[("Draft", 0, MAKER)]
		+ approval_states(MAKER)
		+ [("Approved", 0, MAKER), ("Completed", 1, MAKER), ("Cancelled", 2, CMD)],
		transitions=[
			("Draft", "Send for Check", "Pending Check", MAKER, 'doc.payment_type != "Receive"'),
			("Draft", "Post Receipt", "Completed", MAKER, 'doc.payment_type == "Receive"'),
		]
		+ approval_stage("Approved", MAKER)
		+ [
			# Released in the bank by the authorisers; L1 enters the UTR and records it
			("Approved", "Mark Paid", "Completed", MAKER, None),
			("Approved", "Stop Payment", "Rejected", CMD, None),
			("Completed", "Cancel", "Cancelled", CMD, None),
		],
	)

	# ---------------------------------------------------------------- Purchase Order
	wf["PPGPL Purchase Order"] = dict(
		document_type="Purchase Order",
		states=[("Draft", 0, "Purchase User")]
		+ approval_states("Purchase User")
		+ [("Approved", 1, "Purchase Manager"), ("Cancelled", 2, CMD)],
		transitions=[("Draft", "Send for Check", "Pending Check", "Purchase User", None)]
		+ approval_stage("Approved", "Purchase User")
		+ [("Approved", "Cancel", "Cancelled", CMD, None)],
	)

	# ---------------------------------------------------------------- Purchase Invoice (three-way match)
	wf["PPGPL Purchase Invoice"] = dict(
		document_type="Purchase Invoice",
		states=[
			("Draft", 0, MAKER),
			("Pending Match", 0, CHECKER),
			("On Hold", 0, MAKER),
			("Matched", 1, CHECKER),
			("Cancelled", 2, CHECKER),
		],
		transitions=[
			("Draft", "Send for Match", "Pending Match", MAKER, None),
			("Pending Match", "Match OK", "Matched", CHECKER, None),
			("Pending Match", "Put on Hold", "On Hold", CHECKER, None),
			("Pending Match", "Match OK", "Matched", CMD, None),
			("On Hold", "Resubmit", "Pending Match", MAKER, None),
			("Matched", "Cancel", "Cancelled", CHECKER, None),
			("Matched", "Cancel", "Cancelled", CMD, None),
		],
	)

	# ---------------------------------------------------------------- Journal Entry
	wf["PPGPL Journal Entry"] = dict(
		document_type="Journal Entry",
		states=[("Draft", 0, MAKER)]
		+ approval_states(MAKER)
		+ [("Approved", 1, CHECKER), ("Cancelled", 2, CHECKER)],
		transitions=[("Draft", "Send for Check", "Pending Check", MAKER, None)]
		+ approval_stage("Approved", MAKER)
		+ [("Approved", "Cancel", "Cancelled", CHECKER, None), ("Approved", "Cancel", "Cancelled", CMD, None)],
	)

	# ---------------------------------------------------------------- Expense Claim (HRMS)
	wf["PPGPL Expense Claim"] = dict(
		document_type="Expense Claim",
		states=[
			("Draft", 0, "Employee", "approval_status", "Draft"),
			("Pending Manager", 0, "Expense Approver"),
			("Pending Check", 0, CHECKER),
			("Pending L3 Approval", 0, L3),
			("Pending CMD Approval", 0, CMD),
			("Rejected", 0, "Employee", "approval_status", "Rejected"),
			("Approved", 1, CHECKER, "approval_status", "Approved"),
			("Cancelled", 2, CMD),
		],
		transitions=[
			("Draft", "Submit for Approval", "Pending Manager", "Employee", None),
			("Pending Manager", "Manager Approve", "Pending Check", "Expense Approver", None),
			("Pending Manager", "Reject", "Rejected", "Expense Approver", None),
		]
		+ approval_stage("Approved", "Employee")
		+ [("Approved", "Cancel", "Cancelled", CMD, None)],
	)

	# ---------------------------------------------------------------- Employee Advance (HRMS)
	wf["PPGPL Employee Advance"] = dict(
		document_type="Employee Advance",
		states=[("Draft", 0, "Employee")]
		+ approval_states("Employee")
		+ [("Approved", 1, CHECKER), ("Cancelled", 2, CMD)],
		transitions=[("Draft", "Submit for Approval", "Pending Check", "Employee", None)]
		+ approval_stage("Approved", "Employee")
		+ [("Approved", "Cancel", "Cancelled", CMD, None)],
	)

	# ---------------------------------------------------------------- Supplier (new vendor onboarding)
	wf["PPGPL Supplier"] = dict(
		document_type="Supplier",
		states=[
			("Draft", 0, MAKER),
			("Pending Check", 0, CHECKER),
			("Pending Approval", 0, L3),
			("Approved", 0, CHECKER, "disabled", "0"),
			("Rejected", 0, MAKER),
		],
		transitions=[
			("Draft", "Send for Check", "Pending Check", MAKER, None),
			("Draft", "Send for Check", "Pending Check", "Purchase User", None),
			("Pending Check", "Verify", "Pending Approval", CHECKER, None),
			("Pending Check", "Reject", "Rejected", CHECKER, None),
			("Pending Approval", "Approve", "Approved", L3, None),
			("Pending Approval", "Reject", "Rejected", L3, None),
			("Pending Approval", "Approve", "Approved", CMD, None),
			("Pending Approval", "Reject", "Rejected", CMD, None),
			("Rejected", "Revise", "Draft", MAKER, None),
		],
	)

	# ---------------------------------------------------------------- Bank Account (call-back + CMD approval)
	wf["PPGPL Bank Account"] = dict(
		document_type="Bank Account",
		states=[
			("Pending Call-back", 0, CHECKER),
			("Pending CMD Approval", 0, CMD),
			("Approved", 0, CMD),
			("Rejected", 0, MAKER),
			("Change Requested", 0, MAKER),
		],
		transitions=[
			("Pending Call-back", "Call-back Done", "Pending CMD Approval", CHECKER, "doc.ppgpl_callback_note"),
			("Pending Call-back", "Reject", "Rejected", CHECKER, None),
			("Pending CMD Approval", "Approve", "Approved", CMD, None),
			("Pending CMD Approval", "Reject", "Rejected", CMD, None),
			("Rejected", "Resubmit", "Pending Call-back", MAKER, None),
			("Approved", "Request Change", "Change Requested", MAKER, None),
			("Change Requested", "Submit Change", "Pending Call-back", MAKER, None),
		],
	)
	return wf


# State an existing (pre-install) record is placed in, by docstatus
EXISTING_RECORD_STATES = {
	"Payment Entry": {0: "Draft", 1: "Completed", 2: "Cancelled"},
	"Purchase Order": {0: "Draft", 1: "Approved", 2: "Cancelled"},
	"Purchase Invoice": {0: "Draft", 1: "Matched", 2: "Cancelled"},
	"Journal Entry": {0: "Draft", 1: "Approved", 2: "Cancelled"},
	"Expense Claim": {0: "Draft", 1: "Approved", 2: "Cancelled"},
	"Employee Advance": {0: "Draft", 1: "Approved", 2: "Cancelled"},
}
