# Copyright (c) 2026, Power Partner Global Pvt Ltd
"""Instant alerts to the CMD and the exception register (SOP Section 9)."""

import frappe
from frappe import _
from frappe.utils import get_url_to_form, nowdate

SETTINGS = "PPGPL Finance Settings"


def _settings():
	return frappe.get_cached_doc(SETTINGS)


def recipients(levels=("CMD",)):
	s = _settings()
	users = {"CMD": s.cmd_user, "L2": s.l2_user, "L3": s.l3_user, "L1": s.l1_user}
	emails = []
	for lvl in levels:
		u = users.get(lvl)
		if u:
			email = frappe.db.get_value("User", u, "email") or u
			emails.append(email)
	for e in (s.extra_alert_emails or "").replace(";", ",").split(","):
		if e.strip():
			emails.append(e.strip())
	return list(dict.fromkeys(emails))


def notify(subject, message, doc=None, levels=("CMD",)):
	"""In-app notification for the users at `levels`, plus an email to them and the extra list."""
	s = _settings()
	users = {"CMD": s.cmd_user, "L2": s.l2_user, "L3": s.l3_user, "L1": s.l1_user}
	for lvl in levels:
		user = users.get(lvl)
		if not user:
			continue
		try:
			frappe.get_doc(
				{
					"doctype": "Notification Log",
					"subject": subject,
					"email_content": message,
					"for_user": user,
					"type": "Alert",
					"document_type": doc.doctype if doc else None,
					"document_name": doc.name if doc else None,
					"from_user": frappe.session.user,
				}
			).insert(ignore_permissions=True)
		except Exception:
			frappe.log_error("PPGPL Finance: notification failed")
	to = recipients(levels)
	if to:
		link = f'<p><a href="{get_url_to_form(doc.doctype, doc.name)}">{_("Open {0}").format(doc.name)}</a></p>' if doc else ""
		safe_sendmail(
			recipients=to,
			subject=subject,
			message=f"<p>{message}</p>{link}",
			reference_doctype=doc.doctype if doc else None,
			reference_name=doc.name if doc else None,
		)


def safe_sendmail(**kwargs):
	"""Queue an email; a missing or broken email account must never stop the transaction."""
	try:
		frappe.sendmail(**kwargs)
	except Exception:
		frappe.clear_last_message()
		frappe.log_error("PPGPL Finance: email not queued (check the outgoing Email Account)")


def log_exception(exception_type, doc=None, amount=None, party=None, details=None, alert=True):
	try:
		frappe.get_doc(
			{
				"doctype": "PPGPL Exception",
				"posting_date": nowdate(),
				"exception_type": exception_type,
				"reference_doctype": doc.doctype if doc else None,
				"reference_name": doc.name if doc else None,
				"party": party,
				"amount": amount,
				"user": frappe.session.user,
				"details": details,
			}
		).insert(ignore_permissions=True)
	except Exception:
		frappe.log_error("PPGPL Finance: could not write exception register")
	if alert:
		notify(_("Finance alert: {0}").format(_(exception_type)), details or exception_type, doc)


def _amount(doc):
	for f in ("base_paid_amount", "base_grand_total", "total_debit", "grand_total"):
		if doc.get(f):
			return doc.get(f)
	return None


def _party(doc):
	return doc.get("party_name") or doc.get("supplier_name") or doc.get("party") or doc.get("supplier") or ""


def on_cancel(doc, method=None):
	if doc.doctype == "Payment Entry" and doc.payment_type == "Receive":
		return
	log_exception(
		"Cancellation",
		doc,
		amount=_amount(doc),
		party=_party(doc),
		details=_("{0} {1} was cancelled by {2}").format(_(doc.doctype), doc.name, frappe.session.user),
	)


def after_insert_amendment(doc, method=None):
	if not doc.get("amended_from"):
		return
	log_exception(
		"Amendment",
		doc,
		amount=_amount(doc),
		party=_party(doc),
		details=_("{0} {1} amends cancelled {2}").format(_(doc.doctype), doc.name, doc.amended_from),
	)
