const path = require('path');
const dotenv = require('dotenv');
const twilio = require("twilio");
const mongoose = require('mongoose');
const mongoConnect = require('../config/db');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { Appointment, ContactAppointment } = require('../models/Appointments');

mongoConnect();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

// ✅ Función para crear conversación con friendlyName
async function createTwilioConversation(friendlyName) {
    const conversation = await client.conversations.v1.conversations.create({
        friendlyName: friendlyName || 'Default Friendly Name'
    });
    return conversation.sid;
}

// ✅ Función principal que asigna SID si no existe
async function assignSidsToAppointments() {
    const appointments = await Appointment.find({ sid: null });

    console.log(`🔍 Encontrados ${appointments.length} documentos sin SID.`);

    for (const appointment of appointments) {
        try {
            const friendlyName = `${appointment.nameInput}-${appointment.lastNameInput}`;
            const sid = await createTwilioConversation(friendlyName);

            appointment.sid = sid;
            await appointment.save();

            console.log(`✅ Asignado SID ${sid} con friendlyName "${friendlyName}" a _id: ${appointment._id}`);
        } catch (error) {
            console.error(`❌ Error al crear SID para _id: ${appointment._id}`, error.message);
        }
    }

    mongoose.connection.close();
}

// 🚀 Ejecutar
assignSidsToAppointments();
