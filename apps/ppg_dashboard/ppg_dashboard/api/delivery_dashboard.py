"""
Delivery dashboard API for ppg_dashboard.

Place this file at:
    apps/ppg_dashboard/ppg_dashboard/api/delivery_dashboard.py

Method path used by the frontend:
    ppg_dashboard.api.delivery_dashboard.get_delivery_dashboard

It reuses resolve_period() from production_dashboard.py, so that file must
be in the same folder.

Definitions
    Pending order   submitted Sales Order, not closed/completed, per_delivered < 100
    Promised date   earliest delivery_date of the still-undelivered items
                    (falls back to the Sales Order header delivery_date)
    Delayed         promised date is before the as-of date
    Production plan latest planned_end_date of the Work Orders linked to the
                    Sales Order (Work Order.sales_order) that are not completed
    Slip            days the production plan ends after the promised date
    Value           item amount (before tax) of the undelivered quantity
"""

from collections import defaultdict

import frappe
from frappe.utils import add_days, date_diff, flt, getdate, today

from ppg_dashboard.api.production_dashboard import resolve_period

SO_EXCLUDE_STATUS = ["Closed", "Completed", "Cancelled", "On Hold"]
WO_EXCLUDE_STATUS = ["Cancelled", "Closed", "Stopped"]
JC_DONE = {"Completed", "Submitted"}
RECENT_NOTES = 10
MAX_ROWS = 200


def _d(value):
    return str(getdate(value)) if value else None


def _wo_progress(wo, jc_total, jc_done):
    if wo.status == "Completed":
        return 100
    if jc_total:
        return int(round(jc_done * 100.0 / jc_total))
    if flt(wo.qty):
        return int(round(flt(wo.produced_qty) * 100.0 / flt(wo.qty)))
    return 0


