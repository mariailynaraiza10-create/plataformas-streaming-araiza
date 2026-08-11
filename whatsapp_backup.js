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
const textoComando = normalizar(message.body);

// ------------------------------------------
// BUSCAR CLIENTE POR TELÃ‰FONO
// Ejemplo: buscar 6629876543
// ------------------------------------------

if (textoComando.startsWith("buscar ")) {

    const telefonoBuscar =
        message.body
            .replace(/^buscar\s+/i, "")
            .replace(/\D/g, "");

    if (!telefonoBuscar) {

        await client.sendText(
            message.from,
            "âŒ Debes escribir un nÃºmero de telÃ©fono.\n\n" +
            "Ejemplo:\n" +
            "buscar 6629876543"
        );

        return;
    }

    const clienteBuscado =
        await Cliente.findOne({
            telefono: telefonoBuscar
        });

    if (!clienteBuscado) {

        await client.sendText(
            message.from,
            "âŒ No encontrÃ© ningÃºn cliente con el telÃ©fono:\n" +
            telefonoBuscar
        );

        return;
    }

    await client.sendText(

        message.from,

        "ðŸ”Ž *CLIENTE ENCONTRADO*\n\n" +

        "ðŸ‘¤ Nombre: " +
        clienteBuscado.nombre +
        "\n" +

        "ðŸ“± TelÃ©fono: " +
        clienteBuscado.telefono +
        "\n" +

        "ðŸ“º Servicio: " +
        clienteBuscado.servicio +
        "\n" +

        "ðŸ‘¥ Tipo: " +
        clienteBuscado.tipo +
        "\n" +

        "ðŸ“… Fecha de contrataciÃ³n: " +
        clienteBuscado.fechaInicio +
        "\n" +

        "ðŸ“… Fecha de vencimiento: " +
        clienteBuscado.fechaVencimiento
    );

    return;
}


// ------------------------------------------
// ELIMINAR CLIENTE
// Ejemplo: elimina a 6629876543
// ------------------------------------------

if (
    textoComando.startsWith("elimina a ") ||
    textoComando.startsWith("eliminar a ")
) {

    const telefonoEliminar =
        message.body
            .replace(/^elimina(?:r)?\s+a\s+/i, "")
            .replace(/\D/g, "");

    if (!telefonoEliminar) {

        await client.sendText(
            message.from,
            "âŒ Debes escribir el nÃºmero del cliente.\n\n" +
            "Ejemplo:\n" +
            "elimina a 6629876543"
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
            "âŒ No encontrÃ© ningÃºn cliente con el telÃ©fono:\n" +
            telefonoEliminar
        );

        return;
    }

    await Cliente.deleteOne({
        _id: clienteEliminar._id
    });

    await client.sendText(

        message.from,

        "ðŸ—‘ï¸ *CLIENTE ELIMINADO*\n\n" +

        "ðŸ‘¤ Nombre: " +
        clienteEliminar.nombre +
        "\n" +

        "ðŸ“± TelÃ©fono: " +
        clienteEliminar.telefono +
        "\n" +

        "ðŸ“º Servicio: " +
        clienteEliminar.servicio +
        "\n\n" +

        "El cliente fue eliminado correctamente."
    );

    console.log(
        "Cliente eliminado:",
        telefonoEliminar
    );

    return;
}


// ------------------------------------------
// CLIENTES QUE VENCEN MAÃ‘ANA
// ------------------------------------------

