
const path = require('path');
const dotenv = require('dotenv');
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";
const mongoose = require('mongoose');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const { attachUserInfo, jwtCheck, checkJwt, decodeToken } = require('../middleware/auth');
const helpers = require('./index');
const { ContactStatus } = require("../constants")
const axios = require('axios');



const { ObjectId } = require('mongoose').Types; // Asegúrate de importar esto
// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

const { Appointment, ContactAppointment } = require('../models/Appointments')

const main = async (appointmentId, req) => {
    const session = await mongoose.startSession();
    //console.log("DENTRO DE CONVERSATION este es IO",io)
    try {
        const appId = new ObjectId(appointmentId);
        const appointment = await Appointment.findOne(
            { _id: appId },
            {
                selectedAppDates: 1,
                phoneInput: 1,
                nameInput: 1,
                lastNameInput: 1,
                org_name: 1,
                org_id: 1,
                sid: 1,
            }
        ).populate('selectedAppDates.contact');

        if (!appointment) {
            throw new Error("❌ Appointment not found");
        }

        const selectedDate = appointment.selectedAppDates?.[0];

        if (!selectedDate) {
            throw new Error("❌ No selectedAppDates found");
        }

        const contact = selectedDate;
        const status = contact?.status ?? ContactStatus.NoContacted;
        switch (status) {
            case ContactStatus.NoContacted:
            case ContactStatus.Confirmed:
            case ContactStatus.Rejected:
                console.log("🟡 Estado: NoContacted, Confirmed o Rejected");
                await patientNoContacted(appointment, session);
                break;

            case ContactStatus.Pending:
                console.log("🟠 Estado: Pending");
                await patientPending(appointment, req, session);
                break;

            case ContactStatus.Contacted:
                console.log("🟢 Paciente ya fue contactado");
                break;

            default:
                console.warn("⚠️ Estado desconocido o inválido:", status);
                break;
        }

    } catch (error) {
        console.error("❌ Error ejecutando `main`:", error.message);
    }
};

const patientNoContacted = async (appointment, session) => {
    if (!appointment) {
        console.log("Appointment not found");
        return;
    }

    const appId = appointment._id;

    try {
        const phone = convertToE164(appointment.phoneInput);
        const startDate = new Date(appointment.selectedAppDates[0].startDate);
        const endDate = new Date(appointment.selectedAppDates[0].endDate);
        const propStartDate = new Date(appointment.selectedAppDates[0].propStartDate ?? appointment.selectedAppDates[0].startDate);
        const propEndDate = new Date(appointment.selectedAppDates[0].propEndDate ?? appointment.selectedAppDates[0].endDate);
        const org_id = appointment.org_id;
        const orgName = appointment.org_name;
        const startDateFormatted = formatSydneyDateRange(startDate, endDate);
        const propstartDateFormatted = formatSydneyDateRange(propStartDate, propEndDate);
        const friendlyName = `Appointment request for ${appointment.nameInput} ${appointment.lastNameInput}`;
        const confirmationMessage = `Hi ${appointment.nameInput} ${appointment.lastNameInput}, this is ${orgName}. We have a proposed appointment for you on ${propstartDateFormatted}. Please reply with *YES* to confirm your attendance or *NO* if you are unable to attend. Only replies with YES or NO will be accepted.`;

        const conv = await findConversationBySidSafely(appointment.sid);
        if (!conv) {
            console.log("No se ha asignado conversación");
        }

        const cSid = conv?.sid;

        await Appointment.updateOne(
            { _id: appId },
            {
                $set: {
                    lastMessageInteraction: sanitizeText(confirmationMessage),
                    "selectedAppDates.0.status": ContactStatus.Pending,
                },
            },
            { session }
        );

        const savedContact = await ContactAppointment.create(
            [
                {
                    appointmentId: appId,
                    status: ContactStatus.Pending,
                    context: friendlyName,
                    cSid,
                    pSid: null,
                },
            ],
            { session }
        );

        if (appointment.selectedAppDates?.length > 0) {
            appointment.selectedAppDates[0].contact = savedContact[0]._id;
            await appointment.save({ session });


            try {
                await sendMessage(cSid, confirmationMessage, org_id);

                console.log('✅ SMS enviado');
            } catch (sendErr) {
                console.error('❌ Error al enviar SMS:', sendErr.message);
            }
        } else {
            console.warn('⚠️ Este appointment no tiene selectedAppDates');
        }

    } catch (err) {
        console.error('❌ Error en patientNoContacted:', err.message);
        throw err; // Importante: lanza el error para que main lo detecte y haga rollback
    }
};




