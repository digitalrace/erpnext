/* PPG_ROLE_BASED_DESK_BUTTON_V3 */
(function () {
    if (window.__ppgRoleDeskButtonV3) return;
    window.__ppgRoleDeskButtonV3 = true;

    function dashboardType() {
        const roles = window.frappe?.boot?.user?.roles || [];

        // Management takes priority, even if the user also has HR roles.
        if (
            roles.includes("Management Dashboard") ||
            roles.includes("System Manager")
        ) return "management";

        if (
            roles.includes("HR Manager") ||
            roles.includes("HR User")
        ) return "hr";

        return null;
    }

    function placeButton() {
        if (!window.frappe || !window.jQuery) return;

        const type = dashboardType();
        let item = document.getElementById("custom-hr-btn");
        // Replace the legacy centered DIV with the navigation bar item.
        if (item && item.tagName !== "LI") {
            item.remove();
            item = null;
        }

        if (!type) {
            if (item) item.remove();
            return;
        }

        if (!item) {
            item = document.createElement("li");
            item.id = "custom-hr-btn";
            item.className = "nav-item";
            item.style.cssText =
                "display:inline-flex;align-items:center;margin-right:8px;";

            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "btn btn-primary btn-sm";
            btn.style.cssText =
                "background:#087f8c;color:white;border:0;border-radius:8px;" +
                "padding:7px 13px;font-weight:600;white-space:nowrap;cursor:pointer;";

            btn.addEventListener("click", function () {
                if (dashboardType()) {
                    window.frappe.set_route("management-dashboard");
                }
            });

            item.appendChild(btn);
        }

        const btn = item.querySelector("button");
        const label = type === "management"
            ? "Management Dashboard"
            : "HR Dashboard";

        if (btn && btn.textContent !== label) {
            btn.textContent = label;
        }

        const bell = document.querySelector(".desktop-notifications");
        if (bell?.parentElement &&
            (item.parentElement !== bell.parentElement ||
             item.nextElementSibling !== bell)) {
            bell.parentElement.insertBefore(item, bell);
        }
    }

    function start() {
        placeButton();

        new MutationObserver(placeButton).observe(document.body, {
            childList: true,
            subtree: true
        });

        if (window.frappe?.router) {
            window.frappe.router.on("change", function () {
                setTimeout(placeButton, 300);
                setTimeout(placeButton, 1000);
            });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})();


/* PPG_SERVICE_COMPLAINT_COLORS_PERMANENT */
(function () {
    if (window.__ppgComplaintColorsInstalled) return;
    window.__ppgComplaintColorsInstalled = true;

    const palette = {
        "OPEN": ["#166534", "#14532d"],
        "CLOSE": ["#374151", "#1f2937"],
        "OUT OF WARRANTY": ["#92400e", "#78350f"],
        "FORWARD": ["#1e40af", "#1e3a8a"],
        "DO NOT CONTACT": ["#991b1b", "#7f1d1d"]
    };

    const normalize = value =>
        (value || "").trim().replace(/\s+/g, " ").toUpperCase();

    function paint(el, value) {
        const colors = palette[normalize(value)];
        if (!el || !colors) return;

        el.style.setProperty("background-color", colors[0], "important");
        el.style.setProperty("border-color", colors[1], "important");
        el.style.setProperty("color", "#ffffff", "important");
    }

    function applyColors() {
        if (!location.pathname.includes("/desk/service-complaint")) return;

        document.querySelectorAll(
            ".indicator-pill, .indicator-pill-right"
        ).forEach(el => paint(el, el.innerText || el.textContent));

        document.querySelectorAll(
            '.frappe-control[data-fieldname="status"] select'
        ).forEach(select => {
            paint(select, select.value);

            Array.from(select.options).forEach(option => {
                const colors = palette[normalize(option.value || option.textContent)];
                if (!colors) return;

                option.style.setProperty("background-color", colors[0], "important");
                option.style.setProperty("color", "#ffffff", "important");
            });

            if (!select.dataset.ppgComplaintColorListener) {
                select.addEventListener("change", () => paint(select, select.value));
                select.dataset.ppgComplaintColorListener = "1";
            }
        });
    }

    function start() {
        applyColors();

        if (document.body && !window.__ppgComplaintColorObserver) {
            window.__ppgComplaintColorObserver =
                new MutationObserver(applyColors);

            window.__ppgComplaintColorObserver.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }

        if (window.frappe?.router?.on &&
            !window.__ppgComplaintColorRouteBound) {
            window.__ppgComplaintColorRouteBound = true;
            window.frappe.router.on("change", () => {
                setTimeout(applyColors, 150);
            });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})();


/* PPG_EMPLOYEE_CHECKIN_IN_OUT_COLORS */
(function () {
    if (window.__ppgCheckinColorsInstalled) return;
    window.__ppgCheckinColorsInstalled = true;

    const palette = {
        "IN":  ["#166534", "#14532d"],
        "OUT": ["#991b1b", "#7f1d1d"]
    };

    function paint(el, value) {
        const colors = palette[(value || "").trim().toUpperCase()];
        if (!el || !colors) return;

        el.style.setProperty("background-color", colors[0], "important");
        el.style.setProperty("border-color", colors[1], "important");
        el.style.setProperty("color", "#ffffff", "important");
    }

    function applyColors() {
        if (!location.pathname.includes("/desk/employee-checkin")) return;

        document.querySelectorAll(
            ".indicator-pill, .indicator-pill-right"
        ).forEach(el => paint(el, el.innerText || el.textContent));

        document.querySelectorAll(
            '.frappe-control[data-fieldname="log_type"] select'
        ).forEach(select => {
            paint(select, select.value);

            Array.from(select.options).forEach(option => {
                const colors = palette[(option.value || "").trim().toUpperCase()];
                if (!colors) return;

                option.style.backgroundColor = colors[0];
                option.style.color = "#ffffff";
            });

            if (!select.dataset.ppgCheckinColorListener) {
                select.addEventListener("change", () => paint(select, select.value));
                select.dataset.ppgCheckinColorListener = "1";
            }
        });
    }

    function start() {
        applyColors();

        if (document.body && !window.__ppgCheckinColorObserver) {
            window.__ppgCheckinColorObserver =
                new MutationObserver(applyColors);

            window.__ppgCheckinColorObserver.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }

        if (window.frappe?.router?.on &&
            !window.__ppgCheckinColorRouteBound) {
            window.__ppgCheckinColorRouteBound = true;
            window.frappe.router.on("change", () => setTimeout(applyColors, 150));
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})();

