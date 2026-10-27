import json
import frappe

HR_ROLES = ["HR Manager", "HR User"]


def run():
	jp = frappe.get_app_path("ppg_dashboard", "ppgpl_dashboard", "page", "management_dashboard", "management_dashboard.json")
	with open(jp) as f:
		d = json.load(f)
	roles = d.setdefault("roles", [])
	have = {r.get("role") for r in roles}
	for role in HR_ROLES:
		if not frappe.db.exists("Role", role):
			print("SKIP, role not found:", role)
		elif role not in have:
			roles.append({"role": role})
			print("ADDED to page:", role)
	with open(jp, "w") as f:
		json.dump(d, f, indent=1)
		f.write("\n")
	frappe.reload_doc("ppgpl_dashboard", "page", "management_dashboard", force=True)
	frappe.db.commit()
	print("Page roles now:", [r.role for r in frappe.get_doc("Page", "management-dashboard").roles])
