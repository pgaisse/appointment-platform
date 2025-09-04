// utils/conversations.twilioOnly.js
// Uso principal:
//   const sid = await findConversationByPhoneTwilioOnly('+61411710260')
//   const ensuredSid = await ensureConversationForPhoneTwilioOnly('+61411710260')

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_MAIN,                 // '+61482088223'
  TWILIO_CONVERSATIONS_SERVICE_SID, // 'IS383951c00489431f9c9b827ba08c3773'
  TWILIO_ORG_ID,                    // 'org_BzRwcS0qiW57b8SX'
  CONV_LOOKUP_PAGE_SIZE = 50,
  CONV_LOOKUP_CONCURRENCY = 5,
} = process.env;

let _twilioClient = null;

// ---------- Logs ----------
const TS = () => new Date().toISOString();


// ---------- Twilio client ----------
function getTwilioClient() {
  if (_twilioClient) return _twilioClient;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error('Faltan TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN');
  }
  _twilioClient = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  return _twilioClient;
}

// ---------- Utils ----------
function safeJson(str) {
  if (!str || typeof str !== 'string') return {};
  try { const o = JSON.parse(str); return o && typeof o === 'object' ? o : {}; }
  catch { return {}; }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function listParticipantsWithRetry(participantsApi, maxAttempts = 3, attempt = 1) {
  try {
    return await participantsApi.list({ limit: 50 });
  } catch (e) {
    const code = e?.status || e?.statusCode || 0;
    if ((code === 429 || code >= 500) && attempt < maxAttempts) {
      const delay = 250 * Math.pow(2, attempt - 1);
      await sleep(delay);
      return listParticipantsWithRetry(participantsApi, maxAttempts, attempt + 1);
    }
    throw e;
  }
}

async function mapWithConcurrency(items, concurrency, worker) {
  const queue = items.slice();
  const workers = Array.from({ length: Math.max(1, Number(concurrency)) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      try { await worker(item); } catch (e) {
        if (e?.status === 429) await sleep(250);
      }
    }
  });
  await Promise.all(workers);
}

async function iterateConversationsPaged(api, { pageSize = 50, label = '?' } = {}, onBatch) {
  if (typeof api.page === 'function') {
    let page = await api.page({ pageSize });
    let pageNum = 1;
    while (page) {
      const records = page.instances || page.records || [];
      const cont = await onBatch(records, pageNum);
      if (cont === false) return;
      if (typeof page.nextPage !== 'function') break;
      page = await page.nextPage();
      pageNum += 1;
    }
  } else {
    const all = await api.list({ pageSize });
    await onBatch(all, 1);
  }
}

function extractConversationSidFromErr(err) {
  if (!err || typeof err.message !== 'string') return null;
  const m = err.message.match(/Conversation\s+(CH[a-f0-9]+)/i);
  return m ? m[1] : null;
}

// ---------- Matching helpers (proxy/org relajados) ----------
function matchesProxy(candidateProxy) {
  // Si no seteaste FROM, no filtramos
  if (!TWILIO_FROM_MAIN) return true;
  // Si Twilio no informa el proxy, lo aceptamos (relajado)
  if (candidateProxy == null) return true;
  // Solo exigimos igualdad cuando viene informado
  return candidateProxy === TWILIO_FROM_MAIN;
}
function matchesOrg(attrOrg) {
  // Si no seteaste ORG_ID, no filtramos
  if (!TWILIO_ORG_ID) return true;
  // Si Twilio no informa org, lo aceptamos (relajado)
  if (attrOrg == null) return true;
  return attrOrg === TWILIO_ORG_ID;
}

// ---------- Contexts (service + global) ----------
function buildContexts(client) {
  const contexts = [];
  if (TWILIO_CONVERSATIONS_SERVICE_SID) {
    const svc = client.conversations.v1.services(TWILIO_CONVERSATIONS_SERVICE_SID);
    contexts.push({
      label: `service:${TWILIO_CONVERSATIONS_SERVICE_SID}`,
      page: (opts) => svc.conversations.page(opts),
      list: (opts) => svc.conversations.list(opts),
      participants: (sid) => svc.conversations(sid).participants,
    });
  }
  const glob = client.conversations.v1;
  contexts.push({
    label: 'global',
    page: (opts) => glob.conversations.page(opts),
    list: (opts) => glob.conversations.list(opts),
    participants: (sid) => glob.conversations(sid).participants,
  });
  return contexts;
}

