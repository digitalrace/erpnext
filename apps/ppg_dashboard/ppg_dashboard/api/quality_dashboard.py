"""
Quality dashboard API for ppg_dashboard.

Place this file at:
    apps/ppg_dashboard/ppg_dashboard/api/quality_dashboard.py

Method path used by the frontend:
    ppg_dashboard.api.quality_dashboard.get_quality_dashboard

It reuses resolve_period() from production_dashboard.py (same folder).

Definitions
    Inspected       submitted Quality Inspection with status Accepted or Rejected
                    and report_date inside the selected period
    Pass rate       Accepted / (Accepted + Rejected)
    Stage           Quality Inspection.inspection_type: Incoming, In Process, Outgoing
    Pending         1. draft Quality Inspections
                    2. draft Purchase Receipts whose items need inspection before
                       purchase and have no Quality Inspection yet
                    3. draft Delivery Notes whose items need inspection before
                       delivery and have no Quality Inspection yet
                    4. open Job Cards that have a quality inspection template but
                       no Quality Inspection yet
                    (2 to 4 only when the matching fields exist in your ERPNext)
    Holding up      incoming: open Work Orders that still need the item;
                    outgoing: the Delivery Note; in-process: the work order
    Quality action  Quality Action documents with status Open (corrective and
                    preventive actions)
    QA stations     open Job Cards of submitted Work Orders on workstations whose
                    name contains one of QA_KEYWORDS (QA, Test Bay, Inspection).
                    This shows inspection work that is tracked through job cards
                    instead of Quality Inspection documents.
    Rejection reason  Quality Inspection.custom_rejection_reason if that field
                    exists, otherwise the specifications that failed in the
                    Quality Inspection readings.
"""

from collections import defaultdict
from datetime import timedelta

import frappe
from frappe.utils import add_days, date_diff, flt, getdate, today

from ppg_dashboard.api.production_dashboard import resolve_period

TARGET_PASS_PCT = 95
LOOKBACK_DAYS = 90  # how far back draft documents are checked for pending inspections
QA_KEYWORDS = ("qa", "test bay", "inspection")
WEEKS = 6
MAX_ROWS = 100
STAGES = (("Incoming", "incoming"), ("In Process", "in_process"), ("Outgoing", "outgoing"))
CLOSED_COMPLAINT = ["Closed", "Resolved", "Completed", "Cancelled"]
OPEN_COMPLAINT = ["OPEN", "FORWARD"]  # same definition as the management dashboard
HIGH_PRIORITY = ("High", "Urgent", "Critical")


def _exists(doctype):
    return bool(frappe.db.exists("DocType", doctype))


def _has(doctype, fieldname):
    return _exists(doctype) and frappe.get_meta(doctype).has_field(fieldname)


def _pct(part, whole):
    return round(part * 100.0 / whole, 1) if whole else None


def _d(value):
    return str(getdate(value)) if value else None


def _sources(refs):
    """Map (reference_type, reference_name) to a short text such as a supplier or workstation."""
    out = {}
    by_type = defaultdict(set)
    for rtype, rname in refs:
        if rtype and rname:
            by_type[rtype].add(rname)

    for rtype, field in (("Purchase Receipt", "supplier_name"), ("Delivery Note", "customer_name")):
        if by_type.get(rtype):
            for r in frappe.get_all(
                rtype, filters={"name": ["in", list(by_type[rtype])]}, fields=["name", field], limit_page_length=0
            ):
                out[(rtype, r.name)] = r.get(field)

    if by_type.get("Job Card"):
        for r in frappe.get_all(
            "Job Card",
            filters={"name": ["in", list(by_type["Job Card"])]},
            fields=["name", "workstation", "work_order"],
            limit_page_length=0,
        ):
            out[("Job Card", r.name)] = " · ".join(x for x in (r.workstation, r.work_order) if x)
    return out


def _needed_by(item_codes):
    """Open Work Orders that still need each item (used for 'holding up')."""
    if not item_codes:
        return {}
    out = defaultdict(list)
    for r in frappe.db.sql(
        """
        SELECT woi.item_code, wo.name AS work_order
        FROM `tabWork Order Item` woi
        JOIN `tabWork Order` wo ON wo.name = woi.parent
        WHERE wo.docstatus = 1
          AND wo.status NOT IN ('Completed', 'Cancelled', 'Closed', 'Stopped')
          AND woi.item_code IN %(items)s
          AND IFNULL(woi.required_qty, 0) > IFNULL(woi.transferred_qty, 0)
        ORDER BY wo.planned_start_date, wo.name
        """,
        {"items": tuple(item_codes)},
        as_dict=True,
    ):
        if r.work_order not in out[r.item_code]:
            out[r.item_code].append(r.work_order)
    return out


