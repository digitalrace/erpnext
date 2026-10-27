/* ===== Service tab: engineer-wise Service Complaints (SC) and Service Reports (SR) ===== */
(function () {
  const esc = frappe.utils.escape_html;
  const link = (dt, name) => `<a href="/app/${frappe.router.slug(dt)}/${encodeURIComponent(name)}">${esc(name)}</a>`;
  const tag = (cls, t) => `<span class="ppgs-t ${cls}">${esc(String(t))}</span>`;
  const ageTag = (d) => tag(d > 14 ? "r" : d > 7 ? "a" : "x", d + " d");
  const prTag = (p) => tag(p === "High" ? "r" : p === "Medium" ? "a" : "x", p);
  const fmt = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "-";
  const dash = (v) => v ? v : "-";
  let DATA = null, SEL = null;

  const CSS = `
  .ppgs{display:flex;flex-direction:column;gap:16px;font-size:13px}
  .ppgs-alert{border-radius:14px;padding:12px 18px;font-size:14px;line-height:1.5}
  .ppgs-alert.r{background:#fbd7d7;color:#8a1f1f}.ppgs-alert.a{background:#fae0a8;color:#6b4200}.ppgs-alert.g{background:#cdeedd;color:#0d5a3c}
  .ppgs-g{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(380px,1fr))}
  .ppgs-g2{display:grid;gap:16px;grid-template-columns:1.7fr 1fr}
  .ppgs-k{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
  .ppgs-k b{display:block;font-size:26px;margin:2px 0}.ppgs-k small,.ppgs-k span{color:var(--text-muted)}
  .ppgs-c{background:var(--card-bg,#fff);border:1px solid var(--border-color,#dcd9cf);border-radius:16px;padding:18px;min-width:0}
  .ppgs-c h3{margin:0 0 2px;font-size:16px}.ppgs-c p{margin:0 0 10px;color:var(--text-muted)}
  .ppgs table{width:100%;border-collapse:collapse}.ppgs th{text-align:left;font-weight:500;color:var(--text-muted);padding:5px 6px 5px 0;border-bottom:1px solid var(--border-color,#dcd9cf)}
  .ppgs td{padding:8px 6px 8px 0;border-bottom:1px solid var(--border-color,#eeece5);white-space:nowrap}.ppgs .n{text-align:right;padding-right:0}
  .ppgs-t{display:inline-block;padding:1px 9px;border-radius:999px;font-size:12px}
  .ppgs-t.r{background:#fbd7d7;color:#8a1f1f}.ppgs-t.a{background:#fae0a8;color:#6b4200}.ppgs-t.g{background:#cdeedd;color:#0d5a3c}.ppgs-t.b{background:#d6e6fb;color:#134a8c}.ppgs-t.x{background:#ebe9e2;color:#444}
  .ppgs-bar{display:grid;grid-template-columns:80px 1fr 40px;gap:10px;align-items:center;margin:9px 0}
  .ppgs-bar i{display:block;height:20px;border-radius:6px}.ppgs-bar em{font-style:normal;text-align:right}
  .ppgs-chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
  .ppgs-chip{border:1px solid var(--border-color,#d6d3ca);border-radius:999px;padding:6px 14px;cursor:pointer;color:var(--text-muted)}
  .ppgs-chip.on{background:#cfe3fb;border-color:#7fb0ee;color:#134a8c}
  .ppgs-mk{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px}
  .ppgs-mk div{background:var(--control-bg,#f3f1ea);border-radius:12px;padding:10px 14px;min-width:120px}.ppgs-mk small{font-size:12px;color:var(--text-muted)}.ppgs-mk b{display:block;font-size:18px;margin-top:2px}
  .ppgs-sub{font-weight:600;color:var(--text-muted);text-transform:uppercase;font-size:11px;margin:4px 0 6px}
  .ppgs-row{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid var(--border-color,#eeece5)}
  .ppgs-empty{padding:30px;text-align:center;color:var(--text-muted)}
  .ppgs-hide{display:none !important}
  @media(max-width:900px){.ppgs-g2{grid-template-columns:1fr}}`;

  const table = (head, rows) => `<div style="overflow-x:auto"><table><tr>${head.map((h, i) =>
    `<th class="${i === head.length - 1 ? "n" : ""}">${h}</th>`).join("")}</tr>${rows.join("") ||
    `<tr><td colspan="${head.length}">Nothing to show</td></tr>`}</table></div>`;
  const card = (t, s, body) => `<div class="ppgs-c"><h3>${t}</h3><p>${s}</p>${body}</div>`;
  const engCell = (e) => e.id ? `${esc(e.name)} <span style="color:var(--text-muted);font-weight:400">${esc(e.id)}</span>` : tag("r", "Unassigned");

  function draw() {
    const d = DATA, s = d.summary, a = d.attention;
    const tone = (s.high || s.unassigned) ? "r" : s.open ? "a" : "g";
    const parts = [];
    if (s.open) parts.push(`${s.open} Service Complaint${s.open > 1 ? "s are" : " is"} open and the oldest is ${s.oldest} days old.`);
    if (d.high_first) parts.push(`${s.high} ${s.high > 1 ? "are" : "is"} High priority (${esc(d.high_first.name)}, open ${d.high_first.days} days).`);
    if (s.unassigned) parts.push(`${s.unassigned} complaint${s.unassigned > 1 ? "s have" : " has"} no engineer assigned, so nobody owns ${s.unassigned > 1 ? "them" : "it"}.${d.unassigned_first.length ? " Assign " + d.unassigned_first.map(esc).join(" and ") + " first." : ""}`);
    const alert = parts.length ? parts.join(" ") : "No open Service Complaints.";

    const sel = d.engineers.find((e) => (e.id || "__none__") === SEL) || d.engineers[0];
    const pr = d.priority, pmx = Math.max(pr.High, pr.Medium, pr.Low, pr["Not set"], 1);
    const pcol = { High: "#e24b4b", Medium: "#b9761a", Low: "#1c9f74", "Not set": "#9a9a92" };
    const pbars = Object.keys(pr).filter((k) => pr[k] > 0).map((k) =>
      `<div class="ppgs-bar"><span>${k}</span><i style="width:${pr[k] / pmx * 100}%;background:${pcol[k]}"></i><em>${pr[k]}</em></div>`).join("") || "<p>No open complaints</p>";

    const engRows = d.engineers.map((e) => `<tr><td>${engCell(e)}</td><td class="n">${e.open}</td><td class="n">${e.high ? tag("r", e.high) : "-"}</td>
      <td class="n">${e.open ? ageTag(e.oldest) : "-"}</td><td class="n">${e.id ? e.sr_count : "-"}</td><td class="n">${e.fvf === null ? "-" : tag(e.fvf < 50 ? "a" : "g", e.fvf + "%")}</td></tr>`);
    const chips = d.engineers.map((e) => `<span class="ppgs-chip ${e === sel ? "on" : ""}" data-id="${esc(e.id || "__none__")}">${esc(e.name)}</span>`).join("");
    const scRows = (sel ? sel.sc : []).map((c) => `<tr><td>${link("Service Complaint", c.name)}</td><td>${c.customer ? esc(c.customer) : tag("x", "Not entered")}</td><td>${prTag(c.priority)}</td><td>${fmt(c.date)}</td><td class="n">${ageTag(c.days)}</td></tr>`);
    const srRows = (sel ? sel.sr : []).map((r) => `<tr><td>${link("Service Report", r.name)}</td><td>${r.complaint ? link("Service Complaint", r.complaint) : "-"}</td><td>${fmt(r.date)}</td><td style="white-space:normal">${esc(dash(r.work))}</td><td class="n">${r.fvf === null ? "-" : tag(r.fvf ? "g" : "a", r.fvf ? "Fixed first visit" : "Revisit")}</td></tr>`);
    const mk = sel ? `<div class="ppgs-mk">
      <div><small>Employee</small><b style="font-size:15px">${esc(sel.id || "Unassigned")}</b></div>
      <div><small>Open SC</small><b>${sel.open}</b></div>
      ${sel.high ? `<div><small>High priority</small><b style="color:#8a1f1f">${sel.high}</b></div>` : ""}
      ${sel.open ? `<div><small>Oldest open</small><b>${sel.oldest} d</b></div>` : ""}
      ${sel.id ? `<div><small>SR this period</small><b>${sel.sr_count}</b></div>` : ""}
      ${sel.avg_response !== null && sel.avg_response !== undefined ? `<div><small>First response</small><b>${sel.avg_response} hrs</b></div>` : ""}</div>` : "";

    const allRows = d.complaints.map((c) => `<tr><td>${link("Service Complaint", c.name)}</td><td>${c.customer ? esc(c.customer) : tag("x", "Not entered")}</td><td>${prTag(c.priority)}</td><td>${fmt(c.date)}</td><td class="n">${ageTag(c.days)}</td><td class="n">${c.emp ? esc(c.engineer) : tag("r", "Unassigned")}</td></tr>`);
    const repRows = d.reports.map((r) => `<tr><td>${link("Service Report", r.name)}</td><td>${r.complaint ? link("Service Complaint", r.complaint) : "-"}</td><td>${esc(r.engineer)}</td><td class="n">${fmt(r.date)}</td></tr>`);
    const att = [["Complaints with no engineer assigned", a.unassigned, "r"], ["High priority complaints open", a.high, "r"],
      ["Complaints with no priority set", a.no_priority, "a"], ["Complaints with no customer entered", a.no_customer, "a"]]
      .filter((x) => x[1] > 0).map((x) => `<div class="ppgs-row"><span>${x[0]}</span>${tag(x[2], x[1])}</div>`).join("") ||
      `<div class="ppgs-row"><span>All clear, nothing needs action</span>${tag("g", "OK")}</div>`;

    return `<style>${CSS}</style><div class="ppgs ppgs-root">
    <div class="ppgs-alert ${tone}">${alert}</div>
    <div class="ppgs-k">
      <div class="ppgs-c"><small>Open complaints</small><b>${s.open}</b><span>${s.raised} raised in period</span></div>
      <div class="ppgs-c"><small>High priority</small><b>${s.high}</b><span>${s.high ? "Oldest " + (d.high_first ? d.high_first.days : 0) + " days" : "None open"}</span></div>
      <div class="ppgs-c"><small>No engineer assigned</small><b>${s.unassigned}</b><span>Complaints nobody owns</span></div>
      <div class="ppgs-c"><small>Service Reports</small><b>${s.sr_count}</b><span>In period</span></div>
      <div class="ppgs-c"><small>First visit fix</small><b>${s.fvf === null ? "-" : s.fvf + "%"}</b><span>Fixed in the first visit</span></div>
    </div>
    <div class="ppgs-g2">
      ${card("Engineer-wise workload", "Open Service Complaints (SC) and Service Reports (SR) by service engineer", table(["Engineer", "Open SC", "High", "Oldest", "SR in period", "First visit fix"], engRows))}
      ${card("Open complaints by priority", s.open + " open Service Complaints", pbars)}
    </div>
    ${card("Engineer detail", "Complaints assigned (SC) and visits done (SR) for one engineer", `<div class="ppgs-chips">${chips}</div>${mk}
      <div class="ppgs-g"><div><div class="ppgs-sub">Service Complaints (SC) assigned</div>${table(["Complaint", "Customer", "Priority", "Raised", "Open"], scRows)}</div>
      <div><div class="ppgs-sub">Service Reports (SR) in period</div>${table(["Report", "Complaint", "Visit", "Work done", "Result"], srRows)}</div></div>`)}
    <div class="ppgs-g2">
      ${card("All open Service Complaints", "Oldest first, with the engineer who owns each one", table(["Complaint", "Customer", "Priority", "Raised", "Open", "Engineer"], allRows))}
      <div style="display:flex;flex-direction:column;gap:16px">
        ${card("Recent Service Reports", "Latest visits, all engineers", table(["Report", "Complaint", "Engineer", "Visit"], repRows))}
        ${card("Needs attention", "Open items in service", att)}
      </div>
    </div></div>`;
  }

  function host() {
    let $h = $("#ppgs-host");
    if (!$h.length) {
      const $l = $('[data-sections*="Service"]').last();
      $h = $('<div id="ppgs-host" style="grid-column:1/-1;width:100%;display:none"></div>').appendTo($l.length ? $l.parent() : $(".layout-main-section").first());
    }
    return $h;
  }

  function apply() {
    const on = $(".md-tab.active").data("section") === "Service";
    host().toggle(on);
    $("#kpi-open-complaints").parent().toggleClass("ppgs-hide", on);
    $("[data-sections]").each(function () {
      const $e = $(this);
      $e.toggleClass("ppgs-hide", on && !$e.find(".ppgs-root").length);
    });
  }

  function show() { host().html(draw()); apply(); }

  window.render_service_engineers = function (data) {
    const args = { as_of_date: data && data.as_of_date, period: (data && data.period) || $("#dashboard-period").val() || "MTD" };
    return frappe.call({ method: "ppg_dashboard.api.service_engineers.get_service_engineers", args: args }).then(function (r) {
      DATA = r.message;
      if (!SEL || !DATA.engineers.some((e) => (e.id || "__none__") === SEL)) {
        const first = DATA.engineers[0];
        SEL = first ? (first.id || "__none__") : null;
      }
      show();
    }).catch(function (err) {
      console.error("Service engineers error:", err);
      host().html('<div class="ppgs-empty">Could not load service engineer data. Check the browser console and the Error Log.</div>');
      apply();
    });
  };

  $(document).on("click", ".ppgs-chip", function () { SEL = $(this).attr("data-id"); if (DATA) show(); });
  let timer = null;
  const later = function () { clearTimeout(timer); timer = setTimeout(apply, 80); };
  $(document).on("click", ".md-tab", later);
  new MutationObserver(later).observe(document.body, { childList: true, subtree: true });
})();
