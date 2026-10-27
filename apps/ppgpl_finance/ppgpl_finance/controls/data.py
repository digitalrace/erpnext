# Copyright (c) 2026, Power Partner Global Pvt Ltd
"""Shared queries for reports, dashboard cards and scheduled emails."""

import frappe
from frappe.utils import add_days, cint, date_diff, flt, getdate, nowdate

PENDING_STATES = ("Pending Check", "Pending L3 Approval", "Pending CMD Approval", "Pending Match", "Pending Approval", "Pending Manager", "Pending Call-back")
APPROVAL_DOCTYPES = ("Payment Entry", "Purchase Order", "Journal Entry", "Expense Claim", "Employee Advance", "Purchase Invoice", "Supplier", "Bank Account")


def default_company():
	return frappe.defaults.get_user_default("Company") or frappe.db.get_single_value("Global Defaults", "default_company")


def companies(company=None):
	if company:
		return [company]
	return frappe.get_all("Company", pluck="name")


# ---------------------------------------------------------------- cash
def cash_position(company=None, on_date=None):
	on_date = getdate(on_date or nowdate())
	yesterday = add_days(on_date, -1)
	accounts = frappe.get_all(
		"Account",
		filters={"account_type": ["in", ["Bank", "Cash"]], "is_group": 0, "company": ["in", companies(company)], "disabled": 0},
		fields=["name", "account_type", "company", "account_currency"],
		order_by="account_type, name",
	)
	if not accounts:
		return []
	names = [a.name for a in accounts]
	bal = dict(
		frappe.db.sql(
			"""select account, sum(debit) - sum(credit) from `tabGL Entry`
			where is_cancelled = 0 and posting_date <= %s and account in %s group by account""",
			(on_date, tuple(names)),
		)
	)
	moves = {
		r[0]: (flt(r[1]), flt(r[2]))
		for r in frappe.db.sql(
			"""select account, sum(debit), sum(credit) from `tabGL Entry`
			where is_cancelled = 0 and posting_date = %s and account in %s group by account""",
			(yesterday, tuple(names)),
		)
	}
	floats = petty_cash_floats()
	rows = []
	for a in accounts:
		balance = flt(bal.get(a.name))
		recv, paid = moves.get(a.name, (0.0, 0.0))
		fl = floats.get(a.name)
		rows.append(
			frappe._dict(
				account=a.name,
				account_type=a.account_type,
				company=a.company,
				balance=balance,
				receipts=recv,
				payments=paid,
				overdrawn=1 if balance < 0 else 0,
				float_amount=flt(fl.float_amount) if fl else None,
				float_left_pct=(balance / flt(fl.float_amount) * 100) if fl and flt(fl.float_amount) else None,
				float_alert_pct=flt(fl.alert_below_pct) if fl else None,
				holder=fl.holder if fl else None,
			)
		)
	return rows


def petty_cash_floats():
	settings = frappe.get_cached_doc("PPGPL Finance Settings")
	return {r.account: r for r in settings.petty_cash_floats}


def bank_balance(company=None):
	return sum(r.balance for r in cash_position(company) if r.account_type == "Bank")


# ---------------------------------------------------------------- payables
def open_invoices(company=None, due_by=None, include_all=False):
	conditions = ["pi.docstatus = 1", "pi.outstanding_amount > 0", "pi.company in %(companies)s"]
	if not include_all and due_by:
		conditions.append("ifnull(pi.due_date, pi.posting_date) <= %(due_by)s")
	return frappe.db.sql(
		f"""
		select pi.name, pi.supplier, pi.supplier_name, pi.company, pi.project, pi.bill_no, pi.bill_date,
			pi.posting_date, ifnull(pi.due_date, pi.posting_date) as due_date, pi.outstanding_amount,
			pi.grand_total, pi.is_return,
			s.ppgpl_msme_category as msme, ifnull(s.ppgpl_msme_payment_days, 45) as msme_days
		from `tabPurchase Invoice` pi
		left join `tabSupplier` s on s.name = pi.supplier
		where {" and ".join(conditions)}
		order by ifnull(pi.due_date, pi.posting_date), pi.name
		""",
		{"companies": tuple(companies(company)), "due_by": due_by},
		as_dict=True,
	)


