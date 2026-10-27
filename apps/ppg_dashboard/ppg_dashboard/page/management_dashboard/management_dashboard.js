
/*
 * Quality section renderer for the Management Dashboard.
 * render_data(data) calls render_quality_dashboard(data).
 */
(function () {
	"use strict";

	const METHOD = "ppg_dashboard.api.quality_dashboard.get_quality_dashboard";
	const STYLE_ID = "ppgq-style";

	const CSS = `
.ppgq{font-size:13px;color:var(--text-color,#1f272e)}
.ppgq *{box-sizing:border-box}
.ppgq-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.ppgq-title{font-size:16px;font-weight:600}
.ppgq-muted{color:var(--text-muted,#6b7280);font-size:12px}
.ppgq-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.ppgq-btn,.ppgq-pbtn{padding:6px 12px;border:1px solid var(--border-color,#d1d5db);border-radius:999px;background:transparent;color:inherit;cursor:pointer;font-size:12px}
.ppgq-btn{border-radius:6px}
.ppgq-pbtn.on{background:var(--text-color,#1f272e);color:var(--card-bg,#fff);border-color:transparent}
.ppgq-click{cursor:pointer;transition:box-shadow .15s}
.ppgq-click:hover{box-shadow:0 0 0 1px var(--border-color,#9ca3af)}
.ppgq-ln{text-decoration:underline;cursor:pointer}
.ppgq-banner{border-radius:8px;padding:10px 12px;margin-bottom:12px;line-height:1.5}
.ppgq-banner.bad{background:#fdeaea;color:#a42626}.ppgq-banner.warn{background:#fff6e0;color:#8a5a00}.ppgq-banner.good{background:#e6f6e6;color:#0a6a0a}
.ppgq-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:12px}
.ppgq-kpi{border:1px solid var(--border-color,#e5e7eb);border-radius:8px;padding:10px 12px;background:var(--card-bg,#fff)}
.ppgq-kpi .v{font-size:22px;font-weight:600;margin:2px 0}
.ppgq-red{color:#d03b3b}.ppgq-amber{color:#b7791f}.ppgq-green{color:#0a8a0a}
.ppgq-h{display:flex;justify-content:space-between;gap:8px;margin:14px 0 8px;font-weight:600}
.ppgq-h span{font-weight:400;color:var(--text-muted,#6b7280);font-size:11px}
.ppgq-grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:12px}
.ppgq-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-bottom:12px}
.ppgq-box{border:1px solid var(--border-color,#e5e7eb);border-radius:8px;padding:12px 14px;background:var(--card-bg,#fff)}
.ppgq-stage .v{font-size:22px;font-weight:600;margin:2px 0}
.ppgq-bar{height:6px;border-radius:3px;background:var(--control-bg,#f3f4f6);margin:8px 0;overflow:hidden}
.ppgq-bar i{display:block;height:100%}
.ppgq-rrow{display:flex;align-items:center;gap:10px;margin:8px 0;padding:2px 4px;border-radius:4px}
.ppgq-rlab{width:42%;font-size:12px}
.ppgq-rtrk{flex:1;height:8px;border-radius:4px;background:var(--control-bg,#f3f4f6);overflow:hidden}
.ppgq-rtrk i{display:block;height:100%;background:#E24B4A}
.ppgq-week{display:flex;gap:8px;align-items:flex-end;height:130px;position:relative;margin-top:8px}
.ppgq-wcol{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;font-size:11px;color:var(--text-muted,#6b7280);padding:0 2px;border-radius:4px}
.ppgq-wbar{width:100%;border-radius:3px 3px 0 0}
.ppgq-tline{position:absolute;left:0;right:0;border-top:1px dashed var(--text-muted,#9ca3af);pointer-events:none}
.ppgq-tabs{display:flex;gap:2px;border-bottom:1px solid var(--border-color,#e5e7eb);margin:14px 0 10px;flex-wrap:wrap}
.ppgq-tab{padding:7px 14px;cursor:pointer;color:var(--text-muted,#6b7280);border:0;border-bottom:2px solid transparent;background:none;font-size:13px}
.ppgq-tab.on{color:var(--text-color,#1f272e);border-bottom-color:var(--text-color,#1f272e);font-weight:600}
.ppgq-scroll{overflow-x:auto}
.ppgq-table{width:100%;border-collapse:collapse;min-width:720px}
.ppgq-table th{text-align:left;font-weight:500;color:var(--text-muted,#6b7280);font-size:12px;padding:8px 10px 8px 0;border-bottom:1px solid var(--border-color,#e5e7eb);white-space:nowrap}
.ppgq-table td{padding:9px 10px 9px 0;border-bottom:1px solid var(--border-color,#eef0f2);white-space:nowrap}
.ppgq-table tr:last-child td{border-bottom:0}
.ppgq-pill{font-size:11px;padding:2px 8px;border-radius:6px;background:var(--control-bg,#f3f4f6);color:var(--text-muted,#6b7280)}
.ppgq-pill.bad{background:#fdeaea;color:#a42626}.ppgq-pill.good{background:#e6f6e6;color:#0a6a0a}.ppgq-pill.warn{background:#fff6e0;color:#8a5a00}
.ppgq-chip{display:inline-block;margin-bottom:8px;font-size:12px;padding:3px 10px;border-radius:999px;background:var(--control-bg,#f3f4f6)}
.ppgq-chip span{margin-left:8px;text-decoration:underline;cursor:pointer}
.ppgq-empty{padding:22px;text-align:center;color:var(--text-muted,#6b7280)}
.ppgq a.ppgq-doc{color:inherit;text-decoration:underline;text-decoration-color:var(--border-color,#c7ccd1)}
`;

	// ---- helpers ----------------------------------------------------------
	const esc = (v) => frappe.utils.escape_html(v == null ? "" : String(v));
	const attr = (o) => esc(JSON.stringify(o));
	const dateStr = (d) => (d ? frappe.datetime.str_to_user(d) : "–");
	const num = (v) => (Math.round((v || 0) * 100) / 100).toLocaleString("en-IN");
	const short = (s) => new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
	const waitTxt = (n) => (n <= 0 ? "today" : n === 1 ? "1 day" : n + " days");
	const waitPill = (n) => `<span class="ppgq-pill ${n >= 3 ? "bad" : n >= 1 ? "warn" : ""}">${n <= 0 ? "Today" : waitTxt(n)}</span>`;
	const agePill = (n) => `<span class="ppgq-pill ${n >= 14 ? "bad" : n >= 7 ? "warn" : ""}">${waitTxt(n)}</span>`;
	const doc = (doctype, name) =>
		name ? `<a href="#" class="ppgq-doc" data-doctype="${esc(doctype)}" data-name="${esc(name)}">${esc(name)}</a>` : "–";
	const passCls = (p, t) => (p == null ? "" : p >= t ? "ppgq-green" : p >= t - 10 ? "ppgq-amber" : "ppgq-red");
	const passColor = (p, t) => (p >= t ? "#1D9E75" : p >= t - 10 ? "#EF9F27" : "#E24B4A");
	const STAGE_LABEL = { incoming: "Incoming", process: "In-process", final: "Final" };
	const STAGE_TITLE = { incoming: "Incoming material", process: "In-process (job cards)", final: "Final and pre-dispatch" };

	function goList(doctype, filters) {
		frappe.route_options = filters || {};
		frappe.set_route("List", doctype);
	}

	function injectStyle() {
		if (document.getElementById(STYLE_ID)) return;
		const el = document.createElement("style");
		el.id = STYLE_ID;
		el.textContent = CSS;
		document.head.appendChild(el);
	}

	// ---- component --------------------------------------------------------
	class PPGQualityDashboard {
		constructor($el) {
			injectStyle();
			this.$el = $($el);
			this.args = {};
			this.period = "MTD";
			this.tab = "pending";
			this.filter = {};
			this.data = null;
			this.bind();
		}

		refresh(args = {}) {
			this.args = Object.assign({}, args);
			this.period = args.period || this.period || "MTD";
			return this.load();
		}

		setPeriod(p) {
			this.period = p;
			return this.load();
		}

		load() {
			this.$el.html(`<div class="ppgq-empty">Loading quality data…</div>`);
			return frappe
				.call({
					method: METHOD,
					args: { as_of_date: this.args.as_of_date, period: this.period, company: this.args.company },
				})
				.then((r) => {
					this.data = r.message;
					this.render();
				})
				.catch((err) => {
					console.error("Quality dashboard error:", err);
					this.$el.html(`<div class="ppgq-empty">Could not load quality data. Check the browser console and the Error Log.</div>`);
				});
		}

		render() {
			const d = this.data;
			if (!d) return;
			const pbtn = (p) => `<button class="ppgq-pbtn ${p === d.period ? "on" : ""}" data-act="period" data-period="${p}">${p}</button>`;
			this.$el.html(`
				<div class="ppgq">
					<div class="ppgq-head">
						<div><div class="ppgq-title">Quality</div><div class="ppgq-muted">Quality inspection status · as of ${esc(dateStr(d.as_of_date))}</div></div>
						<div class="ppgq-actions">${pbtn("MTD")}${pbtn("QTD")}${pbtn("YTD")}
							<button class="ppgq-btn" data-act="list" data-doctype="Quality Inspection" data-filters="{}">View QIs</button></div>
					</div>
					${this.banner(d)}
					${this.kpis(d)}
					<div class="ppgq-box" style="margin-bottom:12px">
						<div class="ppgq-h" style="margin-top:0">Inspection by stage <span>${esc(d.period)} · click a card to see its rejections</span></div>
						<div class="ppgq-grid3">${["incoming", "process", "final"].map((k) => this.stageCard(k, d)).join("")}</div>
					</div>
					<div class="ppgq-grid2">${this.reasonsCard(d)}${this.weeklyCard(d)}</div>
					<div id="ppgq-tabsbox" class="ppgq-box"></div>
				</div>`);
			this.paintTabs();
		}

		banner(d) {
			const s = d.summary, t = d.target;
			if (!s.inspected && !s.pending)
				return `<div class="ppgq-banner good">No inspections recorded in this period.</div>`;
			const blockers = d.pending.filter((p) => p.blocker);
			const lead = [];
			if (s.pass_rate != null && s.pass_rate < t) lead.push(`Pass rate is ${s.pass_rate}%, below the ${t}% target`);
			if (blockers.length)
				lead.push(`${blockers.length} of the ${s.pending} pending inspections ${blockers.length === 1 ? "is" : "are"} holding up work`);
			if (!lead.length)
				return `<div class="ppgq-banner good"><b>Pass rate is ${s.pass_rate == null ? "–" : s.pass_rate + "%"}</b> against a ${t}% target, and nothing is waiting on inspection.</div>`;
			const detail = blockers
				.slice(0, 3)
				.map((p) => `${esc(p.ref)} (${esc(p.item)}, ${waitTxt(p.waiting_days)}) blocks ${esc(p.blocker.label)}${p.blocker.late ? ", which is already past its promised date" : ""}`)
				.join(", ");
			const cls = s.pass_rate != null && s.pass_rate < t - 10 ? "bad" : "warn";
			return `<div class="ppgq-banner ${cls} ${blockers.length ? "ppgq-click" : ""}" ${blockers.length ? 'data-act="tab" data-tab="pending"' : ""}><b>${lead.join(", and ")}.</b>${detail ? " " + detail + "." : ""}</div>`;
		}

		kpis(d) {
			const s = d.summary, t = d.target;
			const range = { docstatus: 1, report_date: ["between", [d.from_date, d.to_date]] };
			const k = (label, value, sub, cls, attrs) =>
				`<div class="ppgq-kpi ppgq-click" ${attrs}><div class="ppgq-muted">${label}</div><div class="v ${cls || ""}">${value}</div><div class="ppgq-muted">${sub}</div></div>`;
			const list = (doctype, f) => `data-act="list" data-doctype="${doctype}" data-filters='${attr(f)}'`;
			const tab = (id) => `data-act="tab" data-tab="${id}"`;
			let html = "";
			html += k("Inspections done", s.inspected, esc(d.period), "", list("Quality Inspection", range));
			html += k("Pass rate", s.pass_rate == null ? "–" : s.pass_rate + "%", `Target ${t}%`, passCls(s.pass_rate, t), list("Quality Inspection", range));
			html += k("Rejected", s.rejected, s.reject_pct == null ? "–" : `${s.reject_pct}% of inspected`, s.rejected ? "ppgq-red" : "", tab("rejected"));
			html += k("Pending", s.pending, `Avg wait ${s.avg_wait} days`, s.pending ? "ppgq-amber" : "", tab("pending"));
			html += k("Open non-conformances", s.nc_open, s.nc_open ? `Oldest ${s.nc_oldest} days` : "None", s.nc_open ? "ppgq-red" : "", tab("nc"));
			if (s.actions_open != null) html += k("Open corrective actions", s.actions_open, "Quality Action", s.actions_open ? "ppgq-amber" : "", tab("actions"));
			if (d.complaints) html += k("High priority complaints", s.complaints_high, s.complaints_high ? `Open ${s.complaints_oldest} days` : "None", s.complaints_high ? "ppgq-red" : "", tab("complaints"));
			if (s.calib_due != null) html += k("Calibration due", s.calib_due, `${s.calib_overdue} overdue · next 30 days`, s.calib_overdue ? "ppgq-red" : s.calib_due ? "ppgq-amber" : "", tab("calibration"));
			return `<div class="ppgq-kpis">${html}</div>`;
		}

		stageCard(key, d) {
			const st = d.stages[key], t = d.target;
			const pct = st.inspected ? Math.round(((st.inspected - st.rejected) * 100) / st.inspected) : null;
			return `<div class="ppgq-box ppgq-stage ppgq-click" data-act="tab" data-tab="rejected" data-stage="${key}">
				<div class="ppgq-muted">${STAGE_TITLE[key]}</div>
				<div class="v ${passCls(pct, t)}">${pct == null ? "–" : pct + "%"}</div>
				<div class="ppgq-muted">${st.inspected} inspected · ${st.rejected} rejected</div>
				<div class="ppgq-bar"><i style="width:${pct == null ? 0 : pct}%;background:${pct == null ? "transparent" : passColor(pct, t + 5)}"></i></div>
				<div class="ppgq-muted"><span class="ppgq-ln" data-act="tab" data-tab="pending" data-stage="${key}">${st.pending} pending</span></div>
			</div>`;
		}

		reasonsCard(d) {
			const max = Math.max(...d.reasons.map((r) => r.count), 1);
			const rows = d.reasons.length
				? d.reasons
						.map(
							(r) => `<div class="ppgq-rrow ppgq-click" data-act="tab" data-tab="rejected" data-reason="${esc(r.reason)}">
							<div class="ppgq-rlab">${esc(r.reason)}</div>
							<div class="ppgq-rtrk"><i style="width:${(r.count / max) * 100}%"></i></div>
							<div style="width:24px;text-align:right">${r.count}</div></div>`
						)
						.join("")
				: `<div class="ppgq-empty">No rejections in this period.</div>`;
			return `<div class="ppgq-box"><div class="ppgq-h" style="margin-top:0">Why items were rejected <span>${d.summary.rejected} rejections</span></div>${rows}
				${d.rejection_note ? `<div class="ppgq-muted" style="margin-top:8px">${esc(d.rejection_note)}</div>` : ""}</div>`;
		}

		weeklyCard(d) {
			const t = d.target, lo = 50;
			const h = (p) => Math.max(((p - lo) / (100 - lo)) * 100, 3);
			const bars = d.weekly
				.map((w) => {
					const f = { docstatus: 1, report_date: ["between", [w.start, w.end]] };
					const bar = w.pass_pct == null
						? `<div class="ppgq-wbar" style="height:3%;background:var(--control-bg,#e5e7eb)"></div>`
						: `<div class="ppgq-wbar" style="height:${h(w.pass_pct)}%;background:${passColor(w.pass_pct, t + 5 - 0)}"></div>`;
					return `<div class="ppgq-wcol ppgq-click" data-act="list" data-doctype="Quality Inspection" data-filters='${attr(f)}' title="${w.inspected} inspected, ${w.rejected} rejected">
						<div>${w.pass_pct == null ? "–" : w.pass_pct}</div>${bar}<div style="margin-top:4px">${esc(short(w.start))}</div></div>`;
				})
				.join("");
			return `<div class="ppgq-box"><div class="ppgq-h" style="margin-top:0">Pass rate by week <span>Target ${t}%</span></div>
				<div class="ppgq-week" style="padding-bottom:30px"><div class="ppgq-tline" style="bottom:calc(30px + (100% - 30px) * ${(t - lo) / (100 - lo)})"></div>${bars}</div></div>`;
		}

		// ---- tabs -----------------------------------------------------------
		paintTabs() {
			const d = this.data;
			if (!d) return;
			const tabs = [
				["pending", `Pending inspections (${d.summary.pending})`, () => this.pendingTable(d)],
				["rejected", `Rejected (${d.summary.rejected})`, () => this.rejectedTable(d)],
				["nc", `Non-conformances (${d.summary.nc_open})`, () => this.recordsTable(d.nonconformances, "No open non-conformances.")],
			];
			if (d.complaints) tabs.push(["complaints", `Complaints (${d.complaints.length})`, () => this.complaintsTable(d.complaints)]);
			if (d.actions) tabs.push(["actions", `Corrective actions (${d.actions.length})`, () => this.recordsTable(d.actions, "No open corrective actions.")]);
			if (d.calibration) tabs.push(["calibration", `Calibration (${d.calibration.length})`, () => this.calibrationTable(d.calibration)]);
			tabs.push(["suppliers", "Suppliers", () => this.suppliersTable(d.suppliers)]);
			if (!tabs.some((t) => t[0] === this.tab)) this.tab = "pending";

			const active = tabs.find((t) => t[0] === this.tab);
			$("#ppgq-tabsbox").html(`
				<div class="ppgq-tabs">${tabs.map(([id, l]) => `<button class="ppgq-tab ${id === this.tab ? "on" : ""}" data-tab="${id}">${l}</button>`).join("")}</div>
				${this.chip()}${active[2]()}`);
		}

		chip() {
			const f = this.filter;
			const parts = [];
			if (f.stage) parts.push(STAGE_LABEL[f.stage] || f.stage);
			if (f.reason && this.tab === "rejected") parts.push(f.reason);
			return parts.length ? `<div class="ppgq-chip">Filtered: ${esc(parts.join(" · "))}<span data-act="clear">Clear</span></div>` : "";
		}

		openTab(id, filter = {}) {
			this.tab = id;
			this.filter = { stage: filter.stage, reason: filter.reason };
			this.paintTabs();
			const $box = $("#ppgq-tabsbox");
			if ($box.length && $box[0].scrollIntoView) $box[0].scrollIntoView({ behavior: "smooth", block: "nearest" });
		}

		pendingTable(d) {
			const rows = d.pending.filter((p) => !this.filter.stage || p.stage === this.filter.stage);
			if (!rows.length) return `<div class="ppgq-empty">No pending inspections.</div>`;
			const body = rows
				.map(
					(p) => `<tr>
						<td>${doc(p.ref_doctype, p.ref)}</td><td>${STAGE_LABEL[p.stage]}</td><td>${esc(p.item)}</td>
						<td>${esc(p.source)}</td><td>${num(p.qty)}</td><td>${waitPill(p.waiting_days)}</td>
						<td>${p.blocker ? doc(p.blocker.doctype, p.blocker.name).replace(esc(p.blocker.name) + "</a>", esc(p.blocker.label) + "</a>") : "–"}</td>
					</tr>`
				)
				.join("");
			return `<div class="ppgq-scroll"><table class="ppgq-table"><thead><tr><th>Reference</th><th>Stage</th><th>Item or operation</th><th>Source</th><th>Qty</th><th>Waiting</th><th>Holding up</th></tr></thead><tbody>${body}</tbody></table></div>`;
		}

		rejectedTable(d) {
			const f = this.filter;
			const rows = d.rejected.filter((r) => (!f.stage || r.stage === f.stage) && (!f.reason || r.reason === f.reason));
			if (!rows.length) return `<div class="ppgq-empty">No rejected inspections${f.stage || f.reason ? " for this filter" : " in this period"}.</div>`;
			const body = rows
				.map(
					(r) => `<tr>
						<td>${doc("Quality Inspection", r.name)}</td><td>${STAGE_LABEL[r.stage]}</td><td>${esc(r.item)}</td>
						<td>${esc(r.source)}</td><td>${esc(dateStr(r.date))}</td><td><span class="ppgq-pill bad">${esc(r.reason)}</span></td>
					</tr>`
				)
				.join("");
			return `<div class="ppgq-scroll"><table class="ppgq-table"><thead><tr><th>Inspection</th><th>Stage</th><th>Item</th><th>Source</th><th>Date</th><th>Reason</th></tr></thead><tbody>${body}</tbody></table></div>`;
		}

		recordsTable(rows, emptyMsg) {
			if (!rows || !rows.length) return `<div class="ppgq-empty">${emptyMsg}</div>`;
			const body = rows
				.map(
					(r) => `<tr>
						<td>${doc(r.doctype, r.name)}</td><td>${esc(r.kind || "–")}</td><td>${esc(r.detail)}</td><td>${esc(r.owner)}</td>
						<td><span class="ppgq-pill warn">${esc(r.status)}</span></td><td>${esc(dateStr(r.opened))}</td><td>${agePill(r.age_days)}</td>
					</tr>`
				)
				.join("");
			return `<div class="ppgq-scroll"><table class="ppgq-table"><thead><tr><th>Reference</th><th>Type</th><th>Procedure / detail</th><th>Owner</th><th>Status</th><th>Opened</th><th>Age</th></tr></thead><tbody>${body}</tbody></table></div>`;
		}

		complaintsTable(rows) {
			if (!rows.length) return `<div class="ppgq-empty">No open complaints.</div>`;
			const body = rows
				.map(
					(c) => `<tr>
						<td>${doc("Issue", c.name)}</td><td>${esc(c.subject || "–")}</td><td>${esc(c.customer || "–")}</td>
						<td><span class="ppgq-pill ${c.high ? "bad" : ""}">${esc(c.priority || "–")}</span></td>
						<td>${esc(c.status || "–")}</td><td>${agePill(c.age_days)}</td>
					</tr>`
				)
				.join("");
			return `<div class="ppgq-scroll"><table class="ppgq-table"><thead><tr><th>Issue</th><th>Subject</th><th>Customer</th><th>Priority</th><th>Status</th><th>Open</th></tr></thead><tbody>${body}</tbody></table></div>`;
		}

		calibrationTable(rows) {
			if (!rows.length) return `<div class="ppgq-empty">No calibrations due in the next 30 days.</div>`;
			const body = rows
				.map((l) => {
					const n = l.days_to_due;
					const pill = n == null ? "–" : n < 0
						? `<span class="ppgq-pill bad">Overdue by ${-n} days</span>`
						: `<span class="ppgq-pill ${n <= 7 ? "warn" : ""}">Due in ${n} days</span>`;
					return `<tr><td>${doc("Asset Maintenance Log", l.name)}</td><td>${esc(l.asset)}</td><td>${esc(l.task)}</td><td>${esc(dateStr(l.due_date))}</td><td>${pill}</td><td>${esc(l.owner)}</td></tr>`;
				})
				.join("");
			return `<div class="ppgq-scroll"><table class="ppgq-table"><thead><tr><th>Log</th><th>Asset</th><th>Task</th><th>Due</th><th>Status</th><th>Assigned to</th></tr></thead><tbody>${body}</tbody></table></div>`;
		}

		suppliersTable(rows) {
			if (!rows.length) return `<div class="ppgq-empty">No incoming inspections in this period.</div>`;
			const body = rows
				.map(
					(s) => `<tr>
						<td>${s.supplier_id ? doc("Supplier", s.supplier_id).replace(esc(s.supplier_id) + "</a>", esc(s.supplier) + "</a>") : esc(s.supplier)}</td>
						<td>${s.inspected}</td><td class="${s.rejected ? "ppgq-red" : ""}">${s.rejected}</td>
						<td><span class="ppgq-pill ${s.reject_pct >= 10 ? "bad" : s.reject_pct > 0 ? "warn" : "good"}">${s.reject_pct}%</span></td>
					</tr>`
				)
				.join("");
			return `<div class="ppgq-scroll"><table class="ppgq-table" style="min-width:480px"><thead><tr><th>Supplier</th><th>Inspected</th><th>Rejected</th><th>Rejection rate</th></tr></thead><tbody>${body}</tbody></table></div>`;
		}

		// ---- interaction ---------------------------------------------------
		bind() {
			this.$el.off(".ppgq");
			this.$el.on("click.ppgq", "a.ppgq-doc", (e) => {
				e.preventDefault();
				e.stopPropagation();
				const $a = $(e.currentTarget);
				frappe.set_route("Form", $a.data("doctype"), $a.data("name"));
			});
			this.$el.on("click.ppgq", "[data-act]", (e) => {
				e.stopPropagation();
				const $t = $(e.currentTarget);
				switch ($t.data("act")) {
					case "tab":
						this.openTab($t.data("tab"), { stage: $t.data("stage"), reason: $t.data("reason") });
						break;
					case "list":
						goList($t.data("doctype"), $t.data("filters"));
						break;
					case "period":
						this.setPeriod($t.data("period"));
						break;
					case "clear":
						this.filter = {};
						this.paintTabs();
						break;
				}
			});
			this.$el.on("click.ppgq", ".ppgq-tab", (e) => this.openTab($(e.currentTarget).data("tab")));
		}
	}

	window.PPGQualityDashboard = PPGQualityDashboard;
})();

