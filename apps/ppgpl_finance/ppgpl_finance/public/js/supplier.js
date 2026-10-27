// Copyright (c) 2026, Power Partner Global Pvt Ltd
frappe.ui.form.on("Supplier", {
	refresh(frm) {
		const msgs = {
			Draft: [__("New supplier (disabled until approved). Attach GST certificate, PAN and cancelled cheque, verify the GSTIN on the GST portal, then use Actions → Send for Check."), "blue"],
			"Pending Check": [__("L2: set MSME category, TDS category and credit terms, tick KYC complete, then use Actions → Verify."), "orange"],
			"Pending Approval": [__("Waiting for L3 approval. The supplier stays disabled until approved."), "orange"],
			Rejected: [__("Rejected. Correct the details, then use Actions → Revise."), "red"],
		};
		const m = msgs[frm.doc.workflow_state];
		if (m && !frm.is_new()) frm.set_intro(m[0], m[1]);
	},
});
