"""
Customer sign-off by OTP on the Installation Note.

Flow
  1. The engineer ticks "Customer sign-off done". The signed report cannot be uploaded yet.
  2. send_signoff_otp() emails a 6 digit OTP to the customer's email already on file.
  3. The customer reads the OTP out, the engineer types it in the pop-up.
  4. verify_signoff_otp() marks the sign-off as verified. Only now can the signed report be attached.
  5. An Installation Note with sign-off ticked cannot be submitted without a verified OTP and the signed report.
Works on a draft and on a submitted note (when the sign-off fields allow editing after submit).
"""
import hashlib
import hmac
import secrets
import time

import frappe
from frappe import _
from frappe.utils import now_datetime, nowdate, validate_email_address

DOCTYPE = "Installation Note"
TTL_MIN = 10
MAX_TRIES = 5
RESEND_SECONDS = 45
RESET = {"custom_signoff_verified": 0, "custom_signoff_verified_on": None, "custom_signoff_verified_file": "", "custom_signoff_email": ""}


def _key(name):
    return "ppg_signoff_otp:%s" % name


def _hash(name, otp):
    return hashlib.sha256(("%s|%s|%s" % (frappe.local.site, name, otp)).encode()).hexdigest()


def _mask(email):
    local, _sep, domain = email.partition("@")
    return (local[:2] + "***@" + domain) if domain else email


def _get_doc(name):
    doc = frappe.get_doc(DOCTYPE, name)
    doc.check_permission("write")
    return doc


def _customer_email(doc):
    """The customer's email already on file: contact on the note, then the Customer, then the address."""
    candidates = [doc.get("contact_email")]
    if doc.get("contact_person"):
        candidates.append(frappe.db.get_value("Contact", doc.contact_person, "email_id"))
    if doc.get("customer"):
        candidates.append(frappe.db.get_value("Customer", doc.customer, "email_id"))
    if doc.get("customer_address"):
        candidates.append(frappe.db.get_value("Address", doc.customer_address, "email_id"))
    for c in candidates:
        if c and validate_email_address(c):
            return c.strip()
    frappe.throw(_("No email is set for this customer. Add an email on the Customer, its Contact or Address first."))


def _check_outgoing_email():
    account = None
    try:
        from frappe.email.doctype.email_account.email_account import EmailAccount
        account = EmailAccount.find_outgoing(_raise_error=False)
    except Exception:
        account = frappe.db.exists("Email Account", {"default_outgoing": 1, "enable_outgoing": 1})
    if not account and not frappe.conf.get("mail_server"):
        frappe.throw(_("Outgoing email is not set up. Create a default outgoing Email Account first."))


@frappe.whitelist()
def send_signoff_otp(name):
    doc = _get_doc(name)
    if doc.docstatus == 2:
        frappe.throw(_("A cancelled Installation Note cannot be signed off."))
    if doc.get("custom_signoff_verified"):
        frappe.throw(_("The customer sign-off is already verified."))

    email = _customer_email(doc)
    _check_outgoing_email()

    cache = frappe.cache()
    state = cache.get_value(_key(name))
    if state and time.time() - state.get("sent", 0) < RESEND_SECONDS:
        frappe.throw(_("An OTP was just sent. Please wait a few seconds before asking for a new one."))

    otp = "%06d" % secrets.randbelow(10 ** 6)
    cache.set_value(
        _key(name),
        {"hash": _hash(name, otp), "exp": time.time() + TTL_MIN * 60, "tries": 0, "sent": time.time()},
        expires_in_sec=TTL_MIN * 60,
    )
    try:
        frappe.sendmail(
            recipients=[email],
            subject=_("Installation sign-off OTP: {0}").format(doc.company or "Installation"),
            message=_(
                "<p>Dear {0},</p><p>Your OTP to confirm that the installation is complete is "
                "<b style='font-size:18px'>{1}</b>.</p>"
                "<p>Share it with our engineer only if the installation has been completed to your satisfaction. "
                "It is valid for {2} minutes.</p><p>{3}</p>"
            ).format(frappe.utils.escape_html(doc.customer_name or doc.customer or ""), otp, TTL_MIN,
                     frappe.utils.escape_html(doc.company or "")),
            reference_doctype=DOCTYPE,
            reference_name=name,
            now=True,
        )
    except Exception:
        cache.delete_value(_key(name))
        frappe.log_error(title="Installation sign-off OTP email failed")
        frappe.throw(_("The OTP email could not be sent. Check the outgoing Email Account and the Error Log."))
    return {"email": _mask(email), "minutes": TTL_MIN}


@frappe.whitelist()
def verify_signoff_otp(name, otp):
    doc = _get_doc(name)
    cache = frappe.cache()
    state = cache.get_value(_key(name))
    if not state:
        frappe.throw(_("The OTP has expired or was not requested. Ask for a new OTP."))
    if time.time() > state["exp"] or state["tries"] >= MAX_TRIES:
        cache.delete_value(_key(name))
        frappe.throw(_("The OTP has expired or too many wrong attempts were made. Ask for a new OTP."))

    if not hmac.compare_digest(state["hash"], _hash(name, (otp or "").strip())):
        state["tries"] += 1
        cache.set_value(_key(name), state, expires_in_sec=max(int(state["exp"] - time.time()), 1))
        frappe.throw(_("Wrong OTP. {0} attempts left.").format(MAX_TRIES - state["tries"]))

    cache.delete_value(_key(name))
    frappe.db.set_value(DOCTYPE, name, {
        "custom_customer_signoff": 1,
        "custom_signoff_date": nowdate(),
        "custom_signoff_verified": 1,
        "custom_signoff_verified_on": now_datetime(),
        "custom_signoff_email": _mask(_customer_email(doc)),
    })
    return {"ok": True}


# ---------------------------------------------------------------------------
# Document events
# ---------------------------------------------------------------------------
def validate_signoff(doc, method=None):
    """Only verify_signoff_otp may set the verified flag, and the signed report needs that flag."""
    before = doc.get_doc_before_save()
    was_verified = bool(before and before.get("custom_signoff_verified"))
    if doc.get("custom_signoff_verified") and not was_verified:
        doc.update(RESET)  # the flag can not be set from the form
    if not doc.get("custom_customer_signoff"):
        doc.update(RESET)  # sign-off removed, a new OTP is needed next time
    if doc.get("custom_signed_copy") and not doc.get("custom_signoff_verified"):
        frappe.throw(_("Tick Customer sign-off done and verify the customer's OTP before attaching the signed report. Clear the attached file first."))


def before_submit_signoff(doc, method=None):
    if not doc.get("custom_customer_signoff"):
        return
    if not doc.get("custom_signoff_verified"):
        frappe.throw(_("The customer sign-off must be verified with the customer's OTP before this can be submitted."))
    if not doc.get("custom_signed_copy"):
        frappe.throw(_("Attach the signed installation report before submitting."))


def on_update_after_submit_signoff(doc, method=None):
    """After submit the verified flag cannot be edited from the form. If the sign-off tick was removed, clear it."""
    if doc.get("custom_signoff_verified") and not doc.get("custom_customer_signoff"):
        frappe.db.set_value(DOCTYPE, doc.name, RESET)