/* Period selected in the dashboard header (MTD / QTD / YTD). */
function ppgq_current_period(data) {
	if (data && data.period) return data.period;
	const $sel = $("select")
		.filter((_, el) => Array.from(el.options).some((o) => o.value === "MTD" || o.text.trim() === "MTD"))
		.first();
	if ($sel.length && $sel.val()) return $sel.val();
	const $ctl = $("input, button, span, div")
		.filter((_, el) => $(el).children().length === 0 && /^(MTD|QTD|YTD)$/.test(($(el).val() || $(el).text() || "").trim()))
		.first();
	if ($ctl.length) return ($ctl.val() || $ctl.text()).trim();
	return "MTD";
}

/* Glue for management_dashboard.js. Called from render_data(data). */
function render_quality_dashboard(data) {
	try {
		const $cards = $("[data-sections]").filter((_, el) => !/^ppg[dq]-root$/.test($(el).attr("id") || ""));
		if (!$cards.length) {
			console.warn("PPGQ: no [data-sections] cards found on the page.");
			return;
		}

		let $root = $("#ppgq-root");
		if (!$root.length) {
			const hasQuality = (el) =>
				($(el).attr("data-sections") || "").split(",").map((s) => s.trim()).includes("Quality");

			let $anchor = $cards.filter((_, el) => hasQuality(el)).last();
			if (!$anchor.length) $anchor = $cards.last();

			$root = $('<div id="ppgq-root"></div>')
				.addClass($anchor.attr("class") || "md-card section-box")
				.attr("data-sections", "All,Quality")
				.css("grid-column", "1 / -1")
				.insertAfter($anchor);
			window.ppgq_dashboard = new PPGQualityDashboard($root);

			$(document)
				.off("click.ppgq")
				.on("click.ppgq", ".md-tab", function () {
					const sec = $(this).attr("data-section");
					$("#ppgq-root").toggle(sec === "All" || sec === "Quality");
				});
		}

		const active = $(".md-tab.active, .md-tab.is-active, .md-tab.selected").first().attr("data-section");
		$root.toggle(!active || active === "All" || active === "Quality");

		window.ppgq_dashboard.refresh({
			as_of_date: data.as_of_date,
			period: ppgq_current_period(data),
		});
	} catch (e) {
		console.error("PPGQ: quality dashboard failed", e);
	}
}
