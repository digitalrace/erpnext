frappe.pages["employee-tracking"].on_page_load = function (wrapper) {
    new EmployeeTrackingPage(wrapper);
};

class EmployeeTrackingPage {
    constructor(wrapper) {
        this.wrapper = wrapper;
        this.page = frappe.ui.make_app_page({
            parent: wrapper,
            title: "Employee Tracking",
            single_column: true,
        });

        this.map = null;
        this.routeLine = null;
        this.historyMarkers = [];
        this.liveMarker = null;
        this.refreshTimer = null;
        this.refreshInProgress = false;
        this.firstLoad = true;

        this.render();
        this.loadLeaflet(() => {
            this.initMap();
            this.loadEmployees();
        });
    }

    render() {
        $(this.page.body).html(`
            <div class="et-page">

                <div class="et-topbar">
                    <div>
                        <div class="et-breadcrumb">Home <span>/</span> Employee Tracking</div>
                        <div class="et-title-row">
                            <div class="et-title-icon">◉</div>
                            <div>
                                <h1>Employee Tracking</h1>
                                <p>Live location tracking and movement history</p>
                            </div>
                        </div>
                    </div>

                    <div class="et-top-actions">
                        <span class="et-refresh-state">
                            <span class="et-refresh-dot"></span>
                            Auto Refresh: 30s
                        </span>
                        <button class="btn btn-default et-refresh-btn" title="Refresh now">
                            ↻
                        </button>
                    </div>
                </div>

                <div class="et-filter-card">
                    <div class="et-field et-employee-field">
                        <label>Employee</label>
                        <select class="form-control et-employee"></select>
                    </div>

                    <div class="et-field">
                        <label>From Date</label>
                        <input type="date" class="form-control et-from-date">
                    </div>

                    <div class="et-field">
                        <label>To Date</label>
                        <input type="date" class="form-control et-to-date">
                    </div>

                    <button class="btn btn-primary et-view-btn">
                        View Tracking
                    </button>
                </div>

                <div class="et-live-banner">
                    <span class="et-live-pulse"></span>
                    <strong class="et-live-text">Connecting to Traccar...</strong>
                    <span class="et-live-subtext">Waiting for live device data</span>
                    <span class="et-live-updated"></span>
                </div>

                <div class="et-kpis">
                    <div class="et-kpi status">
                        <div class="et-kpi-icon">●</div>
                        <div>
                            <div class="et-kpi-label">Status</div>
                            <div class="et-kpi-value et-status-value">—</div>
                            <div class="et-kpi-sub et-status-sub">Device</div>
                        </div>
                    </div>

                    <div class="et-kpi update">
                        <div class="et-kpi-icon">◷</div>
                        <div>
                            <div class="et-kpi-label">Last Update <span class="et-live-badge">LIVE</span></div>
                            <div class="et-kpi-value et-last-update">—</div>
                            <div class="et-kpi-sub et-last-age">—</div>
                        </div>
                    </div>

                    <div class="et-kpi speed">
                        <div class="et-kpi-icon">⌁</div>
                        <div>
                            <div class="et-kpi-label">Current Speed</div>
                            <div class="et-kpi-value et-speed-value">0.00 km/h</div>
                            <div class="et-kpi-sub et-motion-sub">Stationary</div>
                        </div>
                    </div>

                    <div class="et-kpi distance">
                        <div class="et-kpi-icon">⌖</div>
                        <div>
                            <div class="et-kpi-label">Total Distance</div>
                            <div class="et-kpi-value et-total-distance">0.000 KM</div>
                            <div class="et-kpi-sub">Selected date range</div>
                        </div>
                    </div>

                    <div class="et-kpi locations">
                        <div class="et-kpi-icon">●</div>
                        <div>
                            <div class="et-kpi-label">Locations</div>
                            <div class="et-kpi-value et-location-count">0</div>
                            <div class="et-kpi-sub">ERP snapshots</div>
                        </div>
                    </div>
                </div>

                <div class="et-main-grid">

                    <section class="et-history-card">
                        <div class="et-card-head">
                            <div>
                                <h3>Location History <span class="et-count-badge">0</span></h3>
                                <p>ERP location snapshots</p>
                            </div>
                            <button class="btn btn-default et-map-history-btn">Show on Map</button>
                        </div>

                        <div class="et-history-table-wrap">
                            <table class="et-history-table">
                                <thead>
                                    <tr>
                                        <th>Time</th>
                                        <th>Address</th>
                                        <th>Speed</th>
                                        <th>Distance</th>
                                    </tr>
                                </thead>
                                <tbody class="et-history-body">
                                    <tr>
                                        <td colspan="4" class="et-empty">Loading...</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div class="et-note">
                            <span class="et-note-icon">i</span>
                            <div>
                                <strong>Tracking note</strong>
                                <div>
                                    <span class="et-red-dot"></span> Red marker = current live Traccar location.
                                    <span class="et-blue-dot"></span> Blue markers = ERP history.
                                </div>
                            </div>
                        </div>
                    </section>

                    <section class="et-map-card">
                        <div class="et-map-head">
                            <div>
                                <h3>Live Map</h3>
                                <span class="et-map-source">Traccar + OpenStreetMap</span>
                            </div>
                            <button class="btn btn-default et-map-fullscreen">⛶ Full Screen</button>
                        </div>
                        <div class="et-map"></div>
                        <div class="et-map-legend">
                            <span><i class="et-legend-live"></i> Current Live</span>
                            <span><i class="et-legend-history"></i> Historical</span>
                            <span><i class="et-legend-route"></i> Route</span>
                        </div>
                    </section>

                    <aside class="et-side-card">
                        <div class="et-side-section live-details">
                            <div class="et-side-head">
                                <h3>Live Location Details</h3>
                                <span class="et-live-pill">LIVE</span>
                            </div>

                            <div class="et-detail-row">
                                <span>Time</span>
                                <strong class="et-detail-time">—</strong>
                            </div>
                            <div class="et-detail-row">
                                <span>Latitude</span>
                                <strong class="et-detail-lat">—</strong>
                            </div>
                            <div class="et-detail-row">
                                <span>Longitude</span>
                                <strong class="et-detail-lon">—</strong>
                            </div>
                            <div class="et-detail-row">
                                <span>Speed</span>
                                <strong class="et-detail-speed">0.00 km/h</strong>
                            </div>
                            <div class="et-detail-row address-row">
                                <span>Address</span>
                                <strong class="et-detail-address">—</strong>
                            </div>
                            <div class="et-detail-row">
                                <span>Device</span>
                                <strong class="et-detail-device">—</strong>
                            </div>
                            <div class="et-detail-row">
                                <span>Source</span>
                                <strong>Traccar (Live)</strong>
                            </div>
                        </div>

                        <div class="et-side-section">
                            <div class="et-side-head">
                                <h3>Daily Summary</h3>
                            </div>

                            <div class="et-summary-grid">
                                <div><span>Total Distance</span><strong class="et-s-total">0.000 KM</strong></div>
                                <div><span>Total Locations</span><strong class="et-s-locations">0</strong></div>
                                <div><span>Avg. Speed</span><strong class="et-s-avg-speed">0.00 km/h</strong></div>
                                <div><span>Max. Speed</span><strong class="et-s-max-speed">0.00 km/h</strong></div>
                                <div><span>First Location</span><strong class="et-s-first">—</strong></div>
                                <div><span>Last Location</span><strong class="et-s-last">—</strong></div>
                            </div>
                        </div>

                        <div class="et-side-section controls">
                            <button class="btn btn-primary et-refresh-live">↻ Refresh Live Location</button>
                            <div class="et-auto-note">
                                <span class="et-refresh-dot"></span>
                                Automatically refreshes every 30 seconds
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        `);

        this.setDefaultDates();
        this.bindEvents();
    }