@frappe.whitelist()
def get_quality_dashboard(
    as_of_date=None, period="MTD", custom_from_date=None, custom_to_date=None, company=None
):
    frappe.has_permission("Quality Inspection", "read", throw=True)

    as_of = getdate(as_of_date or today())
    period_code, p_start, p_end = resolve_period(period, as_of, custom_from_date, custom_to_date)
    lookback = add_days(as_of, -LOOKBACK_DAYS)

    reason_field = "custom_rejection_reason" if _has("Quality Inspection", "custom_rejection_reason") else None

    # ------------------------------------------------------------------
    # Inspections done in the period
    # ------------------------------------------------------------------
    fields = [
        "name", "inspection_type", "reference_type", "reference_name",
        "item_code", "item_name", "report_date", "status", "sample_size",
    ]
    if reason_field:
        fields.append(reason_field)

    done = frappe.get_all(
        "Quality Inspection",
        filters={
            "docstatus": 1,
            "status": ["in", ["Accepted", "Rejected"]],
            "report_date": ["between", [p_start, p_end]],
        },
        fields=fields,
        order_by="report_date desc, creation desc",
        limit_page_length=0,
    )

    stage_stats = {key: {"accepted": 0, "rejected": 0, "pending": 0} for _, key in STAGES}
    type_to_key = dict(STAGES)
    for q in done:
        key = type_to_key.get(q.inspection_type)
        if key:
            stage_stats[key]["accepted" if q.status == "Accepted" else "rejected"] += 1

    accepted = sum(1 for q in done if q.status == "Accepted")
    rejected_rows = [q for q in done if q.status == "Rejected"]

    # ------------------------------------------------------------------
    # Rejection reasons
    # ------------------------------------------------------------------
    reasons = defaultdict(int)
    reason_source = "none"
    if rejected_rows:
        if reason_field:
            reason_source = "field"
            for q in rejected_rows:
                reasons[q.get(reason_field) or "Not recorded"] += 1
        else:
            reason_source = "readings"
            failed = defaultdict(set)
            for r in frappe.db.sql(
                """
                SELECT DISTINCT r.parent AS qi, r.specification AS spec
                FROM `tabQuality Inspection Reading` r
                WHERE r.parent IN %(names)s AND r.status = 'Rejected'
                """,
                {"names": tuple(q.name for q in rejected_rows)},
                as_dict=True,
            ):
                failed[r.qi].add(r.spec or "Not recorded")
            for q in rejected_rows:
                for spec in failed.get(q.name) or {"Not recorded"}:
                    reasons[spec] += 1
    reason_list = sorted(({"reason": k, "count": v} for k, v in reasons.items()), key=lambda r: -r["count"])

    # ------------------------------------------------------------------
    # Pass rate by week
    # ------------------------------------------------------------------
    this_monday = as_of - timedelta(days=as_of.weekday())
    first_monday = this_monday - timedelta(weeks=WEEKS - 1)
    week_rows = frappe.get_all(
        "Quality Inspection",
        filters={
            "docstatus": 1,
            "status": ["in", ["Accepted", "Rejected"]],
            "report_date": ["between", [first_monday, as_of]],
        },
        fields=["report_date", "status"],
        limit_page_length=0,
    )
    weeks = []
    for i in range(WEEKS):
        start = first_monday + timedelta(weeks=i)
        end = start + timedelta(days=6)
        ok = sum(1 for r in week_rows if r.status == "Accepted" and start <= getdate(r.report_date) <= end)
        bad = sum(1 for r in week_rows if r.status == "Rejected" and start <= getdate(r.report_date) <= end)
        weeks.append({"week": str(start), "pass_pct": _pct(ok, ok + bad), "inspected": ok + bad})

    # ------------------------------------------------------------------
    # Pending inspections
    # ------------------------------------------------------------------
    pending = []

    drafts = frappe.get_all(
        "Quality Inspection",
        filters={"docstatus": 0},
        fields=["name", "inspection_type", "reference_type", "reference_name", "item_code", "item_name", "sample_size", "creation"],
        limit_page_length=0,
    )
    for q in drafts:
        pending.append(
            {
                "doctype": "Quality Inspection",
                "ref": q.name,
                "stage": type_to_key.get(q.inspection_type, "in_process"),
                "item_code": q.item_code,
                "item": q.item_name or q.item_code,
                "source_ref": (q.reference_type, q.reference_name),
                "qty": flt(q.sample_size),
                "waiting_days": date_diff(as_of, getdate(q.creation)),
            }
        )

    if _has("Item", "inspection_required_before_purchase") and _has("Purchase Receipt Item", "quality_inspection"):
        for r in frappe.db.sql(
            """
            SELECT pr.name, pr.supplier_name, pr.posting_date, pri.item_code, pri.item_name, pri.qty
            FROM `tabPurchase Receipt Item` pri
            JOIN `tabPurchase Receipt` pr ON pr.name = pri.parent
            JOIN `tabItem` it ON it.name = pri.item_code
            WHERE pr.docstatus = 0 AND pr.is_return = 0
              AND it.inspection_required_before_purchase = 1
              AND IFNULL(pri.quality_inspection, '') = ''
              AND pr.posting_date BETWEEN %(start)s AND %(end)s
            """,
            {"start": lookback, "end": as_of},
            as_dict=True,
        ):
            pending.append(
                {
                    "doctype": "Purchase Receipt",
                    "ref": r.name,
                    "stage": "incoming",
                    "item_code": r.item_code,
                    "item": r.item_name or r.item_code,
                    "source_text": r.supplier_name,
                    "qty": flt(r.qty),
                    "waiting_days": date_diff(as_of, getdate(r.posting_date)),
                }
            )

    if _has("Item", "inspection_required_before_delivery") and _has("Delivery Note Item", "quality_inspection"):
        for r in frappe.db.sql(
            """
            SELECT dn.name, dn.customer_name, dn.posting_date, dni.item_code, dni.item_name, dni.qty
            FROM `tabDelivery Note Item` dni
            JOIN `tabDelivery Note` dn ON dn.name = dni.parent
            JOIN `tabItem` it ON it.name = dni.item_code
            WHERE dn.docstatus = 0 AND dn.is_return = 0
              AND it.inspection_required_before_delivery = 1
              AND IFNULL(dni.quality_inspection, '') = ''
              AND dn.posting_date BETWEEN %(start)s AND %(end)s
            """,
            {"start": lookback, "end": as_of},
            as_dict=True,
        ):
            pending.append(
                {
                    "doctype": "Delivery Note",
                    "ref": r.name,
                    "stage": "outgoing",
                    "item_code": r.item_code,
                    "item": r.item_name or r.item_code,
                    "source_text": r.customer_name,
                    "qty": flt(r.qty),
                    "waiting_days": date_diff(as_of, getdate(r.posting_date)),
                }
            )

    if _has("Job Card", "quality_inspection_template") and _has("Job Card", "quality_inspection"):
        for r in frappe.db.sql(
            """
            SELECT jc.name, jc.operation, jc.workstation, jc.work_order, jc.for_quantity, jc.creation
            FROM `tabJob Card` jc
            JOIN `tabWork Order` wo ON wo.name = jc.work_order
            WHERE wo.docstatus = 1 AND wo.status NOT IN ('Cancelled', 'Closed', 'Stopped')
              AND jc.docstatus < 2 AND jc.status != 'Completed'
              AND IFNULL(jc.quality_inspection_template, '') != ''
              AND IFNULL(jc.quality_inspection, '') = ''
            """,
            as_dict=True,
        ):
            pending.append(
                {
                    "doctype": "Job Card",
                    "ref": r.name,
                    "stage": "in_process",
                    "item_code": None,
                    "work_order": r.work_order,
                    "item": r.operation,
                    "source_text": " · ".join(x for x in (r.workstation, r.work_order) if x),
                    "qty": flt(r.for_quantity),
                    "waiting_days": date_diff(as_of, getdate(r.creation)),
                }
            )

    ref_text = _sources([p["source_ref"] for p in pending if p.get("source_ref")] + [(q.reference_type, q.reference_name) for q in rejected_rows[:20]])
    for p in pending:
        if "source_ref" in p:
            p["source"] = ref_text.get(p.pop("source_ref")) or "–"
        else:
            p["source"] = p.pop("source_text", None) or "–"
        stage_stats[p["stage"]]["pending"] += 1
    pending.sort(key=lambda p: p["waiting_days"], reverse=True)

    needed = _needed_by({p["item_code"] for p in pending if p["stage"] == "incoming" and p.get("item_code")})
    for p in pending:
        if p["stage"] == "incoming":
            wos = needed.get(p.get("item_code"), [])
            p["holding_up"] = ("Needed by " + ", ".join(wos[:2])) if wos else None
        elif p["doctype"] == "Delivery Note":
            p["holding_up"] = "Dispatch of %s" % p["ref"]
        elif p["doctype"] == "Job Card" and p.get("work_order"):
            p["holding_up"] = "Next step of %s" % p["work_order"]
        else:
            p["holding_up"] = None

    rejected_list = [
        {
            "name": q.name,
            "stage": type_to_key.get(q.inspection_type, "in_process"),
            "item": q.item_name or q.item_code,
            "source": ref_text.get((q.reference_type, q.reference_name)) or q.reference_name or "–",
            "sample": flt(q.sample_size),
            "date": _d(q.report_date),
            "reason": (q.get(reason_field) if reason_field else None) or None,
        }
        for q in rejected_rows[:20]
    ]

    # ------------------------------------------------------------------
    # QA and test stations (inspection work tracked through job cards)
    # ------------------------------------------------------------------
    params = {"k%d" % i: "%%%s%%" % k for i, k in enumerate(QA_KEYWORDS)}
    like = " OR ".join("LOWER(jc.workstation) LIKE %%(k%d)s" % i for i in range(len(QA_KEYWORDS)))
    qa_cards = frappe.db.sql(
        """
        SELECT jc.name, jc.work_order, jc.operation, jc.workstation, jc.status, jc.expected_end_date
        FROM `tabJob Card` jc
        JOIN `tabWork Order` wo ON wo.name = jc.work_order
        WHERE wo.docstatus = 1 AND wo.status NOT IN ('Cancelled', 'Closed', 'Stopped')
          AND jc.docstatus < 2 AND jc.status != 'Completed'
          AND ({like})
        """.format(like=like),
        params,
        as_dict=True,
    )
    qa_by_ws = defaultdict(lambda: {"open": 0, "overdue": 0, "max_delay": 0})
    qa_list = []
    for c in qa_cards:
        late = 0
        if c.expected_end_date and getdate(c.expected_end_date) < as_of:
            late = date_diff(as_of, getdate(c.expected_end_date))
        w = qa_by_ws[c.workstation]
        w["open"] += 1
        if late:
            w["overdue"] += 1
            w["max_delay"] = max(w["max_delay"], late)
        qa_list.append(
            {
                "name": c.name,
                "work_order": c.work_order,
                "operation": c.operation,
                "workstation": c.workstation,
                "status": c.status,
                "expected_end": _d(c.expected_end_date),
                "days_late": late,
            }
        )
    qa_list.sort(key=lambda r: r["days_late"], reverse=True)
    qa_stations = sorted(
        ({"workstation": k, **v} for k, v in qa_by_ws.items()), key=lambda r: (-r["overdue"], r["workstation"])
    )

    # ------------------------------------------------------------------
    # Non-conformances and complaints
    # ------------------------------------------------------------------
    non_conf = []
    if _exists("Non Conformance"):
        nc_fields = ["name", "creation"] + [
            f for f in ("subject", "procedure", "process_owner", "full_name") if _has("Non Conformance", f)
        ]
        for n in frappe.get_all(
            "Non Conformance",
            filters={"status": "Open"},
            fields=nc_fields,
            order_by="creation asc",
            limit_page_length=MAX_ROWS,
        ):
            non_conf.append(
                {
                    "name": n.name,
                    "subject": n.get("subject") or n.name,
                    "procedure": n.get("procedure"),
                    "owner": n.get("full_name") or n.get("process_owner"),
                    "open_days": date_diff(as_of, getdate(n.creation)),
                }
            )

    actions = []
    if _exists("Quality Action"):
        qa_fields = ["name", "creation"] + [
            f for f in ("corrective_preventive", "procedure", "goal", "review", "date") if _has("Quality Action", f)
        ]
        for a_ in frappe.get_all(
            "Quality Action",
            filters={"status": "Open"},
            fields=qa_fields,
            order_by="creation asc",
            limit_page_length=MAX_ROWS,
        ):
            actions.append(
                {
                    "name": a_.name,
                    "type": a_.get("corrective_preventive"),
                    "about": a_.get("procedure") or a_.get("goal"),
                    "review": a_.get("review"),
                    "due": _d(a_.get("date")),
                    "open_days": date_diff(as_of, getdate(a_.creation)),
                }
            )

    complaints = []
    if _exists("Service Complaint"):
        meta = frappe.get_meta("Service Complaint")
        want = ["customer", "customer_name", "priority", "status", "subject", "item_code", "item_name"]
        cfields = ["name", "creation"] + [f for f in want if meta.has_field(f)]
        cfilters = {}
        if meta.has_field("status"):
            cfilters["status"] = ["in", OPEN_COMPLAINT]
        for c in frappe.get_all(
            "Service Complaint",
            filters=cfilters,
            fields=cfields,
            order_by="creation asc",
            limit_page_length=MAX_ROWS,
        ):
            complaints.append(
                {
                    "name": c.name,
                    "customer": c.get("customer_name") or c.get("customer"),
                    "product": c.get("item_name") or c.get("item_code"),
                    "issue": c.get("subject"),
                    "priority": c.get("priority"),
                    "status": c.get("status"),
                    "open_days": date_diff(as_of, getdate(c.creation)),
                    "high": ((c.get("priority") or "").strip().upper() in ("HIGH", "URGENT", "CRITICAL")),
                }
            )

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    stages = []
    for label, key in STAGES:
        s = stage_stats[key]
        total = s["accepted"] + s["rejected"]
        stages.append(
            {
                "stage": key,
                "label": label,
                "inspected": total,
                "accepted": s["accepted"],
                "rejected": s["rejected"],
                "pending": s["pending"],
                "pass_pct": _pct(s["accepted"], total),
            }
        )

    high = [c for c in complaints if c["high"]]
    summary = {
        "done": len(done),
        "accepted": accepted,
        "rejected": len(rejected_rows),
        "pass_pct": _pct(accepted, len(done)),
        "target_pct": TARGET_PASS_PCT,
        "pending": len(pending),
        "pending_avg_wait": round(sum(p["waiting_days"] for p in pending) / len(pending), 1) if pending else 0,
        "pending_oldest": pending[0]["waiting_days"] if pending else 0,
        "nc_open": len(non_conf),
        "nc_oldest": max((n["open_days"] for n in non_conf), default=0),
        "actions_open": len(actions),
        "actions_oldest": max((x["open_days"] for x in actions), default=0),
        "pending_blocking": sum(1 for p in pending if p.get("holding_up")),
        "complaints_open": len(complaints),
        "complaints_high": len(high),
        "complaints_high_oldest": max((c["open_days"] for c in high), default=0),
        "qa_open": len(qa_list),
        "qa_overdue": sum(1 for c in qa_list if c["days_late"]),
        "qa_oldest": qa_list[0]["days_late"] if qa_list else 0,
    }

    return {
        "as_of_date": str(as_of),
        "period": period_code,
        "from_date": str(p_start),
        "to_date": str(p_end),
        "summary": summary,
        "stages": stages,
        "reasons": reason_list,
        "reason_source": reason_source,
        "weeks": weeks,
        "pending": pending[:MAX_ROWS],
        "rejected": rejected_list,
        "qa_stations": qa_stations,
        "qa_cards": qa_list[:MAX_ROWS],
        "non_conformances": non_conf,
        "actions": actions,
        "complaints": complaints,
        "config": {
            "has_non_conformance": _exists("Non Conformance"),
            "has_actions": _exists("Quality Action"),
            "has_complaints": _exists("Service Complaint"),
            "has_complaint_priority": _has("Service Complaint", "priority"),
            "has_complaint_status": _has("Service Complaint", "status"),
            "complaint_closed": CLOSED_COMPLAINT,
            "high_priority": list(HIGH_PRIORITY),
            "has_rejection_reason_field": bool(reason_field),
        },
    }
