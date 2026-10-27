"""
Installation Assignment: the step between Delivery Note and Installation Note.

Place this file at:
    apps/ppg_dashboard/ppg_dashboard/api/installation_assignment.py

Flow
    Delivery Note (submitted)
      -> Installation Assignment   office picks the team (one or more employees),
                                   the planned date and the items to install.
                                   Every employee with a linked user gets an
                                   assignment notification (ToDo + bell + email).
      -> Installation Note         created by the assigned team from the
                                   assignment; team, date, customer and items are
                                   copied. Submitting it completes the assignment.
"""

import frappe
from frappe import _
from frappe.desk.form import assign_to
from frappe.utils import flt, getdate

ASSIGNMENT = "Installation Assignment"
OPEN_STATUSES = ("Scheduled", "Site Not Ready")


# ---------------------------------------------------------------------------
# Items of a Delivery Note that are still to be installed
# ---------------------------------------------------------------------------
def _pending_rows(delivery_note):
    dn = frappe.get_doc("Delivery Note", delivery_note)
    installed = {
        r.row_name: flt(r.qty)
        for r in frappe.db.sql(
            """
            SELECT ini.prevdoc_detail_docname AS row_name, SUM(ini.qty) AS qty
            FROM `tabInstallation Note Item` ini
            JOIN `tabInstallation Note` inn ON inn.name = ini.parent
            WHERE inn.docstatus = 1 AND ini.prevdoc_docname = %s
            GROUP BY ini.prevdoc_detail_docname
            """,
            delivery_note,
            as_dict=True,
        )
    }
    rows = []
    for it in dn.items:
        left = flt(it.qty) - installed.get(it.name, 0.0)
        if left > 0:
            rows.append(
                {
                    "delivery_note_item": it.name,
                    "item_code": it.item_code,
                    "item_name": it.item_name,
                    "qty": left,
                }
            )
    return rows


@frappe.whitelist()
def get_delivery_note_items(delivery_note):
    frappe.has_permission("Delivery Note", "read", doc=delivery_note, throw=True)
    return _pending_rows(delivery_note)


# ---------------------------------------------------------------------------
# Validation and notifications for Installation Assignment
# ---------------------------------------------------------------------------
def validate_assignment(doc, method=None):
    dn = frappe.db.get_value(
        "Delivery Note", doc.delivery_note, ["docstatus", "is_return", "posting_date"], as_dict=True
    )
    if not dn or dn.docstatus != 1 or dn.is_return:
        frappe.throw(_("The Delivery Note must be submitted and must not be a return."))

    if doc.status in ("Completed", "Cancelled"):
        return

    if not doc.team:
        frappe.throw(_("Add at least one employee to the installation team."))

    seen = set()
    for t in doc.team:
        if t.employee in seen:
            frappe.throw(_("Employee {0} is added more than once.").format(t.employee))
        seen.add(t.employee)
        emp = frappe.db.get_value("Employee", t.employee, ["employee_name", "user_id"], as_dict=True)
        t.employee_name = t.employee_name or emp.employee_name
        t.user_id = t.user_id or emp.user_id

    leads = [t for t in doc.team if t.is_lead]
    if len(leads) > 1:
        frappe.throw(_("Only one team lead can be selected."))
    if not leads:
        doc.team[0].is_lead = 1

    if not doc.items:
        frappe.throw(_("Select the items to install."))

    pending = {r["delivery_note_item"]: r["qty"] for r in _pending_rows(doc.delivery_note)}
    for it in doc.items:
        if flt(it.qty) <= 0:
            frappe.throw(_("Row {0}: quantity must be greater than zero.").format(it.idx))
        if it.delivery_note_item not in pending:
            frappe.throw(_("Row {0}: {1} has nothing left to install.").format(it.idx, it.item_code))
        if flt(it.qty) > pending[it.delivery_note_item] + 1e-9:
            frappe.throw(
                _("Row {0}: only {1} left to install for {2}.").format(
                    it.idx, pending[it.delivery_note_item], it.item_code
                )
            )

    if dn.posting_date and getdate(doc.planned_date) < getdate(dn.posting_date):
        frappe.throw(_("Planned date cannot be before the Delivery Note date ({0}).").format(dn.posting_date))

    doc.status = "Site Not Ready" if doc.site_not_ready else "Scheduled"

    no_user = [t.employee_name or t.employee for t in doc.team if not t.user_id]
    if no_user:
        frappe.msgprint(
            _("No user is linked to: {0}. They will not receive a notification.").format(", ".join(no_user)),
            indicator="orange",
            alert=True,
        )


def _description(doc):
    return _("Installation at {0} on {1} (Delivery Note {2})").format(
        doc.customer_name or doc.customer, doc.planned_date, doc.delivery_note
    )


