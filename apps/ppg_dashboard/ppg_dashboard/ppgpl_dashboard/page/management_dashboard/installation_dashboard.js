/*
 * Installation section renderer for the Management Dashboard.
 *
 * Appended to management_dashboard.js by the install script. render_data(data)
 * calls render_installation_dashboard(data), which adds a card after the last
 * card that belongs to the Installation tab and fills it from
 * ppg_dashboard.api.installation_dashboard.get_installation_dashboard.
 */
(function () {
	"use strict";

	const METHOD = "ppg_dashboard.api.installation_dashboard.get_installation_dashboard";
	const STYLE_ID = "ppgi-style";

	const CSS = `
.ppgi{font-size:13px;color:var(--text-color,#1f272e)}
.ppgi *{box-sizing:border-box}
.ppgi-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.ppgi-title{font-size:16px;font-weight:600}
.ppgi-muted{color:var(--text-muted,#6b7280);font-size:12px}
.ppgi-btn{padding:6px 12px;border:1px solid var(--border-color,#d1d5db);border-radius:6px;background:transparent;color:inherit;text-decoration:none;font-size:12px}
.ppgi-banner{display:flex;gap:10px;border-radius:8px;padding:10px 12px;margin-bottom:10px;line-height:1.5}
.ppgi-banner.bad{background:#fdeaea;color:#a42626}.ppgi-banner.warn{background:#fff6e0;color:#8a5a00}.ppgi-banner.good{background:#e6f6e6;color:#0a6a0a}.ppgi-banner.info{background:#eef4fd;color:#1d4f91}
.ppgi-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:12px}
.ppgi-kpi{border:1px solid var(--border-color,#e5e7eb);border-radius:8px;padding:10px 12px;background:var(--card-bg,#fff)}
.ppgi-kpi .v{font-size:22px;font-weight:600;margin:2px 0}
.ppgi-red{color:#d03b3b}.ppgi-amber{color:#b7791f}.ppgi-green{color:#0a8a0a}
.ppgi-h{display:flex;justify-content:space-between;gap:8px;margin:14px 0 8px;font-weight:600}
.ppgi-h span{font-weight:400;color:var(--text-muted,#6b7280);font-size:11px}
.ppgi-flow{display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:8px;margin-bottom:14px}
.ppgi-stage{border:1px solid var(--border-color,#e5e7eb);border-radius:8px;padding:8px 10px;background:var(--card-bg,#fff)}
.ppgi-stage b{display:block;font-size:18px;font-weight:600}
.ppgi-stage.hot{background:#fff6e0;border-color:transparent}.ppgi-stage.hot b,.ppgi-stage.hot .ppgi-muted{color:#8a5a00}
.ppgi-row{display:flex;align-items:center;gap:10px;margin:8px 0}
.ppgi-lab{width:150px;flex-shrink:0;font-size:12px}
.ppgi-trk{flex:1;position:relative;height:22px;border-radius:4px;background:var(--control-bg,#f3f4f6)}
.ppgi-trk i{position:absolute;display:block}
.ppgi-end{width:86px;flex-shrink:0;text-align:right;font-size:12px}
.ppgi-axis{position:relative;height:16px;flex:1;font-size:11px;color:var(--text-muted,#6b7280)}
.ppgi-axis span{position:absolute}
.ppgi-legend{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:11px;color:var(--text-muted,#6b7280);margin-top:8px}
.ppgi-legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}
.ppgi-tabs{display:flex;gap:2px;border-bottom:1px solid var(--border-color,#e5e7eb);margin:14px 0 10px;flex-wrap:wrap}
.ppgi-tab{padding:7px 14px;cursor:pointer;color:var(--text-muted,#6b7280);border:0;border-bottom:2px solid transparent;background:none;font-size:13px}
.ppgi-tab.on{color:var(--text-color,#1f272e);border-bottom-color:var(--text-color,#1f272e);font-weight:600}
.ppgi-pane{display:none}.ppgi-pane.on{display:block}
.ppgi-scroll{overflow-x:auto}
.ppgi-table{width:100%;border-collapse:collapse;min-width:680px}
.ppgi-table th{text-align:left;font-weight:500;color:var(--text-muted,#6b7280);font-size:12px;padding:8px 10px 8px 0;border-bottom:1px solid var(--border-color,#e5e7eb);white-space:nowrap}
.ppgi-table td{padding:9px 10px 9px 0;border-bottom:1px solid var(--border-color,#eef0f2);white-space:nowrap}
.ppgi-table tr:last-child td{border-bottom:0}
.ppgi-pill{font-size:11px;padding:2px 8px;border-radius:6px;background:var(--control-bg,#f3f4f6);color:var(--text-muted,#6b7280)}
.ppgi-pill.bad{background:#fdeaea;color:#a42626}.ppgi-pill.good{background:#e6f6e6;color:#0a6a0a}.ppgi-pill.warn{background:#fff6e0;color:#8a5a00}
.ppgi-avatar{display:inline-flex;width:22px;height:22px;border-radius:50%;background:#e8eefb;color:#1d4f91;align-items:center;justify-content:center;font-size:10px;margin-right:6px;vertical-align:middle}
.ppgi-empty{padding:22px;text-align:center;color:var(--text-muted,#6b7280)}
.ppgi a{color:inherit;text-decoration:underline;text-decoration-color:var(--border-color,#c7ccd1)}
`;

	// ---- helpers ----------------------------------------------------------
	const esc = (v) => frappe.utils.escape_html(v == null ? "" : String(v));
	const dateStr = (d) => (d ? frappe.datetime.str_to_user(d) : "–");
	const link = (doctype, name) => `<a href="/app/${doctype}/${encodeURIComponent(name)}">${esc(name)}</a>`;
	const num = (v) => (Math.round((v || 0) * 100) / 100).toLocaleString("en-IN");
	const initials = (n) =>
		String(n || "?").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
	const person = (n) => `<span class="ppgi-avatar">${esc(initials(n))}</span>${esc(n)}`;

	function injectStyle() {
		if (document.getElementById(STYLE_ID)) return;
		const el = document.createElement("style");
		el.id = STYLE_ID;
		el.textContent = CSS;
		document.head.appendChild(el);
	}

	const STATUS = {
		site_not_ready: ["bad", "Site not ready"],
		to_schedule: ["warn", "Not scheduled"],
		scheduled: ["", "Scheduled"],
	};

	// ---- component --------------------------------------------------------
	class PPGInstallationDashboard {
		constructor($el) {
			injectStyle();
			this.$el = $($el);
			this.tab = "pending";
			this.data = null;
			this.bind();
		}

		refresh(opts = {}) {
			this.$el.html(`<div class="ppgi-empty">Loading installation data…</div>`);
			return frappe
				.call({ method: METHOD, args: opts })
				.then((r) => {
					this.data = r.message;
					this.render();
				})
				.catch((err) => {
					console.error("Installation dashboard error:", err);
					this.$el.html(
						`<div class="ppgi-empty">Could not load installation data. Check the browser console and the Error Log.</div>`
					);
				});
		}

		render() {
			const d = this.data;
			if (!d) return;
			this.$el.html(`
				<div class="ppgi">
					<div class="ppgi-head">
						<div><div class="ppgi-title">Installation</div><div class="ppgi-muted">Post-delivery installation status · ${esc(d.period)} · as of ${esc(dateStr(d.as_of_date))}</div></div>
						<a class="ppgi-btn" href="/app/installation-note">View installations</a>
					</div>
					${this.banners(d)}
					${this.kpis(d)}
					<div class="ppgi-h">Delivery to installation pipeline <span>Open delivery notes, then installed in ${esc(d.period)}</span></div>
					${this.pipeline(d)}
					<div class="ppgi-h">Days waiting since delivery <span>Target: ${d.config.target_days} days</span></div>
					${this.waitChart(d)}
					<div class="ppgi-h">Installation engineers <span>${esc(d.period)}</span></div>
					${this.engineerTable(d.engineers)}
					${this.tabsHtml(d)}
				</div>`);
			this.setTab(this.tab);
		}

		banners(d) {
			const s = d.summary;
			const T = d.config.target_days;
			const out = [];
			if (!s.pending) {
				out.push(["good", "Every delivered order has been installed."]);
			} else {
				const oldest = d.pending[0];
				const site = d.pending.find((p) => p.status === "site_not_ready");
				const unsched = d.pending.filter((p) => p.status === "to_schedule").sort((a, b) => b.waiting_days - a.waiting_days)[0];
				let msg = s.over_target === s.pending
					? `<b>All ${s.pending} delivered orders are still waiting for installation</b>, past the ${T} day target.`
					: s.over_target
					? `<b>${s.over_target} of ${s.pending} delivered orders are past the ${T} day installation target.</b>`
					: `<b>${s.pending} delivered orders are waiting for installation</b>, all within the ${T} day target.`;
				if (s.over_target) {
					if (site) msg += ` ${esc(site.dn)} (${esc(site.customer)}) has waited ${site.waiting_days} days because the site is not ready.`;
					if (unsched) msg += ` ${esc(unsched.dn)} (${esc(unsched.customer)}) has not been scheduled in ${unsched.waiting_days} days.`;
					if (!site && !unsched) msg += ` Oldest is ${esc(oldest.dn)} (${esc(oldest.customer)}), ${oldest.waiting_days} days.`;
				}
				out.push([s.over_target ? "bad" : "warn", msg]);
			}
			if (!d.config.assignment_enabled)
				out.push([
					"info",
					"Installation Assignment is not set up yet, so every pending order shows as not scheduled. Run the setup script, then create an Installation Assignment from each Delivery Note.",
				]);
			return out.map(([t, m]) => `<div class="ppgi-banner ${t}"><span>${m}</span></div>`).join("");
		}

		kpis(d) {
			const s = d.summary;
			const k = (label, value, sub, cls = "") =>
				`<div class="ppgi-kpi"><div class="ppgi-muted">${label}</div><div class="v ${cls}">${value}</div><div class="ppgi-muted ${cls}">${sub}</div></div>`;
			return `<div class="ppgi-kpis">
				${k("Pending installations", s.pending, `${num(s.pending_units)} units delivered`)}
				${k(`Waiting over ${d.config.target_days} days`, s.over_target, s.pending ? `Avg ${s.avg_wait} days` : "–", s.over_target ? "ppgi-red" : "")}
				${k("Scheduled this week", s.scheduled_week, `${num(s.scheduled_week_units)} units`)}
				${k("Not scheduled", s.not_scheduled, s.site_not_ready ? `${s.site_not_ready} site not ready` : "Needs a date", s.not_scheduled ? "ppgi-amber" : "")}
				${k(`Installed (${esc(d.period)})`, s.installed, s.avg_days_to_install == null ? "No installations yet" : `Avg ${s.avg_days_to_install} days to install`)}
				${k("Sign-off pending", s.signoff_pending == null ? "–" : s.signoff_pending, s.signoff_pending == null ? "Field not set up" : s.signoff_pending ? `Oldest ${s.signoff_oldest} days` : "All signed", s.signoff_pending ? "ppgi-amber" : "")}
			</div>`;
		}

		pipeline(d) {
			const s = d.summary;
			const stages = [
				["Delivered, pending", s.pending, `${num(s.pending_units)} units`, ""],
				["Site not ready", s.site_not_ready, "Customer side", s.site_not_ready ? "hot" : ""],
				["To schedule", s.to_schedule, "Needs a date", s.to_schedule ? "hot" : ""],
				["Scheduled", s.scheduled, "Date fixed", ""],
				[`Installed (${d.period})`, s.installed, "Notes submitted", ""],
				["Signed off", s.signed_off == null ? "–" : s.signed_off, "Customer signed", ""],
			];
			return `<div class="ppgi-flow">${stages
				.map(
					([l, n, sub, cls]) =>
						`<div class="ppgi-stage ${cls}"><span class="ppgi-muted">${l}</span><b>${n}</b><span class="ppgi-muted">${sub}</span></div>`
				)
				.join("")}</div>`;
		}

		waitChart(d) {
			const rows = d.pending.slice(0, 12);
			if (!rows.length) return `<div class="ppgi-empty">Nothing waiting.</div>`;
			const T = d.config.target_days;
			const max = Math.max(T * 2, ...rows.map((r) => r.waiting_days)) * 1.05;
			const pct = (v) => Math.min(100, (v / max) * 100);
			const body = rows
				.map((r) => {
					const over = r.waiting_days - T;
					const color = over > 10 ? "#E24B4A" : over > 0 ? "#EF9F27" : "#1D9E75";
					const cls = over > 10 ? "ppgi-red" : over > 0 ? "ppgi-amber" : "ppgi-green";
					return `<div class="ppgi-row">
						<div class="ppgi-lab">${link("delivery-note", r.dn)}<br><span class="ppgi-muted">${esc(r.customer)} · ${num(r.units)} ${r.units === 1 ? "unit" : "units"}</span></div>
						<div class="ppgi-trk">
							<i style="left:0;width:${pct(r.waiting_days)}%;top:6px;height:10px;border-radius:2px;background:${color}"></i>
							<i style="left:${pct(T)}%;top:0;bottom:0;width:2px;background:var(--text-color,#1f272e)"></i>
						</div>
						<div class="ppgi-end ${cls}">${r.waiting_days} d${over > 0 ? ` (+${over})` : ""}</div>
					</div>`;
				})
				.join("");
			const ticks = [[0, "0"], [T, `${T} d`], [Math.round(max / 2), `${Math.round(max / 2)} d`], [max, `${Math.round(max)} d`]]
				.map(([v, l], i, a) => {
					const style = i === 0 ? "left:0" : i === a.length - 1 ? "right:0" : `left:${pct(v)}%;transform:translateX(-50%)`;
					return `<span style="${style}">${l}</span>`;
				})
				.join("");
			return `${body}
				<div class="ppgi-row" style="margin:2px 0 0"><div class="ppgi-lab"></div><div class="ppgi-axis">${ticks}</div><div class="ppgi-end"></div></div>
				<div class="ppgi-legend"><span><i style="background:var(--text-color,#1f272e);width:3px"></i>${T} day target</span><span><i style="background:#E24B4A"></i>More than 10 days over</span><span><i style="background:#EF9F27"></i>Up to 10 days over</span><span><i style="background:#1D9E75"></i>Within target</span></div>`;
		}

		engineerTable(rows) {
			if (!rows.length) return `<div class="ppgi-empty">No engineer data.</div>`;
			const pill = {
				on_track: ["good", "On track"],
				stretched: ["warn", "Stretched"],
				not_scheduled: ["bad", "Not scheduled"],
			};
			const body = rows
				.map((e) => {
					const [c, l] = pill[e.status];
					return `<tr>
						<td>${person(e.engineer)}</td>
						<td>${esc(e.territory || "–")}</td>
						<td>${e.pending}</td>
						<td>${e.week}</td>
						<td>${e.installed}</td>
						<td class="${e.avg_days != null && e.avg_days > this.data.config.target_days ? "ppgi-amber" : ""}">${e.avg_days == null ? "–" : e.avg_days}</td>
						<td><span class="ppgi-pill ${c}">${l}</span></td>
					</tr>`;
				})
				.join("");
			return `<div class="ppgi-scroll"><table class="ppgi-table" style="min-width:560px"><thead><tr><th>Engineer</th><th>Territory</th><th>Pending</th><th>This week</th><th>Installed</th><th>Avg days to install</th><th>Status</th></tr></thead><tbody>${body}</tbody></table></div>`;
		}

		tabsHtml(d) {
			const s = d.summary;
			const tabs = [
				["pending", `Pending installations (${s.pending})`],
				["week", `This week (${s.scheduled_week})`],
				["installed", "Installed"],
				["signoff", `Awaiting sign-off${s.signoff_pending == null ? "" : ` (${s.signoff_pending})`}`],
			];
			return `
			<div class="ppgi-tabs">${tabs.map(([id, l]) => `<button class="ppgi-tab" data-tab="${id}">${l}</button>`).join("")}</div>
			<div class="ppgi-pane" data-pane="pending">${this.pendingTable(d.pending)}</div>
			<div class="ppgi-pane" data-pane="week">${this.weekTable(d.week)}</div>
			<div class="ppgi-pane" data-pane="installed">${this.installedTable(d.installed)}</div>
			<div class="ppgi-pane" data-pane="signoff">${this.signoffTable(d)}</div>`;
		}

		pendingTable(rows) {
			if (!rows.length) return `<div class="ppgi-empty">No pending installations.</div>`;
			const T = this.data.config.target_days;
			const body = rows
				.map((r) => {
					const [c, l] = STATUS[r.status];
					const st = r.status === "scheduled"
						? `<span class="ppgi-pill ${r.planned_missed ? "bad" : ""}">${r.planned_missed ? "Missed " : "Scheduled "}${esc(dateStr(r.planned))}</span>`
						: `<span class="ppgi-pill ${c}">${l}</span>`;
					const stLink = r.plan_note ? `<a href="/app/installation-assignment/${encodeURIComponent(r.plan_note)}">${st}</a>` : st;
					return `<tr>
						<td>${link("delivery-note", r.dn)}</td>
						<td>${esc(r.customer)}</td>
						<td>${esc(r.items)}</td>
						<td>${num(r.units)}</td>
						<td>${esc(dateStr(r.delivered))}</td>
						<td><span class="ppgi-pill ${r.waiting_days > T + 10 ? "bad" : r.waiting_days > T ? "warn" : ""}">${r.waiting_days} days</span></td>
						<td>${esc(r.engineer)}</td>
						<td>${stLink}</td>
					</tr>`;
				})
				.join("");
			return `<div class="ppgi-scroll"><table class="ppgi-table"><thead><tr><th>Delivery note</th><th>Customer</th><th>Item</th><th>Units</th><th>Delivered</th><th>Waiting</th><th>Engineer</th><th>Status</th></tr></thead><tbody>${body}</tbody></table></div>`;
		}

		weekTable(rows) {
			if (!rows.length) return `<div class="ppgi-empty">Nothing scheduled in the next 7 days.</div>`;
			const body = rows
				.map(
					(r) => `<tr><td>${esc(dateStr(r.planned))}</td><td>${esc(r.customer)}</td><td>${link("delivery-note", r.dn)}</td><td>${num(r.units)}</td><td>${esc(r.territory || "–")}</td><td>${esc(r.engineer)}</td></tr>`
				)
				.join("");
			return `<div class="ppgi-scroll"><table class="ppgi-table" style="min-width:560px"><thead><tr><th>Date</th><th>Customer</th><th>Delivery note</th><th>Units</th><th>Territory</th><th>Engineer</th></tr></thead><tbody>${body}</tbody></table></div>`;
		}

		installedTable(rows) {
			if (!rows.length) return `<div class="ppgi-empty">No installations yet.</div>`;
			const T = this.data.config.target_days;
			const sign = (r) =>
				r.signed == null ? "–" : r.signed ? `<span class="ppgi-pill good">Signed</span>` : `<span class="ppgi-pill warn">Pending</span>`;
			const body = rows
				.map(
					(r) => `<tr>
						<td>${link("installation-note", r.name)}</td>
						<td>${esc(r.customer)}</td>
						<td>${esc(dateStr(r.date))}</td>
						<td>${esc(r.engineer)}</td>
						<td class="${r.days_to_install != null && r.days_to_install > T ? "ppgi-amber" : ""}">${r.days_to_install == null ? "–" : r.days_to_install + " days"}</td>
						<td>${sign(r)}</td>
					</tr>`
				)
				.join("");
			return `<div class="ppgi-scroll"><table class="ppgi-table" style="min-width:560px"><thead><tr><th>Installation note</th><th>Customer</th><th>Installed</th><th>Engineer</th><th>Days after delivery</th><th>Sign-off</th></tr></thead><tbody>${body}</tbody></table></div>
			<div class="ppgi-muted" style="margin-top:8px">Latest ${rows.length} installations.</div>`;
		}

		signoffTable(d) {
			if (!d.config.signoff_enabled)
				return `<div class="ppgi-empty">Sign-off tracking is not set up. Add the Check field <b>custom_customer_signoff</b> on Installation Note.</div>`;
			if (!d.awaiting_signoff.length) return `<div class="ppgi-empty">Every installation has been signed off.</div>`;
			const body = d.awaiting_signoff
				.map(
					(r) => `<tr>
						<td>${link("installation-note", r.name)}</td>
						<td>${esc(r.customer)}</td>
						<td>${esc(dateStr(r.date))}</td>
						<td><span class="ppgi-pill ${r.waiting_days > 7 ? "bad" : "warn"}">${r.waiting_days} days</span></td>
						<td>${esc(r.engineer)}</td>
					</tr>`
				)
				.join("");
			return `<div class="ppgi-scroll"><table class="ppgi-table" style="min-width:560px"><thead><tr><th>Installation note</th><th>Customer</th><th>Installed</th><th>Waiting</th><th>Engineer</th></tr></thead><tbody>${body}</tbody></table></div>`;
		}

		// ---- interaction ---------------------------------------------------
		setTab(id) {
			this.tab = id;
			this.$el.find(".ppgi-tab").each((_, el) => $(el).toggleClass("on", $(el).data("tab") === id));
			this.$el.find(".ppgi-pane").each((_, el) => $(el).toggleClass("on", $(el).data("pane") === id));
		}

		bind() {
			this.$el.off(".ppgi");
			this.$el.on("click.ppgi", ".ppgi-tab", (e) => this.setTab($(e.currentTarget).data("tab")));
		}
	}

	window.PPGInstallationDashboard = PPGInstallationDashboard;
})();

