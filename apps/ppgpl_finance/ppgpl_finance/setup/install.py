# Copyright (c) 2026, Power Partner Global Pvt Ltd
"""Install / migrate: roles, custom fields, workflows, permissions, settings defaults, dashboard."""

import json

import frappe
from frappe import _
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields
from frappe.custom.doctype.property_setter.property_setter import make_property_setter

from ppgpl_finance.setup.workflows import EXISTING_RECORD_STATES, PREPARER_ACTIONS, STATE_STYLES, definitions

SETTINGS = "PPGPL Finance Settings"
MODULE = "PPGPL Finance"
ROLES = ("Finance Maker", "Finance Checker", "Finance Approver L3", "CMD Approver")

# ERPNext roles given to each level when PPGPL Finance Settings is saved
LEVEL_ROLES = {
        "l1_user": ["Accounts User", "Finance Maker"],
        "l2_user": ["Accounts User", "Purchase User", "Finance Checker"],
        "l3_user": ["Accounts User", "Purchase User", "Finance Approver L3"],
        "cmd_user": ["Accounts User", "Accounts Manager", "Purchase User", "Purchase Manager", "CMD Approver"],
}


def after_install():
        # Intentionally defer finance setup until an administrator
        # explicitly reviews and enables it.
        pass


def after_migrate():
        # Intentionally defer finance setup during routine migrations.
        # Run reviewed finance setup separately after administrator approval.
        pass


def before_uninstall():
        for name in definitions():
                if frappe.db.exists("Workflow", name):
                        frappe.db.set_value("Workflow", name, "is_active", 0)


def _doctype_exists(dt):
        return bool(frappe.db.exists("DocType", dt))


@frappe.whitelist()
def run_setup(force_workflows=False):
        # Only an administrator or System Manager may run finance setup.
        if frappe.session.user != "Administrator":
                frappe.only_for("System Manager")

        # Never allow this endpoint to overwrite existing workflows.
        if frappe.utils.cint(force_workflows):
                frappe.throw(_("Forced workflow replacement is disabled. Review workflows manually."))

        log = []
        create_roles()
        log.append(_("Roles ready"))
        make_custom_fields()
        log.append(_("Fields ready"))
        make_workflow_masters()
        made = make_workflows(force=frappe.utils.cint(force_workflows))
        log.append(_("Workflows ready: {0}").format(", ".join(made) or _("unchanged")))
        set_existing_record_states()
        make_permissions()
        log.append(_("Permissions ready"))
        settings = ensure_settings()
        apply_erpnext_controls(settings)
        make_number_cards()
        make_workspace()
        log.append(_("Finance Control workspace ready"))
        frappe.clear_cache()
        return log


# ---------------------------------------------------------------- roles
def create_roles():
        for role in ROLES:
                if not frappe.db.exists("Role", role):
                        frappe.get_doc({"doctype": "Role", "role_name": role, "desk_access": 1}).insert(ignore_permissions=True)


def assign_roles(settings):
        for field, roles in LEVEL_ROLES.items():
                user = settings.get(field)
                if not user or user in ("Administrator", "Guest"):
                        continue
                u = frappe.get_doc("User", user)
                have = {r.role for r in u.roles}
                added = [r for r in roles if r not in have and frappe.db.exists("Role", r)]
                if added:
                        u.add_roles(*added)


# ---------------------------------------------------------------- custom fields
def _approval_fields(insert_after, with_cmd_reason=False):
        fields = [
                dict(fieldname="ppgpl_approval_section", fieldtype="Section Break", label="Approval (SOP)", insert_after=insert_after, collapsible=0),
                dict(fieldname="ppgpl_approval_level", fieldtype="Data", label="Approval level", read_only=1, no_copy=1, in_list_view=1, in_standard_filter=1, insert_after="ppgpl_approval_section"),
                dict(fieldname="ppgpl_approver", fieldtype="Data", label="Approves", read_only=1, no_copy=1, insert_after="ppgpl_approval_level"),
        ]
        if with_cmd_reason:
                fields += [
                        dict(fieldname="ppgpl_approval_cb", fieldtype="Column Break", insert_after="ppgpl_approver"),
                        dict(fieldname="ppgpl_requires_cmd", fieldtype="Check", label="Needs CMD approval", read_only=1, no_copy=1, insert_after="ppgpl_approval_cb"),
                        dict(fieldname="ppgpl_cmd_reason", fieldtype="Data", label="Why the CMD", read_only=1, no_copy=1, insert_after="ppgpl_requires_cmd"),
                ]
        return fields


