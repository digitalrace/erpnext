/* ===== HR tab: attendance for any date, departments, leave, payroll ===== */
(function () {
  const esc = frappe.utils.escape_html;
  const TARGET = 90;
  const tag = (cls, t) => `<span class="ppgh-t ${cls}">${esc(String(t))}</span>`;
  const fmtD = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const inr = (v) => { v = flt(v); const a = Math.abs(v); return a >= 1e7 ? "₹" + (v / 1e7).toFixed(2) + " Cr" : a >= 1e5 ? "₹" + (v / 1e5).toFixed(1) + " L" : "₹" + Math.round(v).toLocaleString("en-IN"); };
  const pctTag = (p) => p === null || p === undefined ? "-" : tag(p >= TARGET ? "g" : p >= 75 ? "a" : "r", p + "%");
  const empCell = (p) => `<a href="/app/employee/${encodeURIComponent(p.id)}">${esc(p.name)}</a> <span class="ppgh-mu">${esc(p.id)}</span>`;
  let BASE = null, VIEW = null, DATA = null, PANEL = "absent", DEPT = null;

  const CSS = `
  .ppgh{display:flex;flex-direction:column;gap:16px;font-size:13px}
  .ppgh-alert{border-radius:14px;padding:12px 18px;font-size:14px;line-height:1.5}
  .ppgh-alert.r{background:#fbd7d7;color:#8a1f1f}.ppgh-alert.a{background:#fae0a8;color:#6b4200}.ppgh-alert.g{background:#cdeedd;color:#0d5a3c}.ppgh-alert.b{background:#d6e6fb;color:#134a8c}
  .ppgh-g{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(380px,1fr))}
  .ppgh-g2{display:grid;gap:16px;grid-template-columns:1.6fr 1fr}
  .ppgh-k{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
  .ppgh-k b{display:block;font-size:26px;margin:2px 0}.ppgh-k b.r{color:#8a1f1f}.ppgh-k b.a{color:#6b4200}.ppgh-k b.g{color:#0d6b47}.ppgh-k small,.ppgh-k span{color:var(--text-muted)}
  .ppgh-c{background:var(--card-bg,#fff);border:1px solid var(--border-color,#dcd9cf);border-radius:16px;padding:18px;min-width:0}
  .ppgh-click{cursor:pointer}.ppgh-click:hover{border-color:#7fb0ee;box-shadow:0 0 0 2px #d6e6fb}.ppgh-c.on{border-color:#7fb0ee;background:#f2f8ff}
  .ppgh-c h3{margin:0 0 2px;font-size:16px}.ppgh-c p{margin:0 0 10px;color:var(--text-muted)}
  .ppgh table{width:100%;border-collapse:collapse}.ppgh th{text-align:left;font-weight:500;color:var(--text-muted);padding:5px 6px 5px 0;border-bottom:1px solid var(--border-color,#dcd9cf)}
  .ppgh td{padding:8px 6px 8px 0;border-bottom:1px solid var(--border-color,#eeece5);white-space:nowrap}.ppgh .n{text-align:right;padding-right:0}
  .ppgh tr.ppgh-click:hover td{background:#f2f8ff}.ppgh tr.on td{background:#e6f0fd}
  .ppgh-mu{color:var(--text-muted);font-size:12px}
  .ppgh-t{display:inline-block;padding:1px 9px;border-radius:999px;font-size:12px}
  .ppgh-t.r{background:#fbd7d7;color:#8a1f1f}.ppgh-t.a{background:#fae0a8;color:#6b4200}.ppgh-t.g{background:#cdeedd;color:#0d5a3c}.ppgh-t.b{background:#d6e6fb;color:#134a8c}.ppgh-t.x{background:#ebe9e2;color:#444}
  .ppgh-chips{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .ppgh-chip{border:1px solid var(--border-color,#d6d3ca);border-radius:999px;padding:6px 14px;cursor:pointer;color:var(--text-muted);background:var(--card-bg,#fff)}
  .ppgh-chip.on{background:#cfe3fb;border-color:#7fb0ee;color:#134a8c}.ppgh-chip:hover{border-color:#7fb0ee}
  .ppgh-date{border:1px solid var(--border-color,#d6d3ca);border-radius:8px;padding:5px 8px;background:var(--card-bg,#fff)}
  .ppgh-ch{display:flex;align-items:flex-end;gap:8px}.ppgh-ch div{flex:1;text-align:center;color:var(--text-muted);font-size:11px;cursor:pointer}
  .ppgh-ch u{display:flex;align-items:flex-end;justify-content:center;height:120px;text-decoration:none;margin-bottom:4px}.ppgh-ch s{width:70%;border-radius:4px 4px 0 0}.ppgh-ch div.on s{outline:2px solid #134a8c}
  .ppgh-row{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid var(--border-color,#eeece5)}.ppgh-row.ppgh-click:hover{background:#f2f8ff}
  .ppgh-bar{display:grid;grid-template-columns:110px 1fr 50px;gap:10px;align-items:center;margin:9px 0}.ppgh-bar i{display:block;height:20px;border-radius:6px}.ppgh-bar em{font-style:normal;text-align:right}
  .ppgh-amber{background:#fadfa6;color:#6b4200;border-radius:16px;padding:18px}.ppgh-amber b{display:block;font-size:26px;margin:4px 0}
  .ppgh-empty{padding:30px;text-align:center;color:var(--text-muted)}
  .ppgh-hide{display:none !important}
  @media(max-width:900px){.ppgh-g2{grid-template-columns:1fr}}`;

  const table = (head, rows) => `<div style="overflow-x:auto"><table><tr>${head.map((h, i) => `<th class="${i === head.length - 1 ? "n" : ""}">${h}</th>`).join("")}</tr>${rows.join("") || `<tr><td colspan="${head.length}">Nothing to show</td></tr>`}</table></div>`;
  const card = (t, s, body, extra) => `<div class="ppgh-c ${extra || ""}"><h3>${t}</h3><p>${s}</p>${body}</div>`;
  const act = (a, v, extra) => `data-act="${a}" data-v="${esc(v)}" ${extra || ""}`;
  const listAct = (dt, filters) => `data-act="list" data-dt="${esc(dt)}" data-f='${esc(JSON.stringify(filters))}'`;

  function draw() {
    const d = DATA, s = d.summary, mv = d.movement, today = d.date;
    const rel = frappe.datetime.get_diff(BASE, today);
    const chips = [0, 1, 2, 3].map((n) => { const iso = frappe.datetime.add_days(BASE, -n);
      return `<span class="ppgh-chip ${iso === today ? "on" : ""}" ${act("date", iso)}>${n === 0 ? fmtD(iso) + " (as of date)" : n === 1 ? "Yesterday, " + fmtD(iso) : n + " days ago, " + fmtD(iso)}</span>`; }).join("");
    const worst = d.departments.find((g) => g.absent > 0);
    const parts = [];
    if (d.holiday && !s.present) parts.push(`${fmtD(today)} is a holiday (${esc(d.holiday)}), so nobody is counted absent.`);
    else {
      if (s.absent) parts.push(`${s.absent} of ${s.active} employees are absent${rel === 0 ? " today" : " on " + fmtD(today)}, so attendance is ${s.pct}% against a ${TARGET}% target.`);
      if (worst && s.absent) parts.push(`${esc(worst.department)} has the most absences (${worst.absent} of ${worst.staff}).`);
    }
    if (s.unmarked) parts.push(`${s.unmarked} employee${s.unmarked > 1 ? "s have" : " has"} no submitted Attendance for ${fmtD(today)}.`);
    if (s.repeated) parts.push(`${s.repeated} employee${s.repeated > 1 ? "s have" : " has"} been absent 3 or more days this month.`);
    if (d.leave_wait_count) parts.push(`${d.leave_wait_count} leave application${d.leave_wait_count > 1 ? "s are" : " is"} waiting for approval, the oldest for ${d.leave_wait_oldest} days.`);
    const tone = (!d.holiday || s.present) && s.pct !== null && s.pct < TARGET ? "r" : (s.repeated || d.leave_wait_count) ? "a" : "g";
    const alert = parts.length ? parts.join(" ") : `Attendance is ${s.pct === null ? "not available" : s.pct + "%"} and nothing needs action.`;

    const kpi = (cls, label, val, sub, attrs, on) => `<div class="ppgh-c ppgh-click ${on ? "on" : ""}" ${attrs}><small>${label}</small><b class="${cls}">${val}</b><span>${sub}</span></div>`;
    const sc = (c) => ({ r: "#8a1f1f", a: "#6b4200", g: "#0d6b47", "": "inherit" })[c];
    const colr = s.pct === null ? "" : s.pct >= TARGET ? "g" : s.pct >= 75 ? "a" : "r";
    const cm = s.pct_month === null ? "" : s.pct_month >= TARGET ? "g" : "a";
    const tiles = [
      kpi("", "Present", s.present, `of ${s.active} active employees`, act("tab", "present"), PANEL === "present"),
      kpi(s.absent ? "r" : "", "Absent", s.absent, "Not present, not on leave", act("tab", "absent"), PANEL === "absent"),
      kpi("", "On leave", s.leave, "Approved leave or marked on leave", act("tab", "leave"), PANEL === "leave"),
      kpi(colr, "Attendance", s.pct === null ? "-" : s.pct + "%", `Target ${TARGET}%. Click for check-ins`, listAct("Employee Checkin", { time: ["Between", [today, today]] })),
      kpi(cm, "Attendance this month", s.pct_month === null ? "-" : s.pct_month + "%", `${fmtD(d.month_start)} to ${fmtD(today)}`, listAct("Employee Checkin", { time: ["Between", [d.month_start, today]] })),
      kpi(s.late ? "a" : "", "Late arrivals", s.late === null ? "-" : s.late, s.late === null ? "No shift set" : `After shift start plus grace`, act("tab", "late"), PANEL === "late")].join("");

    const depRows = d.departments.map((g) => { const ex = g.present + g.absent, p = ex ? Math.round(g.present / ex * 100) : null;
      const col = p === null ? "#9a9a92" : p >= TARGET ? "#1c9f74" : p >= 75 ? "#b9761a" : "#e24b4b";
      return `<tr class="ppgh-click ${DEPT === g.department ? "on" : ""}" ${act("dept", g.department)}><td>${esc(g.department)}</td><td class="n">${g.staff}</td><td class="n">${g.present}</td><td class="n">${g.absent ? tag("r", g.absent) : "-"}</td><td class="n">${g.late ? tag("a", g.late) : "-"}</td>
        <td style="width:26%"><div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:10px;background:#ebe9e2;border-radius:6px"><i style="display:block;height:10px;width:${p || 0}%;background:${col};border-radius:6px"></i></div>${pctTag(p)}</div></td></tr>`; });
    const trend = `<div class="ppgh-ch">${d.trend.map((t) => `<div class="${t.date === today ? "on" : ""}" ${act("date", t.date)}><u><s style="height:${Math.max(t.pct, 1) * 1.15}px;background:${t.pct >= TARGET ? "#1c9f74" : t.pct >= 80 ? "#b9761a" : "#e24b4b"}"></s></u>${esc(t.label)}<br><small style="color:var(--text-color)">${t.pct}%</small></div>`).join("")}</div>`;

    // employee panel
    const inDept = (p) => !DEPT || p.department === DEPT;
    const tabs = [["absent", "Absent", s.absent], ["present", "Present", s.present]];
    if (s.late !== null) tabs.push(["late", "Late", s.late]);
    tabs.push(["leave", "On leave", s.leave]);
    if (s.unmarked) tabs.push(["unmarked", "Not marked", s.unmarked]);
    if (s.repeated) tabs.push(["repeated", "Repeated absence", s.repeated]);
    const list = d.people.filter(inDept);
    let head, rows;
    if (PANEL === "present") { head = ["Employee", "Department", "First in", "Basis", "Status"];
      rows = list.filter((p) => p.status === "present").sort((a, b) => a.first_in.localeCompare(b.first_in)).map((p) => `<tr><td>${empCell(p)}</td><td>${esc(p.department)}</td><td>${p.first_in || "-"}</td><td>${tag(p.source === "Attendance" ? "b" : "x", p.source)}</td><td class="n">${p.note ? tag("b", p.note) : p.late ? tag("a", p.late_min ? "Late " + p.late_min + " min" : "Marked late") : p.late_known ? tag("g", "On time") : "-"}</td></tr>`); }
    else if (PANEL === "late") { head = ["Employee", "Department", "First check-in", "Late by", "Late days this month"];
      rows = list.filter((p) => p.late).sort((a, b) => (b.late_min || 0) - (a.late_min || 0)).map((p) => `<tr><td>${empCell(p)}</td><td>${esc(p.department)}</td><td>${p.first_in}</td><td>${p.late_min ? tag("a", p.late_min + " min") : tag("a", "Marked late")}</td><td class="n">${p.late_mtd}</td></tr>`); }
    else if (PANEL === "unmarked") { head = ["Employee", "Department", "Status"];
      rows = list.filter((p) => p.status === "unmarked").map((p) => `<tr><td>${empCell(p)}</td><td>${esc(p.department)}</td><td class="n">${tag("x", "No submitted Attendance")}</td></tr>`); }
    else if (PANEL === "leave") { head = ["Employee", "Department", "Leave type", "Dates", "Basis"];
      rows = list.filter((p) => p.status === "leave").map((p) => `<tr><td>${empCell(p)}</td><td>${esc(p.department)}</td><td>${p.leave_type ? tag("b", p.leave_type) : tag("x", "Not specified")}</td><td>${p.leave_from ? fmtD(p.leave_from) + " to " + fmtD(p.leave_to) : "-"}</td><td class="n">${tag("x", p.source)}</td></tr>`); }
    else if (PANEL === "repeated") { head = ["Employee", "Department", "Absent days", "Late days"];
      rows = list.filter((p) => p.abs_mtd >= 3).sort((a, b) => b.abs_mtd - a.abs_mtd).map((p) => `<tr><td>${empCell(p)}</td><td>${esc(p.department)}</td><td>${tag(p.abs_mtd >= 5 ? "r" : "a", p.abs_mtd + " d")}</td><td class="n">${p.late_mtd || "-"}</td></tr>`); }
    else { head = ["Employee", "Department", "Basis", "Absent days this month", "Last present"];
      rows = list.filter((p) => p.status === "absent").sort((a, b) => b.abs_mtd - a.abs_mtd).map((p) => `<tr><td>${empCell(p)}</td><td>${esc(p.department)}</td><td>${tag(p.source === "Attendance" ? "b" : "a", p.source === "Attendance" ? "Marked absent" : "No check-in")}</td><td>${tag(p.abs_mtd >= 3 ? "r" : p.abs_mtd === 2 ? "a" : "x", p.abs_mtd + " d")}</td><td class="n">${p.last_present ? fmtD(p.last_present) : "Never"}</td></tr>`); }
    const panel = card("Employees", `${DEPT ? "Filtered to " + esc(DEPT) + ". Click the department again to clear" : "All departments"}${PANEL === "repeated" ? ". Counted from submitted Attendance for earlier days and Employee Checkin for today" : ""}`,
      `<div class="ppgh-chips" style="margin-bottom:12px">${tabs.map((t) => `<span class="ppgh-chip ${PANEL === t[0] ? "on" : ""}" ${act("tab", t[0])}>${t[1]} (${t[2]})</span>`).join("")}</div>${table(head, rows.slice(0, 80))}`);

    const leave = card("Leave approvals waiting", "Leave Applications still in Open status", table(["Application", "Employee", "Type", "Dates", "Waiting"],
      d.leave_wait.map((l) => `<tr><td><a href="/app/leave-application/${encodeURIComponent(l.name)}">${esc(l.name)}</a></td><td>${esc(l.employee)}</td><td>${esc(l.type)}</td><td>${fmtD(l.from)} to ${fmtD(l.to)}</td><td class="n">${tag(l.waiting > 3 ? "r" : "x", l.waiting + " d")}</td></tr>`)));

    const f30 = (fld) => ({ [fld]: ["Between", [today, frappe.datetime.add_days(today, 30)]], status: "Active" });
    const mvRows = [["Joined this month", mv.joined, "g", listAct("Employee", { date_of_joining: ["Between", [d.month_start, today]] })],
      ["Left this month", mv.left, "a", listAct("Employee", { relieving_date: ["Between", [d.month_start, today]] })],
      ["Probation ending in 30 days", mv.probation, "b", listAct("Employee", f30("final_confirmation_date"))],
      ["Contracts ending in 30 days", mv.contract, "b", listAct("Employee", f30("contract_end_date"))],
      ["Open job positions", mv.openings, "x", listAct("Job Opening", { status: "Open" })]].filter((x) => x[1] > 0)
      .map((x) => `<div class="ppgh-row ppgh-click" ${x[3]}><span>${x[0]}</span>${tag(x[2], x[1])}</div>`).join("") || `<div class="ppgh-row"><span>No movement this month</span>${tag("x", 0)}</div>`;
    const people = card("People movement", "This month, plus what is coming up", mvRows);

    const pr = d.payroll, pmx = pr ? Math.max(pr.submitted, pr.draft, 1) : 1;
    const payroll = pr ? card(esc(pr.month) + " payroll", "Salary Slips for the last closed month. Click a bar to open the slips",
      `<div class="ppgh-bar ppgh-click" ${listAct("Salary Slip", { docstatus: 1 })}><span>Submitted</span><i style="width:${pr.submitted / pmx * 100}%;background:#1c9f74"></i><em>${pr.submitted}</em></div>
       ${pr.draft ? `<div class="ppgh-bar ppgh-click" ${listAct("Salary Slip", { docstatus: 0 })}><span>Draft</span><i style="width:${pr.draft / pmx * 100}%;background:#b9761a"></i><em>${pr.draft}</em></div>` : ""}
       <p style="margin:12px 0 0">Net pay submitted <b>${inr(pr.net)}</b>${pr.draft ? ". Draft slips need review before they can be paid." : "."}</p>`) : "";
    const m = d.money, mAmt = m.claims_amount + m.advances_amount;
    const money = (m.claims || m.advances) ? `<div class="ppgh-amber ppgh-click" ${listAct("Expense Claim", { docstatus: 0 })}>Money waiting for HR approval<b>${inr(mAmt)}</b>${m.claims} Expense Claim${m.claims === 1 ? "" : "s"} and ${m.advances} Employee Advance${m.advances === 1 ? "" : "s"} not yet approved</div>` : "";
    const slipsDraft = pr ? pr.draft : 0, lateWait = d.leave_wait.filter((l) => l.waiting > 3).length;
    const attn = [["Employees absent" + (rel === 0 ? " today" : ""), (d.holiday && !s.present) ? 0 : s.absent, "r", act("tab", "absent")],
      ["Absent 3 or more days this month", s.repeated, "r", act("tab", "repeated")],
      ["Leave approvals waiting over 3 days", lateWait, "r", listAct("Leave Application", { status: "Open" })],
      ["Salary slips still in draft", slipsDraft, "a", listAct("Salary Slip", { docstatus: 0 })],
      ["Probation ending in 30 days", mv.probation, "a", listAct("Employee", f30("final_confirmation_date"))]].filter((x) => x[1] > 0)
      .map((x) => `<div class="ppgh-row ppgh-click" ${x[3]}><span>${x[0]}</span>${tag(x[2], x[1])}</div>`).join("") || `<div class="ppgh-row"><span>All clear, nothing needs action</span>${tag("g", "OK")}</div>`;

    return `<style>${CSS}</style><div class="ppgh ppgh-root">
    <div class="ppgh-c"><div class="ppgh-chips"><b style="margin-right:6px">Attendance date</b>${chips}<input type="date" class="ppgh-date" value="${today}" max="${BASE}" data-act-change="date"></div><p style="margin:10px 0 0">${s.live ? "Today is live from Employee Checkin. Attendance is submitted after the day ends." : "Submitted Attendance for " + fmtD(today) + ": " + s.marked + " marked" + (s.unmarked ? ", " + s.unmarked + " not marked" : "")}${s.off ? ". " + s.off + " on holiday" : ""}</p></div>
    <div class="ppgh-alert ${tone}">${alert}</div>
    <div class="ppgh-k">${tiles}</div>
    <div class="ppgh-g2">
      ${card("Department-wise attendance", "Staff, present, absent and late. Today from Employee Checkin, earlier days from submitted Attendance. Click a department to filter the list below", table(["Department", "Staff", "Present", "Absent", "Late", "Attendance"], depRows))}
      ${card("Attendance trend", "Daily attendance %, last 12 working days. Click a bar to see that day", trend)}
    </div>
    ${panel}
    <div class="ppgh-g">${leave}${people}</div>
    <div class="ppgh-g">${payroll}<div style="display:flex;flex-direction:column;gap:16px">${money}${card("Needs attention", "Open items in HR", attn)}</div></div>
    </div>`;
  }

  function host() {
    let $h = $("#ppgh-host");
    if (!$h.length) {
      const $l = $('[data-sections*="HR"]').last();
      $h = $('<div id="ppgh-host" style="grid-column:1/-1;width:100%;display:none"></div>').appendTo($l.length ? $l.parent() : $(".layout-main-section").first());
    }
    return $h;
  }
  function apply() {
    const on = $(".md-tab.active").data("section") === "HR";
    host().toggle(on);
    $("[data-sections]").each(function () { const $e = $(this); $e.toggleClass("ppgh-hide", on && !$e.find(".ppgh-root").length); });
  }
  function show() { host().html(draw()); apply(); }
  function load(date) {
    return frappe.call({ method: "ppg_dashboard.api.hr_attendance.get_hr_dashboard", args: { as_of_date: date } }).then(function (r) {
      DATA = r.message;
      if (PANEL === "late" && DATA.summary.late === null) PANEL = "absent";
      if (PANEL === "repeated" && !DATA.summary.repeated) PANEL = "absent";
      show();
    }).catch(function (err) {
      console.error("HR dashboard error:", err);
      host().html('<div class="ppgh-empty">Could not load HR data. Check the browser console and the Error Log.</div>');
      apply();
    });
  }

  window.render_hr_attendance = function (data) {
    const base = (data && data.as_of_date) || frappe.datetime.get_today();
    if (base !== BASE) { BASE = base; VIEW = null; }
    return load(VIEW || BASE);
  };

  $(document).on("click", "#ppgh-host [data-act]", function (e) {
    if ($(e.target).closest("a").length) return;
    const $t = $(this), a = $t.attr("data-act"), v = $t.attr("data-v");
    if (a === "tab") { PANEL = v; if (DATA) show(); }
    else if (a === "dept") { DEPT = DEPT === v ? null : v; if (DATA) show(); }
    else if (a === "date") { VIEW = v; load(v); }
    else if (a === "list") { frappe.route_options = JSON.parse($t.attr("data-f")); frappe.set_route("List", $t.attr("data-dt")); }
  });
  $(document).on("change", "#ppgh-host [data-act-change='date']", function () { if (this.value) { VIEW = this.value; load(this.value); } });
  let timer = null;
  const later = function () { clearTimeout(timer); timer = setTimeout(apply, 80); };
  $(document).on("click", ".md-tab", later);
  new MutationObserver(later).observe(document.body, { childList: true, subtree: true });
})();
