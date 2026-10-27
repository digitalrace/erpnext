import frappe
from frappe.utils import add_days, add_months, date_diff, flt, get_first_day, getdate, nowdate

ROLES = ["Accounts Manager", "Accounts User", "System Manager"]
BUCKETS = ["Not due", "1-30 d", "31-60 d", "61-90 d", "Over 90 d"]


def _bucket(days_late):
    if days_late <= 0:
        return 0
    if days_late <= 30:
        return 1
    if days_late <= 60:
        return 2
    if days_late <= 90:
        return 3
    return 4


@frappe.whitelist()
def get_finance_dashboard():
    frappe.only_for(ROLES)
    today = getdate(nowdate())

    # ---------- Receivables (Sales Invoice) ----------
    sinv = frappe.get_all(
        "Sales Invoice",
        filters={"docstatus": 1, "is_return": 0, "outstanding_amount": [">", 0]},
        fields=["name", "customer", "customer_name", "posting_date", "due_date", "outstanding_amount"],
        limit_page_length=0,
    )
    ageing = [0.0] * 5
    receivables = recv_overdue = 0.0
    by_customer = {}
    overdue_invoices = []
    for d in sinv:
        amt = flt(d.outstanding_amount)
        late = date_diff(today, d.due_date or d.posting_date)
        receivables += amt
        ageing[_bucket(late)] += amt
        if late > 0:
            recv_overdue += amt
            c = by_customer.setdefault(d.customer, {"customer": d.customer_name or d.customer, "overdue": 0.0, "days_late": 0})
            c["overdue"] += amt
            c["days_late"] = max(c["days_late"], late)
            overdue_invoices.append({"name": d.name, "party": d.customer_name or d.customer, "amount": amt, "days_late": late})
    overdue_invoices.sort(key=lambda x: -x["days_late"])
    top_customers = sorted(by_customer.values(), key=lambda x: -x["overdue"])

    # ---------- Payables (Purchase Invoice) ----------
    pinv = frappe.get_all(
        "Purchase Invoice",
        filters={"docstatus": 1, "is_return": 0, "outstanding_amount": [">", 0]},
        fields=["name", "supplier", "supplier_name", "posting_date", "due_date", "outstanding_amount"],
        limit_page_length=0,
    )
    payables = pay_overdue = 0.0
    due_bills = []
    week_end = add_days(today, 7)
    for d in pinv:
        amt = flt(d.outstanding_amount)
        due = getdate(d.due_date or d.posting_date)
        payables += amt
        if due < today:
            pay_overdue += amt
        if due <= week_end:
            due_bills.append({"name": d.name, "party": d.supplier_name or d.supplier, "amount": amt,
                              "due_date": str(due), "days_to_due": date_diff(due, today)})
    due_bills.sort(key=lambda x: x["due_date"])

    # ---------- Billed vs collected, last 6 months ----------
    start = get_first_day(add_months(today, -5))
    billed = {r.m: flt(r.t) for r in frappe.db.sql(
        """select date_format(posting_date,'%%Y-%%m') m, sum(base_grand_total) t from `tabSales Invoice`
           where docstatus=1 and is_return=0 and posting_date>=%s group by m""", (start,), as_dict=True)}
    collected = {r.m: flt(r.t) for r in frappe.db.sql(
        """select date_format(posting_date,'%%Y-%%m') m, sum(base_received_amount) t from `tabPayment Entry`
           where docstatus=1 and payment_type='Receive' and party_type='Customer' and posting_date>=%s group by m""",
        (start,), as_dict=True)}
    trend = []
    for i in range(5, -1, -1):
        d = add_months(get_first_day(today), -i)
        k = d.strftime("%Y-%m")
        trend.append({"label": d.strftime("%b"), "billed": billed.get(k, 0), "collected": collected.get(k, 0)})

    # ---------- DSO (receivables / billed last 90 days * 90) ----------
    billed_90 = flt(frappe.db.sql(
        "select sum(base_grand_total) from `tabSales Invoice` where docstatus=1 and is_return=0 and posting_date>=%s",
        (add_days(today, -90),))[0][0])
    dso = round(receivables / billed_90 * 90) if billed_90 else 0

    # ---------- Payment Entries ----------
    pe = frappe.get_all(
        "Payment Entry", filters={"docstatus": 1},
        fields=["name", "payment_type", "party", "party_name", "paid_amount", "received_amount", "posting_date"],
        order_by="posting_date desc, creation desc", limit_page_length=6)
    payments = [{"name": p.name, "party": p.party_name or p.party or "-", "type": p.payment_type,
                 "amount": flt(p.received_amount if p.payment_type == "Receive" else p.paid_amount)} for p in pe]

    # ---------- Advances (Payment Entry not yet allocated) ----------
    adv_rows = frappe.get_all(
        "Payment Entry",
        filters={"docstatus": 1, "unallocated_amount": [">", 0], "party_type": ["in", ["Customer", "Supplier"]]},
        fields=["name", "party_type", "party", "party_name", "posting_date", "unallocated_amount"],
        order_by="unallocated_amount desc", limit_page_length=0)
    adv = {"Customer": {"total": 0.0, "rows": []}, "Supplier": {"total": 0.0, "rows": []}}
    for a in adv_rows:
        g = adv[a.party_type]
        g["total"] += flt(a.unallocated_amount)
        if len(g["rows"]) < 3:
            g["rows"].append({"name": a.name, "party": a.party_name or a.party,
                              "amount": flt(a.unallocated_amount), "age": date_diff(today, a.posting_date)})

    # ---------- Journal Entries ----------
    je = frappe.get_all(
        "Journal Entry", filters={"docstatus": ["<", 2]},
        fields=["name", "voucher_type", "total_debit", "user_remark", "docstatus"],
        order_by="posting_date desc, creation desc", limit_page_length=6)
    journals = [{"name": j.name, "type": "Draft" if j.docstatus == 0 else j.voucher_type,
                 "remark": (j.user_remark or "")[:40], "amount": flt(j.total_debit)} for j in je]

    # ---------- Delivered, not invoiced ----------
    dn = frappe.get_all(
        "Delivery Note",
        filters={"docstatus": 1, "is_return": 0, "per_billed": ["<", 100], "status": ["not in", ["Closed", "Cancelled"]]},
        fields=["grand_total", "per_billed", "posting_date"], limit_page_length=0)
    unbilled = {
        "amount": sum(flt(d.grand_total) * (100 - flt(d.per_billed)) / 100 for d in dn),
        "count": len(dn),
        "oldest_days": max([date_diff(today, d.posting_date) for d in dn] or [0]),
    }

    # ---------- Needs attention ----------
    attention = {
        "draft_invoices": frappe.db.count("Sales Invoice", {"docstatus": 0}) + frappe.db.count("Purchase Invoice", {"docstatus": 0}),
        "draft_entries": frappe.db.count("Payment Entry", {"docstatus": 0}) + frappe.db.count("Journal Entry", {"docstatus": 0}),
        "unreconciled": frappe.db.count("Bank Transaction", {"docstatus": 1, "status": "Unreconciled"})
        if frappe.db.table_exists("Bank Transaction") else 0,
    }

    return {
        "summary": {"receivables": receivables, "recv_overdue": recv_overdue, "payables": payables,
                    "pay_overdue": pay_overdue, "net": receivables - payables, "dso": dso,
                    "adv_customer": adv["Customer"]["total"], "adv_supplier": adv["Supplier"]["total"],
                    "overdue_customers": len(by_customer),
                    "oldest_late": overdue_invoices[0]["days_late"] if overdue_invoices else 0},
        "ageing": [{"label": b, "amount": a} for b, a in zip(BUCKETS, ageing)],
        "trend": trend,
        "overdue_invoices": overdue_invoices[:5],
        "top_customers": top_customers[:3],
        "due_bills": due_bills[:6],
        "payments": payments,
        "advances": adv,
        "journals": journals,
        "unbilled": unbilled,
        "attention": attention,
    }
