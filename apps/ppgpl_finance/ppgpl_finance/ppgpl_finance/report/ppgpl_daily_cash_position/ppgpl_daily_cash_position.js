// Copyright (c) 2026, Power Partner Global Pvt Ltd
frappe.query_reports["PPGPL Daily Cash Position"] = {
	filters: [
		{ fieldname: "company", label: __("Company"), fieldtype: "Link", options: "Company", default: frappe.defaults.get_user_default("Company") },
		{ fieldname: "date", label: __("As on"), fieldtype: "Date", default: frappe.datetime.get_today() },
	],
	formatter(value, row, column, data, default_formatter) {
		value = default_formatter(value, row, column, data);
		if (column.fieldname === "balance" && data && data.overdrawn) value = `<span style="color:#b42318;font-weight:600">${value}</span>`;
		if (column.fieldname === "float_left_pct" && data && data.float_left_pct != null && data.float_left_pct < (data.float_alert_pct || 30))
			value = `<span style="color:#b42318;font-weight:600">${value}</span>`;
		return value;
	},
};
