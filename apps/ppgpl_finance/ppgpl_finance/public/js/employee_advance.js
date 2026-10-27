// Copyright (c) 2026, Power Partner Global Pvt Ltd
frappe.ui.form.on("Employee Advance", {
	refresh(frm) {
		const d = frm.doc;
		if (frm.is_new() || d.docstatus !== 0 || !d.ppgpl_approver) return;
		const steps = ["Draft", "Pending Manager", "Pending Check", "Pending L3 Approval", "Pending CMD Approval"];
		if (steps.includes(d.workflow_state)) {
			frm.set_intro(
				__("Approval route: {0}. Current step: {1}.", [d.ppgpl_approver, __(d.workflow_state)]),
				d.workflow_state === "Draft" ? "blue" : "orange"
			);
		}
	},
});