const patientPending = async (appointment, req, session) => {
    if (!appointment || !appointment.selectedAppDates?.length) {
        console.warn("⚠️ Appointment inválido o sin fechas seleccionadas");
        return;
    }

    const appId = appointment._id;
    const org_id = appointment.org_id;
    const selectedDate = appointment.selectedAppDates[0];
    const contact = selectedDate.contact;
    const cSid = contact?.cSid;
    const contactId = contact?._id;
    const orgRoom = `${org_id.toLowerCase().replace(/\s+/g, '_')}`;

    if (!contactId || !mongoose.Types.ObjectId.isValid(contactId)) {
        console.warn("⚠️ contactId inválido o faltante:", contactId);
        return;
    }

    if (!cSid) {
        console.warn("⚠️ Falta información de conversación (cSid)");
        return;
    }

    try {
        const msgList = await listMessages(cSid);
        const lastPatientMessage = msgList
            .slice()
            .reverse()
            .find((msg) => msg.author?.toLowerCase() !== org_id?.toLowerCase());

        if (!lastPatientMessage) {
            console.log("ℹ️ No hay respuesta del paciente todavía.");
            return;
        }

        const rawMessage = lastPatientMessage.body;
        const cleanMessage = sanitizePatientReply(rawMessage);
        console.log("📨 Respuesta del paciente (limpia):", cleanMessage);

        if (cleanMessage === 'yes') {
            console.log("✅ Paciente confirmó la cita");

            const propStartDate = new Date(selectedDate.propStartDate || selectedDate.startDate);
            const propEndDate = new Date(selectedDate.propEndDate || selectedDate.endDate);

            const appointmentUpdate = await Appointment.updateOne(
                { _id: appId },
                {
                    $set: {
                        reschedule: true,
                        "selectedAppDates.0.startDate": propStartDate,
                        "selectedAppDates.0.endDate": propEndDate,
                        "selectedAppDates.0.status": ContactStatus.Confirmed,
                    },
                },
                { session }
            );

            const contactUpdate = await ContactAppointment.updateOne(
                { _id: contactId },
                { $set: { status: ContactStatus.Confirmed } },
                { session }
            );

            const daterange = await Appointment.findOne(
                { _id: appId },
                { selectedAppDates: 1 }
            );

            if (req?.io) {
                req.io.to(orgRoom).emit('smsReceived', {
                    from: appointment.phoneInput,
                    name: `${appointment.nameInput} ${appointment.lastNameInput}`,
                    date: formatSydneyDateRange(
                        daterange.selectedAppDates[0].startDate,
                        daterange.selectedAppDates[0].endDate
                    ),
                    body: 'yes',
                    notification: true,
                    receivedAt: new Date(),
                });
                console.log("📡 Emitido por socket correctamente");
                console.log("appointment", appointment)
            }

            console.log("📝 Actualización completada:", {
                appointmentUpdate,
                contactUpdate,
            });

        } else if (cleanMessage === 'no') {
            console.log("❌ Paciente rechazó la cita");

            await ContactAppointment.updateOne(
                { _id: contactId },
                { $set: { status: ContactStatus.Rejected } },
                { session }
            );

            await Appointment.updateOne(
                { _id: appId },
                {
                    $set: {
                        "selectedAppDates.0.status": ContactStatus.Rejected,
                    },
                },
                { session }
            );

            if (req?.io) {
                req.io.to(orgRoom).emit('smsReceived', {
                    from: appointment.phoneInput,
                    name: `${appointment.nameInput} ${appointment.lastNameInput}`,
                    date: formatSydneyDateRange(
                        selectedDate.startDate,
                        selectedDate.endDate
                    ),
                    body: 'no',
                    receivedAt: new Date(),
                    notification: true,
                });
                console.log("📡 Emitido por socket correctamente");
            }

        } else {
            console.log("⚠️ Respuesta inválida o ambigua:", rawMessage);

            if (req?.io) {
                req.io.to(orgRoom).emit('smsReceived', {
                    from: appointment.phoneInput,
                    name: `${appointment.nameInput} ${appointment.lastNameInput}`,
                    body: 'out-of-context',
                    receivedAt: new Date(),
                    notification: true,
                });
                console.log("📡 Emitido por socket correctamente");
            }
        }
        await helpers.refreshSocketObject(appointment, req) //actualizar en chats

    } catch (err) {
        console.error("❌ Error en patientPending:", err.message);
        throw err; // 🔁 Para que main haga rollback
    }
};


