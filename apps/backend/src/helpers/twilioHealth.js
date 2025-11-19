const twilio = require('twilio');

/**
 * Validate a Twilio Conversation SID.
 * @param {import('twilio').Twilio} client Twilio client
 * @param {string} sid Conversation SID to validate (e.g., CHxxxxxxxx)
 * @returns {Promise<{ok: boolean, status: 'ok'|'invalid'|'missing'|'error', reason?: string}>}
 */
async function validateConversationSid(client, sid) {
  const s = String(sid || '').trim();
  if (!s) return { ok: false, status: 'missing', reason: 'No SID present' };
  try {
    const conv = await client.conversations.v1.conversations(s).fetch();
    if (conv && conv.sid === s) {
      return { ok: true, status: 'ok' };
    }
    return { ok: false, status: 'invalid', reason: 'SID fetch returned unexpected result' };
  } catch (e) {
    // Twilio 404 => invalid; others => error
    const code = e?.status || e?.code;
    if (code === 404) {
      return { ok: false, status: 'invalid', reason: 'Conversation not found in Twilio' };
    }
    return { ok: false, status: 'error', reason: e?.message || String(e) };
  }
}

module.exports = {
  validateConversationSid,
};
