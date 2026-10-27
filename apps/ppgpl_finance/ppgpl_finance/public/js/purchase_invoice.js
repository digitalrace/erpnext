// Copyright (c) 2026, Power Partner Global Pvt Ltd
frappe.ui.form.on("Purchase Invoice", {
	refresh(frm) {
		const d = frm.doc;
		if (frm.is_new() || d.docstatus !== 0) return;
		const msgs = {
			Draft: [__("Book the invoice against its PO and goods receipt, then use Actions → Send for Match."), "blue"],
			"Pending Match": [
				__("L2: check quantity, rate, GST rate, supplier GSTIN and TDS section against the PO and goods receipt. Then Match OK, or Put on Hold with a comment."),
				"orange",
			],
			"On Hold": [__("On hold after the three-way match. Purchase settles it with the supplier (debit note if needed); then use Actions → Resubmit."), "red"],
		};
		const m = msgs[d.workflow_state];
		if (m) frm.set_intro(m[0], m[1]);
	},
});