// ===================== FIND (Twilio-only) =====================
async function findConversationByPhoneTwilioOnly(phone) {
  const pageSize = Number(CONV_LOOKUP_PAGE_SIZE);
  const concurrency = Number(CONV_LOOKUP_CONCURRENCY);

  try {
    if (!phone || typeof phone !== 'string' || phone[0] !== '+') {
      return null;
    }

    const client = getTwilioClient();
    const contexts = buildContexts(client);

    let foundSid = null;

    for (const ctx of contexts) {
      if (foundSid) break;

      await iterateConversationsPaged(
        { page: ctx.page, list: ctx.list },
        { pageSize, label: ctx.label },
        async (batch) => {
          // 1) attributes quick pass
          for (const c of batch) {
            if (foundSid) break;
            const attrs = safeJson(c.attributes);
            const attrPhone = attrs?.phone || attrs?.address || attrs?.participantPhone;
            const attrProxy = attrs?.proxyAddress || attrs?.from || attrs?.proxy;
            const attrOrg   = attrs?.org_id || attrs?.orgId;

            if (attrPhone) {
            }

            if (attrPhone === phone && matchesProxy(attrProxy) && matchesOrg(attrOrg)) {
              foundSid = c.sid;
              return false; // cortar paginado
            }
          }
          if (foundSid) return false;

          // 2) participants pass (concurrencia limitada)
          await mapWithConcurrency(batch, concurrency, async (c) => {
            if (foundSid) return;
            let parts = [];
            try {
              parts = await listParticipantsWithRetry(ctx.participants(c.sid));
            } catch (e) {
              return;
            }
            for (const p of parts) {
              const addr = p.messagingBinding?.address || p.address;
              const prox = p.messagingBinding?.proxyAddress;
              if (addr === phone && matchesProxy(prox)) {
                foundSid = c.sid;
                return;
              }
            }
          });

          return !foundSid; // continuar si no se encontró
        }
      );
    }

    if (foundSid){}
      console.log("foundSid",foundSid)
    return foundSid || null;

  } catch (e) {
    return null;
  }
}

// ===================== ENSURE (Twilio-only) =====================
async function ensureConversationForPhoneTwilioOnly(phone) {
  try {
    const pre = await findConversationByPhoneTwilioOnly(phone);
    if (pre) {
      console.log("pre", pre)
      return pre;
    }

    const client = getTwilioClient();
    const preferService = !!TWILIO_CONVERSATIONS_SERVICE_SID;

    const convApi = preferService
      ? client.conversations.v1.services(TWILIO_CONVERSATIONS_SERVICE_SID).conversations
      : client.conversations.v1.conversations;

    let createdSid = null;

    try {
      const convo = await convApi.create({
        attributes: JSON.stringify({
          phone,
          proxyAddress: TWILIO_FROM_MAIN,
          org_id: TWILIO_ORG_ID,
          source: 'backend-add',
        }),
      });
      createdSid = convo.sid;

      await convApi(createdSid).participants.create({
        'messagingBinding.address': phone,
        'messagingBinding.proxyAddress': TWILIO_FROM_MAIN,
      });
console.log(createdSid)
      return createdSid;

    } catch (err) {
      const code = err?.code || err?.status;

      if (code === 50416 || code === 409) {
        const existing = extractConversationSidFromErr(err);

        if (createdSid) {
          try { await convApi(createdSid).remove(); }
          catch (e2) { log.warn(`orphan remove failed CH=${createdSid}:`, e2?.message || e2); }
        }

        if (existing) return existing;

        const post = await findConversationByPhoneTwilioOnly(phone);
        console.log(post)
        return post || null;
      }

      throw err;
    }

  } catch (e) {
    log.error(`ensureConversationForPhoneTwilioOnly err:`, e?.message || e);
    return null;
  }
}
  findConversationByPhoneTwilioOnly("+61411710260");
module.exports = {
  findConversationByPhoneTwilioOnly,
  ensureConversationForPhoneTwilioOnly,
};
