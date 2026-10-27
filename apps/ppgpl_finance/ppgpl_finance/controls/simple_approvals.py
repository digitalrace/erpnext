# Copyright (c) 2026, Power Partner Global Pvt Ltd
"""Approval level for Journal Entry, Expense Claim and Employee Advance."""

from ppgpl_finance.controls import approval


def journal_entry_level(doc):
	return approval.get_level("Journal Entry", doc.total_debit), None


def expense_claim_level(doc):
	amount = doc.total_sanctioned_amount or doc.total_claimed_amount
	return approval.get_level("Expense Claim", amount), None


def employee_advance_level(doc):
	return approval.get_level("Employee Advance", doc.advance_amount), None


def journal_entry_validate(doc, method=None):
	level, _ = journal_entry_level(doc)
	approval.set_level(doc, level)
	approval.assert_unchanged(
		doc,
		["total_debit", "total_credit"],
		child_table="accounts",
		child_fields=["account", "party", "debit_in_account_currency", "credit_in_account_currency"],
	)


def expense_claim_validate(doc, method=None):
	level, _ = expense_claim_level(doc)
	approval.set_level(doc, level)


def employee_advance_validate(doc, method=None):
	level, _ = employee_advance_level(doc)
	approval.set_level(doc, level)
	approval.assert_unchanged(doc, ["employee", "advance_amount"])
