/*
 * Delivery section renderer for the Management Dashboard.
 *
 * Appended to management_dashboard.js by the install script. render_data(data)
 * calls render_delivery_dashboard(data), which adds a card after the last card
 * that belongs to the Delivery tab and fills it from
 * ppg_dashboard.api.delivery_dashboard.get_delivery_dashboard.
 */
(function () {
	"use strict";

	const METHOD = "ppg_dashboard.api.delivery_dashboard.get_delivery_dashboard";
	const STYLE_ID = "ppgd-style";

	const CSS = `
.ppgd{font-size:13px;color:var(--text-color,#1f272e)}
.ppgd *{box-sizing:border-box}
.ppgd-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.ppgd-title{font-size:16px;font-weight:600}
.ppgd-muted{color:var(--text-muted,#6b7280);font-size:12px}
.ppgd-btn{padding:6px 12px;border:1px solid var(--border-color,#d1d5db);border-radius:6px;background:transparent;color:inherit;cursor:pointer;text-decoration:none;font-size:12px}
.ppgd-banner{display:flex;gap:10px;border-radius:8px;padding:10px 12px;margin-bottom:12px;line-height:1.5}
.ppgd-banner.bad{background:#fdeaea;color:#a42626}.ppgd-banner.warn{background:#fff6e0;color:#8a5a00}.ppgd-banner.good{background:#e6f6e6;color:#0a6a0a}
.ppgd-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:12px}
.ppgd-kpi{border:1px solid var(--border-color,#e5e7eb);border-radius:8px;padding:10px 12px;background:var(--card-bg,#fff)}
.ppgd-kpi .v{font-size:22px;font-weight:600;margin:2px 0}
.ppgd-red{color:#d03b3b}.ppgd-amber{color:#b7791f}.ppgd-green{color:#0a8a0a}
.ppgd-h{display:flex;justify-content:space-between;gap:8px;margin:14px 0 8px;font-weight:600}
.ppgd-h span{font-weight:400;color:var(--text-muted,#6b7280);font-size:11px}
.ppgd-flow{display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:8px;margin-bottom:14px}
.ppgd-stage{border:1px solid var(--border-color,#e5e7eb);border-radius:8px;padding:8px 10px;background:var(--card-bg,#fff)}
.ppgd-stage b{display:block;font-size:18px;font-weight:600}
.ppgd-stage.hot{background:#fff6e0;border-color:transparent}.ppgd-stage.hot b,.ppgd-stage.hot .ppgd-muted{color:#8a5a00}
.ppgd-row{display:flex;align-items:center;gap:10px;margin:8px 0}
.ppgd-lab{width:130px;flex-shrink:0;font-size:12px}
.ppgd-trk{flex:1;position:relative;height:22px;border-radius:4px;background:var(--control-bg,#f3f4f6)}
.ppgd-trk i{position:absolute;display:block}
.ppgd-end{width:78px;flex-shrink:0;text-align:right;font-size:12px}
.ppgd-axis{position:relative;height:16px;flex:1;font-size:11px;color:var(--text-muted,#6b7280)}
.ppgd-axis span{position:absolute}
.ppgd-legend{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:11px;color:var(--text-muted,#6b7280);margin-top:8px}
.ppgd-legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}
.ppgd-tabs{display:flex;gap:2px;border-bottom:1px solid var(--border-color,#e5e7eb);margin:14px 0 10px;flex-wrap:wrap}
.ppgd-tab{padding:7px 14px;cursor:pointer;color:var(--text-muted,#6b7280);border:0;border-bottom:2px solid transparent;background:none;font-size:13px}
.ppgd-tab.on{color:var(--text-color,#1f272e);border-bottom-color:var(--text-color,#1f272e);font-weight:600}
.ppgd-pane{display:none}.ppgd-pane.on{display:block}
.ppgd-scroll{overflow-x:auto}
.ppgd-table{width:100%;border-collapse:collapse;min-width:720px}
.ppgd-table th{text-align:left;font-weight:500;color:var(--text-muted,#6b7280);font-size:12px;padding:8px 10px 8px 0;border-bottom:1px solid var(--border-color,#e5e7eb);white-space:nowrap}
.ppgd-table td{padding:9px 10px 9px 0;border-bottom:1px solid var(--border-color,#eef0f2);white-space:nowrap}
.ppgd-table tr:last-child td{border-bottom:0}
.ppgd-pill{font-size:11px;padding:2px 8px;border-radius:6px;background:var(--control-bg,#f3f4f6);color:var(--text-muted,#6b7280)}
.ppgd-pill.bad{background:#fdeaea;color:#a42626}.ppgd-pill.good{background:#e6f6e6;color:#0a6a0a}.ppgd-pill.warn{background:#fff6e0;color:#8a5a00}
.ppgd-empty{padding:22px;text-align:center;color:var(--text-muted,#6b7280)}
.ppgd a{color:inherit;text-decoration:underline;text-decoration-color:var(--border-color,#c7ccd1)}
`;

	// ---- helpers ----------------------------------------------------------
	const esc = (v) => frappe.utils.escape_html(v == null ? "" : String(v));
	const dateStr = (d) => (d ? frappe.datetime.str_to_user(d) : "–");
	const link = (doctype, name) => `<a href="/app/${doctype}/${encodeURIComponent(name)}">${esc(name)}</a>`;
	const num = (v) => (Math.round((v || 0) * 100) / 100).toLocaleString("en-IN");
	const inr = (v) => {
		v = Number(v || 0);
		if (v >= 1e7) return "₹" + (v / 1e7).toFixed(2) + " Cr";
		if (v >= 1e5) return "₹" + (v / 1e5).toFixed(1) + " L";
		return "₹" + Math.round(v).toLocaleString("en-IN");
	};
	const parse = (s) => new Date(s + "T00:00:00");
	const short = (d) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

	function injectStyle() {
		if (document.getElementById(STYLE_ID)) return;
		const el = document.createElement("style");
		el.id = STYLE_ID;
		el.textContent = CSS;
		document.head.appendChild(el);
	}

	// ---- component --------------------------------------------------------
	class PPGDeliveryDashboard {
		constructor($el) {
			injectStyle();
			this.$el = $($el);
			this.tab = "orders";
			this.data = null;
			this.bind();
		}

		refresh(opts = {}) {
			this.$el.html(`<div class="ppgd-empty">Loading delivery data…</div>`);
			return frappe
				.call({ method: METHOD, args: opts })
				.then((r) => {
					this.data = r.message;
					this.render();
				})
				.catch((err) => {
					console.error("Delivery dashboard error:", err);
					this.$el.html(
						`<div class="ppgd-empty">Could not load delivery data. Check the browser console and the Error Log.</div>`
					);
				});
		}

		render() {
			const d = this.data;
			if (!d) return;
			this.$el.html(`
				<div class="ppgd">
					<div class="ppgd-head">
						<div><div class="ppgd-title">Delivery</div><div class="ppgd-muted">Dispatch performance · ${esc(d.period)} · as of ${esc(dateStr(d.as_of_date))}</div></div>
						<a class="ppgd-btn" href="/app/delivery-note">View delivery notes</a>
					</div>
					${this.banner(d)}
					${this.kpis(d)}
					<div class="ppgd-h">Order to delivery pipeline <span>Open orders only</span></div>
					${this.pipeline(d.pipeline)}
					<div class="ppgd-h">Promised date vs production plan <span>Production still to run, against the date promised to the customer</span></div>
					${this.timeline(d)}
					${this.tabsHtml(d)}
				</div>`);
			this.setTab(this.tab);
		}

		banner(d) {
			const s = d.summary;
			if (!s.pending) return `<div class="ppgd-banner good"><span>No pending deliveries.</span></div>`;
			if (!s.will_miss)
				return `<div class="ppgd-banner good"><span><b>All ${s.pending} pending orders are on track</b> for their promised dates.</span></div>`;
			const worst = [...d.orders].sort(
				(a, b) => Math.max(b.late_days, b.slip_days) - Math.max(a.late_days, a.slip_days)
			)[0];
			const detail = worst.late_days
				? `${esc(worst.name)} is already ${worst.late_days} days late`
				: `${esc(worst.name)} will be ${worst.slip_days} days late`;
			return `<div class="ppgd-banner ${s.delayed ? "bad" : "warn"}"><span><b>${s.will_miss} of ${s.pending} pending orders will miss their promised date</b> at the current production plan. ${detail}${worst.slip_days ? ` and its production ends ${worst.slip_days} days after the promise` : ""}.</span></div>`;
		}

		kpis(d) {
			const s = d.summary;
			const k = (label, value, sub, cls = "") =>
				`<div class="ppgd-kpi"><div class="ppgd-muted">${label}</div><div class="v ${cls}">${value}</div><div class="ppgd-muted ${cls}">${sub}</div></div>`;
			return `<div class="ppgd-kpis">
				${k("Pending deliveries", s.pending, `${inr(s.pending_value)} value`)}
				${k("Delayed", s.delayed, s.delayed ? `Avg ${s.avg_delay} days late` : "None", s.delayed ? "ppgd-red" : "")}
				${k("Due in 7 days", s.due_7d, `${inr(s.due_7d_value)} value`, s.due_7d ? "ppgd-amber" : "")}
				${k("Ready to dispatch", s.ready, s.ready ? "Production done" : "Nothing packed")}
				${k(`Delivered (${esc(d.period)})`, s.delivered_notes, `${num(s.delivered_qty)} qty`)}
				${k(`On-time (${esc(d.period)})`, s.on_time_pct == null ? "–" : s.on_time_pct + "%", s.on_time_total ? `${s.on_time_ok} of ${s.on_time_total} lines` : "No deliveries yet", s.on_time_pct != null && s.on_time_pct < 80 ? "ppgd-amber" : "")}
			</div>`;
		}

		pipeline(p) {
			const stages = [
				["Confirmed", p.confirmed, ""],
				["No work order", p.not_planned, p.not_planned ? "hot" : ""],
				["In production", p.production, p.production ? "hot" : ""],
				["Ready to dispatch", p.ready, ""],
				["Partly delivered", p.partly, ""],
				["Delivered (notes)", p.delivered_notes, ""],
			];
			return `<div class="ppgd-flow">${stages
				.map(
					([label, n, cls]) =>
						`<div class="ppgd-stage ${cls}"><span class="ppgd-muted">${label}</span><b>${n}</b>${cls ? '<span class="ppgd-muted">Holding up orders</span>' : ""}</div>`
				)
				.join("")}</div>`;
		}

		timeline(d) {
			const rows = d.orders.filter((o) => o.promised);
			if (!rows.length) return `<div class="ppgd-empty">No orders with a promised date.</div>`;

			const today = parse(d.as_of_date);
			const all = [today];
			rows.forEach((o) => {
				all.push(parse(o.promised));
				if (o.plan_end) all.push(parse(o.plan_end));
			});
			const DAY = 86400000;
			const start = new Date(Math.min(...all) - 2 * DAY);
			const end = new Date(Math.max(...all) + 3 * DAY);
			const span = end - start;
			const pos = (dt) => ((dt - start) / span) * 100;

			const body = rows
				.map((o) => {
					const prom = parse(o.promised);
					let bar = "";
					let endLabel = `<span class="ppgd-muted">No plan</span>`;
					if (o.plan_end) {
						const pe = parse(o.plan_end);
						if (pe > today) {
							const miss = o.slip_days > 0 || o.late_days > 0;
							bar = `<i style="left:${pos(today)}%;width:${pos(pe) - pos(today)}%;top:6px;height:10px;border-radius:2px;background:${miss ? "#E24B4A" : "#1D9E75"}"></i>`;
						}
						endLabel = o.slip_days
							? `<span class="ppgd-red">+${o.slip_days} days</span>`
							: pe < today
							? `<span class="ppgd-amber">WO overdue</span>`
							: `<span class="ppgd-green">On time</span>`;
					}
					const wo = o.work_orders ? esc(o.work_orders.split(",")[0]) + (o.progress_pct != null ? ` · ${o.progress_pct}%` : "") : "No work order";
					return `<div class="ppgd-row">
						<div class="ppgd-lab">${esc(o.name)}<br><span class="ppgd-muted">${wo}</span></div>
						<div class="ppgd-trk">
							<i style="left:${pos(today)}%;top:0;bottom:0;width:1px;background:var(--border-color,#9ca3af)"></i>
							${bar}
							<i style="left:${pos(prom)}%;top:0;bottom:0;width:2px;background:var(--text-color,#1f272e)"></i>
						</div>
						<div class="ppgd-end">${endLabel}</div>
					</div>`;
				})
				.join("");

			const ticks = [start, today, new Date((+today + +end) / 2), end]
				.map((t, i) => {
					const style = i === 0 ? "left:0" : i === 3 ? "right:0" : `left:${pos(t)}%;transform:translateX(-50%)`;
					return `<span style="${style}">${i === 1 ? "Today" : short(t)}</span>`;
				})
				.join("");

			return `${body}
				<div class="ppgd-row" style="margin:2px 0 0"><div class="ppgd-lab"></div><div class="ppgd-axis">${ticks}</div><div class="ppgd-end"></div></div>
				<div class="ppgd-legend"><span><i style="background:var(--text-color,#1f272e);width:3px"></i>Promised date</span><span><i style="background:#E24B4A"></i>Production still to run (red = misses promise)</span><span><i style="background:#1D9E75"></i>On time</span></div>`;
		}

		tabsHtml(d) {
			const tabs = [
				["orders", `Pending orders (${d.summary.pending})`],
				["notes", "Delivery notes"],
				["customer", "By customer"],
				["unbilled", `Delivered, not invoiced (${d.summary.unbilled_count})`],
			];
			return `
			<div class="ppgd-tabs">${tabs.map(([id, l]) => `<button class="ppgd-tab" data-tab="${id}">${l}</button>`).join("")}</div>
			<div class="ppgd-pane" data-pane="orders">${this.ordersTable(d.orders)}</div>
			<div class="ppgd-pane" data-pane="notes">${this.notesTable(d.delivery_notes)}</div>
			<div class="ppgd-pane" data-pane="customer">${this.customerTable(d.by_customer)}</div>
			<div class="ppgd-pane" data-pane="unbilled">${this.unbilledTable(d.unbilled)}</div>`;
		}

		ordersTable(rows) {
			if (!rows.length) return `<div class="ppgd-empty">No pending orders.</div>`;
			const blocker = (o) =>
				o.stage === "not_planned"
					? "No work order"
					: o.stage === "ready"
					? "Ready to dispatch"
					: o.stage === "partly"
					? "Partly delivered"
					: `Production ${o.progress_pct == null ? "–" : o.progress_pct + "%"}`;
			const status = (o) =>
				o.late_days > 0
					? `<span class="ppgd-pill bad">${o.late_days} days late</span>`
					: o.due_in != null && o.due_in <= 7
					? `<span class="ppgd-pill warn">Due in ${o.due_in} days</span>`
					: o.promised
					? `<span class="ppgd-pill">Due ${esc(dateStr(o.promised))}</span>`
					: `<span class="ppgd-pill">No date</span>`;
			const body = rows
				.map(
					(o) => `<tr>
						<td>${link("sales-order", o.name)}</td>
						<td>${esc(o.customer)}</td>
						<td>${esc(o.items)}</td>
						<td>${num(o.delivered_qty)} / ${num(o.total_qty)}</td>
						<td>${inr(o.pending_value)}</td>
						<td>${esc(dateStr(o.promised))}</td>
						<td>${status(o)}</td>
						<td>${esc(blocker(o))}</td>
					</tr>`
				)
				.join("");
			return `<div class="ppgd-scroll"><table class="ppgd-table"><thead><tr><th>Sales order</th><th>Customer</th><th>Item</th><th>Delivered / qty</th><th>Pending value</th><th>Promised</th><th>Status</th><th>Blocker</th></tr></thead><tbody>${body}</tbody></table></div>
			<div class="ppgd-muted" style="margin-top:8px">Value is before tax. Promised date is the earliest date among the items still to deliver.</div>`;
		}

		notesTable(rows) {
			if (!rows.length) return `<div class="ppgd-empty">No delivery notes yet.</div>`;
			const bill = (p) =>
				p >= 100
					? `<span class="ppgd-pill good">Billed</span>`
					: p > 0
					? `<span class="ppgd-pill warn">${Math.round(p)}% billed</span>`
					: `<span class="ppgd-pill bad">Not billed</span>`;
			const body = rows
				.map(
					(n) => `<tr>
						<td>${link("delivery-note", n.name)}</td>
						<td>${esc(n.customer)}</td>
						<td>${esc(dateStr(n.date))}</td>
						<td>${num(n.qty)}</td>
						<td>${esc(n.transporter || "–")}</td>
						<td>${esc(n.vehicle || "–")}</td>
						<td>${bill(n.per_billed)}</td>
					</tr>`
				)
				.join("");
			return `<div class="ppgd-scroll"><table class="ppgd-table"><thead><tr><th>Delivery note</th><th>Customer</th><th>Date</th><th>Qty</th><th>Transporter</th><th>Vehicle</th><th>Billing</th></tr></thead><tbody>${body}</tbody></table></div>
			<div class="ppgd-muted" style="margin-top:8px">Latest ${rows.length} delivery notes.</div>`;
		}

		customerTable(rows) {
			if (!rows.length) return `<div class="ppgd-empty">No pending orders.</div>`;
			const body = rows
				.map(
					(c) => `<tr>
						<td>${esc(c.customer)}</td><td>${c.orders}</td><td>${inr(c.value)}</td>
						<td class="${c.delayed ? "ppgd-red" : ""}">${c.delayed}</td>
						<td class="${c.avg_delay ? "ppgd-red" : ""}">${c.avg_delay ? c.avg_delay + " days" : "–"}</td>
					</tr>`
				)
				.join("");
			return `<div class="ppgd-scroll"><table class="ppgd-table" style="min-width:520px"><thead><tr><th>Customer</th><th>Pending orders</th><th>Pending value</th><th>Delayed</th><th>Avg delay</th></tr></thead><tbody>${body}</tbody></table></div>`;
		}

		unbilledTable(rows) {
			if (!rows.length) return `<div class="ppgd-empty">Every delivery note has been invoiced.</div>`;
			const body = rows
				.map(
					(u) => `<tr>
						<td>${link("delivery-note", u.name)}</td><td>${esc(u.customer)}</td>
						<td>${esc(dateStr(u.date))}</td><td>${inr(u.value)}</td>
						<td><span class="ppgd-pill ${u.days_waiting > 7 ? "bad" : "warn"}">${u.days_waiting} days</span></td>
					</tr>`
				)
				.join("");
			return `<div class="ppgd-scroll"><table class="ppgd-table" style="min-width:520px"><thead><tr><th>Delivery note</th><th>Customer</th><th>Delivered</th><th>Value to invoice</th><th>Waiting</th></tr></thead><tbody>${body}</tbody></table></div>`;
		}

		// ---- interaction ---------------------------------------------------
		setTab(id) {
			this.tab = id;
			this.$el.find(".ppgd-tab").each((_, el) => $(el).toggleClass("on", $(el).data("tab") === id));
			this.$el.find(".ppgd-pane").each((_, el) => $(el).toggleClass("on", $(el).data("pane") === id));
		}

		bind() {
			this.$el.off(".ppgd");
			this.$el.on("click.ppgd", ".ppgd-tab", (e) => this.setTab($(e.currentTarget).data("tab")));
		}
	}

	window.PPGDeliveryDashboard = PPGDeliveryDashboard;
})();