/* Period selected in the dashboard header (MTD / QTD / YTD). */
function ppgi_current_period(data) {
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
 * Adds a card after the last card that belongs to the Installation tab.
 */
function render_installation_dashboard(data) {
	try {
		const $cards = $("[data-sections]").filter((_, el) => $(el).attr("id") !== "ppgi-root");
		if (!$cards.length) {
			console.warn("PPGI: no [data-sections] cards found on the page.");
			return;
		}

		let $root = $("#ppgi-root");
		if (!$root.length) {
			const has = (el) =>
				($(el).attr("data-sections") || "").split(",").map((s) => s.trim()).includes("Installation");

			let $anchor = $cards.filter((_, el) => has(el)).last();
			if (!$anchor.length) $anchor = $cards.last();

			$root = $('<div id="ppgi-root"></div>')
				.addClass($anchor.attr("class") || "md-card section-box")
				.attr("data-sections", "All,Installation")
				.css("grid-column", "1 / -1")
				.insertAfter($anchor);
			window.ppgi_dashboard = new PPGInstallationDashboard($root);

			$(document)
				.off("click.ppgi")
				.on("click.ppgi", ".md-tab", function () {
					const sec = $(this).attr("data-section");
					$("#ppgi-root").toggle(sec === "All" || sec === "Installation");
				});
		}

		const active = $(".md-tab.active, .md-tab.is-active, .md-tab.selected").first().attr("data-section");
		$root.toggle(!active || active === "All" || active === "Installation");

		window.ppgi_dashboard.refresh({
			as_of_date: data.as_of_date,
			period: ppgi_current_period(data),
		});
	} catch (e) {
		console.error("PPGI: installation dashboard failed", e);
	}
}