def make_custom_fields():
        fields = {
                "Payment Entry": [
                        dict(fieldname="ppgpl_approval_section", fieldtype="Section Break", label="Approval (SOP)", insert_after="party_bank_account", collapsible=0),
                        dict(fieldname="ppgpl_payment_category", fieldtype="Select", label="Payment category",
                                options="\nAgainst Invoice\nAdvance\nNon-PO\nRecurring Bill\nStatutory\nEmployee\nRefund\nInternal Transfer\nInter-company",
                                in_standard_filter=1, insert_after="ppgpl_approval_section",
                                description="Set automatically from the references. Choose only for payments with no invoice or PO."),
                        dict(fieldname="ppgpl_off_cycle", fieldtype="Check", label="Off-cycle (urgent) payment", insert_after="ppgpl_payment_category",
                                description="Outside the Tuesday/Friday run. Needs CMD approval."),
                        dict(fieldname="ppgpl_off_cycle_reason", fieldtype="Small Text", label="Reason for off-cycle payment", insert_after="ppgpl_off_cycle",
                                depends_on="ppgpl_off_cycle", mandatory_depends_on="ppgpl_off_cycle"),
                        dict(fieldname="ppgpl_approval_cb", fieldtype="Column Break", insert_after="ppgpl_off_cycle_reason"),
                        dict(fieldname="ppgpl_approval_level", fieldtype="Data", label="Approval level", read_only=1, no_copy=1, in_list_view=1, in_standard_filter=1, insert_after="ppgpl_approval_cb"),
                        dict(fieldname="ppgpl_approver", fieldtype="Data", label="Approves", read_only=1, no_copy=1, insert_after="ppgpl_approval_level"),
                        dict(fieldname="ppgpl_approved_by", fieldtype="Link", options="User", label="Approved by", read_only=1, no_copy=1, insert_after="ppgpl_approver"),
                        dict(fieldname="ppgpl_approved_on", fieldtype="Datetime", label="Approved on", read_only=1, no_copy=1, insert_after="ppgpl_approved_by"),
                        dict(fieldname="ppgpl_released_off_cycle", fieldtype="Check", label="Released outside payment days", read_only=1, no_copy=1, insert_after="ppgpl_approved_on"),
                ],
                "Purchase Order": _approval_fields("project", with_cmd_reason=True),
                "Journal Entry": _approval_fields("company"),
                "Supplier": [
                        dict(fieldname="ppgpl_kyc_section", fieldtype="Section Break", label="KYC and MSME (SOP Section 8)", insert_after="supplier_group"),
                        dict(fieldname="ppgpl_kyc_complete", fieldtype="Check", label="KYC complete (GST, PAN, cancelled cheque on file)", insert_after="ppgpl_kyc_section"),
                        dict(fieldname="ppgpl_gstin_verified_on", fieldtype="Date", label="GSTIN verified on portal", insert_after="ppgpl_kyc_complete"),
                        dict(fieldname="ppgpl_kyc_cb", fieldtype="Column Break", insert_after="ppgpl_gstin_verified_on"),
                        dict(fieldname="ppgpl_msme_category", fieldtype="Select", label="MSME category", options="\nNot MSME\nMicro\nSmall\nMedium",
                                in_standard_filter=1, insert_after="ppgpl_kyc_cb"),
                        dict(fieldname="ppgpl_udyam_no", fieldtype="Data", label="Udyam registration no.", insert_after="ppgpl_msme_category",
                                depends_on='eval:["Micro","Small","Medium"].includes(doc.ppgpl_msme_category)'),
                        dict(fieldname="ppgpl_msme_payment_days", fieldtype="Int", label="MSME payment limit (days)", default="45", insert_after="ppgpl_udyam_no",
                                depends_on='eval:["Micro","Small","Medium"].includes(doc.ppgpl_msme_category)',
                                description="45 if agreed in writing, otherwise 15 (MSMED Act)"),
                ],
                "Bank Account": [
                        dict(fieldname="ppgpl_callback_section", fieldtype="Section Break", label="Call-back verification (SOP Section 8)", insert_after="iban"),
                        dict(fieldname="ppgpl_callback_note", fieldtype="Small Text", label="Call-back record",
                                description="Number called (from ERPNext, never from the request), person spoken to, what was confirmed",
                                insert_after="ppgpl_callback_section"),
                        dict(fieldname="ppgpl_callback_by", fieldtype="Link", options="User", label="Call-back by", read_only=1, insert_after="ppgpl_callback_note"),
                        dict(fieldname="ppgpl_callback_on", fieldtype="Datetime", label="Call-back on", read_only=1, insert_after="ppgpl_callback_by"),
                        dict(fieldname="ppgpl_callback_cb", fieldtype="Column Break", insert_after="ppgpl_callback_on"),
                        dict(fieldname="ppgpl_approved_by", fieldtype="Link", options="User", label="Approved by (CMD)", read_only=1, insert_after="ppgpl_callback_cb"),
                        dict(fieldname="ppgpl_approved_on", fieldtype="Datetime", label="Approved on", read_only=1, insert_after="ppgpl_approved_by"),
                ],
        }
        if _doctype_exists("Expense Claim"):
                fields["Expense Claim"] = _approval_fields("approval_status")
        if _doctype_exists("Employee Advance"):
                fields["Employee Advance"] = _approval_fields("advance_amount")
        create_custom_fields(fields, update=True)


