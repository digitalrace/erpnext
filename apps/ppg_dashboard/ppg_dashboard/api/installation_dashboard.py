"""
Installation dashboard API for ppg_dashboard.

Place this file at:
    apps/ppg_dashboard/ppg_dashboard/api/installation_dashboard.py

Method path used by the frontend:
    ppg_dashboard.api.installation_dashboard.get_installation_dashboard

It reuses resolve_period() from production_dashboard.py (same folder).

Definitions
    Pending         Delivery Note item quantity not yet covered by a submitted
                    Installation Note item (linked through prevdoc_detail_docname)
    Waiting days    as-of date minus Delivery Note posting date
    Over target     waiting days greater than TARGET_DAYS
    Installed       submitted Installation Note with inst_date inside the period
    Days to install Installation date minus the posting date of its Delivery Note

Workflow this dashboard expects
    1. Delivery Note is submitted.
    2. The office creates an Installation Assignment from the Delivery Note
       (Create > Installation Assignment): team of one or more employees,
       planned date, items. The team is notified.
    3. The team creates the Installation Note from the assignment, fills in the
       post-installation details and submits it. That completes the assignment.

    Delivery Note with no open Installation Assignment        -> "To schedule"
    Open Installation Assignment, status "Site Not Ready"     -> "Site not ready"
    Open Installation Assignment, status "Scheduled"          -> "Scheduled"

Created by setup_installation_assignment.py:
    DocType Installation Assignment (+ child tables for team and items)
    Installation Note custom fields: custom_installation_assignment,
        custom_install_team, custom_customer_signoff, custom_signoff_date,
        custom_signed_copy
Optional:
    Item.custom_requires_installation (Check). If this field exists, only items
    ticked here are counted as needing installation; without it every
    delivered item counts.
"""

from collections import defaultdict

import frappe
from frappe.utils import add_days, date_diff, flt, getdate, today

from ppg_dashboard.api.production_dashboard import resolve_period

TARGET_DAYS = 7  # installation should happen within this many days of delivery
LOOKBACK_DAYS = 365  # how far back delivery notes are checked for pending work
RECENT_NOTES = 10
MAX_ROWS = 200


def _d(value):
    return str(getdate(value)) if value else None


def _has(doctype, fieldname):
    return frappe.get_meta(doctype).has_field(fieldname)


