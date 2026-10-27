"""
One-time setup for the Installation Assignment flow.

Place this file at:
    apps/ppg_dashboard/ppg_dashboard/api/setup_installation_assignment.py

Run it once:
    bench --site <site> execute ppg_dashboard.api.setup_installation_assignment.run

It is safe to run again: existing items are skipped or updated.

Creates
    DocType  Installation Assignment Employee   (child table: the team)
    DocType  Installation Assignment Item       (child table: items to install)
    DocType  Installation Assignment            (the planning document)
    Custom fields on Installation Note          (assignment link, team table, sign-off)
    Client Scripts                              (Installation Assignment form, button on Delivery Note)
"""

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

MODULE = "PPGPL Dashboard"
MARK = "PPG_INSTALL_ASSIGN"

ASSIGNMENT_SCRIPT = """// PPG_INSTALL_ASSIGN
frappe.ui.form.on("Installation Assignment", {
	setup(frm) {
		frm.set_query("delivery_note", () => ({ filters: { docstatus: 1, is_return: 0 } }));
	},
	refresh(frm) {
		if (frm.is_new() && frm.doc.delivery_note && !(frm.doc.items || []).length) {
			frm.trigger("fetch_items");
		}
		if (!frm.is_new() && ["Scheduled", "Site Not Ready"].includes(frm.doc.status)) {
			frm.add_custom_button(
				__("Installation Note"),
				() =>
					frappe.model.open_mapped_doc({
						method: "ppg_dashboard.api.installation_assignment.make_installation_note",
						frm: frm,
					}),
				__("Create")
			);
			frm.page.set_inner_btn_group_as_primary(__("Create"));
		}
	},
	delivery_note(frm) {
		if (frm.doc.delivery_note) frm.trigger("fetch_items");
	},
	fetch_items(frm) {
		frappe
			.call({
				method: "ppg_dashboard.api.installation_assignment.get_delivery_note_items",
				args: { delivery_note: frm.doc.delivery_note },
			})
			.then((r) => {
				frm.clear_table("items");
				(r.message || []).forEach((row) => frm.add_child("items", row));
				frm.refresh_field("items");
				if (!(r.message || []).length) {
					frappe.msgprint(__("Nothing is left to install on this Delivery Note."));
				}
			});
	},
});
"""

DELIVERY_NOTE_SCRIPT = """// PPG_INSTALL_ASSIGN
frappe.ui.form.on("Delivery Note", {
	refresh(frm) {
		if (frm.doc.docstatus === 1 && !frm.doc.is_return) {
			frm.add_custom_button(
				__("Installation Assignment"),
				() => frappe.new_doc("Installation Assignment", { delivery_note: frm.doc.name }),
				__("Create")
			);
		}
	},
});
"""


def _doctype(spec):
    name = spec["name"]
    if frappe.db.exists("DocType", name):
        print("exists, skipped:", name)
        return
    doc = frappe.get_doc({"doctype": "DocType", "module": MODULE, "custom": 1, **spec})
    doc.insert(ignore_permissions=True)
    print("created:", name)


def _roles():
    wanted = ["System Manager", "Stock Manager", "Stock User", "Sales Manager", "Sales User", "Manufacturing Manager"]
    return [r for r in wanted if frappe.db.exists("Role", r)]


def _client_script(dt, script):
    meta = frappe.get_meta("Client Script")
    existing = [
        s.name
        for s in frappe.get_all("Client Script", filters={"dt": dt}, fields=["name", "script"])
        if MARK in (s.script or "")
    ]
    if existing:
        frappe.db.set_value("Client Script", existing[0], {"script": script, "enabled": 1})
        print("client script updated:", dt)
        return
    values = {"doctype": "Client Script", "dt": dt, "enabled": 1, "script": script}
    if meta.has_field("view"):
        values["view"] = "Form"
    doc = frappe.get_doc(values)
    doc.__newname = "PPG %s Installation" % dt
    doc.insert(ignore_permissions=True)
    print("client script created:", dt)


