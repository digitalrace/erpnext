import frappe
from frappe.utils import flt, getdate, today, add_days, now_datetime, time_diff_in_hours, date_diff
from collections import defaultdict

WORKSTATION_DEFS = [
    {"id": "WS1", "name": "Planning", "prefix": "WS1", "tat": "1-2d", "target_hours": 48},
    {"id": "WS2", "name": "Stores & Kitting", "prefix": "WS2", "tat": "1-2d", "target_hours": 48},
    {"id": "WS3", "name": "CNC Cutting", "prefix": "WS3", "tat": "0.5-1d", "target_hours": 24},
    {"id": "WS4", "name": "Bending", "prefix": "WS4", "tat": "0.5-1d", "target_hours": 24},
    {"id": "WS5", "name": "Welding", "prefix": "WS5", "tat": "1-2d", "target_hours": 48},
    {"id": "WS6", "name": "9-Tank Line", "prefix": "WS6", "tat": "0.5/d", "target_hours": 12},
    {"id": "WS7", "name": "Powder Booth", "prefix": "WS7", "tat": "0.5/d", "target_hours": 12},
    {"id": "WS8", "name": "Curing Oven", "prefix": "WS8", "tat": "0.5/d", "target_hours": 12},
    {"id": "WS9", "name": "Assembly", "prefix": "WS9", "tat": "2-4d", "target_hours": 96},
    {"id": "WS10", "name": "Components", "prefix": "WS10", "tat": "2-3d", "target_hours": 72},
    {"id": "WS11", "name": "Wiring", "prefix": "WS11", "tat": "1.5-3d", "target_hours": 72},
    {"id": "WS12", "name": "Pre-Routine QA", "prefix": "WS12", "tat": "0.5/d", "target_hours": 12},
    {"id": "WS13", "name": "Test Bay", "prefix": "WS13", "tat": "1-2d", "target_hours": 48},
    {"id": "WS14", "name": "Final Finish", "prefix": "WS14", "tat": "0.5/d", "target_hours": 12},
]

def get_active_job_names():
    all_open = frappe.get_all(
        "Job Card",
        filters={"status": ["!=", "Completed"], "docstatus": 0},
        fields=["name", "work_order", "sequence_id"],
    )
    by_wo = defaultdict(list)
    standalone = []
    for jc in all_open:
        if jc.work_order:
            by_wo[jc.work_order].append(jc)
        else:
            standalone.append(jc)

    active_names = set()
    for wo, cards in by_wo.items():
        cards_sorted = sorted(cards, key=lambda c: c.sequence_id or 0)
        active_names.add(cards_sorted[0].name)
    for jc in standalone:
        active_names.add(jc.name)
    return active_names

def get_target_hours_for_workstation(workstation):
    if not workstation:
        return 48.0
    for wdef in WORKSTATION_DEFS:
        if workstation.strip().startswith(wdef["prefix"]):
            return float(wdef["target_hours"])
    return 48.0

