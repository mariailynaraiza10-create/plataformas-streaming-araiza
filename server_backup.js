const express = require("express");
const cron = require("node-cron");
const mongoose = require("mongoose");
const cors = require("cors");

require("dotenv").config();

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
        console.log("Base de datos:", mongoose.connection.name);
    })
    .catch((error) => {
        console.error("Error al conectar MongoDB:", error);
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

// Mantener colección "Clientes"
const Cliente = mongoose.model(
    "Cliente",
    clienteSchema,
    "Clientes"
);

// ==========================================
// PRUEBA DEL SERVIDOR
// ==========================================

app.get("/", (req, res) => {
    res.send("Servidor Streaming Araiza funcionando");
});

// ==========================================
// GUARDAR CLIENTE
// ==========================================

app.post("/clientes", async (req, res) => {
    try {
        console.log("Datos recibidos:", req.body);

        const cliente = new Cliente({
            nombre: req.body.nombre,
            telefono: req.body.telefono,
            servicio: req.body.servicio || "",
            tipo: req.body.tipo || "",
            fechaInicio: req.body.fechaInicio || "",
            fechaVencimiento: req.body.fechaVencimiento || ""
        });

        const clienteGuardado = await cliente.save();

        console.log(
            "Cliente guardado:",
            clienteGuardado._id
        );

        res.status(201).json({
            mensaje: "Cliente guardado correctamente",
            cliente: clienteGuardado
        });

    } catch (error) {
        console.error(
            "Error al guardar cliente:",
            error
        );

        res.status(500).json({
            mensaje: "Error al guardar cliente",
            error: error.message
        });
    }
});

// ==========================================
// MOSTRAR CLIENTES
// ==========================================

app.get("/clientes", async (req, res) => {
    try {
        const clientes = await Cliente.find().sort({
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

app.get("/clientes/buscar/:telefono", async (req, res) => {
    try {
        const telefono = req.params.telefono;

        console.log(
            "Buscando cliente por teléfono:",
            telefono
        );

        const cliente = await Cliente.findOne({
            telefono: telefono
        });

        if (!cliente) {
            return res.status(404).json({
                mensaje: "No se encontró un cliente con ese teléfono."
            });
        }

        res.json(cliente);

    } catch (error) {
        console.error(
            "Error al buscar cliente:",
            error
        );

        res.status(500).json({
            mensaje: "Error al buscar cliente.",
            error: error.message
        });
    }
});

// ==========================================
// ELIMINAR CLIENTE
// ==========================================

app.delete("/clientes/:id", async (req, res) => {
    try {
        console.log(
            "ID recibido para eliminar:",
            req.params.id
        );

        const id = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.log("ID inválido:", id);

            return res.status(400).json({
                mensaje: "El ID del cliente no es válido."
            });
        }

        const cliente =
            await Cliente.findByIdAndDelete(id);

        if (!cliente) {
            console.log(
                "Cliente no encontrado:",
                id
            );

            return res.status(404).json({
                mensaje: "Cliente no encontrado."
            });
        }

        console.log(
            "Cliente eliminado correctamente:",
            cliente.nombre
        );

        res.json({
            mensaje: "Cliente eliminado correctamente."
        });

    } catch (error) {
        console.error(
            "ERROR REAL AL ELIMINAR:",
            error
        );

        res.status(500).json({
            mensaje: "Error al eliminar cliente.",
            error: error.message
        });
    }
});

// ==========================================
// RENOVAR CLIENTE
// ==========================================

app.put("/clientes/:telefono", async (req, res) => {
    try {
        const telefono = req.params.telefono;

        const nuevaFecha =
            req.body.fechaVencimiento;

        if (!nuevaFecha) {
            return res.status(400).json({
                mensaje: "La fecha de vencimiento es obligatoria."
            });
        }

        const resultado =
            await Cliente.updateOne(
                {
                    telefono: telefono
                },
                {
                    $set: {
                        fechaVencimiento: nuevaFecha
                    }
                }
            );

        if (resultado.matchedCount === 0) {
            return res.status(404).json({
                mensaje:
                    "No se encontró un cliente con ese teléfono."
            });
        }

        res.json({
            mensaje:
                "Renovación actualizada correctamente"
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
});

// ==========================================
// CLIENTES QUE VENCEN MAÑANA
// ==========================================

app.get("/clientes-vencer", async (req, res) => {
    try {
        const clientes = await Cliente.find();

        const mañana = new Date();

        mañana.setDate(
            mañana.getDate() + 1
        );

        const fechaMañana =
            mañana.toISOString().split("T")[0];

        const resultado = clientes.filter(
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
});

// ==========================================
// REVISIÓN AUTOMÁTICA DIARIA
// ==========================================

cron.schedule("0 9 * * *", async () => {
    try {
        console.log(
            "Revisando vencimientos..."
        );

        const clientes = await Cliente.find();

        const mañana = new Date();

        mañana.setDate(
            mañana.getDate() + 1
        );

        const fecha =
            mañana.toISOString().split("T")[0];

        const vencen = clientes.filter(
            (cliente) => {
                return (
                    cliente.fechaVencimiento ===
                    fecha
                );
            }
        );

        if (vencen.length > 0) {
            console.log(
                "Clientes que vencen mañana:"
            );

            vencen.forEach((cliente) => {
                console.log(
                    cliente.nombre,
                    cliente.telefono
                );
            });

        } else {
            console.log(
                "No hay clientes por vencer mañana"
            );
        }

    } catch (error) {
        console.error(
            "Error en revisión automática:",
            error
        );
    }
});
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
// PUERTO
// ==========================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(
        `Servidor iniciado en puerto ${PORT}`
    );
});
