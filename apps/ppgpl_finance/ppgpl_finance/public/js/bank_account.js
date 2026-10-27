// Copyright (c) 2026, Power Partner Global Pvt Ltd
frappe.ui.form.on("Bank Account", {
	refresh(frm) {
		if (frm.is_new()) {
			frm.set_intro(__("Enter the account exactly as on the supplier's letterhead request and cancelled cheque. It cannot be paid until L2 records a call-back and the CMD approves."), "blue");
			return;
		}
		const msgs = {
			"Pending Call-back": [
				__("L2: call the supplier on the phone number already in ERPNext (never one given in the request). Record who you spoke to and what they confirmed in Call-back record, save, then use Actions → Call-back Done."),
				"orange",
			],
			"Pending CMD Approval": [__("Waiting for CMD approval. After approving here, the CMD also authorises the beneficiary in net banking. The first payment is a ₹1 test transfer."), "red"],
			"Change Requested": [__("Edit the account details from the supplier's written request, then use Actions → Submit Change. L2 will call back again."), "blue"],
			Rejected: [__("Rejected. Correct the details, then use Actions → Resubmit."), "red"],
		};
		const m = msgs[frm.doc.workflow_state];
		if (m) frm.set_intro(m[0], m[1]);
	},
});
