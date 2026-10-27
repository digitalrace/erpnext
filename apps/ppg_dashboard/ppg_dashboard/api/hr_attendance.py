import frappe
from frappe.utils import add_days, date_diff, flt, get_first_day, getdate, nowdate

ROLES = ["HR Manager", "HR User", "System Manager"]


def _has(dt, fieldname):
    try:
        return any(f.fieldname == fieldname for f in frappe.get_meta(dt).fields)
    except Exception:
        return False


def _mins(t):
    if t is None:
        return None
    if hasattr(t, "total_seconds"):
        return t.total_seconds() / 60
    if hasattr(t, "hour"):
        return t.hour * 60 + t.minute + t.second / 60
    try:
        p = str(t).split(":")
        return int(p[0]) * 60 + int(p[1])
    except Exception:
        return None


def _dept(name):
    if not name:
        return "No department"
    head, _, tail = name.rpartition(" - ")
    return head if head and tail.isupper() and len(tail) <= 8 else name


@frappe.whitelist()
def get_hr_dashboard(as_of_date=None):
    frappe.only_for(ROLES)
    real_today = getdate(nowdate())
    end = min(getdate(as_of_date or nowdate()), real_today)
    month_start = get_first_day(end)
    rstart = min(month_start, add_days(end, -24))
    sql = frappe.db.sql

    # ---------- employees ----------
    ef = [f for f in ("name", "employee_name", "department", "status", "date_of_joining", "relieving_date",
                      "default_shift", "holiday_list", "company", "final_confirmation_date", "contract_end_date")
          if f == "name" or _has("Employee", f)]
    emps = frappe.get_all("Employee", filters={"date_of_joining": ["<=", end]}, fields=ef, limit_page_length=0)
    for e in emps:
        for k in ef:
            e.setdefault(k, None)

    def active_on(e, d):
        j, r = e.date_of_joining, e.relieving_date
        if not j or getdate(j) > d:
            return False
        if r and getdate(r) < d:
            return False
        return e.status == "Active" or bool(r and getdate(r) >= d)

    # ---------- check-ins, leave, holidays, shifts ----------
    # A check-in counts for the day only when its log type is IN. An OUT after midnight (night overtime)
    # belongs to the previous day's shift and must not make the next day look present.
    ck = {}
    for r in sql("""select employee, date(`time`) d, min(`time`) ft from `tabEmployee Checkin`
                    where `time` >= %s and `time` < %s and log_type = 'IN' group by employee, date(`time`)""",
                 (rstart, add_days(end, 1)), as_dict=True):
        ck[(r.employee, getdate(r.d))] = r.ft
    # logs saved without a type: use them only when they are not in the small hours (03:00 and later)
    for r in sql("""select employee, date(`time`) d, min(`time`) ft from `tabEmployee Checkin`
                    where `time` >= %s and `time` < %s and (log_type is null or log_type = '') and time(`time`) >= '03:00:00'
                    group by employee, date(`time`)""", (rstart, add_days(end, 1)), as_dict=True):
        ck.setdefault((r.employee, getdate(r.d)), r.ft)
    last_seen = {r.employee: getdate(r.d) for r in sql(
        """select employee, max(d) d from (select employee, date(`time`) d from `tabEmployee Checkin`
           where `time` < %s and (log_type = 'IN' or ((log_type is null or log_type = '') and time(`time`) >= '03:00:00'))) t
           group by employee""", (add_days(end, 1),), as_dict=True)}

    # Attendance records (marked after the day). When one exists it is the source of truth for that employee and day.
    att = {}
    if frappe.db.exists("DocType", "Attendance"):
        af = ["employee", "attendance_date", "status", "leave_type"] + [f for f in ("in_time", "late_entry") if _has("Attendance", f)]
        for a in frappe.get_all("Attendance", filters={"docstatus": 1, "attendance_date": ["between", [rstart, end]]},
                                fields=af, limit_page_length=0):
            att[(a.employee, getdate(a.attendance_date))] = a

    leave_info = {}
    for l in frappe.get_all("Leave Application",
                            filters={"status": "Approved", "docstatus": 1, "from_date": ["<=", end], "to_date": [">=", rstart]},
                            fields=["employee", "leave_type", "from_date", "to_date", "half_day", "half_day_date"], limit_page_length=0):
        d, to = max(getdate(l.from_date), rstart), min(getdate(l.to_date), end)
        while d <= to:
            if not (l.half_day and l.half_day_date and getdate(l.half_day_date) == d):
                leave_info[(l.employee, d)] = {"type": l.leave_type, "from": str(l.from_date), "to": str(l.to_date)}
            d = add_days(d, 1)

    default_hl = {c: frappe.db.get_value("Company", c, "default_holiday_list") for c in {e.company for e in emps if e.company}}
    hl_of = lambda e: e.holiday_list or default_hl.get(e.company)
    hol = {}
    for hl in {hl_of(e) for e in emps} - {None, ""}:
        hol[hl] = {getdate(r[0]): r[1] for r in sql(
            "select holiday_date, description from `tabHoliday` where parent=%s and holiday_date between %s and %s", (hl, rstart, end))}
    counts = {}
    for e in emps:
        if hl_of(e):
            counts[hl_of(e)] = counts.get(hl_of(e), 0) + 1
    main_hl = max(counts, key=counts.get) if counts else None
    is_off = lambda e, d: bool(hl_of(e) and d in hol.get(hl_of(e), {}))
    holiday_desc = hol.get(main_hl, {}).get(end) if main_hl else None

    try:
        stypes = {s.name: (_mins(s.start_time), int(s.late_entry_grace_period or 0)) for s in frappe.get_all(
            "Shift Type", fields=["name", "start_time", "late_entry_grace_period"], limit_page_length=0)}
        assigns = {}
        for a in frappe.get_all("Shift Assignment", filters={"docstatus": 1, "status": "Active", "start_date": ["<=", end]},
                                fields=["employee", "shift_type", "start_date", "end_date"], limit_page_length=0):
            assigns.setdefault(a.employee, []).append(a)
    except Exception:
        stypes, assigns = {}, {}

    def shift_of(e, d):
        for a in assigns.get(e.name, []):
            if getdate(a.start_date) <= d and (not a.end_date or getdate(a.end_date) >= d):
                return stypes.get(a.shift_type)
        return stypes.get(e.default_shift) if e.default_shift else None

    def late_min(e, d, ft):
        """None if no shift is known, else minutes late beyond shift start (0 if on time or within grace)."""
        sh = shift_of(e, d)
        if not sh or sh[0] is None:
            return None
        fm = ft.hour * 60 + ft.minute + ft.second / 60
        return round(fm - sh[0]) if fm - sh[0] - sh[1] > 0 else 0

    def first_time(e, d):
        ft = ck.get((e.name, d))
        if ft:
            return ft
        a = att.get((e.name, d))
        return a.get("in_time") if a else None

    def status(e, d):
        """(status, source). Today: Employee Checkin. Earlier days: submitted Attendance only."""
        if d == real_today:
            if (e.name, d) in ck:
                return "present", "Check-in"
            if (e.name, d) in leave_info:
                return "leave", "Leave application"
            if is_off(e, d):
                return "off", "Holiday"
            return "absent", "No check-in"
        a = att.get((e.name, d))
        if a:
            if a.status in ("Present", "Work From Home", "Half Day"):
                return "present", "Attendance"
            if a.status == "On Leave":
                return "leave", "Attendance"
            if a.status == "Absent":
                return "absent", "Attendance"
        if is_off(e, d):
            return "off", "Holiday"
        return "unmarked", "No attendance record"

    has_late_flag = _has("Attendance", "late_entry")

    def late_of(e, d):
        """(known, late, minutes). Earlier days use the Attendance late_entry flag when the field exists."""
        ft = first_time(e, d)
        lm = late_min(e, d, ft) if ft else None
        mins = lm if lm and lm > 0 else None
        if d != real_today and has_late_flag:
            r = att.get((e.name, d))
            return True, bool(r and r.get("late_entry")), mins
        return lm is not None, bool(mins), mins

    # ---------- the viewed day ----------
    days_mtd = []
    d = month_start
    while d <= end:
        days_mtd.append(d)
        d = add_days(d, 1)

    people, dept = [], {}
    act_today = [e for e in emps if active_on(e, end)]
    late_known = late_count = 0
    for e in act_today:
        st, src = status(e, end)
        ft = first_time(e, end) if st == "present" else None
        known, lflag, lmin = late_of(e, end) if st == "present" else (False, False, None)
        abs_mtd = late_mtd = 0
        for dd in days_mtd:
            if not active_on(e, dd):
                continue
            s2 = status(e, dd)[0]
            if s2 == "absent":
                abs_mtd += 1
            elif s2 == "present":
                if late_of(e, dd)[1]:
                    late_mtd += 1
        late_known += 1 if known else 0
        late_count += 1 if lflag else 0
        dn = _dept(e.department)
        g = dept.setdefault(dn, {"department": dn, "staff": 0, "present": 0, "absent": 0, "late": 0, "leave": 0, "off": 0, "unmarked": 0})
        g["staff"] += 1
        g[st] += 1
        g["late"] += 1 if lflag else 0
        a_row = att.get((e.name, end))
        li = leave_info.get((e.name, end)) if st == "leave" else None
        note = {"Work From Home": "Work from home", "Half Day": "Half day"}.get(a_row.status, "") if a_row else ""
        people.append({"id": e.name, "name": e.employee_name or e.name, "department": dn, "status": st,
                       "source": src, "note": note,
                       "leave_type": ((a_row.get("leave_type") if a_row else None) or (li or {}).get("type") or "") if st == "leave" else "",
                       "leave_from": (li or {}).get("from", ""), "leave_to": (li or {}).get("to", ""),
                       "first_in": ft.strftime("%H:%M") if ft else "", "late": lflag, "late_known": known, "late_min": lmin,
                       "abs_mtd": abs_mtd, "late_mtd": late_mtd,
                       "last_present": str(last_seen[e.name]) if e.name in last_seen else ""})

    n = {k: sum(1 for p in people if p["status"] == k) for k in ("present", "absent", "leave", "off", "unmarked")}
    expected = n["present"] + n["absent"]

    # ---------- month attendance and 12-day trend ----------
    m_present = m_exp = 0
    per_day = {}
    for dd in days_mtd + [add_days(end, -i) for i in range(1, 25) if add_days(end, -i) < month_start]:
        pr = ex = 0
        for e in emps:
            if not active_on(e, dd):
                continue
            s2 = status(e, dd)[0]
            pr += s2 == "present"
            ex += s2 in ("present", "absent")
        per_day[dd] = (pr, ex)
        if dd >= month_start:
            m_present += pr
            m_exp += ex
    trend, dd = [], end
    while len(trend) < 12 and dd >= rstart:
        pr, ex = per_day.get(dd, (0, 0))
        if ex:
            trend.append({"date": str(dd), "label": dd.strftime("%-d %b"), "pct": round(pr / ex * 100, 1)})
        dd = add_days(dd, -1)
    trend.reverse()

    # ---------- leave waiting, movement, payroll, money ----------
    lw = frappe.get_all("Leave Application", filters={"status": "Open", "docstatus": ["<", 2]},
                        fields=["name", "employee", "employee_name", "leave_type", "from_date", "to_date", "posting_date"],
                        order_by="posting_date asc", limit_page_length=0)
    leave_wait = [{"name": l.name, "employee": l.employee_name or l.employee, "type": l.leave_type,
                   "from": str(l.from_date), "to": str(l.to_date),
                   "waiting": date_diff(end, l.posting_date) if l.posting_date else 0} for l in lw]

    soon = add_days(end, 30)
    in_range = lambda v, a, b: bool(v) and a <= getdate(v) <= b
    movement = {
        "joined": sum(1 for e in emps if in_range(e.date_of_joining, month_start, end)),
        "left": sum(1 for e in emps if in_range(e.relieving_date, month_start, end)),
        "probation": sum(1 for e in emps if e.status == "Active" and in_range(e.final_confirmation_date, end, soon)),
        "contract": sum(1 for e in emps if e.status == "Active" and in_range(e.contract_end_date, end, soon)),
        "openings": 0}
    try:
        if frappe.db.exists("DocType", "Job Opening"):
            movement["openings"] = frappe.db.count("Job Opening", {"status": "Open"})
    except Exception:
        pass

    payroll = None
    try:
        m_end = add_days(month_start, -1)
        m_start = get_first_day(m_end)
        slips = frappe.get_all("Salary Slip", filters={"start_date": [">=", m_start], "end_date": ["<=", m_end], "docstatus": ["<", 2]},
                               fields=["docstatus", "net_pay"], limit_page_length=0)
        if slips:
            payroll = {"month": m_start.strftime("%B"), "submitted": sum(1 for s in slips if s.docstatus == 1),
                       "draft": sum(1 for s in slips if s.docstatus == 0),
                       "net": sum(flt(s.net_pay) for s in slips if s.docstatus == 1)}
    except Exception:
        payroll = None

    money = {"claims": 0, "claims_amount": 0.0, "advances": 0, "advances_amount": 0.0}
    try:
        ec = frappe.get_all("Expense Claim", filters={"docstatus": 0}, fields=["total_claimed_amount"], limit_page_length=0)
        money["claims"], money["claims_amount"] = len(ec), sum(flt(x.total_claimed_amount) for x in ec)
        ea = frappe.get_all("Employee Advance", filters={"docstatus": 0}, fields=["advance_amount"], limit_page_length=0)
        money["advances"], money["advances_amount"] = len(ea), sum(flt(x.advance_amount) for x in ea)
    except Exception:
        pass

    repeated = sum(1 for p in people if p["abs_mtd"] >= 3)
    return {
        "date": str(end), "month_start": str(month_start),
        "holiday": holiday_desc or ("Holiday" if (n["off"] and not n["present"] and not n["absent"]) else None),
        "summary": {"active": len(people), "present": n["present"], "absent": n["absent"], "leave": n["leave"], "off": n["off"],
                    "pct": round(n["present"] / expected * 100, 1) if expected else None,
                    "pct_month": round(m_present / m_exp * 100, 1) if m_exp else None,
                    "late": late_count if late_known else None, "late_known": late_known,
                    "repeated": repeated,
                    "live": end == real_today, "marked": n["present"] + n["absent"] + n["leave"], "unmarked": n["unmarked"]},
        "departments": sorted(dept.values(), key=lambda g: (-g["absent"], -g["staff"])),
        "trend": trend, "people": people, "leave_wait": leave_wait[:8],
        "leave_wait_count": len(leave_wait), "leave_wait_oldest": max([l["waiting"] for l in leave_wait] or [0]),
        "movement": movement, "payroll": payroll, "money": money,
    }