# ---------------------------------------------------------------- workflows
def make_workflow_masters():
        for state, style in STATE_STYLES.items():
                if not frappe.db.exists("Workflow State", state):
                        frappe.get_doc({"doctype": "Workflow State", "workflow_state_name": state, "style": style}).insert(ignore_permissions=True)
        actions = set()
        for wf in definitions().values():
                for t in wf["transitions"]:
                        actions.add(t[1])
        for action in sorted(actions):
                if not frappe.db.exists("Workflow Action Master", action):
                        frappe.get_doc({"doctype": "Workflow Action Master", "workflow_action_name": action}).insert(ignore_permissions=True)


def make_workflows(force=False):
        made = []
        for name, wf in definitions().items():
                if not _doctype_exists(wf["document_type"]):
                        continue
                roles_needed = {s[2] for s in wf["states"]} | {t[3] for t in wf["transitions"]}
                if any(not frappe.db.exists("Role", r) for r in roles_needed):
                        continue  # e.g. HRMS roles missing
                exists = frappe.db.exists("Workflow", name)
                if exists and not force:
                        continue
                doc = frappe.get_doc("Workflow", name) if exists else frappe.new_doc("Workflow")
                doc.workflow_name = name
                doc.document_type = wf["document_type"]
                doc.workflow_state_field = "workflow_state"
                doc.is_active = 1
                doc.override_status = 0
                doc.send_email_alert = 1
                doc.set("states", [])
                doc.set("transitions", [])
                for s in wf["states"]:
                        row = {"state": s[0], "doc_status": str(s[1]), "allow_edit": s[2], "send_email": 1}
                        if len(s) > 3:
                                row.update({"update_field": s[3], "update_value": s[4]})
                        doc.append("states", row)
                for t in wf["transitions"]:
                        doc.append(
                                "transitions",
                                {
                                        "state": t[0],
                                        "action": t[1],
                                        "next_state": t[2],
                                        "allowed": t[3],
                                        "allow_self_approval": 1 if t[1] in PREPARER_ACTIONS else 0,
                                        "condition": t[4] or "",
                                },
                        )
                doc.flags.ignore_permissions = True
                doc.save()
                made.append(wf["document_type"])
        return made


def set_existing_record_states():
        for doctype, states in EXISTING_RECORD_STATES.items():
                if not _doctype_exists(doctype) or not frappe.get_meta(doctype).has_field("workflow_state"):
                        continue
                for docstatus, state in states.items():
                        frappe.db.sql(
                                f"""update `tab{doctype}` set workflow_state = %s
                                where docstatus = %s and ifnull(workflow_state, '') = ''""",
                                (state, docstatus),
                        )


