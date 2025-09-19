// apps/backend/src/socket/invalidate-queue.js
const { emitInvalidate } = require('./bus');
const { normalizeOrgId } = require('./org-util');

function queueInvalidate(res, orgId, key, exact = false) {
  const org = normalizeOrgId(orgId); // 👈 asegura minúscula al guardar
  if (!org || !key) return;
  const store = (res.locals.__inv ||= { orgId: org, keys: [], exact: false });
  if (Array.isArray(key[0])) store.keys.push(...key); else store.keys.push(key);
  store.exact = store.exact || exact;
}
function flushInvalidate(res) {
  const inv = res.locals.__inv;
  if (!inv?.keys?.length) return;
  emitInvalidate(inv.orgId, inv.keys, inv.exact);
}
module.exports = { queueInvalidate, flushInvalidate };