def invoices_in_draft_payments(invoices):
	if not invoices:
		return {}
	return dict(
		frappe.db.sql(
			"""select r.reference_name, pe.name from `tabPayment Entry Reference` r
			join `tabPayment Entry` pe on pe.name = r.parent
			where pe.docstatus = 0 and r.reference_doctype = 'Purchase Invoice' and r.reference_name in %s""",
			(tuple(invoices),),
		)
	)


def msme_overdue(company=None, older_than_days=30, as_on=None):
	as_on = getdate(as_on or nowdate())
	rows = []
	for inv in open_invoices(company, include_all=True):
		if inv.msme in ("Micro", "Small", "Medium") and not inv.is_return:
			age = date_diff(as_on, inv.posting_date)
			if age > cint(older_than_days):
				inv.age = age
				rows.append(inv)
	return rows


def ageing(doctype, company=None, as_on=None):
	"""Outstanding by age of due date: not due, 0-30, 31-60, 61-90, over 90 days."""
	as_on = getdate(as_on or nowdate())
	table = "Purchase Invoice" if doctype == "Purchase Invoice" else "Sales Invoice"
	data = frappe.db.sql(
		f"""select ifnull(due_date, posting_date) as due_date, outstanding_amount
		from `tab{table}` where docstatus = 1 and outstanding_amount > 0 and company in %s""",
		(tuple(companies(company)),),
		as_dict=True,
	)
	buckets = {"Not due": 0.0, "0-30": 0.0, "31-60": 0.0, "61-90": 0.0, "Over 90": 0.0}
	for d in data:
		days = date_diff(as_on, d.due_date)
		key = "Not due" if days < 0 else "0-30" if days <= 30 else "31-60" if days <= 60 else "61-90" if days <= 90 else "Over 90"
		buckets[key] += flt(d.outstanding_amount)
	return buckets


def payables_due(company=None, days=7):
	due_by = add_days(nowdate(), cint(days))
	return sum(flt(i.outstanding_amount) for i in open_invoices(company, due_by=due_by) if not i.is_return)


def receivables_over(company=None, days=90):
	return ageing("Sales Invoice", company)["Over 90"] if cint(days) == 90 else 0.0


def open_supplier_advances(company=None):
	return flt(
		frappe.db.sql(
			"""select sum(unallocated_amount) from `tabPayment Entry`
			where docstatus = 1 and payment_type = 'Pay' and party_type = 'Supplier' and unallocated_amount > 0
			and company in %s""",
			(tuple(companies(company)),),
		)[0][0]
	)


def open_employee_advances(company=None):
	if not frappe.db.exists("DocType", "Employee Advance"):
		return 0.0
	return flt(
		frappe.db.sql(
			"""select sum(paid_amount - claimed_amount - return_amount) from `tabEmployee Advance`
			where docstatus = 1 and company in %s and paid_amount > claimed_amount + return_amount""",
			(tuple(companies(company)),),
		)[0][0]
	)


# ---------------------------------------------------------------- approvals
def pending_approvals(level_states=PENDING_STATES):
	out = []
	for dt in APPROVAL_DOCTYPES:
		if not frappe.db.exists("DocType", dt) or not frappe.get_meta(dt).has_field("workflow_state"):
			continue
		amount_field = {
			"Payment Entry": "base_paid_amount",
			"Purchase Order": "base_grand_total",
			"Journal Entry": "total_debit",
			"Expense Claim": "total_sanctioned_amount",
			"Employee Advance": "advance_amount",
			"Purchase Invoice": "base_grand_total",
		}.get(dt)
		fields = ["workflow_state", {"COUNT": "*", "as": "count"}]
		if amount_field:
			fields.append({"SUM": amount_field, "as": "amount"})
		for r in frappe.get_all(
			dt, filters={"workflow_state": ["in", list(level_states)], "docstatus": 0}, fields=fields, group_by="workflow_state"
		):
			out.append(frappe._dict(doctype=dt, state=r.workflow_state, count=r.count, amount=flt(r.get("amount"))))
	return out