# ---------------------------------------------------------------- permissions
PERMS = {
        # doctype: {role: [ptypes]}
        "Payment Entry": {
                "Finance Maker": ["read", "write", "create", "submit", "print", "email", "report"],
                "Finance Checker": ["read", "write", "print", "report"],
                "Finance Approver L3": ["read", "write", "print", "report"],
                "CMD Approver": ["read", "write", "submit", "cancel", "amend", "print", "email", "report", "export"],
        },
        "Purchase Order": {
                "Finance Checker": ["read", "write", "submit", "print", "report"],
                "Finance Approver L3": ["read", "write", "submit", "print", "report"],
                "CMD Approver": ["read", "write", "submit", "cancel", "amend", "print", "email", "report", "export"],
        },
        "Purchase Invoice": {
                "Finance Maker": ["read", "write", "create", "print", "report"],
                "Finance Checker": ["read", "write", "submit", "cancel", "amend", "print", "report"],
                "Finance Approver L3": ["read", "print", "report"],
                "CMD Approver": ["read", "write", "submit", "cancel", "amend", "print", "report", "export"],
        },
        "Journal Entry": {
                "Finance Maker": ["read", "write", "create", "print", "report"],
                "Finance Checker": ["read", "write", "submit", "cancel", "amend", "print", "report"],
                "Finance Approver L3": ["read", "write", "submit", "print", "report"],
                "CMD Approver": ["read", "write", "submit", "cancel", "amend", "print", "report", "export"],
        },
        "Expense Claim": {
                "Finance Checker": ["read", "write", "submit", "print", "report"],
                "Finance Approver L3": ["read", "write", "submit", "print", "report"],
                "CMD Approver": ["read", "write", "submit", "cancel", "print", "report"],
        },
        "Employee Advance": {
                "Finance Checker": ["read", "write", "submit", "print", "report"],
                "Finance Approver L3": ["read", "write", "submit", "print", "report"],
                "CMD Approver": ["read", "write", "submit", "cancel", "print", "report"],
        },
        "Supplier": {
                "Finance Maker": ["read", "write", "create", "report"],
                "Finance Checker": ["read", "write", "report"],
                "Finance Approver L3": ["read", "write", "report"],
                "CMD Approver": ["read", "write", "report", "export"],
        },
        "Bank Account": {
                "Finance Maker": ["read", "write", "create", "report"],
                "Finance Checker": ["read", "write", "report"],
                "Finance Approver L3": ["read", "report"],
                "CMD Approver": ["read", "write", "delete", "report", "export"],
        },
        "Budget": {
                "CMD Approver": ["read", "write", "create", "submit", "cancel", "amend", "report"],
                "Finance Checker": ["read", "report"],
                "Finance Approver L3": ["read", "report"],
        },
}


def make_permissions():
        from frappe.permissions import add_permission, update_permission_property

        for doctype, roles in PERMS.items():
                if not _doctype_exists(doctype):
                        continue
                for role, ptypes in roles.items():
                        if not frappe.db.exists("Role", role):
                                continue
                        if not frappe.db.get_value("Custom DocPerm", {"parent": doctype, "role": role, "permlevel": 0, "if_owner": 0}):
                                add_permission(doctype, role, 0)
                        for ptype in ptypes:
                                update_permission_property(doctype, role, 0, ptype, 1, validate=False)
        frappe.clear_cache()


# ---------------------------------------------------------------- settings
def ensure_settings():
        from ppgpl_finance.controls.approval import DEFAULT_LIMITS

        s = frappe.get_single(SETTINGS)
        first_time = not frappe.db.get_single_value(SETTINGS, "payment_days")
        if first_time:
                # apply field defaults (Single doctypes do not load them by themselves)
                for df in frappe.get_meta(SETTINGS).fields:
                        if df.default and df.fieldtype not in ("Table", "Button", "Section Break", "Column Break"):
                                if s.get(df.fieldname) in (None, "", 0):
                                        s.set(df.fieldname, df.default)
        changed = first_time
        if not s.approval_limits:
                for dt, cat, l2, l3, note in DEFAULT_LIMITS:
                        s.append("approval_limits", {"document_type": dt, "category": cat, "l2_limit": l2, "l3_limit": l3, "note": note})
                changed = True
        if changed:
                s.flags.ignore_permissions = True
                s.flags.ignore_mandatory = True
                s.save()
        return frappe.get_single(SETTINGS)


