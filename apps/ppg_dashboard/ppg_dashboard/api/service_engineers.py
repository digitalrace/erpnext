import importlib

import frappe
from frappe.utils import add_days, date_diff, flt, getdate, nowdate

OPEN = ("OPEN", "FORWARD")  # same definition as the management dashboard
ENG_HINTS = ("engineer", "technician", "employee", "assigned", "attended")
WORK_HINTS = ("work_done", "work_details", "action_taken", "service_details", "remarks", "description", "observation")
DATE_HINTS = ("visit_date", "service_date", "report_date", "date", "posting_date")
TEXT_TYPES = ("Small Text", "Text", "Long Text", "Text Editor", "Data")


def _fields(dt):
    try:
        return frappe.get_meta(dt).fields
    except Exception:
        return []


def _has(dt, fieldname):
    return any(f.fieldname == fieldname for f in _fields(dt))


def _find(dt, hints, types, options=None):
    cands = [f for f in _fields(dt) if f.fieldtype in types and (options is None or f.options == options)]
    for h in hints:
        for f in cands:
            if f.fieldname == h:
                return f.fieldname
    for h in hints:
        for f in cands:
            if h in f.fieldname:
                return f.fieldname
    return cands[0].fieldname if (options and cands) else None


def _resolve(period, as_of, from_date, to_date):
    for mod in ("production_dashboard", "quality_dashboard", "delivery_dashboard"):
        try:
            fn = getattr(importlib.import_module("ppg_dashboard.api." + mod), "resolve_period", None)
            if fn:
                r = fn(period, as_of, from_date, to_date)
                return getdate(r[1]), getdate(r[2])
        except Exception:
            continue
    p = (period or "MTD").upper()
    if p.startswith("Y"):
        start = getdate("%s-04-01" % (as_of.year if as_of.month >= 4 else as_of.year - 1))
    elif p.startswith("Q"):
        start = as_of.replace(month=((as_of.month - 1) // 3) * 3 + 1, day=1)
    else:
        start = as_of.replace(day=1)
    return start, as_of


def _prio(v):
    v = (v or "").strip().upper()
    return {"HIGH": "High", "URGENT": "High", "CRITICAL": "High", "MEDIUM": "Medium", "LOW": "Low"}.get(v, "Not set")


@frappe.whitelist()
def get_service_engineers(as_of_date=None, period="MTD", custom_from_date=None, custom_to_date=None):
    frappe.has_permission("Service Complaint", "read", throw=True)
    as_of = getdate(as_of_date or nowdate())
    p_start, p_end = _resolve(period, as_of, custom_from_date, custom_to_date)

    # ---------- field discovery (names differ between sites) ----------
    cust_field = "customer_name" if _has("Service Complaint", "customer_name") else ("customer" if _has("Service Complaint", "customer") else None)
    sr_ok = bool(frappe.db.exists("DocType", "Service Report"))
    sr_sc = _find("Service Report", ("service_complaint", "complaint"), ("Link",), "Service Complaint") if sr_ok else None
    sr_emp = _find("Service Report", ENG_HINTS, ("Link",), "Employee") if sr_ok else None
    sr_date = (_find("Service Report", DATE_HINTS, ("Date", "Datetime")) or "creation") if sr_ok else None
    sr_work = _find("Service Report", WORK_HINTS, TEXT_TYPES) if sr_ok else None
    sr_fvf = next((f.fieldname for f in _fields("Service Report")
                   if f.fieldtype == "Check" and "first" in f.fieldname and ("fix" in f.fieldname or "visit" in f.fieldname)), None) if sr_ok else None

    # ---------- open complaints ----------
    want = ["name", "status", "priority", "date", "assigned_employee"] + ([cust_field] if cust_field else [])
    want = [w for w in want if w in ("name", "creation") or _has("Service Complaint", w)]
    rows = frappe.get_all("Service Complaint", filters={"status": ["in", list(OPEN)]}, fields=want,
                          order_by="date asc", limit_page_length=0)
    emp_ids = {r.assigned_employee for r in rows if r.assigned_employee}

    # ---------- service reports in the period ----------
    srs = []
    if sr_ok:
        sf = ["name", sr_date] + [x for x in (sr_sc, sr_emp, sr_work, sr_fvf) if x]
        srs = frappe.get_all("Service Report", filters={"docstatus": ["<", 2], sr_date: ["between", [p_start, as_of]]},
                             fields=list(dict.fromkeys(sf)), order_by=sr_date + " desc", limit_page_length=0)
    sc_owner = {}
    if srs and sr_sc and not sr_emp:
        refs = list({s.get(sr_sc) for s in srs if s.get(sr_sc)})
        if refs:
            sc_owner = {c.name: c.assigned_employee for c in frappe.get_all(
                "Service Complaint", filters={"name": ["in", refs]}, fields=["name", "assigned_employee"], limit_page_length=0)}
    for s in srs:
        s["_emp"] = (s.get(sr_emp) if sr_emp else sc_owner.get(s.get(sr_sc))) or ""
        if s["_emp"]:
            emp_ids.add(s["_emp"])

    names = {e.name: e.employee_name for e in frappe.get_all(
        "Employee", filters={"name": ["in", list(emp_ids)]}, fields=["name", "employee_name"], limit_page_length=0)} if emp_ids else {}

    # ---------- average first response per engineer ----------
    resp = {}
    if _has("Service Complaint", "complaint_created_at") and _has("Service Complaint", "first_response_at"):
        for r in frappe.db.sql("""select assigned_employee e, avg(timestampdiff(minute, complaint_created_at, first_response_at))/60 h
            from `tabService Complaint` where complaint_created_at is not null and first_response_at is not null
            and date between %s and %s group by assigned_employee""", (p_start, as_of), as_dict=True):
            resp[r.e or ""] = round(flt(r.h), 1)

    # ---------- build complaint rows and per-engineer blocks ----------
    complaints, by = [], {}
    prio_count = {"High": 0, "Medium": 0, "Low": 0, "Not set": 0}
    no_customer = 0
    for r in rows:
        days = date_diff(as_of, r.date) if r.date else 0
        emp = r.assigned_employee or ""
        p = _prio(r.priority)
        prio_count[p] += 1
        cust = (r.get(cust_field) or "") if cust_field else ""
        if not cust:
            no_customer += 1
        c = {"name": r.name, "customer": cust, "priority": p, "date": str(r.date) if r.date else "", "days": days,
             "emp": emp, "engineer": names.get(emp) or emp}
        complaints.append(c)
        by.setdefault(emp, {"sc": [], "sr": []})["sc"].append(c)
    for s in srs:
        by.setdefault(s["_emp"], {"sc": [], "sr": []})["sr"].append({
            "name": s.name, "complaint": s.get(sr_sc) if sr_sc else "", "date": str(getdate(s.get(sr_date))),
            "work": (s.get(sr_work) or "")[:90] if sr_work else "",
            "fvf": (bool(s.get(sr_fvf)) if sr_fvf else None)})

    engineers = []
    for emp, d in by.items():
        sc, sr = d["sc"], d["sr"]
        fvf_rows = [x for x in sr if x["fvf"] is not None]
        engineers.append({
            "id": emp, "name": (names.get(emp) or emp) if emp else "Unassigned",
            "open": len(sc), "high": sum(1 for x in sc if x["priority"] == "High"),
            "oldest": max([x["days"] for x in sc] or [0]), "sr_count": len(sr),
            "fvf": round(sum(1 for x in fvf_rows if x["fvf"]) / len(fvf_rows) * 100) if fvf_rows else None,
            "avg_response": resp.get(emp), "sc": sc, "sr": sr[:10]})
    engineers.sort(key=lambda e: (e["id"] == "", -e["open"], -e["sr_count"]))

    fvf_all = [s.get(sr_fvf) for s in srs] if sr_fvf else []
    raised = frappe.db.count("Service Complaint", {"date": ["between", [p_start, as_of]]})
    closed = frappe.db.count("Service Complaint", {"status": "CLOSE", "date": ["between", [p_start, as_of]]})
    unassigned = [c for c in complaints if not c["emp"]]
    high_rows = [c for c in complaints if c["priority"] == "High"]

    return {
        "as_of_date": str(as_of), "period": period, "from_date": str(p_start), "to_date": str(as_of),
        "summary": {"open": len(complaints), "high": len(high_rows), "unassigned": len(unassigned), "raised": raised, "closed": closed,
                    "sr_count": len(srs), "oldest": max([c["days"] for c in complaints] or [0]),
                    "fvf": round(sum(1 for v in fvf_all if v) / len(fvf_all) * 100) if fvf_all else None},
        "engineers": engineers,
        "complaints": complaints[:12],
        "reports": [{"name": s.name, "complaint": s.get(sr_sc) if sr_sc else "", "engineer": names.get(s["_emp"]) or s["_emp"] or "Unassigned",
                     "date": str(getdate(s.get(sr_date)))} for s in srs[:8]],
        "priority": prio_count,
        "high_first": ({"name": high_rows[0]["name"], "days": high_rows[0]["days"]} if high_rows else None),
        "unassigned_first": [c["name"] for c in unassigned[:2]],
        "attention": {"unassigned": len(unassigned), "high": len(high_rows), "no_priority": prio_count["Not set"], "no_customer": no_customer},
        "detected": {"customer_field": cust_field, "sr_complaint_field": sr_sc, "sr_engineer_field": sr_emp,
                     "sr_date_field": sr_date, "sr_work_field": sr_work, "sr_first_visit_fix_field": sr_fvf},
    }
