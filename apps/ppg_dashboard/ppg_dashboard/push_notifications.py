import frappe
from frappe.utils import get_url_to_form


# ------------------------------------------------------------
# Frappe Event -> Push Notification Rule Event
# ------------------------------------------------------------

EVENT_MAP = {
    "after_insert": "After Insert",
    "on_update": "Save",
    "on_submit": "Submit",
    "on_cancel": "Cancel",
}


# ------------------------------------------------------------
# Generic Document Event Handler
# ------------------------------------------------------------

def handle_document_event(doc, method=None):
    """
    Generic Push Notification Rule engine.

    Works for any DocType for the supported events:
        After Insert
        Save
        Submit
        Cancel
    """

    try:

        rule_event = EVENT_MAP.get(method)

        if not rule_event:
            return

        # ----------------------------------------------------
        # Find matching enabled rules
        # ----------------------------------------------------

        rules = frappe.get_all(
            "Push Notification Rule",
            filters={
                "document_type": doc.doctype,
                "event": rule_event,
                "enabled": 1
            },
            pluck="name"
        )

        if not rules:
            return

        # ----------------------------------------------------
        # Process each matching rule
        # ----------------------------------------------------

        for rule_name in rules:

            rule = frappe.get_doc(
                "Push Notification Rule",
                rule_name
            )

            for recipient_row in rule.recipients:

                if not recipient_row.recipient:
                    continue

                # ------------------------------------------------
                # Currently supported recipient type
                # ------------------------------------------------

                if recipient_row.recipient_type != "User":
                    continue

                user = recipient_row.recipient

                # ------------------------------------------------
                # Validate User
                # ------------------------------------------------

                if not frappe.db.exists(
                    "User",
                    user
                ):
                    continue

                if frappe.db.get_value(
                    "User",
                    user,
                    "enabled"
                ) != 1:
                    continue

                # ------------------------------------------------
                # Notification text
                # ------------------------------------------------

                subject = build_subject(
                    doc,
                    rule_event
                )

                body = build_body(
                    doc,
                    rule_event
                )

                # ------------------------------------------------
                # Document link
                # ------------------------------------------------

                link = get_url_to_form(
                    doc.doctype,
                    doc.name
                )

                # ------------------------------------------------
                # Create Notification Log
                #
                # Notification Log's after_insert hook will
                # automatically call the FCM sending function.
                # ------------------------------------------------

                frappe.get_doc({
                    "doctype": "Notification Log",

                    "subject": subject,

                    "for_user": user,

                    "type": "Alert",

                    "email_content": body,

                    "document_type": doc.doctype,

                    "document_name": doc.name,

                    "read": 0,

                    "link": link,

                    "from_user": (
                        frappe.session.user
                        if frappe.session.user != "Guest"
                        else None
                    )

                }).insert(
                    ignore_permissions=True
                )

    except Exception:

        frappe.log_error(
            title="Push Notification Rule Error",

            message=frappe.get_traceback()
        )


# ------------------------------------------------------------
# Subject
# ------------------------------------------------------------

def build_subject(doc, event):

    doctype_label = frappe.get_meta(
        doc.doctype
    ).name

    if event == "After Insert":
        action = "Created"

    elif event == "Save":
        action = "Updated"

    elif event == "Submit":
        action = "Submitted"

    elif event == "Cancel":
        action = "Cancelled"

    else:
        action = event

    return (
        f"{doctype_label} "
        f"{doc.name} "
        f"{action}"
    )


# ------------------------------------------------------------
# Body
# ------------------------------------------------------------

def build_body(doc, event):

    doctype_label = frappe.get_meta(
        doc.doctype
    ).name

    if event == "After Insert":
        action = "created"

    elif event == "Save":
        action = "updated"

    elif event == "Submit":
        action = "submitted"

    elif event == "Cancel":
        action = "cancelled"

    else:
        action = event.lower()

    return (
        f"{doctype_label} "
        f"{doc.name} "
        f"has been {action}."
    )