@frappe.whitelist()
def get_installation_dashboard(
    as_of_date=None, period="MTD", custom_from_date=None, custom_to_date=None, company=None
):
    frappe.has_permission("Delivery Note", "read", throw=True)
    frappe.has_permission("Installation Note", "read", throw=True)

    as_of = getdate(as_of_date or today())
    period_code, p_start, p_end = resolve_period(period, as_of, custom_from_date, custom_to_date)
    week_end = add_days(as_of, 7)
    lookback = add_days(as_of, -LOOKBACK_DAYS)

    in_has = {
        f: _has("Installation Note", f) for f in ("custom_customer_signoff", "custom_signoff_date", "custom_install_team")
    }
    assignment_enabled = bool(frappe.db.exists("DocType", "Installation Assignment"))
    item_flag = _has("Item", "custom_requires_installation")
    signoff_enabled = in_has["custom_customer_signoff"]

    # ------------------------------------------------------------------
    # Delivered items and how much of them is already installed
    # ------------------------------------------------------------------
    item_join = "JOIN `tabItem` it ON it.name = dni.item_code" if item_flag else ""
    item_filter = "AND IFNULL(it.custom_requires_installation, 0) = 1" if item_flag else ""
    company_filter = "AND dn.company = %(company)s" if company else ""

    delivered = frappe.db.sql(
        """
        SELECT dni.name AS row_name, dni.parent AS dn, dni.item_code, dni.item_name, dni.qty
        FROM `tabDelivery Note Item` dni
        JOIN `tabDelivery Note` dn ON dn.name = dni.parent
        {item_join}
        WHERE dn.docstatus = 1 AND dn.is_return = 0
          AND dn.posting_date BETWEEN %(start)s AND %(end)s
          {company_filter} {item_filter}
        """.format(item_join=item_join, company_filter=company_filter, item_filter=item_filter),
        {"start": lookback, "end": as_of, "company": company},
        as_dict=True,
    )

    dn_names = sorted({r.dn for r in delivered})
    installed_qty = defaultdict(float)
    if dn_names:
        for r in frappe.db.sql(
            """
            SELECT ini.prevdoc_detail_docname AS row_name, SUM(ini.qty) AS qty
            FROM `tabInstallation Note Item` ini
            JOIN `tabInstallation Note` inn ON inn.name = ini.parent
            WHERE inn.docstatus = 1 AND ini.prevdoc_docname IN %(dns)s
            GROUP BY ini.prevdoc_detail_docname
            """,
            {"dns": tuple(dn_names)},
            as_dict=True,
        ):
            installed_qty[r.row_name] = flt(r.qty)

    pending_by_dn = defaultdict(lambda: {"units": 0.0, "items": []})
    for r in delivered:
        left = flt(r.qty) - installed_qty.get(r.row_name, 0.0)
        if left > 0:
            p = pending_by_dn[r.dn]
            p["units"] += left
            p["items"].append(r.item_name or r.item_code)

    # Open Installation Assignments = installations that have been planned
    assignments_by_dn = {}
    if assignment_enabled and pending_by_dn:
        rows = frappe.get_all(
            "Installation Assignment",
            filters={
                "delivery_note": ["in", list(pending_by_dn.keys())],
                "status": ["in", ["Scheduled", "Site Not Ready"]],
            },
            fields=["name", "delivery_note", "planned_date", "status"],
            order_by="planned_date asc, creation asc",
            limit_page_length=0,
        )
        teams = defaultdict(list)
        if rows:
            for t in frappe.get_all(
                "Installation Assignment Employee",
                filters={"parent": ["in", [r.name for r in rows]], "parenttype": "Installation Assignment"},
                fields=["parent", "employee", "employee_name", "is_lead", "idx"],
                parent_doctype="Installation Assignment",
                limit_page_length=0,
            ):
                teams[t.parent].append(t)
        for r in rows:
            if r.delivery_note not in assignments_by_dn:  # earliest planned date wins
                members = sorted(teams[r.name], key=lambda t: (not t.is_lead, t.idx or 0))
                assignments_by_dn[r.delivery_note] = {
                    "row": r,
                    "team": [t.employee_name or t.employee for t in members],
                }

    dn_fields = ["name", "customer_name", "posting_date", "territory"]
    dn_docs = {}
    if pending_by_dn:
        for n in frappe.get_all(
            "Delivery Note",
            filters={"name": ["in", list(pending_by_dn.keys())]},
            fields=dn_fields,
            limit_page_length=0,
        ):
            dn_docs[n.name] = n

    pending = []
    for name, p in pending_by_dn.items():
        n = dn_docs.get(name)
        if not n:
            continue
        waiting = date_diff(as_of, getdate(n.posting_date))
        plan = assignments_by_dn.get(name)
        planned = getdate(plan["row"].planned_date) if plan and plan["row"].planned_date else None
        if plan and plan["row"].status == "Site Not Ready":
            status = "site_not_ready"
        elif plan:
            status = "scheduled"
        else:
            status = "to_schedule"
        team = plan["team"] if plan else []

        label = p["items"][0] if p["items"] else "-"
        if len(p["items"]) > 1:
            label += " +%d more" % (len(p["items"]) - 1)

        pending.append(
            {
                "dn": name,
                "customer": n.customer_name,
                "territory": n.territory,
                "items": label,
                "units": p["units"],
                "delivered": _d(n.posting_date),
                "waiting_days": waiting,
                "over_days": max(0, waiting - TARGET_DAYS),
                "engineer": ", ".join(team) or "Unassigned",
                "engineers": team,
                "plan_note": plan["row"].name if plan else None,
                "status": status,
                "planned": _d(planned),
                "planned_missed": bool(planned and planned < as_of),
            }
        )
    pending.sort(key=lambda r: r["waiting_days"], reverse=True)

    week = sorted(
        (r for r in pending if r["status"] == "scheduled" and r["planned"] and as_of <= getdate(r["planned"]) <= week_end),
        key=lambda r: r["planned"],
    )

    # ------------------------------------------------------------------
    # Installation Notes (installed in period, recent, awaiting sign-off)
    # ------------------------------------------------------------------
    note_fields = ["name", "customer_name", "inst_date", "territory"]
    note_fields += [f for f in ("custom_customer_signoff", "custom_signoff_date") if in_has[f]]

    def load_notes(filters, limit=0, order_by=None):
        notes = frappe.get_all(
            "Installation Note",
            filters=filters,
            fields=note_fields,
            order_by=order_by,
            limit_page_length=limit,
        )
        if not notes:
            return []
        items = frappe.get_all(
            "Installation Note Item",
            filters={"parent": ["in", [n.name for n in notes]]},
            fields=["parent", "qty", "prevdoc_docname"],
            parent_doctype="Installation Note",
            limit_page_length=0,
        )
        dns = {i.prevdoc_docname for i in items if i.prevdoc_docname}
        dn_date = {}
        if dns:
            dn_date = {
                d.name: getdate(d.posting_date)
                for d in frappe.get_all(
                    "Delivery Note",
                    filters={"name": ["in", list(dns)]},
                    fields=["name", "posting_date"],
                    limit_page_length=0,
                )
            }
        qty = defaultdict(float)
        first_delivery = {}
        for i in items:
            qty[i.parent] += flt(i.qty)
            if i.prevdoc_docname in dn_date:
                cur = first_delivery.get(i.parent)
                first_delivery[i.parent] = min(cur, dn_date[i.prevdoc_docname]) if cur else dn_date[i.prevdoc_docname]

        note_team = defaultdict(list)
        if in_has["custom_install_team"]:
            for t in frappe.get_all(
                "Installation Assignment Employee",
                filters={"parent": ["in", [n.name for n in notes]], "parenttype": "Installation Note"},
                fields=["parent", "employee", "employee_name", "is_lead", "idx"],
                parent_doctype="Installation Note",
                limit_page_length=0,
            ):
                note_team[t.parent].append(t)

        out = []
        for n in notes:
            inst = getdate(n.inst_date)
            members = sorted(note_team.get(n.name, []), key=lambda t: (not t.is_lead, t.idx or 0))
            names = [t.employee_name or t.employee for t in members]
            delivered_on = first_delivery.get(n.name)
            out.append(
                {
                    "name": n.name,
                    "customer": n.customer_name,
                    "date": _d(inst),
                    "units": qty[n.name],
                    "engineer": ", ".join(names) or "Unassigned",
                    "engineers": names,
                    "territory": n.territory,
                    "days_to_install": date_diff(inst, delivered_on) if delivered_on else None,
                    "signed": bool(n.get("custom_customer_signoff")) if signoff_enabled else None,
                    "signed_on": _d(n.get("custom_signoff_date")),
                    "waiting_days": date_diff(as_of, inst),
                }
            )
        return out

    base = {"docstatus": 1}
    if company:
        base["company"] = company

    installed = load_notes({**base, "inst_date": ["between", [p_start, p_end]]})
    recent = load_notes(
        {**base, "inst_date": ["<=", as_of]}, limit=RECENT_NOTES, order_by="inst_date desc, creation desc"
    )
    awaiting = []
    if signoff_enabled:
        awaiting = sorted(
            load_notes({**base, "inst_date": ["<=", as_of], "custom_customer_signoff": 0}, limit=MAX_ROWS),
            key=lambda r: r["waiting_days"],
            reverse=True,
        )

    # ------------------------------------------------------------------
    # Engineers
    # ------------------------------------------------------------------
    eng = defaultdict(lambda: {"territory": None, "pending": 0, "week": 0, "installed": 0, "days": [], "unscheduled": 0})
    for r in pending:
        for person in r["engineers"] or ["Unassigned"]:
            e = eng[person]
            e["pending"] += 1
            e["territory"] = e["territory"] or r["territory"]
            if r["status"] != "scheduled":
                e["unscheduled"] += 1
    for r in week:
        for person in r["engineers"] or ["Unassigned"]:
            eng[person]["week"] += 1
    for r in installed:
        for person in r["engineers"] or ["Unassigned"]:
            e = eng[person]
            e["installed"] += 1
            e["territory"] = e["territory"] or r["territory"]
            if r["days_to_install"] is not None:
                e["days"].append(r["days_to_install"])

    engineers = []
    for name, e in eng.items():
        avg = round(sum(e["days"]) / len(e["days"]), 1) if e["days"] else None
        if e["unscheduled"] and not e["week"]:
            status = "not_scheduled"
        elif avg is not None and avg > TARGET_DAYS:
            status = "stretched"
        else:
            status = "on_track"
        engineers.append(
            {
                "engineer": name,
                "territory": e["territory"],
                "pending": e["pending"],
                "week": e["week"],
                "installed": e["installed"],
                "avg_days": avg,
                "status": status,
            }
        )
    engineers.sort(key=lambda r: (-r["pending"], r["engineer"]))

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    over = [r for r in pending if r["waiting_days"] > TARGET_DAYS]
    site = [r for r in pending if r["status"] == "site_not_ready"]
    to_sched = [r for r in pending if r["status"] == "to_schedule"]
    sched = [r for r in pending if r["status"] == "scheduled"]
    days_all = [r["days_to_install"] for r in installed if r["days_to_install"] is not None]

    summary = {
        "pending": len(pending),
        "pending_units": sum(r["units"] for r in pending),
        "over_target": len(over),
        "avg_wait": round(sum(r["waiting_days"] for r in pending) / len(pending), 1) if pending else 0,
        "scheduled_week": len(week),
        "scheduled_week_units": sum(r["units"] for r in week),
        "not_scheduled": len(site) + len(to_sched),
        "site_not_ready": len(site),
        "to_schedule": len(to_sched),
        "scheduled": len(sched),
        "installed": len(installed),
        "installed_units": sum(r["units"] for r in installed),
        "avg_days_to_install": round(sum(days_all) / len(days_all), 1) if days_all else None,
        "signed_off": sum(1 for r in installed if r["signed"]) if signoff_enabled else None,
        "signoff_pending": len(awaiting) if signoff_enabled else None,
        "signoff_oldest": awaiting[0]["waiting_days"] if awaiting else 0,
    }

    return {
        "as_of_date": str(as_of),
        "period": period_code,
        "from_date": str(p_start),
        "to_date": str(p_end),
        "config": {
            "target_days": TARGET_DAYS,
            "signoff_enabled": signoff_enabled,
            "assignment_enabled": assignment_enabled,
            "item_flag": item_flag,
        },
        "summary": summary,
        "pending": pending[:MAX_ROWS],
        "week": week,
        "installed": recent,
        "awaiting_signoff": awaiting,
        "engineers": engineers,
    }
