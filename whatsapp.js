const wppconnect = require("@wppconnect-team/wppconnect");
const mongoose = require("mongoose");

require("dotenv").config();

console.log("Iniciando WhatsApp del sistema...");

// ==========================================
// CONEXIÃ“N A MONGODB
// ==========================================

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB conectado desde WhatsApp");
        console.log("Base de datos:", mongoose.connection.name);
    })
    .catch((error) => {
        console.error("Error conectando MongoDB:");
        console.error(error);
    });

// ==========================================
// MODELO DE MENSAJES
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
// MODELO DE CLIENTES
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
// FUNCIONES PARA LIMPIAR TEXTO
// ==========================================

function limpiarTexto(texto) {

    return texto
        .replace(/\r/g, "")
        .replace(/[ ]+/g, " ")
        .trim();
}

// ==========================================
// NORMALIZAR TEXTO
// ==========================================

function normalizar(texto) {

    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

// ==========================================
// BUSCAR DATO DESPUÃ‰S DE UNA ETIQUETA
// ==========================================

function buscarEtiqueta(texto, etiquetas) {

    for (const etiqueta of etiquetas) {

        const regex = new RegExp(
            etiqueta + "\\s*[:=-]?\\s*([^\\n,]+)",
            "i"
        );

        const encontrado = texto.match(regex);

        if (encontrado && encontrado[1]) {

            return encontrado[1].trim();
        }
    }

    return "";
}
// ==========================================
// EXTRAER TELÃ‰FONO
// ==========================================

function extraerTelefono(texto) {

    const etiquetas = [
        "telefono",
        "tel",
        "celular",
        "numero",
        "numero de telefono",
        "numero celular",
        "contacto"
    ];

    const etiquetado = buscarEtiqueta(texto, etiquetas);

    if (etiquetado) {

        const numero = etiquetado.replace(/\D/g, "");

        if (numero.length >= 10) {
            return numero.slice(-10);
        }
    }

    const numeros = texto.match(/\b\d{10,15}\b/g);

    if (numeros && numeros.length > 0) {
        return numeros[0].slice(-10);
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
        ["max", "Max"],
        ["hbo max", "Max"],
        ["prime video", "Prime Video"],
        ["prime", "Prime Video"],
        ["crunchyroll", "Crunchyroll"],
        ["vix", "Vix"],
        ["paramount+", "Paramount+"],
        ["paramount", "Paramount+"],
        ["apple tv", "Apple TV"],
        ["apple", "Apple TV"],
        ["iptv", "IPTV"],
        ["fox one", "Fox One"],
        ["fox", "Fox One"],
        ["canva", "Canva"],
        ["spotify", "Spotify"]
    ];

    const textoNormalizado = normalizar(texto);

    for (const [busqueda, resultado] of servicios) {

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
// EXTRAER TIPO
// ==========================================

function extraerTipo(texto) {

    const normal = normalizar(texto);

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
        normal.includes("perfil") ||
        normal.includes("perfill")
    ) {
        return "Perfil";
    }

    return "";
}

// ==========================================
// EXTRAER NOMBRE
// ==========================================

function extraerNombre(texto) {

    // ==========================================
    // 1. NOMBRE CON ETIQUETA
    // Ejemplos:
    // Nombre: Pedro
    // Cliente: Pedro
    // Usuario: Pedro
    // ==========================================

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

        let nombre = nombreEtiquetado.trim();

        nombre = nombre
            .replace(/^(se llama|me llamo|soy|es)\s+/i, "")
            .trim();

        return nombre;
    }


    // ==========================================
    // 2. FRASES NATURALES
    // Ejemplos:
    // Se llama Pedro
    // Me llamo Pedro
    // Soy Pedro
    // El cliente se llama Pedro
    // Mi nombre es Pedro
    // ==========================================

    const patronesNombre = [

        /(?:^|\s)se llama\s+([a-zÃ¡Ã©Ã­Ã³ÃºÃ¼Ã±]+(?:\s+[a-zÃ¡Ã©Ã­Ã³ÃºÃ¼Ã±]+){0,3})/i,

        /(?:^|\s)me llamo\s+([a-zÃ¡Ã©Ã­Ã³ÃºÃ¼Ã±]+(?:\s+[a-zÃ¡Ã©Ã­Ã³ÃºÃ¼Ã±]+){0,3})/i,

        /(?:^|\s)mi nombre es\s+([a-zÃ¡Ã©Ã­Ã³ÃºÃ¼Ã±]+(?:\s+[a-zÃ¡Ã©Ã­Ã³ÃºÃ¼Ã±]+){0,3})/i,

        /(?:^|\s)soy\s+([a-zÃ¡Ã©Ã­Ã³ÃºÃ¼Ã±]+(?:\s+[a-zÃ¡Ã©Ã­Ã³ÃºÃ¼Ã±]+){0,3})/i,

        /(?:^|\s)nombre es\s+([a-zÃ¡Ã©Ã­Ã³ÃºÃ¼Ã±]+(?:\s+[a-zÃ¡Ã©Ã­Ã³ÃºÃ¼Ã±]+){0,3})/i

    ];

    for (const patron of patronesNombre) {

        const encontrado =
            texto.match(patron);

        if (encontrado && encontrado[1]) {

            return encontrado[1]
                .trim()
                .replace(/[.,;:]+$/, "");
        }
    }


    // ==========================================
    // 3. FORMATO CON COMAS
    // Ejemplo:
    // Juan, 6621234567, Netflix, Perfil
    // ==========================================

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
            posibleNombre.length >= 2 &&
            !normalizar(posibleNombre).includes("se llama") &&
            !normalizar(posibleNombre).includes("me llamo") &&
            !normalizar(posibleNombre).includes("mi nombre")
        ) {

            return posibleNombre;
        }
    }


    // ==========================================
    // 4. BUSCAR UNA LÃNEA QUE PAREZCA NOMBRE
    // ==========================================

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
            !normal.includes("apple tv") &&
            !normal.includes("fox one")
        ) {

            return linea
                .trim()
                .replace(/[.,;:]+$/, "");
        }
    }

    return "";
}

