# Copyright (c) 2026, Power Partner Global Pvt Ltd
import frappe
from frappe.model.document import Document


class PPGPLException(Document):
	def validate(self):
		before = self.get_doc_before_save()
		if self.reviewed and (not before or not before.reviewed):
			self.reviewed_by = frappe.session.user
		if not self.reviewed:
			self.reviewed_by = None
