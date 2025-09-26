// apps/backend/src/routes/admin-auth0.js
const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { requireAnyPermission } = require('../middleware/rbac');
const { callMgmt } = require('../lib/auth0Mgmt');

const guard = [requireAuth, requireAnyPermission('dev-admin', 'admin:*')];
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

// ---------------------------------
// Debug
// ---------------------------------
router.get('/_debug/ping', (_req, res) => res.json({ ok: true }));

router.get('/_debug/mgmt', requireAuth, requireAnyPermission('dev-admin'), async (_req, res) => {
  try {
    assert(process.env.AUTH0_MGMT_BASE_URL, 'Falta AUTH0_MGMT_BASE_URL');
    assert(process.env.AUTH0_MGMT_AUDIENCE, 'Falta AUTH0_MGMT_AUDIENCE');
    assert(process.env.AUTH0_MGMT_CLIENT_ID, 'Falta AUTH0_MGMT_CLIENT_ID');
    assert(process.env.AUTH0_MGMT_CLIENT_SECRET, 'Falta AUTH0_MGMT_CLIENT_SECRET');

    const r = await fetch(`${process.env.AUTH0_MGMT_BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: process.env.AUTH0_MGMT_CLIENT_ID,
        client_secret: process.env.AUTH0_MGMT_CLIENT_SECRET,
        audience: process.env.AUTH0_MGMT_AUDIENCE,
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      console.error('[MGMT TOKEN] status:', r.status, j);
      return res.status(500).json({ error: 'mgmt_token_failed', status: r.status, resp: j });
    }
    const [, payload] = j.access_token.split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    res.json({
      ok: true,
      token_preview: j.access_token.slice(0, 24) + '…',
      scope: j.scope,
      exp: claims.exp,
      aud: claims.aud,
    });
  } catch (e) {
    console.error('[MGMT DEBUG ERROR]', e);
    res.status(500).json({ error: 'mgmt_debug_error', message: e.message });
  }
});

// ---------------------------------
// ROLES (listar todos o paginado)
// ---------------------------------
router.get('/roles', guard, async (req, res) => {
  const per_page = Math.min(Number(req.query.per_page || 100), 100);
  const page = Number(req.query.page || 0);
  const all = String(req.query.all || '').toLowerCase();
  const wantAll = all === '1' || all === 'true';

  if (!wantAll) {
    const roles = await callMgmt(`/roles?per_page=${per_page}&page=${page}`);
    return res.json({ roles, page, per_page });
  }

  let roles = [];
  let p = 0;
  while (true) {
    const batch = await callMgmt(`/roles?per_page=100&page=${p}`);
    roles = roles.concat(batch || []);
    if (!Array.isArray(batch) || batch.length < 100) break;
    p++;
  }
  res.json({ roles, total: roles.length });
});

// ---- PERMISOS ASIGNADOS A UN ROL ----
router.get('/roles/:roleId/permissions', guard, async (req, res) => {
  const { roleId } = req.params;
  const per_page = Math.min(Number(req.query.per_page || 100), 100);
  const page = Number(req.query.page || 0);
  const all = String(req.query.all || '').toLowerCase();
  const wantAll = all === '1' || all === 'true';

  try {
    if (!wantAll) {
      const perms = await callMgmt(
        `/roles/${encodeURIComponent(roleId)}/permissions?per_page=${per_page}&page=${page}`
      );
      return res.json({ permissions: perms, page, per_page });
    }

    let permissions = [];
    let p = 0;
    while (true) {
      const batch = await callMgmt(
        `/roles/${encodeURIComponent(roleId)}/permissions?per_page=100&page=${p}`
      );
      if (!Array.isArray(batch)) {
        console.error('[roles/:id/permissions] BAD_SHAPE batch=', batch);
        return res.status(502).json({ error: 'mgmt_bad_response', roleId, batch });
      }
      permissions = permissions.concat(batch);
      if (batch.length < 100) break;
      p++;
    }
    return res.json({ permissions, total: permissions.length });
  } catch (e) {
    const status = e?.status || e?.statusCode || e?.response?.status || 500;
    const data = e?.body || e?.response?.data || null;
    const msg = data?.message || e?.message || 'Management API error';

    // Pistas comunes:
    // - Falta scope 'read:roles' en la app M2M de Auth0 → 403
    // - roleId inexistente → 404
    console.error('[roles/:id/permissions] ERROR', {
      roleId,
      status,
      msg,
      details: data,
    });

    return res.status(status).json({
      error: 'mgmt_failed',
      message: msg,
      roleId,
      details: data,
      hints: [
        'Verifica que tu app M2M tenga el scope: read:roles',
        'Asegúrate de estar usando el dominio correcto del Management API (AUTH0_MGMT_BASE_URL) y AUDIENCE',
      ],
    });
  }
});


// Añadir permisos a un rol (en tu API)
router.post('/roles/:roleId/permissions', guard, async (req, res) => {
  const { roleId } = req.params;
  const { permissions = [], apiIdentifier } = req.body || {};
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return res.status(400).json({ error: 'permissions[] requerido' });
  }
  const rs = apiIdentifier || process.env.AUTH0_AUDIENCE;
  await callMgmt(`/roles/${encodeURIComponent(roleId)}/permissions`, {
    method: 'POST',
    body: JSON.stringify({
      permissions: permissions.map((name) => ({
        permission_name: name,
        resource_server_identifier: rs,
      })),
    }),
  });
  res.json({ ok: true });
});

// ---------------------------------
// ROLES DEL USUARIO (tenant-wide u Organization)
// ---------------------------------
router.get('/users/:userId/roles', guard, async (req, res) => {
  const { userId } = req.params;
  const org_id = String(req.query.org_id || '').trim();

  if (!userId) {
    return res.status(400).json({ error: 'userId requerido' });
  }

  try {
    const path = org_id
      ? `/organizations/${encodeURIComponent(org_id)}/members/${encodeURIComponent(userId)}/roles`
      : `/users/${encodeURIComponent(userId)}/roles`;

    const roles = await callMgmt(path);
    return res.json({
      scope: org_id ? 'org' : 'tenant',
      org_id: org_id || null,
      roles,
    });
  } catch (e) {
    const status = e?.status || e?.statusCode || e?.response?.status || 500;
    const data = e?.body || e?.response?.data || null;
    const msg =
      data?.message ||
      e?.message ||
      (status === 403 ? 'insufficient_scope' : 'Auth0 Management API error');

    console.error('[users/:id/roles] ERROR', { status, msg, data, org_id, userId });

    if (status === 403) {
      return res.status(403).json({
        error: 'insufficient_scope',
        required_scopes: org_id
          ? ['read:organization_member_roles', 'read:roles', 'read:users']
          : ['read:roles', 'read:users'],
        message:
          'El token del Management API no tiene permisos suficientes para listar roles.',
      });
    }
    if (status === 404 && org_id) {
      return res.status(404).json({
        error: 'org_member_not_found',
        message:
          'El usuario no pertenece a la organización indicada o la organización no existe.',
        org_id,
        user_id: userId,
      });
    }

    return res.status(status).json({ error: 'mgmt_failed', message: msg, details: data });
  }
});

// Asignar roles a un usuario (tenant-wide u Organization)
router.post('/users/:userId/roles', guard, async (req, res) => {
  const { userId } = req.params;
  const { roleIds = [], org_id } = req.body || {};

  if (!Array.isArray(roleIds) || roleIds.length === 0) {
    return res.status(400).json({ error: 'roleIds[] requerido' });
  }

  if (org_id) {
    await callMgmt(`/organizations/${encodeURIComponent(org_id)}/members/${encodeURIComponent(userId)}/roles`, {
      method: 'POST',
      body: JSON.stringify({ roles: roleIds }),
    });
  } else {
    await callMgmt(`/users/${encodeURIComponent(userId)}/roles`, {
      method: 'POST',
      body: JSON.stringify({ roles: roleIds }),
    });
  }

  res.json({ ok: true, assigned: roleIds, userId, org_id: org_id || null });
});

// Quitar roles a usuario
router.delete('/users/:userId/roles', guard, async (req, res) => {
  const { userId } = req.params;
  const { roleIds = [], org_id } = req.body || {};
  if (!Array.isArray(roleIds) || roleIds.length === 0) {
    return res.status(400).json({ error: 'roleIds[] requerido' });
  }
  if (org_id) {
    await callMgmt(`/organizations/${encodeURIComponent(org_id)}/members/${encodeURIComponent(userId)}/roles`, {
      method: 'DELETE',
      body: JSON.stringify({ roles: roleIds }),
    });
  } else {
    await callMgmt(`/users/${encodeURIComponent(userId)}/roles`, {
      method: 'DELETE',
      body: JSON.stringify({ roles: roleIds }),
    });
  }
  res.json({ ok: true });
});

// ---------------------------------
// USUARIOS (búsqueda/paginación)
// ---------------------------------
function isAdmin(req) {
  const perms = Array.isArray(req.dbUser?.permissions) ? req.dbUser.permissions : (req.user?.permissions || []);
  const roles = Array.isArray(req.dbUser?.roles) ? req.dbUser.roles : (req.user?.roles || []);
  return perms.includes('dev-admin') || perms.includes('admin:*') || roles.includes('admin');
}
function callerOrgs(req) {
  return Array.isArray(req.user?.orgs) ? req.user.orgs
    : Array.isArray(req.dbUser?.orgs) ? req.dbUser.orgs
      : [];
}

router.get('/users', requireAuth, async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const page = Number(req.query.page || 0);
  const per_page = Math.min(Number(req.query.per_page || 20), 100);

  const admin = isAdmin(req);

  const callerOrg = req.user?.org_id || null;
  const requestedOrg = String(req.query.org_id || '').trim();
  const org_id = requestedOrg || (callerOrg || '');

  if (!admin) {
    if (!org_id) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Solo administradores pueden usar la búsqueda global. Provee org_id o pertenecer a una organización.',
      });
    }
    const orgs = callerOrgs(req);
    if (org_id !== callerOrg && !orgs.includes(org_id)) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'No puedes listar miembros de una organización a la que no perteneces.',
      });
    }
  }

  if (org_id) {
    const base = `per_page=${per_page}&page=${page}&include_totals=true`;
    const out = await callMgmt(`/organizations/${encodeURIComponent(org_id)}/members?${base}`);

    const members = Array.isArray(out?.members) ? out.members : Array.isArray(out) ? out : [];
    const filtered = q
      ? members.filter(u => {
        const email = (u.email || '').toLowerCase();
        const name = (u.name || '').toLowerCase();
        const id = (u.user_id || '').toLowerCase();
        return email.includes(q) || name.includes(q) || id.includes(q);
      })
      : members;

    return res.json({
      users: filtered,
      total: out?.total ?? filtered.length,
      start: out?.start ?? page * per_page,
      limit: out?.limit ?? per_page,
      length: filtered.length,
      org_id,
      scope: 'org',
    });
  }

  if (!admin) {
    return res.status(403).json({
      error: 'forbidden',
      message: 'Búsqueda global solo para administradores.',
    });
  }
  const base = `per_page=${per_page}&page=${page}&include_totals=true`;
  const query = q ? `?q=${encodeURIComponent(q)}&search_engine=v3&${base}` : `?${base}`;
  const out = await callMgmt(`/users${query}`);
  return res.json(out);
});

// ---------------------------------
// PERMISOS (catálogo de tu API)
// ---------------------------------
router.get(['/permissions', '/api-permissions', '/auth0/permissions'], guard, async (_req, res) => {
  try {
    const audience = process.env.AUTH0_AUDIENCE;
    if (!audience) return res.status(500).json({ error: 'missing_AUTH0_AUDIENCE' });

    const all = await callMgmt(`/resource-servers?per_page=100&page=0`);
    if (!Array.isArray(all)) return res.status(502).json({ error: 'mgmt_bad_response', got: all });

    const rs = all.find(r => r.identifier === audience);
    if (!rs) {
      return res.status(404).json({
        error: 'resource_server_not_found_for_audience',
        audience,
        available: all.map(r => r.identifier),
      });
    }

    const full = await callMgmt(`/resource-servers/${rs.id}`);
    const permissions = (full.scopes || []).map(s => ({
      permission_name: s.value,
      name: s.value,
      description: s.description || '',
    }));

    return res.json({
      resourceServer: { id: rs.id, name: rs.name, identifier: rs.identifier },
      permissions,
    });
  } catch (e) {
    const status = e?.statusCode || e?.status || 500;
    console.error('[api-permissions] ERROR:', status, e?.message, e?.body || e);
    res.status(status).json({
      error: 'mgmt_failed',
      status,
      message: e?.message || 'Management API error',
      details: e?.body || null,
    });
  }
});

// ---------------------------------
// PERMISOS por usuario (directos)
// ---------------------------------
router.get('/users/:userId/permissions', guard, async (req, res) => {
  const { userId } = req.params;
  const per_page = Math.min(Number(req.query.per_page || 100), 100);
  const page = Number(req.query.page || 0);

  const data = await callMgmt(`/users/${encodeURIComponent(userId)}/permissions?per_page=${per_page}&page=${page}`);
  const onlyMine = (Array.isArray(data) ? data : []).filter(p => p.resource_server_identifier === process.env.AUTH0_AUDIENCE);

  res.json({
    user_id: userId,
    permissions: onlyMine.map(p => p.permission_name),
    raw: onlyMine,
  });
});

// Asignar permisos directos a un usuario (mejor hacerlo via roles)
router.get('/users/:userId/permissions', guard, async (req, res) => {
  const { userId } = req.params;
  const per_page = Math.min(Number(req.query.per_page || 100), 100);
  const page = Number(req.query.page || 0);

  try {
    const data = await callMgmt(
      `/users/${encodeURIComponent(userId)}/permissions?per_page=${per_page}&page=${page}`
    );

    if (!Array.isArray(data)) {
      console.error('[users/:id/permissions] BAD_SHAPE data=', data);
      return res.status(502).json({ error: 'mgmt_bad_response', userId, data });
    }

    const myAudience = process.env.AUTH0_AUDIENCE;
    const onlyMine = myAudience
      ? data.filter(p => p.resource_server_identifier === myAudience)
      : data;

    return res.json({
      user_id: userId,
      permissions: onlyMine.map(p => p.permission_name),
      raw: onlyMine,
      note: myAudience ? `Filtrado por audience ${myAudience}` : 'Sin filtro de audience',
    });
  } catch (e) {
    const status = e?.status || e?.statusCode || e?.response?.status || 500;
    const data = e?.body || e?.response?.data || null;
    const msg = data?.message || e?.message || 'Management API error';

    // Pistas comunes:
    // - Falta scope 'read:users' en la app M2M → 403
    // - userId inválido → 404
    console.error('[users/:id/permissions] ERROR', {
      userId,
      status,
      msg,
      details: data,
    });

    return res.status(status).json({
      error: 'mgmt_failed',
      message: msg,
      userId,
      details: data,
      hints: [
        'Verifica que tu app M2M tenga el scope: read:users',
        'Revisa AUTH0_AUDIENCE si esperas filtrar por tu API',
      ],
    });
  }
});


// Revocar permisos directos de un usuario
router.delete('/users/:userId/permissions', guard, async (req, res) => {
  const { userId } = req.params;
  const { permissions = [], apiIdentifier } = req.body || {};
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return res.status(400).json({ error: 'permissions[] requerido' });
  }
  const rs = apiIdentifier || process.env.AUTH0_AUDIENCE;
  await callMgmt(`/users/${encodeURIComponent(userId)}/permissions`, {
    method: 'DELETE',
    body: JSON.stringify({
      permissions: permissions.map((name) => ({
        permission_name: name,
        resource_server_identifier: rs,
      })),
    }),
  });
  res.json({ ok: true, revoked: permissions });
});

module.exports = router;