function sanitizePatientReply(message) {
    return typeof message === 'string'
        ? message
            .toLowerCase()
            .replace(/[^a-z]/g, '') // eliminar todo lo que no sea letra
            .trim()
        : '';
}

function sanitizeText(input, options = { removePunctuation: true, removeSpaces: true }) {
    if (typeof input !== "string") return "";

    let text = input.trim().toLowerCase();

    if (options.removePunctuation) {
        text = text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()"?¿!¡@[\]\\']/g, "");
    }

    if (options.removeSpaces) {
        text = text.replace(/\s+/g, "");
    }

    return text;
}


function formatSydneyDateRange(startDate, endDate) {
    const dateOptions = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Australia/Sydney',
    };

    const timeOptions = {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Australia/Sydney',
    };

    const dateFormatter = new Intl.DateTimeFormat('en-AU', dateOptions);
    const timeFormatter = new Intl.DateTimeFormat('en-AU', timeOptions);

    const dateStrStart = dateFormatter.format(startDate);
    const dateStrEnd = dateFormatter.format(endDate);
    const timeStrStart = timeFormatter.format(startDate);
    const timeStrEnd = timeFormatter.format(endDate);

    if (dateStrStart === dateStrEnd) {
        return `${dateStrStart}, ${timeStrStart} - ${timeStrEnd}`;
    } else {
        return `${dateStrStart}, ${timeStrStart} - ${dateStrEnd}, ${timeStrEnd}`;
    }
}



const convertToE164 = (phone) => {
    if (typeof phone !== 'string') return null;

    // Eliminar espacios, guiones y paréntesis
    const cleaned = phone.replace(/[\s\-()]/g, '');

    // Si comienza con 0 y tiene 10 dígitos (ej. 0412345678)
    if (/^0\d{9}$/.test(cleaned)) {
        return '+61' + cleaned.slice(1);
    }

    // Si ya está en formato E.164 correcto, devolverlo tal cual
    if (/^\+61\d{9}$/.test(cleaned)) {
        return cleaned;
    }

    // No válido o no convertible
    return null;
}

function convertToLocalMobile(ausPhone) {
    if (typeof ausPhone !== 'string') return '';

    if (ausPhone.startsWith('+61')) {
        return '0' + ausPhone.slice(3); // Elimina +61 y agrega 0
    }

    return ausPhone; // Devuelve tal cual si no comienza con +61
}


async function deleteConversation(conversationSid) {
    if (!conversationSid || typeof conversationSid !== 'string') {
        throw new Error('conversationSid es obligatorio y debe ser un string válido.');
    }

    try {
        await client.conversations.v1.conversations(conversationSid).remove();
        console.log(`🗑️ Conversación eliminada: ${conversationSid}`);
        return true;
    } catch (error) {
        console.error(`❌ Error al eliminar conversación ${conversationSid}:`, error.message);
        throw error;
    }
}

async function deleteConversationsByParticipantAddress(targetAddress) {
    if (!targetAddress || typeof targetAddress !== 'string') {
        throw new Error('El address es obligatorio y debe ser un string válido.');
    }

    try {
        const conversations = await client.conversations.v1.conversations.list({ limit: 100 });
        let deletedCount = 0;

        for (const convo of conversations) {
            const participants = await client.conversations.v1
                .conversations(convo.sid)
                .participants
                .list();

            const match = participants.find(
                (p) => p.messagingBinding?.address === targetAddress
            );

            if (match) {
                await client.conversations.v1.conversations(convo.sid).remove();
                console.log(`🗑️ Eliminada conversación ${convo.sid} (nombre: ${convo.friendlyName || 'sin nombre'})`);
                deletedCount++;
            }
        }

        console.log(`✅ Total de conversaciones eliminadas: ${deletedCount}`);
        return deletedCount;

    } catch (error) {
        console.error('❌ Error al eliminar conversaciones:', error.message);
        throw error;
    }
}


