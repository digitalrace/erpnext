/*
 * PPGPL ERPNext PWA
 * Firebase Push Notifications
 *
 * PUSH NOTIFICATION ONLY
 *
 * No logout patch.
 * No frappe.call interceptor.
 * No logout handling.
 */

(function () {

    "use strict";

    // =========================================================
    // FIREBASE CONFIG
    // =========================================================

    const firebaseConfig = {
        apiKey: "AIzaSyASR6kiw3C07OIGiHvru3vDSShOsXgFae8",
        authDomain: "push-notification-39f4b.firebaseapp.com",
        projectId: "push-notification-39f4b",
        storageBucket: "push-notification-39f4b.firebasestorage.app",
        messagingSenderId: "899078972772",
        appId: "1:899078972772:web:4e82e4c7e65209765a4671",
        measurementId: "G-XQVRWB7BGV"
    };

    // =========================================================
    // STATE
    // =========================================================

    let messaging = null;
    let serviceWorkerRegistration = null;


    // =========================================================
    // FIREBASE INITIALIZATION
    // =========================================================

    async function initializeFirebase() {

        try {

            if (typeof firebase === "undefined") {

                console.error(
                    "PPGPL FCM: Firebase SDK not loaded."
                );

                return false;
            }

            if (!firebase.apps.length) {

                firebase.initializeApp(
                    firebaseConfig
                );
            }

            messaging = firebase.messaging();

            console.log(
                "PPGPL FCM: Firebase initialized."
            );

            return true;

        } catch (error) {

            console.error(
                "PPGPL FCM: Firebase initialization failed:",
                error
            );

            return false;
        }
    }


    // =========================================================
    // SERVICE WORKER
    // =========================================================

    async function registerServiceWorker() {

        if (!("serviceWorker" in navigator)) {

            console.warn(
                "PPGPL FCM: Service Worker not supported."
            );

            return null;
        }

        try {

            serviceWorkerRegistration =
                await navigator.serviceWorker.register(
                    "/assets/ppg_dashboard/js/firebase-messaging-sw.js"
                );

            console.log(
                "PPGPL FCM: Service Worker registered.",
                serviceWorkerRegistration
            );

            return serviceWorkerRegistration;

        } catch (error) {

            console.error(
                "PPGPL FCM: Service Worker registration failed:",
                error
            );

            return null;
        }
    }


    // =========================================================
    // REGISTER TOKEN IN ERPNext
    // =========================================================

    async function registerToken(token) {

        if (!token) {

            console.warn(
                "PPGPL FCM: No token available."
            );

            return;
        }

        try {

            const response = await frappe.call({

                method:
                    "ppg_dashboard.fcm.register_fcm_token",

                args: {

                    token: token,

                    device_type: "PWA",

                    device_id:
                        navigator.userAgent
                }

            });

            console.log(
                "PPGPL FCM: Token registered in ERPNext.",
                response
            );

            localStorage.setItem(
                "ppg_fcm_token",
                token
            );

        } catch (error) {

            console.error(
                "PPGPL FCM: Token registration failed:",
                error
            );
        }
    }


    // =========================================================
    // GET FCM TOKEN
    // =========================================================

    async function syncToken() {

        try {

            if (!messaging) {

                console.warn(
                    "PPGPL FCM: Messaging not initialized."
                );

                return;
            }

            if (!serviceWorkerRegistration) {

                await registerServiceWorker();
            }

            const tokenOptions = {

                serviceWorkerRegistration:
                    serviceWorkerRegistration

            };

            

            const token =
                await messaging.getToken(
                    tokenOptions
                );

            console.log(
                "PPGPL FCM: FCM token:",
                token
            );

            if (token) {

                await registerToken(token);
            }

        } catch (error) {

            console.error(
                "PPGPL FCM: getToken failed:",
                error
            );
        }
    }


    // =========================================================
    // NOTIFICATION PERMISSION
    // =========================================================

    async function requestNotificationPermission() {

        try {

            const permission =
                await Notification.requestPermission();

            console.log(
                "PPGPL FCM: Notification permission:",
                permission
            );

            if (permission === "granted") {

                await syncToken();

                removePermissionButton();

            } else {

                console.log(
                    "PPGPL FCM: Notification permission not granted."
                );
            }

        } catch (error) {

            console.error(
                "PPGPL FCM: Notification permission error:",
                error
            );
        }
    }


    // =========================================================
    // ENABLE NOTIFICATIONS BUTTON
    // =========================================================

    function removePermissionButton() {

        const existing =
            document.getElementById(
                "ppg-fcm-enable"
            );

        if (existing) {

            existing.remove();
        }
    }


    function createPermissionButton() {

        if (
            !("Notification" in window) ||
            Notification.permission !== "default"
        ) {

            return;
        }

        if (
            document.getElementById(
                "ppg-fcm-enable"
            )
        ) {

            return;
        }

        const button =
            document.createElement("button");

        button.id =
            "ppg-fcm-enable";

        button.innerText =
            "🔔 Enable Notifications";

        button.style.position =
            "fixed";

        button.style.bottom =
            "20px";

        button.style.right =
            "20px";

        button.style.zIndex =
            "99999";

        button.style.padding =
            "12px 18px";

        button.style.border =
            "none";

        button.style.borderRadius =
            "8px";

        button.style.background =
            "#2490ef";

        button.style.color =
            "#ffffff";

        button.style.fontSize =
            "14px";

        button.style.fontWeight =
            "600";

        button.style.cursor =
            "pointer";

        button.style.boxShadow =
            "0 3px 10px rgba(0,0,0,0.25)";

        button.addEventListener(
            "click",
            requestNotificationPermission
        );

        document.body.appendChild(
            button
        );

        console.log(
            "PPGPL FCM: Enable Notifications button created."
        );
    }


    // =========================================================
    // FOREGROUND MESSAGES
    // =========================================================

    function setupForegroundMessages() {

        if (!messaging) {

            return;
        }

        messaging.onMessage(
            function (payload) {

                console.log(
                    "PPGPL FCM: Foreground message:",
                    payload
                );

                const title =
                    payload.notification?.title ||
                    "PPGPL ERP";

                const body =
                    payload.notification?.body ||
                    "";

                if (
                    "Notification" in window &&
                    Notification.permission ===
                        "granted"
                ) {

                    new Notification(
                        title,
                        {

                            body: body,

                            icon:
                                "/assets/ppg_dashboard/images/logo.png"
                        }
                    );
                }
            }
        );
    }


    // =========================================================
    // START
    // =========================================================

    async function start() {

        if (!("Notification" in window)) {

            console.warn(
                "PPGPL FCM: Notifications not supported."
            );

            return;
        }

        if (!await initializeFirebase()) {

            return;
        }

        await registerServiceWorker();

        setupForegroundMessages();

        if (
            Notification.permission ===
            "granted"
        ) {

            await syncToken();

            return;
        }

        if (
            Notification.permission ===
            "default"
        ) {

            createPermissionButton();
        }
    }


    // =========================================================
    // FRAPPE READY
    // =========================================================

    function startForLoggedInUser() {

        if (
            window.frappe &&
            frappe.session &&
            frappe.session.user &&
            frappe.session.user !== "Guest"
        ) {

            start();
        }
    }


    if (
        typeof frappe !== "undefined" &&
        frappe.ready
    ) {

        frappe.ready(
            startForLoggedInUser
        );

    } else {

        window.addEventListener(
            "load",
            startForLoggedInUser
        );
    }

})();
