/*
 * Production section renderer for the Management Dashboard.
 *
 * Place at: apps/ppg_dashboard/ppg_dashboard/public/js/production_dashboard.js
 * Load it before management_dashboard.js (hooks.py -> app_include_js, or paste
 * the whole file at the top of management_dashboard.js), then run:
 *     bench build --app ppg_dashboard && bench clear-cache
 *
 * Usage inside management_dashboard.js, where the Production tab renders:
 *
 *     this.production = this.production || new PPGProductionDashboard($("#production-section"));
 *     this.production.refresh({
 *         as_of_date: this.as_of_date,   // "2026-10-07"
 *         period: this.period,           // "MTD" | "QTD" | "YTD" | "Custom"
 *         custom_from_date: this.from_date,  // only for Custom
 *         custom_to_date: this.to_date,
 *     });
 */
(function () {
	"use strict";

	const METHOD = "ppg_dashboard.api.production_dashboard.get_production_dashboard";
	const STYLE_ID = "ppgp-style";

	const CSS = `
.ppgp{font-size:13px;color:var(--text-color,#1f272e)}
.ppgp *{box-sizing:border-box}
.ppgp-hero{border:1px solid var(--border-color,#e5e7eb);border-radius:10px;padding:16px;margin-bottom:12px;background:var(--card-bg,#fff)}
.ppgp-hero-top{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap}
.ppgp-muted{color:var(--text-muted,#6b7280);font-size:12px}
.ppgp-big{font-size:36px;font-weight:600;line-height:1.1}
.ppgp-mid{font-size:20px;font-weight:600}
.ppgp-track{position:relative;height:14px;border-radius:7px;background:var(--control-bg,#f3f4f6);margin:16px 0 6px}
.ppgp-fill{height:100%;border-radius:7px;background:#2a78d6}
.ppgp-fill.good{background:#0ca30c}.ppgp-fill.warn{background:#e8a317}.ppgp-fill.bad{background:#d03b3b}
.ppgp-marker{position:absolute;top:-5px;width:2px;height:24px;background:var(--text-color,#1f272e)}
.ppgp-scale{display:flex;justify-content:space-between}
.ppgp-minis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-top:14px}
.ppgp-mini b{display:block;font-size:15px;font-weight:600}
.ppgp-mini .ppgp-bar2{height:5px;border-radius:3px;background:var(--control-bg,#f3f4f6);margin-top:5px;overflow:hidden}
.ppgp-mini .ppgp-bar2 i{display:block;height:100%;background:#2a78d6}
.ppgp-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:12px}
.ppgp-kpi{border:1px solid var(--border-color,#e5e7eb);border-radius:8px;padding:10px 12px;background:var(--card-bg,#fff)}
.ppgp-kpi .v{font-size:22px;font-weight:600;margin:2px 0}
.ppgp-red{color:#d03b3b}.ppgp-amber{color:#b7791f}.ppgp-green{color:#0a8a0a}
.ppgp-banner{display:flex;gap:10px;border-radius:8px;padding:10px 12px;margin-bottom:8px;line-height:1.5}
.ppgp-banner.warn{background:#fff6e0;color:#8a5a00}.ppgp-banner.bad{background:#fdeaea;color:#a42626}.ppgp-banner.info{background:#eef4fd;color:#1d4f91}
.ppgp-h{display:flex;justify-content:space-between;gap:8px;margin:14px 0 8px;font-weight:600;font-size:13px}
.ppgp-h span{font-weight:400;color:var(--text-muted,#6b7280);font-size:11px}
.ppgp-flow{display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:8px;margin-bottom:14px}
.ppgp-stage{border:1px solid var(--border-color,#e5e7eb);border-radius:8px;padding:8px 10px;background:var(--card-bg,#fff)}
.ppgp-stage b{display:block;font-size:17px;font-weight:600}
.ppgp-stage .mb{height:4px;border-radius:2px;background:var(--control-bg,#f3f4f6);margin:4px 0;overflow:hidden}
.ppgp-stage .mb i{display:block;height:100%;background:#0ca30c}
.ppgp-tabs{display:flex;gap:2px;border-bottom:1px solid var(--border-color,#e5e7eb);margin-bottom:10px;flex-wrap:wrap}
.ppgp-tab{padding:7px 14px;cursor:pointer;color:var(--text-muted,#6b7280);border-bottom:2px solid transparent;background:none;border-top:0;border-left:0;border-right:0;font-size:13px}
.ppgp-tab.on{color:var(--text-color,#1f272e);border-bottom-color:var(--text-color,#1f272e);font-weight:600}
.ppgp-pane{display:none}.ppgp-pane.on{display:block}
.ppgp-scroll{overflow-x:auto}
.ppgp-table{width:100%;border-collapse:collapse;min-width:680px}
.ppgp-table th{text-align:left;font-weight:500;color:var(--text-muted,#6b7280);font-size:12px;padding:8px 10px 8px 0;border-bottom:1px solid var(--border-color,#e5e7eb);white-space:nowrap}
.ppgp-table td{padding:9px 10px 9px 0;border-bottom:1px solid var(--border-color,#eef0f2);white-space:nowrap}
.ppgp-table tr:last-child td{border-bottom:0}
.ppgp-table tr[data-ws]{cursor:pointer}.ppgp-table tr[data-ws]:hover td{background:var(--control-bg,#f9fafb)}
.ppgp-pbar{display:inline-block;vertical-align:middle;width:70px;height:6px;border-radius:3px;background:var(--control-bg,#f3f4f6);overflow:hidden;margin-right:6px}
.ppgp-pbar i{display:block;height:100%;background:#2a78d6}
.ppgp-split{display:inline-flex;vertical-align:middle;width:110px;height:8px;border-radius:4px;overflow:hidden;background:var(--control-bg,#f3f4f6)}
.ppgp-split i{display:block;height:100%}
.ppgp-avatar{display:inline-flex;width:22px;height:22px;border-radius:50%;background:#e8eefb;color:#1d4f91;align-items:center;justify-content:center;font-size:10px;margin-right:6px;vertical-align:middle}
.ppgp-pill{font-size:11px;padding:2px 8px;border-radius:6px;background:var(--control-bg,#f3f4f6);color:var(--text-muted,#6b7280)}
.ppgp-pill.bad{background:#fdeaea;color:#a42626}.ppgp-pill.good{background:#e6f6e6;color:#0a6a0a}.ppgp-pill.warn{background:#fff6e0;color:#8a5a00}
.ppgp-legend{display:flex;flex-wrap:wrap;gap:4px 14px;margin-bottom:8px;color:var(--text-muted,#6b7280);font-size:11px}
.ppgp-legend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:4px}
.ppgp-select{padding:5px 8px;border:1px solid var(--border-color,#d1d5db);border-radius:6px;margin-bottom:10px;background:var(--control-bg,#fff);color:var(--text-color,#1f272e)}
.ppgp-empty{padding:24px;text-align:center;color:var(--text-muted,#6b7280)}
.ppgp a{color:inherit;text-decoration:underline;text-decoration-color:var(--border-color,#c7ccd1)}
`;

	// ---- helpers ----------------------------------------------------------
	const esc = (v) => frappe.utils.escape_html(v == null ? "" : String(v));
	const clamp = (n) => Math.max(0, Math.min(100, n || 0));
	const initials = (name) =>
		String(name || "?")
			.split(" ")
			.filter(Boolean)
			.slice(0, 2)
			.map((p) => p[0].toUpperCase())
			.join("");
	const pbar = (v) => `<span class="ppgp-pbar"><i style="width:${clamp(v)}%"></i></span>${v}%`;
	const owner = (name) => `<span class="ppgp-avatar">${esc(initials(name))}</span>${esc(name)}`;
	const dateStr = (d) => (d ? frappe.datetime.str_to_user(d) : "–");
	const pct = (a, b) => (b ? Math.round((a * 100) / b) : 0);
	const link = (doctype, name) =>
		`<a href="/app/${doctype}/${encodeURIComponent(name)}">${esc(name)}</a>`;

	const WO_PILL = { Completed: "good", Delayed: "bad", "In process": "warn", "Not started": "" };

	function injectStyle() {
		if (document.getElementById(STYLE_ID)) return;
		const el = document.createElement("style");
		el.id = STYLE_ID;
		el.textContent = CSS;
		document.head.appendChild(el);
	}

	// ---- component --------------------------------------------------------
	class PPGProductionDashboard {
		constructor($el) {
			injectStyle();
			this.$el = $($el);
			this.tab = "workstation";
			this.filterWs = "all";
			this.data = null;
			this.bind();
		}

		refresh(opts = {}) {
			this.$el.html(`<div class="ppgp-empty">Loading production data…</div>`);
			return frappe
				.call({ method: METHOD, args: opts })
				.then((r) => {
					this.data = r.message;
					this.render();
				})
				.catch((err) => {
					console.error("Production dashboard error:", err);
					this.$el.html(
						`<div class="ppgp-empty">Could not load production data. Check the browser console and the Error Log.</div>`
					);
				});
		}

		render() {
			const d = this.data;
			if (!d) return;
			this.$el.html(`
				<div class="ppgp">
					${this.hero(d.summary)}
					${this.kpis(d.summary)}
					${this.insights(d)}
					<div class="ppgp-h">Stage-wise completion <span>Share of job cards completed · red = overdue</span></div>
					${this.flow(d.workstations)}
					${this.tabsHtml(d)}
				</div>`);
			this.setTab(this.tab);
		}

		// ---- sections ------------------------------------------------------
		hero(s) {
			const gap = s.planned_pct - s.progress_pct;
			const tone = gap >= 20 ? "bad" : gap > 0 ? "warn" : "good";
			const note =
				gap > 0
					? `<span class="ppgp-red">${gap} pts behind plan</span>`
					: `<span class="ppgp-green">On or ahead of plan</span>`;
			const mini = (label, text, v) =>
				`<div class="ppgp-mini"><span class="ppgp-muted">${label}</span><b>${text}</b><div class="ppgp-bar2"><i style="width:${clamp(v)}%"></i></div></div>`;
			return `
			<div class="ppgp-hero">
				<div class="ppgp-hero-top">
					<div><div class="ppgp-muted">Overall production progress</div><div class="ppgp-big">${s.progress_pct}%</div></div>
					<div style="text-align:right"><div class="ppgp-muted">Planned by today</div><div class="ppgp-mid">${s.planned_pct}%</div><div>${note}</div></div>
				</div>
				<div class="ppgp-track"><div class="ppgp-fill ${tone}" style="width:${clamp(s.progress_pct)}%"></div><div class="ppgp-marker" style="left:${clamp(s.planned_pct)}%"></div></div>
				<div class="ppgp-scale ppgp-muted"><span>0%</span><span>Line shows planned progress today</span><span>100%</span></div>
				<div class="ppgp-minis">
					${mini("Job cards done", `${s.jc_completed} / ${s.jc_total}`, s.progress_pct)}
					${mini("Qty produced", `${s.produced_qty} / ${s.planned_qty} · ${s.qty_pct}%`, s.qty_pct)}
					${mini("Work orders done", `${s.completed_wos} / ${s.work_orders} · ${s.wo_pct}%`, s.wo_pct)}
					${mini("On-time completion", s.on_time_pct == null ? "–" : s.on_time_pct + "%", s.on_time_pct || 0)}
				</div>
			</div>`;
		}

		kpis(s) {
			const k = (label, value, sub, cls = "") =>
				`<div class="ppgp-kpi"><div class="ppgp-muted">${label}</div><div class="v ${cls}">${value}</div><div class="ppgp-muted ${cls}">${sub}</div></div>`;
			return `<div class="ppgp-kpis">
				${k("Open job cards", s.jc_open, "Not yet completed")}
				${k("In progress", s.jc_wip, s.jc_wip ? "Running now" : "Nothing started", s.jc_wip ? "ppgp-green" : "ppgp-amber")}
				${k("On hold", s.jc_hold, s.jc_hold ? "Needs action" : "None", s.jc_hold ? "ppgp-amber" : "")}
				${k("Overdue", s.jc_overdue, `${s.overdue_pct}% of open`, s.jc_overdue ? "ppgp-red" : "")}
				${k("Avg delay", s.avg_delay + " d", `Oldest ${s.max_delay} d`, s.avg_delay ? "ppgp-red" : "")}
			</div>`;
		}

		insights(d) {
			const s = d.summary;
			const items = [];
			if (!s.jc_total) {
				items.push(["info", "No work orders or job cards found for this period."]);
			} else {
				if (s.jc_open > 0 && s.jc_wip === 0 && s.jc_completed === 0) {
					items.push([
						"bad",
						`<b>None of the ${s.jc_open} job cards has started.</b> Check whether work has begun and whether operators are updating job cards in ERP.`,
					]);
				} else if (s.behind_pts > 0) {
					items.push([
						"warn",
						`<b>Production is ${s.behind_pts} points behind plan</b> (${s.progress_pct}% done, ${s.planned_pct}% planned by today).`,
					]);
				}
				const worst = [...d.workstations].sort((a, b) => b.overdue - a.overdue)[0];
				if (worst && worst.overdue > 0) {
					items.push([
						"warn",
						`<b>${esc(worst.code)}</b> has the most overdue job cards (${worst.overdue}), oldest ${worst.max_delay} days late. Owner: ${esc(worst.owner)}.`,
					]);
				}
				if (s.jc_hold > 0) items.push(["warn", `${s.jc_hold} job card(s) on hold need a decision.`]);
				if (d.owner_field_missing)
					items.push([
						"info",
						"Workstation owners are not set up. Add the custom field <b>custom_incharge</b> (Link to Employee) on Workstation.",
					]);
			}
			return items.map(([t, m]) => `<div class="ppgp-banner ${t}"><span>${m}</span></div>`).join("");
		}

		flow(wss) {
			if (!wss.length) return `<div class="ppgp-empty">No workstation data.</div>`;
			return `<div class="ppgp-flow">${wss
				.map(
					(w) => `<div class="ppgp-stage" title="${esc(w.name)}">
						<span class="ppgp-muted">${esc(w.code)}</span>
						<b>${w.progress_pct}%</b>
						<div class="mb"><i style="width:${clamp(w.progress_pct)}%"></i></div>
						<span class="ppgp-red" style="font-size:11px">${w.overdue} overdue</span>
					</div>`
				)
				.join("")}</div>`;
		}

		tabsHtml(d) {
			const tabs = [
				["workstation", "By workstation"],
				["workorder", "By work order"],
				["owner", "By owner"],
				["delayed", `Delayed job cards (${d.delayed_total})`],
			];
			return `
			<div class="ppgp-tabs">${tabs
				.map(([id, label]) => `<button class="ppgp-tab" data-tab="${id}">${label}</button>`)
				.join("")}</div>
			<div class="ppgp-pane" data-pane="workstation">${this.wsTable(d.workstations)}</div>
			<div class="ppgp-pane" data-pane="workorder">${this.woTable(d.work_orders)}</div>
			<div class="ppgp-pane" data-pane="owner">${this.ownerTable(d.owners)}</div>
			<div class="ppgp-pane" data-pane="delayed">${this.delayedPane(d)}</div>`;
		}

		wsTable(wss) {
			if (!wss.length) return `<div class="ppgp-empty">No workstation data.</div>`;
			const seg = (n, total, c) => `<i style="width:${pct(n, total)}%;background:${c}"></i>`;
			const rows = [...wss]
				.sort((a, b) => b.overdue - a.overdue)
				.map(
					(w) => `<tr data-ws="${esc(w.name)}">
						<td><b>${esc(w.code)}</b> ${esc(w.name.split(" — ").slice(1).join(" — "))}</td>
						<td>${owner(w.owner)}</td>
						<td>${pbar(w.progress_pct)}</td>
						<td><span class="ppgp-split">${seg(w.completed, w.total, "#0ca30c")}${seg(w.wip, w.total, "#2a78d6")}${seg(w.hold, w.total, "#fab219")}${seg(w.not_started, w.total, "#a3a39b")}</span></td>
						<td>${w.open}</td>
						<td class="${w.overdue ? "ppgp-red" : ""}">${w.overdue}</td>
						<td class="${w.max_delay ? "ppgp-red" : ""}">${w.max_delay ? w.max_delay + " days" : "–"}</td>
					</tr>`
				)
				.join("");
			return `
			<div class="ppgp-legend"><span><i style="background:#0ca30c"></i>Completed</span><span><i style="background:#2a78d6"></i>In progress</span><span><i style="background:#fab219"></i>On hold</span><span><i style="background:#a3a39b"></i>Not started</span></div>
			<div class="ppgp-scroll"><table class="ppgp-table"><thead><tr><th>Workstation</th><th>Owner</th><th>Progress</th><th>Status split</th><th>Open</th><th>Overdue</th><th>Oldest delay</th></tr></thead><tbody>${rows}</tbody></table></div>
			<div class="ppgp-muted" style="margin-top:8px">Sorted by most overdue. Click a row to see its delayed job cards.</div>`;
		}

		woTable(wos) {
			if (!wos.length) return `<div class="ppgp-empty">No work orders in this period.</div>`;
			const rows = wos
				.map(
					(w) => `<tr>
						<td>${link("work-order", w.name)}</td>
						<td>${esc(w.item || "–")}</td>
						<td>${w.produced_qty} / ${w.qty}</td>
						<td>${w.jc_done} / ${w.jc_total}</td>
						<td>${pbar(w.progress_pct)}</td>
						<td class="${w.overdue ? "ppgp-red" : ""}">${w.overdue}</td>
						<td>${dateStr(w.planned_end)}</td>
						<td><span class="ppgp-pill ${WO_PILL[w.status] || ""}">${esc(w.status)}</span></td>
					</tr>`
				)
				.join("");
			return `<div class="ppgp-scroll"><table class="ppgp-table"><thead><tr><th>Work order</th><th>Item</th><th>Qty</th><th>Job cards</th><th>Progress</th><th>Overdue</th><th>Planned end</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`;
		}

		ownerTable(rows) {
			if (!rows.length) return `<div class="ppgp-empty">No owner data.</div>`;
			const body = rows
				.map(
					(o) => `<tr>
						<td>${owner(o.owner)}</td>
						<td>${esc(o.workstations)}</td>
						<td>${pbar(o.progress_pct)}</td>
						<td>${o.open}</td>
						<td class="${o.overdue ? "ppgp-red" : ""}">${o.overdue}</td>
						<td class="${o.hold ? "ppgp-amber" : ""}">${o.hold}</td>
					</tr>`
				)
				.join("");
			return `<div class="ppgp-scroll"><table class="ppgp-table"><thead><tr><th>Owner</th><th>Workstations</th><th>Progress</th><th>Open</th><th>Overdue</th><th>On hold</th></tr></thead><tbody>${body}</tbody></table></div>`;
		}

		delayedPane(d) {
			const options =
				`<option value="all">All workstations</option>` +
				d.workstations
					.map(
						(w) =>
							`<option value="${esc(w.name)}" ${w.name === this.filterWs ? "selected" : ""}>${esc(w.name)}</option>`
					)
					.join("");
			return `<select class="ppgp-select ppgp-wsf">${options}</select>
				<div class="ppgp-scroll"><table class="ppgp-table" style="min-width:820px"><thead><tr><th>Job card</th><th>Work order</th><th>Operation</th><th>Workstation</th><th>Owner</th><th>Expected end</th><th>Days late</th></tr></thead><tbody class="ppgp-delayed-body">${this.delayedRows()}</tbody></table></div>
				${d.delayed_total > d.delayed_job_cards.length ? `<div class="ppgp-muted" style="margin-top:8px">Showing the ${d.delayed_job_cards.length} oldest of ${d.delayed_total} delayed job cards.</div>` : ""}`;
		}

		delayedRows() {
			const rows = this.data.delayed_job_cards.filter(
				(r) => this.filterWs === "all" || r.workstation === this.filterWs
			);
			if (!rows.length)
				return `<tr><td colspan="7" class="ppgp-empty">No delayed job cards here.</td></tr>`;
			return rows
				.map(
					(r) => `<tr>
						<td>${link("job-card", r.job_card)}</td>
						<td>${link("work-order", r.work_order)}</td>
						<td>${esc(r.operation)}</td>
						<td>${esc(r.workstation)}</td>
						<td>${owner(r.owner)}</td>
						<td>${dateStr(r.expected_end)}</td>
						<td class="ppgp-red">${r.days_late} days</td>
					</tr>`
				)
				.join("");
		}

		// ---- interaction ---------------------------------------------------
		setTab(id) {
			this.tab = id;
			this.$el.find(".ppgp-tab").each((_, el) => $(el).toggleClass("on", $(el).data("tab") === id));
			this.$el.find(".ppgp-pane").each((_, el) => $(el).toggleClass("on", $(el).data("pane") === id));
		}

		bind() {
			this.$el.off(".ppgp");
			this.$el.on("click.ppgp", ".ppgp-tab", (e) => this.setTab($(e.currentTarget).data("tab")));
			this.$el.on("click.ppgp", "tr[data-ws]", (e) => {
				this.filterWs = $(e.currentTarget).attr("data-ws");
				this.$el.find(".ppgp-wsf").val(this.filterWs);
				this.$el.find(".ppgp-delayed-body").html(this.delayedRows());
				this.setTab("delayed");
			});
			this.$el.on("change.ppgp", ".ppgp-wsf", (e) => {
				this.filterWs = e.target.value;
				this.$el.find(".ppgp-delayed-body").html(this.delayedRows());
			});
		}
	}

	window.PPGProductionDashboard = PPGProductionDashboard;
})();

/*
 * Glue for management_dashboard.js.
 * Called from render_data(data), right after render_stuck_jobs(...).
 * It adds a new card straight after the existing "Production & Job Cards"
 * card and copies that card's data-sections / class, so the Production tab
 * filter and card styling keep working. Nothing existing is removed.
 */
function render_production_progress(data) {
	try {
		const $anchor = $("#production-progress").closest("[data-sections]").first();
		if (!$anchor.length) {
			console.warn("PPGP: could not find the Production card (#production-progress inside [data-sections]).");
			return;
		}

		let $root = $("#ppgp-root");
		if (!$root.length) {
			$root = $('<div id="ppgp-root"></div>')
				.attr("class", $anchor.attr("class") || "")
				.attr("data-sections", $anchor.attr("data-sections"))
				.insertAfter($anchor);
			window.ppgp_dashboard = new PPGProductionDashboard($root);
		}
		$root.css("display", $anchor.css("display"));

		window.ppgp_dashboard.refresh({
			as_of_date: data.as_of_date,
			period: data.period || "MTD",
		});
	} catch (e) {
		console.error("PPGP: production progress failed", e);
	}
}
