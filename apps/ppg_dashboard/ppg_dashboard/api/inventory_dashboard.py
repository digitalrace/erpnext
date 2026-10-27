import frappe
from frappe.utils import add_days, add_months, date_diff, flt, get_first_day, getdate, nowdate

ROLES = ["Stock Manager", "Stock User", "Manufacturing Manager", "System Manager"]
AGE_LABELS = ["0-30 d", "31-90 d", "91-180 d", "Over 180 d"]


def _age_bucket(days):
    if days <= 30:
        return 0
    if days <= 90:
        return 1
    if days <= 180:
        return 2
    return 3


@frappe.whitelist()
def get_inventory_dashboard():
    frappe.only_for(ROLES)
    today = getdate(nowdate())
    sql = frappe.db.sql

    # ---------- Item counts (active stock items, total qty across warehouses) ----------
    items = sql("""select i.name, coalesce(sum(b.actual_qty),0) q from `tabItem` i
        join `tabBin` b on b.item_code=i.name
        where i.disabled=0 and i.is_stock_item=1 group by i.name""", as_dict=True)
    with_stock = sum(1 for r in items if flt(r.q) > 0)
    zero_stock = sum(1 for r in items if flt(r.q) == 0)
    negative = sum(1 for r in items if flt(r.q) < 0)

    tot = sql("""select coalesce(sum(stock_value),0) v,
        count(distinct case when actual_qty>0 then warehouse end) w from `tabBin`""", as_dict=True)[0]

    # ---------- Stock value by item group ----------
    groups = sql("""select i.item_group label, sum(b.stock_value) amount from `tabBin` b
        join `tabItem` i on i.name=b.item_code group by i.item_group
        having amount>0 order by amount desc limit 6""", as_dict=True)

    # ---------- Stock in vs out, last 6 months (transfers excluded) ----------
    start = get_first_day(add_months(today, -5))
    rows = {r.m: r for r in sql("""select date_format(posting_date,'%%Y-%%m') m,
        sum(case when stock_value_difference>0 then stock_value_difference else 0 end) r,
        sum(case when stock_value_difference<0 then -stock_value_difference else 0 end) c
        from `tabStock Ledger Entry` where is_cancelled=0 and posting_date>=%s
        and not (voucher_type='Stock Entry' and voucher_no in (select name from `tabStock Entry`
            where purpose in ('Material Transfer','Material Transfer for Manufacture','Send to Subcontractor')))
        group by m""", (start,), as_dict=True)}
    trend = []
    for i in range(5, -1, -1):
        d = add_months(get_first_day(today), -i)
        r = rows.get(d.strftime("%Y-%m"))
        trend.append({"label": d.strftime("%b"), "received": flt(r.r) if r else 0, "consumed": flt(r.c) if r else 0})

    # ---------- Below reorder level ----------
    ro = sql("""select ir.parent item_code, i.item_name, i.stock_uom uom, ir.warehouse,
        ir.warehouse_reorder_level lvl, coalesce(b.actual_qty,0) qty, coalesce(b.ordered_qty,0) ordered
        from `tabItem Reorder` ir join `tabItem` i on i.name=ir.parent and i.disabled=0
        left join `tabBin` b on b.item_code=ir.parent and b.warehouse=ir.warehouse
        where ir.warehouse_reorder_level>0 and coalesce(b.actual_qty,0)<ir.warehouse_reorder_level
        order by (ir.warehouse_reorder_level-coalesce(b.actual_qty,0)) desc""", as_dict=True)
    below = [{"item": r.item_name or r.item_code, "item_code": r.item_code, "qty": flt(r.qty), "level": flt(r.lvl),
              "ordered": flt(r.ordered), "uom": r.uom} for r in ro]

    # ---------- Shortage for open Work Orders ----------
    wo = sql("""select woi.parent wo, woi.item_code, woi.item_name,
        greatest(woi.required_qty-woi.transferred_qty,0) need, w.planned_start_date psd,
        (select coalesce(sum(actual_qty),0) from `tabBin` where item_code=woi.item_code) stock
        from `tabWork Order Item` woi join `tabWork Order` w on w.name=woi.parent
        where w.docstatus=1 and w.status in ('Not Started','In Process')""", as_dict=True)
    short = []
    for r in wo:
        if flt(r.need) > flt(r.stock):
            short.append({"wo": r.wo, "item": r.item_name or r.item_code, "item_code": r.item_code,
                          "short_by": flt(r.need) - flt(r.stock),
                          "days": date_diff(getdate(r.psd), today) if r.psd else None})
    short.sort(key=lambda x: (x["days"] is None, x["days"] or 0))
    reorder_codes = {b["item_code"] for b in below}
    wo_items = len({s["item_code"] for s in short} & reorder_codes)

    # ---------- Stock ageing (days since last movement, by value) ----------
    ageing = [0.0] * 4
    for r in sql("""select b.stock_value v, m.d from `tabBin` b
        left join (select item_code, warehouse, max(posting_date) d from `tabStock Ledger Entry`
            where is_cancelled=0 group by item_code, warehouse) m
        on m.item_code=b.item_code and m.warehouse=b.warehouse where b.actual_qty>0""", as_dict=True):
        ageing[_age_bucket(date_diff(today, r.d) if r.d else 9999)] += flt(r.v)

    # ---------- Material Requests ----------
    mr = frappe.get_all("Material Request",
        filters={"docstatus": 1, "status": ["in", ["Pending", "Partially Ordered"]]},
        fields=["name", "material_request_type", "schedule_date"], order_by="schedule_date asc", limit_page_length=6)
    counts = {}
    if mr:
        for r in sql("select parent, count(*) c from `tabMaterial Request Item` where parent in %s group by parent",
                     (tuple(x.name for x in mr),), as_dict=True):
            counts[r.parent] = r.c
    requests = [{"name": m.name, "type": m.material_request_type, "items": counts.get(m.name, 0),
                 "days": date_diff(getdate(m.schedule_date), today) if m.schedule_date else None} for m in mr]

    # ---------- Recent stock movements ----------
    moves = sql("""select voucher_type, voucher_no, item_code, actual_qty, stock_uom from `tabStock Ledger Entry`
        where is_cancelled=0 order by posting_date desc, creation desc limit 6""", as_dict=True)

    # ---------- Received, not billed ----------
    pr = frappe.get_all("Purchase Receipt",
        filters={"docstatus": 1, "is_return": 0, "per_billed": ["<", 100], "status": ["not in", ["Closed", "Cancelled"]]},
        fields=["grand_total", "per_billed", "posting_date"], limit_page_length=0)
    unbilled = {"amount": sum(flt(p.grand_total) * (100 - flt(p.per_billed)) / 100 for p in pr), "count": len(pr),
                "oldest_days": max([date_diff(today, p.posting_date) for p in pr] or [0])}

    # ---------- Needs attention ----------
    no_reorder = sql("""select count(*) from `tabItem` i where i.disabled=0 and i.is_stock_item=1
        and exists (select 1 from `tabBin` b where b.item_code=i.name and b.actual_qty>0)
        and not exists (select 1 from `tabItem Reorder` r where r.parent=i.name)""")[0][0]
    try:
        expiring = frappe.db.count("Batch", {"disabled": 0, "batch_qty": [">", 0],
                                             "expiry_date": ["between", [today, add_days(today, 30)]]})
    except Exception:
        expiring = 0
    attention = {"draft_entries": frappe.db.count("Stock Entry", {"docstatus": 0}),
                 "no_reorder": no_reorder, "expiring": expiring}

    return {
        "summary": {"stock_value": flt(tot.v), "warehouses": cint_(tot.w), "with_stock": with_stock,
                    "zero_stock": zero_stock, "negative": negative, "total_items": len(items),
                    "below_reorder": len(below), "reorder_for_wo": wo_items},
        "groups": groups,
        "trend": trend,
        "below": below[:6],
        "short": short[:6],
        "ageing": [{"label": l, "amount": a} for l, a in zip(AGE_LABELS, ageing)],
        "requests": requests,
        "moves": [{"voucher": m.voucher_no, "type": m.voucher_type, "item": m.item_code,
                   "qty": flt(m.actual_qty), "uom": m.stock_uom} for m in moves],
        "unbilled": unbilled,
        "attention": attention,
    }


def cint_(v):
    return int(v or 0)
