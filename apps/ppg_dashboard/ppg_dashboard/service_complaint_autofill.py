import frappe
from frappe.utils import now_datetime

DT = "Service Complaint"
CLOSED = "CLOSE"


def _is_staff(user):
    return bool(user) and user != "Guest"


def _user_value(meta, fieldname, user):
    df = meta.get_field(fieldname)
    if df and df.fieldtype == "Link" and df.options == "Employee":
        return frappe.db.get_value("Employee", {"user_id": user}, "name")
    return user


def _set_first_response(doc, user, now):
    meta = doc.meta
    if meta.has_field("first_response_at") and not doc.get("first_response_at"):
        doc.first_response_at = now
        if meta.has_field("first_response_by"):
            doc.first_response_by = _user_value(meta, "first_response_by", user)


def before_insert(doc, method=None):
    if doc.meta.has_field("complaint_created_at") and not doc.get("complaint_created_at"):
        doc.complaint_created_at = now_datetime()


def validate(doc, method=None):
    if doc.is_new():
        return
    before = doc.get_doc_before_save()
    if not before:
        return

    user, meta, now = frappe.session.user, doc.meta, now_datetime()
    status_changed = before.get("status") != doc.get("status")
    assignee_changed = bool(doc.get("assigned_employee")) and before.get("assigned_employee") != doc.get("assigned_employee")

    if assignee_changed and meta.has_field("assigned_at") and not doc.get("assigned_at"):
        doc.assigned_at = now

    if _is_staff(user) and (status_changed or assignee_changed):
        _set_first_response(doc, user, now)

    if status_changed:
        if doc.get("status") == CLOSED:
            _set_first_response(doc, user, now)
            if meta.has_field("resolved_at"):
                doc.resolved_at = now
            if meta.has_field("resolved_by"):
                doc.resolved_by = _user_value(meta, "resolved_by", user)
        elif before.get("status") == CLOSED:
            if meta.has_field("resolved_at"):
                doc.resolved_at = None
            if meta.has_field("resolved_by"):
                doc.resolved_by = None


def todo_after_insert(doc, method=None):
    # sidebar "Assign" creates a ToDo
    if doc.reference_type != DT or not doc.reference_name:
        return
    if not frappe.get_meta(DT).has_field("assigned_at"):
        return
    if not frappe.db.get_value(DT, doc.reference_name, "assigned_at"):
        frappe.db.set_value(DT, doc.reference_name, "assigned_at", now_datetime(), update_modified=False)


def comment_after_insert(doc, method=None):
    if doc.reference_doctype != DT or doc.comment_type != "Comment" or not _is_staff(doc.owner):
        return
    meta = frappe.get_meta(DT)
    if not meta.has_field("first_response_at") or frappe.db.get_value(DT, doc.reference_name, "first_response_at"):
        return
    values = {"first_response_at": now_datetime()}
    if meta.has_field("first_response_by"):
        values["first_response_by"] = _user_value(meta, "first_response_by", doc.owner)
    frappe.db.set_value(DT, doc.reference_name, values, update_modified=False)