# What each role acts on next (the "Waiting for my action" card)
ROLE_QUEUE = {
	"CMD Approver": {"*": ["Pending CMD Approval"]},
	"Finance Approver L3": {"*": ["Pending L3 Approval"], "Supplier": ["Pending Approval"]},
	"Finance Checker": {"*": ["Pending Check"], "Purchase Invoice": ["Pending Match"], "Bank Account": ["Pending Call-back"]},
	"Finance Maker": {"Payment Entry": ["Approved", "Rejected"], "Purchase Invoice": ["On Hold"], "Bank Account": ["Rejected", "Change Requested"]},
}


def my_queue_count(user=None):
	roles = set(frappe.get_roles(user or frappe.session.user))
	total = 0
	for dt in APPROVAL_DOCTYPES:
		if not frappe.db.exists("DocType", dt) or not frappe.get_meta(dt).has_field("workflow_state"):
			continue
		states = set()
		for role, mapping in ROLE_QUEUE.items():
			if role in roles:
				states.update(mapping.get(dt, []) + mapping.get("*", []))
		if states:
			total += frappe.db.count(dt, {"workflow_state": ["in", list(states)], "docstatus": 0})
	return total


def pending_with_cmd_count():
	return sum(r.count for r in pending_approvals(("Pending CMD Approval",)))


def pending_documents(state):
	out = []
	for dt in ("Payment Entry", "Purchase Order", "Journal Entry", "Expense Claim", "Employee Advance"):
		if not frappe.db.exists("DocType", dt) or not frappe.get_meta(dt).has_field("workflow_state"):
			continue
		amount_field = {
			"Payment Entry": "base_paid_amount",
			"Purchase Order": "base_grand_total",
			"Journal Entry": "total_debit",
			"Expense Claim": "total_sanctioned_amount",
			"Employee Advance": "advance_amount",
		}[dt]
		party_field = {
			"Payment Entry": "party_name",
			"Purchase Order": "supplier_name",
			"Journal Entry": "user_remark",
			"Expense Claim": "employee_name",
			"Employee Advance": "employee_name",
		}[dt]
		for r in frappe.get_all(
			dt,
			filters={"workflow_state": state, "docstatus": 0},
			fields=["name", f"{amount_field} as amount", f"{party_field} as party"],
			order_by="modified asc",
		):
			r.doctype = dt
			out.append(r)
	return out


# ---------------------------------------------------------------- budgets (ERPNext v16: one account per budget)
def project_budget_usage(company=None, as_on=None):
	as_on = getdate(as_on or nowdate())
	budgets = frappe.get_all(
		"Budget",
		filters={"docstatus": 1, "budget_against": "Project", "company": ["in", companies(company)]},
		fields=["name", "project", "account", "budget_amount", "budget_start_date", "budget_end_date"],
	)
	rows = []
	for b in budgets:
		if b.budget_start_date and getdate(b.budget_start_date) > as_on:
			continue
		if b.budget_end_date and getdate(b.budget_end_date) < as_on:
			continue
		lft, rgt = frappe.db.get_value("Account", b.account, ["lft", "rgt"]) or (None, None)
		if lft is None:
			continue
		actual = flt(
			frappe.db.sql(
				"""select sum(gle.debit) - sum(gle.credit) from `tabGL Entry` gle
				join `tabAccount` a on a.name = gle.account
				where gle.is_cancelled = 0 and gle.project = %s and a.lft >= %s and a.rgt <= %s
				and gle.posting_date between %s and %s""",
				(b.project, lft, rgt, b.budget_start_date or "1900-01-01", as_on),
			)[0][0]
		)
		budget = flt(b.budget_amount)
		rows.append(
			frappe._dict(
				budget=b.name,
				project=b.project,
				account=b.account,
				budget_amount=budget,
				actual=actual,
				used_pct=(actual / budget * 100) if budget else 0,
			)
		)
	return sorted(rows, key=lambda r: -r.used_pct)
