// apps/backend/src/socket/bus.js
let io = null;
const { orgRoom, normalizeOrgId } = require('./org-util');

const setIO = (inst) => { io = inst; };

async function roomStats(room) {
  if (!io) return { sockets: 0, ids: [] };
  const ids = await io.in(room).allSockets();
  return { sockets: ids.size, ids: Array.from(ids) };
}

async function emitInvalidate(orgId, keys, exact = false) {
  if (!io) return;
  const org = normalizeOrgId(orgId);
  if (!org) return;
  if (!keys?.length) return;

  const payload = { keys: Array.isArray(keys[0]) ? keys : [keys], exact: !!exact };
  const room = orgRoom(org);

  // opcional: logs
  const stats = await roomStats(room);
  console.log('[SOCKET][EMIT rq.invalidate]', { room, sockets: stats.sockets, keys: payload.keys, exact: payload.exact });

  io.to(room).emit('rq.invalidate', payload);
}

module.exports = { setIO, emitInvalidate };