// ==========================================
// CONVERTIR FECHA EN ESPAÃ‘OL
// ==========================================

function convertirFechaEspanol(dia, mes, anio) {

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
        meses[normalizar(mes)];

    if (!mesNumero) {
        return "";
    }

    const anioFinal =
        anio || new Date().getFullYear();

    return (
        `${anioFinal}-${mesNumero}-${String(dia).padStart(2, "0")}`
    );
}


// ==========================================
// EXTRAER FECHAS
// ==========================================

function extraerFechas(texto) {

    const fechas = [];


    // ==========================================
    // YYYY-MM-DD
    // ==========================================

    const iso =
        texto.match(
            /\b\d{4}-\d{1,2}-\d{1,2}\b/g
        );

    if (iso) {

        iso.forEach(fecha => {

            const partes = fecha.split("-");

            const resultado =
                `${partes[0]}-${partes[1].padStart(2, "0")}-${partes[2].padStart(2, "0")}`;

            if (!fechas.includes(resultado)) {
                fechas.push(resultado);
            }

        });
    }


    // ==========================================
    // DD/MM/YYYY
    // ==========================================

    const barras =
        texto.match(
            /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g
        );

    if (barras) {

        barras.forEach(fecha => {

            const partes = fecha.split("/");

            const resultado =
                `${partes[2]}-${partes[1].padStart(2, "0")}-${partes[0].padStart(2, "0")}`;

            if (!fechas.includes(resultado)) {
                fechas.push(resultado);
            }

        });
    }


    // ==========================================
    // DD-MM-YYYY
    // ==========================================

    const guiones =
        texto.match(
            /\b\d{1,2}-\d{1,2}-\d{4}\b/g
        );

    if (guiones) {

        guiones.forEach(fecha => {

            const partes = fecha.split("-");

            const resultado =
                `${partes[2]}-${partes[1].padStart(2, "0")}-${partes[0].padStart(2, "0")}`;

            if (!fechas.includes(resultado)) {
                fechas.push(resultado);
            }

        });
    }


    // ==========================================
    // DD DE MES
    // ==========================================

    const meses =
        "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre";

    const fechasEspanol =
        texto.match(
            new RegExp(
                `\\b\\d{1,2}\\s+(?:de\\s+)?(${meses})(?:\\s+(?:de|del)?\\s*\\d{4})?\\b`,
                "gi"
            )
        );

    if (fechasEspanol) {

        fechasEspanol.forEach(fechaTexto => {

            const coincidencia =
                fechaTexto.match(
                    new RegExp(
                        `(\\d{1,2})\\s+(?:de\\s+)?(${meses})(?:\\s+(?:de|del)?\\s*(\\d{4}))?`,
                        "i"
                    )
                );

            if (!coincidencia) {
                return;
            }

            const dia =
                coincidencia[1];

            const mes =
                coincidencia[2];

            const anio =
                coincidencia[3] ||
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

        });
    }


    return fechas;
}


