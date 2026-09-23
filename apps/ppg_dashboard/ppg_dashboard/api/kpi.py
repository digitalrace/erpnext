import frappe
from ppg_dashboard.api.production_api import get_active_job_names
from frappe.utils import flt, getdate, today, get_last_day, add_months, nowdate, add_days

def _get_period_range(period="This Month"):
    curr_date = getdate(today())
    if period == "This Week":
        start_date = curr_date
        end_date = curr_date
    elif period == "Last Month":
        last_month = add_months(curr_date, -1)
        start_date = last_month.replace(day=1)
        end_date = curr_date.replace(day=1)
    else:  # Default: "This Month"
        start_date = curr_date.replace(day=1)
        end_date = curr_date
    return start_date, end_date

def _get_weekly_ranges():
    curr_date = getdate(today())
    year, month, last_day = curr_date.year, curr_date.month, get_last_day(curr_date).day
    return [
        ("W1", f"{year}-{month:02d}-01", f"{year}-{month:02d}-07"),
        ("W2", f"{year}-{month:02d}-08", f"{year}-{month:02d}-14"),
        ("W3", f"{year}-{month:02d}-15", f"{year}-{month:02d}-21"),
        ("W4", f"{year}-{month:02d}-22", f"{year}-{month:02d}-{last_day:02d}")
    ]

def _get_qi_weekly(workstation, default_val):
    weeks = _get_weekly_ranges()
    weekly_data = []
    for label, start_d, end_d in weeks:
        res = frappe.db.sql("""
            SELECT 
                COUNT(qi.name) as total, 
                SUM(CASE WHEN qi.status = 'Accepted' THEN 1 ELSE 0 END) as passed
            FROM `tabQuality Inspection` qi
            INNER JOIN `tabJob Card` jc ON qi.reference_name = jc.name
            WHERE jc.workstation LIKE %s 
              AND qi.docstatus = 1 
              AND qi.report_date BETWEEN %s AND %s
        """, (f"{workstation}%", start_d, end_d), as_dict=True)

        total = res[0].get("total", 0) if res else 0
        passed = res[0].get("passed", 0) if res else 0
        val = round((passed / total) * 100, 1) if total > 0 else default_val
        weekly_data.append({"label": label, "value": val})
    return weekly_data
import frappe
from frappe.utils import (
    flt, getdate, today, add_days, add_months, get_last_day, get_first_day,
    get_year_start, get_year_ending, get_quarter_start, get_quarter_ending
)

PERIOD_RANGES = {
    "This Week": lambda: (add_days(today(), -frappe.utils.getdate(today()).weekday()), today()),
    "Last Week": lambda: (
        add_days(today(), -frappe.utils.getdate(today()).weekday() - 7),
        add_days(today(), -frappe.utils.getdate(today()).weekday() - 1)
    ),
    "This Month": lambda: (get_first_day(today()), get_last_day(today())),
    "Last Month": lambda: (
        get_first_day(add_months(today(), -1)),
        get_last_day(add_months(today(), -1))
    ),
    "This Quarter": lambda: (get_quarter_start(today()), get_quarter_ending(today())),
    "Last Quarter": lambda: (
        get_quarter_start(add_months(today(), -3)),
        get_quarter_ending(add_months(today(), -3))
    ),
    "This Year": lambda: (get_year_start(today()), get_year_ending(today())),
    "Last Year": lambda: (
        get_year_start(add_months(today(), -12)),
        get_year_ending(add_months(today(), -12))
    ),
}

def _get_period_range(period):
    if period not in PERIOD_RANGES:
        frappe.throw(f"Invalid period: {period}")
    return PERIOD_RANGES[period]()


@frappe.whitelist()
def get_ws1_kpi1(workstation="WS1 — Production Planning Office", period="This Month"):
    start_date, end_date = _get_period_range(period)

    completed_cards = frappe.get_all(
        "Job Card",
        filters={
            "workstation": workstation,
            "status": "Completed",
            "actual_end_date": ["between", [start_date, end_date]],
        },
        fields=["name", "expected_end_date", "actual_end_date"],
    )

    total = len(completed_cards)
    on_time = sum(
        1 for jc in completed_cards
        if jc.actual_end_date and jc.expected_end_date
        and jc.actual_end_date <= jc.expected_end_date
    )

    pct = round((on_time / total) * 100, 1) if total else 0

    return {
        "value": pct,
        "target": 98,
        "on_target": pct >= 98,
        "total": total,
        "on_time": on_time,
        "period": period,
        "start_date": str(start_date),
        "end_date": str(end_date),
    }


@frappe.whitelist()
def get_ws1_kpi2(workstation="WS1 — Production Planning Office", period="This Month"):
    start_date, end_date = _get_period_range(period)

    started_cards = frappe.get_all(
        "Job Card",
        filters={
            "workstation": workstation,
            "actual_start_date": ["between", [start_date, end_date]],
        },
        fields=["name", "expected_start_date", "actual_start_date"],
    )

    total = len(started_cards)
    on_slot = sum(
        1 for jc in started_cards
        if jc.actual_start_date and jc.expected_start_date
        and jc.actual_start_date <= jc.expected_start_date
    )

    pct = round((on_slot / total) * 100, 1) if total else 0

    return {
        "value": pct,
        "target": 95,
        "on_target": pct >= 95,
        "total": total,
        "on_slot": on_slot,
        "period": period,
        "start_date": str(start_date),
        "end_date": str(end_date),
    }


@frappe.whitelist()
def get_ws1_tat_adherence_7days(workstation="WS1 — Production Planning Office", tat_target_days=2):
    tat_target_days = float(tat_target_days)
    today_date = frappe.utils.getdate(frappe.utils.today())
    days = [frappe.utils.add_days(today_date, -i) for i in range(6, -1, -1)]

    completed = frappe.get_all(
        "Job Card",
        filters={
            "workstation": workstation,
            "status": "Completed",
            "actual_end_date": ["between", [days[0], frappe.utils.add_days(days[-1], 1)]],
        },
        fields=["actual_start_date", "actual_end_date"],
    )

    result = []
    for d in days:
        day_cards = [
            c for c in completed
            if c.actual_end_date and frappe.utils.getdate(c.actual_end_date) == d
        ]
        total = len(day_cards)
        within = sum(
            1 for c in day_cards
            if c.actual_start_date and
            (frappe.utils.time_diff_in_hours(c.actual_end_date, c.actual_start_date) / 24) <= tat_target_days
        )
        pct = round((within / total) * 100, 1) if total else 100
        result.append({
            "label": frappe.utils.formatdate(d, "EEE"),
            "date": str(d),
            "value": pct,
            "total": total,
        })

    return result


@frappe.whitelist()
def get_ws1_completed_7days(workstation="WS1 — Production Planning Office"):
    today_date = frappe.utils.getdate(frappe.utils.today())
    days = [frappe.utils.add_days(today_date, -i) for i in range(6, -1, -1)]

    completed = frappe.get_all(
        "Job Card",
        filters={
            "workstation": workstation,
            "status": "Completed",
            "actual_end_date": ["between", [days[0], frappe.utils.add_days(days[-1], 1)]],
        },
        fields=["actual_end_date"],
    )

    result = []
    for d in days:
        count = sum(
            1 for c in completed
            if c.actual_end_date and frappe.utils.getdate(c.actual_end_date) == d
        )
        result.append({
            "label": frappe.utils.formatdate(d, "EEE"),
            "date": str(d),
            "count": count,
            "is_today": d == today_date,
            })
    return result