def run():
    # ---- child tables -------------------------------------------------
    _doctype(
        {
            "name": "Installation Assignment Employee",
            "istable": 1,
            "editable_grid": 1,
            "fields": [
                {"fieldname": "employee", "label": "Employee", "fieldtype": "Link", "options": "Employee", "reqd": 1, "in_list_view": 1},
                {"fieldname": "employee_name", "label": "Employee Name", "fieldtype": "Data", "fetch_from": "employee.employee_name", "read_only": 1, "in_list_view": 1},
                {"fieldname": "user_id", "label": "User", "fieldtype": "Data", "fetch_from": "employee.user_id", "read_only": 1},
                {"fieldname": "is_lead", "label": "Team Lead", "fieldtype": "Check", "in_list_view": 1},
            ],
            "permissions": [],
        }
    )
    _doctype(
        {
            "name": "Installation Assignment Item",
            "istable": 1,
            "editable_grid": 1,
            "fields": [
                {"fieldname": "delivery_note_item", "label": "Delivery Note Item", "fieldtype": "Data", "read_only": 1, "hidden": 1},
                {"fieldname": "item_code", "label": "Item Code", "fieldtype": "Link", "options": "Item", "read_only": 1, "in_list_view": 1},
                {"fieldname": "item_name", "label": "Item Name", "fieldtype": "Data", "read_only": 1, "in_list_view": 1},
                {"fieldname": "qty", "label": "Qty to Install", "fieldtype": "Float", "reqd": 1, "in_list_view": 1},
            ],
            "permissions": [],
        }
    )

    # ---- planning document --------------------------------------------
    perms = [
        {"role": r, "read": 1, "write": 1, "create": 1, "delete": 1, "report": 1, "export": 1, "share": 1, "email": 1, "print": 1}
        for r in _roles()
    ]
    _doctype(
        {
            "name": "Installation Assignment",
            "autoname": "naming_series:",
            "title_field": "customer_name",
            "track_changes": 1,
            "sort_field": "modified",
            "sort_order": "DESC",
            "fields": [
                {"fieldname": "naming_series", "label": "Series", "fieldtype": "Select", "options": "INST-ASN-.YYYY.-", "default": "INST-ASN-.YYYY.-", "reqd": 1, "set_only_once": 1},
                {"fieldname": "delivery_note", "label": "Delivery Note", "fieldtype": "Link", "options": "Delivery Note", "reqd": 1, "in_standard_filter": 1, "set_only_once": 1},
                {"fieldname": "customer", "label": "Customer", "fieldtype": "Link", "options": "Customer", "fetch_from": "delivery_note.customer", "read_only": 1},
                {"fieldname": "customer_name", "label": "Customer Name", "fieldtype": "Data", "fetch_from": "delivery_note.customer_name", "read_only": 1, "in_list_view": 1},
                {"fieldname": "territory", "label": "Territory", "fieldtype": "Link", "options": "Territory", "fetch_from": "delivery_note.territory", "read_only": 1},
                {"fieldname": "column_break_1", "fieldtype": "Column Break"},
                {"fieldname": "planned_date", "label": "Planned Installation Date", "fieldtype": "Date", "reqd": 1, "in_list_view": 1, "in_standard_filter": 1},
                {"fieldname": "planned_time", "label": "Planned Time", "fieldtype": "Time"},
                {"fieldname": "status", "label": "Status", "fieldtype": "Select", "options": "Scheduled\nSite Not Ready\nCompleted\nCancelled", "default": "Scheduled", "in_list_view": 1, "in_standard_filter": 1},
                {"fieldname": "site_not_ready", "label": "Site Not Ready", "fieldtype": "Check"},
                {"fieldname": "installation_note", "label": "Installation Note", "fieldtype": "Link", "options": "Installation Note", "read_only": 1, "no_copy": 1},
                {"fieldname": "section_team", "label": "Installation Team", "fieldtype": "Section Break"},
                {"fieldname": "team", "label": "Team", "fieldtype": "Table", "options": "Installation Assignment Employee"},
                {"fieldname": "section_items", "label": "Items to Install", "fieldtype": "Section Break"},
                {"fieldname": "items", "label": "Items", "fieldtype": "Table", "options": "Installation Assignment Item"},
                {"fieldname": "section_remarks", "label": "Remarks", "fieldtype": "Section Break"},
                {"fieldname": "remarks", "label": "Remarks", "fieldtype": "Small Text"},
            ],
            "permissions": perms,
        }
    )

    # ---- Installation Note: link, team, sign-off ------------------------
    create_custom_fields(
        {
            "Installation Note": [
                {"fieldname": "custom_installation_assignment", "label": "Installation Assignment", "fieldtype": "Link", "options": "Installation Assignment", "insert_after": "customer", "no_copy": 1},
                {"fieldname": "custom_install_team", "label": "Installation Team", "fieldtype": "Table", "options": "Installation Assignment Employee", "insert_after": "custom_installation_assignment"},
                {"fieldname": "custom_customer_signoff", "label": "Customer sign-off done", "fieldtype": "Check", "insert_after": "inst_time", "allow_on_submit": 1},
                {"fieldname": "custom_signoff_date", "label": "Sign-off date", "fieldtype": "Date", "insert_after": "custom_customer_signoff", "depends_on": "custom_customer_signoff", "allow_on_submit": 1},
                {"fieldname": "custom_signed_copy", "label": "Signed installation report", "fieldtype": "Attach", "insert_after": "custom_signoff_date", "allow_on_submit": 1},
            ]
        }
    )
    print("custom fields on Installation Note done")

    # ---- client scripts -----------------------------------------------
    _client_script("Installation Assignment", ASSIGNMENT_SCRIPT)
    _client_script("Delivery Note", DELIVERY_NOTE_SCRIPT)

    frappe.db.commit()
    frappe.clear_cache()
    print("Done. Now add doc_events to hooks.py and restart the bench.")
