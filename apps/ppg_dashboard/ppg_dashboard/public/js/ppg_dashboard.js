// Function to load workstation dashboard details & team
function load_station_dashboard(workstation) {
    frappe.call({
        method: "ppg_dashboard.api.kpi.get_station_details",
        args: { workstation: workstation },
        callback: function(r) {
            if (!r.message) return;

            let data = r.message;
            let config = data.config || {};
            let team = data.team || [];

            // 1. Owner Display in Header Update
            if ($('#owner-display').length) {
                $('#owner-display').html(`<strong>Owner:</strong> ${data.owner_name} (${data.owner_role})`);
            }

            // 2. Team Members List HTML Construct
            let teamHtml = team.length ? team.map(t => {
                let badge = t.on_leave
                    ? `<span style="background:#fee2e2; color:#dc2626; font-weight:700; padding:2px 8px; border-radius:4px; font-size:11px;">ON LEAVE</span>`
                    : `<span style="background:#dcfce7; color:#15803d; font-weight:600; padding:2px 8px; border-radius:4px; font-size:11px;">ON SHIFT</span>`;

                let supTag = t.is_supervisor 
                    ? `<span style="color:#d97706; font-weight:bold; font-size:10px; margin-left:4px;">[SUPERVISOR]</span>` 
                    : '';

                return `
                    <div style="padding:8px 0; border-bottom:1px solid #f3f4f6; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-weight:600; color:#1f2937; font-size:13px;">${t.employee_name} ${supTag}</div>
                            <div style="font-size:11px; color:#6b7280;">${t.designation}</div>
                        </div>
                        <div>${badge}</div>
                    </div>
                `;
            }).join('') : `<div style="color:#9ca3af; font-size:12px; font-style:italic; padding:10px 0;">No team assigned to this station.</div>`;

            // 3. Render Team Card on UI
            if ($('#station-team-container').length) {
                $('#station-team-container').html(`
                    <div style="border:1px solid #e5e7eb; border-radius:8px; padding:16px; background:#ffffff; max-width:400px; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                        <div style="font-weight:700; font-size:12px; color:#374151; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px; border-bottom:2px solid #2563eb; padding-bottom:4px; display:inline-block;">
                            Team On Shift
                        </div>
                        ${teamHtml}
                    </div>
                `);
            }
        }
    });
}

// Function to render TEAM ON SHIFT block according to prototype UI
function render_team_on_shift_card(workstation) {
    frappe.call({
        method: "ppg_dashboard.api.kpi.get_station_details",
        args: { workstation: workstation },
        callback: function(r) {
            if (!r.message) return;

            let data = r.message;
            let team = data.team || [];

            let membersHtml = team.length ? team.map(t => {
                let badge = t.on_leave
                    ? `<span style="background:#fee2e2; color:#dc2626; font-weight:700; padding:2px 6px; border-radius:4px; font-size:10px; float:right;">ON LEAVE</span>`
                    : `<span style="background:#dcfce7; color:#15803d; font-weight:600; padding:2px 6px; border-radius:4px; font-size:10px; float:right;">ON SHIFT</span>`;

                let supTag = t.is_supervisor 
                    ? `<span style="color:#d97706; font-weight:bold; font-size:10px; margin-left:4px;">(Lead)</span>` 
                    : '';

                let initials = t.employee_name ? t.employee_name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0,2) : 'EMP';

                return `
                    <div style="display:flex; align-items:center; padding:8px 0; border-bottom:1px solid #f1f5f9;">
                        <div style="width:28px; height:28px; border-radius:50%; background:#e2e8f0; color:#475569; font-size:10px; font-weight:700; display:flex; align-items:center; justify-content:center; margin-right:10px;">
                            ${initials}
                        </div>
                        <div style="flex-grow:1;">
                            <div style="font-size:12px; font-weight:600; color:#1e293b;">
                                ${t.employee_name} ${supTag}
                            </div>
                            <div style="font-size:10px; color:#64748b;">
                                ${t.designation}
                            </div>
                        </div>
                        <div>${badge}</div>
                    </div>
                `;
            }).join('') : `<div style="color:#94a3b8; font-size:11px; font-style:italic; padding:8px 0;">No team assigned.</div>`;

            let cardHtml = `
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:6px; padding:12px; margin-top:15px; box-shadow:0 1px 2px rgba(0,0,0,0.03);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span style="font-size:11px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.5px;">
                            TEAM ON SHIFT
                        </span>
                        <span style="font-size:10px; color:#94a3b8;">(${team.length})</span>
                    </div>
                    ${membersHtml}
                </div>
            `;

            if ($('#team-on-shift-wrapper').length) {
                $('#team-on-shift-wrapper').html(cardHtml);
            } else if ($('#station-team-container').length) {
                $('#station-team-container').html(cardHtml);
            }
        }
    });
}
