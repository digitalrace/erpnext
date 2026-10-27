# Copyright (c) 2026, Power Partner Global Pvt Ltd
"""Scheduled emails (SOP Section 9): daily cash position, daily exceptions, weekly review, payment-run reminder."""

import frappe
from frappe import _
from frappe.utils import add_days, flt, formatdate, get_url_to_form, get_url_to_report, getdate, nowdate

from ppgpl_finance.controls import approval, data
from ppgpl_finance.controls.alerts import recipients, safe_sendmail

STYLE = (
	"<style>table.ppg{border-collapse:collapse;font-size:13px;margin:6px 0 14px}"
	"table.ppg th{background:#17184E;color:#fff;text-align:left;padding:5px 8px}"
	"table.ppg td{border-bottom:1px solid #dfe3e8;padding:5px 8px}"
	"td.n,th.n{text-align:right}h3{color:#17184E;margin:16px 0 4px}</style>"
)


def _m(v):
	return approval.money(flt(v))


def _table(headers, rows, numeric=()):
	head = "".join(f'<th class="{"n" if i in numeric else ""}">{h}</th>' for i, h in enumerate(headers))
	body = "".join(
		"<tr>" + "".join(f'<td class="{"n" if i in numeric else ""}">{c}</td>' for i, c in enumerate(r)) + "</tr>" for r in rows
	)
	return f'<table class="ppg"><tr>{head}</tr>{body}</table>'


def _link(doctype, name):
	return f'<a href="{get_url_to_form(doctype, name)}">{name}</a>'


def _send(levels, subject, html):
	to = recipients(levels)
	if not to:
		return
	safe_sendmail(recipients=to, subject=subject, message=STYLE + html)


def _enabled(field):
	return frappe.db.get_single_value("PPGPL Finance Settings", field)


# ---------------------------------------------------------------- daily cash position, 10 am
def daily_cash_position():
	if not _enabled("send_daily_cash"):
		return
	rows = data.cash_position()
	if not rows:
		return
	body = _table(
		[_("Account"), _("Type"), _("Balance"), _("Receipts yesterday"), _("Payments yesterday")],
		[
			[r.account, r.account_type, ("<b style='color:#b42318'>" + _m(r.balance) + "</b>") if r.overdrawn else _m(r.balance), _m(r.receipts), _m(r.payments)]
			for r in rows
		],
		numeric=(2, 3, 4),
	)
	bank = sum(r.balance for r in rows if r.account_type == "Bank")
	html = f"<p>{_('Bank balance (books)')}: <b>{_m(bank)}</b>. {_('Negative balances are cash-credit or overdraft use.')}</p>{body}"
	html += f'<p><a href="{get_url_to_report("PPGPL Daily Cash Position", "Script Report")}">{_("Open the report")}</a></p>'
	_send(("CMD", "L2"), _("Daily cash position – {0}").format(formatdate(nowdate())), html)


# ---------------------------------------------------------------- daily exceptions, 9:30 am
def daily_exceptions():
	if not _enabled("send_daily_exceptions"):
		return
	settings = approval.get_settings()
	parts = []

	pending = data.pending_documents("Pending CMD Approval")
	if pending:
		parts.append(f"<h3>{_('Waiting for your approval')}</h3>")
		parts.append(
			_table([_("Document"), _("Type"), _("Party"), _("Amount")], [[_link(p.doctype, p.name), _(p.doctype), p.party or "", _m(p.amount)] for p in pending], numeric=(3,))
		)

	over = [b for b in data.project_budget_usage() if b.used_pct > 100]
	if over:
		parts.append(f"<h3>{_('Projects over budget')}</h3>")
		parts.append(
			_table(
				[_("Project"), _("Account"), _("Budget"), _("Actual"), _("Used")],
				[[b.project, b.account, _m(b.budget_amount), _m(b.actual), f"{b.used_pct:.0f}%"] for b in over],
				numeric=(2, 3, 4),
			)
		)

	msme = data.msme_overdue(older_than_days=settings.msme_alert_days or 30)
	if msme:
		parts.append(f"<h3>{_('MSME dues older than {0} days').format(settings.msme_alert_days or 30)}</h3>")
		parts.append(
			_table(
				[_("Invoice"), _("Supplier"), _("MSME"), _("Age (days)"), _("Outstanding")],
				[[_link("Purchase Invoice", r.name), r.supplier_name, r.msme, r.age, _m(r.outstanding_amount)] for r in msme],
				numeric=(3, 4),
			)
		)

	low = [r for r in data.cash_position() if r.float_amount and r.float_left_pct is not None and r.float_left_pct < (r.float_alert_pct or 30)]
	if low:
		parts.append(f"<h3>{_('Petty cash floats running low')}</h3>")
		parts.append(
			_table(
				[_("Account"), _("Holder"), _("Float"), _("Balance"), _("Left")],
				[[r.account, r.holder or "", _m(r.float_amount), _m(r.balance), f"{r.float_left_pct:.0f}%"] for r in low],
				numeric=(2, 3, 4),
			)
		)

	yesterday = add_days(nowdate(), -1)
	exc = frappe.get_all(
		"PPGPL Exception",
		filters={"posting_date": yesterday},
		fields=["name", "exception_type", "reference_doctype", "reference_name", "party", "amount"],
	)
	if exc:
		parts.append(f"<h3>{_('Exceptions logged yesterday')}</h3>")
		parts.append(
			_table(
				[_("Exception"), _("Document"), _("Party"), _("Amount")],
				[[e.exception_type, _link(e.reference_doctype, e.reference_name) if e.reference_name else "", e.party or "", _m(e.amount)] for e in exc],
				numeric=(3,),
			)
		)

	if parts:
		_send(("CMD",), _("Finance exceptions – {0}").format(formatdate(nowdate())), "".join(parts))