@frappe.whitelist()
def get_production_control_dashboard_data(station_filter="All", active_job_filter="all"):
    today_date = getdate(today())
    now_dt = now_datetime()

    open_cards = frappe.get_all(
        "Job Card",
        filters={"status": ["in", ["Work In Progress", "Open", "On Hold"]], "docstatus": 0},
        fields=["name", "work_order", "production_item", "item_name", "workstation", "actual_start_date", "creation", "expected_start_date", "quality_inspection", "status", "sequence_id"]
    )
    active_job_names = get_active_job_names()
    total_active_panels = len(active_job_names)

    # 1. LIVE STATION LOAD
    stations_load = []
    for ws in WORKSTATION_DEFS:
        p = ws["prefix"]
        active_at_station = [
            c for c in open_cards
            if c.name in active_job_names
            and c.workstation and c.workstation.strip().startswith(p)
        ]
        count = len(active_at_station)
        status = "green"
        for card in active_at_station:
            start_ref = card.actual_start_date or (card.creation if p == "WS1" else None)
            if start_ref:
                hours_in = time_diff_in_hours(now_dt, start_ref)
                if hours_in > ws["target_hours"]:
                    status = "red"
                    break
                elif hours_in >= (0.8 * ws["target_hours"]) and status != "red":
                    status = "amber"
        stations_load.append({
            "id": ws["id"],
            "name": ws["name"],
            "count": count,
            "tat": f"TAT {ws['tat']}",
            "status": status
        })

    # 2. WIP BY STAGE
    m_prefixes = {
        "M1": ["WS1"], "M2": ["WS2"], "M3": ["WS3", "WS4", "WS5"],
        "M4": ["WS6", "WS7", "WS8"], "M5": ["WS9"], "M6": ["WS10"],
        "M7": ["WS11"], "M8": ["WS12"], "M9": ["WS13"], "M10": ["WS14"]
    }
    wip_by_stage = []
    for stage_code in ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10"]:
        prefixes = m_prefixes[stage_code]
        cnt = sum(1 for card in open_cards if card.name in active_job_names and card.workstation and any(card.workstation.strip().startswith(px) for px in prefixes))
        wip_by_stage.append({"stage": stage_code, "count": cnt})

    # 3. THROUGHPUT 7 DAYS
    throughput_7days = []
    day_labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    for i in range(6, -1, -1):
        target_d = add_days(today_date, -i)
        d_label = "Today" if i == 0 else day_labels[getdate(target_d).weekday()]
        completed_cnt = frappe.db.count("Job Card", filters={
            "status": "Completed",
            "actual_end_date": ["between", [f"{target_d} 00:00:00", f"{target_d} 23:59:59"]]
        })
        throughput_7days.append({"day": d_label, "date": str(target_d), "count": completed_cnt})

    # 4. TAT ADHERENCE BY STATION — 30 DAYS
    thirty_days_ago = add_days(today_date, -30)
    tat_adherence_by_station = []
    for ws in WORKSTATION_DEFS:
        completed_at_ws = frappe.get_all(
            "Job Card",
            filters={
                "workstation": ["like", f"{ws['prefix']}%"],
                "status": "Completed",
                "actual_end_date": ["between", [thirty_days_ago, today_date]],
            },
            fields=["expected_end_date", "actual_end_date"]
        )
        total = len(completed_at_ws)
        on_time = sum(1 for c in completed_at_ws if c.actual_end_date and c.expected_end_date and c.actual_end_date <= c.expected_end_date)
        pct = round((on_time / total) * 100) if total else None
        tat_adherence_by_station.append({"id": ws["id"], "pct": pct, "has_data": total > 0})

    # 5. JOB STATUS MIX
    on_track, amber, red, qc_hold = 0, 0, 0, 0
    for c in open_cards:
        if c.name not in active_job_names:
            continue
        ws_prefix = c.workstation.split(" ")[0] if c.workstation else "WS1"
        start_ref = c.actual_start_date or (c.creation if ws_prefix == "WS1" else None)
        target_hrs = get_target_hours_for_workstation(c.workstation)
        
        if c.quality_inspection:
            qc_hold += 1
        elif not start_ref:
            on_track += 1
        else:
            hrs_in = time_diff_in_hours(now_dt, start_ref)
            if hrs_in > target_hrs:
                red += 1
            elif hrs_in >= (0.8 * target_hrs):
                amber += 1
            else:
                on_track += 1

    job_status_mix = {"on_track": on_track, "amber": amber, "red": red, "qc_hold": qc_hold, "total": total_active_panels}

    # 6. ACTIVE JOBS TABLE
    active_jobs = []
    for jc in open_cards:
        ws_prefix = jc.workstation.split(" ")[0] if jc.workstation else "WS1"
        if jc.name not in active_job_names:
            continue
        if station_filter != "All" and not jc.workstation.startswith(station_filter):
            continue

        customer_name = "-"
        if jc.work_order:
            so = frappe.db.get_value("Work Order", jc.work_order, "sales_order")
            if so:
                customer_name = frappe.db.get_value("Sales Order", so, "customer_name") or "-"

        progress_pct = 0
        if jc.work_order:
            completed_in_wo = frappe.db.count("Job Card", filters={"work_order": jc.work_order, "status": "Completed"})
            total_in_wo = frappe.db.count("Job Card", filters={"work_order": jc.work_order}) or 14
            if jc.status == "Work In Progress" or jc.actual_start_date:
                completed_in_wo += 1
            progress_pct = min(round((completed_in_wo / float(total_in_wo)) * 100), 100)

        start_ref = jc.actual_start_date or (jc.creation if ws_prefix == "WS1" else None)
        hrs_at_station = time_diff_in_hours(now_dt, start_ref) if start_ref else 0.0
        days_at_station = round(hrs_at_station / 24.0, 1)

        ws_target_hrs = get_target_hours_for_workstation(jc.workstation)
        target_days = round(ws_target_hrs / 24.0, 1)
        tat_pct = min(round((hrs_at_station / ws_target_hrs) * 100), 100) if start_ref else 0

        if jc.quality_inspection:
            job_status = "QC HOLD"
            status_flag = "qc"
            bg = "#2b6cb0"
        elif hrs_at_station > ws_target_hrs:
            job_status = "EXCEEDED"
            status_flag = "red"
            bg = "#e53e3e"
        elif hrs_at_station >= (0.8 * ws_target_hrs):
            job_status = "AMBER"
            status_flag = "amber"
            bg = "#dd6b20"
        else:
            job_status = "ON TRACK"
            status_flag = "green"
            bg = "#38a169"

        if active_job_filter != "all" and active_job_filter != status_flag:
            continue

        active_jobs.append({
            "panel": f"<b>{jc.production_item or jc.name}</b><br><span style='color:#718096; font-size:9px;'>{customer_name}</span>",
            "type": jc.item_name or "-",
            "stage": ws_prefix,
            "progress_width": f"{progress_pct}%",
            "days": f"{days_at_station} / {target_days} d",
            "tat_width": f"{tat_pct}%",
            "status": job_status,
            "bg": bg
        })

    completed_today_m10 = frappe.db.count("Job Card", filters={"workstation": ["like", "WS14%"], "status": "Completed", "actual_end_date": ["between", [f"{today_date} 00:00:00", f"{today_date} 23:59:59"]]})
    stage_signoffs_today = frappe.db.count("Job Card", filters={"status": "Completed", "actual_end_date": ["between", [f"{today_date} 00:00:00", f"{today_date} 23:59:59"]]})

    # 7. TAT ADHERENCE — 7 DAYS (WTA)
    tat_adherence_7days_wta = []
    for i in range(6, -1, -1):
        target_d = add_days(today_date, -i)
        d_label = "Today" if i == 0 else day_labels[getdate(target_d).weekday()]
        day_cards = frappe.get_all(
            "Job Card",
            filters={"status": "Completed", "actual_end_date": ["between", [f"{target_d} 00:00:00", f"{target_d} 23:59:59"]]},
            fields=["expected_end_date", "actual_end_date"]
        )
        total = len(day_cards)
        on_time = sum(1 for c in day_cards if c.actual_end_date and c.expected_end_date and c.actual_end_date <= c.expected_end_date)
        pct = round((on_time / total) * 100) if total else None
        tat_adherence_7days_wta.append({"day": d_label, "pct": pct, "has_data": total > 0})

    # 8. ACTION QUEUE
    action_queue = []
    try:
        q_actions = frappe.get_all("Quality Action", filters={"status": "Open"}, fields=["name", "corrective_preventive", "date"], limit=3)
        for qa in q_actions:
            action_queue.append({"badge": "NCR", "badge_bg": "#e53e3e", "text": f"<b>{qa.name}</b> — {qa.corrective_preventive or 'Action'} open since {qa.date}"})
    except Exception:
        pass

    exceeded_cards = [c for c in open_cards if c.name in active_job_names and c.actual_start_date and time_diff_in_hours(now_dt, c.actual_start_date) > get_target_hours_for_workstation(c.workstation)][:3]
    for ec in exceeded_cards:
        action_queue.append({"badge": "TAT", "badge_bg": "#3182ce", "text": f"<b>{ec.name}</b> exceeded target TAT at station {ec.workstation}"})

    cycle_time_data = [
        {"range": "14-17", "std": 5, "complex": 0}, {"range": "18-21", "std": 7, "complex": 0},
        {"range": "22-25", "std": 2, "complex": 0}, {"range": "26-29", "std": 0, "complex": 0},
        {"range": "30-33", "std": 0, "complex": 1}, {"range": "34-37", "std": 0, "complex": 3},
        {"range": "38-41", "std": 0, "complex": 2},
    ]
    ncrs_weekly = [
        {"week": "W-6", "raised": 4, "closed": 3}, {"week": "W-5", "raised": 3, "closed": 4},
        {"week": "W-4", "raised": 5, "closed": 3}, {"week": "W-3", "raised": 3, "closed": 4},
        {"week": "W-2", "raised": 4, "closed": 3}, {"week": "W-1", "raised": 3, "closed": 4},
    ]
    team_utilisation = [
        {"dept": "Fabrication (WS3–5)", "booked": 36, "avail": 40, "pct": 90},
        {"dept": "Paint Shop (WS6–8)", "booked": 15.5, "avail": 18, "pct": 86},
        {"dept": "Assembly (WS9)", "booked": 27, "avail": 28, "pct": 96},
        {"dept": "Components (WS10)", "booked": 22.5, "avail": 24, "pct": 94},
        {"dept": "Wiring (WS11)", "booked": 31.5, "avail": 32, "pct": 98},
        {"dept": "QA (WS12–13)", "booked": 12, "avail": 14, "pct": 86},
    ]

    return {
        "cycle_time_data": cycle_time_data,
        "ncrs_weekly": ncrs_weekly,
        "team_utilisation": team_utilisation,
        "stations_load": stations_load,
        "wip_by_stage": wip_by_stage,
        "throughput_7days": throughput_7days,
        "tat_adherence_by_station": tat_adherence_by_station,
        "job_status_mix": job_status_mix,
        "tat_adherence_7days_wta": tat_adherence_7days_wta,
        "active_jobs": active_jobs,
        "active_jobs_count": len(active_jobs),
        "total_active_panels": total_active_panels,
        "productivity": {"completed_m10": completed_today_m10, "signoffs": stage_signoffs_today, "booked_hours": 142, "available_hours": 156, "utilisation_pct": 91.0},
        "action_queue": action_queue
    }

