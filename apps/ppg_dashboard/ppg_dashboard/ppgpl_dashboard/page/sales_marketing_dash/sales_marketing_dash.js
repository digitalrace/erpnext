frappe.pages['sales-marketing-dash'].on_page_load = function(wrapper) {
    let page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Sales & Marketing Dashboard',
        single_column: true
    });

    $(page.body).html(`
        <div style="font-family:-apple-system,sans-serif;">
            <div style="background:#1e3a5f; color:white; padding:16px 24px; margin:-15px -15px 0 -15px;">
                <div style="font-size:20px; font-weight:700;">SALES & MARKETING DASHBOARD</div>
                <div style="font-size:12px; opacity:0.8;">Power Partner Global Pvt. Ltd. · Jodhpur</div>
            </div>
            <div id="dashboard-tabs" style="background:#16283f; display:flex; padding:0 24px; margin:0 -15px;">
                <div class="tab-btn active" data-tab="overview" style="color:white; padding:12px 16px; cursor:pointer; border-bottom:2px solid orange;">Executive Overview</div>
                <div class="tab-btn" data-tab="kpi" style="color:#aaa; padding:12px 16px; cursor:pointer;">KPI & KRA</div>
                <div class="tab-btn" data-tab="marketing" style="color:#aaa; padding:12px 16px; cursor:pointer;">Marketing</div>
                <div class="tab-btn" data-tab="presales" style="color:#aaa; padding:12px 16px; cursor:pointer;">Pre-sales funnel</div>
                <div class="tab-btn" data-tab="pipeline" style="color:#aaa; padding:12px 16px; cursor:pointer;">Pipeline</div>
                <div class="tab-btn" data-tab="team" style="color:#aaa; padding:12px 16px; cursor:pointer;">Team</div>
            </div>
            <div id="tab-content-overview" class="tab-content" style="padding:20px;">
                <div id="kpi-cards-row" style="display:flex; gap:16px; flex-wrap:wrap;"></div>
            </div>
            <div id="tab-content-kpi" class="tab-content" style="display:none; padding:20px;">KPI & KRA content here</div>
            <div id="tab-content-marketing" class="tab-content" style="display:none; padding:20px;">Marketing content here</div>
            <div id="tab-content-presales" class="tab-content" style="display:none; padding:20px;">Pre-sales funnel content here</div>
            <div id="tab-content-pipeline" class="tab-content" style="display:none; padding:20px;">Pipeline content here</div>
            <div id="tab-content-team" class="tab-content" style="display:none; padding:20px;">Team content here</div>
        </div>
    `);

    $(page.body).find('.tab-btn').on('click', function() {
        $(page.body).find('.tab-btn').removeClass('active').css({color: '#aaa', 'border-bottom': 'none'});
        $(this).addClass('active').css({color: 'white', 'border-bottom': '2px solid orange'});
        let tab = $(this).data('tab');
        $(page.body).find('.tab-content').hide();
        $(page.body).find('#tab-content-' + tab).show();
    });

    $(document).on('click', function(e) {
        if (!$(e.target).closest('.card-menu-wrap').length) {
            $('.card-menu-dropdown').hide();
        }
    });

    // Card 1: Registration SLA (higher is better)
    render_kpi_card({
        id: 'kpi-registration',
        title: 'Registration ≤ 1 day',
        target_text: 'target ≥95%',
        report_name: 'Registration SLA %',
        value_field: 'on_track_percent',
        suffix: '%',
        good_if: (v) => v >= 95,
        watch_if: (v) => v >= 85
    });

    // Card 2: Quote TAT (lower is better)
    render_kpi_card({
        id: 'kpi-quote-tat',
        title: 'Quote TAT (median)',
        target_text: 'target ≤5 d',
        report_name: 'Quote TAT Median',
        value_field: 'median_tat_days',
        suffix: ' d',
        good_if: (v) => v <= 5,
        watch_if: (v) => v <= 7
    });
};

