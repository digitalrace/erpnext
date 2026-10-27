"""
Production dashboard API for ppg_dashboard.

Place this file at:
    apps/ppg_dashboard/ppg_dashboard/api/production_dashboard.py

Method path used by the frontend:
    ppg_dashboard.api.production_dashboard.get_production_dashboard

Optional (recommended): add a custom field on the Workstation doctype so the
dashboard can show who owns each workstation.
    Customize Form -> Workstation -> add field
        Fieldname: custom_incharge   Type: Link   Options: Employee
If the field does not exist, owners show as "Unassigned".
"""

from collections import defaultdict
from datetime import date

import frappe
from frappe.utils import cint, date_diff, getdate, today

# Job Card status groups (ERPNext v14/v15)
JC_COMPLETED = {"Completed", "Submitted"}
JC_WIP = {"Work In Progress", "Material Transferred"}
JC_HOLD = {"On Hold"}

# Work Orders that should never appear on the dashboard
WO_EXCLUDE_STATUS = ["Cancelled", "Closed", "Stopped"]

MAX_DELAYED_ROWS = 200
OWNER_FIELDS = ("custom_incharge", "custom_workstation_incharge", "custom_owner")


# ---------------------------------------------------------------------------
# Period helper (also fixes the "Custom period requires From Date and To Date"
# error seen for YTD: reuse this in get_sales_dashboard too)
# ---------------------------------------------------------------------------
def _fiscal_year_start(d):
    try:
        from erpnext.accounts.utils import get_fiscal_year

        fy = get_fiscal_year(d, as_dict=True)
        if isinstance(fy, (list, tuple)):
            return getdate(fy[1])
        return getdate(fy.get("year_start_date"))
    except Exception:
        # Indian financial year fallback: 1 April
        return date(d.year if d.month >= 4 else d.year - 1, 4, 1)


