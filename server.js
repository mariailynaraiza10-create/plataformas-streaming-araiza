const express = require("express");
const cron = require("node-cron");
const mongoose = require("mongoose");
const cors = require("cors");
const webpush = require("web-push");

require("dotenv").config();
webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

const app = express();

app.use(cors());
app.use(express.json());

// ==========================================
// CONEXIÓN A MONGODB ATLAS
// ==========================================

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB conectado correctamente");
        console.log(
            "Base de datos:",
            mongoose.connection.name
        );
    })
    .catch((error) => {
        console.error(
            "Error al conectar MongoDB:",
            error
        );
    });

// ==========================================
// MODELO CLIENTE
// ==========================================

const clienteSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true
    },

    telefono: {
        type: String,
        required: true
    },

    servicio: {
        type: String,
        default: ""
    },

    tipo: {
        type: String,
        default: ""
    },

    fechaInicio: {
        type: String,
        default: ""
    },

    fechaVencimiento: {
        type: String,
        default: ""
    }
});

const Cliente = mongoose.model(
    "Cliente",
    clienteSchema,
    "Clientes"
);
// ==========================================
// SUSCRIPCIONES PARA NOTIFICACIONES PUSH
// ==========================================

const suscripcionSchema = new mongoose.Schema({
    endpoint: {
        type: String,
        required: true,
        unique: true
    },

    keys: {
        p256dh: {
            type: String,
            required: true
        },

        auth: {
            type: String,
            required: true
        }
    }
});

const Suscripcion = mongoose.model(
    "Suscripcion",
    suscripcionSchema,
    "Suscripciones"
);
// ==========================================
// PRUEBA DEL SERVIDOR
// ==========================================

app.get("/", (req, res) => {
    res.send(
        "Servidor Streaming Araiza funcionando"
    );
});

// ==========================================
// GUARDAR CLIENTE
// ==========================================

app.post("/clientes", async (req, res) => {
    try {

        console.log(
            "Datos recibidos:",
            req.body
        );

        const cliente = new Cliente({
            nombre: req.body.nombre,
            telefono: req.body.telefono,
            servicio: req.body.servicio || "",
            tipo: req.body.tipo || "",
            fechaInicio: req.body.fechaInicio || "",
            fechaVencimiento:
                req.body.fechaVencimiento || ""
        });

        const clienteGuardado =
            await cliente.save();

        console.log(
            "Cliente guardado:",
            clienteGuardado._id
        );

        res.status(201).json({
            mensaje:
                "Cliente guardado correctamente",
            cliente: clienteGuardado
        });

    } catch (error) {

        console.error(
            "Error al guardar cliente:",
            error
        );

        res.status(500).json({
            mensaje:
                "Error al guardar cliente",
            error: error.message
        });
    }
});

// ==========================================
// MOSTRAR CLIENTES
// ==========================================

app.get("/clientes", async (req, res) => {
    try {

        const clientes =
            await Cliente.find().sort({
                _id: -1
            });

        res.json(clientes);

    } catch (error) {

        console.error(
            "Error al obtener clientes:",
            error
        );

        res.status(500).json({
            error: error.message
        });
    }
});

// ==========================================
// BUSCAR CLIENTE POR TELÉFONO
// ==========================================

app.get(
    "/clientes/buscar/:telefono",
    async (req, res) => {

        try {

            const telefono =
                req.params.telefono;

            const cliente =
                await Cliente.findOne({
                    telefono: telefono
                });

            if (!cliente) {

                return res.status(404).json({
                    mensaje:
                        "No se encontró un cliente con ese teléfono."
                });
            }

            res.json(cliente);

        } catch (error) {

            console.error(
                "Error al buscar cliente:",
                error
            );

            res.status(500).json({
                mensaje:
                    "Error al buscar cliente.",
                error: error.message
            });
        }
    }
);

// ==========================================
// ELIMINAR CLIENTE
// ==========================================