function render_kpi_card(cfg) {
    $('#kpi-cards-row').append(`
        <div id="${cfg.id}" style="position:relative; border:1px solid #e0e0e0; border-radius:8px; padding:14px 18px; min-width:230px; flex:1; max-width:280px;">
            <div class="card-menu-wrap" style="position:absolute; top:8px; right:8px;">
                <span class="card-menu-dots" style="cursor:pointer; font-size:16px; color:#999; padding:2px 6px;">⋮</span>
                <div class="card-menu-dropdown" style="display:none; position:absolute; right:0; top:20px; background:white; border:1px solid #ddd; border-radius:6px; box-shadow:0 2px 8px rgba(0,0,0,0.1); z-index:10; min-width:130px;">
                    <div class="range-option" data-range="Last Week" style="padding:8px 12px; cursor:pointer; font-size:12px;">Last Week</div>
                    <div class="range-option" data-range="Last Month" style="padding:8px 12px; cursor:pointer; font-size:12px; background:#f5f5f5;">Last Month</div>
                    <div class="range-option" data-range="Last Quarter" style="padding:8px 12px; cursor:pointer; font-size:12px;">Last Quarter</div>
                    <div class="range-option" data-range="Last Year" style="padding:8px 12px; cursor:pointer; font-size:12px;">Last Year</div>
                </div>
            </div>
            <div class="card-clickable" style="cursor:pointer;">
                <div style="font-size:12px; color:#555; font-weight:600; margin-bottom:6px;">${cfg.title}</div>
                <div class="value" style="font-size:26px; font-weight:700; color:#222;">Loading...</div>
                <div style="margin-top:6px; display:flex; align-items:center; gap:8px;">
                    <span class="badge" style="font-size:11px; font-weight:600; padding:2px 8px; border-radius:10px;"></span>
                    <span style="font-size:12px; color:#999;">${cfg.target_text}</span>
                </div>
            </div>
        </div>
    `);

    let card = $('#' + cfg.id);

    card.find('.card-menu-dots').on('click', function(e) {
        e.stopPropagation();
        $('.card-menu-dropdown').not(card.find('.card-menu-dropdown')).hide();
        card.find('.card-menu-dropdown').toggle();
    });

    card.find('.range-option').on('click', function(e) {
        e.stopPropagation();
        let range = $(this).data('range');
        card.find('.range-option').css('background', 'none');
        $(this).css('background', '#f5f5f5');
        card.find('.card-menu-dropdown').hide();
        load_kpi(cfg, range);
    });

    card.find('.card-clickable').on('click', function() {
        frappe.set_route('query-report', cfg.report_name);
    });

    load_kpi(cfg, 'Last Month');
}

function load_kpi(cfg, date_range) {
    let card = $('#' + cfg.id);
    card.find('.value').text('Loading...');

    frappe.call({
        method: "frappe.desk.query_report.run",
        args: {
            report_name: cfg.report_name,
            filters: { date_range: date_range }
        },
        callback: function(r) {
            let value = 0;
            if (r.message && r.message.result && r.message.result.length) {
                let last_row = r.message.result[r.message.result.length - 1];
                value = last_row[cfg.value_field] || 0;
            }
            card.find('.value').text(value + cfg.suffix);
            let badge = card.find('.badge');
            if (cfg.good_if(value)) {
                badge.text('On track').css({background:'#e6f4ea', color:'#1e7e34'});
                card.find('.value').css('color', '#1e7e34');
            } else if (cfg.watch_if(value)) {
                badge.text('Watch').css({background:'#fff3cd', color:'#8a6d00'});
                card.find('.value').css('color', '#8a6d00');
            } else {
                badge.text('Alert').css({background:'#fce8e6', color:'#c0392b'});
                card.find('.value').css('color', '#c0392b');
            }
        }
    });
}
