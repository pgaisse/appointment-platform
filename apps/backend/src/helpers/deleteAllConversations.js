const dotenv = require('dotenv');
const path = require('path');
const twilio = require('twilio');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);
async function deleteAllConversations() {
  try {
    console.log('🚨 Obteniendo conversaciones activas...');

    const conversations = await client.conversations.v1.conversations.list({ limit: 1000 });

    if (conversations.length === 0) {
      console.log('✅ No hay conversaciones para eliminar.');
      return;
    }

    console.log(`🔍 Encontradas ${conversations.length} conversaciones. Eliminando...`);

    for (const convo of conversations) {
      try {
        await client.conversations.v1.conversations(convo.sid).remove();
        console.log(`🗑️  Eliminada conversación ${convo.sid}`);
      } catch (err) {
        console.error(`❌ Error al eliminar ${convo.sid}:`, err.message);
      }
    }

    console.log('🎉 Todas las conversaciones han sido eliminadas.');
  } catch (err) {
    console.error('❌ Error general:', err.message);
  }
}

deleteAllConversations();
