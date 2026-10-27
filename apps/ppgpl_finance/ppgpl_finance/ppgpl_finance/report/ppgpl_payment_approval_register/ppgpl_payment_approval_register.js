// Copyright (c) 2026, Power Partner Global Pvt Ltd
frappe.query_reports["PPGPL Payment Approval Register"] = {
	filters: [
		{ fieldname: "company", label: __("Company"), fieldtype: "Link", options: "Company", default: frappe.defaults.get_user_default("Company") },
		{ fieldname: "from_date", label: __("From"), fieldtype: "Date", default: frappe.datetime.month_start() },
		{ fieldname: "to_date", label: __("To"), fieldtype: "Date", default: frappe.datetime.get_today() },
		{ fieldname: "workflow_state", label: __("State"), fieldtype: "Link", options: "Workflow State" },
		{ fieldname: "level", label: __("Level"), fieldtype: "Select", options: "\nL2\nL3\nCMD" },
		{
			fieldname: "category",
			label: __("Category"),
			fieldtype: "Select",
			options: "\nAgainst Invoice\nAdvance\nNon-PO\nRecurring Bill\nStatutory\nEmployee\nRefund\nInternal Transfer\nInter-company",
		},
	],
};
