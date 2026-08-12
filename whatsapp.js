// ==========================================
// WHATSAPP - PLATAFORMAS STREAMING ARAIZA
// ==========================================

const wppconnect = require("@wppconnect-team/wppconnect");
const mongoose = require("mongoose");
const puppeteer = require("puppeteer");

require("dotenv").config();

console.log("==========================================");
console.log("INICIANDO WHATSAPP DEL SISTEMA");
console.log("==========================================");

// ==========================================
// VARIABLES
// ==========================================

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error("❌ No existe MONGO_URI");
    process.exit(1);
}

// ==========================================
// CONEXIÓN MONGODB
// ==========================================

async function conectarMongoDB() {

    try {

        await mongoose.connect(MONGO_URI);

        console.log("✅ MongoDB conectado desde WhatsApp");
        console.log(
            "📂 Base de datos:",
            mongoose.connection.name
        );

    } catch (error) {

        console.error("❌ Error conectando MongoDB:");
        console.error(error);

        process.exit(1);
    }
}

// ==========================================
// MODELO MENSAJES
// ==========================================

const mensajeSchema = new mongoose.Schema({

    telefono: {
        type: String,
        default: ""
    },

    mensaje: {
        type: String,
        default: ""
    },

    fecha: {
        type: Date,
        default: Date.now
    }

});

const Mensaje = mongoose.model(
    "Mensaje",
    mensajeSchema,
    "Mensajes"
);

// ==========================================
// MODELO CLIENTES
// ==========================================

