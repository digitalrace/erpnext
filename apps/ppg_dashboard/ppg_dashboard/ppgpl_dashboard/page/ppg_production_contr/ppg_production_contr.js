frappe.pages['ppg-production-contr'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'PPG Production Control - Daily Dashboard',
        single_column: true
    });

    $(wrapper).find('.page-head').hide();
    $(wrapper).find('.container.page-body').css({'max-width': '100%', 'padding': '0px', 'margin': '0px'});

    let html_content = `
    <div style="background:#edf2f7; color:#2d3748; min-height:100vh; padding:15px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11px;">

        <!-- HEADER -->
        <div style="background:#1a202c; color:#fff; padding:10px 18px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:12px;">
                <span style="background:#3182ce; color:#fff; padding:3px 8px; border-radius:4px; font-weight:bold; font-size:12px;">PPG</span>
                <span style="font-weight:bold; font-size:16px;">Production Control — Daily Dashboard</span>
            </div>
            <div style="display:flex; gap:16px; font-size:11px; color:#a0aec0;">
                <div>DATE: <b style="color:#fff;" id="hdr-date">--</b></div>
                <div>REVIEW: <b style="color:#fff;">8:30 AM Meeting</b></div>
                <div>SOURCE: <b style="color:#fff;">ERPNext - Live Data</b></div>
                <div>SOP: <b style="color:#fff;">MI G-001 - Rev 01</b></div>
            </div>
        </div>

        <!-- 7 KPI CARDS -->
        <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:10px; margin-top:12px;">
            <div style="background:#fff; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">
                <div style="font-size:10px; color:#718096; font-weight:bold;">WTA - TAT ADHERENCE</div>
                <div id="kpi-wta-tat" style="font-size:22px; font-weight:bold; margin:2px 0;">--</div>
                <div style="font-size:9px; color:#a0aec0;">target &ge; 95%</div>
            </div>
            <div style="background:#fff; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">
                <div style="font-size:10px; color:#718096; font-weight:bold;">ROUTINE TEST FPY (MTD)</div>
                <div id="kpi-fpy" style="font-size:22px; font-weight:bold; margin:2px 0;">--</div>
                <div style="font-size:9px; color:#a0aec0;">target &ge; 98%</div>
            </div>
            <div style="background:#fff; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">
                <div style="font-size:10px; color:#718096; font-weight:bold;">ON-TIME PRODUCTION</div>
                <div id="kpi-otp" style="font-size:22px; font-weight:bold; margin:2px 0;">--</div>
                <div style="font-size:9px; color:#a0aec0;">target &ge; 95%</div>
            </div>
            <div style="background:#fff; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">
                <div style="font-size:10px; color:#718096; font-weight:bold;">INBOUND MAR (MTD)</div>
                <div id="kpi-mar" style="font-size:22px; font-weight:bold; margin:2px 0;">--</div>
                <div style="font-size:9px; color:#a0aec0;">target &ge; 98%</div>
            </div>
            <div style="background:#fff; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">
                <div style="font-size:10px; color:#718096; font-weight:bold;">OPEN NCRs</div>
                <div id="kpi-ncrs" style="font-size:22px; font-weight:bold; margin:2px 0;">--</div>
                <div id="kpi-ncrs-sub" style="font-size:9px; color:#a0aec0;">oldest -- days</div>
            </div>
            <div style="background:#fff; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">
                <div style="font-size:10px; color:#718096; font-weight:bold;">RED / AMBER JOBS</div>
                <div id="kpi-red-amber" style="font-size:22px; font-weight:bold; margin:2px 0;">--</div>
                <div style="font-size:9px; color:#a0aec0;">red = recovery plan today</div>
            </div>
            <div style="background:#fff; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">
                <div style="font-size:10px; color:#718096; font-weight:bold;">DAYS SINCE LAST LTI</div>
                <div id="kpi-lti" style="font-size:22px; font-weight:bold; margin:2px 0;">--</div>
                <div style="font-size:9px; color:#a0aec0;">target: zero LTI</div>
            </div>
        </div>

        <!-- LIVE STATION LOAD -->
        <div style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:12px; margin-top:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div style="font-size:11px; font-weight:bold; color:#4a5568;">PRODUCTION LINE — LIVE STATION LOAD
                    <span style="font-weight:normal; color:#a0aec0; font-size:10px;">Click a station to filter the job board</span>
                </div>
                <div style="display:flex; gap:12px; font-size:10px; color:#718096;">
                    <span><i style="color:#38a169;">&#9673;</i> Within TAT</span>
                    <span><i style="color:#dd6b20;">&#9673;</i> Amber &ge; 80%</span>
                    <span><i style="color:#e53e3e;">&#9673;</i> TAT Exceeded</span>
                </div>
            </div>
            <div id="stations-live-strip" style="display:grid; grid-template-columns:repeat(14, 1fr); gap:6px;">
                <div class="text-muted p-2" style="grid-column: 1 / -1; font-size:11px;">Loading live station data...</div>
            </div>
        </div>

        <!-- ROW: WIP / THROUGHPUT / TAT BY STATION / JOB STATUS MIX -->
        <div style="display:grid; grid-template-columns:1fr 1fr 1.3fr 1fr; gap:12px; margin-top:12px;">
            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:12px; height:230px;">
                <div style="font-size:11px; font-weight:bold; color:#2d3748;">WIP BY STAGE</div>
                <div style="font-size:9px; color:#a0aec0; margin-bottom:8px;">open panels at each stage M1–M10</div>
                <div id="chart-wip-stage" style="display:flex; align-items:flex-end; justify-content:space-between; height:150px; padding:0 5px;">
                    <span class="text-muted" style="font-size:10px;">Loading...</span>
                </div>
            </div>

            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:12px; height:230px;">
                <div style="font-size:11px; font-weight:bold; color:#2d3748;">THROUGHPUT — 7 DAYS</div>
                <div style="font-size:9px; color:#a0aec0; margin-bottom:8px;">panels completed at M10</div>
                <div id="chart-throughput" style="display:flex; align-items:flex-end; justify-content:space-between; height:150px; padding:0 5px;">
                    <span class="text-muted" style="font-size:10px;">Loading...</span>
                </div>
            </div>

            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:12px; height:230px; overflow-y:auto;">
                <div style="font-size:11px; font-weight:bold; color:#2d3748;">TAT ADHERENCE BY STATION — 30 DAYS</div>
                <div style="font-size:9px; color:#a0aec0; margin-bottom:8px;">% job cards closed within TAT · target 95%</div>
                <div id="tat-by-station" style="display:flex; flex-direction:column; gap:5px;">
                    <span class="text-muted" style="font-size:10px;">Loading...</span>
                </div>
            </div>

            <!-- JOB STATUS MIX BOX WITH EXACT LAYOUT & BOTTOM LEGEND -->
            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:12px; height:230px; display:flex; flex-direction:column; justify-content:space-between;">
                <div>
                    <div style="font-size:11px; font-weight:bold; color:#2d3748; text-align:left;">JOB STATUS MIX</div>
                    <div style="font-size:9px; color:#a0aec0; text-align:left;">all active panels, now</div>
                </div>
                
                <div id="job-status-donut-wrap" style="display:flex; justify-content:center; align-items:center; margin:2px 0;"></div>
                
                <div id="job-status-legend" style="text-align:center; font-size:8px; display:flex; justify-content:center; align-items:center; gap:8px; white-space:nowrap; padding-bottom:2px;"></div>
            </div>
        </div>

        <!-- ROW: CYCLE TIME / NCRs / TEAM UTILISATION -->
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-top:12px;">
            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:12px; height:220px;">
                <div style="font-size:11px; font-weight:bold; color:#2d3748;">CYCLE TIME DISTRIBUTION — LAST 20 PANELS</div>
                <div style="font-size:9px; color:#a0aec0; margin-bottom:8px;">total M1–M10 working days per completed panel</div>
                <div id="chart-cycle-time" style="display:flex; align-items:flex-end; justify-content:space-between; height:130px; padding:0 5px;"></div>
                <div style="font-size:9px; margin-top:6px;"><span style="color:#2b6cb0;">&#9632;</span> Standard (&le;20d) &nbsp; <span style="color:#dd6b20;">&#9632;</span> Complex (&le;40d)</div>
            </div>

            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:12px; height:220px;">
                <div style="font-size:11px; font-weight:bold; color:#2d3748;">NCRs — RAISED VS CLOSED, 6 WEEKS</div>
                <div style="font-size:9px; color:#a0aec0; margin-bottom:8px;">weekly counts</div>
                <div id="chart-ncrs" style="display:flex; align-items:flex-end; justify-content:space-between; height:130px; padding:0 5px;"></div>
                <div style="font-size:9px; margin-top:6px;"><span style="color:#e53e3e;">&#9632;</span> Raised &nbsp; <span style="color:#38a169;">&#9632;</span> Closed</div>
            </div>

            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:12px; height:220px;">
                <div style="font-size:11px; font-weight:bold; color:#2d3748; margin-bottom:10px;">TEAM UTILISATION — TODAY</div>
                <div id="chart-team-util" style="display:flex; flex-direction:column; gap:8px;"></div>
            </div>
        </div>

        <!-- BOTTOM ROW: ACTIVE JOBS + RIGHT SIDEBAR CARDS -->
        <div style="display:grid; grid-template-columns:2.3fr 1fr; gap:12px; margin-top:12px;">
            
            <!-- LEFT COLUMN: ACTIVE JOBS TABLE -->
            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <div style="font-size:11px; font-weight:bold; color:#2d3748;">
                        <span id="active-jobs-title">ACTIVE JOBS OVERVIEW</span> <span id="jobs-count-subtitle" style="font-weight:normal; font-size:9px; color:#718096;">(-- panels)</span>
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button class="filter-btn btn btn-xs" data-status="all" style="background:#1a365d; color:#fff; border:none; font-size:10px; padding:3px 10px; border-radius:4px; font-weight:bold;">All</button>
                        <button class="filter-btn btn btn-xs" data-status="amber" style="background:#edf2f7; color:#2d3748; border:1px solid #cbd5e1; font-size:10px; padding:3px 10px; border-radius:4px;">Amber</button>
                        <button class="filter-btn btn btn-xs" data-status="red" style="background:#edf2f7; color:#2d3748; border:1px solid #cbd5e1; font-size:10px; padding:3px 10px; border-radius:4px;">Red</button>
                        <button class="filter-btn btn btn-xs" data-status="qc" style="background:#edf2f7; color:#2d3748; border:1px solid #cbd5e1; font-size:10px; padding:3px 10px; border-radius:4px;">QC hold pending</button>
                    </div>
                </div>
                <div class="table-responsive">
                    <table class="table table-hover table-bordered" style="font-size:11px; background:#fff; margin:0; color:#2d3748;">
                        <thead style="background:#f7fafc; color:#4a5568; font-size:10px; text-transform:uppercase;">
                            <tr>
                                <th>Panel / Customer</th>
                                <th>Type</th>
                                <th>Stage</th>
                                <th>Progress M1 - M10</th>
                                <th>Days @ Station</th>
                                <th>TAT Use</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody id="prototype-active-jobs-body">
                            <tr><td colspan="7" class="text-center text-muted p-3">Fetching live database jobs...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- RIGHT SIDEBAR STACK: TAT ADHERENCE, TEAM PRODUCTIVITY, ACTION QUEUE -->
            <div style="display:flex; flex-direction:column; gap:12px;">
                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:12px;">
                    <div style="font-size:11px; font-weight:bold; color:#2d3748;">TAT ADHERENCE — 7 DAYS (WTA)</div>
                    <div style="font-size:9px; color:#a0aec0; margin-bottom:8px;">target &ge; 95%</div>
                    <div id="tat-7day-wta" style="display:flex; flex-direction:column; gap:6px;"></div>
                </div>

                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:12px;">
                    <div style="font-size:11px; font-weight:bold; color:#2d3748; margin-bottom:10px;">TEAM PRODUCTIVITY — TODAY</div>
                    <div style="display:flex; flex-direction:column; gap:6px; font-size:10px; color:#4a5568;">
                        <div style="display:flex; justify-content:space-between;"><span>Panels completed (M10) today</span><b style="color:#2d3748;" id="prod-m10">0</b></div>
                        <div style="display:flex; justify-content:space-between;"><span>Stage sign-offs today</span><b style="color:#2d3748;" id="prod-signoffs">0</b></div>
                        <div style="display:flex; justify-content:space-between;"><span>Man-hours booked / available</span><b style="color:#2d3748;" id="prod-hours">0 / 156</b></div>
                    </div>
                </div>

                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:12px;">
                    <div style="font-size:11px; font-weight:bold; color:#2d3748; margin-bottom:10px;">ACTION QUEUE <span style="font-weight:normal; color:#a0aec0; font-size:9px;">for today's meeting</span></div>
                    <div id="action-queue-container" style="display:flex; flex-direction:column; gap:8px; font-size:9px;">
                        <div class="text-muted">Loading actions...</div>
                    </div>
                </div>
            </div>

        </div>

    </div>
    `;

    $(wrapper).find('.layout-main-section').html(html_content);
    $('#hdr-date').text(frappe.datetime.global_date_format(frappe.datetime.get_today()));

    let current_filter = 'all';
    let current_station = 'All';

    function fetch_backend_dashboard() {
        frappe.call({
            method: 'ppg_dashboard.api.production_api.get_production_control_dashboard_data',
            args: { station_filter: current_station, active_job_filter: current_filter },
            callback: function(r) {
                if (!r.message) return;
                let d = r.message;

                // Station strip
                let stations_html = d.stations_load.map(st => {
                    let border_color = st.status === 'red' ? '#e53e3e' : (st.status === 'amber' ? '#dd6b20' : '#38a169');
                    let is_selected = current_station === st.id;
                    return `
                        <div class="station-tile" data-station="${st.id}" style="cursor:pointer; background:#f7fafc; border:1px solid ${is_selected ? '#1a365d' : '#e2e8f0'}; border-top:3px solid ${border_color}; padding:6px 2px; text-align:center; border-radius:4px; ${is_selected ? 'box-shadow:0 0 0 2px #1a365d;' : ''}">
                            <div style="font-weight:bold; font-size:10px; color:#2d3748;">${st.id}</div>
                            <div style="font-size:8px; color:#718096; height:18px; line-height:9px; overflow:hidden;">${st.name}</div>
                            <div style="font-size:16px; font-weight:bold; color:${border_color}; margin:2px 0;">${st.count}</div>
                            <div style="font-size:7px; color:#a0aec0;">${st.tat}</div>
                        </div>
                    `;
                }).join('');
                $('#stations-live-strip').html(stations_html);
                $('.station-tile').on('click', function() {
                    let clicked = $(this).data('station');
                    current_station = (current_station === clicked) ? 'All' : clicked;
                    fetch_backend_dashboard();
                });

                // WIP by stage
                if (d.wip_by_stage) {
                    let max_wip = Math.max(...d.wip_by_stage.map(w => w.count), 1);
                    $('#chart-wip-stage').html(d.wip_by_stage.map(w => {
                        let h_px = Math.max(Math.round((w.count / max_wip) * 120), w.count > 0 ? 10 : 4);
                        return `
                            <div style="text-align:center; flex:1;">
                                <div style="font-size:8px; color:#4a5568; font-weight:bold; margin-bottom:2px;">${w.count > 0 ? w.count : ''}</div>
                                <div style="background:#2b6cb0; height:${h_px}px; width:16px; border-radius:2px 2px 0 0; margin:0 auto;"></div>
                                <span style="font-size:9px; color:#718096; margin-top:2px; display:block;">${w.stage}</span>
                            </div>`;
                    }).join(''));
                }

                // Throughput 7 days
                if (d.throughput_7days) {
                    let max_tp = Math.max(...d.throughput_7days.map(t => t.count), 1);
                    $('#chart-throughput').html(d.throughput_7days.map(t => {
                        let h_px = Math.max(Math.round((t.count / max_tp) * 120), t.count > 0 ? 10 : 4);
                        return `
                            <div style="text-align:center; flex:1;">
                                <div style="font-size:8px; color:#4a5568; font-weight:bold; margin-bottom:2px;">${t.count > 0 ? t.count : ''}</div>
                                <div style="background:#1a365d; height:${h_px}px; width:16px; border-radius:2px 2px 0 0; margin:0 auto;"></div>
                                <span style="font-size:9px; color:#718096; margin-top:2px; display:block;">${t.day}</span>
                            </div>`;
                    }).join(''));
                }

                // TAT Adherence by Station — 30 days
                if (d.tat_adherence_by_station) {
                    $('#tat-by-station').html(d.tat_adherence_by_station.map(s => {
                        let pct = s.has_data ? s.pct : null;
                        let color = pct === null ? '#cbd5e1' : (pct >= 95 ? '#38a169' : (pct >= 80 ? '#dd6b20' : '#e53e3e'));
                        let width = pct === null ? 0 : pct;
                        let label = pct === null ? '—' : pct + '%';
                        return `
                            <div style="display:flex; align-items:center; gap:8px; font-size:9px;">
                                <span style="width:32px;">${s.id}</span>
                                <div style="flex:1; background:#eef1f6; border-radius:4px; height:8px; overflow:hidden;">
                                    <div style="background:${color}; height:100%; width:${width}%;"></div>
                                </div>
                                <span style="width:32px; text-align:right;">${label}</span>
                            </div>`;
                    }).join(''));
                }

                // EXTRA LARGE PROPORTIONAL DONUT WITH CLEAN BOTTOM LEGEND
                if (d.job_status_mix) {
                    let m = d.job_status_mix;
                    let total = m.total || 1;
                    let radius = 52;
                    let strokeWidth = 18;
                    let circ = 2 * Math.PI * radius;
                    
                    let ot_len = (m.on_track / total) * circ;
                    let am_len = (m.amber / total) * circ;
                    let red_len = (m.red / total) * circ;
                    let qc_len = (m.qc_hold / total) * circ;
                    
                    let ot_off = 0;
                    let am_off = -ot_len;
                    let red_off = am_off - am_len;
                    let qc_off = red_off - red_len;

                    let svg_html = `
                        <svg width="140" height="140" viewBox="0 0 140 140" style="transform: rotate(-90deg);">
                            <circle cx="70" cy="70" r="${radius}" fill="transparent" stroke="#eef1f6" stroke-width="${strokeWidth}"></circle>
                            ${m.on_track > 0 ? `<circle cx="70" cy="70" r="${radius}" fill="transparent" stroke="#38a169" stroke-width="${strokeWidth}" stroke-dasharray="${ot_len} ${circ}" stroke-dashoffset="${ot_off}"></circle>` : ''}
                            ${m.amber > 0 ? `<circle cx="70" cy="70" r="${radius}" fill="transparent" stroke="#dd6b20" stroke-width="${strokeWidth}" stroke-dasharray="${am_len} ${circ}" stroke-dashoffset="${am_off}"></circle>` : ''}
                            ${m.red > 0 ? `<circle cx="70" cy="70" r="${radius}" fill="transparent" stroke="#e53e3e" stroke-width="${strokeWidth}" stroke-dasharray="${red_len} ${circ}" stroke-dashoffset="${red_off}"></circle>` : ''}
                            ${m.qc_hold > 0 ? `<circle cx="70" cy="70" r="${radius}" fill="transparent" stroke="#2b6cb0" stroke-width="${strokeWidth}" stroke-dasharray="${qc_len} ${circ}" stroke-dashoffset="${qc_off}"></circle>` : ''}
                        </svg>
                        <div style="position:absolute; top:35px; left:0; width:140px; height:70px; display:flex; flex-direction:column; align-items:center; justify-content:center;">
                            <span style="font-size:26px; font-weight:bold; color:#2d3748; line-height:1;">${m.total}</span>
                            <span style="font-size:8px; color:#718096; font-weight:bold; margin-top:2px; letter-spacing:0.5px;">ACTIVE</span>
                        </div>
                    `;

                    $('#job-status-donut-wrap').html(`<div style="position:relative; width:140px; height:140px; margin:0 auto;">${svg_html}</div>`);
                    $('#job-status-legend').html(`
                        <span><span style="color:#38a169;">&#9632;</span> On track ${m.on_track}</span>
                        <span><span style="color:#dd6b20;">&#9632;</span> Amber ${m.amber}</span>
                        <span><span style="color:#e53e3e;">&#9632;</span> Red ${m.red}</span>
                        <span><span style="color:#2b6cb0;">&#9632;</span> QC hold ${m.qc_hold}</span>
                    `);
                }

                // Cycle time distribution
                if (d.cycle_time_data) {
                    let max_ct = Math.max(...d.cycle_time_data.map(c => Math.max(c.std, c.complex)), 1);
                    $('#chart-cycle-time').html(d.cycle_time_data.map(c => {
                        let val = c.std || c.complex;
                        let color = c.std ? '#2b6cb0' : '#dd6b20';
                        let h_px = Math.max(Math.round((val / max_ct) * 100), val > 0 ? 8 : 2);
                        return `
                            <div style="text-align:center; flex:1;">
                                <div style="font-size:8px; font-weight:bold; margin-bottom:2px;">${val > 0 ? val : ''}</div>
                                <div style="background:${color}; height:${h_px}px; width:14px; border-radius:2px 2px 0 0; margin:0 auto;"></div>
                                <span style="font-size:8px; color:#718096; display:block; margin-top:2px;">${c.range}</span>
                            </div>`;
                    }).join(''));
                }

                // NCRs raised vs closed
                if (d.ncrs_weekly) {
                    let max_ncr = Math.max(...d.ncrs_weekly.flatMap(n => [n.raised, n.closed]), 1);
                    let bars_html = d.ncrs_weekly.map(n => {
                        let h_raised = Math.max(Math.round((n.raised / max_ncr) * 100), 4);
                        let h_closed = Math.max(Math.round((n.closed / max_ncr) * 100), 4);
                        return `
                            <div style="text-align:center; flex:1;">
                                <div style="display:flex; gap:2px; align-items:flex-end; justify-content:center; height:100px;">
                                    <div style="background:#e53e3e; height:${h_raised}px; width:8px; border-radius:2px 2px 0 0;"></div>
                                    <div style="background:#38a169; height:${h_closed}px; width:8px; border-radius:2px 2px 0 0;"></div>
                                </div>
                                <span style="font-size:8px; color:#718096; display:block; margin-top:2px;">${n.week}</span>
                            </div>`;
                    }).join('');
                    $('#chart-ncrs').html(bars_html);
                }

                // Team Utilisation
                if (d.team_utilisation) {
                    $('#chart-team-util').html(d.team_utilisation.map(t => `
                        <div>
                            <div style="display:flex; justify-content:space-between; font-size:9px; margin-bottom:2px;">
                                <span>${t.dept}</span>
                                <span>${t.booked}/${t.avail}h · ${t.pct}%</span>
                            </div>
                            <div style="background:#eef1f6; border-radius:4px; height:8px; overflow:hidden;">
                                <div style="background:#1a365d; height:100%; width:${t.pct}%;"></div>
                            </div>
                        </div>
                    `).join(''));
                }

                // TAT Adherence 7 days WTA
                if (d.tat_adherence_7days_wta) {
                    $('#tat-7day-wta').html(d.tat_adherence_7days_wta.map(t => {
                        let pct = t.has_data ? t.pct : null;
                        let color = pct === null ? '#cbd5e1' : (pct >= 95 ? '#38a169' : (pct >= 80 ? '#dd6b20' : '#e53e3e'));
                        let width = pct === null ? 0 : pct;
                        let label = pct === null ? '—' : pct + '%';
                        return `
                            <div style="display:flex; align-items:center; gap:8px; font-size:9px;">
                                <span style="width:32px;">${t.day}</span>
                                <div style="flex:1; background:#eef1f6; border-radius:4px; height:8px; overflow:hidden;">
                                    <div style="background:${color}; height:100%; width:${width}%;"></div>
                                </div>
                                <span style="width:32px; text-align:right;">${label}</span>
                            </div>`;
                    }).join(''));
                }

                // Active jobs
                $('#jobs-count-subtitle').html(`(${d.active_jobs_count} panels)`);
                if (d.active_jobs.length > 0) {
                    let rows = d.active_jobs.map(j => `
                        <tr>
                            <td>${j.panel}</td>
                            <td>${j.type}</td>
                            <td><span style="background:#ebf8ff; color:#2b6cb0; padding:2px 5px; border-radius:3px; font-weight:bold;">${j.stage}</span></td>
                            <td style="vertical-align:middle;"><div style="background:#38a169; height:6px; width:${j.progress_width}; border-radius:3px;"></div></td>
                            <td>${j.days}</td>
                            <td style="vertical-align:middle;"><div style="background:${j.bg}; height:6px; width:${j.tat_width}; border-radius:3px;"></div></td>
                            <td><span style="background:${j.bg}; color:#fff; padding:2px 6px; border-radius:3px; font-weight:bold; font-size:9px;">${j.status}</span></td>
                        </tr>
                    `).join('');
                    $('#prototype-active-jobs-body').html(rows);
                } else {
                    $('#prototype-active-jobs-body').html(`<tr><td colspan="7" class="text-center text-muted p-4">No active job cards found for this filter.</td></tr>`);
                }

                // Productivity
                $('#prod-m10').text(d.productivity.completed_m10);
                $('#prod-signoffs').text(d.productivity.signoffs);
                $('#prod-hours').text(`${d.productivity.booked_hours} / ${d.productivity.available_hours} (${d.productivity.utilisation_pct}%)`);

                // Action Queue
                if (d.action_queue.length > 0) {
                    $('#action-queue-container').html(d.action_queue.map(aq => `
                        <div style="background:#edf2f7; padding:6px; border-radius:4px; border-left:3px solid ${aq.badge_bg};">
                            <span style="background:${aq.badge_bg}; color:#fff; padding:1px 3px; border-radius:2px; font-weight:bold;">${aq.badge}</span> ${aq.text}
                        </div>
                    `).join(''));
                } else {
                    $('#action-queue-container').html('<div class="text-muted">No open actions logged.</div>');
                }
            }
        });
    }

    function fetch_top_kpi_cards() {
        frappe.call({
            method: 'ppg_dashboard.api.production_api.get_top_kpi_cards',
            callback: function(r) {
                if (!r.message) return;
                let d = r.message;

                function setCard(id, value, on_target, has_data, suffix) {
                    let el = $('#' + id);
                    if (has_data === false) {
                        el.text('No data yet').css({'color': '#a0aec0', 'font-size': '14px'});
                    } else {
                        el.text(value + (suffix || '')).css({'color': on_target ? '#38a169' : '#e53e3e', 'font-size': '22px'});
                    }
                }

                setCard('kpi-wta-tat', d.wta_tat_adherence.value, d.wta_tat_adherence.on_target, true, '%');
                setCard('kpi-otp', d.on_time_production.value, d.on_time_production.on_target, true, '%');
                setCard('kpi-mar', d.inbound_mar.value, d.inbound_mar.on_target, d.inbound_mar.has_data, '%');
                setCard('kpi-fpy', d.routine_test_fpy.value, d.routine_test_fpy.on_target, d.routine_test_fpy.has_data, '%');

                $('#kpi-ncrs').text(d.open_ncrs.value).css('color', d.open_ncrs.value > 0 ? '#e53e3e' : '#38a169');
                $('#kpi-ncrs-sub').text(`oldest ${d.open_ncrs.oldest_days} days`);

                $('#kpi-red-amber').text(`${d.red_amber_jobs.red} / ${d.red_amber_jobs.amber}`)
                    .css('color', d.red_amber_jobs.red > 0 ? '#e53e3e' : '#38a169');

                if (d.days_since_lti.has_data) {
                    $('#kpi-lti').text(d.days_since_lti.value).css({'color': '#38a169', 'font-size': '22px'});
                } else {
                    $('#kpi-lti').text('No data yet').css({'color': '#a0aec0', 'font-size': '14px'});
                }
            }
        });
    }

    $('.filter-btn').on('click', function() {
        $('.filter-btn').css({'background':'#edf2f7', 'color':'#2d3748', 'border':'1px solid #cbd5e1', 'font-weight':'normal'});
        $(this).css({'background':'#1a365d', 'color':'#fff', 'border':'none', 'font-weight':'bold'});
        current_filter = $(this).attr('data-status');
        fetch_backend_dashboard();
    });

    fetch_backend_dashboard();
    fetch_top_kpi_cards();
};