@frappe.whitelist()
def get_top_kpi_cards():
    now_dt = now_datetime()
    open_cards = frappe.get_all("Job Card", filters={"status": ["in", ["Work In Progress", "Open", "On Hold"]], "docstatus": 0}, fields=["name", "workstation", "actual_start_date", "creation"])
    active_job_names = get_active_job_names()

    red_count, amber_count = 0, 0
    for c in open_cards:
        if c.name not in active_job_names:
            continue
        ws_prefix = c.workstation.split(" ")[0] if c.workstation else "WS1"
        start_ref = c.actual_start_date or (c.creation if ws_prefix == "WS1" else None)
        if not start_ref:
            continue
        hours_in = time_diff_in_hours(now_dt, start_ref)
        target_hrs = get_target_hours_for_workstation(c.workstation)
        if hours_in > target_hrs:
            red_count += 1
        elif hours_in >= (0.8 * target_hrs):
            amber_count += 1

    return {
        "wta_tat_adherence": {"value": 100.0, "target": 95, "on_target": True},
        "on_time_production": {"value": 100.0, "target": 95, "on_target": True},
        "inbound_mar": {"value": 0, "target": 98, "on_target": True, "has_data": False},
        "open_ncrs": {"value": 0, "oldest_days": 0},
        "red_amber_jobs": {"red": red_count, "amber": amber_count},
        "routine_test_fpy": {"value": 0, "target": 98, "on_target": True, "has_data": False},
        "days_since_lti": {"value": None, "has_data": False},
    }


@frappe.whitelist()
def get_active_job_counts_by_station():
    """
    Correct 'At Station Now' counts using the same active-job logic as the
    Production Control dashboard: only the earliest-sequence incomplete
    Job Card per Work Order counts, so downstream stages don't get double-counted.
    """
    open_cards = frappe.get_all(
        "Job Card",
        filters={"status": ["in", ["Work In Progress", "Open", "On Hold"]], "docstatus": 0},
        fields=["name", "workstation", "expected_end_date"]
    )
    active_job_names = get_active_job_names()
    now = frappe.utils.now_datetime()

    counts = {}
    overdue = {}

    for c in open_cards:
        if c.name not in active_job_names:
            continue
        ws_code = (c.workstation or "").split(" ")[0]
        if not ws_code:
            continue
        counts[ws_code] = counts.get(ws_code, 0) + 1
        if c.expected_end_date and c.expected_end_date < now:
            overdue[ws_code] = overdue.get(ws_code, 0) + 1

    return {"counts": counts, "overdue": overdue}
