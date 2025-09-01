// twilio-conversations-binding.js
const https = require('https');

/** Validación simple de SIDs típicos de Twilio */
function assertSidPatterns(conversationSid, participantSid) {
  if (!/^CH[a-z0-9]{32}$/i.test(conversationSid)) {
    throw new Error(`ConversationSid inválido: ${conversationSid}`);
  }
  if (!/^MB[a-z0-9]{32}$/i.test(participantSid)) {
    throw new Error(`ParticipantSid inválido: ${participantSid}`);
  }
}

/** GET con https nativo + Basic Auth + timeout; devuelve { status, headers, body(string) } */
function httpGetRaw(url, { username, password, timeoutMs = 8000 }) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64'),
      },
    }, (res) => {
      let chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    });

    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Timeout de solicitud a Twilio'));
    });

    req.end();
  });
}

/** Parseo robusto de JSON con error claro */
function parseJsonStrict(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Twilio respondió texto no parseable como JSON');
  }
}

/**
 * Obtiene el binding SMS de un participante (número destino y número Twilio)
 * @param {object} payload - Webhook payload con ConversationSid y ParticipantSid
 * @param {object} [opts]
 * @param {string} [opts.accountSid=process.env.TWILIO_ACCOUNT_SID]
 * @param {string} [opts.authToken=process.env.TWILIO_AUTH_TOKEN]
 * @param {number} [opts.timeoutMs=8000]
 * @param {boolean} [opts.retryOn429=true] - Reintenta una vez si Twilio devuelve 429
 */
async function getSmsBindingFromWebhookPayload(
  payload,
  {
    accountSid = process.env.TWILIO_ACCOUNT_SID,
    authToken = process.env.TWILIO_AUTH_TOKEN,
    timeoutMs = 8000,
    retryOn429 = true,
  } = {}
) {
  const conversationSid = payload?.ConversationSid;
  const participantSid = payload?.ParticipantSid;

  if (!conversationSid || !participantSid) {
    throw new Error('Faltan ConversationSid o ParticipantSid en el payload');
  }
  if (!accountSid || !authToken) {
    throw new Error('Faltan credenciales TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN');
  }

  assertSidPatterns(conversationSid, participantSid);

  const url = `https://conversations.twilio.com/v1/Conversations/${encodeURIComponent(conversationSid)}/Participants/${encodeURIComponent(participantSid)}`;

  // Hacemos hasta 2 intentos si 429
  let attempts = retryOn429 ? 2 : 1;
  let lastErr;

  while (attempts > 0) {
    attempts--;
    try {
      const resp = await httpGetRaw(url, {
        username: accountSid,
        password: authToken,
        timeoutMs,
      });

      // Manejo de status no 2xx
      if (resp.status < 200 || resp.status >= 300) {
        // Si 429 y quedan intentos, espera con backoff y reintenta
        if (resp.status === 429 && attempts > 0) {
          const retryAfterSec = Number(resp.headers['retry-after']) || 2;
          await new Promise(r => setTimeout(r, retryAfterSec * 1000));
          continue;
        }
        // Adjuntar fragmento de body para diagnóstico (no credenciales)
        const snippet = resp.body?.slice(0, 300);
        throw new Error(`Twilio API error: HTTP ${resp.status}. Body: ${snippet}`);
      }

      // Parseo robusto
      let data = resp.body;
      if (typeof data === 'string') {
        data = parseJsonStrict(data);
      }

      const mb = data?.messaging_binding;
      if (!mb || typeof mb !== 'object') {
        throw new Error('Respuesta sin messaging_binding');
      }

      return {
        address: mb.address ?? null,          // número del cliente (destino)
        proxyAddress: mb.proxy_address ?? null, // número Twilio usado
        raw: data,                            // objeto completo por si necesitas auditar
      };
    } catch (err) {
      lastErr = err;
      // Si no es 429 o no hay intentos restantes, rompe
      if (!(String(err?.message || '').includes('429')) || attempts <= 0) {
        break;
      }
    }
  }

  throw lastErr || new Error('Fallo al obtener messaging_binding de Twilio');
}

module.exports = { getSmsBindingFromWebhookPayload };

/* =========================
   Ejemplo de uso (Express)
   =========================
const express = require('express');
const { getSmsBindingFromWebhookPayload } = require('./twilio-conversations-binding');
const app = express();
app.use(express.json());

app.post('/twilio/webhook', async (req, res) => {
  try {
    const { address, proxyAddress } = await getSmsBindingFromWebhookPayload(req.body);
    // Guarda/usa los números:
    // address      -> número destino (cliente)
    // proxyAddress -> número Twilio utilizado
    res.status(200).json({ address, proxyAddress });
  } catch (e) {
    console.error('Webhook error:', e.message);
    res.status(500).json({ error: 'No se pudo resolver el número destino' });
  }
});

app.listen(3000, () => console.log('Listening on :3000'));
*/