    setDefaultDates() {
        const today = frappe.datetime.get_today();
        this.$from = this.page.body.find(".et-from-date");
        this.$to = this.page.body.find(".et-to-date");
        this.$from.val(today);
        this.$to.val(today);
    }

    bindEvents() {
        const root = this.page.body;

        root.on("click", ".et-view-btn", () => this.loadData());
        root.on("click", ".et-refresh-btn, .et-refresh-live", () => this.loadData(true));

        root.on("click", ".et-map-history-btn", () => {
            if (this.historyMarkers.length && this.map) {
                const group = L.featureGroup(this.historyMarkers);
                this.map.fitBounds(group.getBounds().pad(0.15));
            }
        });

        root.on("click", ".et-map-fullscreen", () => {
            const mapEl = this.page.body.find(".et-map")[0];
            if (!document.fullscreenElement) {
                mapEl.requestFullscreen?.();
            } else {
                document.exitFullscreen?.();
            }
            setTimeout(() => this.map?.invalidateSize(), 300);
        });

        root.on("change", ".et-employee", () => this.loadData());

        root.on("click", ".et-history-row", (e) => {
            const index = Number($(e.currentTarget).attr("data-index"));
            const marker = this.historyMarkers[index];
            if (marker && this.map) {
                this.map.setView(marker.getLatLng(), 17, { animate: true });
                marker.openPopup();
            }
        });
    }

