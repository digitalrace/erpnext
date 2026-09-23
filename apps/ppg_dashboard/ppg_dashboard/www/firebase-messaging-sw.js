importScripts(
    "https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js"
);

importScripts(
    "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js"
);


firebase.initializeApp({

    apiKey: "YOUR_FIREBASE_API_KEY",

    authDomain:
        "push-notification-39f4b.firebaseapp.com",

    projectId:
        "push-notification-39f4b",

    storageBucket:
        "push-notification-39f4b.firebasestorage.app",

    messagingSenderId:
        "899078972772",

    appId:
        "1:899078972772:web:4e82e4c7e65209765a4671",

    measurementId:
        "G-XQVRWB7BGV"
});


const messaging =
    firebase.messaging();


messaging.onBackgroundMessage(
    function (payload) {

        const notification =
            payload.notification || {};

        const data =
            payload.data || {};

        const title =
            notification.title ||
            data.title ||
            "PPGPL ERP";

        const body =
            notification.body ||
            data.body ||
            "";

        self.registration.showNotification(
            title,
            {
                body: body,

                icon:
                    "/assets/ppg_dashboard/images/icon.png",

                data: {
                    link:
                        data.link ||
                        "/app"
                }
            }
        );
    }
);


self.addEventListener(
    "notificationclick",
    function (event) {

        event.notification.close();

        const link =
            event.notification.data?.link ||
            "/app";

        event.waitUntil(

            clients.matchAll({
                type: "window",
                includeUncontrolled: true
            }).then(function (clientList) {

                for (
                    const client of clientList
                ) {

                    if (
                        "focus" in client
                    ) {

                        client.navigate(link);

                        return client.focus();
                    }
                }

                if (
                    clients.openWindow
                ) {

                    return clients.openWindow(
                        link
                    );
                }
            })
        );
    }
);