app.delete(
    "/clientes/:id",
    async (req, res) => {

        try {

            const id = req.params.id;

            if (
                !mongoose.Types.ObjectId.isValid(id)
            ) {

                return res.status(400).json({
                    mensaje:
                        "El ID del cliente no es válido."
                });
            }

            const cliente =
                await Cliente.findByIdAndDelete(id);

            if (!cliente) {

                return res.status(404).json({
                    mensaje:
                        "Cliente no encontrado."
                });
            }

            res.json({
                mensaje:
                    "Cliente eliminado correctamente."
            });

        } catch (error) {

            console.error(
                "Error al eliminar cliente:",
                error
            );

            res.status(500).json({
                mensaje:
                    "Error al eliminar cliente.",
                error: error.message
            });
        }
    }
);

// ==========================================
// RENOVAR CLIENTE DESDE LA PÁGINA
// ==========================================

app.put(
    "/clientes/:telefono",
    async (req, res) => {

        try {

            const telefono =
                req.params.telefono;

            const nuevaFecha =
                req.body.fechaVencimiento;

            if (!nuevaFecha) {

                return res.status(400).json({
                    mensaje:
                        "La fecha de vencimiento es obligatoria."
                });
            }

            const resultado =
                await Cliente.updateOne(
                    {
                        telefono: telefono
                    },
                    {
                        $set: {
                            fechaVencimiento:
                                nuevaFecha
                        }
                    }
                );

            if (
                resultado.matchedCount === 0
            ) {

                return res.status(404).json({
                    mensaje:
                        "No se encontró un cliente con ese teléfono."
                });
            }

            res.json({
                mensaje:
                    "Renovación actualizada correctamente."
            });

        } catch (error) {

            console.error(
                "Error al renovar:",
                error
            );

            res.status(500).json({
                error: error.message
            });
        }
    }
);

// ==========================================
// CLIENTES QUE VENCEN MAÑANA
// ==========================================

app.get(
    "/clientes-vencer",
    async (req, res) => {

        try {

            const clientes =
                await Cliente.find();

            const mañana =
                new Date();

            mañana.setDate(
                mañana.getDate() + 1
            );

            const fechaMañana =
                mañana
                    .toISOString()
                    .split("T")[0];

            const resultado =
                clientes.filter(
                    (cliente) => {

                        return (
                            cliente.fechaVencimiento ===
                            fechaMañana
                        );
                    }
                );

            res.json(resultado);

        } catch (error) {

            console.error(
                "Error al consultar vencimientos:",
                error
            );

            res.status(500).json({
                error: error.message
            });
        }
    }
);

// ==========================================
// PROCESAR COMANDOS
// ==========================================