// ==========================================
// EXTRAER DATOS DEL CLIENTE
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


    // ==========================================
    // SI ENCONTRÃ“ DOS FECHAS
    // ==========================================

    if (fechas.length >= 2) {

        fechaInicio = fechas[0];
        fechaVencimiento = fechas[1];

    } else {

        // ==========================================
        // BUSCAR FECHAS ETIQUETADAS
        // ==========================================

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
// INICIAR WHATSAPP
// ==========================================

wppconnect
    .create({

        session: "sistema",

        catchQR: (base64Qr, asciiQR) => {

            console.log(
                "\n========== ESCANEA ESTE QR ==========\n"
            );

            console.log(asciiQR);

            console.log(
                "\n=====================================\n"
            );
        },

        statusFind: (statusSession, session) => {

            console.log(
                "Estado:",
                statusSession,
                "| SesiÃ³n:",
                session
            );
        },

        headless: true,
        logQR: true
    })

    .then((client) => {

        console.log(
            "WhatsApp conectado correctamente."
        );

        // ==========================================
        // RECIBIR MENSAJES
        // ==========================================

        client.onMessage(async (message) => {

            try {

                // ==========================================
                // IGNORAR MENSAJES SIN TEXTO
                // ==========================================

                if (!message.body) {

                    return;
                }
console.log("==========================================");
console.log("DATOS COMPLETOS DEL MENSAJE");
console.log("==========================================");

console.log(
    JSON.stringify(
        message,
        null,
        2
    )
);

console.log("==========================================");
console.log("FROM:");
console.log(message.from);

console.log("AUTHOR:");
console.log(message.author);

console.log("CHAT ID:");
console.log(
    message.chatId
);

console.log("SENDER:");
console.log(
    message.sender
);

console.log("==========================================");

                console.log(
                    "\n===== MENSAJE RECIBIDO ====="
                );

                console.log(
                    "De:",
                    message.from
                );

                console.log(
                    "Mensaje:",
                    message.body
                );

                console.log(
                    "============================\n"
                );

                // ==========================================
                // GUARDAR MENSAJE ORIGINAL
                // ==========================================

                const nuevoMensaje =
                    new Mensaje({

                        telefono:
                            message.from,

                        mensaje:
                            message.body

                    });

                await nuevoMensaje.save();

                console.log(
                    "Mensaje guardado en MongoDB."
);
 // ==========================================
// COMANDOS DEL SISTEMA
// ==========================================

const textoComando = normalizar(message.body);

// ==========================================
// COMANDO: BUSCAR CLIENTE
// Ejemplo:
// buscar 6629876543
// ==========================================

if (textoComando.startsWith("buscar ")) {

    const telefonoBuscar =
        message.body
            .replace(/^buscar\s+/i, "")
            .replace(/\D/g, "")
            .slice(-10);

    if (telefonoBuscar.length !== 10) {

        await client.sendText(
            message.from,
            "❌ Escribe un teléfono válido de 10 dígitos.\n\n" +
            "Ejemplo:\n" +
            "buscar 6629876543"
        );

        return;
    }

    const clienteEncontrado =
        await Cliente.findOne({
            telefono: telefonoBuscar
        });

    if (!clienteEncontrado) {

        await client.sendText(
            message.from,
            "❌ *CLIENTE NO ENCONTRADO*\n\n" +
            "No existe ningún cliente registrado con el teléfono:\n" +
            telefonoBuscar
        );

        return;
    }

    await client.sendText(
        message.from,

        "🔎 *CLIENTE ENCONTRADO*\n\n" +

        "👤 Nombre: " +
        clienteEncontrado.nombre +
        "\n" +

        "📱 Teléfono: " +
        clienteEncontrado.telefono +
        "\n" +

        "📺 Servicio: " +
        clienteEncontrado.servicio +
        "\n" +

        "👥 Tipo: " +
        clienteEncontrado.tipo +
        "\n" +

        "📅 Contratación: " +
        clienteEncontrado.fechaInicio +
        "\n" +

        "📅 Vencimiento: " +
        clienteEncontrado.fechaVencimiento
    );

    return;
}


// ==========================================
// COMANDO: ELIMINAR CLIENTE
// Acepta:
// elimina 6629876543
// eliminar 6629876543
// elimina a 6629876543
// eliminar a 6629876543
// ==========================================

if (
    textoComando.startsWith("elimina ") ||
    textoComando.startsWith("eliminar ")
) {

    const telefonoEliminar =
        message.body
            .replace(/^elimina(?:r)?\s+a?\s*/i, "")
            .replace(/\D/g, "")
            .slice(-10);

    if (telefonoEliminar.length !== 10) {

        await client.sendText(
            message.from,
            "❌ Escribe un teléfono válido de 10 dígitos.\n\n" +
            "Ejemplo:\n" +
            "elimina 6629876543"
        );

        return;
    }

    const clienteEliminar =
        await Cliente.findOne({
            telefono: telefonoEliminar
        });

    if (!clienteEliminar) {

        await client.sendText(
            message.from,
            "❌ *CLIENTE NO ENCONTRADO*\n\n" +
            "No existe ningún cliente registrado con el teléfono:\n" +
            telefonoEliminar
        );

        return;
    }

    await Cliente.deleteOne({
        _id: clienteEliminar._id
    });

    await client.sendText(
        message.from,

        "🗑️ *CLIENTE ELIMINADO*\n\n" +

        "👤 Nombre: " +
        clienteEliminar.nombre +
        "\n" +

        "📱 Teléfono: " +
        clienteEliminar.telefono +
        "\n" +

        "📺 Servicio: " +
        clienteEliminar.servicio +
        "\n" +

        "👥 Tipo: " +
        clienteEliminar.tipo +
        "\n\n" +

        "El cliente fue eliminado correctamente."
    );

    console.log(
        "Cliente eliminado:",
        telefonoEliminar
    );

    return;
}


// ==========================================
// COMANDO: CLIENTES QUE VENCEN MAÑANA
// ==========================================

if (
    textoComando === "vence mañana" ||
    textoComando === "vence manana"
) {

    const manana =
        new Date();

    manana.setHours(0, 0, 0, 0);

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

    const fechaManana =
        `${anio}-${mes}-${dia}`;

    const clientesManana =
        await Cliente.find({
            fechaVencimiento: fechaManana
        });

    if (clientesManana.length === 0) {

        await client.sendText(
            message.from,

            "📅 *CLIENTES QUE VENCEN MAÑANA*\n\n" +
            "No hay clientes que venzan mañana."
        );

        return;
    }

    let lista =
        "📅 *CLIENTES QUE VENCEN MAÑANA*\n\n";

    clientesManana.forEach(
        (cliente, indice) => {

            lista +=
                `${indice + 1}. 👤 ${cliente.nombre}\n` +
                `📱 ${cliente.telefono}\n` +
                `📺 ${cliente.servicio}\n` +
                `👥 ${cliente.tipo}\n` +
                `📅 Vence: ${cliente.fechaVencimiento}\n\n`;
        }
    );

    lista +=
        `Total: ${clientesManana.length} cliente(s).`;

    await client.sendText(
        message.from,
        lista
    );

    return;
}
// ==========================================
// COMANDO: ENVIAR RECORDATORIOS
// ==========================================

if (
    textoComando === "enviar recordatorio" ||
    textoComando === "enviar recordatorios"
) {

    const manana = new Date();

    manana.setHours(0, 0, 0, 0);

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

    const fechaManana =
        `${anio}-${mes}-${dia}`;

    const clientesManana =
        await Cliente.find({
            fechaVencimiento: fechaManana
        });

    if (clientesManana.length === 0) {

        await client.sendText(
            message.from,
            "🔔 *RECORDATORIOS*\n\n" +
            "No hay clientes para enviar recordatorio mañana."
        );

        return;
    }

    let enviados = 0;
    let errores = 0;
for (const cliente of clientesManana) {

    try {

        const numeroCliente =
            String(cliente.telefono)
                .replace(/\D/g, "")
                .slice(-10);

        if (numeroCliente.length !== 10) {

            console.log(
                "Teléfono inválido:",
                cliente.telefono
            );

            errores++;

            continue;
        }

        console.log(
            "Buscando contacto:",
            numeroCliente
        );

        const idNumero =
            numeroCliente + "@c.us";

        // ==========================================
        // VERIFICAR NÚMERO EN WHATSAPP
        // ==========================================

        const contacto =
            await client.checkNumberStatus(
                idNumero
            );

        console.log(
            "Resultado contacto:",
            contacto
        );

        if (
            !contacto ||
            contacto.status !== 200 ||
            !contacto.numberExists
        ) {

            console.log(
                "Número no disponible en WhatsApp:",
                numeroCliente
            );

            errores++;

            continue;
        }

        // ==========================================
        // OBTENER ID REAL DEL CONTACTO
        // ==========================================

        let idContacto =
            idNumero;

        if (
            contacto.id &&
            contacto.id._serialized
        ) {

            idContacto =
                contacto.id._serialized;
        }

        console.log(
            "ID inicial:",
            idContacto
        );

        // ==========================================
        // INTENTAR OBTENER CHAT
        // ==========================================

        try {

            const chat =
                await client.getChatById(
                    idContacto
                );

            console.log(
                "Chat encontrado:",
                chat &&
                chat.id
                    ? chat.id
                    : null
            );

            if (
                chat &&
                chat.id &&
                chat.id._serialized
            ) {

                idContacto =
                    chat.id._serialized;

                console.log(
                    "ID final del chat:",
                    idContacto
                );
            }

        } catch (errorChat) {

            console.log(
                "No se pudo obtener chat con ID:",
                idContacto
            );

            console.log(
                "Detalle:",
                errorChat.message
            );
        }

        // ==========================================
        // CREAR MENSAJE
        // ==========================================

        const mensajeRecordatorio =

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

        // ==========================================
        // ENVIAR RECORDATORIO
        // ==========================================

        console.log(
            "Enviando recordatorio a:",
            idContacto
        );

        await client.sendText(
            idContacto,
            mensajeRecordatorio
        );

        enviados++;

        console.log(
            "Recordatorio enviado correctamente a:",
            numeroCliente
        );

    } catch (errorEnvio) {

        errores++;

        console.error(
            "Error enviando recordatorio a:",
            cliente.telefono
        );

        console.error(
            errorEnvio
        );
    }
}

// ==========================================
// RESUMEN
// ==========================================

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
    clientesManana.length

);

return;

}


                // ==========================================
                // EXTRAER DATOS
                // ==========================================

                const cliente =
                    extraerCliente(
                        message.body
                    );

                console.log(
                    "Datos detectados:",
                    cliente
                );

                // ==========================================
                // VALIDAR DATOS OBLIGATORIOS
                // ==========================================

                const faltantes = [];

                if (!cliente.nombre) {
                    faltantes.push("nombre");
                }

                if (!cliente.telefono) {
                    faltantes.push("telefono");
                }

                if (!cliente.servicio) {
                    faltantes.push("servicio");
                }

                if (!cliente.tipo) {
                    faltantes.push("tipo");
                }

                if (!cliente.fechaInicio) {
                    faltantes.push(
                        "fecha de contratacion"
                    );
                }

                if (!cliente.fechaVencimiento) {
                    faltantes.push(
                        "fecha de vencimiento"
                    );
                }
// ==========================================
// VALIDAR TELÉFONO
// ==========================================

let telefonoLimpio = String(cliente.telefono || "")
    .replace(/\D/g, "");

// Si viene con código de México 52, quitarlo
if (telefonoLimpio.startsWith("52") && telefonoLimpio.length === 12) {
    telefonoLimpio = telefonoLimpio.substring(2);
}

// Aceptar cualquier lada de México
if (telefonoLimpio.length !== 10) {

    console.log(
        "Teléfono inválido:",
        telefonoLimpio
    );

    faltantes.push("teléfono (debe tener 10 dígitos)");

}
    
// ==========================================
// SI FALTAN DATOS
// ==========================================

if (faltantes.length > 0) {

    console.log(
        "Faltan datos:",
        faltantes
    );

    const datosFaltantes =
        faltantes
            .map(dato => "• " + dato)
            .join("\n");

    await client.sendText(
        message.from,

        "👋 ¡Hola!\n\n" +
        "📋 Gracias por enviar la información.\n\n" +
        "Para poder registrar correctamente su servicio, " +
        "necesitamos algunos datos adicionales.\n\n" +
        "⚠️ Datos faltantes:\n" +
        datosFaltantes +
        "\n\n" +
        "📝 Por favor, envíe la información faltante. " +
        "Puede escribirla en el formato que le resulte más cómodo.\n\n" +
        "✅ En cuanto recibamos todos los datos completos, " +
        "procederemos con el registro.\n\n" +
     "🙏 ¡Gracias por su preferencia!\n\n" +
        "📺 Plataformas Streaming Araiza"
    );

    return;
}   
// ==========================================
// BUSCAR CLIENTE EXISTENTE
// ==========================================

const clienteExistente =
    await Cliente.findOne({
        telefono: cliente.telefono
    });

// ==========================================
// ACTUALIZAR SI YA EXISTE
// ==========================================

if (clienteExistente) {

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
        "Cliente actualizado:",
        clienteExistente._id
    );

} else {

    // ==========================================
    // CREAR NUEVO CLIENTE
    // ==========================================

    const nuevoCliente =
        new Cliente(cliente);

    const guardado =
        await nuevoCliente.save();

    console.log(
        "Cliente guardado:",
        guardado._id
    );
}

// ==========================================
// CONFIRMACIÓN AL CLIENTE
// ==========================================

await client.sendText(
    message.from,

    "✅ ¡DATOS REGISTRADOS CORRECTAMENTE!\n\n" +

    "👤 Cliente: " +
    cliente.nombre +
    "\n\n" +

 "📱 Telfono: " +
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

    "😊 Esperamos que disfrute de su servicio.\n\n" +

    "🛠️ Si tiene cualquier inconveniente o necesita asistencia, " +
    "puede comunicarse con Plataformas Streaming Araiza.\n\n" +

    "🙏 ¡Gracias por su preferencia!\n\n" +

    "📺✨ Plataformas Streaming Araiza"
);

console.log(
    "✅ Confirmación enviada a:",
    message.from
);

            }catch (error) {

                console.error(
                    "Error procesando mensaje:"
                );

                console.error(error);
            }

        });

    })

    .catch((error) => {

        console.error(
            "Error al conectar WhatsApp:"
        );

        console.error(error);
    });