@frappe.whitelist()
def get_delivery_dashboard(
    as_of_date=None, period="MTD", custom_from_date=None, custom_to_date=None, company=None
):
    frappe.has_permission("Sales Order", "read", throw=True)
    frappe.has_permission("Delivery Note", "read", throw=True)

    as_of = getdate(as_of_date or today())
    period_code, p_start, p_end = resolve_period(period, as_of, custom_from_date, custom_to_date)
    horizon = add_days(as_of, 7)

    # ------------------------------------------------------------------
    # Open Sales Orders
    # ------------------------------------------------------------------
    so_filters = {
        "docstatus": 1,
        "status": ["not in", SO_EXCLUDE_STATUS],
        "per_delivered": ["<", 100],
    }
    if company:
        so_filters["company"] = company

    sales_orders = frappe.get_all(
        "Sales Order",
        filters=so_filters,
        fields=[
            "name",
            "customer",
            "customer_name",
            "delivery_date",
            "per_delivered",
            "territory",
        ],
        limit_page_length=0,
    )
    so_names = [s.name for s in sales_orders]

    items_by_so = defaultdict(list)
    if so_names:
        for it in frappe.get_all(
            "Sales Order Item",
            filters={"parent": ["in", so_names]},
            fields=["parent", "item_code", "item_name", "qty", "delivered_qty", "amount", "delivery_date"],
            parent_doctype="Sales Order",
            limit_page_length=0,
        ):
            items_by_so[it.parent].append(it)

    # Work Orders and job card progress per Sales Order
    wos_by_so = defaultdict(list)
    wo_progress = {}
    if so_names:
        wos = frappe.get_all(
            "Work Order",
            filters={
                "sales_order": ["in", so_names],
                "docstatus": 1,
                "status": ["not in", WO_EXCLUDE_STATUS],
            },
            fields=["name", "sales_order", "qty", "produced_qty", "status", "planned_end_date"],
            limit_page_length=0,
        )
        jc_counts = defaultdict(lambda: [0, 0])
        if wos:
            for jc in frappe.get_all(
                "Job Card",
                filters={"work_order": ["in", [w.name for w in wos]], "docstatus": ["<", 2]},
                fields=["work_order", "status"],
                limit_page_length=0,
            ):
                jc_counts[jc.work_order][0] += 1
                if jc.status in JC_DONE:
                    jc_counts[jc.work_order][1] += 1
        for w in wos:
            wos_by_so[w.sales_order].append(w)
            total, done = jc_counts[w.name]
            wo_progress[w.name] = _wo_progress(w, total, done)

    orders = []
    stage_count = defaultdict(int)

    for so in sales_orders:
        items = items_by_so.get(so.name, [])
        pending_items = [i for i in items if flt(i.qty) > flt(i.delivered_qty)]

        total_qty = sum(flt(i.qty) for i in items)
        delivered_qty = sum(flt(i.delivered_qty) for i in items)
        pending_value = sum(
            flt(i.amount) * (flt(i.qty) - flt(i.delivered_qty)) / flt(i.qty)
            for i in pending_items
            if flt(i.qty)
        )

        dates = [getdate(i.delivery_date) for i in pending_items if i.delivery_date]
        promised = min(dates) if dates else (getdate(so.delivery_date) if so.delivery_date else None)

        late_days = date_diff(as_of, promised) if promised and promised < as_of else 0
        due_in = date_diff(promised, as_of) if promised and promised >= as_of else None

        so_wos = wos_by_so.get(so.name, [])
        if flt(so.per_delivered) > 0:
            stage = "partly"
        elif so_wos and all(w.status == "Completed" for w in so_wos):
            stage = "ready"
        elif so_wos:
            stage = "production"
        else:
            stage = "not_planned"
        stage_count[stage] += 1

        progress = int(round(sum(wo_progress[w.name] for w in so_wos) / len(so_wos))) if so_wos else None
        open_wos = [w for w in so_wos if w.status != "Completed" and w.planned_end_date]
        plan_end = max(getdate(w.planned_end_date) for w in open_wos) if open_wos else None
        slip = date_diff(plan_end, promised) if plan_end and promised and plan_end > promised else 0

        first = pending_items[0] if pending_items else (items[0] if items else None)
        label = (first.item_name or first.item_code) if first else "-"
        if len(pending_items) > 1:
            label += " +%d more" % (len(pending_items) - 1)

        orders.append(
            {
                "name": so.name,
                "customer": so.customer_name or so.customer,
                "territory": so.territory,
                "items": label,
                "total_qty": total_qty,
                "delivered_qty": delivered_qty,
                "pending_value": round(pending_value, 2),
                "promised": _d(promised),
                "late_days": late_days,
                "due_in": due_in,
                "stage": stage,
                "work_orders": ", ".join(w.name for w in so_wos),
                "progress_pct": progress,
                "plan_end": _d(plan_end),
                "slip_days": slip,
            }
        )

    orders.sort(key=lambda o: (o["promised"] is None, o["promised"] or ""))

    delayed = [o for o in orders if o["late_days"] > 0]
    due_7d = [o for o in orders if o["due_in"] is not None and o["due_in"] <= 7]
    will_miss = [o for o in orders if o["late_days"] > 0 or o["slip_days"] > 0]

    # ------------------------------------------------------------------
    # Delivered in the selected period
    # ------------------------------------------------------------------
    dn_period = frappe.get_all(
        "Delivery Note",
        filters={
            "docstatus": 1,
            "is_return": 0,
            "posting_date": ["between", [p_start, p_end]],
        },
        fields=["name", "total_qty", "grand_total"],
        limit_page_length=0,
    )

    on_time = frappe.db.sql(
        """
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN dn.posting_date <= soi.delivery_date THEN 1 ELSE 0 END) AS on_time
        FROM `tabDelivery Note Item` dni
        JOIN `tabDelivery Note` dn ON dn.name = dni.parent
        JOIN `tabSales Order Item` soi ON soi.name = dni.so_detail
        WHERE dn.docstatus = 1
          AND dn.is_return = 0
          AND dn.posting_date BETWEEN %s AND %s
          AND soi.delivery_date IS NOT NULL
        """,
        (p_start, p_end),
        as_dict=True,
    )[0]
    on_total = int(on_time.total or 0)
    on_ok = int(on_time.on_time or 0)

    # ------------------------------------------------------------------
    # Recent delivery notes and delivered-but-not-invoiced
    # ------------------------------------------------------------------
    dn_meta = frappe.get_meta("Delivery Note")
    dn_fields = ["name", "customer_name", "posting_date", "total_qty", "grand_total", "per_billed", "status"]
    for optional in ("transporter_name", "vehicle_no"):
        if dn_meta.has_field(optional):
            dn_fields.append(optional)

    recent_notes = [
        {
            "name": n.name,
            "customer": n.customer_name,
            "date": _d(n.posting_date),
            "qty": flt(n.total_qty),
            "transporter": n.get("transporter_name"),
            "vehicle": n.get("vehicle_no"),
            "per_billed": flt(n.per_billed),
        }
        for n in frappe.get_all(
            "Delivery Note",
            filters={"docstatus": 1, "is_return": 0, "posting_date": ["<=", as_of]},
            fields=dn_fields,
            order_by="posting_date desc, creation desc",
            limit_page_length=RECENT_NOTES,
        )
    ]

    unbilled_rows = frappe.get_all(
        "Delivery Note",
        filters={
            "docstatus": 1,
            "is_return": 0,
            "per_billed": ["<", 100],
            "status": ["not in", ["Closed", "Cancelled"]],
            "posting_date": ["<=", as_of],
        },
        fields=["name", "customer_name", "posting_date", "grand_total", "per_billed"],
        order_by="posting_date asc",
        limit_page_length=MAX_ROWS,
    )
    unbilled = [
        {
            "name": n.name,
            "customer": n.customer_name,
            "date": _d(n.posting_date),
            "value": round(flt(n.grand_total) * (100 - flt(n.per_billed)) / 100.0, 2),
            "days_waiting": date_diff(as_of, getdate(n.posting_date)),
        }
        for n in unbilled_rows
    ]

    # ------------------------------------------------------------------
    # By customer
    # ------------------------------------------------------------------
    cust = defaultdict(lambda: {"orders": 0, "value": 0.0, "delayed": 0, "delay_days": 0})
    for o in orders:
        c = cust[o["customer"] or "-"]
        c["orders"] += 1
        c["value"] += o["pending_value"]
        if o["late_days"] > 0:
            c["delayed"] += 1
            c["delay_days"] += o["late_days"]
    by_customer = sorted(
        (
            {
                "customer": name,
                "orders": c["orders"],
                "value": round(c["value"], 2),
                "delayed": c["delayed"],
                "avg_delay": int(round(c["delay_days"] / c["delayed"])) if c["delayed"] else 0,
            }
            for name, c in cust.items()
        ),
        key=lambda r: r["value"],
        reverse=True,
    )

    summary = {
        "pending": len(orders),
        "pending_value": round(sum(o["pending_value"] for o in orders), 2),
        "delayed": len(delayed),
        "delayed_value": round(sum(o["pending_value"] for o in delayed), 2),
        "avg_delay": round(sum(o["late_days"] for o in delayed) / len(delayed), 1) if delayed else 0,
        "due_7d": len(due_7d),
        "due_7d_value": round(sum(o["pending_value"] for o in due_7d), 2),
        "will_miss": len(will_miss),
        "ready": stage_count["ready"],
        "delivered_notes": len(dn_period),
        "delivered_qty": sum(flt(n.total_qty) for n in dn_period),
        "on_time_pct": int(round(on_ok * 100.0 / on_total)) if on_total else None,
        "on_time_ok": on_ok,
        "on_time_total": on_total,
        "unbilled_count": len(unbilled),
        "unbilled_value": round(sum(u["value"] for u in unbilled), 2),
    }

    return {
        "as_of_date": str(as_of),
        "period": period_code,
        "from_date": str(p_start),
        "to_date": str(p_end),
        "summary": summary,
        "pipeline": {
            "confirmed": len(orders),
            "not_planned": stage_count["not_planned"],
            "production": stage_count["production"],
            "ready": stage_count["ready"],
            "partly": stage_count["partly"],
            "delivered_notes": len(dn_period),
        },
        "orders": orders[:MAX_ROWS],
        "delivery_notes": recent_notes,
        "by_customer": by_customer,
        "unbilled": unbilled,
    }