    loadLeaflet(callback) {
        if (window.L) {
            callback();
            return;
        }

        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(css);

        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.onload = callback;
        script.onerror = () => {
            this.page.body.find(".et-map").html(
                '<div class="et-map-error">Unable to load map library.</div>'
            );
        };
        document.head.appendChild(script);
    }

    initMap() {
        const mapEl = this.page.body.find(".et-map")[0];

        this.map = L.map(mapEl, {
            zoomControl: true,
            preferCanvas: true,
        }).setView([26.1757, 72.9939], 14);

        // Fix Leaflet rendering when map is inside dashboard/card
        setTimeout(() => {
            this.map.invalidateSize(true);
        }, 500);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors",
        }).addTo(this.map);
    }

    loadEmployees() {
        frappe.call({
            method: "ppg_dashboard.api.tracking.get_tracking_employees",
        }).then((r) => {
            const employees = r.message || [];
            const select = this.page.body.find(".et-employee");

            select.empty();

            employees.forEach((emp) => {
                select.append(
                    $("<option>", {
                        value: emp.name,
                        text: `${emp.employee_name || emp.name} (${emp.name})`,
                    })
                );
            });

            if (!employees.length) {
                select.append(
                    $("<option>", {
                        value: "",
                        text: "No tracking-enabled employee",
                    })
                );
                return;
            }

            this.loadData();
            this.startAutoRefresh();
        }).catch((err) => {
            console.error("Employee tracking load error", err);
            frappe.msgprint("Unable to load tracking employees.");
        });
    }

    startAutoRefresh() {
        clearInterval(this.refreshTimer);

        this.refreshTimer = setInterval(() => {
            if (document.hidden) return;
            if (!this.page.body.find(".et-employee").val()) return;
            this.loadData(false, true);
        }, 30000);
    }

    loadData(force = false, silent = false) {
        if (this.refreshInProgress) return;

        const employee = this.page.body.find(".et-employee").val();
        const fromDate = this.page.body.find(".et-from-date").val();
        const toDate = this.page.body.find(".et-to-date").val();

        if (!employee || !fromDate || !toDate) return;

        if (fromDate > toDate) {
            frappe.msgprint("From Date cannot be after To Date.");
            return;
        }

        this.refreshInProgress = true;

        if (!silent) {
            this.setLoadingState();
        }

        frappe.call({
            method: "ppg_dashboard.api.tracking.get_tracking_data",
            args: {
                employee,
                from_date: fromDate,
                to_date: toDate,
            },
        }).then((r) => {
            const data = r.message || {};
            this.renderData(data);
        }).catch((err) => {
            console.error("Tracking data error", err);
            if (!silent) {
                frappe.msgprint("Unable to load tracking data.");
            }
        }).always(() => {
            this.refreshInProgress = false;
        });
    }

    setLoadingState() {
        this.page.body.find(".et-live-text").text("Updating live location...");
    }

    renderData(data) {
        const summary = data.summary || {};
        const live = data.live || {};
        const logs = data.logs || [];

        this.renderStatus(summary, live);
        this.renderHistory(logs);
        this.renderSummary(logs, summary);
        this.renderMap(logs, live);

        this.page.body.find(".et-live-updated").text(
            `Checked ${this.formatTime(new Date())}`
        );

        this.firstLoad = false;
    }

    renderStatus(summary, live) {
        const online = !!summary.online;
        const status = online ? "ONLINE" : "OFFLINE";

        this.page.body.find(".et-status-value")
            .text(status)
            .toggleClass("online", online)
            .toggleClass("offline", !online);

        this.page.body.find(".et-status-sub")
            .text(online ? "Traccar device active" : "No active device connection");

        const lastUpdate = summary.last_update || live.time || null;

        this.page.body.find(".et-last-update").text(
            lastUpdate ? this.formatTime(lastUpdate) : "—"
        );

        this.page.body.find(".et-last-age").text(
            lastUpdate ? this.relativeAge(lastUpdate) : "No update"
        );

        const speed = Number(
            live.speed != null ? live.speed : (summary.latest_speed || 0)
        );

        this.page.body.find(".et-speed-value")
            .text(`${speed.toFixed(2)} km/h`);

        this.page.body.find(".et-motion-sub")
            .text(speed > 1 ? "Moving" : "Stationary");

        this.page.body.find(".et-total-distance")
            .text(`${Number(summary.total_distance || 0).toFixed(3)} KM`);

        this.page.body.find(".et-location-count")
            .text(Number(summary.total_locations || 0));

        this.page.body.find(".et-live-text")
            .text(online ? "Live tracking active" : "Device offline");

        this.page.body.find(".et-live-subtext")
            .text(
                online
                    ? "Current position is coming directly from Traccar"
                    : "ERP history is still available below"
            );

        const lat = live.latitude;
        const lon = live.longitude;
        const address = live.address || summary.latest_address || "";

        this.page.body.find(".et-detail-time")
            .text(lastUpdate ? this.formatTime(lastUpdate) : "—");
        this.page.body.find(".et-detail-lat")
            .text(lat != null ? Number(lat).toFixed(6) : "—");
        this.page.body.find(".et-detail-lon")
            .text(lon != null ? Number(lon).toFixed(6) : "—");
        this.page.body.find(".et-detail-speed")
            .text(`${speed.toFixed(2)} km/h`);
        this.page.body.find(".et-detail-address")
            .text(address || "Address not available");
        this.page.body.find(".et-detail-device")
            .text(
                summary.device_id
                    ? `${summary.device_id} (${this.page.body.find(".et-employee").val()})`
                    : "—"
            );
    }

    renderHistory(logs) {
        const body = this.page.body.find(".et-history-body");
        body.empty();

        this.page.body.find(".et-count-badge").text(logs.length);

        if (!logs.length) {
            body.html(`
                <tr>
                    <td colspan="4" class="et-empty">No tracking records for this date range.</td>
                </tr>
            `);
            return;
        }

        [...logs].reverse().forEach((log, reversedIndex) => {
            const actualIndex = logs.length - 1 - reversedIndex;

            body.append(`
                <tr class="et-history-row" data-index="${actualIndex}">
                    <td class="et-time-cell">${this.formatTime(log.time)}</td>
                    <td class="et-address-cell">${this.escapeHtml(log.address || "Address not available")}</td>
                    <td>${Number(log.speed || 0).toFixed(2)}</td>
                    <td>${Number(log.distance || 0).toFixed(3)} KM</td>
                </tr>
            `);
        });
    }

    renderSummary(logs, summary) {
        const speeds = logs.map((x) => Number(x.speed || 0));
        const avg = speeds.length
            ? speeds.reduce((a, b) => a + b, 0) / speeds.length
            : 0;
        const max = speeds.length ? Math.max(...speeds) : 0;

        this.page.body.find(".et-s-total")
            .text(`${Number(summary.total_distance || 0).toFixed(3)} KM`);
        this.page.body.find(".et-s-locations")
            .text(logs.length);
        this.page.body.find(".et-s-avg-speed")
            .text(`${avg.toFixed(2)} km/h`);
        this.page.body.find(".et-s-max-speed")
            .text(`${max.toFixed(2)} km/h`);
        this.page.body.find(".et-s-first")
            .text(logs.length ? this.formatTime(logs[0].time) : "—");
        this.page.body.find(".et-s-last")
            .text(logs.length ? this.formatTime(logs[logs.length - 1].time) : "—");
    }

    renderMap(logs, live) {
        if (!this.map) return;

        this.historyMarkers.forEach((marker) => marker.remove());
        this.historyMarkers = [];

        if (this.routeLine) {
            this.routeLine.remove();
            this.routeLine = null;
        }

        const historyPoints = [];

        logs.forEach((log, index) => {
            const lat = Number(log.latitude);
            const lon = Number(log.longitude);

            if (!lat || !lon) return;

            const marker = L.circleMarker([lat, lon], {
                radius: 6,
                weight: 2,
                fillOpacity: 0.9,
            }).addTo(this.map);

            marker.bindPopup(`
                <div class="et-popup">
                    <strong>${this.escapeHtml(this.formatTime(log.time))}</strong>
                    <hr>
                    <b>Address:</b> ${this.escapeHtml(log.address || "Address not available")}<br>
                    <b>Speed:</b> ${Number(log.speed || 0).toFixed(2)} km/h<br>
                    <b>Distance:</b> ${Number(log.distance || 0).toFixed(3)} KM<br>
                    <b>Latitude:</b> ${lat.toFixed(6)}<br>
                    <b>Longitude:</b> ${lon.toFixed(6)}
                </div>
            `);

            this.historyMarkers[index] = marker;
            historyPoints.push([lat, lon]);
        });

        if (historyPoints.length >= 2) {
            this.routeLine = L.polyline(historyPoints, {
                weight: 4,
                opacity: 0.8,
            }).addTo(this.map);
        }

        const liveLat = Number(live.latitude);
        const liveLon = Number(live.longitude);

        if (live.latitude != null && live.longitude != null) {
            const speed = Number(live.speed || 0);
            const liveIcon = L.divIcon({
                className: "et-live-marker-wrapper",
                html: `<div class="et-live-marker"><span></span></div>`,
                iconSize: [26, 26],
                iconAnchor: [13, 13],
            });

            if (this.liveMarker) {
                this.liveMarker.setLatLng([liveLat, liveLon]);
                this.liveMarker.setIcon(liveIcon);
            } else {
                this.liveMarker = L.marker([liveLat, liveLon], {
                    icon: liveIcon,
                    zIndexOffset: 1000,
                }).addTo(this.map);
            }

            this.liveMarker.bindPopup(`
                <div class="et-popup et-live-popup">
                    <span class="et-popup-live">LIVE</span>
                    <strong>${this.escapeHtml(this.formatTime(live.time))}</strong>
                    <hr>
                    <b>Current Location</b><br>
                    <b>Speed:</b> ${speed.toFixed(2)} km/h<br>
                    <b>Address:</b> ${this.escapeHtml(live.address || "Address not available")}<br>
                    <b>Latitude:</b> ${liveLat.toFixed(6)}<br>
                    <b>Longitude:</b> ${liveLon.toFixed(6)}
                </div>
            `);
        } else if (this.liveMarker) {
            this.liveMarker.remove();
            this.liveMarker = null;
        }

        const allPoints = [
            ...historyPoints,
            ...(live.latitude != null && live.longitude != null
                ? [[liveLat, liveLon]]
                : []),
        ];

        if (this.firstLoad && allPoints.length) {
            this.map.fitBounds(L.latLngBounds(allPoints).pad(0.18));
        }
    }

    formatTime(value) {
        if (!value) return "—";

        const date = value instanceof Date ? value : new Date(String(value).replace(" ", "T"));

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleString("en-IN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
        });
    }

    relativeAge(value) {
        const date = new Date(String(value).replace(" ", "T"));
        if (Number.isNaN(date.getTime())) return "—";

        const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

        if (seconds < 10) return "Just now";
        if (seconds < 60) return `${seconds}s ago`;

        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;

        const hours = Math.floor(minutes / 60);
        return `${hours}h ${minutes % 60}m ago`;
    }

    escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }
}

