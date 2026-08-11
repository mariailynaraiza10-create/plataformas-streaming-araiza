// ==========================================
// SERVICE WORKER
// ==========================================

self.addEventListener(
    "push",
    function (event) {

        let datos = {};

        try {

            datos =
                event.data
                    ? event.data.json()
                    : {};

        } catch (error) {

            datos = {
                title: "Streaming Araiza",
                body: "Tienes una nueva notificación."
            };
        }

        const titulo =
            datos.title ||
            "Streaming Araiza";

        const opciones = {

            body:
                datos.body ||
                "Tienes una nueva notificación.",

            icon:
                datos.icon ||
                "/img/logo.jpeg",

            badge:
                "/img/logo.jpeg",

            data: {
                url:
                    datos.url || "/"
            },

            vibrate: [
                200,
                100,
                200
            ]
        };

        event.waitUntil(
            self.registration
                .showNotification(
                    titulo,
                    opciones
                )
        );
    }
);


// ==========================================
// CUANDO TOCAN LA NOTIFICACIÓN
// ==========================================

self.addEventListener(
    "notificationclick",
    function (event) {

        event.notification.close();

        const url =
            event.notification.data &&
            event.notification.data.url
                ? event.notification.data.url
                : "/";

        event.waitUntil(

            clients.matchAll({
                type: "window",
                includeUncontrolled: true
            })
            .then(function (ventanas) {

                for (
                    const ventana
                    of ventanas
                ) {

                    if (
                        "focus" in ventana
                    ) {

                        ventana.focus();

                        return ventana.navigate(
                            url
                        );
                    }
                }

                return clients.openWindow(
                    url
                );
            })
        );
    }
);