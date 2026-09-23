importScripts(
    "https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js"
);

importScripts(
    "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js"
);

firebase.initializeApp({
    apiKey: "AIzaSyASR6kiw3C07OIGiHvru3vDSShOsXgFae8",
    authDomain: "push-notification-39f4b.firebaseapp.com",
    projectId: "push-notification-39f4b",
    storageBucket: "push-notification-39f4b.firebasestorage.app",
    messagingSenderId: "899078972772",
    appId: "1:899078972772:web:4e82e4c7e65209765a4671",
    measurementId: "G-XQVRWB7BGV"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {

    console.log(
        "PPGPL FCM: Background message:",
        payload
    );

    const notificationTitle =
        payload.notification?.title ||
        "PPGPL ERP";

    const notificationOptions = {
        body:
            payload.notification?.body ||
            "",
        icon:
            "/assets/ppg_dashboard/images/logo.png",

        data:
            payload.data || {}
    };

    self.registration.showNotification(
        notificationTitle,
        notificationOptions
    );

});


self.addEventListener("notificationclick", function(event) {

    console.log(
        "PPGPL FCM: Notification clicked:",
        event.notification
    );

    const data =
        event.notification.data || {};

    console.log(
        "PPGPL FCM: Notification data:",
        data
    );

    event.notification.close();

    let targetUrl =
        data.link ||
        data.route ||
        data.url ||
        "";

    /*
     * If backend supplied document_type + document_name,
     * construct the ERPNext document route dynamically.
     */
    if (
        !targetUrl &&
        data.document_type &&
        data.document_name
    ) {

        const doctype =
            data.document_type
                .trim()
                .toLowerCase()
                .replace(/\s+/g, "-");

        const docname =
            data.document_name.trim();

        targetUrl =
            "/app/" +
            doctype +
            "/" +
            encodeURIComponent(docname);
    }

    /*
     * Absolute URL -> keep it.
     * Relative URL -> convert to same ERP site.
     */
    if (targetUrl) {

        try {

            targetUrl =
                new URL(
                    targetUrl,
                    self.location.origin
                ).href;

        } catch (error) {

            console.error(
                "PPGPL FCM: Invalid notification URL:",
                targetUrl,
                error
            );

            targetUrl =
                self.location.origin + "/app";
        }

    } else {

        targetUrl =
            self.location.origin + "/app";
    }

    console.log(
        "PPGPL FCM: Opening URL:",
        targetUrl
    );

    event.waitUntil(

        clients.matchAll({
            type: "window",
            includeUncontrolled: true
        })

        .then(function(clientList) {

            for (const client of clientList) {

                if ("focus" in client) {

                    return client
                        .navigate(targetUrl)
                        .then(function() {
                            return client.focus();
                        });

                }
            }

            if ("openWindow" in clients) {

                return clients.openWindow(
                    targetUrl
                );
            }

        })

    );

});