def _split_into_weeks(start_date, end_date, num_weeks=4):
    start_date = frappe.utils.getdate(start_date)
    end_date = frappe.utils.getdate(end_date)
    total_days = (end_date - start_date).days + 1
    chunk = max(total_days // num_weeks, 1)

    weeks = []
    cursor = start_date
    for i in range(num_weeks):
        week_end = min(add_days(cursor, chunk - 1), end_date)
        weeks.append((cursor, week_end))
        cursor = add_days(week_end, 1)
        if cursor > end_date:
            break
    return weeks


def _kpi1_calc(workstation, start_date, end_date):
    cards = frappe.get_all(
        "Job Card",
        filters={
            "workstation": workstation,
            "status": "Completed",
            "actual_end_date": ["between", [start_date, end_date]],
        },
        fields=["actual_end_date", "expected_end_date"],
    )
    total = len(cards)
    on_time = sum(1 for c in cards if c.actual_end_date and c.expected_end_date and c.actual_end_date <= c.expected_end_date)
    pct = round((on_time / total) * 100, 1) if total else 0
    return pct, total, on_time


def _kpi2_calc(workstation, start_date, end_date):
    cards = frappe.get_all(
        "Job Card",
        filters={
            "workstation": workstation,
            "actual_start_date": ["between", [start_date, end_date]],
        },
        fields=["actual_start_date", "expected_start_date"],
    )
    total = len(cards)
    on_slot = sum(1 for c in cards if c.actual_start_date and c.expected_start_date and c.actual_start_date <= c.expected_start_date)
    pct = round((on_slot / total) * 100, 1) if total else 0
    return pct, total, on_slot


@frappe.whitelist()
def get_ws1_kpi1_weekly(workstation="WS1 — Production Planning Office", period="This Month"):
    start_date, end_date = _get_period_range(period)
    weeks = _split_into_weeks(start_date, end_date)
    result = []
    for i, (ws, we) in enumerate(weeks):
        pct, total, on_time = _kpi1_calc(workstation, ws, we)
        result.append({"label": f"W{i+1}", "value": pct, "total": total})
    return result


@frappe.whitelist()
def get_ws1_kpi2_weekly(workstation="WS1 — Production Planning Office", period="This Month"):
    start_date, end_date = _get_period_range(period)
    weeks = _split_into_weeks(start_date, end_date)
    result = []
    for i, (ws, we) in enumerate(weeks):
        pct, total, on_slot = _kpi2_calc(workstation, ws, we)
        result.append({"label": f"W{i+1}", "value": pct, "total": total})
    return result


@frappe.whitelist()
def get_ws1_tat_mtd(workstation="WS1 — Production Planning Office", tat_target_days=2):
    tat_target_days = float(tat_target_days)
    start_date, end_date = _get_period_range("This Month")

    completed = frappe.get_all(
        "Job Card",
        filters={
            "workstation": workstation,
            "status": "Completed",
            "actual_end_date": ["between", [start_date, end_date]],
        },
        fields=["name", "actual_start_date", "actual_end_date"],
        order_by="actual_end_date desc",
    )

    valid = [c for c in completed if c.actual_start_date and c.actual_end_date]
    total = len(valid)
    within = 0
    tat_list = []
    for c in valid:
        duration = frappe.utils.time_diff_in_hours(c.actual_end_date, c.actual_start_date) / 24
        tat_list.append(duration)
        if duration <= tat_target_days:
            within += 1

    pct = round((within / total) * 100, 1) if total else 0
    avg_tat = round(sum(tat_list) / len(tat_list), 1) if tat_list else 0

    last5 = valid[:5]
    last5_within = sum(
        1 for c in last5
        if frappe.utils.time_diff_in_hours(c.actual_end_date, c.actual_start_date) / 24 <= tat_target_days
    )

    return {
        "pct": pct,
        "avg_tat": avg_tat,
        "tat_target_days": tat_target_days,
        "last5_total": len(last5),
        "last5_within": last5_within,
        "last5_exceeded": len(last5) - last5_within,
    }


@frappe.whitelist()
def get_ws1_kpi4_at_station_now(workstation="WS1 — Production Planning Office"):
    open_cards = frappe.get_all(
        "Job Card",
        filters={
            "workstation": workstation,
            "status": ["in", ["Work In Progress", "Open", "On Hold"]],
            "docstatus": 0,
        },
        fields=["name", "expected_end_date"],
    )

    active_job_names = get_active_job_names()
    active_cards = [c for c in open_cards if c.name in active_job_names]

    now = frappe.utils.now_datetime()
    amber_red = sum(
        1 for jc in active_cards
        if jc.expected_end_date and frappe.utils.get_datetime(jc.expected_end_date) < now
    )

    return {
        "count": len(active_cards),
        "amber_red": amber_red,
    }


@frappe.whitelist()
def get_ws1_kpi5_completed_today(workstation="WS1 — Production Planning Office"):
    today_date = frappe.utils.today()

    completed_today = frappe.get_all(
        "Job Card",
        filters={
            "workstation": workstation,
            "status": "Completed",
            "actual_end_date": ["between", [today_date, today_date + " 23:59:59"]],
        },
        fields=["name"],
    )

    return {
        "count": len(completed_today),
    }


@frappe.whitelist()
def get_ws1_kpi3(workstation="WS1 — Production Planning Office", period="This Month", tat_target_days=2):
    start_date, end_date = _get_period_range(period)
    tat_target_days = float(tat_target_days)

    completed_cards = frappe.get_all(
        "Job Card",
        filters={
            "workstation": workstation,
            "status": "Completed",
            "actual_end_date": ["between", [start_date, end_date]],
        },
        fields=["name", "actual_start_date", "actual_end_date"],
    )

    valid_cards = [
        jc for jc in completed_cards
        if jc.actual_start_date and jc.actual_end_date
    ]

    total = len(valid_cards)
    within_tat = 0
    tat_days_list = []

    for jc in valid_cards:
        duration = frappe.utils.time_diff_in_hours(jc.actual_end_date, jc.actual_start_date) / 24
        tat_days_list.append(duration)
        if duration <= tat_target_days:
            within_tat += 1

    pct = round((within_tat / total) * 100, 1) if total else 0
    avg_tat = round(sum(tat_days_list) / len(tat_days_list), 1) if tat_days_list else 0

    return {
        "value": pct,
        "target": 95,
        "on_target": pct >= 95,
        "total": total,
        "within_tat": within_tat,
        "avg_tat_days": avg_tat,
        "tat_target_days": tat_target_days,
        "period": period,
        "start_date": str(start_date),
        "end_date": str(end_date),
    }


@frappe.whitelist()
def get_ws1_jobs(workstation="WS1 — Production Planning Office", tab="Pending"):
    now = frappe.utils.now_datetime()

    base_fields = [
        "name", "work_order", "production_item", "item_name",
        "for_quantity", "posting_date", "expected_start_date",
        "expected_end_date", "actual_start_date", "actual_end_date",
        "status", "workstation_type", "remarks", "quality_inspection",
        "sequence_id",
    ]

    def is_blocked_by_upstream(jc):
        """True if any earlier-sequence Job Card on the same Work Order isn't Completed yet."""
        if not jc.work_order or not jc.sequence_id:
            return False
        earlier_incomplete = frappe.get_all(
            "Job Card",
            filters={
                "work_order": jc.work_order,
                "sequence_id": ["<", jc.sequence_id],
                "status": ["!=", "Completed"],
            },
            limit=1,
        )
        return bool(earlier_incomplete)

    current_station_cache = {}

    def get_real_current_station(jc):
        """Find where the panel actually is right now: the lowest-sequence Job Card
        on this Work Order that hasn't been Completed yet. Falls back to jc's own
        workstation if everything is completed or work_order is missing."""
        if not jc.work_order:
            return jc.workstation_type or "-"

        if jc.work_order in current_station_cache:
            return current_station_cache[jc.work_order]

        earliest_incomplete = frappe.get_all(
            "Job Card",
            filters={"work_order": jc.work_order, "status": ["!=", "Completed"]},
            fields=["workstation"],
            order_by="sequence_id asc",
            limit=1,
        )

        if earliest_incomplete and earliest_incomplete[0].workstation:
            station_full = earliest_incomplete[0].workstation
            station_code = station_full.split(" ")[0]
        else:
            station_code = "Completed"

        current_station_cache[jc.work_order] = station_code
        return station_code

    if tab == "Completed":
        cards = frappe.get_all(
            "Job Card",
            filters={"workstation": workstation, "status": "Completed"},
            fields=base_fields,
            order_by="posting_date desc",
        )
    else:
        all_active = frappe.get_all(
            "Job Card",
            filters={"workstation": workstation, "status": ["in", ["Open", "Work In Progress", "On Hold"]]},
            fields=base_fields,
            order_by="posting_date desc",
        )

        for jc in all_active:
            jc["_blocked"] = is_blocked_by_upstream(jc)

        if tab == "Upcoming":
            # Not started, and either genuinely future OR blocked waiting on an earlier station
            cards = [
                jc for jc in all_active
                if not jc.actual_start_date
                and (
                    jc["_blocked"]
                    or (jc.expected_start_date and frappe.utils.get_datetime(jc.expected_start_date) > now)
                )
            ]
        else:  # Pending
            cards = [
                    jc for jc in all_active
                    if jc.status == "On Hold"
                    or jc.status == "Work In Progress"
                    or (
                        not jc["_blocked"]
                        and (
                            jc.actual_start_date
                            or not jc.expected_start_date
                            or frappe.utils.get_datetime(jc.expected_start_date) <= now
                            )
                        )
                    ]    
    result = []

    for jc in cards:
        customer_name = None
        if jc.work_order:
            so = frappe.db.get_value("Work Order", jc.work_order, "sales_order")
            if so:
                customer_name = frappe.db.get_value("Sales Order", so, "customer_name")

        target_days = 2
        if jc.expected_start_date and jc.expected_end_date:
            target_days = round(
                frappe.utils.time_diff_in_hours(jc.expected_end_date, jc.expected_start_date) / 24, 1
            ) or 1

        days_at_station = 0
        if jc.actual_start_date:
            end_ref = jc.actual_end_date or now
            days_at_station = round(
                frappe.utils.time_diff_in_hours(end_ref, jc.actual_start_date) / 24, 1
            )

        days_to_start = None
        if jc.expected_start_date:
            days_to_start = round(
                frappe.utils.time_diff_in_hours(jc.expected_start_date, now) / 24, 1
            )

        is_within_tat = (
            jc.actual_start_date and jc.actual_end_date and days_at_station <= target_days
        )

        blocked = jc.get("_blocked", False)
        note = "on hold upstream" if blocked else (jc.remarks or "awaiting release")

        result.append({
            "job_card": jc.name,
            "work_order": jc.work_order,
            "panel": jc.production_item or jc.name,
            "customer": customer_name or "Not Linked",
            "type": jc.item_name or "-",
            "arrived": str(jc.posting_date) if jc.posting_date else "",
            "days_at_station": days_at_station,
            "target_days": target_days,
            "status": jc.status,
            "currently_at": get_real_current_station(jc),
            "days_to_start": days_to_start,
            "planned_arrival": frappe.utils.formatdate(jc.expected_start_date) if jc.expected_start_date else "-",
            "note": note,
            "signed_out": frappe.utils.formatdate(jc.actual_end_date) if jc.actual_end_date else "-",
            "result": "WITHIN TAT" if is_within_tat else ("EXCEEDED" if jc.actual_end_date else "-"),
            "first_pass_qc": "YES" if jc.quality_inspection else "NO",
        })

    return result


@frappe.whitelist()
def get_station_team_info(workstation="WS1 — Production Planning Office"):
    all_assignments = frappe.get_all(
        "Station Team Assignment",
        filters={"workstation": workstation, "status": "Active"},
        fields=["employee", "is_supervisor"]
    )

    supervisors = []
    team = []
    today_date = today()

    for a in all_assignments:
        emp = frappe.db.get_value("Employee", a["employee"], ["employee_name", "grade", "designation"], as_dict=True)
        emp_name = emp.employee_name if emp else a["employee"]
        emp_grade = emp.grade if emp else "-"
        emp_designation = emp.designation if emp else "-"

        on_leave = frappe.db.exists(
            "Leave Application",
            {
                "employee": a["employee"],
                "status": "Approved",
                "from_date": ["<=", today_date],
                "to_date": [">=", today_date],
            }
        )

        booked_result = frappe.db.sql("""
            SELECT COALESCE(SUM(tl.time_in_mins), 0)
            FROM `tabJob Card Time Log` tl
            WHERE tl.employee = %s
            AND DATE(tl.from_time) = CURDATE()
        """, (a["employee"],))[0][0]
        booked_hours = round((booked_result or 0) / 60, 1)

        sign_offs = frappe.db.sql("""
            SELECT COUNT(DISTINCT jc.name)
            FROM `tabJob Card Time Log` tl
            INNER JOIN `tabJob Card` jc ON tl.parent = jc.name
            WHERE tl.employee = %s
            AND jc.status = 'Completed'
            AND DATE(tl.to_time) = CURDATE()
        """, (a["employee"],))[0][0]

        entry = {
            "employee_name": emp_name,
            "grade": emp_grade,
            "designation": emp_designation,
            "on_leave": bool(on_leave),
            "booked_hours": booked_hours,
            "sign_offs": sign_offs,
        }

        if a["is_supervisor"]:
            supervisors.append(entry)
        else:
            team.append(entry)

    return {"supervisors": supervisors, "team": team}


@frappe.whitelist()
def get_role_owner_name(role=None):
    if not role:
        return "Unassigned"

    users_with_role = frappe.get_all(
        "Has Role",
        filters={"role": role, "parenttype": "User"},
        fields=["parent"],
    )
    user_emails = [u.parent for u in users_with_role]

    if not user_emails:
        return "Unassigned"

    employees = frappe.get_all(
        "Employee",
        filters={"user_id": ["in", user_emails], "status": "Active"},
        fields=["employee_name"],
    )

    if not employees:
        return "Unassigned"

    return ", ".join(e.employee_name for e in employees)


# ==========================================
# WS2 STORES & KITTING ENDPOINTS
# ==========================================

@frappe.whitelist()
def get_ws2_kpi1_kit_completeness(workstation="WS2", period="This Month"):
    """
    KPI 1: Kit Completeness First-Time (Target >= 98%)
    Measures if Stores (WS2) issued 100% of required materials on the 1st attempt
    for any Job Card material request (WS3, WS7, WS8, WS10, etc.).
    """
    start_date, end_date = get_period_dates(period)
    
    # Get all Stock Entries (Material Transfer / Issue for Manufacture) submitted in period
    stock_entries = frappe.db.sql("""
        SELECT 
            se.name,
            se.job_card,
            se.creation
        FROM `tabStock Entry` se
        WHERE se.docstatus = 1
          AND se.purpose IN ('Material Transfer for Manufacture', 'Material Issue')
          AND se.job_card IS NOT NULL
          AND DATE(se.creation) BETWEEN %s AND %s
    """, (start_date, end_date), as_dict=True)

    if not stock_entries:
        # Fallback if no issues recorded yet in selected period
        return {"value": 100.0, "target": 98.0, "on_target": True}

    total_requests = 0
    first_time_complete_count = 0

    # Group by Job Card to analyze first-attempt completeness
    job_cards_processed = set()

    for se in stock_entries:
        jc_name = se.job_card
        if jc_name in job_cards_processed:
            continue
        
        job_cards_processed.add(jc_name)
        total_requests += 1
        
        # Check if the Job Card had any partial shortage logged or multiple material issue attempts
        jc_doc = frappe.get_doc("Job Card", jc_name)
        
        # Check if Job Card items required match the first Stock Entry issued items
        required_items = len(jc_doc.items) if hasattr(jc_doc, 'items') and jc_doc.items else 0
        
        # If custom_shortage_flag exists or partial issue occurred
        has_shortage = frappe.db.get_value("Job Card", jc_name, "custom_has_material_shortage") or 0
        
        if not has_shortage and required_items > 0:
            first_time_complete_count += 1

    pct = round((first_time_complete_count / total_requests) * 100, 1) if total_requests > 0 else 100.0
    
    return {
        "value": pct,
        "target": 98.0,
        "on_target": pct >= 98.0
    }

@frappe.whitelist()
def get_ws2_kpi2_inbound_mar(workstation="WS2", period="This Month"):
    """
    KPI 2: Inbound Material Availability Ratio (Target >= 98%)
    Measures if raw materials & components required for the entire panel BOM
    were physically available in Stores Warehouse when the Job arrived at WS2.
    """
    start_date, end_date = get_period_dates(period)
    
    # Query Job Cards that arrived at WS2 in the period
    ws2_jobs = frappe.db.sql("""
        SELECT name, work_order, creation
        FROM `tabJob Card`
        WHERE workstation LIKE %s
          AND DATE(creation) BETWEEN %s AND %s
    """, ("WS2%", start_date, end_date), as_dict=True)

    if not ws2_jobs:
        return {"value": 100.0, "target": 98.0, "on_target": True}

    total_checked_items = 0
    available_items = 0

    for job in ws2_jobs:
        if not job.work_order:
            continue
            
        # Get BOM required items for the parent Work Order
        wo_items = frappe.db.sql("""
            SELECT item_code, required_qty, source_warehouse
            FROM `tabWork Order Item`
            WHERE parent = %s
        """, (job.work_order,), as_dict=True)

        for item in wo_items:
            total_checked_items += 1
            warehouse = item.source_warehouse or "Stores - PPGPL"
            
            # Check actual available qty in Stores Warehouse
            actual_qty = frappe.db.get_value("Bin", {
                "item_code": item.item_code,
                "warehouse": warehouse
            }, "actual_qty") or 0.0

            if actual_qty >= item.required_qty:
                available_items += 1

    pct = round((available_items / total_checked_items) * 100, 1) if total_checked_items > 0 else 100.0

    return {
        "value": pct,
        "target": 98.0,
        "on_target": pct >= 98.0
    }


@frappe.whitelist()
def get_ws2_kpi1_weekly(workstation="WS2"):
    """
    Weekly breakdown for KPI 1 (Kit Completeness First-Time) across last 4 weeks.
    """
    weeks_data = []
    today = getdate(nowdate())
    
    for i in range(3, -1, -1):
        start = today - frappe.utils.datetime.timedelta(days=(i+1)*7)
        end = today - frappe.utils.datetime.timedelta(days=i*7)
        label = f"W{4-i}"
        
        val = calc_kit_completeness_for_dates(start, end)
        weeks_data.append({"label": label, "value": val})
        
    return weeks_data


@frappe.whitelist()
def get_ws2_kpi2_weekly(workstation="WS2"):
    """
    Weekly breakdown for KPI 2 (Inbound MAR) across last 4 weeks.
    """
    weeks_data = []
    today = getdate(nowdate())
    
    for i in range(3, -1, -1):
        start = today - frappe.utils.datetime.timedelta(days=(i+1)*7)
        end = today - frappe.utils.datetime.timedelta(days=i*7)
        label = f"W{4-i}"
        
        val = calc_inbound_mar_for_dates(start, end)
        weeks_data.append({"label": label, "value": val})
        
    return weeks_data


# --- Helper Functions ---

def get_period_dates(period):
    today = getdate(nowdate())
    if period == "This Week":
        start = today - frappe.utils.datetime.timedelta(days=today.weekday())
        end = today
    elif period == "Last Month":
        first_this_month = today.replace(day=1)
        end = first_this_month - frappe.utils.datetime.timedelta(days=1)
        start = end.replace(day=1)
    else:  # Default: "This Month"
        start = today.replace(day=1)
        end = today
    return start, end


def calc_kit_completeness_for_dates(start_date, end_date):
    res = get_ws2_kpi1_kit_completeness(period="Custom")
    return res.get("value", 100.0)


def calc_inbound_mar_for_dates(start_date, end_date):
    res = get_ws2_kpi2_inbound_mar(period="Custom")
    return res.get("value", 100.0)

def _get_period_range(period="This Month"):
    curr_date = getdate(today())
    if period == "This Week":
        start_date = curr_date
        end_date = curr_date
    elif period == "Last Month":
        last_month = add_months(curr_date, -1)
        start_date = last_month.replace(day=1)
        end_date = curr_date.replace(day=1)
    else:  # Default: "This Month"
        start_date = curr_date.replace(day=1)
        end_date = curr_date
    return start_date, end_date

def check_job_card_material_shortage(doc, method):
    """
    Hook triggered when Stock Entry (Material Transfer) is submitted.
    If issued qty < required qty on Job Card, marks custom_has_material_shortage = 1.
    """
    if doc.purpose in ["Material Transfer for Manufacture", "Material Issue"] and doc.job_card:
        jc = frappe.get_doc("Job Card", doc.job_card)
        
        is_shortage = False
        for jc_item in jc.items:
            # Find matching item in Stock Entry
            se_qty = sum(item.qty for item in doc.items if item.item_code == jc_item.item_code)
            if se_qty < jc_item.required_qty:
                is_shortage = True
                break
        
        if is_shortage:
            frappe.db.set_value("Job Card", doc.job_card, "custom_has_material_shortage", 1)
# ==========================================
# WS3 CNC CUTTING ENDPOINTS
# ==========================================

@frappe.whitelist()
def get_ws3_kpi1(workstation, period="This Month"):
    """ KPI 1: First-Piece Dimensional Pass (%) """
    start_date, end_date = _get_period_range(period)
    data = frappe.db.sql("""
        SELECT 
            COUNT(qi.name) as total_checks, 
            SUM(CASE WHEN qi.status = 'Accepted' THEN 1 ELSE 0 END) as passed_checks
        FROM `tabQuality Inspection` qi
        INNER JOIN `tabJob Card` jc ON qi.reference_name = jc.name
        WHERE jc.workstation LIKE %s 
          AND qi.docstatus = 1
          AND qi.report_date BETWEEN %s AND %s
    """, (f"{workstation}%", start_date, end_date), as_dict=True)
    
    total = data[0].get("total_checks", 0) if data else 0
    passed = data[0].get("passed_checks", 0) if data else 0
    val = round((passed / total) * 100, 1) if total > 0 else 100.0
    return {"value": val, "target": 100.0, "on_target": val >= 100.0}


@frappe.whitelist()
def get_ws3_kpi2(workstation, period="This Month"):
    """ KPI 2: Cutting Scrap (%) """
    data = frappe.db.sql("""
        SELECT SUM(IFNULL(process_loss_qty, 0)) as total_loss, SUM(IFNULL(for_quantity, 0)) as total_planned
        FROM `tabJob Card` WHERE workstation LIKE %s
    """, (f"{workstation}%",), as_dict=True)
    
    loss = flt(data[0].get("total_loss")) if data else 0.0
    planned = flt(data[0].get("total_planned")) if data else 0.0
    val = round((loss / planned) * 100, 1) if (planned > 0 and loss > 0) else 0.0
    return {"value": val, "target": 1.5, "on_target": val <= 1.5}


@frappe.whitelist()
def get_ws3_kpi1_weekly(workstation):
    """ KPI 1 Weekly Trend: First-Piece Pass (%) per week """
    curr_date = getdate(today())
    year, month, last_day = curr_date.year, curr_date.month, get_last_day(curr_date).day
    weeks_range = [
        ("W1", f"{year}-{month:02d}-01", f"{year}-{month:02d}-07"),
        ("W2", f"{year}-{month:02d}-08", f"{year}-{month:02d}-14"),
        ("W3", f"{year}-{month:02d}-15", f"{year}-{month:02d}-21"),
        ("W4", f"{year}-{month:02d}-22", f"{year}-{month:02d}-{last_day:02d}")
    ]
    weekly_data = []

    for label, start_d, end_d in weeks_range:
        res = frappe.db.sql("""
            SELECT 
                COUNT(qi.name) as total_checks,
                SUM(CASE WHEN qi.status = 'Accepted' THEN 1 ELSE 0 END) as passed_checks
            FROM `tabQuality Inspection` qi
            INNER JOIN `tabJob Card` jc ON qi.reference_name = jc.name
            WHERE jc.workstation LIKE %s 
              AND qi.docstatus = 1
              AND qi.report_date BETWEEN %s AND %s
        """, (f"{workstation}%", start_d, end_d), as_dict=True)

        total = res[0].get("total_checks", 0) if res else 0
        passed = res[0].get("passed_checks", 0) if res else 0
        val = round((passed / total) * 100, 1) if total > 0 else 100.0
        weekly_data.append({"label": label, "value": val})

    return weekly_data


@frappe.whitelist()
def get_ws3_kpi2_weekly(workstation):
    """ KPI 2 Weekly Trend: Cutting Scrap (%) per week """
    curr_date = getdate(today())
    year, month, last_day = curr_date.year, curr_date.month, get_last_day(curr_date).day
    weeks_range = [
        ("W1", f"{year}-{month:02d}-01", f"{year}-{month:02d}-07"),
        ("W2", f"{year}-{month:02d}-08", f"{year}-{month:02d}-14"),
        ("W3", f"{year}-{month:02d}-15", f"{year}-{month:02d}-21"),
        ("W4", f"{year}-{month:02d}-22", f"{year}-{month:02d}-{last_day:02d}")
    ]
    weekly_data = []

    for label, start_d, end_d in weeks_range:
        res = frappe.db.sql("""
            SELECT 
                SUM(IFNULL(process_loss_qty, 0)) as total_loss,
                SUM(IFNULL(for_quantity, 0)) as total_planned
            FROM `tabJob Card` 
            WHERE workstation LIKE %s 
              AND modified BETWEEN %s AND %s
        """, (f"{workstation}%", f"{start_d} 00:00:00", f"{end_d} 23:59:59"), as_dict=True)

        loss = flt(res[0].get("total_loss")) if res else 0.0
        planned = flt(res[0].get("total_planned")) if res else 0.0
        val = round((loss / planned) * 100, 1) if (planned > 0 and loss > 0) else 0.0
        weekly_data.append({"label": label, "value": val})

    return weekly_data
# ==========================================
# WS4 TO WS14 ENDPOINTS
# ==========================================


# ==========================================
# WS4 BENDING & FORMING ENDPOINTS
# ==========================================

@frappe.whitelist()
def get_ws4_kpi1(workstation, period="This Month"):
    start_date, end_date = _get_period_range(period)
    data = frappe.db.sql("""
        SELECT COUNT(qi.name) as total_checks, SUM(CASE WHEN qi.status = 'Accepted' THEN 1 ELSE 0 END) as passed_checks
        FROM `tabQuality Inspection` qi
        INNER JOIN `tabJob Card` jc ON qi.reference_name = jc.name
        WHERE jc.workstation LIKE %s AND qi.docstatus = 1 AND qi.report_date BETWEEN %s AND %s
    """, (f"{workstation}%", start_date, end_date), as_dict=True)

    total = data[0].get("total_checks", 0) if data else 0
    passed = data[0].get("passed_checks", 0) if data else 0
    val = round((passed / total) * 100, 1) if total > 0 else 100.0
    return {"value": val, "target": 98.0, "on_target": val >= 98.0}


@frappe.whitelist()
def get_ws4_kpi2(workstation, period="This Month"):
    start_date, end_date = _get_period_range(period)
    data = frappe.db.sql("""
        SELECT COUNT(qi.name) as total_tests, SUM(CASE WHEN qi.status = 'Accepted' THEN 1 ELSE 0 END) as passed_tests
        FROM `tabQuality Inspection` qi
        INNER JOIN `tabJob Card` jc ON qi.reference_name = jc.name
        WHERE jc.workstation LIKE %s AND qi.docstatus = 1 AND qi.report_date BETWEEN %s AND %s
    """, (f"{workstation}%", start_date, end_date), as_dict=True)

    total = data[0].get("total_tests", 0) if data else 0
    passed = data[0].get("passed_tests", 0) if data else 0
    val = round((passed / total) * 100, 1) if total > 0 else 100.0
    return {"value": val, "target": 100.0, "on_target": val >= 100.0}


@frappe.whitelist()
def get_ws4_kpi1_weekly(workstation):
    curr_date = getdate(today())
    year, month, last_day = curr_date.year, curr_date.month, get_last_day(curr_date).day
    weeks_range = [
        ("W1", f"{year}-{month:02d}-01", f"{year}-{month:02d}-07"),
        ("W2", f"{year}-{month:02d}-08", f"{year}-{month:02d}-14"),
        ("W3", f"{year}-{month:02d}-15", f"{year}-{month:02d}-21"),
        ("W4", f"{year}-{month:02d}-22", f"{year}-{month:02d}-{last_day:02d}")
    ]
    weekly_data = []

    for label, start_d, end_d in weeks_range:
        res = frappe.db.sql("""
            SELECT COUNT(qi.name) as total_checks, SUM(CASE WHEN qi.status = 'Accepted' THEN 1 ELSE 0 END) as passed_checks
            FROM `tabQuality Inspection` qi
            INNER JOIN `tabJob Card` jc ON qi.reference_name = jc.name
            WHERE jc.workstation LIKE %s AND qi.docstatus = 1 AND qi.report_date BETWEEN %s AND %s
        """, (f"{workstation}%", start_d, end_d), as_dict=True)

        total = res[0].get("total_checks", 0) if res else 0
        passed = res[0].get("passed_checks", 0) if res else 0
        val = round((passed / total) * 100, 1) if total > 0 else 100.0
        weekly_data.append({"label": label, "value": val})

    return weekly_data


@frappe.whitelist()
def get_ws4_kpi2_weekly(workstation):
    curr_date = getdate(today())
    year, month, last_day = curr_date.year, curr_date.month, get_last_day(curr_date).day
    weeks_range = [
        ("W1", f"{year}-{month:02d}-01", f"{year}-{month:02d}-07"),
        ("W2", f"{year}-{month:02d}-08", f"{year}-{month:02d}-14"),
        ("W3", f"{year}-{month:02d}-15", f"{year}-{month:02d}-21"),
        ("W4", f"{year}-{month:02d}-22", f"{year}-{month:02d}-{last_day:02d}")
    ]
    weekly_data = []

    for label, start_d, end_d in weeks_range:
        res = frappe.db.sql("""
            SELECT COUNT(qi.name) as total_tests, SUM(CASE WHEN qi.status = 'Accepted' THEN 1 ELSE 0 END) as passed_tests
            FROM `tabQuality Inspection` qi
            INNER JOIN `tabJob Card` jc ON qi.reference_name = jc.name
            WHERE jc.workstation LIKE %s AND qi.docstatus = 1 AND qi.report_date BETWEEN %s AND %s
        """, (f"{workstation}%", start_d, end_d), as_dict=True)

        total = res[0].get("total_tests", 0) if res else 0
        passed = res[0].get("passed_tests", 0) if res else 0
        val = round((passed / total) * 100, 1) if total > 0 else 100.0
        weekly_data.append({"label": label, "value": val})

    return weekly_data


# ==========================================
# WS5 WELDING & GRINDING ENDPOINTS
# ==========================================

@frappe.whitelist()
def get_ws5_kpi1(workstation, period="This Month"):
    start_date, end_date = _get_period_range(period)
    data = frappe.db.sql("""
        SELECT COUNT(qi.name) as total_checks, SUM(CASE WHEN qi.status = 'Accepted' THEN 1 ELSE 0 END) as passed_checks
        FROM `tabQuality Inspection` qi
        INNER JOIN `tabJob Card` jc ON qi.reference_name = jc.name
        WHERE jc.workstation LIKE %s AND qi.docstatus = 1 AND qi.report_date BETWEEN %s AND %s
    """, (f"{workstation}%", start_date, end_date), as_dict=True)

    total = data[0].get("total_checks", 0) if data else 0
    passed = data[0].get("passed_checks", 0) if data else 0
    val = round((passed / total) * 100, 1) if total > 0 else 100.0
    return {"value": val, "target": 97.0, "on_target": val >= 97.0}


@frappe.whitelist()
def get_ws5_kpi2(workstation, period="This Month"):
    data = frappe.db.sql("""
        SELECT SUM(IFNULL(process_loss_qty, 0)) as total_loss, SUM(IFNULL(for_quantity, 0)) as total_planned
        FROM `tabJob Card` WHERE workstation LIKE %s
    """, (f"{workstation}%",), as_dict=True)

    loss = flt(data[0].get("total_loss")) if data else 0.0
    planned = flt(data[0].get("total_planned")) if data else 0.0
    val = round((loss / planned) * 100, 1) if (planned > 0 and loss > 0) else 0.0
    return {"value": val, "target": 3.0, "on_target": val <= 3.0}


@frappe.whitelist()
def get_ws5_kpi1_weekly(workstation):
    curr_date = getdate(today())
    year, month, last_day = curr_date.year, curr_date.month, get_last_day(curr_date).day
    weeks_range = [
        ("W1", f"{year}-{month:02d}-01", f"{year}-{month:02d}-07"),
        ("W2", f"{year}-{month:02d}-08", f"{year}-{month:02d}-14"),
        ("W3", f"{year}-{month:02d}-15", f"{year}-{month:02d}-21"),
        ("W4", f"{year}-{month:02d}-22", f"{year}-{month:02d}-{last_day:02d}")
    ]
    weekly_data = []

    for label, start_d, end_d in weeks_range:
        res = frappe.db.sql("""
            SELECT COUNT(qi.name) as total_checks, SUM(CASE WHEN qi.status = 'Accepted' THEN 1 ELSE 0 END) as passed_checks
            FROM `tabQuality Inspection` qi
            INNER JOIN `tabJob Card` jc ON qi.reference_name = jc.name
            WHERE jc.workstation LIKE %s AND qi.docstatus = 1 AND qi.report_date BETWEEN %s AND %s
        """, (f"{workstation}%", start_d, end_d), as_dict=True)

        total = res[0].get("total_checks", 0) if res else 0
        passed = res[0].get("passed_checks", 0) if res else 0
        val = round((passed / total) * 100, 1) if total > 0 else 100.0
        weekly_data.append({"label": label, "value": val})

    return weekly_data


@frappe.whitelist()
def get_ws5_kpi2_weekly(workstation):
    curr_date = getdate(today())
    year, month, last_day = curr_date.year, curr_date.month, get_last_day(curr_date).day
    weeks_range = [
        ("W1", f"{year}-{month:02d}-01", f"{year}-{month:02d}-07"),
        ("W2", f"{year}-{month:02d}-08", f"{year}-{month:02d}-14"),
        ("W3", f"{year}-{month:02d}-15", f"{year}-{month:02d}-21"),
        ("W4", f"{year}-{month:02d}-22", f"{year}-{month:02d}-{last_day:02d}")
    ]
    weekly_data = []

    for label, start_d, end_d in weeks_range:
        res = frappe.db.sql("""
            SELECT SUM(IFNULL(process_loss_qty, 0)) as total_loss, SUM(IFNULL(for_quantity, 0)) as total_planned
            FROM `tabJob Card` WHERE workstation LIKE %s AND modified BETWEEN %s AND %s
        """, (f"{workstation}%", f"{start_d} 00:00:00", f"{end_d} 23:59:59"), as_dict=True)

        loss = flt(res[0].get("total_loss")) if res else 0.0
        planned = flt(res[0].get("total_planned")) if res else 0.0
        val = round((loss / planned) * 100, 1) if (planned > 0 and loss > 0) else 0.0
        weekly_data.append({"label": label, "value": val})

    return weekly_data

# ==========================================
# WS6 9-TANK PRE-TREATMENT ENDPOINTS
# ==========================================

@frappe.whitelist()
def get_ws6_kpi1(workstation, period="This Month"):
    start_date, end_date = _get_period_range(period)
    data = frappe.db.sql("""
        SELECT COUNT(qi.name) as total, SUM(CASE WHEN qi.status = 'Accepted' THEN 1 ELSE 0 END) as passed
        FROM `tabQuality Inspection` qi
        INNER JOIN `tabJob Card` jc ON qi.reference_name = jc.name
        WHERE jc.workstation LIKE %s AND qi.docstatus = 1 AND qi.report_date BETWEEN %s AND %s
    """, (f"{workstation}%", start_date, end_date), as_dict=True)

    total = data[0].get("total", 0) if data else 0
    passed = data[0].get("passed", 0) if data else 0
    val = round((passed / total) * 100, 1) if total > 0 else 100.0
    return {"value": val, "target": 100.0, "on_target": val >= 100.0}

@frappe.whitelist()
def get_ws6_kpi2(workstation, period="This Month"):
    start_date, end_date = _get_period_range(period)
    data = frappe.db.sql("""
        SELECT COUNT(qi.name) as total, SUM(CASE WHEN qi.status = 'Accepted' THEN 1 ELSE 0 END) as passed
        FROM `tabQuality Inspection` qi
        INNER JOIN `tabJob Card` jc ON qi.reference_name = jc.name
        WHERE jc.workstation LIKE %s AND qi.docstatus = 1 AND qi.report_date BETWEEN %s AND %s
    """, (f"{workstation}%", start_date, end_date), as_dict=True)

    total = data[0].get("total", 0) if data else 0
    passed = data[0].get("passed", 0) if data else 0
    val = round((passed / total) * 100, 1) if total > 0 else 100.0
    return {"value": val, "target": 100.0, "on_target": val >= 100.0}

@frappe.whitelist()
def get_ws6_kpi1_weekly(workstation):
    return _get_qi_weekly(workstation, default_val=100.0)

@frappe.whitelist()
def get_ws6_kpi2_weekly(workstation):
    return _get_qi_weekly(workstation, default_val=100.0)


# ==========================================
# WS7 POWDER COATING BOOTH ENDPOINTS
# ==========================================

@frappe.whitelist()
def get_ws7_kpi1(workstation, period="This Month"):
    start_date, end_date = _get_period_range(period)
    data = frappe.db.sql("""
        SELECT COUNT(qi.name) as total, SUM(CASE WHEN qi.status = 'Accepted' THEN 1 ELSE 0 END) as passed
        FROM `tabQuality Inspection` qi
        INNER JOIN `tabJob Card` jc ON qi.reference_name = jc.name
        WHERE jc.workstation LIKE %s AND qi.docstatus = 1 AND qi.report_date BETWEEN %s AND %s
    """, (f"{workstation}%", start_date, end_date), as_dict=True)

    total = data[0].get("total", 0) if data else 0
    passed = data[0].get("passed", 0) if data else 0
    val = round((passed / total) * 100, 1) if total > 0 else 100.0
    return {"value": val, "target": 98.0, "on_target": val >= 98.0}

@frappe.whitelist()
def get_ws7_kpi2(workstation, period="This Month"):
    start_date, end_date = _get_period_range(period)
    data = frappe.db.sql("""
        SELECT COUNT(qi.name) as total, SUM(CASE WHEN qi.status = 'Accepted' THEN 1 ELSE 0 END) as passed
        FROM `tabQuality Inspection` qi
        INNER JOIN `tabJob Card` jc ON qi.reference_name = jc.name
        WHERE jc.workstation LIKE %s AND qi.docstatus = 1 AND qi.report_date BETWEEN %s AND %s
    """, (f"{workstation}%", start_date, end_date), as_dict=True)

    total = data[0].get("total", 0) if data else 0
    passed = data[0].get("passed", 0) if data else 0
    val = round((passed / total) * 100, 1) if total > 0 else 100.0
    return {"value": val, "target": 100.0, "on_target": val >= 100.0}

@frappe.whitelist()
def get_ws7_kpi1_weekly(workstation):
    return _get_qi_weekly(workstation, default_val=100.0)

@frappe.whitelist()
def get_ws7_kpi2_weekly(workstation):
    return _get_qi_weekly(workstation, default_val=100.0)


# ==========================================
# WS8 CURING OVEN ENDPOINTS
# ==========================================

@frappe.whitelist()
def get_ws8_kpi1(workstation, period="This Month"):
    start_date, end_date = _get_period_range(period)
    data = frappe.db.sql("""
        SELECT COUNT(qi.name) as total, SUM(CASE WHEN qi.status = 'Accepted' THEN 1 ELSE 0 END) as passed
        FROM `tabQuality Inspection` qi
        INNER JOIN `tabJob Card` jc ON qi.reference_name = jc.name
        WHERE jc.workstation LIKE %s AND qi.docstatus = 1 AND qi.report_date BETWEEN %s AND %s
    """, (f"{workstation}%", start_date, end_date), as_dict=True)

    total = data[0].get("total", 0) if data else 0
    passed = data[0].get("passed", 0) if data else 0
    val = round((passed / total) * 100, 1) if total > 0 else 100.0
    return {"value": val, "target": 100.0, "on_target": val >= 100.0}

@frappe.whitelist()
def get_ws8_kpi2(workstation, period="This Month"):
    start_date, end_date = _get_period_range(period)
    data = frappe.db.sql("""
        SELECT COUNT(qi.name) as total, SUM(CASE WHEN qi.status = 'Accepted' THEN 1 ELSE 0 END) as passed
        FROM `tabQuality Inspection` qi
        INNER JOIN `tabJob Card` jc ON qi.reference_name = jc.name
        WHERE jc.workstation LIKE %s AND qi.docstatus = 1 AND qi.report_date BETWEEN %s AND %s
    """, (f"{workstation}%", start_date, end_date), as_dict=True)

    total = data[0].get("total", 0) if data else 0
    passed = data[0].get("passed", 0) if data else 0
    val = round((passed / total) * 100, 1) if total > 0 else 100.0
    return {"value": val, "target": 100.0, "on_target": val >= 100.0}

@frappe.whitelist()
def get_ws8_kpi1_weekly(workstation):
    return _get_qi_weekly(workstation, default_val=100.0)

@frappe.whitelist()
def get_ws8_kpi2_weekly(workstation):
    return _get_qi_weekly(workstation, default_val=100.0)


def _get_qi_weekly(workstation, default_val):
    weeks = _get_weekly_ranges()
    weekly_data = []
    for label, start_d, end_d in weeks:
        # 1. Ye real SQL query chalata hai database par
        res = frappe.db.sql("""
            SELECT
                COUNT(qi.name) as total,
                SUM(CASE WHEN qi.status = 'Accepted' THEN 1 ELSE 0 END) as passed
            FROM `tabQuality Inspection` qi
            INNER JOIN `tabJob Card` jc ON qi.reference_name = jc.name
            WHERE jc.workstation LIKE %s
              AND qi.docstatus = 1
              AND qi.report_date BETWEEN %s AND %s
        """, (f"{workstation}%", start_d, end_d), as_dict=True)

        total = res[0].get("total", 0) if res else 0
        passed = res[0].get("passed", 0) if res else 0

        # 2. Yahan logic check hota hai:
        if total > 0:
            val = round((passed / total) * 100, 1)  # Real SQL calculate hoga
        else:
            val = default_val                       # Tabhi default value use hogi jab total == 0

        weekly_data.append({"label": label, "value": val})
    return weekly_data

# ==========================================
# HELPER FUNCTIONS FOR STRICT DEFAULTS
# ==========================================

def _get_qi_metric(workstation, period="This Month", default_val=100.0, target_val=100.0, is_higher_better=True):
    start_date, end_date = _get_period_range(period)
    data = frappe.db.sql("""
        SELECT 
            COUNT(qi.name) as total, 
            SUM(CASE WHEN qi.status = 'Accepted' THEN 1 ELSE 0 END) as passed
        FROM `tabQuality Inspection` qi
        INNER JOIN `tabJob Card` jc ON qi.reference_name = jc.name
        WHERE jc.workstation LIKE %s 
          AND qi.docstatus = 1 
          AND qi.report_date BETWEEN %s AND %s
    """, (f"{workstation}%", start_date, end_date), as_dict=True)

    total = data[0].get("total", 0) if data else 0
    passed = data[0].get("passed", 0) if data else 0

    if total > 0:
        val = round((passed / total) * 100, 1)
    else:
        val = default_val

    on_target = (val >= target_val) if is_higher_better else (val <= target_val)
    return {"value": val, "target": target_val, "on_target": on_target}


def _get_qi_weekly(workstation, default_val=100.0):
    weeks = _get_weekly_ranges()
    weekly_data = []
    for label, start_d, end_d in weeks:
        res = frappe.db.sql("""
            SELECT 
                COUNT(qi.name) as total, 
                SUM(CASE WHEN qi.status = 'Accepted' THEN 1 ELSE 0 END) as passed
            FROM `tabQuality Inspection` qi
            INNER JOIN `tabJob Card` jc ON qi.reference_name = jc.name
            WHERE jc.workstation LIKE %s 
              AND qi.docstatus = 1 
              AND qi.report_date BETWEEN %s AND %s
        """, (f"{workstation}%", start_d, end_d), as_dict=True)

        total = res[0].get("total", 0) if res else 0
        passed = res[0].get("passed", 0) if res else 0
        val = round((passed / total) * 100, 1) if total > 0 else default_val
        weekly_data.append({"label": label, "value": val})
    return weekly_data


# ==========================================
# WS9 ASSEMBLY BAY ENDPOINTS
# ==========================================
@frappe.whitelist()
def get_ws9_kpi1(workstation, period="This Month"):
    return _get_qi_metric(workstation, period, default_val=100.0, target_val=97.0)

@frappe.whitelist()
def get_ws9_kpi2(workstation, period="This Month"):
    return _get_qi_metric(workstation, period, default_val=100.0, target_val=98.0)

@frappe.whitelist()
def get_ws9_kpi1_weekly(workstation):
    return _get_qi_weekly(workstation, default_val=100.0)

@frappe.whitelist()
def get_ws9_kpi2_weekly(workstation):
    return _get_qi_weekly(workstation, default_val=100.0)


# ==========================================
# WS10 COMPONENT INSTALLATION ENDPOINTS
# ==========================================
@frappe.whitelist()
def get_ws10_kpi1(workstation, period="This Month"):
    return _get_qi_metric(workstation, period, default_val=100.0, target_val=100.0)

@frappe.whitelist()
def get_ws10_kpi2(workstation, period="This Month"):
    return _get_qi_metric(workstation, period, default_val=100.0, target_val=99.0)

@frappe.whitelist()
def get_ws10_kpi1_weekly(workstation):
    return _get_qi_weekly(workstation, default_val=100.0)

@frappe.whitelist()
def get_ws10_kpi2_weekly(workstation):
    return _get_qi_weekly(workstation, default_val=100.0)


# ==========================================
# WS11 WIRING STATION ENDPOINTS
# ==========================================
@frappe.whitelist()
def get_ws11_kpi1(workstation, period="This Month"):
    return _get_qi_metric(workstation, period, default_val=100.0, target_val=97.0)

@frappe.whitelist()
def get_ws11_kpi2(workstation, period="This Month"):
    return _get_qi_metric(workstation, period, default_val=100.0, target_val=100.0)

@frappe.whitelist()
def get_ws11_kpi1_weekly(workstation):
    return _get_qi_weekly(workstation, default_val=100.0)

@frappe.whitelist()
def get_ws11_kpi2_weekly(workstation):
    return _get_qi_weekly(workstation, default_val=100.0)


# ==========================================
# WS12 PRE-ROUTINE QA ENDPOINTS
# ==========================================
@frappe.whitelist()
def get_ws12_kpi1(workstation, period="This Month"):
    return _get_qi_metric(workstation, period, default_val=100.0, target_val=98.0)

@frappe.whitelist()
def get_ws12_kpi2(workstation, period="This Month"):
    # Defect Escape Target <= 1.0%; Default is 0.0% when no defects logged
    return _get_qi_metric(workstation, period, default_val=0.0, target_val=1.0, is_higher_better=False)

@frappe.whitelist()
def get_ws12_kpi1_weekly(workstation):
    return _get_qi_weekly(workstation, default_val=100.0)

@frappe.whitelist()
def get_ws12_kpi2_weekly(workstation):
    return _get_qi_weekly(workstation, default_val=0.0)


# ==========================================
# WS13 TEST BAY ENDPOINTS
# ==========================================
@frappe.whitelist()
def get_ws13_kpi1(workstation, period="This Month"):
    return _get_qi_metric(workstation, period, default_val=100.0, target_val=98.0)

@frappe.whitelist()
def get_ws13_kpi2(workstation, period="This Month"):
    return _get_qi_metric(workstation, period, default_val=100.0, target_val=100.0)

@frappe.whitelist()
def get_ws13_kpi1_weekly(workstation):
    return _get_qi_weekly(workstation, default_val=100.0)

@frappe.whitelist()
def get_ws13_kpi2_weekly(workstation):
    return _get_qi_weekly(workstation, default_val=100.0)


# ==========================================
# WS14 FINAL FINISH & STAGING ENDPOINTS
# ==========================================
@frappe.whitelist()
def get_ws14_kpi1(workstation, period="This Month"):
    return _get_qi_metric(workstation, period, default_val=100.0, target_val=100.0)

@frappe.whitelist()
def get_ws14_kpi2(workstation, period="This Month"):
    return _get_qi_metric(workstation, period, default_val=100.0, target_val=95.0)

@frappe.whitelist()
def get_ws14_kpi1_weekly(workstation):
    return _get_qi_weekly(workstation, default_val=100.0)

@frappe.whitelist()
def get_ws14_kpi2_weekly(workstation):
    return _get_qi_weekly(workstation, default_val=100.0)

@frappe.whitelist()
def get_station_actions(workstation="WS1 — Production Planning Office"):
    result = []

    # Source 1: Quality Actions (open corrective/preventive actions)
    quality_actions = frappe.get_all(
        "Quality Action",
        filters={"custom_workstation": workstation, "status": "Open"},
        fields=["name", "corrective_preventive", "date"],
        order_by="date desc",
    )
    for a in quality_actions:
        result.append({
            "type": a.corrective_preventive or "Quality Action",
            "date": frappe.utils.formatdate(a.date) if a.date else "-",
            "ref": a.name,
        })

    # Source 2: TAT Exceptions (Job Cards completed but over their target TAT)
    exceeded_jobs = frappe.get_all(
        "Job Card",
        filters={"workstation": workstation, "status": "Completed"},
        fields=["name", "actual_start_date", "actual_end_date", "expected_start_date", "expected_end_date"],
    )
    for jc in exceeded_jobs:
        if not (jc.actual_start_date and jc.actual_end_date and jc.expected_start_date and jc.expected_end_date):
            continue
        target_days = frappe.utils.time_diff_in_hours(jc.expected_end_date, jc.expected_start_date) / 24 or 1
        actual_days = frappe.utils.time_diff_in_hours(jc.actual_end_date, jc.actual_start_date) / 24
        if actual_days > target_days:
            result.append({
                "type": "TAT Exception",
                "date": frappe.utils.formatdate(jc.actual_end_date),
                "ref": jc.name,
            })

    return result

@frappe.whitelist()
def get_workstation_active_counts():
    """
    For each Work Order, only the earliest-sequence non-completed Job Card
    represents where the panel truly is right now. Counts and overdue flags
    are computed per workstation based on that single active Job Card only —
    downstream Job Cards that are technically 'Open' but blocked by an
    incomplete upstream step are NOT counted here.
    """
    from collections import defaultdict

    now = frappe.utils.now_datetime()

    open_cards = frappe.get_all(
        "Job Card",
        filters={"status": ["!=", "Completed"]},
        fields=["name", "work_order", "workstation", "sequence_id", "expected_end_date"],
    )

    by_wo = defaultdict(list)
    standalone = []

    for jc in open_cards:
        if jc.work_order:
            by_wo[jc.work_order].append(jc)
        else:
            standalone.append(jc)

    counts = defaultdict(int)
    overdue = defaultdict(int)

    for wo, cards in by_wo.items():
        cards_sorted = sorted(cards, key=lambda c: c.sequence_id or 0)
        active = cards_sorted[0]
        if not active.workstation:
            continue
        ws_code = active.workstation.split(" ")[0]
        counts[ws_code] += 1
        if active.expected_end_date and frappe.utils.get_datetime(active.expected_end_date) < now:
            overdue[ws_code] += 1

    for jc in standalone:
        if not jc.workstation:
            continue
        ws_code = jc.workstation.split(" ")[0]
        counts[ws_code] += 1
        if jc.expected_end_date and frappe.utils.get_datetime(jc.expected_end_date) < now:
            overdue[ws_code] += 1

    return {"counts": dict(counts), "overdue": dict(overdue)}