async function createConversationWithParticipant(friendlyName, address, proxyAddress) {
    if (!friendlyName || !address || !proxyAddress) {
        throw new Error('Todos los parámetros (friendlyName, address, proxyAddress) son obligatorios.');
    }

    try {
        // Crear la conversación
        const conversation = await client.conversations.v1.conversations.create({ friendlyName });
        console.log(`✅ Conversación creada: ${conversation.sid}`);

        // Agregar participante por address (formato correcto)

        const participant = await client.conversations.v1
            .conversations(conversation.sid)
            .participants
            .create({
                'messagingBinding.address': address,
                'messagingBinding.proxyAddress': proxyAddress,
            });

        console.log(`➕ Participante agregado: ${participant.sid}`);

        return {
            conversationSid: conversation.sid,
            participantSid: participant.sid,
        };

    } catch (error) {
        console.error('❌ Error al crear conversación o agregar participante:', error.message);
        throw error;
    }
}

async function createConversationParticipant() {



    const id = "CHf13ddb1a92964a228d8e8059c670300a"
    const messageBody = "Hola, tu cita está confirmada para el jueves a las 10 am. ✅";




    //addParticipants(id, "+61411710260","+61482088223")

    // 3. Enviar mensaje
    //sendMessage(id, messageBody)
    listMessages(id)
}

const addParticipants = async (id, address, proxy) => {
    const participant = await client.conversations.v1
        .conversations(id)
        .participants.create({
            "messagingBinding.address": address,
            "messagingBinding.proxyAddress": proxy,
        });

    console.log(participant.sid);

}

const delConversations = async () => {
    const conversations = await client.conversations.v1.conversations.list();
    for (const conv of conversations) {
        await client.conversations.v1.conversations(conv.sid).remove();
        console.log(`✅ Eliminada conversación: ${conv.sid} (${conv.friendlyName || conv.uniqueName})`);
    }

    console.log(`📋 Conversaciones encontradas: ${conversations.length}`);
    conversations.forEach(c => {
        console.log(`- SID: ${c.sid}`);
        console.log(`  Unique Name: ${c.uniqueName}`);
        console.log(`  Friendly Name: ${c.friendlyName}`);
        console.log(`  State: ${c.state}`);
        console.log(`  Date Created: ${c.dateCreated}`);
        console.log('---');
    });
}

const sendMessage = async (id, messageBody, org_id) => {
    console.log("EL MENSAJE SE ENVIA A NOMBRE DE", org_id)
    try {
        const message = await client.conversations.v1
            .conversations(id)
            .messages
            .create({
                author: org_id,
                body: messageBody,
            });

        console.log("✅ Mensaje enviado:", message.sid);
        return message; // opcional, por si quieres usarlo
    } catch (error) {
        console.error("❌ Error al enviar mensaje:", error.message);
        throw error; // ⬅️ Esto es lo que permite detectar el fallo desde fuera
    }
};


const listMessages = async (cSid, limit = 100) => {
    try {
        // Verifica si la conversación existe
        const conversation = await client.conversations.v1.conversations(cSid).fetch();
        if (!conversation) {
            console.warn(`⚠️ Conversation with SID ${cSid} not found.`);
            return [];
        }

        // Listar mensajes
        const messages = await client.conversations.v1
            .conversations(cSid)
            .messages
            .list({ limit });

        console.log(`📨 ${messages.length} message(s) found in conversation ${cSid}`);
        return messages;

    } catch (error) {
        if (error.code === 20404) {
            // Twilio "resource not found"
            console.warn(`❌ Conversation ${cSid} does not exist or was deleted.`);
        } else {
            console.error(`❌ Failed to list messages for cSid=${cSid}:`, error.message);
        }
        return [];
    }
};



const findConversationsByPhone = async (phone) => {
    if (!phone || typeof phone !== 'string') {
        throw new Error('Número inválido');
    }

    try {
        const conversations = await client.conversations.v1.conversations.list({ limit: 100 });

        for (const convo of conversations) {
            const participants = await client.conversations.v1
                .conversations(convo.sid)
                .participants
                .list();

            const match = participants.find(
                (p) => p.messagingBinding?.address === phone
            );

            if (match) {
                console.log(`✅ Teléfono ${phone} está en la conversación ${convo.sid}`);
                return convo.sid;
            }
        }

        console.log(`❌ No se encontró el número ${phone} en ninguna conversación`);
        return null;

    } catch (err) {
        console.error('❌ Error al buscar:', err.message);
        return null;
    }
};


