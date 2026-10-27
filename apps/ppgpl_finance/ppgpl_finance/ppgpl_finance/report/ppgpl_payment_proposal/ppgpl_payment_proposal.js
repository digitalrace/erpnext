// Copyright (c) 2026, Power Partner Global Pvt Ltd
frappe.query_reports["PPGPL Payment Proposal"] = {
	filters: [
		{ fieldname: "company", label: __("Company"), fieldtype: "Link", options: "Company", default: frappe.defaults.get_user_default("Company") },
		{ fieldname: "as_on", label: __("As on"), fieldtype: "Date", default: frappe.datetime.get_today() },
		{ fieldname: "horizon_days", label: __("Due within (days)"), fieldtype: "Int", default: 7 },
		{ fieldname: "show_all", label: __("Show all outstanding"), fieldtype: "Check" },
		{
			fieldname: "paid_from",
			label: __("Pay from (bank account)"),
			fieldtype: "Link",
			options: "Account",
			get_query: () => ({ filters: { account_type: "Bank", is_group: 0 } }),
		},
	],
	get_datatable_options(options) {
		return Object.assign(options, { checkboxColumn: true });
	},
	formatter(value, row, column, data, default_formatter) {
		value = default_formatter(value, row, column, data);
		if (column.fieldname === "reason" && data && data.priority === 1) value = `<span style="color:#b42318;font-weight:600">${value}</span>`;
		if (column.fieldname === "approval" && data && data.approval === "CMD") value = `<span style="color:#b54708;font-weight:600">${value}</span>`;
		return value;
	},
	onload(report) {
		report.page.add_inner_button(__("Create Payment Entries"), () => {
			const idx = report.datatable ? report.datatable.rowmanager.getCheckedRows() : [];
			const rows = idx.map((i) => report.data[i]).filter((r) => r && r.invoice && !r.in_payment);
			if (!rows.length) {
				frappe.msgprint(__("Tick the invoices to pay. Invoices that already have a draft payment are skipped."));
				return;
			}
			const total = rows.reduce((a, r) => a + (r.outstanding || 0), 0);
			frappe.confirm(__("Create {0} draft payments totalling {1}?", [rows.length, format_currency(total)]), () =>
				frappe.call({
					method: "ppgpl_finance.controls.api.create_payment_entries",
					args: { invoices: rows.map((r) => r.invoice), paid_from: report.get_filter_value("paid_from") },
					freeze: true,
					callback: (r) => {
						const m = r.message || {};
						let html = "";
						if ((m.created || []).length) html += __("Created: {0}", [m.created.map((n) => frappe.utils.get_form_link("Payment Entry", n, true)).join(", ")]);
						if ((m.skipped || []).length) html += "<br><br>" + __("Skipped:") + "<br>" + m.skipped.join("<br>");
						frappe.msgprint({ title: __("Payment proposal"), message: html, indicator: (m.skipped || []).length ? "orange" : "green" });
						report.refresh();
					},
				})
			);
		});
		report.page.add_inner_button(__("Send drafts for check"), () => {
			const names = [...new Set((report.data || []).map((r) => r.in_payment).filter(Boolean))];
			if (!names.length) {
				frappe.msgprint(__("No draft payments in this proposal."));
				return;
			}
			frappe.confirm(__("Send {0} draft payments to L2 for check?", [names.length]), () =>
				frappe.call({
					method: "ppgpl_finance.controls.api.send_for_check",
					args: { payment_entries: names },
					freeze: true,
					callback: (r) => {
						const m = r.message || {};
						let html = __("Sent for check: {0}", [(m.done || []).length]);
						if ((m.failed || []).length) html += "<br><br>" + m.failed.join("<br>");
						frappe.msgprint({ title: __("Payment proposal"), message: html, indicator: (m.failed || []).length ? "orange" : "green" });
						report.refresh();
					},
				})
			);
		});
	},
};