const clienteSchema = new mongoose.Schema({

    nombre: {
        type: String,
        default: ""
    },

    telefono: {
        type: String,
        default: ""
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
// LIMPIAR TEXTO
// ==========================================

function limpiarTexto(texto) {

    return String(texto || "")
        .replace(/\r/g, "")
        .replace(/[ ]+/g, " ")
        .trim();
}

// ==========================================
// NORMALIZAR TEXTO
// ==========================================

function normalizar(texto) {

    return limpiarTexto(texto)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

// ==========================================
// NORMALIZAR TELÉFONO
// ==========================================

function normalizarTelefono(telefono) {

    let numero = String(telefono || "")
        .replace(/\D/g, "");

    if (
        numero.startsWith("52") &&
        numero.length >= 12
    ) {

        numero = numero.slice(-10);
    }

    return numero.slice(-10);
}

// ==========================================
// CREAR ID WHATSAPP
// ==========================================

function crearIdWhatsApp(telefono) {

    const numero =
        normalizarTelefono(telefono);

    if (numero.length !== 10) {
        return "";
    }

    return numero + "@c.us";
}

// ==========================================
// BUSCAR ETIQUETA
// ==========================================

function buscarEtiqueta(texto, etiquetas) {

    for (const etiqueta of etiquetas) {

        const regex = new RegExp(
            etiqueta +
            "\\s*[:=-]?\\s*([^\\n,]+)",
            "i"
        );

        const encontrado =
            texto.match(regex);

        if (
            encontrado &&
            encontrado[1]
        ) {

            return encontrado[1].trim();
        }
    }

    return "";
}

// ==========================================
// EXTRAER TELÉFONO
// ==========================================

function extraerTelefono(texto) {

    const etiquetado =
        buscarEtiqueta(
            texto,
            [
                "telefono",
                "tel",
                "celular",
                "numero",
                "numero de telefono",
                "numero celular",
                "contacto"
            ]
        );

    if (etiquetado) {

        const numero =
            normalizarTelefono(
                etiquetado
            );

        if (numero.length === 10) {
            return numero;
        }
    }

    const numeros =
        texto.match(
            /\b(?:\+?52\s*)?\d{10}\b/g
        );

    if (
        numeros &&
        numeros.length > 0
    ) {

        return normalizarTelefono(
            numeros[0]
        );
    }

    return "";
}

// ==========================================
// EXTRAER SERVICIO
// ==========================================

function extraerServicio(texto) {

    const servicios = [

        ["netflix", "Netflix"],

        ["disney+", "Disney+"],
        ["disney plus", "Disney+"],
        ["disney", "Disney+"],

        ["prime video", "Prime Video"],
        ["prime", "Prime Video"],

        ["crunchyroll", "Crunchyroll"],

        ["paramount+", "Paramount+"],
        ["paramount", "Paramount+"],

        ["spotify", "Spotify"],

        ["apple tv", "Apple TV"],
        ["apple", "Apple TV"],

        ["iptv", "IPTV"],

        ["fox one", "Fox One"],
        ["fox", "Fox One"],

        ["canva", "Canva"],

        ["vix", "ViX"],

        ["hbo max", "Max"],
        ["max", "Max"]

    ];

    const textoNormalizado =
        normalizar(texto);

    for (
        const [busqueda, resultado]
        of servicios
    ) {

        if (
            textoNormalizado.includes(
                normalizar(busqueda)
            )
        ) {

            return resultado;
        }
    }

    return "";
}

// ==========================================
// EXTRAER TIPO DE CUENTA
// ==========================================

function extraerTipo(texto) {

    const normal =
        normalizar(texto);

    if (
        normal.includes("cuenta completa") ||
        normal.includes("cuenta-completa") ||
        normal.includes("completa") ||
        normal.includes("completo") ||
        normal.includes("full")
    ) {

        return "Cuenta completa";
    }

    if (
        normal.includes("perfil")
    ) {

        return "Perfil";
    }

    return "";
}

// ==========================================
// EXTRAER NOMBRE
// ==========================================

function extraerNombre(texto) {

    const nombreEtiquetado =
        buscarEtiqueta(
            texto,
            [
                "nombre",
                "cliente",
                "usuario"
            ]
        );

    if (nombreEtiquetado) {

        return nombreEtiquetado
            .replace(
                /^(se llama|me llamo|soy|es)\s+/i,
                ""
            )
            .trim();
    }

    const patrones = [

        /(?:^|\s)se llama\s+([a-záéíóúüñ]+(?:\s+[a-záéíóúüñ]+){0,3})/i,

        /(?:^|\s)me llamo\s+([a-záéíóúüñ]+(?:\s+[a-záéíóúüñ]+){0,3})/i,

        /(?:^|\s)mi nombre es\s+([a-záéíóúüñ]+(?:\s+[a-záéíóúüñ]+){0,3})/i,

        /(?:^|\s)soy\s+([a-záéíóúüñ]+(?:\s+[a-záéíóúüñ]+){0,3})/i

    ];

    for (const patron of patrones) {

        const encontrado =
            texto.match(patron);

        if (
            encontrado &&
            encontrado[1]
        ) {

            return encontrado[1]
                .trim()
                .replace(/[.,;:]+$/, "");
        }
    }

    const primeraLinea =
        texto
            .split("\n")[0]
            .trim();

    const partes =
        primeraLinea
            .split(",")
            .map(parte => parte.trim())
            .filter(Boolean);

    if (partes.length >= 2) {

        const posibleNombre =
            partes[0];

        if (
            !/\d/.test(posibleNombre) &&
            posibleNombre.length >= 2
        ) {

            return posibleNombre;
        }
    }

    const lineas =
        texto
            .split("\n")
            .map(linea => linea.trim())
            .filter(Boolean);

    for (const linea of lineas) {

        const normal =
            normalizar(linea);

        if (
            normal.startsWith("nombre") ||
            normal.startsWith("telefono") ||
            normal.startsWith("tel") ||
            normal.startsWith("celular") ||
            normal.startsWith("numero") ||
            normal.startsWith("servicio") ||
            normal.startsWith("tipo") ||
            normal.includes("fecha")
        ) {
            continue;
        }

        if (
            !/\d{7,}/.test(linea) &&
            !normal.includes("netflix") &&
            !normal.includes("disney") &&
            !normal.includes("prime") &&
            !normal.includes("max") &&
            !normal.includes("vix") &&
            !normal.includes("crunchyroll") &&
            !normal.includes("spotify") &&
            !normal.includes("paramount") &&
            !normal.includes("iptv") &&
            !normal.includes("canva") &&
            !normal.includes("apple") &&
            !normal.includes("fox")
        ) {

            return linea
                .replace(/[.,;:]+$/, "");
        }
    }

    return "";
}

// ==========================================
// CONVERTIR FECHA ESPAÑOL
// ==========================================

function convertirFechaEspanol(
    dia,
    mes,
    anio
) {

    const meses = {

        enero: "01",
        febrero: "02",
        marzo: "03",
        abril: "04",
        mayo: "05",
        junio: "06",
        julio: "07",
        agosto: "08",
        septiembre: "09",
        setiembre: "09",
        octubre: "10",
        noviembre: "11",
        diciembre: "12"

    };

    const mesNumero =
        meses[
            normalizar(mes)
        ];

    if (!mesNumero) {
        return "";
    }

    const anioFinal =
        anio ||
        new Date().getFullYear();

    return (
        `${anioFinal}-${mesNumero}-${String(dia).padStart(2, "0")}`
    );
}

// ==========================================
// EXTRAER FECHAS
// ==========================================

function extraerFechas(texto) {

    const fechas = [];

    const iso =
        texto.match(
            /\b\d{4}-\d{1,2}-\d{1,2}\b/g
        );

    if (iso) {

        iso.forEach(fecha => {

            const partes =
                fecha.split("-");

            const resultado =
                `${partes[0]}-${partes[1].padStart(2, "0")}-${partes[2].padStart(2, "0")}`;

            if (
                !fechas.includes(resultado)
            ) {

                fechas.push(resultado);
            }

        });
    }

    const barras =
        texto.match(
            /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g
        );

    if (barras) {

        barras.forEach(fecha => {

            const partes =
                fecha.split("/");

            const resultado =
                `${partes[2]}-${partes[1].padStart(2, "0")}-${partes[0].padStart(2, "0")}`;

            if (
                !fechas.includes(resultado)
            ) {

                fechas.push(resultado);
            }

        });
    }

    const guiones =
        texto.match(
            /\b\d{1,2}-\d{1,2}-\d{4}\b/g
        );

    if (guiones) {

        guiones.forEach(fecha => {

            const partes =
                fecha.split("-");

            const resultado =
                `${partes[2]}-${partes[1].padStart(2, "0")}-${partes[0].padStart(2, "0")}`;

            if (
                !fechas.includes(resultado)
            ) {

                fechas.push(resultado);
            }

        });
    }

    const meses =
        "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre";

    const regex =
        new RegExp(
            `\\b(\\d{1,2})\\s+(?:de\\s+)?(${meses})(?:\\s+(?:de|del)?\\s*(\\d{4}))?\\b`,
            "gi"
        );

    let encontrado;

    while (
        (encontrado = regex.exec(texto)) !== null
    ) {

        const dia =
            encontrado[1];

        const mes =
            encontrado[2];

        const anio =
            encontrado[3] ||
            new Date().getFullYear();

        const resultado =
            convertirFechaEspanol(
                dia,
                mes,
                anio
            );

        if (
            resultado &&
            !fechas.includes(resultado)
        ) {

            fechas.push(resultado);
        }
    }

    return fechas;
}

// ==========================================
// EXTRAER CLIENTE
// ==========================================

function extraerCliente(texto) {

    const limpio =
        limpiarTexto(texto);

    const nombre =
        extraerNombre(limpio);

    const telefono =
        extraerTelefono(limpio);

    const servicio =
        extraerServicio(limpio);

    const tipo =
        extraerTipo(limpio);

    const fechas =
        extraerFechas(limpio);

    let fechaInicio = "";
    let fechaVencimiento = "";

    if (fechas.length >= 2) {

        fechaInicio =
            fechas[0];

        fechaVencimiento =
            fechas[1];

    } else {

        fechaInicio =
            buscarEtiqueta(
                limpio,
                [
                    "fecha inicio",
                    "fecha de inicio",
                    "fecha contratacion",
                    "fecha de contratacion",
                    "contratacion",
                    "inicio"
                ]
            );

        fechaVencimiento =
            buscarEtiqueta(
                limpio,
                [
                    "fecha vencimiento",
                    "fecha de vencimiento",
                    "vencimiento",
                    "vence",
                    "fecha de expiracion",
                    "expira"
                ]
            );
    }

    return {

        nombre,
        telefono,
        servicio,
        tipo,
        fechaInicio,
        fechaVencimiento

    };
}

// ==========================================
// FECHA DE MAÑANA
// ==========================================

function obtenerFechaManana() {

    const manana =
        new Date();

    manana.setHours(
        0,
        0,
        0,
        0
    );

    manana.setDate(
        manana.getDate() + 1
    );

    const anio =
        manana.getFullYear();

    const mes =
        String(
            manana.getMonth() + 1
        ).padStart(2, "0");

    const dia =
        String(
            manana.getDate()
        ).padStart(2, "0");

    return `${anio}-${mes}-${dia}`;
}

// ==========================================
// COMANDO BUSCAR
// ==========================================

async function comandoBuscar(
    client,
    message
) {

    const telefono =
        normalizarTelefono(
            message.body
                .replace(
                    /^buscar\s+/i,
                    ""
                )
        );

    if (
        telefono.length !== 10
    ) {

        await client.sendText(
            message.from,
            "❌ Escribe un teléfono válido de 10 dígitos.\n\n" +
            "Ejemplo:\n" +
            "buscar 6629876543"
        );

        return;
    }

    const cliente =
        await Cliente.findOne({
            telefono
        });

    if (!cliente) {

        await client.sendText(
            message.from,
            "❌ *CLIENTE NO ENCONTRADO*\n\n" +
            "No existe ningún cliente registrado con el teléfono:\n" +
            telefono
        );

        return;
    }

    await client.sendText(
        message.from,

        "🔎 *CLIENTE ENCONTRADO*\n\n" +

        "👤 Nombre: " +
        cliente.nombre +
        "\n" +

        "📱 Teléfono: " +
        cliente.telefono +
        "\n" +

        "📺 Servicio: " +
        cliente.servicio +
        "\n" +

        "👥 Tipo: " +
        cliente.tipo +
        "\n" +

        "📅 Contratación: " +
        cliente.fechaInicio +
        "\n" +

        "📅 Vencimiento: " +
        cliente.fechaVencimiento
    );
}

// ==========================================
// COMANDO ELIMINAR
// ==========================================

async function comandoEliminar(
    client,
    message
) {

    const telefono =
        normalizarTelefono(
            message.body
                .replace(
                    /^elimina(?:r)?\s+a?\s*/i,
                    ""
                )
        );

    if (
        telefono.length !== 10
    ) {

        await client.sendText(
            message.from,
            "❌ Escribe un teléfono válido de 10 dígitos.\n\n" +
            "Ejemplo:\n" +
            "elimina 6629876543"
        );

        return;
    }

    const cliente =
        await Cliente.findOne({
            telefono
        });

    if (!cliente) {

        await client.sendText(
            message.from,
            "❌ *CLIENTE NO ENCONTRADO*"
        );

        return;
    }

    await Cliente.deleteOne({
        _id: cliente._id
    });

    await client.sendText(
        message.from,

        "🗑️ *CLIENTE ELIMINADO*\n\n" +

        "👤 Nombre: " +
        cliente.nombre +
        "\n" +

        "📱 Teléfono: " +
        cliente.telefono +
        "\n" +

        "📺 Servicio: " +
        cliente.servicio
    );

    console.log(
        "🗑️ Cliente eliminado:",
        telefono
    );
}

// ==========================================
// COMANDO VENCE MAÑANA
// ==========================================

async function comandoVenceManana(
    client,
    message
) {

    const fechaManana =
        obtenerFechaManana();

    const clientes =
        await Cliente.find({
            fechaVencimiento:
                fechaManana
        });

    if (
        clientes.length === 0
    ) {

        await client.sendText(
            message.from,
            "📅 *CLIENTES QUE VENCEN MAÑANA*\n\n" +
            "No hay clientes que venzan mañana."
        );

        return;
    }

    let respuesta =
        "📅 *CLIENTES QUE VENCEN MAÑANA*\n\n";

    clientes.forEach(
        (cliente, indice) => {

            respuesta +=
                `${indice + 1}. 👤 ${cliente.nombre}\n` +
                `📱 ${cliente.telefono}\n` +
                `📺 ${cliente.servicio}\n` +
                `👥 ${cliente.tipo}\n` +
                `📅 Vence: ${cliente.fechaVencimiento}\n\n`;
        }
    );

    respuesta +=
        `Total: ${clientes.length} cliente(s).`;

    await client.sendText(
        message.from,
        respuesta
    );
}

// ==========================================
// COMANDO RECORDATORIOS
// ==========================================

async function comandoRecordatorios(
    client,
    message
) {

    const fechaManana =
        obtenerFechaManana();

    const clientes =
        await Cliente.find({
            fechaVencimiento:
                fechaManana
        });

    if (
        clientes.length === 0
    ) {

        await client.sendText(
            message.from,
            "🔔 *RECORDATORIOS*\n\n" +
            "No hay clientes para enviar recordatorio mañana."
        );

        return;
    }

    let enviados = 0;
    let errores = 0;

    for (
        const cliente
        of clientes
    ) {

        try {

            const id =
                crearIdWhatsApp(
                    cliente.telefono
                );

            if (!id) {

                errores++;

                continue;
            }

            const mensaje =

                "🔔 *RECORDATORIO DE RENOVACIÓN*\n\n" +

                "Hola " +
                cliente.nombre +
                " 👋\n\n" +

                "Tu servicio de *" +
                cliente.servicio +
                "* vence mañana.\n\n" +

                "📅 Fecha de vencimiento: " +
                cliente.fechaVencimiento +
                "\n\n" +

                "Si deseas renovar tu servicio, " +
                "por favor comunícate con " +
                "Plataformas Streaming Araiza.\n\n" +

                "¡Gracias por tu preferencia! 🙌";

            await client.sendText(
                id,
                mensaje
            );

            enviados++;

            console.log(
                "✅ Recordatorio enviado:",
                cliente.telefono
            );

        } catch (error) {

            errores++;

            console.error(
                "❌ Error enviando recordatorio:",
                cliente.telefono
            );

            console.error(
                error.message
            );
        }
    }

    await client.sendText(
        message.from,

        "✅ *RECORDATORIOS PROCESADOS*\n\n" +

        "📨 Enviados: " +
        enviados +
        "\n\n" +

        "❌ Con error: " +
        errores +
        "\n\n" +

        "📋 Total: " +
        clientes.length
    );
}

// ==========================================
// PROCESAR MENSAJE
// ==========================================

async function procesarMensaje(
    client,
    message
) {

    if (
        !message.body
    ) {

        return;
    }

    const texto =
        limpiarTexto(
            message.body
        );

    const comando =
        normalizar(texto);

    console.log(
        "=========================================="
    );

    console.log(
        "📩 MENSAJE RECIBIDO"
    );

    console.log(
        "De:",
        message.from
    );

    console.log(
        "Mensaje:",
        texto
    );

    console.log(
        "=========================================="
    );

    try {

        const mensaje =
            new Mensaje({

                telefono:
                    message.from,

                mensaje:
                    texto

            });

        await mensaje.save();

    } catch (error) {

        console.error(
            "❌ Error guardando mensaje:",
            error.message
        );
    }

    // ==========================================
    // BUSCAR
    // ==========================================

    if (
        comando.startsWith("buscar ")
    ) {

        await comandoBuscar(
            client,
            message
        );

        return;
    }

    // ==========================================
    // ELIMINAR
    // ==========================================

    if (
        comando.startsWith("elimina ") ||
        comando.startsWith("eliminar ")
    ) {

        await comandoEliminar(
            client,
            message
        );

        return;
    }

    // ==========================================
    // VENCE MAÑANA
    // ==========================================

    if (
        comando === "vence manana" ||
        comando === "vence mañana"
    ) {

        await comandoVenceManana(
            client,
            message
        );

        return;
    }

    // ==========================================
    // RECORDATORIOS
    // ==========================================

    if (
        comando === "enviar recordatorio" ||
        comando === "enviar recordatorios"
    ) {

        await comandoRecordatorios(
            client,
            message
        );

        return;
    }

    // ==========================================
    // EXTRAER CLIENTE
    // ==========================================

    const cliente =
        extraerCliente(texto);

    console.log(
        "📋 Datos detectados:",
        cliente
    );

    // ==========================================
    // VALIDAR
    // ==========================================

    const faltantes = [];

    if (!cliente.nombre) {
        faltantes.push("nombre");
    }

    if (!cliente.telefono) {
        faltantes.push("teléfono");
    }

    if (!cliente.servicio) {
        faltantes.push("servicio");
    }

    if (!cliente.tipo) {
        faltantes.push("tipo de cuenta");
    }

    if (!cliente.fechaInicio) {
        faltantes.push(
            "fecha de contratación"
        );
    }

    if (!cliente.fechaVencimiento) {
        faltantes.push(
            "fecha de vencimiento"
        );
    }

    if (
        cliente.telefono.length !== 10
    ) {

        if (
            !faltantes.includes(
                "teléfono"
            )
        ) {

            faltantes.push(
                "teléfono (10 dígitos)"
            );
        }
    }

    // ==========================================
    // DATOS INCOMPLETOS
    // ==========================================

    if (
        faltantes.length > 0
    ) {

        const lista =
            faltantes
                .map(
                    dato =>
                        "• " + dato
                )
                .join("\n");

        await client.sendText(
            message.from,

            "👋 ¡Hola!\n\n" +

            "📋 Gracias por enviar la información.\n\n" +

            "Para registrar correctamente el servicio " +
            "faltan los siguientes datos:\n\n" +

            "⚠️ *Datos faltantes:*\n" +

            lista +

            "\n\n" +

            "📝 Puedes enviar la información completa " +
            "en un solo mensaje.\n\n" +

            "Ejemplo:\n\n" +

            "Nombre: Juan Pérez\n" +
            "Teléfono: 6621234567\n" +
            "Servicio: Netflix\n" +
            "Tipo: Perfil\n" +
            "Fecha de contratación: 11/08/2026\n" +
            "Fecha de vencimiento: 11/09/2026\n\n" +

            "📺 *Plataformas Streaming Araiza*"
        );

        return;
    }

    // ==========================================
    // BUSCAR CLIENTE EXISTENTE
    // ==========================================

    const clienteExistente =
        await Cliente.findOne({
            telefono:
                cliente.telefono
        });

    // ==========================================
    // ACTUALIZAR
    // ==========================================

    if (
        clienteExistente
    ) {

        clienteExistente.nombre =
            cliente.nombre;

        clienteExistente.servicio =
            cliente.servicio;

        clienteExistente.tipo =
            cliente.tipo;

        clienteExistente.fechaInicio =
            cliente.fechaInicio;

        clienteExistente.fechaVencimiento =
            cliente.fechaVencimiento;

        await clienteExistente.save();

        console.log(
            "♻️ Cliente actualizado:",
            cliente.telefono
        );

    } else {

        // ==========================================
        // CREAR CLIENTE
        // ==========================================

        const nuevoCliente =
            new Cliente(cliente);

        await nuevoCliente.save();

        console.log(
            "✅ Cliente nuevo guardado:",
            cliente.telefono
        );
    }

    // ==========================================
    // CONFIRMACIÓN
    // ==========================================

    await client.sendText(
        message.from,

        "✅ *DATOS REGISTRADOS CORRECTAMENTE*\n\n" +

        "👤 Cliente: " +
        cliente.nombre +
        "\n\n" +

        "📱 Teléfono: " +
        cliente.telefono +
        "\n" +

        "📺 Servicio: " +
        cliente.servicio +
        "\n" +

        "👥 Tipo de cuenta: " +
        cliente.tipo +
        "\n" +

        "📅 Fecha de contratación: " +
        cliente.fechaInicio +
        "\n" +

        "📆 Fecha de vencimiento: " +
        cliente.fechaVencimiento +
        "\n\n" +

        "⏰ Un día antes de la fecha de vencimiento " +
        "recibirá un recordatorio para renovar su servicio.\n\n" +

        "🛠️ Si necesita asistencia, " +
        "puede comunicarse con Plataformas Streaming Araiza.\n\n" +

        "🙏 ¡Gracias por su preferencia!\n\n" +

        "📺✨ *Plataformas Streaming Araiza*"
    );

    console.log(
        "✅ Confirmación enviada a:",
        message.from
    );
}

// ==========================================
// INICIAR WHATSAPP
// ==========================================

async function iniciarWhatsApp() {

    await conectarMongoDB();

    console.log(
        "=========================================="
    );

    console.log(
        "INICIANDO WPPConnect..."
    );

    console.log(
        "=========================================="
    );

    try {

        // ==========================================
        // RUTA DE CHROME
        // ==========================================

        const chromePath =
            puppeteer.executablePath();

        console.log(
            "🌐 Chrome:",
            chromePath
        );

        // ==========================================
        // CREAR WHATSAPP
        // ==========================================

        const client =
            await wppconnect.create({

                session: "sistema",

                autoClose: 0,

                disableWelcome: true,

                headless: true,

                logQR: true,

                puppeteerOptions: {

                    executablePath:
                        chromePath,

                    args: [

                        "--no-sandbox",

                        "--disable-setuid-sandbox",

                        "--disable-dev-shm-usage",

                        "--disable-gpu",

                        "--no-zygote",

                        "--disable-software-rasterizer",

                        "--disable-background-timer-throttling",

                        "--disable-backgrounding-occluded-windows",

                        "--disable-renderer-backgrounding"

                    ]

                },

                catchQR: (
                    base64Qr,
                    asciiQR
                ) => {

                    console.log("");

                    console.log(
                        "=========================================="
                    );

                    console.log(
                        "       QR DE WHATSAPP DEL SISTEMA"
                    );

                    console.log(
                        "=========================================="
                    );

                    console.log(
                        asciiQR
                    );

                    console.log(
                        "=========================================="
                    );

                    console.log(
                        "ESCANEA EL QR DESDE WHATSAPP"
                    );

                    console.log(
                        "=========================================="
                    );

                    console.log("");
                },

                statusFind: (
                    statusSession,
                    session
                ) => {

                    console.log(
                        "=========================================="
                    );

                    console.log(
                        "Estado:",
                        statusSession
                    );

                    console.log(
                        "Sesión:",
                        session
                    );

                    console.log(
                        "=========================================="
                    );
                }

            });

        // ==========================================
        // WHATSAPP CONECTADO
        // ==========================================

        console.log(
            "=========================================="
        );

        console.log(
            "📱 WHATSAPP CONECTADO CORRECTAMENTE"
        );

        console.log(
            "📱 El sistema ya puede recibir mensajes."
        );

        console.log(
            "📂 MongoDB:",
            mongoose.connection.name
        );

        console.log(
            "=========================================="
        );

        // ==========================================
        // RECIBIR MENSAJES
        // ==========================================

        client.onMessage(
            async message => {

                try {

                    // Ignorar mensajes propios

                    if (
                        message.fromMe
                    ) {

                        return;
                    }

                    await procesarMensaje(
                        client,
                        message
                    );

                } catch (error) {

                    console.error(
                        "❌ Error procesando mensaje:"
                    );

                    console.error(
                        error
                    );
                }
            }
        );

    } catch (error) {

        console.error(
            "❌ Error iniciando WPPConnect:"
        );

        console.error(
            error
        );

        process.exit(1);
    }
}

// ==========================================
// INICIAR
// ==========================================

iniciarWhatsApp();

// ==========================================
// CIERRE SEGURO
// ==========================================

process.on(
    "SIGINT",
    async () => {

        console.log(
            "\nCerrando WhatsApp..."
        );

        try {

            await mongoose.connection.close();

        } catch (error) {

            console.error(
                error.message
            );
        }

        process.exit(0);
    }
);

process.on(
    "SIGTERM",
    async () => {

        console.log(
            "\nCerrando sistema..."
        );

        try {

            await mongoose.connection.close();

        } catch (error) {

            console.error(
                error.message
            );
        }

        process.exit(0);
    }
);
