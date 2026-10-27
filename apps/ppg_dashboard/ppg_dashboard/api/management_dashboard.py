import frappe

from ppg_dashboard.ppgpl_dashboard.page.management_dashboard.management_dashboard import (
    get_dashboard_data as _get_dashboard_data,
)


@frappe.whitelist()
def get_dashboard_data(as_of_date=None, period="MTD"):
    return _get_dashboard_data(
        as_of_date=as_of_date,
        period=period,
    )


@frappe.whitelist()
def get_sales_dashboard(as_of_date=None, period="MTD", custom_from_date=None, custom_to_date=None):
    """
    Detailed management Sales dashboard.

    Revenue       -> Submitted Sales Invoice
    Order Value   -> Submitted Sales Order
    Quotations    -> Submitted Quotations
    Pending SO    -> Submitted SO not fully delivered
    Delayed SO    -> Pending SO whose delivery_date is before as_of_date
    """

    from datetime import date, timedelta
    from frappe.utils import getdate, add_months

    end_date = getdate(as_of_date or frappe.utils.today())

    if period == "Custom":
        if not custom_from_date or not custom_to_date:
            frappe.throw("Custom period requires From Date and To Date")

        start_date = getdate(custom_from_date)
        end_date = getdate(custom_to_date)

        if start_date > end_date:
            frappe.throw("From Date cannot be after To Date")

    elif period == "QTD":
        quarter = (end_date.month - 1) // 3
        start_date = date(
            end_date.year,
            quarter * 3 + 1,
            1
        )

    elif period == "YTD":
        start_date = date(
            end_date.year,
            1,
            1
        )

    else:
        # MTD / Custom fallback
        start_date = end_date.replace(day=1)

    # --------------------------------------------------------
    # KPI
    # --------------------------------------------------------

    revenue = frappe.db.sql("""
        SELECT COALESCE(SUM(base_grand_total), 0)
        FROM `tabSales Invoice`
        WHERE docstatus = 1
          AND posting_date BETWEEN %s AND %s
          AND is_return = 0
    """, (start_date, end_date))[0][0] or 0

    order_value = frappe.db.sql("""
        SELECT COALESCE(SUM(base_grand_total), 0)
        FROM `tabSales Order`
        WHERE docstatus = 1
          AND transaction_date BETWEEN %s AND %s
    """, (start_date, end_date))[0][0] or 0

    quotation_data = frappe.db.sql("""
        SELECT
            COUNT(*) AS quotation_count,
            COALESCE(SUM(base_grand_total), 0) AS quotation_value
        FROM `tabQuotation`
        WHERE docstatus = 1
          AND transaction_date BETWEEN %s AND %s
    """, (start_date, end_date), as_dict=True)[0]

    quotation_count = quotation_data.quotation_count or 0
    quotation_value = quotation_data.quotation_value or 0

    open_quotation = frappe.db.sql("""
        SELECT
            COUNT(*) AS count,
            COALESCE(SUM(base_grand_total), 0) AS value
        FROM `tabQuotation`
        WHERE docstatus = 1
          AND transaction_date BETWEEN %s AND %s
    """, (start_date, end_date), as_dict=True)[0]

    sales_orders = frappe.db.count(
        "Sales Order",
        filters={
            "docstatus": 1,
            "transaction_date": ["between", [start_date, end_date]]
        }
    )

    pending_orders = frappe.db.sql("""
        SELECT COUNT(*)
        FROM `tabSales Order`
        WHERE docstatus = 1
          AND transaction_date BETWEEN %s AND %s
          AND COALESCE(per_delivered, 0) < 100
          AND status NOT IN (
              'Completed',
              'Closed',
              'Cancelled'
          )
    """, (start_date, end_date))[0][0] or 0

    delayed_orders = frappe.db.sql("""
        SELECT COUNT(*)
        FROM `tabSales Order`
        WHERE docstatus = 1
          AND COALESCE(per_delivered, 0) < 100
          AND status NOT IN (
              'Completed',
              'Closed',
              'Cancelled'
          )
          AND delivery_date IS NOT NULL
          AND delivery_date < %s
    """, (end_date,))[0][0] or 0

    conversion = (
        round((sales_orders / quotation_count) * 100, 1)
        if quotation_count else 0
    )

    avg_deal_size = (
        round(order_value / sales_orders, 2)
        if sales_orders else 0
    )

    # --------------------------------------------------------
    # QUOTATION PIPELINE
    # --------------------------------------------------------

    pipeline_rows = frappe.db.sql("""
        SELECT
            status,
            COUNT(*) AS count,
            COALESCE(SUM(base_grand_total), 0) AS value
        FROM `tabQuotation`
        WHERE docstatus = 1
          AND transaction_date BETWEEN %s AND %s
        GROUP BY status
    """, (start_date, end_date), as_dict=True)

    pipeline = {
        "open": 0,
        "ordered": 0,
        "lost": 0,
        "expired": 0
    }

    pipeline_value = {
        "open": 0,
        "ordered": 0,
        "lost": 0,
        "expired": 0
    }

    for row in pipeline_rows:
        status = (row.status or "").lower()

        if status in ("open", "replied", "partially ordered"):
            key = "open"
        elif status == "ordered":
            key = "ordered"
        elif status == "lost":
            key = "lost"
        elif status == "expired":
            key = "expired"
        else:
            continue

        pipeline[key] += row.count or 0
        pipeline_value[key] += row.value or 0

    pipeline_total = sum(pipeline.values()) or 1

    pipeline["percent"] = {
        key: round((value / pipeline_total) * 100, 1)
        for key, value in pipeline.items()
        if key in ("open", "ordered", "lost", "expired")
    }

    # --------------------------------------------------------
    # EXPIRING QUOTATIONS
    # --------------------------------------------------------

    expiry_date = end_date + timedelta(days=7)

    expiring = frappe.db.sql("""
        SELECT
            name,
            customer_name,
            base_grand_total,
            valid_till,
            status
        FROM `tabQuotation`
        WHERE docstatus = 1
          AND valid_till BETWEEN %s AND %s
          AND status NOT IN (
              'Ordered',
              'Lost',
              'Expired',
              'Cancelled'
          )
        ORDER BY valid_till
        LIMIT 8
    """, (end_date, expiry_date), as_dict=True)

    for row in expiring:
        row["days_left"] = max(
            (getdate(row.valid_till) - end_date).days,
            0
        )

    # --------------------------------------------------------
    # MONTHLY ORDERS VS REVENUE - LAST 6 MONTHS
    # --------------------------------------------------------

    months = []

    cursor = end_date.replace(day=1)

    for offset in range(5, -1, -1):
        m = add_months(cursor, -offset)
        months.append({
            "key": m.strftime("%Y-%m"),
            "label": m.strftime("%b")
        })

    monthly_orders = frappe.db.sql("""
        SELECT
            DATE_FORMAT(transaction_date, '%%Y-%%m') AS month_key,
            COALESCE(SUM(base_grand_total), 0) AS value
        FROM `tabSales Order`
        WHERE docstatus = 1
          AND transaction_date >= DATE_SUB(%s, INTERVAL 5 MONTH)
          AND transaction_date <= %s
        GROUP BY month_key
    """, (end_date, end_date), as_dict=True)

    monthly_revenue = frappe.db.sql("""
        SELECT
            DATE_FORMAT(posting_date, '%%Y-%%m') AS month_key,
            COALESCE(SUM(base_grand_total), 0) AS value
        FROM `tabSales Invoice`
        WHERE docstatus = 1
          AND posting_date >= DATE_SUB(%s, INTERVAL 5 MONTH)
          AND posting_date <= %s
          AND is_return = 0
        GROUP BY month_key
    """, (end_date, end_date), as_dict=True)

    order_map = {
        row.month_key: float(row.value or 0)
        for row in monthly_orders
    }

    revenue_map = {
        row.month_key: float(row.value or 0)
        for row in monthly_revenue
    }

    monthly = []

    for month in months:
        monthly.append({
            "label": month["label"],
            "orders": order_map.get(month["key"], 0),
            "revenue": revenue_map.get(month["key"], 0)
        })

    # --------------------------------------------------------
    # RECEIVABLE AGING
    # --------------------------------------------------------

    aging = {
        "0_30": 0,
        "31_60": 0,
        "61_90": 0,
        "90_plus": 0
    }

    invoices = frappe.db.sql("""
        SELECT
            outstanding_amount,
            due_date
        FROM `tabSales Invoice`
        WHERE docstatus = 1
          AND outstanding_amount > 0
          AND posting_date <= %s
    """, (end_date,), as_dict=True)

    for row in invoices:

        due = getdate(row.due_date or end_date)
        days = (end_date - due).days
        amount = float(row.outstanding_amount or 0)

        if days <= 30:
            aging["0_30"] += amount
        elif days <= 60:
            aging["31_60"] += amount
        elif days <= 90:
            aging["61_90"] += amount
        else:
            aging["90_plus"] += amount

    aging_total = sum(aging.values())

    # --------------------------------------------------------
    # SALES TEAM
    # --------------------------------------------------------

    sales_team = []

    # Actual Sales Persons
    sales_persons = frappe.db.sql("""
        SELECT
            sp.name AS sales_person,
            sp.sales_person_name,
            e.user_id
        FROM `tabSales Person` sp
        LEFT JOIN `tabEmployee` e
            ON e.name = sp.employee
        WHERE sp.is_group = 0
          AND sp.enabled = 1
        ORDER BY sp.sales_person_name
    """, as_dict=True)

    for sp in sales_persons:

        # Submitted quotations belonging to this salesperson
        quotation_count = frappe.db.sql("""
            SELECT COUNT(DISTINCT q.name)
            FROM `tabQuotation` q
            INNER JOIN `tabEmployee` e
                ON e.user_id = q.owner
            INNER JOIN `tabSales Person` sp
                ON sp.employee = e.name
            WHERE q.docstatus = 1
              AND q.transaction_date BETWEEN %s AND %s
              AND sp.name = %s
        """, (start_date, end_date, sp.sales_person))[0][0] or 0

        # Sales Orders linked through quotation
        order_data = frappe.db.sql("""
            SELECT
                COUNT(*) AS orders,
                COALESCE(SUM(order_value), 0) AS order_value
            FROM (
                SELECT
                    so.name,
                    so.base_grand_total AS order_value
                FROM `tabSales Order` so
                INNER JOIN `tabSales Order Item` soi
                    ON soi.parent = so.name
                INNER JOIN `tabQuotation` q
                    ON q.name = soi.prevdoc_docname
                INNER JOIN `tabEmployee` e
                    ON e.user_id = q.owner
                INNER JOIN `tabSales Person` sp
                    ON sp.employee = e.name
                WHERE so.docstatus = 1
                  AND so.transaction_date BETWEEN %s AND %s
                  AND sp.name = %s
                GROUP BY so.name, so.base_grand_total
            ) orders_data
        """, (start_date, end_date, sp.sales_person), as_dict=True)[0]

        orders = int(order_data.orders or 0)
        order_value = float(order_data.order_value or 0)

        sales_team.append({
            "sales_person": sp.sales_person,
            "sales_person_name": sp.sales_person_name,
            "quotations": int(quotation_count),
            "orders": orders,
            "order_value": order_value,
            "conversion": round((orders / quotation_count) * 100, 1)
                if quotation_count else 0,
            "target": 0,
            "target_percent": 0
        })

    # --------------------------------------------------------
    # UNASSIGNED SALES ORDERS
    # --------------------------------------------------------

    unassigned = frappe.db.sql("""
        SELECT
            COUNT(*) AS orders,
            COALESCE(SUM(order_value), 0) AS order_value
        FROM (
            SELECT
                so.name,
                so.base_grand_total AS order_value
            FROM `tabSales Order` so
            LEFT JOIN `tabSales Order Item` soi
                ON soi.parent = so.name
            LEFT JOIN `tabQuotation` q
                ON q.name = soi.prevdoc_docname
            LEFT JOIN `tabEmployee` e
                ON e.user_id = q.owner
            LEFT JOIN `tabSales Person` sp
                ON sp.employee = e.name
            WHERE so.docstatus = 1
              AND so.transaction_date BETWEEN %s AND %s
              AND sp.name IS NULL
            GROUP BY so.name, so.base_grand_total
        ) unassigned_orders
    """, (start_date, end_date), as_dict=True)[0]

    unassigned_orders = int(unassigned.orders or 0)
    unassigned_value = float(unassigned.order_value or 0)

    if unassigned_orders:
        sales_team.append({
            "sales_person": None,
            "sales_person_name": "Unassigned",
            "quotations": 0,
            "orders": unassigned_orders,
            "order_value": unassigned_value,
            "conversion": 0,
            "target": 0,
            "target_percent": 0
        })

    sales_team.sort(
        key=lambda x: (x["orders"], x["quotations"], x["order_value"]),
        reverse=True
    )

    # --------------------------------------------------------
    # DELAYED ORDERS
    # --------------------------------------------------------

    delayed = frappe.db.sql("""
        SELECT
            name AS sales_order,
            customer,
            customer_name,
            base_grand_total,
            delivery_date,
            status,
            DATEDIFF(%s, delivery_date) AS delay_days
        FROM `tabSales Order`
        WHERE docstatus = 1
          AND COALESCE(per_delivered, 0) < 100
          AND status NOT IN (
              'Completed',
              'Closed',
              'Cancelled'
          )
          AND delivery_date IS NOT NULL
          AND delivery_date < %s
        ORDER BY delay_days DESC
        LIMIT 12
    """, (end_date, end_date), as_dict=True)

    # --------------------------------------------------------
    # TOP CUSTOMERS
    # --------------------------------------------------------

    top_customers = frappe.db.sql("""
        SELECT
            customer,
            customer_name,
            COUNT(*) AS orders,
            COALESCE(SUM(base_grand_total), 0) AS order_value
        FROM `tabSales Order`
        WHERE docstatus = 1
          AND transaction_date BETWEEN %s AND %s
        GROUP BY customer, customer_name
        ORDER BY order_value DESC
        LIMIT 8
    """, (start_date, end_date), as_dict=True)

    # --------------------------------------------------------
    # TERRITORY
    # --------------------------------------------------------

    territories = frappe.db.sql("""
        SELECT
            territory,
            COUNT(*) AS orders,
            COALESCE(SUM(base_grand_total), 0) AS order_value
        FROM `tabSales Order`
        WHERE docstatus = 1
          AND transaction_date BETWEEN %s AND %s
          AND territory IS NOT NULL
          AND territory != ''
        GROUP BY territory
        ORDER BY order_value DESC
        LIMIT 8
    """, (start_date, end_date), as_dict=True)

    # --------------------------------------------------------
    # ITEM GROUP
    # --------------------------------------------------------

    item_groups = frappe.db.sql("""
        SELECT
            soi.item_group,
            COUNT(DISTINCT soi.parent) AS orders,
            COALESCE(SUM(soi.base_amount), 0) AS order_value
        FROM `tabSales Order Item` soi
        INNER JOIN `tabSales Order` so
            ON so.name = soi.parent
        WHERE so.docstatus = 1
          AND so.transaction_date BETWEEN %s AND %s
          AND soi.item_group IS NOT NULL
          AND soi.item_group != ''
        GROUP BY soi.item_group
        ORDER BY order_value DESC
        LIMIT 8
    """, (start_date, end_date), as_dict=True)

    return {
        "as_of_date": str(end_date),
        "period": period,
        "period_start": str(start_date),

        "revenue": float(revenue or 0),
        "order_value": float(order_value or 0),

        "quotation_count": quotation_count,
        "quotation_value": float(quotation_value or 0),

        "open_quotations": int(open_quotation.count or 0),
        "open_quotation_value": float(open_quotation.value or 0),

        "sales_orders": int(sales_orders or 0),
        "pending_orders": int(pending_orders or 0),
        "delayed_orders": int(delayed_orders or 0),

        "conversion": conversion,
        "avg_deal_size": avg_deal_size,

        "pipeline": pipeline,
        "pipeline_value": pipeline_value,

        "expiring": expiring,
        "monthly": monthly,
        "aging": aging,
        "aging_total": aging_total,

        "sales_team": sales_team,
        "delayed": delayed,
        "top_customers": top_customers,
        "territories": territories,
        "item_groups": item_groups
    }
