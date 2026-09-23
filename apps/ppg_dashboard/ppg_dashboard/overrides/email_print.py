import frappe
from frappe.utils.pdf import get_pdf as frappe_get_pdf


def get_email_pdf(print_format, html, options=None, output=None):
    """
    PDF generator specifically for Attach Document Print / email.

    Uses Frappe's Chrome PDF generator with the same rendered
    print HTML, while keeping CSS page sizing and print CSS intact.
    """

    options = options or {}

    # Force Chrome for email attachment PDF
    options["pdf_generator"] = "chrome"

    # Keep CSS @page / print layout as the source of truth
    options["preferCSSPageSize"] = True

    # Do not add artificial browser margins
    options["margin-top"] = 0
    options["margin-bottom"] = 0
    options["margin-left"] = 0
    options["margin-right"] = 0

    return frappe_get_pdf(
        html,
        options=options,
        output=output,
        pdf_generator="chrome",
    )