def apply_erpnext_controls(settings):
        """Apply opt-in document controls without overriding site-wide accounting policy."""
        # Do not mutate site-wide Buying Settings from this app. The setting is
        # retained as an explicit policy flag for app-level checks; PO/receipt
        # enforcement must be configured and reviewed in ERPNext Buying Settings.
        # Likewise, only add the project mandatory Property Setter when explicitly
        # enabled; never force an existing site's requirement off on settings save.
        if settings.project_mandatory:
                for dt in ("Purchase Order", "Purchase Invoice"):
                        if frappe.get_meta(dt).has_field("project"):
                                _set_property(dt, "project", "reqd", 1, "Check")
        for dt in ("Supplier", "Bank Account", "Purchase Order", "Purchase Invoice", "Payment Entry", "Journal Entry", "Budget"):
                if _doctype_exists(dt):
                        _set_property(dt, None, "track_changes", 1, "Check", for_doctype=True)
        # Frozen-period posting permissions are intentionally not changed here.
        # They are site-wide accounting policy; configure them explicitly with the
        # finance/admin team after reviewing existing Company / Accounts Settings.


def _set_property(doctype, fieldname, prop, value, ptype, for_doctype=False):
        filters = {"doc_type": doctype, "property": prop}
        if fieldname:
                filters["field_name"] = fieldname
        name = frappe.db.get_value("Property Setter", filters)
        if name:
                if str(frappe.db.get_value("Property Setter", name, "value")) != str(value):
                        frappe.db.set_value("Property Setter", name, "value", value)
                        frappe.clear_cache(doctype=doctype)
        else:
                make_property_setter(doctype, fieldname, prop, value, ptype, for_doctype=for_doctype, validate_fields_for_doctype=False)


# ---------------------------------------------------------------- dashboard
CARDS = [
        # name (= label), method, reference doctype, colour, is_amount
        ("Bank balance (books)", "ppgpl_finance.controls.cards.bank_balance", "GL Entry", "#17184E", 1),
        ("Payables due in 7 days", "ppgpl_finance.controls.cards.payables_due_7_days", "Purchase Invoice", "#0E6C38", 1),
        ("MSME dues over 30 days", "ppgpl_finance.controls.cards.msme_overdue", "Purchase Invoice", "#B42318", 1),
        ("Receivables over 90 days", "ppgpl_finance.controls.cards.receivables_over_90", "Sales Invoice", "#B54708", 1),
        ("Waiting for CMD", "ppgpl_finance.controls.cards.pending_with_cmd", "Payment Entry", "#B42318", 0),
        ("Waiting for my action", "ppgpl_finance.controls.cards.pending_with_me", "Payment Entry", "#17184E", 0),
]


def make_number_cards():
        currency = frappe.db.get_default("currency") or "INR"
        for name, method, ref, color, is_amount in CARDS:
                values = {
                        "type": "Custom",
                        "method": method,
                        "document_type": ref,
                        "is_public": 0,
                        "module": MODULE,
                        "color": color,
                        "show_percentage_stats": 0,
                        "currency": currency if is_amount else None,
                }
                if frappe.db.exists("Number Card", name):
                        frappe.db.set_value("Number Card", name, values)
                        continue
                frappe.get_doc({"doctype": "Number Card", "label": name, **values}).insert(ignore_permissions=True)


SHORTCUTS = [
        # label (short: the tile truncates long labels), type, link_to, doc_view, stats_filter, color
        ("Payment Proposal", "Report", "PPGPL Payment Proposal", "", None, "Blue"),
        ("Release Batch", "Report", "PPGPL Release Batch", "", None, "Green"),
        ("Cash Position", "Report", "PPGPL Daily Cash Position", "", None, "Blue"),
        ("CMD approvals", "DocType", "Payment Entry", "List", {"workflow_state": "Pending CMD Approval"}, "Red"),
        ("L3 approvals", "DocType", "Payment Entry", "List", {"workflow_state": "Pending L3 Approval"}, "Orange"),
        ("L2 checks", "DocType", "Payment Entry", "List", {"workflow_state": "Pending Check"}, "Orange"),
        ("PO approvals", "DocType", "Purchase Order", "List", {"workflow_state": ["in", ["Pending Check", "Pending L3 Approval", "Pending CMD Approval"]]}, "Orange"),
        ("Invoice match", "DocType", "Purchase Invoice", "List", {"workflow_state": "Pending Match"}, "Orange"),
        ("Bank a/c checks", "DocType", "Bank Account", "List", {"workflow_state": ["in", ["Pending Call-back", "Pending CMD Approval"]]}, "Red"),
        ("New suppliers", "DocType", "Supplier", "List", {"workflow_state": ["in", ["Pending Check", "Pending Approval"]]}, "Orange"),
        ("Journal approvals", "DocType", "Journal Entry", "List", {"workflow_state": ["in", ["Pending Check", "Pending L3 Approval", "Pending CMD Approval"]]}, "Orange"),
        ("Exceptions", "DocType", "PPGPL Exception", "List", {"reviewed": 0}, "Red"),
        ("Walkthrough (help)", "URL", "/assets/ppgpl_finance/walkthrough/index.html", "", None, "Grey"),
]