def on_assignment_update(doc, method=None):
    try:
        if doc.status == "Completed":
            assign_to.close_all_assignments(doc.doctype, doc.name)
            return
        if doc.status == "Cancelled":
            assign_to.clear(doc.doctype, doc.name)
            return

        wanted = {t.user_id for t in doc.team if t.user_id}
        existing = set(
            frappe.get_all(
                "ToDo",
                filters={"reference_type": doc.doctype, "reference_name": doc.name, "status": "Open"},
                pluck="allocated_to",
            )
        )

        for user in existing - wanted:
            assign_to.remove(doc.doctype, doc.name, user)

        new_users = sorted(wanted - existing)
        if new_users:
            assign_to.add(
                {
                    "assign_to": new_users,
                    "doctype": doc.doctype,
                    "name": doc.name,
                    "description": _description(doc),
                    "date": doc.planned_date,
                    "notify": 1,
                }
            )

        # Tell the people who were already on the job if the plan changed
        before = doc.get_doc_before_save()
        stay = sorted(wanted & existing)
        if before and stay and (
            str(before.planned_date) != str(doc.planned_date) or before.status != doc.status
        ):
            from frappe.desk.doctype.notification_log.notification_log import enqueue_create_notification

            enqueue_create_notification(
                stay,
                {
                    "type": "Alert",
                    "subject": _("Installation plan updated: {0} on {1} ({2})").format(
                        doc.customer_name or doc.customer, doc.planned_date, doc.status
                    ),
                    "document_type": doc.doctype,
                    "document_name": doc.name,
                    "from_user": frappe.session.user,
                },
            )
    except Exception:
        # A notification problem must never block saving the assignment
        frappe.log_error(title="Installation Assignment notification failed")


# ---------------------------------------------------------------------------
# Installation Assignment -> Installation Note
# ---------------------------------------------------------------------------
@frappe.whitelist()
def make_installation_note(source_name):
    a = frappe.get_doc(ASSIGNMENT, source_name)
    if a.status not in OPEN_STATUSES:
        frappe.throw(_("Installation Assignment is {0}.").format(a.status))

    existing = frappe.db.get_value(
        "Installation Note", {"custom_installation_assignment": a.name, "docstatus": ["<", 2]}, "name"
    )
    if existing:
        return frappe.get_doc("Installation Note", existing)

    dn = frappe.get_doc("Delivery Note", a.delivery_note)
    note = frappe.new_doc("Installation Note")
    note.update(
        {
            "customer": dn.customer,
            "customer_name": dn.customer_name,
            "territory": dn.territory,
            "company": dn.company,
            "inst_date": a.planned_date,
            "customer_address": dn.get("customer_address"),
            "address_display": dn.get("address_display"),
            "contact_person": dn.get("contact_person"),
            "contact_display": dn.get("contact_display"),
            "contact_mobile": dn.get("contact_mobile"),
            "contact_email": dn.get("contact_email"),
            "custom_installation_assignment": a.name,
        }
    )

    for row in a.items:
        item = frappe.db.get_value("Item", row.item_code, ["item_name", "description"], as_dict=True) or {}
        note.append(
            "items",
            {
                "item_code": row.item_code,
                "item_name": row.item_name or item.get("item_name"),
                "description": item.get("description") or row.item_name or row.item_code,
                "qty": row.qty,
                "prevdoc_doctype": "Delivery Note",
                "prevdoc_docname": dn.name,
                "prevdoc_detail_docname": row.delivery_note_item,
            },
        )

    for t in a.team:
        note.append(
            "custom_install_team",
            {
                "employee": t.employee,
                "employee_name": t.employee_name,
                "user_id": t.user_id,
                "is_lead": t.is_lead,
            },
        )
    return note


# ---------------------------------------------------------------------------
# Installation Note events keep the assignment in step
# ---------------------------------------------------------------------------
def on_installation_note_submit(doc, method=None):
    name = doc.get("custom_installation_assignment")
    if not name or not frappe.db.exists(ASSIGNMENT, name):
        return
    frappe.db.set_value(ASSIGNMENT, name, {"status": "Completed", "installation_note": doc.name})
    try:
        assign_to.close_all_assignments(ASSIGNMENT, name)
    except Exception:
        frappe.log_error(title="Closing installation assignment ToDos failed")


def on_installation_note_cancel(doc, method=None):
    name = doc.get("custom_installation_assignment")
    if not name or not frappe.db.exists(ASSIGNMENT, name):
        return
    if frappe.db.get_value(ASSIGNMENT, name, "status") == "Completed":
        frappe.db.set_value(ASSIGNMENT, name, {"status": "Scheduled", "installation_note": None})