if (
    textoComando === "vence maÃ±ana" ||
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
            "âœ… No hay clientes que venzan maÃ±ana."
        );

        return;
    }

    let lista =
        "ðŸ“… *CLIENTES QUE VENCEN MAÃ‘ANA*\n\n";

    clientesManana.forEach(
        (cliente, indice) => {

            lista +=
                `${indice + 1}. ðŸ‘¤ ${cliente.nombre}\n` +
                `ðŸ“± ${cliente.telefono}\n` +
                `ðŸ“º ${cliente.servicio}\n` +
                `ðŸ‘¥ ${cliente.tipo}\n` +
                `ðŸ“… Vence: ${cliente.fechaVencimiento}\n\n`;
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


// ------------------------------------------
// ENVIAR RECORDATORIO
// ------------------------------------------

if (
    textoComando === "enviar recordatorio" ||
    textoComando === "enviar recordatorios"
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
            "âœ… No hay clientes para enviar recordatorio maÃ±ana."
        );

        return;
    }

    let enviados = 0;

    for (
        const cliente of clientesManana
    ) {

        try {

            await client.sendText(

                cliente.telefono + "@c.us",

                "ðŸ”” *RECORDATORIO DE RENOVACIÃ“N*\n\n" +

                "Hola " +
                cliente.nombre +
                " ðŸ‘‹\n\n" +

                "Tu servicio de *" +
                cliente.servicio +
                "* vence maÃ±ana.\n\n" +

                "ðŸ“… Fecha de vencimiento: " +
                cliente.fechaVencimiento +
                "\n\n" +

                "Si deseas renovar tu servicio, " +
                "por favor comunÃ­cate con " +
                "Plataformas Streaming Araiza.\n\n" +

                "Â¡Gracias por tu preferencia! ðŸ™Œ"
            );

            enviados++;

            console.log(
                "Recordatorio enviado a:",
                cliente.telefono
            );

        } catch (error) {

            console.error(
                "Error enviando recordatorio a:",
                cliente.telefono
            );

            console.error(error);
        }
    }

    await client.sendText(

        message.from,

        "âœ… *RECORDATORIOS ENVIADOS*\n\n" +

        "Se enviaron " +
        enviados +
        " de " +
        clientesManana.length +
        " recordatorio(s)."
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
                    faltantes.push("telÃ©fono");
                }

                if (!cliente.servicio) {
                    faltantes.push("servicio");
                }

                if (!cliente.tipo) {
                    faltantes.push("tipo");
                }

                if (!cliente.fechaInicio) {
                    faltantes.push(
                        "fecha de contrataciÃ³n"
                    );
                }

                if (!cliente.fechaVencimiento) {
                    faltantes.push(
                        "fecha de vencimiento"
                    );
                }

                // ==========================================
                // SI FALTAN DATOS
                // ==========================================

                if (faltantes.length > 0) {

                    console.log(
                        "Faltan datos:",
                        faltantes
                    );

                    await client.sendText(
                        message.from,

                        "Hola ðŸ‘‹\n\n" +
                        "Gracias por enviar la informaciÃ³n. " +
                        "Para poder registrar correctamente su servicio, " +
                        "necesitamos algunos datos adicionales.\n\n" +
                        "Por favor, envÃ­e la informaciÃ³n faltante. " +
                        "Puede escribirla en el formato que le resulte mÃ¡s cÃ³modo. ðŸ“‹\n\n" +
                        "En cuanto recibamos los datos completos, " +
                        "procederemos con el registro. âœ…\n\n" +
                        "Atentamente,\n" +
                        "Plataformas Streaming Araiza"
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
// CONFIRMACIÃ“N AL CLIENTE
// ==========================================

await client.sendText(

    message.from,

    "âœ… *Datos registrados correctamente.*\n\n" +

    "ðŸ‘¤ Cliente: " +
    cliente.nombre +
    "\n" +

    "ðŸ“º Servicio: " +
    cliente.servicio +
    "\n" +

    "ðŸ‘¥ Tipo de cuenta: " +
    cliente.tipo +
    "\n" +

    "ðŸ“… Fecha de contrataciÃ³n: " +
    cliente.fechaInicio +
    "\n" +

    "ðŸ“… Fecha de vencimiento: " +
    cliente.fechaVencimiento +
    "\n\n" +

    "ðŸ”” Un dÃ­a antes de la fecha de vencimiento " +
    "recibirÃ¡ un recordatorio para renovar su servicio.\n\n" +

    "ðŸ˜Š Esperamos que disfrute de su servicio.\n\n" +

    "Si tiene cualquier inconveniente o necesita asistencia, " +
    "puede comunicarse con Plataformas Streaming Araiza.\n\n" +

    "Gracias por su preferencia. ðŸ™Œ"
);

                console.log(
                    "ConfirmaciÃ³n enviada a:",
                    message.from
                );

            } catch (error) {

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


