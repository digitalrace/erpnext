// Copyright (c) 2026, Power Partner Global Pvt Ltd
frappe.ui.form.on("PPGPL Exception", {
	refresh(frm) {
		if (frm.doc.reference_doctype && frm.doc.reference_name) {
			frm.add_custom_button(__("Open {0}", [frm.doc.reference_name]), () =>
				frappe.set_route("Form", frm.doc.reference_doctype, frm.doc.reference_name)
			);
		}
	},
});
