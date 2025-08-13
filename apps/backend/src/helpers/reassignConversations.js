const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const twilio = require('twilio');
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

const mongoConnect = require('../config/db');
const { Appointment } = require('../models/Appointments'); // Ajusta si usas ContactAppointment
mongoConnect();

const proxyNumber = "+61482088223"; // Usa desde .env

/**
 * Convierte número local australiano a formato E.164
 */
function localToE164AU(localNumber) {
  if (typeof localNumber !== 'string') throw new Error('El número debe ser un string');
  const cleaned = localNumber.replace(/[\s\-()]/g, '');
  if (!/^0\d{9}$/.test(cleaned)) throw new Error(`Número australiano inválido: ${localNumber}`);
  return '+61' + cleaned.slice(1);
}

/**
 * Crea una conversación Twilio con atributos y agrega participante SMS
 */
async function createConversation(phone, lastname, name, org_id, patientId) {
  // Validación del número proxy
  if (!/^\+61\d{8,9}$/.test(proxyNumber)) {
    throw new Error('❌ Número Twilio proxy no válido o no definido');
  }

  // 1. Crear conversación con atributos útiles
  const conversation = await client.conversations.v1.conversations.create({
    friendlyName: `${name} ${lastname}`,
    attributes: JSON.stringify({
      phone,
      name,
      org_id,
      patientId,
    }),
  });

  try {
    // 2. Agregar participante SMS si no existe
    await client.conversations.v1
      .conversations(conversation.sid)
      .participants
      .create({
        'messagingBinding.address': phone,
        'messagingBinding.proxyAddress': proxyNumber,
      });
  } catch (err) {
    if (err.code === 50433 || err.status === 409) {
      console.warn(`⚠️ Participante ya existe en la conversación (${phone})`);
    } else {
      throw err; // Solo relanzar si no es duplicado
    }
  }

  return conversation.sid;
}


/**
 * Reasigna nuevas conversaciones a todos los usuarios
 */
async function reassignConversations() {
  console.log("📦 Iniciando reasignación...");
  try {
    const users = await Appointment.find({ phoneInput: { $exists: true, $ne: null } });
    let count = 0;

    for (const user of users) {
      count++;
      const phone_n = user.phoneInput;
      const name = user.nameInput;
      const lastname = user.lastNameInput;
      const org_id = user.org_id;
      const patientId = user.patientId || user._id;

      let phone;
      try {
        phone = localToE164AU(phone_n);
      } catch (err) {
        console.warn(`⚠️ Usuario ${name}: teléfono inválido → ${err.message}`);
        continue;
      }

      if (!/^\+61\d{9}$/.test(phone)) {
        console.warn(`❌ Número inválido: ${phone}`);
        continue;
      }

      try {
        const conversationSid = await createConversation(phone, lastname, name, org_id, patientId);

        user.sid = conversationSid;
        await user.save();

        console.log(`✅ (${count}/${users.length}) ${phone} → ${conversationSid}`);
      } catch (err) {
        if (err.code === 20003) {
          console.error(`🔒 Auth Twilio inválida`);
        } else if (err.code === 21610) {
          console.warn(`⛔ Usuario opt-out (bloqueado): ${phone}`);
        } else {
          console.error(`❌ Error para ${phone}: ${err.message}`);
        }
      }
    }

    console.log('🎉 Finalizado correctamente.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error general:', err);
    process.exit(1);
  }
}

reassignConversations();
