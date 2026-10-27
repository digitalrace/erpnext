// Copyright (c) 2026, Power Partner Global Pvt Ltd
// SOP PPGPL/FIN/SOP/2026-27/001 – Payment Entry guidance
frappe.ui.form.on("Payment Entry", {
	setup(frm) {
		frm.set_query("party_bank_account", () => ({
			filters: {
				party_type: frm.doc.party_type,
				party: frm.doc.party,
				workflow_state: "Approved",
			},
		}));
	},
	refresh(frm) {
		ppgpl_payment_intro(frm);
	},
	ppgpl_off_cycle(frm) {
		if (frm.doc.ppgpl_off_cycle) {
			frappe.show_alert({ message: __("Off-cycle payments always go to the CMD for approval."), indicator: "orange" });
		}
	},
});

function ppgpl_payment_intro(frm) {
	const d = frm.doc;
	if (d.payment_type === "Receive" || frm.is_new()) {
		if (frm.is_new() && d.payment_type === "Pay") {
			frm.set_intro(__("Fill the payment, choose the supplier's approved bank account, save, then use Actions → Send for Check."), "blue");
		}
		return;
	}
	const who = d.ppgpl_approver || __("the approver");
	const msgs = {
		Draft: [__("Approval route: {0}. When ready, use Actions → Send for Check.", [who]), "blue"],
		"Pending Check": [
			__("With L2 for check: invoice, TDS, supplier bank account and funds. L2 then approves (within limit) or uses Verify & Forward. Route: {0}.", [who]),
			"orange",
		],
		"Pending L3 Approval": [__("Waiting for {0}.", [who]), "orange"],
		"Pending CMD Approval": [__("Waiting for {0}.", [who]), "red"],
		Approved: [
			__(
				"Approved by {0}. Release it in net banking on the payment day, replace UTR-PENDING in Cheque/Reference No with the bank UTR, set the date, save, then use Actions → Mark Paid.",
				[d.ppgpl_approved_by ? frappe.user.full_name(d.ppgpl_approved_by) : ""]
			),
			"green",
		],
		Rejected: [__("Rejected. Correct the payment, then use Actions → Revise to start again."), "red"],
	};
	const m = msgs[d.workflow_state];
	if (m) frm.set_intro(m[0], m[1]);
}
