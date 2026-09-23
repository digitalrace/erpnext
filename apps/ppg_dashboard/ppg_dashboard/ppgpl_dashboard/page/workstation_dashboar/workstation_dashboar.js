frappe.pages['workstation-dashboar'].on_page_load = function(wrapper) {
    let page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Workstation Dashboard',
        single_column: true
    });

    const stations = [
        {id: 'WS1', name: 'Production Planning'},
        {id: 'WS2', name: 'Stores & Kitting'},
        {id: 'WS3', name: 'CNC Cutting'},
        {id: 'WS4', name: 'Bending & Forming'},
        {id: 'WS5', name: 'Welding & Grinding'},
        {id: 'WS6', name: '9-Tank Pre-Treatment'},
        {id: 'WS7', name: 'Powder Coating Booth'},
        {id: 'WS8', name: 'Curing Oven'},
        {id: 'WS9', name: 'Assembly Bay'},
        {id: 'WS10', name: 'Component Installation'},
        {id: 'WS11', name: 'Wiring Station'},
        {id: 'WS12', name: 'Pre-Routine QA'},
        {id: 'WS13', name: 'Test Bay'},
        {id: 'WS14', name: 'Final Finish & Staging'}
    ];

    let stationButtonsHtml = stations.map(s => `
        <div class="station-btn" data-ws="${s.id}" style="flex:1; min-width:0; text-align:center; padding:8px 4px; border:1px solid #ddd; border-radius:6px; cursor:pointer; background:white;">
            <div style="font-weight:700; font-size:12px;">${s.id}</div>
            <div style="font-size:9px; color:#666; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${s.name}</div>
            <span class="ws-badge" data-ws-badge="${s.id}" style="display:none; margin-top:4px; color:white; font-size:10px; font-weight:700; padding:1px 8px; border-radius:10px;"></span>
        </div>
    `).join('');

    $(page.body).html(`
        <div style="font-family:-apple-system,sans-serif;">
            <div style="background:#1e3a5f; color:white; padding:16px 24px; margin:-15px -15px 0 -15px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-size:20px; font-weight:700;">PPG WORKSTATION DASHBOARD</div>
                    <div style="font-size:12px; opacity:0.8;">Power Partner Global · Production Floor</div>
                </div>
                <div style="text-align:right; font-size:12px; opacity:0.9;" id="ws-date-shift"></div>
            </div>
            <div id="station-selector" style="display:flex; gap:6px; padding:16px 24px; background:#f7f7f7; margin:0 -15px; overflow-x:auto;">
                ${stationButtonsHtml}
            </div>
            <div id="station-detail" style="padding:20px;"></div>
        </div>
    `);

    $('#ws-date-shift').text(frappe.datetime.str_to_user(frappe.datetime.now_datetime()));

    $(page.body).find('.station-btn').on('click', function() {
        $(page.body).find('.station-btn').css({background:'white', color:'#222'});
        $(this).css({background:'#1e3a5f', color:'white'});
        let ws = $(this).data('ws');
        load_station_detail(ws, stations.find(s => s.id === ws).name);
    });

    $(document).on('click', function(e) {
        if (!$(e.target).closest('.card-menu-wrap').length) {
            $('.card-menu-dropdown').hide();
        }
    });

    load_pending_counts(stations);
    $(page.body).find('.station-btn').first().trigger('click');
};

function load_pending_counts(stations) {
    frappe.call({
        method: "ppg_dashboard.api.production_api.get_active_job_counts_by_station",
        callback: function(r) {
            if (!r.message) return;
            let counts = r.message.counts || {};
            let overdue = r.message.overdue || {};

            stations.forEach(s => {
                let total = counts[s.id] || 0;
                let over = overdue[s.id] || 0;
                let badge = $(`.ws-badge[data-ws-badge="${s.id}"]`);
                if (total > 0) {
                    badge.css('background', over > 0 ? '#c0392b' : '#555');
                    badge.text(total).show();
                } 
            });
        }
    });
}

function render_kpi_period_card(id, title, target_text) {
    return `
        <div id="${id}" style="position:relative; border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; min-width:230px; flex:1; max-width:280px;">
            <div class="card-menu-wrap" style="position:absolute; top:8px; right:8px;">
                <span class="card-menu-dots" style="cursor:pointer; font-size:16px; color:#999; padding:2px 6px;">⋮</span>
                <div class="card-menu-dropdown" style="display:none; position:absolute; right:0; top:20px; background:white; border:1px solid #ddd; border-radius:6px; box-shadow:0 2px 8px rgba(0,0,0,0.1); z-index:10; min-width:140px;">
                    <div class="period-option" data-period="This Week" style="padding:8px 12px; cursor:pointer; font-size:12px;">This Week</div>
                    <div class="period-option" data-period="Last Week" style="padding:8px 12px; cursor:pointer; font-size:12px;">Last Week</div>
                    <div class="period-option" data-period="This Month" style="padding:8px 12px; cursor:pointer; font-size:12px; background:#f5f5f5;">This Month</div>
                    <div class="period-option" data-period="Last Month" style="padding:8px 12px; cursor:pointer; font-size:12px;">Last Month</div>
                    <div class="period-option" data-period="This Quarter" style="padding:8px 12px; cursor:pointer; font-size:12px;">This Quarter</div>
                    <div class="period-option" data-period="Last Quarter" style="padding:8px 12px; cursor:pointer; font-size:12px;">Last Quarter</div>
                    <div class="period-option" data-period="This Year" style="padding:8px 12px; cursor:pointer; font-size:12px;">This Year</div>
                    <div class="period-option" data-period="Last Year" style="padding:8px 12px; cursor:pointer; font-size:12px;">Last Year</div>
                </div>
            </div>
            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">${title}</div>
            <div class="value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
            <div style="margin-top:6px; display:flex; align-items:center; gap:8px;">
                <span class="badge" style="font-size:11px; font-weight:600; padding:2px 8px; border-radius:10px;"></span>
                <span style="font-size:12px; color:#999;">${target_text}</span>
            </div>
        </div>
    `;
}

function render_snapshot_card(id, title) {
    return `
        <div id="${id}" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; min-width:200px; flex:1; max-width:260px;">
            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">${title}</div>
            <div class="value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
            <div class="subtitle" style="margin-top:6px; font-size:12px; color:#999;"></div>
        </div>
    `;
}

function load_snapshot_card(card_id, workstation, api_method, render_fn) {
    frappe.call({
        method: api_method,
        args: { workstation: workstation },
        callback: function(r) {
            if (!r.message) return;
            render_fn($('#' + card_id), r.message);
        }
    });
}

function wire_kpi_card(card_id, workstation, api_method) {
    let card = $('#' + card_id);

    card.find('.card-menu-dots').on('click', function(e) {
        e.stopPropagation();
        $('.card-menu-dropdown').not(card.find('.card-menu-dropdown')).hide();
        card.find('.card-menu-dropdown').toggle();
    });

    card.find('.period-option').on('click', function(e) {
        e.stopPropagation();
        let period = $(this).data('period');
        card.find('.period-option').css('background', 'none');
        $(this).css('background', '#f5f5f5');
        card.find('.card-menu-dropdown').hide();
        load_kpi_generic(card_id, workstation, period, api_method);
    });

    load_kpi_generic(card_id, workstation, 'This Month', api_method);
}

function load_kpi_generic(card_id, workstation, period, api_method) {
    $('#' + card_id + ' .value').text('Loading...');

    frappe.call({
        method: api_method,
        args: { workstation: workstation, period: period },
        callback: function(r) {
            let data = r.message;
            if (!data) return;

            let card = $('#' + card_id);
            card.find('.value').text(data.value + '%');
            let badge = card.find('.badge');

            if (data.on_target) {
                badge.text('On target').css({background:'#e6f4ea', color:'#1e7e34'});
                card.find('.value').css('color', '#1e7e34');
            } else if (data.value >= data.target - 5) {
                badge.text('Watch').css({background:'#fff3cd', color:'#8a6d00'});
                card.find('.value').css('color', '#8a6d00');
            } else {
                badge.text('Below target').css({background:'#fce8e6', color:'#c0392b'});
                card.find('.value').css('color', '#c0392b');
            }
        }
    });
}

