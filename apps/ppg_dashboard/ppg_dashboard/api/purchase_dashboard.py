import frappe
from frappe.utils import add_months, date_diff, flt, get_first_day, getdate, nowdate, add_days

def _inr(v):
    v = flt(v)
    if abs(v) >= 1e7:
        return "₹%.2f Cr" % (v / 1e7)
    if abs(v) >= 1e5:
        return "₹%.2f L" % (v / 1e5)
    return "₹{:,.0f}".format(v)


def _period_start(period, today):
    p = (period or "MTD").strip().upper()
    if p.startswith("Y"):
        return today.replace(month=1, day=1)
    if p.startswith("Q"):
        return today.replace(month=((today.month - 1) // 3) * 3 + 1, day=1)
    if p.startswith("W"):
        return add_days(today, -today.weekday())
    if p.startswith("T"):
        return today
    return get_first_day(today)


ROLES = ["Purchase Manager", "Purchase User", "Stock Manager", "Accounts Manager", "System Manager"]


@frappe.whitelist()
def get_purchase_dashboard(as_of=None, period=None):
    frappe.only_for(ROLES)
    today = getdate(as_of or nowdate())
    month_start = _period_start(period, today)
    sql = frappe.db.sql

    # ---------- Open Purchase Orders (not fully received) ----------
    pos = frappe.get_all(
        "Purchase Order",
        filters={"docstatus": 1, "status": ["in", ["To Receive and Bill", "To Receive"]]},
        fields=["name", "supplier", "supplier_name", "schedule_date", "base_grand_total", "per_received"],
        limit_page_length=0)
    open_value = 0.0
    overdue = []
    for p in pos:
        pending = flt(p.base_grand_total) * (100 - flt(p.per_received)) / 100
        open_value += pending
        if p.schedule_date and getdate(p.schedule_date) < today:
            overdue.append({"name": p.name, "supplier": p.supplier_name or p.supplier, "amount": pending,
                            "days_late": date_diff(today, p.schedule_date)})
    overdue.sort(key=lambda x: -x["days_late"])

    # overdue POs whose pending items are needed by open Work Orders
    hold = 0
    if overdue:
        names = tuple(o["name"] for o in overdue)
        po_items = sql("select distinct parent, item_code from `tabPurchase Order Item` where parent in %s and received_qty < qty",
                       (names,), as_dict=True)
        wo_items = {r.item_code for r in sql(
            """select distinct woi.item_code from `tabWork Order Item` woi join `tabWork Order` w on w.name=woi.parent
               where w.docstatus=1 and w.status in ('Not Started','In Process') and woi.required_qty>woi.transferred_qty""",
            as_dict=True)}
        hold = len({r.parent for r in po_items if r.item_code in wo_items})

    # ---------- Purchased this month ----------
    bought = sql("select count(*) c, coalesce(sum(base_grand_total),0) v from `tabPurchase Order` where docstatus=1 and transaction_date between %s and %s",
                 (month_start, today), as_dict=True)[0]
    bought_label = "Purchase Orders"
    if not bought.c:
        bought = sql("select count(*) c, coalesce(sum(base_grand_total),0) v from `tabPurchase Receipt` where docstatus=1 and is_return=0 and posting_date between %s and %s",
                     (month_start, today), as_dict=True)[0]
        bought_label = "Purchase Receipts"

    # ---------- Material Requests waiting for a PO ----------
    waiting = sql("""select mr.name, mri.item_code, mri.item_name, mri.uom, (mri.qty-mri.ordered_qty) qty,
        coalesce(mri.schedule_date, mr.schedule_date) due from `tabMaterial Request Item` mri
        join `tabMaterial Request` mr on mr.name=mri.parent
        where mr.docstatus=1 and mr.material_request_type='Purchase' and mr.status in ('Pending','Partially Ordered')
        and mri.ordered_qty<mri.qty order by due asc""", as_dict=True)
    waiting_rows = [{"name": r.name, "item": r.item_name or r.item_code, "qty": flt(r.qty), "uom": r.uom,
                     "days": date_diff(getdate(r.due), today) if r.due else None} for r in waiting[:5]]

    # ---------- Received, not billed ----------
    pr = frappe.get_all("Purchase Receipt",
        filters={"docstatus": 1, "is_return": 0, "per_billed": ["<", 100], "status": ["not in", ["Closed", "Cancelled"]]},
        fields=["grand_total", "per_billed", "posting_date"], limit_page_length=0)
    unbilled = {"amount": sum(flt(p.grand_total) * (100 - flt(p.per_billed)) / 100 for p in pr), "count": len(pr),
                "oldest_days": max([date_diff(today, p.posting_date) for p in pr] or [0])}

    # ---------- Pipeline this month (document counts) ----------
    c = frappe.db.count
    rng = ["between", [month_start, today]]
    pipeline = [
        {"label": "Material Requests raised", "count": c("Material Request", {"docstatus": 1, "material_request_type": "Purchase", "transaction_date": rng})},
        {"label": "Purchase Orders created", "count": c("Purchase Order", {"docstatus": 1, "transaction_date": rng})},
        {"label": "Goods received", "count": c("Purchase Receipt", {"docstatus": 1, "is_return": 0, "posting_date": rng})},
        {"label": "Invoices booked", "count": c("Purchase Invoice", {"docstatus": 1, "is_return": 0, "posting_date": rng})},
        {"label": "Paid to suppliers", "count": c("Payment Entry", {"docstatus": 1, "payment_type": "Pay", "party_type": "Supplier", "posting_date": rng})},
    ]

    # ---------- Ordered vs received, last 6 months ----------
    start = get_first_day(add_months(today, -5))
    ordered = {r.m: flt(r.t) for r in sql(
        """select date_format(transaction_date,'%%Y-%%m') m, sum(base_grand_total) t from `tabPurchase Order`
           where docstatus=1 and transaction_date>=%s group by m""", (start,), as_dict=True)}
    received = {r.m: flt(r.t) for r in sql(
        """select date_format(posting_date,'%%Y-%%m') m, sum(base_grand_total) t from `tabPurchase Receipt`
           where docstatus=1 and is_return=0 and posting_date>=%s group by m""", (start,), as_dict=True)}
    trend = []
    for i in range(5, -1, -1):
        d = add_months(get_first_day(today), -i)
        k = d.strftime("%Y-%m")
        trend.append({"label": d.strftime("%b"), "ordered": ordered.get(k, 0), "received": received.get(k, 0)})

    # ---------- Top suppliers, last 90 days ----------
    since = add_days(today, -90)
    top = sql("""select supplier, supplier_name, sum(base_grand_total) spend, count(*) orders from `tabPurchase Order`
        where docstatus=1 and transaction_date between %s and %s group by supplier order by spend desc limit 5""", (since, today), as_dict=True)
    ontime = {r.supplier: r for r in sql(
        """select pr.supplier, count(distinct pr.name) n,
           count(distinct case when pr.posting_date<=po.schedule_date then pr.name end) ok
           from `tabPurchase Receipt Item` pri join `tabPurchase Receipt` pr on pr.name=pri.parent
           join `tabPurchase Order` po on po.name=pri.purchase_order
           where pr.docstatus=1 and pr.is_return=0 and pr.posting_date>=%s group by pr.supplier""", (since,), as_dict=True)}
    suppliers = []
    for t in top:
        o = ontime.get(t.supplier)
        suppliers.append({"supplier": t.supplier_name or t.supplier, "spend": flt(t.spend), "orders": t.orders,
                          "on_time": round(o.ok / o.n * 100) if o and o.n else None})

    # ---------- Price increases (latest PO rate vs previous PO rate) ----------
    prices = []
    try:
        rows = sql("""select item_code, item_name, rate, rn from (
            select poi.item_code, poi.item_name, poi.base_rate rate,
            row_number() over (partition by poi.item_code order by po.transaction_date desc, po.creation desc) rn
            from `tabPurchase Order Item` poi join `tabPurchase Order` po on po.name=poi.parent
            where po.docstatus=1 and po.transaction_date >= date_sub(curdate(), interval 180 day)) t where rn<=2""", as_dict=True)
        by_item = {}
        for r in rows:
            by_item.setdefault(r.item_code, {})[r.rn] = r
        for code, v in by_item.items():
            if 1 in v and 2 in v and flt(v[2].rate) > 0 and flt(v[1].rate) > flt(v[2].rate):
                prices.append({"item": v[1].item_name or code, "last": flt(v[2].rate), "new": flt(v[1].rate),
                               "pct": round((flt(v[1].rate) / flt(v[2].rate) - 1) * 100, 1)})
        prices.sort(key=lambda x: -x["pct"])
    except Exception:
        prices = []

    # ---------- Received value by item group, selected period ----------
    groups = sql("""select pri.item_group label, sum(pri.base_net_amount) amount from `tabPurchase Receipt Item` pri
        join `tabPurchase Receipt` pr on pr.name=pri.parent where pr.docstatus=1 and pr.is_return=0
        and pr.posting_date between %s and %s group by pri.item_group order by amount desc limit 5""",
        (month_start, today), as_dict=True)

    attention = {"draft_pos": frappe.db.count("Purchase Order", {"docstatus": 0}),
                 "draft_requests": frappe.db.count("Material Request", {"docstatus": 0, "material_request_type": "Purchase"}),
                 "open_quotations": frappe.db.count("Supplier Quotation", {"docstatus": 1, "status": "Submitted"})}

    parts = []
    if overdue:
        top2 = " and ".join(o["supplier"] for o in overdue[:2])
        parts.append("%d Purchase Orders are overdue for delivery, worth %s%s. Chase %s first." % (
            len(overdue), _inr(sum(o["amount"] for o in overdue)),
            ", and %d of them hold up open Work Orders" % hold if hold else "", top2))
    wmr = len({w.name for w in waiting})
    if wmr:
        parts.append("%d Material Requests still have no Purchase Order." % wmr)
    if unbilled["count"]:
        parts.append("%d Purchase Receipts worth %s have no Purchase Invoice yet, oldest %d days." % (
            unbilled["count"], _inr(unbilled["amount"]), unbilled["oldest_days"]))
    alert = " ".join(parts) if parts else "No overdue Purchase Orders or pending purchase work."

    return {
        "alert": alert,
        "summary": {"bought_label": bought_label, "bought_value": flt(bought.v), "bought_count": bought.c, "open_value": open_value,
                    "open_count": len(pos), "overdue_count": len(overdue), "overdue_value": sum(o["amount"] for o in overdue),
                    "hold_wo": hold, "waiting_mr": len({w.name for w in waiting})},
        "pipeline": pipeline, "trend": trend, "overdue": overdue[:5], "waiting": waiting_rows,
        "suppliers": suppliers, "prices": prices[:5], "groups": groups, "unbilled": unbilled, "attention": attention,
    }