# ---------------------------------------------------------------- weekly review, Monday 8:30 am
def weekly_review():
	if not _enabled("send_weekly_review"):
		return
	pay = data.ageing("Purchase Invoice")
	rec = data.ageing("Sales Invoice")
	order = ["Not due", "0-30", "31-60", "61-90", "Over 90"]
	parts = [f"<h3>{_('Payables and receivables by days past due')}</h3>"]
	parts.append(
		_table(
			[""] + order + [_("Total")],
			[
				[_("Payables")] + [_m(pay[k]) for k in order] + [_m(sum(pay.values()))],
				[_("Receivables")] + [_m(rec[k]) for k in order] + [_m(sum(rec.values()))],
			],
			numeric=(1, 2, 3, 4, 5, 6),
		)
	)
	msme = data.msme_overdue(older_than_days=0)
	parts.append(
		f"<p>{_('MSME dues outstanding')}: <b>{_m(sum(r.outstanding_amount for r in msme))}</b> · "
		f"{_('Open vendor advances')}: <b>{_m(data.open_supplier_advances())}</b> · "
		f"{_('Open employee advances')}: <b>{_m(data.open_employee_advances())}</b></p>"
	)
	budgets = data.project_budget_usage()
	if budgets:
		parts.append(f"<h3>{_('Project cost against budget')}</h3>")
		parts.append(
			_table(
				[_("Project"), _("Account"), _("Budget"), _("Actual"), _("Used")],
				[[b.project, b.account, _m(b.budget_amount), _m(b.actual), f"{b.used_pct:.0f}%"] for b in budgets[:25]],
				numeric=(2, 3, 4),
			)
		)
	week_ago = add_days(nowdate(), -7)
	exc = frappe.get_all(
		"PPGPL Exception",
		filters={"posting_date": [">=", week_ago]},
		fields=["exception_type", {"COUNT": "*", "as": "count"}, {"SUM": "amount", "as": "amount"}],
		group_by="exception_type",
	)
	if exc:
		parts.append(f"<h3>{_('Exceptions in the last 7 days')}</h3>")
		parts.append(_table([_("Exception"), _("Count"), _("Amount")], [[e.exception_type, e.count, _m(e.amount)] for e in exc], numeric=(1, 2)))
	_send(("CMD", "L2", "L3"), _("Weekly finance review – {0}").format(formatdate(nowdate())), "".join(parts))


# ---------------------------------------------------------------- 6 pm before each payment day
def payment_run_reminder():
	if not _enabled("send_payment_run_reminder"):
		return
	settings = approval.get_settings()
	days = approval.parse_payment_days(settings.payment_days)
	tomorrow = getdate(add_days(nowdate(), 1))
	if tomorrow.weekday() not in days:
		return
	for state, level in (("Pending L3 Approval", "L3"), ("Pending CMD Approval", "CMD")):
		docs = data.pending_documents(state)
		if not docs:
			continue
		total = sum(flt(d.amount) for d in docs)
		html = f"<p>{_('{0} documents, total {1}, are waiting for your approval before tomorrow’s payment run (by 11 am).').format(len(docs), _m(total))}</p>"
		html += _table(
			[_("Document"), _("Type"), _("Party"), _("Amount")],
			[[_link(d.doctype, d.name), _(d.doctype), d.party or "", _m(d.amount)] for d in docs],
			numeric=(3,),
		)
		_send((level,), _("Payment run {0}: {1} waiting for approval").format(formatdate(tomorrow), len(docs)), html)
