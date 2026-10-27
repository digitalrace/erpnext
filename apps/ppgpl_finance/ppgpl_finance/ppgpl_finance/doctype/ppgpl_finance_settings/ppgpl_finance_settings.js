// Copyright (c) 2026, Power Partner Global Pvt Ltd
frappe.ui.form.on("PPGPL Finance Settings", {
	refresh(frm) {
		frm.set_intro(
			__(
				"Limits, names and the rollout phase for SOP PPGPL/FIN/SOP/2026-27/001. Changes apply to every document saved after you save this page; documents already waiting for approval are re-routed at once."
			),
			"blue"
		);
		frm.set_query("account", "petty_cash_floats", () => ({
			filters: { account_type: "Cash", is_group: 0 },
		}));
	},
	repair_setup(frm) {
		frappe.confirm(
			__("Recreate the PPGPL workflows, roles and fields? Any manual edits to these workflows will be replaced."),
			() =>
				frappe.call({
					method: "ppgpl_finance.setup.install.run_setup",
					args: {},
					freeze: true,
					freeze_message: __("Setting up..."),
					callback: (r) => {
						frappe.msgprint({ title: __("Setup complete"), message: (r.message || []).join("<br>"), indicator: "green" });
					},
				})
		);
	},
});