async function procesarComando(mensaje) {

    if (
        !mensaje ||
        typeof mensaje !== "string"
    ) {

        return {
            ok: false,
            respuesta:
                "❌ Comando vacío."
        };
    }

    const texto =
        mensaje.trim();

    const partes =
        texto.split(/\s+/);

    const comando =
        partes[0].toUpperCase();

    // ==========================================
    // CONSULTAR
    // ==========================================

    if (comando === "CONSULTAR") {

        if (partes.length < 2) {

            return {
                ok: false,
                respuesta:
                    "❌ Formato:\n" +
                    "CONSULTAR número"
            };
        }

        const telefono =
            partes[1];

        const cliente =
            await Cliente.findOne({
                telefono: telefono
            });

        if (!cliente) {

            return {
                ok: false,
                respuesta:
                    "❌ Cliente no encontrado."
            };
        }

        return {
            ok: true,
            respuesta:
                "👤 CLIENTE\n\n" +
                "Nombre: " +
                cliente.nombre +
                "\n📱 Teléfono: " +
                cliente.telefono +
                "\n📺 Servicio: " +
                cliente.servicio +
                "\n👥 Tipo: " +
                (cliente.tipo || "No especificado") +
                "\n📅 Inicio: " +
                (cliente.fechaInicio || "Sin fecha") +
                "\n📅 Vencimiento: " +
                (cliente.fechaVencimiento || "Sin fecha")
        };
    }

    // ==========================================
    // RENOVAR
    // ==========================================

    if (comando === "RENOVAR") {

        if (partes.length < 3) {

            return {
                ok: false,
                respuesta:
                    "❌ Formato:\n" +
                    "RENOVAR número nuevaFecha\n\n" +
                    "Ejemplo:\n" +
                    "RENOVAR 6623656155 2026-09-15"
            };
        }

        const telefono =
            partes[1];

        const nuevaFecha =
            partes[2];

        // Validar formato YYYY-MM-DD
        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(
                nuevaFecha
            )
        ) {

            return {
                ok: false,
                respuesta:
                    "❌ La fecha debe tener formato:\n" +
                    "YYYY-MM-DD\n\n" +
                    "Ejemplo:\n" +
                    "2026-09-15"
            };
        }

        const cliente =
            await Cliente.findOne({
                telefono: telefono
            });

        if (!cliente) {

            return {
                ok: false,
                respuesta:
                    "❌ No se encontró un cliente con el teléfono:\n" +
                    telefono
            };
        }

        const fechaAnterior =
            cliente.fechaVencimiento;

        // ======================================
        // SOLO CAMBIA LA FECHA
        // ======================================

        cliente.fechaVencimiento =
            nuevaFecha;

        await cliente.save();

        console.log(
            "RENOVACIÓN POR COMANDO:",
            cliente.nombre,
            nuevaFecha
        );

        return {
            ok: true,
            respuesta:
                "✅ RENOVACIÓN ACTUALIZADA\n\n" +
                "👤 Cliente: " +
                cliente.nombre +
                "\n📱 Teléfono: " +
                cliente.telefono +
                "\n📺 Servicio: " +
                cliente.servicio +
                "\n📅 Fecha anterior: " +
                (fechaAnterior || "Sin fecha") +
                "\n📅 Nueva fecha: " +
                nuevaFecha
        };
    }

    // ==========================================
    // REGISTRAR
    // ==========================================

    if (comando === "REGISTRAR") {

        if (partes.length < 7) {

            return {
                ok: false,
                respuesta:
                    "❌ Formato incorrecto.\n\n" +
                    "REGISTRAR número nombre servicio tipo inicio vencimiento"
            };
        }

        const telefono =
            partes[1];

        const nombre =
            partes[2];

        const servicio =
            partes[3];

        const tipo =
            partes[4];

        const fechaInicio =
            partes[5];

        const fechaVencimiento =
            partes[6];

        const existente =
            await Cliente.findOne({
                telefono: telefono
            });

        if (existente) {

            return {
                ok: false,
                respuesta:
                    "⚠️ Ya existe un cliente con ese teléfono."
            };
        }

        const cliente =
            new Cliente({
                nombre,
                telefono,
                servicio,
                tipo,
                fechaInicio,
                fechaVencimiento
            });

        await cliente.save();

        return {
            ok: true,
            respuesta:
                "✅ CLIENTE REGISTRADO\n\n" +
                "👤 Nombre: " +
                nombre +
                "\n📱 Teléfono: " +
                telefono +
                "\n📺 Servicio: " +
                servicio +
                "\n👥 Tipo: " +
                tipo +
                "\n📅 Inicio: " +
                fechaInicio +
                "\n📅 Vencimiento: " +
                fechaVencimiento
        };
    }

    // ==========================================
    // COMANDO NO RECONOCIDO
    // ==========================================

    return {
        ok: false,
        respuesta:
            "❌ Comando no reconocido.\n\n" +
            "Comandos disponibles:\n\n" +
            "CONSULTAR número\n" +
            "RENOVAR número nuevaFecha\n" +
            "REGISTRAR número nombre servicio tipo inicio vencimiento"
    };
}

// ==========================================
// RECIBIR COMANDOS
// ==========================================

