/*
 * Quality section renderer for the Management Dashboard.
 *
 * Appended to management_dashboard.js by the install script. render_data(data)
 * calls render_quality_dashboard(data), which adds a card after the last card
 * that belongs to the Quality tab and fills it from
 * ppg_dashboard.api.quality_dashboard.get_quality_dashboard.
 *
 * Everything is clickable:
 *   cards, bars and stage boxes open the matching ERPNext list, already filtered
 *   table rows open the document
 *   some cards switch to the matching tab inside this section
 */
(function () {
	"use strict";

	const METHOD = "ppg_dashboard.api.quality_dashboard.get_quality_dashboard";
	const STYLE_ID = "ppgq-style";
	const OPEN_JOB = ["Open", "Work In Progress", "Material Transferred", "On Hold"];

	const CSS = `
.ppgq{font-size:13px;color:var(--text-color,#1f272e)}
.ppgq *{box-sizing:border-box}
.ppgq [data-go],.ppgq [data-form],.ppgq [data-jump]{cursor:pointer}
.ppgq [data-go]:focus-visible,.ppgq [data-form]:focus-visible,.ppgq [data-jump]:focus-visible{outline:2px solid #2a78d6;outline-offset:2px}
.ppgq-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.ppgq-title{font-size:16px;font-weight:600}
.ppgq-muted{color:var(--text-muted,#6b7280);font-size:12px}
.ppgq-btn{padding:6px 12px;border:1px solid var(--border-color,#d1d5db);border-radius:6px;background:transparent;color:inherit;font-size:12px}
.ppgq-btn:hover{background:var(--control-bg,#f3f4f6)}
.ppgq-banner{display:flex;gap:10px;border-radius:8px;padding:10px 12px;margin-bottom:8px;line-height:1.5}
.ppgq-banner[data-jump]:hover{filter:brightness(0.97)}
.ppgq-banner.bad{background:#fdeaea;color:#a42626}.ppgq-banner.warn{background:#fff6e0;color:#8a5a00}.ppgq-banner.good{background:#e6f6e6;color:#0a6a0a}.ppgq-banner.info{background:#eef4fd;color:#1d4f91}
.ppgq-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:12px 0}
.ppgq-kpi{border:1px solid var(--border-color,#e5e7eb);border-radius:8px;padding:10px 12px;background:var(--card-bg,#fff)}
.ppgq-kpi:hover,.ppgq-stage:hover,.ppgq-qa:hover{border-color:#2a78d6;box-shadow:0 0 0 1px #2a78d6 inset}
.ppgq-kpi .v{font-size:22px;font-weight:600;margin:2px 0}
.ppgq-red{color:#d03b3b}.ppgq-amber{color:#b7791f}.ppgq-green{color:#0a8a0a}
.ppgq-h{display:flex;justify-content:space-between;gap:8px;margin:14px 0 8px;font-weight:600}
.ppgq-h span{font-weight:400;color:var(--text-muted,#6b7280);font-size:11px}
.ppgq-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:12px}
.ppgq-stage,.ppgq-qa{border:1px solid var(--border-color,#e5e7eb);border-radius:8px;padding:10px 12px;background:var(--card-bg,#fff)}
.ppgq-stage b,.ppgq-qa b{display:block;font-size:20px;font-weight:600}
.ppgq-bar{height:6px;border-radius:3px;background:var(--control-bg,#f3f4f6);overflow:hidden;margin:6px 0 4px}
.ppgq-bar i{display:block;height:100%}
.ppgq-two{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.ppgq-box{border:1px solid var(--border-color,#e5e7eb);border-radius:8px;padding:12px;background:var(--card-bg,#fff)}
.ppgq-rb{display:flex;align-items:center;gap:8px;margin:8px 0;font-size:12px;padding:2px 4px;border-radius:4px}
.ppgq-rb:hover{background:var(--control-bg,#f3f4f6)}
.ppgq-rb .n{width:150px;flex-shrink:0;color:var(--text-muted,#6b7280);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ppgq-rb .b{flex:1;height:8px;border-radius:4px;background:var(--control-bg,#f3f4f6);overflow:hidden}
.ppgq-rb .b i{display:block;height:100%;background:#E24B4A}
.ppgq-rb .c{width:30px;text-align:right}
.ppgq-weeks{position:relative;height:110px;display:flex;align-items:flex-end;gap:10px;margin-top:6px}
.ppgq-weeks .col{flex:1;display:flex;align-items:flex-end;height:100%;border-radius:3px 3px 0 0}
.ppgq-weeks .col:hover{background:var(--control-bg,#f3f4f6)}
.ppgq-weeks .col i{display:block;width:100%;border-radius:3px 3px 0 0}
.ppgq-weeks .tl{position:absolute;left:0;right:0;height:0;border-top:1px dashed var(--text-muted,#9ca3af);pointer-events:none}
.ppgq-wl{display:flex;gap:10px;font-size:11px;color:var(--text-muted,#6b7280);text-align:center}
.ppgq-wl span{flex:1}
.ppgq-tabs{display:flex;gap:2px;border-bottom:1px solid var(--border-color,#e5e7eb);margin:14px 0 10px;flex-wrap:wrap}
.ppgq-tab{padding:7px 14px;cursor:pointer;color:var(--text-muted,#6b7280);border:0;border-bottom:2px solid transparent;background:none;font-size:13px}
.ppgq-tab.on{color:var(--text-color,#1f272e);border-bottom-color:var(--text-color,#1f272e);font-weight:600}
.ppgq-pane{display:none}.ppgq-pane.on{display:block}
.ppgq-scroll{overflow-x:auto}
.ppgq-table{width:100%;border-collapse:collapse;min-width:720px}
.ppgq-table th{text-align:left;font-weight:500;color:var(--text-muted,#6b7280);font-size:12px;padding:8px 10px 8px 0;border-bottom:1px solid var(--border-color,#e5e7eb);white-space:nowrap}
.ppgq-table td{padding:9px 10px 9px 0;border-bottom:1px solid var(--border-color,#eef0f2);white-space:nowrap}
.ppgq-table tr:last-child td{border-bottom:0}
.ppgq-table tr[data-form]:hover td{background:var(--control-bg,#f9fafb)}
.ppgq-pill{font-size:11px;padding:2px 8px;border-radius:6px;background:var(--control-bg,#f3f4f6);color:var(--text-muted,#6b7280)}
.ppgq-pill.bad{background:#fdeaea;color:#a42626}.ppgq-pill.good{background:#e6f6e6;color:#0a6a0a}.ppgq-pill.warn{background:#fff6e0;color:#8a5a00}
.ppgq-empty{padding:22px;text-align:center;color:var(--text-muted,#6b7280)}
`;

	// ---- helpers ----------------------------------------------------------
	const esc = (v) => frappe.utils.escape_html(v == null ? "" : String(v));
	const dateStr = (d) => (d ? frappe.datetime.str_to_user(d) : "–");
	const num = (v) => (Math.round((v || 0) * 100) / 100).toLocaleString("en-IN");
	const pctText = (v) => (v == null ? "–" : v + "%");
	const attr = (name, value) => `${name}="${esc(JSON.stringify(value))}"`;
	const goA = (doctype, filters) => `${attr("data-go", { d: doctype, f: filters || {} })} role="link" tabindex="0"`;
	const formA = (doctype, name) => `${attr("data-form", [doctype, name])} role="link" tabindex="0"`;
	const jumpA = (tab) => `data-jump="${tab}" role="button" tabindex="0"`;
	const STAGE = { incoming: "Incoming", in_process: "In-process", outgoing: "Final and dispatch" };
	const TYPE = { incoming: "Incoming", in_process: "In Process", outgoing: "Outgoing" };

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
			this.tab = "pending";
			this.data = null;
			this.bind();
		}

		refresh(opts = {}) {
			this.$el.html(`<div class="ppgq-empty">Loading quality data…</div>`);
			return frappe
				.call({ method: METHOD, args: opts })
				.then((r) => {
					this.data = r.message;
					this.render();
				})
				.catch((err) => {
					console.error("Quality dashboard error:", err);
					this.$el.html(
						`<div class="ppgq-empty">Could not load quality data. Check the browser console and the Error Log.</div>`
					);
				});
		}

		get period() {
			return ["Between", [this.data.from_date, this.data.to_date]];
		}

		qiFilters(extra = {}) {
			return {
				docstatus: 1,
				status: ["in", ["Accepted", "Rejected"]],
				report_date: this.period,
				...extra,
			};
		}

		render() {
			const d = this.data;
			if (!d) return;
			this.$el.html(`
				<div class="ppgq">
					<div class="ppgq-head">
						<div><div class="ppgq-title">Quality</div><div class="ppgq-muted">Quality inspection status · ${esc(d.period)} · as of ${esc(dateStr(d.as_of_date))}</div></div>
						<button class="ppgq-btn" ${goA("Quality Inspection", this.qiFilters())}>View QIs</button>
					</div>
					${this.banners(d)}
					${this.kpis(d)}
					${this.qaStations(d)}
					<div class="ppgq-h">Inspection by stage <span>${esc(d.period)} · click a stage to open its inspections</span></div>
					${this.stages(d)}
					<div class="ppgq-two">
						<div class="ppgq-box">${this.reasons(d)}</div>
						<div class="ppgq-box">${this.weekly(d)}</div>
					</div>
					${this.tabsHtml(d)}
				</div>`);
			this.setTab(this.tab);
		}

		banners(d) {
			const s = d.summary;
			const out = [];
			if (!s.done && !s.pending) {
				out.push([
					"info",
					null,
					`No quality inspections found for ${esc(d.period)}. Check that items have <b>Inspection Required</b> ticked and that the team creates Quality Inspections.`,
				]);
			} else {
				if (s.pass_pct != null && s.pass_pct < s.target_pct) {
					out.push([
						s.pass_pct < s.target_pct - 5 ? "bad" : "warn",
						"rejected",
						`<b>Pass rate is ${s.pass_pct}%, below the ${s.target_pct}% target.</b>${s.pending_blocking ? ` ${s.pending_blocking} of ${s.pending} pending inspections are holding up work.` : ""}`,
					]);
				} else if (s.pending_blocking) {
					out.push([
						"warn",
						"pending",
						`<b>${s.pending_blocking} of ${s.pending} pending inspections are holding up work.</b> The longest wait is ${s.pending_oldest} days.`,
					]);
				}
			}
			if (s.complaints_high)
				out.push([
					"bad",
					"complaints",
					`<b>${s.complaints_high} high priority customer complaint${s.complaints_high > 1 ? "s are" : " is"} open</b>, the oldest for ${s.complaints_high_oldest} days.`,
				]);
			if (s.qa_overdue)
				out.push([
					"warn",
					"qa",
					`<b>${s.qa_overdue} job card${s.qa_overdue > 1 ? "s" : ""} at QA and test stations ${s.qa_overdue > 1 ? "are" : "is"} overdue</b>, the oldest by ${s.qa_oldest} days.`,
				]);
			if (s.nc_oldest > 7)
				out.push(["warn", "nc", `An open non-conformance is ${s.nc_oldest} days old.`]);
			if (s.rejected && d.reason_source !== "field")
				out.push([
					"info",
					null,
					"Rejection reasons come from the failed readings. Add a Select field <b>custom_rejection_reason</b> on Quality Inspection for cleaner reasons.",
				]);
			return out
				.map(([t, jump, m]) => `<div class="ppgq-banner ${t}" ${jump ? jumpA(jump) : ""}><span>${m}</span></div>`)
				.join("");
		}

		kpis(d) {
			const s = d.summary;
			const c = d.config;
			const k = (label, value, sub, cls, attrs) =>
				`<div class="ppgq-kpi" ${attrs}><div class="ppgq-muted">${label}</div><div class="v ${cls || ""}">${value}</div><div class="ppgq-muted ${cls || ""}">${sub}</div></div>`;
			const passCls = s.pass_pct == null ? "" : s.pass_pct >= s.target_pct ? "ppgq-green" : s.pass_pct >= s.target_pct - 5 ? "ppgq-amber" : "ppgq-red";
			const cFilter = {};
			if (c.has_complaint_status) cFilter.status = ["not in", c.complaint_closed];
			const high = { ...cFilter };
			if (c.has_complaint_priority) high.priority = ["in", c.high_priority];
			return `<div class="ppgq-kpis">
				${k("Inspections done", s.done, esc(d.period), "", goA("Quality Inspection", this.qiFilters()))}
				${k("Pass rate", pctText(s.pass_pct), `Target ${s.target_pct}%`, passCls, goA("Quality Inspection", this.qiFilters()))}
				${k("Rejected", s.rejected, s.done ? `${pctText(Math.round((s.rejected * 1000) / s.done) / 10)} of inspected` : "–", s.rejected ? "ppgq-red" : "", goA("Quality Inspection", this.qiFilters({ status: "Rejected" })))}
				${k("Pending", s.pending, s.pending ? `Avg wait ${s.pending_avg_wait} days` : "Nothing waiting", s.pending ? "ppgq-amber" : "", jumpA("pending"))}
				${c.has_non_conformance ? k("Non-conformances", s.nc_open, s.nc_open ? `Oldest ${s.nc_oldest} days` : "None open", s.nc_open ? "ppgq-amber" : "", goA("Non Conformance", { status: "Open" })) : ""}
				${c.has_actions ? k("Quality actions", s.actions_open, s.actions_open ? `Oldest ${s.actions_oldest} days` : "None open", s.actions_open ? "ppgq-amber" : "", goA("Quality Action", { status: "Open" })) : ""}
				${c.has_complaints ? k("High priority complaints", s.complaints_high, `${s.complaints_open} open in total`, s.complaints_high ? "ppgq-red" : "", goA("Service Complaint", c.has_complaint_priority ? high : cFilter)) : ""}
			</div>`;
		}

		qaStations(d) {
			if (!d.qa_stations.length) return "";
			const cards = d.qa_stations
				.map(
					(w) => `<div class="ppgq-qa" ${goA("Job Card", { workstation: w.workstation, status: ["in", OPEN_JOB], docstatus: ["<", 2] })}>
						<div class="ppgq-muted">${esc(w.workstation)}</div>
						<b>${w.open}</b>
						<span class="ppgq-muted">job cards waiting</span><br>
						<span class="${w.overdue ? "ppgq-red" : "ppgq-muted"}" style="font-size:12px">${w.overdue ? `${w.overdue} overdue, oldest ${w.max_delay} days` : "None overdue"}</span>
					</div>`
				)
				.join("");
			return `<div class="ppgq-h">QA and test stations <span>Job cards waiting at inspection and test workstations</span></div><div class="ppgq-grid">${cards}</div>`;
		}

		stages(d) {
			return `<div class="ppgq-grid">${d.stages
				.map((s) => {
					const cls = s.pass_pct == null ? "" : s.pass_pct >= d.summary.target_pct ? "ppgq-green" : s.pass_pct >= d.summary.target_pct - 5 ? "ppgq-amber" : "ppgq-red";
					const color = s.pass_pct == null ? "#a3a39b" : s.pass_pct >= d.summary.target_pct ? "#1D9E75" : s.pass_pct >= d.summary.target_pct - 5 ? "#EF9F27" : "#E24B4A";
					return `<div class="ppgq-stage" ${goA("Quality Inspection", this.qiFilters({ inspection_type: TYPE[s.stage] }))}>
						<div class="ppgq-muted">${esc(s.label)}</div>
						<b class="${cls}">${pctText(s.pass_pct)}</b>
						<div class="ppgq-bar"><i style="width:${s.pass_pct || 0}%;background:${color}"></i></div>
						<span class="ppgq-muted">${s.inspected} inspected · ${s.rejected} rejected</span><br>
						<span class="${s.pending ? "ppgq-amber" : "ppgq-muted"}" style="font-size:12px">${s.pending} pending</span>
					</div>`;
				})
				.join("")}</div>`;
		}

		reasons(d) {
			const head = `<div class="ppgq-h" style="margin-top:0">Why items were rejected <span>${d.summary.rejected} rejected</span></div>`;
			if (!d.reasons.length) return `${head}<div class="ppgq-empty">No rejections in this period.</div>`;
			const max = Math.max(...d.reasons.map((r) => r.count));
			const rows = d.reasons
				.map((r) => {
					const f =
						d.reason_source === "field"
							? this.qiFilters({ status: "Rejected", custom_rejection_reason: r.reason === "Not recorded" ? ["is", "not set"] : r.reason })
							: this.qiFilters({ status: "Rejected" });
					return `<div class="ppgq-rb" ${goA("Quality Inspection", f)}><span class="n" title="${esc(r.reason)}">${esc(r.reason)}</span><span class="b"><i style="width:${(r.count / max) * 100}%"></i></span><span class="c">${r.count}</span></div>`;
				})
				.join("");
			return `${head}${rows}<div class="ppgq-muted" style="margin-top:8px">${d.reason_source === "field" ? "From the rejection reason on each inspection." : "From the readings that failed."}</div>`;
		}

		weekly(d) {
			const T = d.summary.target_pct;
			const lo = 70;
			const px = (v) => Math.max(3, Math.min(100, ((v - lo) / (100 - lo)) * 100));
			const cols = d.weeks
				.map((w) => {
					const color = w.pass_pct == null ? "transparent" : w.pass_pct >= T ? "#1D9E75" : w.pass_pct >= T - 5 ? "#EF9F27" : "#E24B4A";
					const end = frappe.datetime.add_days(w.week, 6);
					return `<div class="col" title="${esc(dateStr(w.week))}: ${pctText(w.pass_pct)} (${w.inspected} inspected)" ${goA("Quality Inspection", { docstatus: 1, status: ["in", ["Accepted", "Rejected"]], report_date: ["Between", [w.week, end]] })}>
						<i style="height:${w.pass_pct == null ? 0 : px(w.pass_pct)}px;background:${color}"></i></div>`;
				})
				.join("");
			const vals = d.weeks.map((w) => `<span>${w.pass_pct == null ? "–" : Math.round(w.pass_pct)}</span>`).join("");
			const labs = d.weeks.map((w) => `<span>${esc(frappe.datetime.str_to_user(w.week).slice(0, 5))}</span>`).join("");
			return `<div class="ppgq-h" style="margin-top:0">Pass rate by week <span>Target ${T}% · click a bar</span></div>
				<div class="ppgq-weeks"><div class="tl" style="bottom:${px(T)}px"></div>${cols}</div>
				<div class="ppgq-wl">${vals}</div><div class="ppgq-wl" style="color:var(--text-muted,#9ca3af)">${labs}</div>`;
		}

		tabsHtml(d) {
			const s = d.summary;
			const c = d.config;
			const tabs = [
				["pending", `Pending inspections (${s.pending})`],
				["rejected", `Rejected (${s.rejected})`],
				["qa", `QA stations (${s.qa_open})`],
			];
			if (c.has_non_conformance) tabs.push(["nc", `Non-conformances (${s.nc_open})`]);
			if (c.has_actions) tabs.push(["actions", `Quality actions (${s.actions_open})`]);
			if (c.has_complaints) tabs.push(["complaints", `Complaints (${s.complaints_open})`]);
			this.tabIds = tabs.map((t) => t[0]);
			return `
			<div class="ppgq-tabs" data-anchor="tabs">${tabs.map(([id, l]) => `<button class="ppgq-tab" data-tab="${id}">${l}</button>`).join("")}</div>
			<div class="ppgq-pane" data-pane="pending">${this.pendingTable(d.pending)}</div>
			<div class="ppgq-pane" data-pane="rejected">${this.rejectedTable(d.rejected)}</div>
			<div class="ppgq-pane" data-pane="qa">${this.qaTable(d.qa_cards)}</div>
			<div class="ppgq-pane" data-pane="nc">${this.ncTable(d.non_conformances)}</div>
			<div class="ppgq-pane" data-pane="actions">${this.actionsTable(d.actions)}</div>
			<div class="ppgq-pane" data-pane="complaints">${this.complaintsTable(d.complaints)}</div>`;
		}

		pendingTable(rows) {
			if (!rows.length) return `<div class="ppgq-empty">Nothing is waiting for inspection.</div>`;
			const body = rows
				.map(
					(r) => `<tr ${formA(r.doctype, r.ref)}>
						<td>${esc(r.ref)}</td>
						<td>${esc(STAGE[r.stage] || r.stage)}</td>
						<td>${esc(r.item)}</td>
						<td>${esc(r.source)}</td>
						<td>${num(r.qty)}</td>
						<td><span class="ppgq-pill ${r.waiting_days >= 3 ? "bad" : r.waiting_days >= 1 ? "warn" : ""}">${r.waiting_days ? r.waiting_days + (r.waiting_days === 1 ? " day" : " days") : "Today"}</span></td>
						<td>${esc(r.holding_up || "–")}</td>
						<td class="ppgq-muted">${esc(r.doctype === "Quality Inspection" ? "Draft inspection" : "No inspection yet")}</td>
					</tr>`
				)
				.join("");
			return `<div class="ppgq-scroll"><table class="ppgq-table" style="min-width:820px"><thead><tr><th>Reference</th><th>Stage</th><th>Item or operation</th><th>Source</th><th>Qty</th><th>Waiting</th><th>Holding up</th><th>State</th></tr></thead><tbody>${body}</tbody></table></div>`;
		}

		rejectedTable(rows) {
			if (!rows.length) return `<div class="ppgq-empty">No rejected inspections in this period.</div>`;
			const body = rows
				.map(
					(r) => `<tr ${formA("Quality Inspection", r.name)}>
						<td>${esc(r.name)}</td>
						<td>${esc(dateStr(r.date))}</td>
						<td>${esc(STAGE[r.stage] || r.stage)}</td>
						<td>${esc(r.item)}</td>
						<td>${esc(r.source)}</td>
						<td>${num(r.sample)}</td>
						<td>${esc(r.reason || "–")}</td>
					</tr>`
				)
				.join("");
			return `<div class="ppgq-scroll"><table class="ppgq-table"><thead><tr><th>Inspection</th><th>Date</th><th>Stage</th><th>Item</th><th>Source</th><th>Sample size</th><th>Reason</th></tr></thead><tbody>${body}</tbody></table></div>`;
		}

		qaTable(rows) {
			if (!rows.length) return `<div class="ppgq-empty">No job cards are waiting at QA or test stations.</div>`;
			const body = rows
				.map(
					(r) => `<tr ${formA("Job Card", r.name)}>
						<td>${esc(r.name)}</td>
						<td>${esc(r.workstation)}</td>
						<td>${esc(r.operation)}</td>
						<td>${esc(r.work_order)}</td>
						<td>${esc(r.status)}</td>
						<td>${esc(dateStr(r.expected_end))}</td>
						<td>${r.days_late ? `<span class="ppgq-pill bad">${r.days_late} days late</span>` : `<span class="ppgq-pill">On time</span>`}</td>
					</tr>`
				)
				.join("");
			return `<div class="ppgq-scroll"><table class="ppgq-table"><thead><tr><th>Job card</th><th>Workstation</th><th>Operation</th><th>Work order</th><th>Status</th><th>Expected end</th><th>Delay</th></tr></thead><tbody>${body}</tbody></table></div>`;
		}

		ncTable(rows) {
			if (!rows.length) return `<div class="ppgq-empty">No open non-conformances.</div>`;
			const body = rows
				.map(
					(r) => `<tr ${formA("Non Conformance", r.name)}>
						<td>${esc(r.name)}</td><td>${esc(r.subject)}</td><td>${esc(r.procedure || "–")}</td><td>${esc(r.owner || "–")}</td>
						<td><span class="ppgq-pill ${r.open_days > 7 ? "bad" : r.open_days > 3 ? "warn" : ""}">${r.open_days} days</span></td>
					</tr>`
				)
				.join("");
			return `<div class="ppgq-scroll"><table class="ppgq-table" style="min-width:640px"><thead><tr><th>Non-conformance</th><th>Issue</th><th>Procedure</th><th>Owner</th><th>Open</th></tr></thead><tbody>${body}</tbody></table></div>`;
		}

		actionsTable(rows) {
			if (!rows.length) return `<div class="ppgq-empty">No open quality actions.</div>`;
			const body = rows
				.map(
					(r) => `<tr ${formA("Quality Action", r.name)}>
						<td>${esc(r.name)}</td><td>${esc(r.type || "–")}</td><td>${esc(r.about || "–")}</td><td>${esc(r.review || "–")}</td>
						<td>${esc(dateStr(r.due))}</td>
						<td><span class="ppgq-pill ${r.open_days > 14 ? "bad" : r.open_days > 7 ? "warn" : ""}">${r.open_days} days</span></td>
					</tr>`
				)
				.join("");
			return `<div class="ppgq-scroll"><table class="ppgq-table" style="min-width:640px"><thead><tr><th>Action</th><th>Type</th><th>About</th><th>Review</th><th>Due</th><th>Open</th></tr></thead><tbody>${body}</tbody></table></div>`;
		}

		complaintsTable(rows) {
			if (!rows.length) return `<div class="ppgq-empty">No open complaints.</div>`;
			const body = rows
				.map(
					(r) => `<tr ${formA("Service Complaint", r.name)}>
						<td>${esc(r.name)}</td><td>${esc(r.customer || "–")}</td><td>${esc(r.product || "–")}</td><td>${esc(r.issue || "–")}</td>
						<td>${r.priority ? `<span class="ppgq-pill ${r.high ? "bad" : ""}">${esc(r.priority)}</span>` : "–"}</td>
						<td><span class="ppgq-pill ${r.open_days > 7 ? "bad" : r.open_days > 3 ? "warn" : ""}">${r.open_days} days</span></td>
					</tr>`
				)
				.join("");
			return `<div class="ppgq-scroll"><table class="ppgq-table" style="min-width:640px"><thead><tr><th>Complaint</th><th>Customer</th><th>Product</th><th>Issue</th><th>Priority</th><th>Open</th></tr></thead><tbody>${body}</tbody></table></div>`;
		}

		// ---- interaction ---------------------------------------------------
		setTab(id) {
			if (!(this.tabIds || []).includes(id)) id = (this.tabIds || ["pending"])[0];
			this.tab = id;
			this.$el.find(".ppgq-tab").each((_, el) => $(el).toggleClass("on", $(el).data("tab") === id));
			this.$el.find(".ppgq-pane").each((_, el) => $(el).toggleClass("on", $(el).data("pane") === id));
		}

		bind() {
			const $el = this.$el;
			$el.off(".ppgq");
			$el.on("click.ppgq", ".ppgq-tab", (e) => this.setTab($(e.currentTarget).data("tab")));
			$el.on("click.ppgq", "[data-jump]", (e) => {
				this.setTab($(e.currentTarget).attr("data-jump"));
				const anchor = $el.find("[data-anchor=tabs]")[0];
				if (anchor && anchor.scrollIntoView) anchor.scrollIntoView({ behavior: "smooth", block: "start" });
			});
			$el.on("click.ppgq", "[data-go]", (e) => {
				const x = JSON.parse($(e.currentTarget).attr("data-go"));
				frappe.route_options = x.f || {};
				frappe.set_route("List", x.d);
			});
			$el.on("click.ppgq", "[data-form]", (e) => {
				const [doctype, name] = JSON.parse($(e.currentTarget).attr("data-form"));
				frappe.set_route("Form", doctype, name);
			});
			$el.on("keydown.ppgq", "[data-go],[data-form],[data-jump]", (e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					$(e.currentTarget).trigger("click");
				}
			});
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

/*
 * Glue for management_dashboard.js. Called from render_data(data).
 * Adds a card after the last card that belongs to the Quality tab.
 */
function render_quality_dashboard(data) {
	try {
		const $cards = $("[data-sections]").filter((_, el) => $(el).attr("id") !== "ppgq-root");
		if (!$cards.length) {
			console.warn("PPGQ: no [data-sections] cards found on the page.");
			return;
		}

		let $root = $("#ppgq-root");
		if (!$root.length) {
			const has = (el) =>
				($(el).attr("data-sections") || "").split(",").map((s) => s.trim()).includes("Quality");

			let $anchor = $cards.filter((_, el) => has(el)).last();
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
