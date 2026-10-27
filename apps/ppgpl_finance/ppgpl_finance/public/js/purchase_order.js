// Copyright (c) 2026, Power Partner Global Pvt Ltd
frappe.ui.form.on("Purchase Order", {
	refresh(frm) {
		const d = frm.doc;
		if (frm.is_new() || d.docstatus !== 0) return;
		const who = d.ppgpl_approver || __("the approver");
		const reason = d.ppgpl_cmd_reason ? " (" + d.ppgpl_cmd_reason + ")" : "";
		const msgs = {
			Draft: [__("Approval route: {0}{1}. When ready, use Actions → Send for Check.", [who, reason]), "blue"],
			"Pending Check": [__("With L2 for the budget and rate check. Route: {0}{1}.", [who, reason]), "orange"],
			"Pending L3 Approval": [__("Waiting for {0}.", [who]), "orange"],
			"Pending CMD Approval": [__("Waiting for {0}{1}.", [who, reason]), "red"],
			Rejected: [__("Rejected. Correct the order, then use Actions → Revise."), "red"],
		};
		const m = msgs[d.workflow_state];
		if (m) frm.set_intro(m[0], m[1]);
	},
});