app.post(
    "/comando",
    async (req, res) => {

        try {

            const mensaje =
                req.body.mensaje;

            console.log(
                "COMANDO RECIBIDO:",
                mensaje
            );

            const resultado =
                await procesarComando(
                    mensaje
                );

            res.json(resultado);

        } catch (error) {

            console.error(
                "Error procesando comando:",
                error
            );

            res.status(500).json({
                ok: false,
                respuesta:
                    "❌ Error procesando el comando.",
                error: error.message
            });
        }
    }
);

// ==========================================
// REVISIÓN AUTOMÁTICA DIARIA
// ==========================================

cron.schedule(
    "0 9 * * *",
    async () => {

        console.log(
            "⏰ Ejecutando revisión diaria..."
        );

        await enviarNotificacionVencimiento();

    }
);
// ==========================================
// COMANDOS DEL SISTEMA
// ==========================================

app.post("/comando", async (req, res) => {

    try {

        const mensaje = req.body.mensaje;
        

        if (!mensaje) {
            return res.json({
                ok: false,
                respuesta: "❌ No se recibió ningún comando."
            });
        }

        const partes = mensaje.trim().split(/\s+/);
        const comando = partes[0].toUpperCase();

        // ==========================================
        // CONSULTAR
        // CONSULTAR 6623656155
        // ==========================================

        if (comando === "CONSULTAR") {

            if (!partes[1]) {
                return res.json({
                    ok: false,
                    respuesta: "❌ Usa: CONSULTAR número"
                });
            }

            const telefono = partes[1];

            const cliente = await Cliente.findOne({
                telefono: telefono
            });

            if (!cliente) {
                return res.json({
                    ok: false,
                    respuesta:
                        "❌ No se encontró ningún cliente con ese teléfono."
                });
            }

            return res.json({
                ok: true,
                respuesta:
                    "👤 CLIENTE\n\n" +
                    "Nombre: " + cliente.nombre + "\n" +
                    "📱 Teléfono: " + cliente.telefono + "\n" +
                    "📺 Servicio: " + cliente.servicio + "\n" +
                    "👥 Tipo: " +
                    (cliente.tipo || "No especificado") + "\n" +
                    "📅 Inicio: " +
                    (cliente.fechaInicio || "Sin fecha") + "\n" +
                    "📅 Vencimiento: " +
                    (cliente.fechaVencimiento || "Sin fecha")
            });
        }

        // ==========================================
        // RENOVAR
        // RENOVAR 6623656155 2026-09-15
        // ==========================================

        if (comando === "RENOVAR") {

            if (!partes[1] || !partes[2]) {

                return res.json({
                    ok: false,
                    respuesta:
                        "❌ Formato incorrecto.\n\n" +
                        "Usa:\n" +
                        "RENOVAR número nuevaFecha\n\n" +
                        "Ejemplo:\n" +
                        "RENOVAR 6623656155 2026-09-15"
                });
            }

            const telefono = partes[1];
            const nuevaFecha = partes[2];

            const cliente = await Cliente.findOne({
                telefono: telefono
            });

            if (!cliente) {

                return res.json({
                    ok: false,
                    respuesta:
                        "❌ No se encontró ningún cliente con ese teléfono."
                });
            }

            const fechaAnterior =
                cliente.fechaVencimiento;

            cliente.fechaVencimiento =
                nuevaFecha;

            await cliente.save();

            console.log(
                "RENOVACIÓN:",
                cliente.nombre,
                "→",
                nuevaFecha
            );

            return res.json({
                ok: true,
                respuesta:
                    "✅ RENOVACIÓN ACTUALIZADA\n\n" +
                    "👤 Cliente: " +
                    cliente.nombre + "\n" +
                    "📱 Teléfono: " +
                    cliente.telefono + "\n" +
                    "📺 Servicio: " +
                    cliente.servicio + "\n" +
                    "📅 Fecha anterior: " +
                    fechaAnterior + "\n" +
                    "📅 Nueva fecha: " +
                    nuevaFecha
            });
        }

        // ==========================================
        // COMANDO DESCONOCIDO
        // ==========================================

        return res.json({
            ok: false,
            respuesta:
                "❌ Comando no reconocido.\n\n" +
                "Comandos disponibles:\n" +
                "CONSULTAR número\n" +
                "RENOVAR número nuevaFecha"
        });

    } catch (error) {

        console.error(
            "Error procesando comando:",
            error
        );

        res.status(500).json({
            ok: false,
            respuesta:
                "❌ Error procesando comando.",
            error: error.message
        });
    }
});

