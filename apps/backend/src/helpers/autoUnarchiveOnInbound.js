// helpers/autoUnarchiveOnInbound.js
const ConversationState = require('../models/Chat/ConversationState');
const { Appointment } = require('../models/Appointments');
async function autoUnarchiveOnInbound(conversationId) {
    try {
        if (!conversationId) {
            console.error('[autoUnarchiveOnInbound] Missing conversationId');
            return false;
        }

        console.log('[autoUnarchiveOnInbound] conversationId:', conversationId);

        // Verifica que el modelo esté bien importado
        if (!Appointment || typeof Appointment.findOne !== 'function') {
            console.error('[autoUnarchiveOnInbound] Appointment model is invalid. Check your export/import.');
            return false;
        }
        if (!ConversationState || typeof ConversationState.findOneAndUpdate !== 'function') {
            console.error('[autoUnarchiveOnInbound] ConversationState model is invalid. Check your export/import path.');
            return false;
        }

        // Appointment: buscamos por sid === conversationId
        const appt = await Appointment.findOne({ sid: conversationId })
            .select({ org_id: 1, sid: 1 })
            .lean();

        if (!appt) {
            console.warn('[autoUnarchiveOnInbound] No Appointment found for conversationId:', conversationId);
            return false;
        }
        if (!appt.org_id) {
            console.warn('[autoUnarchiveOnInbound] Appointment found but missing org_id for conversationId:', conversationId);
            return false;
        }

        console.log('[autoUnarchiveOnInbound] using org_id:', appt.org_id);

        // Upsert: archived=false y limpiamos metadatos de archivado
        const updated = await ConversationState.findOneAndUpdate(
            { org_id: appt.org_id, conversationId },
            { $set: { archived: false }, $unset: { archivedAt: 1, archivedBy: 1 } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();

        console.log('[autoUnarchiveOnInbound] updated state:', updated);
        return true;
    } catch (err) {
        console.error('[autoUnarchiveOnInbound] Failed:', err);
        return false;
    }
}

module.exports = { autoUnarchiveOnInbound };
