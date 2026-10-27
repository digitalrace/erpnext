"""
Birthday card API for the HR tab of the Management Dashboard.

Method path used by the frontend:
    ppg_dashboard.api.birthday_dashboard.get_birthdays

Active employees only. 29 Feb birthdays are shown on 28 Feb in non-leap years.
"""

import frappe
from frappe.utils import date_diff, getdate, today

UPCOMING_DAYS = 7


def _next_birthday(dob, as_of):
    for year in (as_of.year, as_of.year + 1):
        try:
            d = dob.replace(year=year)
        except ValueError:  # 29 Feb in a non-leap year
            d = dob.replace(year=year, day=28)
        if d >= as_of:
            return d
    return None


@frappe.whitelist()
def get_birthdays(as_of_date=None, days=UPCOMING_DAYS, company=None):
    frappe.has_permission("Employee", "read", throw=True)

    as_of = getdate(as_of_date or today())
    days = int(days or UPCOMING_DAYS)

    filters = {"status": "Active", "date_of_birth": ["is", "set"]}
    if company:
        filters["company"] = company

    employees = frappe.get_list(
        "Employee",
        filters=filters,
        fields=["name", "employee_name", "department", "designation", "image", "date_of_birth"],
        limit_page_length=0,
    )

    todays, upcoming, month_count = [], [], 0
    for e in employees:
        dob = getdate(e.date_of_birth)
        nb = _next_birthday(dob, as_of)
        if not nb:
            continue
        in_days = date_diff(nb, as_of)
        if nb.month == as_of.month and nb.year == as_of.year:
            month_count += 1
        row = {
            "name": e.name,
            "employee_name": e.employee_name,
            "department": (e.department or "").rsplit(" - ", 1)[0] or None,
            "designation": e.designation,
            "image": e.image,
            "date": str(nb),
            "in_days": in_days,
        }
        if in_days == 0:
            todays.append(row)
        elif in_days <= days:
            upcoming.append(row)

    todays.sort(key=lambda r: r["employee_name"] or "")
    upcoming.sort(key=lambda r: (r["in_days"], r["employee_name"] or ""))

    missing = frappe.db.count(
        "Employee", dict({"status": "Active", "date_of_birth": ["is", "not set"]}, **({"company": company} if company else {}))
    )

    return {
        "as_of_date": str(as_of),
        "days": days,
        "today": todays,
        "upcoming": upcoming,
        "month_count": month_count,
        "missing_dob": missing,
    }