// ==========================================
// GUARDAR SUSCRIPCIÓN DEL CELULAR
// ==========================================

app.post(
    "/notificaciones/suscribirse",
    async (req, res) => {

        try {

            const subscription =
                req.body;

            if (
                !subscription ||
                !subscription.endpoint ||
                !subscription.keys
            ) {

                return res.status(400).json({
                    mensaje:
                        "Suscripción inválida."
                });
            }

            await Suscripcion.findOneAndUpdate(
                {
                    endpoint:
                        subscription.endpoint
                },
                {
                    endpoint:
                        subscription.endpoint,

                    keys: {
                        p256dh:
                            subscription.keys.p256dh,

                        auth:
                            subscription.keys.auth
                    }
                },
                {
                    upsert: true,
                    new: true
                }
            );

            console.log(
                "📱 Dispositivo suscrito a notificaciones."
            );

            res.json({
                ok: true,
                mensaje:
                    "Notificaciones activadas correctamente."
            });

        } catch (error) {

            console.error(
                "Error guardando suscripción:",
                error
            );

            res.status(500).json({
                ok: false,
                mensaje:
                    "No se pudo activar las notificaciones."
            });
        }
    }
);
// ==========================================
// ENVIAR NOTIFICACIÓN PUSH
// ==========================================

async function enviarNotificacionVencimiento() {

    try {

        const clientes =
            await Cliente.find();

        const mañana =
            new Date();

        mañana.setDate(
            mañana.getDate() + 1
        );

        const fechaMañana =
            mañana
                .toISOString()
                .split("T")[0];

        const vencen =
            clientes.filter(
                cliente =>
                    cliente.fechaVencimiento ===
                    fechaMañana
            );

        if (vencen.length === 0) {

            console.log(
                "✅ No hay clientes que venzan mañana."
            );

            return;
        }

        const suscripciones =
            await Suscripcion.find();

        console.log(
            "🔔 Clientes que vencen mañana:",
            vencen.length
        );

        for (
            const suscripcion
            of suscripciones
        ) {

            const payload =
                JSON.stringify({

                    title:
                        "⚠️ Vencimientos de mañana",

                    body:
                        vencen.length === 1
                            ? "Tienes 1 cliente que vence mañana."
                            : `Tienes ${vencen.length} clientes que vencen mañana.`,

                    url:
                        "/",

                    icon:
                        "/img/logo.jpeg"
                });

            try {

                await webpush.sendNotification(
                    suscripcion,
                    payload
                );

                console.log(
                    "🔔 Notificación enviada."
                );

            } catch (error) {

                console.error(
                    "Error enviando notificación:",
                    error.statusCode,
                    error.message
                );

                // Si el celular ya no está suscrito,
                // eliminamos la suscripción.
                if (
                    error.statusCode === 404 ||
                    error.statusCode === 410
                ) {

                    await Suscripcion.deleteOne({
                        endpoint:
                            suscripcion.endpoint
                    });
                }
            }
        }

    } catch (error) {

        console.error(
            "❌ Error en notificación:",
            error
        );
    }
}
// ==========================================
// PUERTO
// ==========================================

const PORT =
    process.env.PORT || 3000;

app.listen(
    PORT,
    () => {

        console.log(
            `Servidor iniciado en puerto ${PORT}`
        );
    }
);