const listParticipants = async (id) => {
    const participants = await client.conversations.v1
        .conversations(id)
        .participants
        .list();
    console.log("👥 Participantes en la conversación:");
    participants.forEach(p => {
        console.log(`- SID: ${p.sid}`);
        console.log(`  Address: ${p.messagingBinding?.address}`);
        console.log(`  Proxy: ${p.messagingBinding?.proxyAddress}`);
        console.log(`  Identity: ${p.identity}`);
        console.log('---');
    });
}

const listAllConversations = async () => {
    try {
        const conversations = await client.conversations.v1.conversations.list({ limit: 100 }); // puedes aumentar el límite
        if (conversations.length === 0) {
            console.log('ℹ️ No hay conversaciones registradas.');
            return [];
        }

        conversations.forEach(convo => {
            console.log(`📌 SID: ${convo.sid} | Name: ${convo.friendlyName || '(sin nombre)'}`);
        });

        return conversations.map(convo => ({
            sid: convo.sid,
            friendlyName: convo.friendlyName,
            dateCreated: convo.dateCreated,
        }));

    } catch (error) {
        console.error('❌ Error al listar conversaciones:', error.message);
        throw error;
    }
}

async function deleteConversationsBySid(conversationSids) {
    if (!Array.isArray(conversationSids) || conversationSids.length === 0) {
        throw new Error('Debes proporcionar un array de conversationSids.');
    }

    let deletedCount = 0;

    for (const sid of conversationSids) {
        try {
            await client.conversations.v1.conversations(sid).remove();
            console.log(`🗑️ Conversación eliminada: ${sid}`);
            deletedCount++;
        } catch (err) {
            console.error(`❌ Error al eliminar ${sid}:`, err.message);
        }
    }

    console.log(`✅ Total de conversaciones eliminadas: ${deletedCount}`);
    return deletedCount;
}

if (require.main === module) {
    const appointmentId = process.argv[2]; // El ID se pasa como argumento
    if (!appointmentId) {
        console.error("❌ Debes pasar un appointmentId como argumento.");
        process.exit(1);
    }

    main(appointmentId);
}



async function createConversationAndAddParticipant(phoneNumber, proxyNumber, meta = {}, userId) {
    console.log("------------------------------------------------->", userId)
    if (!/^\+61\d{9}$/.test(phoneNumber)) {
        throw new Error('El número debe estar en formato E.164: +61XXXXXXXXX');
    }

    // 1. Crear conversación con atributos personalizados
    const conversation = await client.conversations.v1.conversations.create({
        friendlyName: `Chat con ${meta.nameInput || 'Paciente'}`,
        attributes: JSON.stringify({
            phone: phoneNumber,
            patientId: meta.patientId || null,
            name: meta.nameInput || '',
            org_id: meta.org_id || '',
        }),
    });

    console.log(`✅ Conversación creada: ${conversation.sid}`);

    // 2. Agregar al participante SMS
    await client.conversations.v1.conversations(conversation.sid)
        .participants
        .create({
            "messagingBinding.address": phoneNumber,
            "messagingBinding.proxyAddress": proxyNumber,
        });

    console.log(`✅ Participante ${phoneNumber} agregado.`);

    // 3. Guardar conversationSid en MongoDB
    const update = await Appointment.findOneAndUpdate(
        { phoneInput: phoneNumber },
        { conversationSid: conversation.sid,  user: userId },
        { new: true }
    );

    if (update) {
        console.log(`✅ conversationSid guardado en DB para ${phoneNumber}`);
    } else {
        console.warn(`⚠️ No se encontró el documento en DB para guardar el conversationSid`);
    }

    return conversation.sid;
}
async function findConversationByPhoneSafely(phone) {
    try {
        // Validación básica de formato
        if (typeof phone !== 'string' || !/^\+61\d{9}$/.test(phone)) {
            throw new Error(`❌ Formato de número inválido: ${phone}`);
        }

        console.log(`🔍 Buscando conversación para: ${phone}`);

        const conversations = await client.conversations.v1.conversations.list({ limit: 100 });

        for (const convo of conversations) {
            let attrs = {};

            try {
                attrs = convo.attributes ? JSON.parse(convo.attributes) : {};
            } catch (err) {
                console.warn(`⚠️ No se pudo parsear attributes de ${convo.sid}`);
            }

            if (attrs.phone === phone) {
                console.log(`✅ Conversación encontrada: ${convo.sid}`);
                return convo.sid;
            }
        }

        console.log(`❌ No se encontró ninguna conversación con el número ${phone}`);
        return null;

    } catch (error) {
        console.error(`❌ Error en findConversationByPhoneSafely:`, error.message);
        return null;
    }
}
async function findConversationBySidSafely(sid) {
    try {
        // Validación básica de formato del SID
        if (typeof sid !== 'string' || !/^CH[a-f0-9]{32}$/.test(sid)) {
            throw new Error(`❌ Formato de SID inválido: ${sid}`);
        }

        console.log(`🔍 Buscando conversación con SID: ${sid}`);

        const conversation = await client.conversations.v1.conversations(sid).fetch();

        if (conversation) {
            console.log(`✅ Conversación encontrada: ${conversation.sid}`);
            return conversation;
        } else {
            console.log(`❌ No se encontró ninguna conversación con el SID ${sid}`);
            return null;
        }
    } catch (error) {
        console.error(`❌ Error en findConversationBySidSafely:`, error.message);
        return null;
    }
}

