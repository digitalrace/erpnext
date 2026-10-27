app_name = "ppgpl_finance"
app_title = "PPGPL Finance"
app_publisher = "Power Partner Global Pvt Ltd"
app_description = (
	"Financial control and delegation of financial powers "
	"(SOP PPGPL/FIN/SOP/2026-27/001): approval workflows, payment runs, alerts and reports"
)
app_email = "cmd@powerpartnerglobal.com"
app_license = "mit"

required_apps = ["erpnext"]

add_to_apps_screen = [
	{
		"name": "ppgpl_finance",
		"logo": "/assets/ppgpl_finance/images/finance-control.svg",
		"title": "Finance Control",
		"route": "/desk/finance-control",
	}
]

# ---------------------------------------------------------------------------
# Install / migrate: roles, fields, workflows, permissions, dashboard
# ---------------------------------------------------------------------------
after_install = "ppgpl_finance.setup.install.after_install"
after_migrate = "ppgpl_finance.setup.install.after_migrate"
before_uninstall = "ppgpl_finance.setup.install.before_uninstall"

# ---------------------------------------------------------------------------
# Form scripts
# ---------------------------------------------------------------------------
doctype_js = {
	"Payment Entry": "public/js/payment_entry.js",
	"Purchase Order": "public/js/purchase_order.js",
	"Purchase Invoice": "public/js/purchase_invoice.js",
	"Journal Entry": "public/js/journal_entry.js",
	"Expense Claim": "public/js/expense_claim.js",
	"Employee Advance": "public/js/employee_advance.js",
	"Supplier": "public/js/supplier.js",
	"Bank Account": "public/js/bank_account.js",
}

# ---------------------------------------------------------------------------
# Server-side controls
# ---------------------------------------------------------------------------
_cancel_alert = "ppgpl_finance.controls.alerts.on_cancel"
_amend_alert = "ppgpl_finance.controls.alerts.after_insert_amendment"
_guard = "ppgpl_finance.controls.guards.before_submit"

doc_events = {
	"Payment Entry": {
		"before_validate": "ppgpl_finance.controls.payment_entry.before_validate",
		"validate": "ppgpl_finance.controls.payment_entry.validate",
		"before_submit": [_guard, "ppgpl_finance.controls.payment_entry.before_submit"],
		"on_submit": "ppgpl_finance.controls.payment_entry.on_submit",
		"on_cancel": _cancel_alert,
		"after_insert": _amend_alert,
	},
	"Purchase Order": {
		"validate": "ppgpl_finance.controls.purchase_order.validate",
		"before_submit": _guard,
		"on_cancel": _cancel_alert,
		"after_insert": _amend_alert,
	},
	"Purchase Invoice": {
		"before_submit": _guard,
		"on_cancel": _cancel_alert,
		"after_insert": _amend_alert,
	},
	"Journal Entry": {
		"validate": "ppgpl_finance.controls.simple_approvals.journal_entry_validate",
		"on_cancel": _cancel_alert,
		"after_insert": _amend_alert,
	},
	"Expense Claim": {
		"validate": "ppgpl_finance.controls.simple_approvals.expense_claim_validate",
	},
	"Employee Advance": {
		"validate": "ppgpl_finance.controls.simple_approvals.employee_advance_validate",
	},
	"Supplier": {
		"validate": "ppgpl_finance.controls.masters.supplier_validate",
	},
	"Bank Account": {
		"validate": "ppgpl_finance.controls.masters.bank_account_validate",
		"after_insert": "ppgpl_finance.controls.masters.bank_account_after_insert",
		"on_update": "ppgpl_finance.controls.masters.bank_account_on_update",
	},
}

# ---------------------------------------------------------------------------
# Scheduled reports and alerts (server time zone; set System Settings to Asia/Kolkata)
# ---------------------------------------------------------------------------
scheduler_events = {
	"cron": {
		"30 9 * * *": ["ppgpl_finance.controls.digest.daily_exceptions"],
		"0 10 * * 1-6": ["ppgpl_finance.controls.digest.daily_cash_position"],
		"30 8 * * 1": ["ppgpl_finance.controls.digest.weekly_review"],
		"0 18 * * *": ["ppgpl_finance.controls.digest.payment_run_reminder"],
	}
}