function load_weekly_card(card_id, workstation, api_method) {
    frappe.call({
        method: api_method,
        args: { workstation: workstation },
        callback: function(r) {
            if (!r.message) return;
            let weeks = r.message;
            let card = $('#' + card_id);
            let latest = weeks[weeks.length - 1];
            card.find('.big-value').text(latest.value + '%');

            let barsHtml = weeks.map(w => {
                let h = Math.max(w.value, 4);
                let color = w.value >= 95 ? '#1e7e34' : (w.value >= 80 ? '#8a6d00' : '#c0392b');
                return `<div style="flex:1; background:#dde6f0; border-radius:3px; height:100%; display:flex; align-items:flex-end;">
                    <div style="width:100%; height:${h}%; background:${color}; border-radius:3px;"></div>
                </div>`;
            }).join('');
            card.find('.bars').html(barsHtml);

            let labelsHtml = weeks.map(w => `<div style="flex:1; text-align:center; font-size:10px; color:#999;">${w.label}</div>`).join('');
            card.find('.bar-labels').html(labelsHtml);
        }
    });
}

function load_tat_mtd_card(card_id, workstation, api_method) {
    frappe.call({
        method: api_method,
        args: { workstation: workstation },
        callback: function(r) {
            if (!r.message) return;
            let d = r.message;
            let color = d.pct >= 95 ? '#1e7e34' : (d.pct >= 80 ? '#8a6d00' : '#c0392b');
            $('#' + card_id).html(`
                <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:10px;">TAT Achievement — MTD</div>
                <div style="display:flex; align-items:center; gap:16px;">
                    <div style="width:70px; height:70px; border-radius:50%; border:6px solid ${color}; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:15px; color:${color};">
                        ${d.pct}%
                    </div>
                    <div style="font-size:12px; color:#555;">
                        <div>Adherence vs ≥95% target</div>
                        <div>Avg TAT ${d.avg_tat} d vs target ${d.tat_target_days} d</div>
                        <div>Last ${d.last5_total} sign-outs: ${d.last5_within} within · ${d.last5_exceeded} exceeded</div>
                    </div>
                </div>
            `);
        }
    });
}

function load_tat_7day_card(workstation) {
    frappe.call({
        method: 'ppg_dashboard.api.kpi.get_ws1_tat_adherence_7days',
        args: { workstation: workstation },
        callback: function(r) {
            if (!r.message) return;
            let days = r.message;
            let rowsHtml = days.map(d => {
                let color = d.value >= 95 ? '#1e7e34' : (d.value >= 80 ? '#8a6d00' : '#c0392b');
                return `
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                        <div style="width:32px; font-size:11px; color:#888;">${d.label}</div>
                        <div style="flex:1; background:#eee; border-radius:3px; height:8px; overflow:hidden;">
                            <div style="width:${d.value}%; height:100%; background:${color};"></div>
                        </div>
                        <div style="width:36px; font-size:11px; color:#888; text-align:right;">${d.value}%</div>
                    </div>
                `;
            }).join('');
            $('#tat-7day-rows').html(rowsHtml);
        }
    });
}

function load_completed_7day_card(workstation) {
    frappe.call({
        method: 'ppg_dashboard.api.kpi.get_ws1_completed_7days',
        args: { workstation: workstation },
        callback: function(r) {
            if (!r.message) return;
            let days = r.message;
            let maxCount = Math.max(...days.map(d => d.count), 1);

            let barsHtml = days.map(d => {
                let h = Math.max((d.count / maxCount) * 100, d.count > 0 ? 10 : 2);
                let color = d.is_today ? '#c0554a' : '#1e3a5f';
                return `
                    <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; height:100%;">
                        <div style="font-size:11px; font-weight:700; margin-bottom:2px;">${d.count}</div>
                        <div style="width:70%; height:${h}%; background:${color}; border-radius:3px 3px 0 0;"></div>
                    </div>
                `;
            }).join('');

            let labelsHtml = days.map(d => `<div style="flex:1; text-align:center; font-size:10px; color:#999;">${d.label}</div>`).join('');

            $('#completed-7day-bars').html(barsHtml);
            $('#completed-7day-labels').html(labelsHtml);
        }
    });
}

function load_jobs_table(workstation, tab) {
    $('#jobs-table-body').html('<tr><td style="padding:12px 4px; color:#999;">Loading...</td></tr>');

    frappe.call({
        method: 'ppg_dashboard.api.kpi.get_ws1_jobs',
        args: { workstation: workstation, tab: tab },
        callback: function(r) {
            let jobs = r.message || [];
	    console.log('[PPG ACTIVE FILE] Jobs response:', {
		    workstation: workstation,
		    tab: tab,
		    count: jobs.length,
		    jobs: jobs
	    });
            let headHtml = '';
            let colCount = 5;

            if (tab === 'Pending') {
                colCount = 5;
                headHtml = `
                    <tr style="text-align:left; color:#888; font-size:11px; border-bottom:1px solid #eee;">
                        <th style="padding:6px 4px;">PANEL / CUSTOMER</th>
                        <th style="padding:6px 4px;">TYPE</th>
                        <th style="padding:6px 4px;">ARRIVED</th>
                        <th style="padding:6px 4px;">TAT USE</th>
                        <th style="padding:6px 4px;">STATUS</th>
                    </tr>`;
            } else if (tab === 'Upcoming') {
                colCount = 5;
                headHtml = `
                    <tr style="text-align:left; color:#888; font-size:11px; border-bottom:1px solid #eee;">
                        <th style="padding:6px 4px;">PANEL / CUSTOMER</th>
                        <th style="padding:6px 4px;">TYPE</th>
                        <th style="padding:6px 4px;">CURRENTLY AT</th>
                        <th style="padding:6px 4px;">PLANNED ARRIVAL</th>
                        <th style="padding:6px 4px;">NOTE</th>
                    </tr>`;
            } else if (tab === 'Completed') {
                colCount = 6;
                headHtml = `
                    <tr style="text-align:left; color:#888; font-size:11px; border-bottom:1px solid #eee;">
                        <th style="padding:6px 4px;">PANEL</th>
                        <th style="padding:6px 4px;">TYPE</th>
                        <th style="padding:6px 4px;">SIGNED OUT</th>
                        <th style="padding:6px 4px;">ACTUAL VS TARGET TAT</th>
                        <th style="padding:6px 4px;">RESULT</th>
                        <th style="padding:6px 4px;">FIRST-PASS QC</th>
                    </tr>`;
            }

            $('#jobs-table').find('thead').remove();
            $('#jobs-table').prepend('<thead>' + headHtml + '</thead>');

            if (!jobs.length) {
                $('#jobs-table-body').html('<tr><td colspan="' + colCount + '" style="padding:12px 4px; color:#999;">No jobs in this category.</td></tr>');
                return;
            }

            let rowsHtml = '';

            if (tab === 'Pending') {
                rowsHtml = jobs.map(j => {
                    let pct = j.target_days > 0 ? Math.min((j.days_at_station / j.target_days) * 100, 100) : 0;
                    let barColor = pct >= 100 ? '#c0392b' : (pct >= 70 ? '#8a6d00' : '#1e7e34');
                   let statusColor =
				j.status === 'On Hold'
				? '#c0392b'
				: j.status === 'Completed'
				? '#1e7e34'
				: j.status === 'Work In Progress'
				? '#8a6d00'
				: '#555';
                    return `
                        <tr style="border-bottom:1px solid #f2f2f2;">
                            <td style="padding:8px 4px;">
                                <div style="color:#1e3a5f; font-weight:600;">${j.panel}</div>
                                <div style="font-size:11px; color:${j.customer === 'Not Linked' ? '#aaa' : '#888'};">${j.customer}</div>
                            </td>
                            <td style="padding:8px 4px;">${j.type}</td>
                            <td style="padding:8px 4px;">${j.arrived}</td>
                            <td style="padding:8px 4px; min-width:120px;">
                                <div style="background:#eee; border-radius:3px; height:6px; overflow:hidden;">
                                    <div style="width:${pct}%; height:100%; background:${barColor};"></div>
                                </div>
                                <div style="font-size:10px; color:#999; margin-top:2px;">${j.days_at_station} / ${j.target_days} d</div>
                            </td>
                            <td style="padding:8px 4px; color:${statusColor}; font-weight:600;">${j.status}</td>
                        </tr>`;
                }).join('');
            } else if (tab === 'Upcoming') {
                rowsHtml = jobs.map(j => `
                    <tr style="border-bottom:1px solid #f2f2f2;">
                        <td style="padding:8px 4px;">
                            <div style="color:#1e3a5f; font-weight:600;">${j.panel}</div>
                            <div style="font-size:11px; color:${j.customer === 'Not Linked' ? '#aaa' : '#888'};">${j.customer}</div>
                        </td>
                        <td style="padding:8px 4px;">${j.type}</td>
                        <td style="padding:8px 4px;"><span style="background:#eef1f6; padding:2px 8px; border-radius:4px; font-size:11px;">${j.currently_at}</span></td>
                        <td style="padding:8px 4px;">${j.days_to_start !== null ? '~' + j.days_to_start + ' d · ' : ''}${j.planned_arrival}</td>
                        <td style="padding:8px 4px; color:#888; font-size:12px;">${j.note}</td>
                    </tr>`).join('');
            } else if (tab === 'Completed') {
                rowsHtml = jobs.map(j => {
                    let resultColor = j.result === 'WITHIN TAT' ? '#1e7e34' : (j.result === 'EXCEEDED' ? '#c0392b' : '#888');
                    let qcColor = j.first_pass_qc === 'YES' ? '#1e7e34' : '#c0392b';
                    return `
                        <tr style="border-bottom:1px solid #f2f2f2;">
                            <td style="padding:8px 4px; color:#1e3a5f; font-weight:600;">${j.panel}</td>
                            <td style="padding:8px 4px;">${j.type}</td>
                            <td style="padding:8px 4px;">${j.signed_out}</td>
                            <td style="padding:8px 4px;">${j.days_at_station} / ${j.target_days} d</td>
                            <td style="padding:8px 4px;"><span style="background:${j.result === 'WITHIN TAT' ? '#e6f4ea' : '#fce8e6'}; color:${resultColor}; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600;">${j.result}</span></td>
                            <td style="padding:8px 4px; color:${qcColor}; font-weight:600;">${j.first_pass_qc}</td>
                        </tr>`;
                }).join('');
            }

            $('#jobs-table-body').html(rowsHtml);
        }
    });
}