LINK_CARDS = [
        ("Payments", [("Payment Entry", "DocType", 0), ("PPGPL Payment Proposal", "Report", 1), ("PPGPL Release Batch", "Report", 1), ("PPGPL Payment Approval Register", "Report", 1)]),
        ("Purchases", [("Purchase Order", "DocType", 0), ("Purchase Receipt", "DocType", 0), ("Purchase Invoice", "DocType", 0), ("Budget", "DocType", 0)]),
        ("Masters", [("Supplier", "DocType", 0), ("Bank Account", "DocType", 0), ("Journal Entry", "DocType", 0)]),
        ("Control", [("PPGPL Exception", "DocType", 0), ("PPGPL Finance Settings", "DocType", 0), ("PPGPL Daily Cash Position", "Report", 1)]),
]


def make_workspace():
        name = "Finance Control"
        ws = frappe.get_doc("Workspace", name) if frappe.db.exists("Workspace", name) else frappe.new_doc("Workspace")
        ws.update(
                {
                        "label": name,
                        "title": name,
                        "module": MODULE,
                        "public": 0,
                        "icon": "money-coins-1",
                        "is_hidden": 0,
                        "for_user": "",
                }
        )
        ws.set("roles", [{"role": role} for role in ROLES])
        ws.set("number_cards", [{"number_card_name": c[0], "label": c[0]} for c in CARDS if frappe.db.exists("Number Card", c[0])])
        ws.set("shortcuts", [])
        for label, typ, link_to, view, stats, color in SHORTCUTS:
                row = {"label": label, "type": typ, "doc_view": view, "stats_filter": json.dumps(stats) if stats else None, "color": color}
                if typ == "URL":
                        row["url"] = link_to
                else:
                        row["link_to"] = link_to
                ws.append("shortcuts", row)
        ws.set("links", [])
        for card, links in LINK_CARDS:
                ws.append("links", {"type": "Card Break", "label": card})
                for link_to, link_type, is_report in links:
                        if link_type == "DocType" and not _doctype_exists(link_to):
                                continue
                        ws.append(
                                "links",
                                {"type": "Link", "label": link_to.replace("PPGPL ", ""), "link_type": link_type, "link_to": link_to, "is_query_report": is_report, "onboard": 0},
                        )
        blocks = [{"id": "hdr1", "type": "header", "data": {"text": '<span class="h4"><b>Today</b></span>', "col": 12}}]
        for i, c in enumerate(CARDS):
                blocks.append({"id": f"nc{i}", "type": "number_card", "data": {"number_card_name": c[0], "col": 4}})
        blocks.append({"id": "hdr2", "type": "header", "data": {"text": '<span class="h4"><b>Payment run and approvals</b></span>', "col": 12}})
        for i, s in enumerate(SHORTCUTS):
                blocks.append({"id": f"sc{i}", "type": "shortcut", "data": {"shortcut_name": s[0], "col": 3}})
        blocks.append({"id": "hdr3", "type": "header", "data": {"text": '<span class="h4"><b>Reports and masters</b></span>', "col": 12}})
        for i, (card, _links) in enumerate(LINK_CARDS):
                blocks.append({"id": f"cd{i}", "type": "card", "data": {"card_name": card, "col": 4}})
        ws.content = json.dumps(blocks)
        ws.flags.ignore_permissions = True
        ws.flags.ignore_links = True
        ws.save()
