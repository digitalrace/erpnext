// Copyright (c) 2026, Power Partner Global Pvt Ltd
frappe.query_reports["PPGPL Release Batch"] = {
	filters: [
		{ fieldname: "company", label: __("Company"), fieldtype: "Link", options: "Company", default: frappe.defaults.get_user_default("Company") },
		{
			fieldname: "paid_from",
			label: __("Pay from (bank account)"),
			fieldtype: "Link",
			options: "Account",
			get_query: () => ({ filters: { account_type: "Bank", is_group: 0 } }),
		},
	],
	onload(report) {
		report.page.add_inner_button(__("Download bank upload file (CSV)"), () => {
			const rows = (report.data || []).filter((r) => r.payment_entry);
			if (!rows.length) {
				frappe.msgprint(__("No approved payments to release."));
				return;
			}
			const missing = rows.filter((r) => !r.account_no || !r.ifsc).map((r) => r.payment_entry);
			if (missing.length) {
				frappe.msgprint(__("These payments have no approved supplier bank account and are left out: {0}", [missing.join(", ")]));
			}
			const out = [["Beneficiary Name", "Account Number", "IFSC", "Amount", "Payment Reference", "Remarks"]];
			rows.filter((r) => r.account_no && r.ifsc).forEach((r) =>
				out.push([r.beneficiary, r.account_no, r.ifsc, (r.amount || 0).toFixed(2), r.payment_entry, (r.party_name || "").slice(0, 30)])
			);
			frappe.tools.downloadify(out, null, "bank_upload_" + frappe.datetime.get_today());
		});
	},
};