def resolve_period(period=None, as_of_date=None, from_date=None, to_date=None):
    """Return (period_code, start_date, end_date) for MTD / QTD / YTD / Custom."""
    as_of = getdate(as_of_date or today())
    code = (period or "MTD").strip().upper()

    if code in ("CUSTOM", "CUSTOM PERIOD", "CUSTOM RANGE"):
        if not (from_date and to_date):
            frappe.throw("Custom period requires From Date and To Date")
        return "CUSTOM", getdate(from_date), getdate(to_date)

    if code == "QTD":
        start = date(as_of.year, ((as_of.month - 1) // 3) * 3 + 1, 1)
    elif code == "YTD":
        start = _fiscal_year_start(as_of)
    else:  # MTD and anything unknown
        code = "MTD"
        start = as_of.replace(day=1)

    return code, start, as_of


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------
def _pct(part, whole):
    return int(round(part * 100.0 / whole)) if whole else 0


def _in_range(d, start, end):
    if not d:
        return True
    return start <= getdate(d) <= end


def _blank():
    return {
        "total": 0,
        "completed": 0,
        "wip": 0,
        "hold": 0,
        "not_started": 0,
        "overdue": 0,
        "max_delay": 0,
        "seq": 999,
    }


def _owner_field():
    meta = frappe.get_meta("Workstation")
    return next((f for f in OWNER_FIELDS if meta.has_field(f)), None)


def _workstation_owners():
    field = _owner_field()
    if not field:
        return {}

    owners = {}
    for row in frappe.get_all("Workstation", fields=["name", field], limit_page_length=0):
        value = row.get(field)
        if not value:
            continue
        owners[row.name] = frappe.db.get_value("Employee", value, "employee_name") or value
    return owners


def _wo_label(wo, stats, as_of):
    if wo.status == "Completed":
        return "Completed"
    if wo.planned_end_date and getdate(wo.planned_end_date) < as_of:
        return "Delayed"
    if stats["done"] or wo.status == "In Process":
        return "In process"
    return "Not started"


# ---------------------------------------------------------------------------
# Main API
# ---------------------------------------------------------------------------
@frappe.whitelist()
def get_production_dashboard(
    as_of_date=None, period="MTD", custom_from_date=None, custom_to_date=None, company=None
):
    # Same argument names as get_sales_dashboard so the page can pass one args object.
    frappe.has_permission("Work Order", "read", throw=True)
    frappe.has_permission("Job Card", "read", throw=True)

    as_of = getdate(as_of_date or today())
    period_code, p_start, p_end = resolve_period(period, as_of, custom_from_date, custom_to_date)

    # ---- Work Orders: all open ones + completed ones inside the period
    wo_filters = {"docstatus": 1, "status": ["not in", WO_EXCLUDE_STATUS]}
    if company:
        wo_filters["company"] = company

    work_orders = frappe.get_all(
        "Work Order",
        filters=wo_filters,
        fields=[
            "name",
            "production_item",
            "item_name",
            "qty",
            "produced_qty",
            "status",
            "planned_end_date",
            "actual_end_date",
        ],
        order_by="planned_end_date asc, name asc",
        limit_page_length=0,
    )
    work_orders = [
        w for w in work_orders if w.status != "Completed" or _in_range(w.actual_end_date, p_start, p_end)
    ]
    wo_names = [w.name for w in work_orders]

    # ---- Job Cards of those Work Orders
    jc_meta = frappe.get_meta("Job Card")
    jc_fields = [
        "name",
        "work_order",
        "operation",
        "workstation",
        "status",
        "expected_end_date",
        "modified",
    ]
    for optional in ("actual_end_date", "sequence_id"):
        if jc_meta.has_field(optional):
            jc_fields.append(optional)

    job_cards = []
    if wo_names:
        job_cards = frappe.get_all(
            "Job Card",
            filters={"work_order": ["in", wo_names], "docstatus": ["<", 2]},
            fields=jc_fields,
            limit_page_length=0,
        )

    ws_owner = _workstation_owners()
    by_ws = defaultdict(_blank)
    by_wo = defaultdict(lambda: {"total": 0, "done": 0, "overdue": 0})
    total = _blank()
    delayed, delays = [], []
    planned_due = done_dated = on_time = 0

    for jc in job_cards:
        ws_name = jc.workstation or "Unassigned"
        ws_row = by_ws[ws_name]
        wo_row = by_wo[jc.work_order]
        done = jc.status in JC_COMPLETED
        expected = getdate(jc.expected_end_date) if jc.expected_end_date else None

        for bucket in (ws_row, total):
            bucket["total"] += 1
            if done:
                bucket["completed"] += 1
            elif jc.status in JC_HOLD:
                bucket["hold"] += 1
            elif jc.status in JC_WIP:
                bucket["wip"] += 1
            else:
                bucket["not_started"] += 1

        if jc.get("sequence_id"):
            ws_row["seq"] = min(ws_row["seq"], cint(jc.sequence_id))

        wo_row["total"] += 1
        if done:
            wo_row["done"] += 1

        if expected and expected <= as_of:
            planned_due += 1

        if done:
            if expected:
                actual = getdate(jc.get("actual_end_date") or jc.modified)
                done_dated += 1
                if actual <= expected:
                    on_time += 1
        elif expected and expected < as_of:
            late = date_diff(as_of, expected)
            delays.append(late)
            wo_row["overdue"] += 1
            for bucket in (ws_row, total):
                bucket["overdue"] += 1
                bucket["max_delay"] = max(bucket["max_delay"], late)
            delayed.append(
                {
                    "job_card": jc.name,
                    "work_order": jc.work_order,
                    "operation": jc.operation,
                    "workstation": ws_name,
                    "owner": ws_owner.get(ws_name) or "Unassigned",
                    "expected_end": str(expected),
                    "days_late": late,
                    "status": jc.status,
                }
            )

    delayed.sort(key=lambda r: r["days_late"], reverse=True)

    # ---- Workstations (in process order) and owners
    workstations = []
    owners = defaultdict(lambda: {"workstations": [], "total": 0, "completed": 0, "overdue": 0, "hold": 0})

    for name, row in by_ws.items():
        owner = ws_owner.get(name) or "Unassigned"
        open_count = row["total"] - row["completed"]
        workstations.append(
            {
                "name": name,
                "code": name.split(" — ")[0].strip(),
                "owner": owner,
                "seq": row["seq"],
                "total": row["total"],
                "completed": row["completed"],
                "wip": row["wip"],
                "hold": row["hold"],
                "not_started": row["not_started"],
                "open": open_count,
                "overdue": row["overdue"],
                "max_delay": row["max_delay"],
                "progress_pct": _pct(row["completed"], row["total"]),
            }
        )
        o = owners[owner]
        o["workstations"].append(name.split(" — ")[0].strip())
        for key in ("total", "completed", "overdue", "hold"):
            o[key] += row[key]

    workstations.sort(key=lambda w: (w["seq"], w["name"]))

    owner_rows = [
        {
            "owner": name,
            "workstations": ", ".join(o["workstations"]),
            "total": o["total"],
            "open": o["total"] - o["completed"],
            "overdue": o["overdue"],
            "hold": o["hold"],
            "progress_pct": _pct(o["completed"], o["total"]),
        }
        for name, o in owners.items()
    ]
    owner_rows.sort(key=lambda r: r["overdue"], reverse=True)

    # ---- Work order rows
    wo_rows = []
    for w in work_orders:
        stats = by_wo[w.name]
        wo_rows.append(
            {
                "name": w.name,
                "item": w.item_name or w.production_item,
                "qty": w.qty,
                "produced_qty": w.produced_qty,
                "jc_total": stats["total"],
                "jc_done": stats["done"],
                "overdue": stats["overdue"],
                "progress_pct": _pct(stats["done"], stats["total"]),
                "planned_end": str(getdate(w.planned_end_date)) if w.planned_end_date else None,
                "status": _wo_label(w, stats, as_of),
            }
        )

    # ---- Summary
    planned_qty = sum(w.qty or 0 for w in work_orders)
    produced_qty = sum(w.produced_qty or 0 for w in work_orders)
    completed_wos = sum(1 for w in work_orders if w.status == "Completed")
    progress = _pct(total["completed"], total["total"])
    planned_pct = _pct(planned_due, total["total"])

    summary = {
        "work_orders": len(work_orders),
        "completed_wos": completed_wos,
        "wo_pct": _pct(completed_wos, len(work_orders)),
        "planned_qty": planned_qty,
        "produced_qty": produced_qty,
        "qty_pct": _pct(produced_qty, planned_qty),
        "jc_total": total["total"],
        "jc_completed": total["completed"],
        "jc_open": total["total"] - total["completed"],
        "jc_wip": total["wip"],
        "jc_hold": total["hold"],
        "jc_not_started": total["not_started"],
        "jc_overdue": total["overdue"],
        "overdue_pct": _pct(total["overdue"], total["total"] - total["completed"]),
        "avg_delay": int(round(sum(delays) / len(delays))) if delays else 0,
        "max_delay": max(delays) if delays else 0,
        "progress_pct": progress,
        "planned_pct": planned_pct,
        "behind_pts": max(0, planned_pct - progress),
        "on_time_pct": _pct(on_time, done_dated + total["overdue"]) if (done_dated + total["overdue"]) else None,
    }

    return {
        "as_of_date": str(as_of),
        "period": period_code,
        "from_date": str(p_start),
        "to_date": str(p_end),
        "summary": summary,
        "workstations": workstations,
        "work_orders": wo_rows,
        "owners": owner_rows,
        "delayed_job_cards": delayed[:MAX_DELAYED_ROWS],
        "delayed_total": len(delayed),
        "owner_field_missing": _owner_field() is None,
    }
