(function () {

    function initPPGPortal() {

        // Only homepage
        if (window.location.pathname !== "/") {
            return;
        }

        // Find the existing portal content
        const pageContent =
            document.querySelector(".page-content") ||
            document.querySelector(".page_content") ||
            document.querySelector("main");

        if (!pageContent) {
            return;
        }

        // Already converted
        if (document.querySelector(".ppg-modern-portal")) {
            return;
        }

        /*
         * IMPORTANT:
         * Read the EXISTING ERPNext portal links.
         * We do not create/change backend routes.
         */
        const links = Array.from(document.querySelectorAll("a"));

        function findPortalLink(text) {
            const link = links.find(function (a) {
                return a.textContent.trim().toLowerCase() === text.toLowerCase();
            });

            return link ? link.href : null;
        }

        const rfq = findPortalLink("Request for Quotations");
        const supplierQuotation = findPortalLink("Supplier Quotation");
        const purchaseOrders = findPortalLink("Purchase Orders");
        const purchaseInvoices = findPortalLink("Purchase Invoices");
        const myAccount = findPortalLink("My Account") || "/me";

        /*
         * If ERPNext hasn't rendered its original portal menu yet,
         * wait and try again.
         */
        if (!rfq && !supplierQuotation && !purchaseOrders && !purchaseInvoices) {
            return;
        }

        const portal = document.createElement("div");
        portal.className = "ppg-modern-portal";

        portal.innerHTML = `
            <div class="ppg-container">

                <div class="ppg-welcome">
                    <h1>Welcome to the Portal</h1>
                    <p>
                        Manage your quotations, orders and invoices from one place.
                    </p>
                </div>

                <div class="ppg-section-title">
                    Quick Access
                </div>

                <div class="ppg-grid">

                    ${rfq ? `
                    <a href="${rfq}" class="ppg-card">
                        <div class="ppg-icon">
                            <svg viewBox="0 0 24 24" fill="none"
                                 stroke="currentColor" stroke-width="1.8">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16
                                         a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <path d="M14 2v6h6"/>
                                <path d="M8 13h8"/>
                                <path d="M8 17h5"/>
                            </svg>
                        </div>

                        <div class="ppg-card-content">
                            <div class="ppg-card-title">
                                Request for Quotations
                            </div>
                            <div class="ppg-card-description">
                                View and respond to quotation requests from the company.
                            </div>
                        </div>

                        <span class="ppg-arrow">›</span>
                    </a>
                    ` : ""}

                    ${supplierQuotation ? `
                    <a href="${supplierQuotation}" class="ppg-card">
                        <div class="ppg-icon">
                            <svg viewBox="0 0 24 24" fill="none"
                                 stroke="currentColor" stroke-width="1.8">
                                <path d="M3 6h18"/>
                                <path d="M5 6v14h14V6"/>
                                <path d="M8 6V4a2 2 0 0 1 2-2h4
                                         a2 2 0 0 1 2 2v2"/>
                                <path d="M8 11h8"/>
                                <path d="M8 15h5"/>
                            </svg>
                        </div>

                        <div class="ppg-card-content">
                            <div class="ppg-card-title">
                                Supplier Quotation
                            </div>
                            <div class="ppg-card-description">
                                View and manage quotations submitted to the company.
                            </div>
                        </div>

                        <span class="ppg-arrow">›</span>
                    </a>
                    ` : ""}

                    ${purchaseOrders ? `
                    <a href="${purchaseOrders}" class="ppg-card">
                        <div class="ppg-icon">
                            <svg viewBox="0 0 24 24" fill="none"
                                 stroke="currentColor" stroke-width="1.8">
                                <path d="M4 4h16v16H4z"/>
                                <path d="M8 8h8"/>
                                <path d="M8 12h8"/>
                                <path d="M8 16h5"/>
                            </svg>
                        </div>

                        <div class="ppg-card-content">
                            <div class="ppg-card-title">
                                Purchase Orders
                            </div>
                            <div class="ppg-card-description">
                                View purchase orders and their current status.
                            </div>
                        </div>

                        <span class="ppg-arrow">›</span>
                    </a>
                    ` : ""}

                    ${purchaseInvoices ? `
                    <a href="${purchaseInvoices}" class="ppg-card">
                        <div class="ppg-icon">
                            <svg viewBox="0 0 24 24" fill="none"
                                 stroke="currentColor" stroke-width="1.8">
                                <path d="M5 3h14v18l-3-2-4 2-4-2-3 2z"/>
                                <path d="M8 8h8"/>
                                <path d="M8 12h8"/>
                                <path d="M8 16h5"/>
                            </svg>
                        </div>

                        <div class="ppg-card-content">
                            <div class="ppg-card-title">
                                Purchase Invoices
                            </div>
                            <div class="ppg-card-description">
                                View purchase invoices and related information.
                            </div>
                        </div>

                        <span class="ppg-arrow">›</span>
                    </a>
                    ` : ""}

                </div>

                <a href="${myAccount}" class="ppg-account">
                    <div>
                        <div class="ppg-account-title">
                            My Account
                        </div>

                        <div class="ppg-account-text">
                            Manage your profile and account information.
                        </div>
                    </div>

                    <span class="ppg-account-button">
                        Open My Account
                    </span>
                </a>

            </div>
        `;

        /*
         * Only replace homepage content.
         * Existing ERPNext links remain untouched.
         */
        pageContent.innerHTML = "";
        pageContent.appendChild(portal);
    }


    function addPPGStyles() {

        if (document.getElementById("ppg-portal-style")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "ppg-portal-style";

        style.innerHTML = `

            .ppg-modern-portal {
                width: 100%;
                background: #f7f8fa;
                min-height: 650px;
            }

            .ppg-container {
                max-width: 1180px;
                margin: auto;
                padding: 40px 28px 60px;
            }

            .ppg-welcome {
                margin-bottom: 32px;
            }

            .ppg-welcome h1 {
                margin: 0 0 8px;
                font-size: 30px;
                font-weight: 600;
                color: #172033;
            }

            .ppg-welcome p {
                margin: 0;
                font-size: 15px;
                color: #687386;
            }

            .ppg-section-title {
                margin-bottom: 16px;
                font-size: 17px;
                font-weight: 600;
                color: #172033;
            }

            .ppg-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 18px;
            }

            .ppg-card {
                min-height: 126px;
                padding: 23px;
                display: flex;
                align-items: center;
                gap: 17px;

                background: #ffffff;
                border: 1px solid #e3e7ed;
                border-radius: 12px;

                text-decoration: none !important;

                box-shadow:
                    0 2px 7px rgba(23,32,51,.04);

                transition:
                    transform .18s ease,
                    box-shadow .18s ease,
                    border-color .18s ease;
            }

            .ppg-card:hover {
                transform: translateY(-2px);
                border-color: #d3d9e2;
                box-shadow:
                    0 9px 25px rgba(23,32,51,.09);
            }

            .ppg-icon {
                width: 52px;
                height: 52px;
                min-width: 52px;

                display: flex;
                align-items: center;
                justify-content: center;

                border-radius: 11px;
                background: #f1f3f6;
                color: #344054;
            }

            .ppg-icon svg {
                width: 25px;
                height: 25px;
            }

            .ppg-card-content {
                flex: 1;
            }

            .ppg-card-title {
                margin-bottom: 6px;
                font-size: 16px;
                font-weight: 600;
                color: #172033;
            }

            .ppg-card-description {
                font-size: 13px;
                line-height: 1.5;
                color: #687386;
            }

            .ppg-arrow {
                color: #9aa4b2;
                font-size: 23px;
            }

            .ppg-account {
                margin-top: 28px;
                padding: 20px 23px;

                display: flex;
                align-items: center;
                justify-content: space-between;

                background: #ffffff;
                border: 1px solid #e3e7ed;
                border-radius: 12px;

                text-decoration: none !important;
            }

            .ppg-account-title {
                margin-bottom: 4px;
                font-size: 15px;
                font-weight: 600;
                color: #172033;
            }

            .ppg-account-text {
                font-size: 13px;
                color: #687386;
            }

            .ppg-account-button {
                padding: 9px 17px;
                border: 1px solid #d5dae2;
                border-radius: 7px;
                background: #fff;
                color: #344054;
                font-size: 13px;
                font-weight: 500;
            }

            .ppg-account:hover .ppg-account-button {
                background: #f7f8fa;
            }

            @media (max-width: 768px) {

                .ppg-container {
                    padding: 28px 16px 45px;
                }

                .ppg-welcome h1 {
                    font-size: 25px;
                }

                .ppg-grid {
                    grid-template-columns: 1fr;
                }

                .ppg-account {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 15px;
                }
            }

        `;

        document.head.appendChild(style);
    }


    function start() {

        addPPGStyles();

        /*
         * Frappe portal content can render asynchronously.
         * Try several times, without touching other pages.
         */
        initPPGPortal();

        setTimeout(initPPGPortal, 300);
        setTimeout(initPPGPortal, 800);
        setTimeout(initPPGPortal, 1500);
        setTimeout(initPPGPortal, 2500);
    }


    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }

})();