async function addSmsParticipantToConversation(conversationSid, phoneNumber, proxyNumber) {
    try {
        // Validaciones
        if (!/^CH[a-zA-Z0-9]{32}$/.test(conversationSid)) {
            throw new Error('❌ conversationSid inválido');
        }

        if (!/^\+61\d{9}$/.test(phoneNumber)) {
            throw new Error('❌ Número de teléfono inválido. Debe ser E.164 +61XXXXXXXXX');
        }

        if (!/^\+61\d{9}$/.test(proxyNumber)) {
            throw new Error('❌ proxyNumber inválido');
        }

        // Agregar nuevo participante SMS (forma funcional: dot notation)
        const participant = await client.conversations.v1
            .conversations(conversationSid)
            .participants
            .create({
                "messagingBinding.address": phoneNumber,
                "messagingBinding.proxyAddress": proxyNumber,
            });

        console.log(`✅ Participante ${phoneNumber} agregado a la conversación ${conversationSid} → SID: ${participant.sid}`);

        return conversationSid;

    } catch (error) {
        console.error('❌ Error en addSmsParticipantToConversation:', error.message);
        throw error;
    }
}

const isThisSMSaConfirmation = async (req, appointment) => {
    const { ConversationSid } = req.body;

    const lastMessageInteraction = appointment.lastMessageInteraction
    // Traemos los últimos 5 mensajes para asegurar contexto
    const messages = await client.conversations.v1
        .conversations(ConversationSid)
        .messages
        .list({ limit: 5, order: 'desc' });

    if (messages.length < 2) {
        console.log("❌ No hay suficientes mensajes para comparar.");
        return false;
    }

    const [latest, previous] = messages; // mensajes ordenados del más reciente al más antiguo
    console.log("ultimo: ", latest.body, "Penultimo: ", previous.body)

    console.log(sanitizeText(previous.body))
    const isPreviousConfirmationRequest =
        previous.author === appointment.org_id &&
        sanitizeText(previous.body) === sanitizeText(lastMessageInteraction);

    console.log(isPreviousConfirmationRequest)

    const isCurrentFromPatient = latest.author !== appointment.org_id.toLowerCase();
    console.log("previous.author", previous.author, "appointment.org_id", appointment.org_id.toLowerCase())
    console.log("latest.author", latest.author, "appointment.org_id", appointment.org_id.toLowerCase())
    console.log("isPreviousConfirmationRequest ", isPreviousConfirmationRequest, previous.author, " ===", appointment.org_id, "&&",
        sanitizeText(previous.body), "===", sanitizeText(lastMessageInteraction))
    console.log("isCurrentFromPatient ", isCurrentFromPatient, latest.author, appointment.org_id)
    if (isPreviousConfirmationRequest && isCurrentFromPatient) {
        console.log("✅ Este mensaje parece una confirmación del paciente.");
        return true;
    }

    console.log("❌ Este mensaje no es una confirmación .");
    return false;
};