function load_station_detail(ws_code, ws_name) {
    $('#station-detail').html(`<div style="color:#999;">Loading...</div>`);

    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Workstation Config",
            filters: [["custom_workstation", "like", ws_code + "%"]],
            fields: [
                "custom_workstation",
                "custom_stage_code",
                "custom_tat_range",
                "custom_owner_role",
                "custom_procedure_reference",
                "custom_qc_hold_point_text"
            ],
            limit_page_length: 1
        },
        callback: function(r) {
            let cfg = (r.message && r.message.length) ? r.message[0] : null;

            if (!cfg) {
                $('#station-detail').html(`<h4>${ws_code} — ${ws_name}</h4><div style="color:#c0392b;">No config found. Please add a Workstation Config record for this station.</div>`);
                return;
            }

            let kpiCardsHtml = '';
            if (ws_code === 'WS1') {
                kpiCardsHtml = `
                    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:16px;">
                        ${render_kpi_period_card('kpi1-card', 'On-time Drawing Release', 'target ≥98%')}
                        ${render_kpi_period_card('kpi2-card', 'Slot Adherence', 'target ≥95%')}
                        ${render_kpi_period_card('kpi3-card', 'TAT Adherence', 'target ≥95%')}
                        ${render_snapshot_card('kpi4-card', 'At Station Now')}
                        ${render_snapshot_card('kpi5-card', 'Completed Today')}
                    </div>
                    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:16px;">
                        <div id="kpi1-weekly-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; flex:1; min-width:280px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">KPI 1 · On-time Drawing Release — MTD</div>
                            <div class="big-value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
                            <div class="bars" style="display:flex; gap:8px; margin-top:10px; height:50px; align-items:flex-end;"></div>
                            <div class="bar-labels" style="display:flex; gap:8px; margin-top:4px;"></div>
                        </div>
                        <div id="kpi2-weekly-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; flex:1; min-width:280px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">KPI 2 · Slot Adherence — MTD</div>
                            <div class="big-value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
                            <div class="bars" style="display:flex; gap:8px; margin-top:10px; height:50px; align-items:flex-end;"></div>
                            <div class="bar-labels" style="display:flex; gap:8px; margin-top:4px;"></div>
                        </div>
                        <div id="tat-mtd-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; min-width:260px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:10px;">TAT Achievement — MTD</div>
                            <div style="color:#999; font-size:12px;">Loading...</div>
                        </div>
                    </div>
                `;
            } else if (ws_code === 'WS2') {
                kpiCardsHtml = `
                    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:16px;">
                        ${render_kpi_period_card('ws2-kpi1-card', 'Kit Completeness First-Time', 'target ≥98%')}
                        ${render_kpi_period_card('ws2-kpi2-card', 'Inbound MAR', 'target ≥98%')}
                        ${render_kpi_period_card('ws2-kpi3-card', 'TAT Adherence', 'target ≥95%')}
                        ${render_snapshot_card('ws2-kpi4-card', 'At Station Now')}
                        ${render_snapshot_card('ws2-kpi5-card', 'Completed Today')}
                    </div>
                    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:16px;">
                        <div id="ws2-kpi1-weekly-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; flex:1; min-width:280px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">KPI 1 · Kit Completeness First-Time — MTD</div>
                            <div class="big-value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
                            <div class="bars" style="display:flex; gap:8px; margin-top:10px; height:50px; align-items:flex-end;"></div>
                            <div class="bar-labels" style="display:flex; gap:8px; margin-top:4px;"></div>
                        </div>
                        <div id="ws2-kpi2-weekly-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; flex:1; min-width:280px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">KPI 2 · Inbound MAR — MTD</div>
                            <div class="big-value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
                            <div class="bars" style="display:flex; gap:8px; margin-top:10px; height:50px; align-items:flex-end;"></div>
                            <div class="bar-labels" style="display:flex; gap:8px; margin-top:4px;"></div>
                        </div>
                        <div id="ws2-tat-mtd-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; min-width:260px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:10px;">TAT Achievement — MTD</div>
                            <div style="color:#999; font-size:12px;">Loading...</div>
                        </div>
                    </div>
                `;
            } else if (ws_code === 'WS3') {
                kpiCardsHtml = `
                    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:16px;">
                        ${render_kpi_period_card('ws3-kpi1-card', 'First-Piece Dimensional Pass', 'target 100%')}
                        ${render_kpi_period_card('ws3-kpi2-card', 'Cutting Scrap', 'target ≤ 1.5%')}
                        ${render_kpi_period_card('ws3-kpi3-card', 'TAT Adherence', 'target ≥95%')}
                        ${render_snapshot_card('ws3-kpi4-card', 'At Station Now')}
                        ${render_snapshot_card('ws3-kpi5-card', 'Completed Today')}
                    </div>
                    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:16px;">
                        <div id="ws3-kpi1-weekly-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; flex:1; min-width:280px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">KPI 1 · First-Piece Dimensional Pass — MTD</div>
                            <div class="big-value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
                            <div class="bars" style="display:flex; gap:8px; margin-top:10px; height:50px; align-items:flex-end;"></div>
                            <div class="bar-labels" style="display:flex; gap:8px; margin-top:4px;"></div>
                        </div>
                        <div id="ws3-kpi2-weekly-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; flex:1; min-width:280px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">KPI 2 · Cutting Scrap — MTD</div>
                            <div class="big-value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
                            <div class="bars" style="display:flex; gap:8px; margin-top:10px; height:50px; align-items:flex-end;"></div>
                            <div class="bar-labels" style="display:flex; gap:8px; margin-top:4px;"></div>
                        </div>
                        <div id="ws3-tat-mtd-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; min-width:260px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:10px;">TAT Achievement — MTD</div>
                            <div style="color:#999; font-size:12px;">Loading...</div>
                        </div>
                    </div>
                `;
            } else if (ws_code === 'WS4') {
                kpiCardsHtml = `
                    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:16px;">
                        ${render_kpi_period_card('ws4-kpi1-card', 'Bend First-Pass', 'target ≥98%')}
                        ${render_kpi_period_card('ws4-kpi2-card', 'Spot-Weld Coupon Pass', 'target 100%')}
                        ${render_kpi_period_card('ws4-kpi3-card', 'TAT Adherence', 'target ≥95%')}
                        ${render_snapshot_card('ws4-kpi4-card', 'At Station Now')}
                        ${render_snapshot_card('ws4-kpi5-card', 'Completed Today')}
                    </div>
                    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:16px;">
                        <div id="ws4-kpi1-weekly-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; flex:1; min-width:280px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">KPI 1 · Bend First-Pass — MTD</div>
                            <div class="big-value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
                            <div class="bars" style="display:flex; gap:8px; margin-top:10px; height:50px; align-items:flex-end;"></div>
                            <div class="bar-labels" style="display:flex; gap:8px; margin-top:4px;"></div>
                        </div>
                        <div id="ws4-kpi2-weekly-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; flex:1; min-width:280px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">KPI 2 · Spot-Weld Coupon Pass — MTD</div>
                            <div class="big-value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
                            <div class="bars" style="display:flex; gap:8px; margin-top:10px; height:50px; align-items:flex-end;"></div>
                            <div class="bar-labels" style="display:flex; gap:8px; margin-top:4px;"></div>
                        </div>
                        <div id="ws4-tat-mtd-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; min-width:260px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:10px;">TAT Achievement — MTD</div>
                            <div style="color:#999; font-size:12px;">Loading...</div>
                        </div>
                    </div>
                `;
            } else if (ws_code === 'WS5') {
                kpiCardsHtml = `
                    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:16px;">
                        ${render_kpi_period_card('ws5-kpi1-card', 'M3 Hold-Point First-Pass', 'target ≥97%')}
                        ${render_kpi_period_card('ws5-kpi2-card', 'Weld Rework', 'target ≤3%')}
                        ${render_kpi_period_card('ws5-kpi3-card', 'TAT Adherence', 'target ≥95%')}
                        ${render_snapshot_card('ws5-kpi4-card', 'At Station Now')}
                        ${render_snapshot_card('ws5-kpi5-card', 'Completed Today')}
                    </div>
                    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:16px;">
                        <div id="ws5-kpi1-weekly-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; flex:1; min-width:280px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">KPI 1 · M3 Hold-Point First-Pass — MTD</div>
                            <div class="big-value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
                            <div class="bars" style="display:flex; gap:8px; margin-top:10px; height:50px; align-items:flex-end;"></div>
                            <div class="bar-labels" style="display:flex; gap:8px; margin-top:4px;"></div>
                        </div>
                        <div id="ws5-kpi2-weekly-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; flex:1; min-width:280px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">KPI 2 · Weld Rework — MTD</div>
                            <div class="big-value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
                            <div class="bars" style="display:flex; gap:8px; margin-top:10px; height:50px; align-items:flex-end;"></div>
                            <div class="bar-labels" style="display:flex; gap:8px; margin-top:4px;"></div>
                        </div>
                        <div id="ws5-tat-mtd-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; min-width:260px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:10px;">TAT Achievement — MTD</div>
                            <div style="color:#999; font-size:12px;">Loading...</div>
                        </div>
                    </div>
                `;
            } else if (ws_code === 'WS6') {
                kpiCardsHtml = `
                    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:16px;">
                        ${render_kpi_period_card('ws6-kpi1-card', 'Tank Parameter Compliance', 'target 100%')}
                        ${render_kpi_period_card('ws6-kpi2-card', 'Phosphate Coat Weight in Spec', 'target 100%')}
                        ${render_kpi_period_card('ws6-kpi3-card', 'TAT Adherence', 'target ≥95%')}
                        ${render_snapshot_card('ws6-kpi4-card', 'At Station Now')}
                        ${render_snapshot_card('ws6-kpi5-card', 'Completed Today')}
                    </div>
                    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:16px;">
                        <div id="ws6-kpi1-weekly-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; flex:1; min-width:280px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">KPI 1 · Tank Parameter Compliance — MTD</div>
                            <div class="big-value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
                            <div class="bars" style="display:flex; gap:8px; margin-top:10px; height:50px; align-items:flex-end;"></div>
                            <div class="bar-labels" style="display:flex; gap:8px; margin-top:4px;"></div>
                        </div>
                        <div id="ws6-kpi2-weekly-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; flex:1; min-width:280px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">KPI 2 · Phosphate Coat Weight in Spec — MTD</div>
                            <div class="big-value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
                            <div class="bars" style="display:flex; gap:8px; margin-top:10px; height:50px; align-items:flex-end;"></div>
                            <div class="bar-labels" style="display:flex; gap:8px; margin-top:4px;"></div>
                        </div>
                        <div id="ws6-tat-mtd-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; min-width:260px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:10px;">TAT Achievement — MTD</div>
                            <div style="color:#999; font-size:12px;">Loading...</div>
                        </div>
                    </div>
                `;
            } else if (ws_code === 'WS7') {
                kpiCardsHtml = `
                    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:16px;">
                        ${render_kpi_period_card('ws7-kpi1-card', 'Coverage First-Pass', 'target ≥98%')}
                        ${render_kpi_period_card('ws7-kpi2-card', 'Shade Verification', 'target 100%')}
                        ${render_kpi_period_card('ws7-kpi3-card', 'TAT Adherence', 'target ≥95%')}
                        ${render_snapshot_card('ws7-kpi4-card', 'At Station Now')}
                        ${render_snapshot_card('ws7-kpi5-card', 'Completed Today')}
                    </div>
                    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:16px;">
                        <div id="ws7-kpi1-weekly-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; flex:1; min-width:280px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">KPI 1 · Coverage First-Pass — MTD</div>
                            <div class="big-value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
                            <div class="bars" style="display:flex; gap:8px; margin-top:10px; height:50px; align-items:flex-end;"></div>
                            <div class="bar-labels" style="display:flex; gap:8px; margin-top:4px;"></div>
                        </div>
                        <div id="ws7-kpi2-weekly-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; flex:1; min-width:280px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">KPI 2 · Shade Verification — MTD</div>
                            <div class="big-value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
                            <div class="bars" style="display:flex; gap:8px; margin-top:10px; height:50px; align-items:flex-end;"></div>
                            <div class="bar-labels" style="display:flex; gap:8px; margin-top:4px;"></div>
                        </div>
                        <div id="ws7-tat-mtd-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; min-width:260px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:10px;">TAT Achievement — MTD</div>
                            <div style="color:#999; font-size:12px;">Loading...</div>
                        </div>
                    </div>
                `;
            } else if (ws_code === 'WS8') {
                kpiCardsHtml = `
                    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:16px;">
                        ${render_kpi_period_card('ws8-kpi1-card', 'DFT Within 60–80 µm', 'target 100%')}
                        ${render_kpi_period_card('ws8-kpi2-card', 'Adhesion Pass (Per Shift)', 'target 100%')}
                        ${render_kpi_period_card('ws8-kpi3-card', 'TAT Adherence', 'target ≥95%')}
                        ${render_snapshot_card('ws8-kpi4-card', 'At Station Now')}
                        ${render_snapshot_card('ws8-kpi5-card', 'Completed Today')}
                    </div>
                    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:16px;">
                        <div id="ws8-kpi1-weekly-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; flex:1; min-width:280px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">KPI 1 · DFT Within 60–80 µm — MTD</div>
                            <div class="big-value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
                            <div class="bars" style="display:flex; gap:8px; margin-top:10px; height:50px; align-items:flex-end;"></div>
                            <div class="bar-labels" style="display:flex; gap:8px; margin-top:4px;"></div>
                        </div>
                        <div id="ws8-kpi2-weekly-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; flex:1; min-width:280px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">KPI 2 · Adhesion Pass (Per Shift) — MTD</div>
                            <div class="big-value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
                            <div class="bars" style="display:flex; gap:8px; margin-top:10px; height:50px; align-items:flex-end;"></div>
                            <div class="bar-labels" style="display:flex; gap:8px; margin-top:4px;"></div>
                        </div>
                        <div id="ws8-tat-mtd-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; min-width:260px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:10px;">TAT Achievement — MTD</div>
                            <div style="color:#999; font-size:12px;">Loading...</div>
                        </div>
                    </div>
                `;
            } else if (ws_code === 'WS9') {
                kpiCardsHtml = `
                    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:16px;">
                        ${render_kpi_period_card('ws9-kpi1-card', 'M5 Hold First-Pass (Form + Earth)', 'target ≥97%')}
                        ${render_kpi_period_card('ws9-kpi2-card', 'Earth < 0.1 Ω First-Time', 'target ≥98%')}
                        ${render_kpi_period_card('ws9-kpi3-card', 'TAT Adherence', 'target ≥95%')}
                        ${render_snapshot_card('ws9-kpi4-card', 'At Station Now')}
                        ${render_snapshot_card('ws9-kpi5-card', 'Completed Today')}
                    </div>
                    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:16px;">
                        <div id="ws9-kpi1-weekly-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; flex:1; min-width:280px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">KPI 1 · M5 Hold First-Pass — MTD</div>
                            <div class="big-value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
                            <div class="bars" style="display:flex; gap:8px; margin-top:10px; height:50px; align-items:flex-end;"></div>
                            <div class="bar-labels" style="display:flex; gap:8px; margin-top:4px;"></div>
                        </div>
                        <div id="ws9-kpi2-weekly-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; flex:1; min-width:280px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">KPI 2 · Earth < 0.1 Ω First-Time — MTD</div>
                            <div class="big-value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
                            <div class="bars" style="display:flex; gap:8px; margin-top:10px; height:50px; align-items:flex-end;"></div>
                            <div class="bar-labels" style="display:flex; gap:8px; margin-top:4px;"></div>
                        </div>
                        <div id="ws9-tat-mtd-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; min-width:260px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:10px;">TAT Achievement — MTD</div>
                            <div style="color:#999; font-size:12px;">Loading...</div>
                        </div>
                    </div>
                `;
            } else if (ws_code === 'WS10') {
                kpiCardsHtml = `
                    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:16px;">
                        ${render_kpi_period_card('ws10-kpi1-card', 'Torque Log Completeness', 'target 100%')}
                        ${render_kpi_period_card('ws10-kpi2-card', 'QA 10% Spot Re-Check Pass', 'target ≥99%')}
                        ${render_kpi_period_card('ws10-kpi3-card', 'TAT Adherence', 'target ≥95%')}
                        ${render_snapshot_card('ws10-kpi4-card', 'At Station Now')}
                        ${render_snapshot_card('ws10-kpi5-card', 'Completed Today')}
                    </div>
                    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:16px;">
                        <div id="ws10-kpi1-weekly-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; flex:1; min-width:280px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">KPI 1 · Torque Log Completeness — MTD</div>
                            <div class="big-value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
                            <div class="bars" style="display:flex; gap:8px; margin-top:10px; height:50px; align-items:flex-end;"></div>
                            <div class="bar-labels" style="display:flex; gap:8px; margin-top:4px;"></div>
                        </div>
                        <div id="ws10-kpi2-weekly-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; flex:1; min-width:280px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">KPI 2 · QA 10% Spot Re-Check Pass — MTD</div>
                            <div class="big-value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
                            <div class="bars" style="display:flex; gap:8px; margin-top:10px; height:50px; align-items:flex-end;"></div>
                            <div class="bar-labels" style="display:flex; gap:8px; margin-top:4px;"></div>
                        </div>
                        <div id="ws10-tat-mtd-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; min-width:260px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:10px;">TAT Achievement — MTD</div>
                            <div style="color:#999; font-size:12px;">Loading...</div>
                        </div>
                    </div>
                `;
            } else if (ws_code === 'WS11') {
                kpiCardsHtml = `
                    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:16px;">
                        ${render_kpi_period_card('ws11-kpi1-card', 'Wiring First-Pass at 100% Check', 'target ≥97%')}
                        ${render_kpi_period_card('ws11-kpi2-card', 'Ferrule & Label Completeness', 'target 100%')}
                        ${render_kpi_period_card('ws11-kpi3-card', 'TAT Adherence', 'target ≥95%')}
                        ${render_snapshot_card('ws11-kpi4-card', 'At Station Now')}
                        ${render_snapshot_card('ws11-kpi5-card', 'Completed Today')}
                    </div>
                    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:16px;">
                        <div id="ws11-kpi1-weekly-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; flex:1; min-width:280px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">KPI 1 · Wiring First-Pass — MTD</div>
                            <div class="big-value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
                            <div class="bars" style="display:flex; gap:8px; margin-top:10px; height:50px; align-items:flex-end;"></div>
                            <div class="bar-labels" style="display:flex; gap:8px; margin-top:4px;"></div>
                        </div>
                        <div id="ws11-kpi2-weekly-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; flex:1; min-width:280px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">KPI 2 · Ferrule & Label Completeness — MTD</div>
                            <div class="big-value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
                            <div class="bars" style="display:flex; gap:8px; margin-top:10px; height:50px; align-items:flex-end;"></div>
                            <div class="bar-labels" style="display:flex; gap:8px; margin-top:4px;"></div>
                        </div>
                        <div id="ws11-tat-mtd-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; min-width:260px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:10px;">TAT Achievement — MTD</div>
                            <div style="color:#999; font-size:12px;">Loading...</div>
                        </div>
                    </div>
                `;
            } else if (ws_code === 'WS12') {
                kpiCardsHtml = `
                    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:16px;">
                        ${render_kpi_period_card('ws12-kpi1-card', 'Inspection TAT Adherence', 'target ≥98%')}
                        ${render_kpi_period_card('ws12-kpi2-card', 'Defect Escape to Routine Test', 'target ≤1.0%')}
                        ${render_kpi_period_card('ws12-kpi3-card', 'TAT Adherence', 'target ≥95%')}
                        ${render_snapshot_card('ws12-kpi4-card', 'At Station Now')}
                        ${render_snapshot_card('ws12-kpi5-card', 'Completed Today')}
                    </div>
                    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:16px;">
                        <div id="ws12-kpi1-weekly-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; flex:1; min-width:280px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">KPI 1 · Inspection TAT Adherence — MTD</div>
                            <div class="big-value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
                            <div class="bars" style="display:flex; gap:8px; margin-top:10px; height:50px; align-items:flex-end;"></div>
                            <div class="bar-labels" style="display:flex; gap:8px; margin-top:4px;"></div>
                        </div>
                        <div id="ws12-kpi2-weekly-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; flex:1; min-width:280px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">KPI 2 · Defect Escape to Routine Test — MTD</div>
                            <div class="big-value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
                            <div class="bars" style="display:flex; gap:8px; margin-top:10px; height:50px; align-items:flex-end;"></div>
                            <div class="bar-labels" style="display:flex; gap:8px; margin-top:4px;"></div>
                        </div>
                        <div id="ws12-tat-mtd-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; min-width:260px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:10px;">TAT Achievement — MTD</div>
                            <div style="color:#999; font-size:12px;">Loading...</div>
                        </div>
                    </div>
                `;
            } else if (ws_code === 'WS13') {
                kpiCardsHtml = `
                    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:16px;">
                        ${render_kpi_period_card('ws13-kpi1-card', 'Routine Test FPY', 'target ≥98%')}
                        ${render_kpi_period_card('ws13-kpi2-card', 'Certificate Completeness', 'target 100%')}
                        ${render_kpi_period_card('ws13-kpi3-card', 'TAT Adherence', 'target ≥95%')}
                        ${render_snapshot_card('ws13-kpi4-card', 'At Station Now')}
                        ${render_snapshot_card('ws13-kpi5-card', 'Completed Today')}
                    </div>
                    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:16px;">
                        <div id="ws13-kpi1-weekly-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; flex:1; min-width:280px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">KPI 1 · Routine Test FPY — MTD</div>
                            <div class="big-value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
                            <div class="bars" style="display:flex; gap:8px; margin-top:10px; height:50px; align-items:flex-end;"></div>
                            <div class="bar-labels" style="display:flex; gap:8px; margin-top:4px;"></div>
                        </div>
                        <div id="ws13-kpi2-weekly-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; flex:1; min-width:280px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">KPI 2 · Certificate Completeness — MTD</div>
                            <div class="big-value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
                            <div class="bars" style="display:flex; gap:8px; margin-top:10px; height:50px; align-items:flex-end;"></div>
                            <div class="bar-labels" style="display:flex; gap:8px; margin-top:4px;"></div>
                        </div>
                        <div id="ws13-tat-mtd-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; min-width:260px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:10px;">TAT Achievement — MTD</div>
                            <div style="color:#999; font-size:12px;">Loading...</div>
                        </div>
                    </div>
                `;
            } else if (ws_code === 'WS14') {
                kpiCardsHtml = `
                    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:16px;">
                        ${render_kpi_period_card('ws14-kpi1-card', 'DOC Packet First-Time Complete', 'target 100%')}
                        ${render_kpi_period_card('ws14-kpi2-card', 'FAT First-Attempt (Downstream)', 'target ≥95%')}
                        ${render_kpi_period_card('ws14-kpi3-card', 'TAT Adherence', 'target ≥95%')}
                        ${render_snapshot_card('ws14-kpi4-card', 'At Station Now')}
                        ${render_snapshot_card('ws14-kpi5-card', 'Completed Today')}
                    </div>
                    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:16px;">
                        <div id="ws14-kpi1-weekly-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; flex:1; min-width:280px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">KPI 1 · DOC Packet First-Time Complete — MTD</div>
                            <div class="big-value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
                            <div class="bars" style="display:flex; gap:8px; margin-top:10px; height:50px; align-items:flex-end;"></div>
                            <div class="bar-labels" style="display:flex; gap:8px; margin-top:4px;"></div>
                        </div>
                        <div id="ws14-kpi2-weekly-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; flex:1; min-width:280px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">KPI 2 · FAT First-Attempt — MTD</div>
                            <div class="big-value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
                            <div class="bars" style="display:flex; gap:8px; margin-top:10px; height:50px; align-items:flex-end;"></div>
                            <div class="bar-labels" style="display:flex; gap:8px; margin-top:4px;"></div>
                        </div>
                        <div id="ws14-tat-mtd-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; min-width:260px;">
                            <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:10px;">TAT Achievement — MTD</div>
                            <div style="color:#999; font-size:12px;">Loading...</div>
                        </div>
                    </div>
                `;
            }

            let commonJobsAndSidebarHtml = `
                <div style="display:flex; gap:16px; margin-top:16px; align-items:flex-start;">
                    <div style="flex:2; min-width:0; border:1px solid #e0e0e0; border-radius:8px; padding:16px 20px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <div style="font-size:14px; font-weight:700;">JOBS — ${ws_code}</div>
                            <div id="jobs-tabs" style="display:flex; gap:8px;">
                                <div class="jobs-tab active" data-tab="Pending" style="padding:6px 14px; border-radius:5px; cursor:pointer; font-size:12px; background:#1e3a5f; color:white;">Pending</div>
                                <div class="jobs-tab" data-tab="Upcoming" style="padding:6px 14px; border-radius:5px; cursor:pointer; font-size:12px; background:#eee; color:#333;">Upcoming</div>
                                <div class="jobs-tab" data-tab="Completed" style="padding:6px 14px; border-radius:5px; cursor:pointer; font-size:12px; background:#eee; color:#333;">Completed</div>
                            </div>
                        </div>
                        <table id="jobs-table" style="width:100%; border-collapse:collapse; font-size:13px;">
                            <tbody id="jobs-table-body">
                                <tr><td style="padding:12px 4px; color:#999;">Loading...</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div id="ws-sidebar" style="flex:1; min-width:280px; display:flex; flex-direction:column; gap:16px;">
                        <div id="tat-7day-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:16px 20px;">
                            <div style="font-size:13px; font-weight:700; margin-bottom:2px;">STATION TAT ADHERENCE — 7 DAYS</div>
                            <div style="font-size:11px; color:#999; margin-bottom:10px;">target ≥95%</div>
                            <div id="tat-7day-rows" style="color:#999; font-size:12px;">Loading...</div>
                        </div>
                        <div id="completed-7day-card" style="border:1px solid #e0e0e0; border-radius:8px; padding:16px 20px;">
                            <div style="font-size:13px; font-weight:700; margin-bottom:2px;">COMPLETED HERE — 7 DAYS</div>
                            <div style="font-size:11px; color:#999; margin-bottom:10px;">panels signed out</div>
                            <div id="completed-7day-bars" style="display:flex; gap:8px; height:80px; align-items:flex-end; color:#999; font-size:12px;">Loading...</div>
                            <div id="completed-7day-labels" style="display:flex; gap:8px; margin-top:4px;"></div>
                        </div>
                        <div id="team-actions-row" style="display:flex; flex-direction:column; gap:16px;"></div>
                    </div>
                </div>
            `;

            let isSupportedStation = ['WS1', 'WS2', 'WS3', 'WS4', 'WS5', 'WS6', 'WS7', 'WS8', 'WS9', 'WS10', 'WS11', 'WS12', 'WS13', 'WS14'].includes(ws_code);

            $('#station-detail').html(`
                <div style="display:flex; align-items:center; gap:14px; padding-bottom:16px; flex-wrap:wrap;">
                    <span style="font-size:22px; font-weight:800; color:#c0554a;">${ws_code}</span>
                    <span style="font-size:20px; font-weight:700;">${ws_name}</span>
                    <span style="background:#eef1f6; color:#333; font-size:12px; padding:3px 10px; border-radius:5px;">Stage ${cfg.custom_stage_code || '-'}</span>
                    <span style="background:#fbe7d9; color:#a15a1e; font-size:12px; padding:3px 10px; border-radius:5px;">TAT ${cfg.custom_tat_range || '-'}</span>
                    <span id="owner-tag" style="background:#eef1f6; color:#333; font-size:12px; padding:3px 10px; border-radius:5px;">Owner: Loading...</span>
                    <span id="supervisor-tag" style="background:#e8f0fe; color:#1a4a8a; font-size:12px; padding:3px 10px; border-radius:5px;">Supervisor: Loading...</span>
                    <span style="background:#eef1f6; color:#333; font-size:12px; padding:3px 10px; border-radius:5px;">Procedure: ${cfg.custom_procedure_reference || '-'}</span>
                </div>
                <div style="background:#1e3a5f; color:white; padding:10px 16px; border-radius:6px; font-size:13px; margin-bottom:10px;">
                    <span style="color:#f0b84f; font-weight:700; margin-right:8px;">QC HOLD POINT</span>
                    ${cfg.custom_qc_hold_point_text || 'Not set'}
                </div>
                ${kpiCardsHtml}
                ${isSupportedStation ? commonJobsAndSidebarHtml : ''}
            `);

            frappe.call({
                method: "ppg_dashboard.api.kpi.get_role_owner_name",
                args: { role: cfg.custom_owner_role },
                callback: function(r) {
                    let owner_name = r.message || "Unassigned";
                    $("#owner-tag").text("Owner: " + owner_name + " · " + (cfg.custom_owner_role || "-"));
                }
            });

            frappe.call({
                method: "ppg_dashboard.api.kpi.get_station_team_info",
                args: { workstation: cfg.custom_workstation },
                callback: function(r) {
                    let data = r.message || {supervisors: [], team: []};
                    let supervisorText = data.supervisors.length
                        ? data.supervisors.map(function(s) { return s.employee_name; }).join(", ")
                        : "Unassigned";
                    $("#supervisor-tag").text("Supervisor: " + supervisorText);
                    let teamHtml = data.team.length
                        ? data.team.map(function(t) {
                            let initials = t.employee_name.split(" ").map(function(n){ return n[0]; }).join("").substring(0,2).toUpperCase();
                            let gradeMatch = (t.grade || "").match(/Level\s*(\d+)/i);
                            let gradeText = gradeMatch ? "L" + gradeMatch[1] : (t.grade || "-");
                            let designationText = t.designation || "-";
                            let leaveTag = t.on_leave
                                ? "<span style=\"color:#c0392b; font-weight:600; margin-left:6px;\">— ON LEAVE</span>"
                                : "";
                            return "<div style=\"display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid #eee;\">" +
                                "<div style=\"width:32px; height:32px; border-radius:50%; background:#e8f0fe; color:#1a4a8a; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; flex-shrink:0;\">" + initials + "</div>" +
                                "<div style=\"flex:1;\">" +
                                "<div style=\"font-weight:600; font-size:13px;\">" + t.employee_name + leaveTag + "</div>" +
                                "<div style=\"font-size:11px; color:#888;\">" + designationText + " · " + gradeText + "</div>" +
                                "</div>" +
                                "<div style=\"text-align:right; font-size:11px; color:#888; white-space:nowrap;\">" + t.booked_hours + "h booked · " + t.sign_offs + " sign-off" + (t.sign_offs === 1 ? "" : "s") + "</div>" +
                                "</div>";
                        }).join("")
                        : "<div style=\"color:#999; font-size:12px;\">No one assigned to this station right now.</div>";
                    $("#team-actions-row").append(
                        "<div style=\"border:1px solid #e0e0e0; border-radius:8px; padding:16px 20px;\">" +
                        "<div style=\"font-weight:700; font-size:13px; margin-bottom:2px;\">TEAM ON SHIFT</div>" +
                        "<div style=\"font-size:11px; color:#999; margin-bottom:10px;\">per Skills Matrix</div>" +
                        teamHtml +
                        "<div style=\"margin-top:12px; padding-top:10px; border-top:1px solid #eee; font-size:11px; color:#888;\">" +
                        "<strong>Deployment rule:</strong> solo work needs L2+; L1 works only under an L2+ present on shift." +
                        "</div>" +
                        "</div>"
                    );
                }
            });

            frappe.call({
                method: "ppg_dashboard.api.kpi.get_station_actions",
                args: { workstation: cfg.custom_workstation },
                callback: function(r) {
                    let actions = r.message || [];
                    let html = actions.length
                        ? actions.map(function(a) {
                            return "<div style=\"padding:8px 0; border-bottom:1px solid #eee; font-size:12px;\">🔴 " + a.type + " — " + a.ref + " · " + a.date + "</div>";
                        }).join("")
                        : "<div style=\"color:#1e7e34; font-size:12px;\">OK — No open station actions.</div>";

                    $("#team-actions-row").prepend(
                        "<div style=\"border:1px solid #e0e0e0; border-radius:8px; padding:16px 20px;\">" +
                        "<div style=\"font-weight:700; font-size:13px; margin-bottom:10px;\">STATION ACTIONS</div>" +
                        html +
                        "</div>"
                    );
                }
            });

            // Wireup Logic WS1-WS14
            if (ws_code === 'WS1') {
                wire_kpi_card('kpi1-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi1');
                wire_kpi_card('kpi2-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi2');
                wire_kpi_card('kpi3-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi3');
                load_snapshot_card('kpi4-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi4_at_station_now', (card, data) => { card.find('.value').text(data.count); card.find('.subtitle').text(data.amber_red + ' amber/red'); });
                load_snapshot_card('kpi5-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi5_completed_today', (card, data) => { card.find('.value').text(data.count); card.find('.subtitle').text('signed out at WS1'); });
                load_weekly_card('kpi1-weekly-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi1_weekly');
                load_weekly_card('kpi2-weekly-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi2_weekly');
                load_tat_mtd_card('tat-mtd-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_tat_mtd');
            } else if (ws_code === 'WS2') {
                wire_kpi_card('ws2-kpi1-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws2_kpi1_kit_completeness');
                wire_kpi_card('ws2-kpi2-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws2_kpi2_inbound_mar');
                wire_kpi_card('ws2-kpi3-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi3');
                load_snapshot_card('ws2-kpi4-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi4_at_station_now', (card, data) => { card.find('.value').text(data.count); card.find('.subtitle').text(data.amber_red + ' amber/red'); });
                load_snapshot_card('ws2-kpi5-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi5_completed_today', (card, data) => { card.find('.value').text(data.count); card.find('.subtitle').text('signed out at WS2'); });
                load_weekly_card('ws2-kpi1-weekly-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws2_kpi1_weekly');
                load_weekly_card('ws2-kpi2-weekly-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws2_kpi2_weekly');
                load_tat_mtd_card('ws2-tat-mtd-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_tat_mtd');
            } else if (ws_code === 'WS3') {
                wire_kpi_card('ws3-kpi1-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws3_kpi1');
                wire_kpi_card('ws3-kpi2-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws3_kpi2');
                wire_kpi_card('ws3-kpi3-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi3');
                load_snapshot_card('ws3-kpi4-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi4_at_station_now', (card, data) => { card.find('.value').text(data.count); card.find('.subtitle').text(data.amber_red + ' amber/red'); });
                load_snapshot_card('ws3-kpi5-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi5_completed_today', (card, data) => { card.find('.value').text(data.count); card.find('.subtitle').text('signed out at WS3'); });
                load_weekly_card('ws3-kpi1-weekly-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws3_kpi1_weekly');
                load_weekly_card('ws3-kpi2-weekly-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws3_kpi2_weekly');
                load_tat_mtd_card('ws3-tat-mtd-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_tat_mtd');
            } else if (ws_code === 'WS4') {
                wire_kpi_card('ws4-kpi1-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws4_kpi1');
                wire_kpi_card('ws4-kpi2-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws4_kpi2');
                wire_kpi_card('ws4-kpi3-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi3');
                load_snapshot_card('ws4-kpi4-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi4_at_station_now', (card, data) => { card.find('.value').text(data.count); card.find('.subtitle').text(data.amber_red + ' amber/red'); });
                load_snapshot_card('ws4-kpi5-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi5_completed_today', (card, data) => { card.find('.value').text(data.count); card.find('.subtitle').text('signed out at WS4'); });
                load_weekly_card('ws4-kpi1-weekly-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws4_kpi1_weekly');
                load_weekly_card('ws4-kpi2-weekly-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws4_kpi2_weekly');
                load_tat_mtd_card('ws4-tat-mtd-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_tat_mtd');
            } else if (ws_code === 'WS5') {
                wire_kpi_card('ws5-kpi1-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws5_kpi1');
                wire_kpi_card('ws5-kpi2-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws5_kpi2');
                wire_kpi_card('ws5-kpi3-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi3');
                load_snapshot_card('ws5-kpi4-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi4_at_station_now', (card, data) => { card.find('.value').text(data.count); card.find('.subtitle').text(data.amber_red + ' amber/red'); });
                load_snapshot_card('ws5-kpi5-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi5_completed_today', (card, data) => { card.find('.value').text(data.count); card.find('.subtitle').text('signed out at WS5'); });
                load_weekly_card('ws5-kpi1-weekly-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws5_kpi1_weekly');
                load_weekly_card('ws5-kpi2-weekly-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws5_kpi2_weekly');
                load_tat_mtd_card('ws5-tat-mtd-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_tat_mtd');
            } else if (ws_code === 'WS6') {
                wire_kpi_card('ws6-kpi1-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws6_kpi1');
                wire_kpi_card('ws6-kpi2-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws6_kpi2');
                wire_kpi_card('ws6-kpi3-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi3');
                load_snapshot_card('ws6-kpi4-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi4_at_station_now', (card, data) => { card.find('.value').text(data.count); card.find('.subtitle').text(data.amber_red + ' amber/red'); });
                load_snapshot_card('ws6-kpi5-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi5_completed_today', (card, data) => { card.find('.value').text(data.count); card.find('.subtitle').text('signed out at WS6'); });
                load_weekly_card('ws6-kpi1-weekly-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws6_kpi1_weekly');
                load_weekly_card('ws6-kpi2-weekly-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws6_kpi2_weekly');
                load_tat_mtd_card('ws6-tat-mtd-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_tat_mtd');
            } else if (ws_code === 'WS7') {
                wire_kpi_card('ws7-kpi1-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws7_kpi1');
                wire_kpi_card('ws7-kpi2-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws7_kpi2');
                wire_kpi_card('ws7-kpi3-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi3');
                load_snapshot_card('ws7-kpi4-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi4_at_station_now', (card, data) => { card.find('.value').text(data.count); card.find('.subtitle').text(data.amber_red + ' amber/red'); });
                load_snapshot_card('ws7-kpi5-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi5_completed_today', (card, data) => { card.find('.value').text(data.count); card.find('.subtitle').text('signed out at WS7'); });
                load_weekly_card('ws7-kpi1-weekly-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws7_kpi1_weekly');
                load_weekly_card('ws7-kpi2-weekly-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws7_kpi2_weekly');
                load_tat_mtd_card('ws7-tat-mtd-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_tat_mtd');
            } else if (ws_code === 'WS8') {
                wire_kpi_card('ws8-kpi1-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws8_kpi1');
                wire_kpi_card('ws8-kpi2-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws8_kpi2');
                wire_kpi_card('ws8-kpi3-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi3');
                load_snapshot_card('ws8-kpi4-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi4_at_station_now', (card, data) => { card.find('.value').text(data.count); card.find('.subtitle').text(data.amber_red + ' amber/red'); });
                load_snapshot_card('ws8-kpi5-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi5_completed_today', (card, data) => { card.find('.value').text(data.count); card.find('.subtitle').text('signed out at WS8'); });
                load_weekly_card('ws8-kpi1-weekly-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws8_kpi1_weekly');
                load_weekly_card('ws8-kpi2-weekly-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws8_kpi2_weekly');
                load_tat_mtd_card('ws8-tat-mtd-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_tat_mtd');
            } else if (ws_code === 'WS9') {
                wire_kpi_card('ws9-kpi1-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws9_kpi1');
                wire_kpi_card('ws9-kpi2-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws9_kpi2');
                wire_kpi_card('ws9-kpi3-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi3');
                load_snapshot_card('ws9-kpi4-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi4_at_station_now', (card, data) => { card.find('.value').text(data.count); card.find('.subtitle').text(data.amber_red + ' amber/red'); });
                load_snapshot_card('ws9-kpi5-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi5_completed_today', (card, data) => { card.find('.value').text(data.count); card.find('.subtitle').text('signed out at WS9'); });
                load_weekly_card('ws9-kpi1-weekly-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws9_kpi1_weekly');
                load_weekly_card('ws9-kpi2-weekly-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws9_kpi2_weekly');
                load_tat_mtd_card('ws9-tat-mtd-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_tat_mtd');
            } else if (ws_code === 'WS10') {
                wire_kpi_card('ws10-kpi1-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws10_kpi1');
                wire_kpi_card('ws10-kpi2-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws10_kpi2');
                wire_kpi_card('ws10-kpi3-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi3');
                load_snapshot_card('ws10-kpi4-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi4_at_station_now', (card, data) => { card.find('.value').text(data.count); card.find('.subtitle').text(data.amber_red + ' amber/red'); });
                load_snapshot_card('ws10-kpi5-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi5_completed_today', (card, data) => { card.find('.value').text(data.count); card.find('.subtitle').text('signed out at WS10'); });
                load_weekly_card('ws10-kpi1-weekly-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws10_kpi1_weekly');
                load_weekly_card('ws10-kpi2-weekly-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws10_kpi2_weekly');
                load_tat_mtd_card('ws10-tat-mtd-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_tat_mtd');
            } else if (ws_code === 'WS11') {
                wire_kpi_card('ws11-kpi1-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws11_kpi1');
                wire_kpi_card('ws11-kpi2-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws11_kpi2');
                wire_kpi_card('ws11-kpi3-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi3');
                load_snapshot_card('ws11-kpi4-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi4_at_station_now', (card, data) => { card.find('.value').text(data.count); card.find('.subtitle').text(data.amber_red + ' amber/red'); });
                load_snapshot_card('ws11-kpi5-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi5_completed_today', (card, data) => { card.find('.value').text(data.count); card.find('.subtitle').text('signed out at WS11'); });
                load_weekly_card('ws11-kpi1-weekly-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws11_kpi1_weekly');
                load_weekly_card('ws11-kpi2-weekly-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws11_kpi2_weekly');
                load_tat_mtd_card('ws11-tat-mtd-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_tat_mtd');
            } else if (ws_code === 'WS12') {
                wire_kpi_card('ws12-kpi1-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws12_kpi1');
                wire_kpi_card('ws12-kpi2-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws12_kpi2');
                wire_kpi_card('ws12-kpi3-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi3');
                load_snapshot_card('ws12-kpi4-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi4_at_station_now', (card, data) => { card.find('.value').text(data.count); card.find('.subtitle').text(data.amber_red + ' amber/red'); });
                load_snapshot_card('ws12-kpi5-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi5_completed_today', (card, data) => { card.find('.value').text(data.count); card.find('.subtitle').text('signed out at WS12'); });
                load_weekly_card('ws12-kpi1-weekly-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws12_kpi1_weekly');
                load_weekly_card('ws12-kpi2-weekly-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws12_kpi2_weekly');
                load_tat_mtd_card('ws12-tat-mtd-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_tat_mtd');
            } else if (ws_code === 'WS13') {
                wire_kpi_card('ws13-kpi1-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws13_kpi1');
                wire_kpi_card('ws13-kpi2-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws13_kpi2');
                wire_kpi_card('ws13-kpi3-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi3');
                load_snapshot_card('ws13-kpi4-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi4_at_station_now', (card, data) => { card.find('.value').text(data.count); card.find('.subtitle').text(data.amber_red + ' amber/red'); });
                load_snapshot_card('ws13-kpi5-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi5_completed_today', (card, data) => { card.find('.value').text(data.count); card.find('.subtitle').text('signed out at WS13'); });
                load_weekly_card('ws13-kpi1-weekly-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws13_kpi1_weekly');
                load_weekly_card('ws13-kpi2-weekly-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws13_kpi2_weekly');
                load_tat_mtd_card('ws13-tat-mtd-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_tat_mtd');
            } else if (ws_code === 'WS14') {
                wire_kpi_card('ws14-kpi1-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws14_kpi1');
                wire_kpi_card('ws14-kpi2-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws14_kpi2');
                wire_kpi_card('ws14-kpi3-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi3');
                load_snapshot_card('ws14-kpi4-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi4_at_station_now', (card, data) => { card.find('.value').text(data.count); card.find('.subtitle').text(data.amber_red + ' amber/red'); });
                load_snapshot_card('ws14-kpi5-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_kpi5_completed_today', (card, data) => { card.find('.value').text(data.count); card.find('.subtitle').text('signed out at WS14'); });
                load_weekly_card('ws14-kpi1-weekly-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws14_kpi1_weekly');
                load_weekly_card('ws14-kpi2-weekly-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws14_kpi2_weekly');
                load_tat_mtd_card('ws14-tat-mtd-card', cfg.custom_workstation, 'ppg_dashboard.api.kpi.get_ws1_tat_mtd');
            }

            if (isSupportedStation) {
                load_jobs_table(cfg.custom_workstation, 'Pending');

                $('.jobs-tab').on('click', function() {
                    $('.jobs-tab').css({background:'#eee', color:'#333'});
                    $(this).css({background:'#1e3a5f', color:'white'});
                    let tab = $(this).data('tab');
                    load_jobs_table(cfg.custom_workstation, tab);
                });

                load_tat_7day_card(cfg.custom_workstation);
                load_completed_7day_card(cfg.custom_workstation);
            }
        }
    });
}