/* Period selected in the dashboard header (MTD / QTD / YTD). */
function ppgd_current_period(data) {
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
 * Adds a card after the last card that belongs to the Delivery tab.
 */
function render_delivery_dashboard(data) {
	try {
		const $cards = $("[data-sections]").filter((_, el) => $(el).attr("id") !== "ppgd-root");
		if (!$cards.length) {
			console.warn("PPGD: no [data-sections] cards found on the page.");
			return;
		}

		let $root = $("#ppgd-root");
		if (!$root.length) {
			const hasDelivery = (el) =>
				($(el).attr("data-sections") || "").split(",").map((s) => s.trim()).includes("Delivery");

			let $anchor = $cards.filter((_, el) => hasDelivery(el)).last();
			if (!$anchor.length) $anchor = $cards.last();

			$root = $('<div id="ppgd-root"></div>')
				.addClass($anchor.attr("class") || "md-card section-box")
				.attr("data-sections", "All,Delivery")
				.css("grid-column", "1 / -1")
				.insertAfter($anchor);
			window.ppgd_dashboard = new PPGDeliveryDashboard($root);

			$(document)
				.off("click.ppgd")
				.on("click.ppgd", ".md-tab", function () {
					const sec = $(this).attr("data-section");
					$("#ppgd-root").toggle(sec === "All" || sec === "Delivery");
				});
		}

		const active = $(".md-tab.active, .md-tab.is-active, .md-tab.selected").first().attr("data-section");
		$root.toggle(!active || active === "All" || active === "Delivery");

		window.ppgd_dashboard.refresh({
			as_of_date: data.as_of_date,
			period: ppgd_current_period(data),
		});
	} catch (e) {
		console.error("PPGD: delivery dashboard failed", e);
	}
}