/**
 * Obtiene los metadatos de un archivo multimedia desde Twilio Conversations API.
 *
 * @param {string} metadataUrl - URL completa del recurso de Media en Twilio (no la URL del archivo directo).
 * @param {string} accountSid - Twilio Account SID.
 * @param {string} authToken - Twilio Auth Token.
 * @returns {Promise<Object>} - Objeto con los metadatos del archivo (JSON).
 */
async function getTwilioMediaMetadata(metadataUrl, accountSid, authToken) {
    if (!metadataUrl || !accountSid || !authToken) {
        throw new Error('Missing metadataUrl, accountSid, or authToken');
    }

    try {
        const response = await axios.get(metadataUrl, {
            auth: {
                username: accountSid,
                password: authToken
            },
            headers: {
                'Accept': 'application/json'
            }
        });

        return response.data;
    } catch (err) {
        console.error('❌ Error fetching Twilio media metadata:', err.message);
        throw err;
    }
}

const serviceCache = new Map(); // CH -> { is, ts }

async function getServiceSidForConversation(conversationSid) {
    const hit = serviceCache.get(conversationSid);
    if (hit && Date.now() - hit.ts < 5 * 60_000) return hit.is; // 5 min de TTL

    const conv = await client.conversations.v1.conversations(conversationSid).fetch();
    console.log("Conversation fetched:", conv);
    const is = conv.chatServiceSid;
    serviceCache.set(conversationSid, { is, ts: Date.now() });
    return is;
}
async function uploadToMCS(fileBuffer, filename, contentType) {
    const serviceSid = process.env.TWILIO_CONVERSATIONS_SERVICE_SID
    const mcsUrl = `https://mcs.us1.twilio.com/v1/Services/${serviceSid}/Media`;
    console.log(mcsUrl)
    const resp = await axios.post(mcsUrl, fileBuffer, {
        auth: { username: accountSid, password: authToken },
        headers: {
            'Content-Type': contentType || 'application/octet-stream',
            'X-Twilio-Filename': filename || 'file',
        },
    });
    console.log("resp", resp?.data)
    return resp?.data; // ME...
}

function decideFromBody(body = "") {
    const t = body.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();

    const YES = /^(si|sí|s|ok|vale|dale|confirmo|confirm|listo|de acuerdo|perfecto|correcto|okey)\b/iu;
    const NO = /^(no|nop|nah|cancel|cancela|no puedo|no voy|rechazo)\b/iu;
    const RE = /\b(reagendar|reagenda|otro dia|otra fecha|cambiar hora|reprogramar|posponer|move|reschedule)\b/iu;

    if (YES.test(t)) return "confirmed";
    if (NO.test(t)) return "declined";
    if (RE.test(t)) return "reschedule";
    return "unknown";
}

// ➋ Encuentra el OUTBOUND Confirmation anterior
async function findPrevOutboundConfirmation({ conversationId, nowIndex, nowCreatedAt }) {
    const MAX_AGE_MS = 72 * 3600 * 1000;
    const now = new Date();

    // Filtro base
    const base = {
        conversationId,
        direction: "outbound",
        type: "Confirmation",
        $or: [{ resolvedBySid: null }, { resolvedBySid: { $exists: false } }],
        createdAt: { $gte: new Date(now.getTime() - MAX_AGE_MS) },
    };

    // Si tienes index numérico fiable, úsalo para “anterior”
    if (typeof nowIndex === "number") {
        base.index = { $lt: nowIndex };
    } else {
        // respaldo por tiempo si index es string/inconsistente
        base.createdAt.$lt = nowCreatedAt;
    }

    return await Message.findOne(base).sort({ index: -1, createdAt: -1 }).lean();
}

module.exports = {
    findPrevOutboundConfirmation,
    uploadToMCS,
    getServiceSidForConversation,
    getTwilioMediaMetadata,
    formatSydneyDateRange,
    sanitizeText,
    isThisSMSaConfirmation,
    findConversationBySidSafely,
    addSmsParticipantToConversation,
    createConversationAndAddParticipant,
    main,
    convertToLocalMobile,
    findConversationByPhoneSafely
};