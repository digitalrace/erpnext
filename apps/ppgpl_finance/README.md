## PPGPL Finance

Financial control and delegation of financial powers for Power Partner Global Pvt. Ltd. and M/s Power Partner,
implementing SOP **PPGPL/FIN/SOP/2026-27/001** on ERPNext v16.

### What it adds

- **PPGPL Finance Settings** – names of L1/L2/L3/CMD, approval limits per document and category, rollout phase
  (CMD approves all → half limits → full limits), payment days, petty-cash floats and alert switches.
- **Approval workflows** for Payment Entry, Purchase Order, Purchase Invoice (three-way match), Journal Entry,
  Expense Claim, Employee Advance, Supplier (new-vendor approval) and Bank Account (call-back + CMD approval).
- **Controls** – approval level set by the server on every save; amounts and parties locked once a document is
  with an approver; no submission around the workflow; supplier payments only to CMD-approved bank accounts;
  supplier disabled until approved; PO + receipt required before an invoice; project mandatory; change tracking.
- **Reports** – Payment Proposal (create draft payments for ticked invoices), Release Batch (approved payments and
  the bank upload CSV), Daily Cash Position, Payment Approval Register; **PPGPL Exception** register.
- **Alerts and emails** – instant alerts to the CMD (non-PO and off-cycle payments, bank account added or changed,
  cancellations, amendments); daily cash position, daily exceptions, weekly review and a reminder before each payment day.
- **Finance Control** workspace with dashboard cards, and a screen-by-screen **Walkthrough** served at
  `/assets/ppgpl_finance/walkthrough/index.html` (also a tile on the workspace).

### Install

```bash
cd ~/frappe-bench
bench get-app /path/to/ppgpl_finance      # or the Git URL where you keep it
bench --site <your-site> install-app ppgpl_finance
bench --site <your-site> migrate
bench build --app ppgpl_finance
bench restart
```

Then open **PPGPL Finance Settings**, select the four users and save. Start in *Phase 1 - CMD approves all*.

Requires ERPNext v16. HRMS v16 is optional (Expense Claim and Employee Advance workflows are added when it is installed).

### Security and rollout notes (patched build)

- Dashboard Number Card methods enforce server-side finance-role checks; hiding a card in Desk is not treated as authorization.
- Existing Supplier and Bank Account records are not automatically assigned the `Approved` workflow state. Review and approve legacy master records through the agreed migration/audit process.
- The installer does not overwrite Company / Accounts Settings frozen-period posting permissions or force site-wide Buying Settings. Configure those policies explicitly with the ERPNext administrator after reviewing the current site configuration.
- The `project_mandatory` option only adds the mandatory Property Setter when enabled; disabling the option does not automatically restore a prior site-specific property value. Review Property Setters when changing policy.
- Static regression tests are included under `ppgpl_finance/tests`. They do not replace integration tests on a disposable ERPNext v16 site.

**Before production:** take a backup, install on staging first, verify existing workflows and role permissions, and test the payment lifecycle with non-production records. This archive has not been runtime-tested against a live ERPNext v16 site.
