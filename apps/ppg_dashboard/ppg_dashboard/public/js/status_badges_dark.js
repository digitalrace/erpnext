(function () {
  var id = "ppg-dark-status-badges";
  if (document.getElementById(id)) return;

  var css = `
    .indicator-pill.red,
    .indicator-pill-right.red {
      background: #991b1b !important;
      background-color: #991b1b !important;
      color: #ffffff !important;
      border: 1px solid #7f1d1d !important;
      font-weight: 600 !important;
    }

    .indicator-pill.orange,
    .indicator-pill-right.orange {
      background: #92400e !important;
      background-color: #92400e !important;
      color: #ffffff !important;
      border: 1px solid #78350f !important;
      font-weight: 600 !important;
    }

    .indicator-pill.green,
    .indicator-pill-right.green {
      background: #166534 !important;
      background-color: #166534 !important;
      color: #ffffff !important;
      border: 1px solid #14532d !important;
      font-weight: 600 !important;
    }

    .indicator-pill.blue,
    .indicator-pill-right.blue {
      background: #1e40af !important;
      background-color: #1e40af !important;
      color: #ffffff !important;
      border: 1px solid #1e3a8a !important;
      font-weight: 600 !important;
    }

    .indicator-pill.gray,
    .indicator-pill-right.gray,
    .indicator-pill.grey,
    .indicator-pill-right.grey {
      background: #374151 !important;
      background-color: #374151 !important;
      color: #ffffff !important;
      border: 1px solid #1f2937 !important;
      font-weight: 600 !important;
    }

    .indicator-pill.purple,
    .indicator-pill-right.purple {
      background: #6b21a8 !important;
      background-color: #6b21a8 !important;
      color: #ffffff !important;
      border: 1px solid #581c87 !important;
    }

    .indicator-pill.yellow,
    .indicator-pill-right.yellow {
      background: #854d0e !important;
      background-color: #854d0e !important;
      color: #ffffff !important;
      border: 1px solid #713f12 !important;
    }
  `;

  var style = document.createElement("style");
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
})();


/* PPG_SERVICE_COMPLAINT_STATUS_COLORS */
(function () {
    if (window.__ppgComplaintColorsInstalled) return;
    window.__ppgComplaintColorsInstalled = true;

    const colors = {
        "OPEN": ["#166534", "#14532d"],
        "CLOSE": ["#374151", "#1f2937"],
        "OUT OF WARRANTY": ["#92400e", "#78350f"],
        "FORWARD": ["#1e40af", "#1e3a8a"],
        "DO NOT CONTACT": ["#991b1b", "#7f1d1d"]
    };

    function normalize(value) {
        return (value || "").trim().replace(/\s+/g, " ").toUpperCase();
    }

    function paint(el, value) {
        const color = colors[normalize(value)];
        if (!el || !color) return;

        el.style.setProperty("background-color", color[0], "important");
        el.style.setProperty("border-color", color[1], "important");
        el.style.setProperty("color", "#ffffff", "important");
    }

    function apply() {
        if (!location.pathname.includes("/desk/service-complaint")) return;

        document.querySelectorAll(
            ".indicator-pill, .indicator-pill-right"
        ).forEach(el => paint(el, el.innerText || el.textContent));

        document.querySelectorAll(
            '.frappe-control[data-fieldname="status"] select'
        ).forEach(select => {
            paint(select, select.value);

            Array.from(select.options).forEach(option => {
                const color = colors[normalize(option.value || option.textContent)];
                if (color) {
                    option.style.setProperty("background-color", color[0]);
                    option.style.setProperty("color", "#ffffff");
                }
            });

            if (!select.dataset.ppgColorListener) {
                select.addEventListener("change", () => paint(select, select.value));
                select.dataset.ppgColorListener = "1";
            }
        });
    }

    function start() {
        apply();

        if (!document.body) return;

        window.__ppgComplaintColorObserver?.disconnect();
        window.__ppgComplaintColorObserver = new MutationObserver(apply);
        window.__ppgComplaintColorObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });

        if (window.frappe?.router?.on) {
            window.frappe.router.on("change", () => setTimeout(apply, 100));
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})();
