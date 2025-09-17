// apps/backend/src/routes/topics.js  (o el nombre que uses)
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { attachUserInfo, jwtCheck, checkJwt, decodeToken, ensureUser } = require('../middleware/auth');

router.use(jwtCheck,jwtCheck,attachUserInfo,ensureUser);

const svc = require('../helpers/topics.service');              // (topics/board/cards/labels)
const appearanceSvc = require('../helpers/appearance.service');// apariencia

const schemas = require('../schemas/topics.schemas');          // (topics/columns/cards/labels)
const appearanceSchemas = require('../schemas/appearance.schemas');

const { validate } = require('../middleware/validate');

// ⬇️ Auth + RBAC
const { requireAuth } = require('../middleware/auth');
const {
  requireRole,
  requireAnyPermission,
  requireAllPermissions,
} = require('../middleware/rbac');

// ✅ Aplica JWT check + attachUserInfo + ensureUser para todo este router
router.use(requireAuth);
router.use(jwtCheck, attachUserInfo, ensureUser);

// #region Appearances
// GET/PUT user preferences (per user) → basta estar autenticado
router.get('/users/me/preferences', async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.sub || req.auth?.sub;
    const out = await appearanceSvc.getUserPreferences(userId);
    res.json(out);
  } catch (e) { res.status(e?.status || 500).json({ error: e.message }); }
});

router.put(
  '/users/me/preferences',
  validate(appearanceSchemas.updateUserPreferences),
  async (req, res) => {
    try {
      const userId = req.user?.id || req.user?.sub || req.auth?.sub;
      const out = await appearanceSvc.updateUserPreferences(userId, req.body);
      res.json(out);
    } catch (e) { res.status(e?.status || 500).json({ error: e.message }); }
  }
);

// GET/PATCH topic appearance
router.get(
  '/topics/:topicId/appearance',
  requireAnyPermission('board:read', 'dev-admin'), // RBAC: leer apariencia = permiso de lectura del board
  async (req, res) => {
    try {
      const out = await appearanceSvc.getTopicAppearance(req.params.topicId);
      res.json(out);
    } catch (e) { res.status(e?.status || 500).json({ error: e.message }); }
  }
);

router.patch(
  '/topics/:topicId/appearance',
  requireAnyPermission('card:edit', 'dev-admin'), // RBAC: editar apariencia
  validate(appearanceSchemas.updateTopicAppearance),
  async (req, res) => {
    try {
      const out = await appearanceSvc.updateTopicAppearance(req.params.topicId, req.body);
      res.json(out);
    } catch (e) {
      const status = e?.status || 500;
      console.error('[PATCH /topics/:topicId/appearance] ERROR:', e?.message, e?.stack || '');
      res.status(status).json({ error: e?.message || 'Internal Server Error' });
    }
  }
);

// PATCH card cover
router.patch(
  '/cards/:cardId/cover',
  requireAnyPermission('card:edit', 'dev-admin'),  // RBAC: editar cover
  validate(appearanceSchemas.updateCardCover),
  async (req, res) => {
    try {
      const out = await appearanceSvc.updateCardCover(req.params.cardId, req.body);
      res.json({ card: out });
    } catch (e) { res.status(e?.status || 500).json({ error: e.message }); }
  }
);
// #endregion

// #region Topics
router.get(
  '/topics',
  requireAnyPermission('board:read', 'dev-admin'), // RBAC: listar topics
  async (req, res) => {
    try {
      const data = await svc.listTopics();
      return res.json(data);
    } catch (e) {
      console.error('[GET /topics] ERROR:', e?.message, e?.stack || '');
      return res.status(500).json({ error: e?.message || 'Internal Server Error' });
    }
  }
);

router.post(
  '/topics',
  // validate(schemas.createTopic), // activa cuando tengas el schema listo
  requireRole('admin'), // RBAC: crear topic solo admin (puedes cambiar a un permiso si lo defines)
  async (req, res) => {
    try {
      const created = await svc.createTopic(req.body || {});
      return res.json({ topic: created });
    } catch (e) {
      const status = e?.status || (e?.code === 11000 ? 409 : 500);
      console.error('[POST /topics] ERROR:', e?.message, e?.stack || '');
      return res.status(status).json({ error: e?.message || 'Internal Server Error' });
    }
  }
);

router.get(
  '/topics/:topicId/board',
  requireAnyPermission('board:read', 'dev-admin'), // RBAC
  async (req, res, next) => {
    try { res.json(await svc.getTopicBoard(req.params.topicId)); } catch (e) { next(e); }
  }
);

router.post(
  '/topics/:topicId/columns',
  // validate(schemas.createColumn),
  requireRole('admin'), // RBAC: crear columnas → admin (ajusta si defines un permiso específico)
  async (req, res) => {
    try {
      const { topicId } = req.params;
      if (!mongoose.isValidObjectId(topicId)) {
        return res.status(400).json({ error: 'Invalid topicId' });
      }
      const out = await svc.createColumn(topicId, req.body || {});
      return res.json({ column: out });
    } catch (e) {
      const status = e?.status || 500;
      console.error('[POST /topics/:topicId/columns] ERROR:', e?.message, e?.stack || '');
      return res.status(status).json({ error: e?.message || 'Internal Server Error' });
    }
  }
);

router.patch(
  '/topics/:topicId/columns/reorder',
  requireAnyPermission('card:edit', 'dev-admin'), // RBAC: reordenar columnas ~ edición
  async (req, res, next) => {
    try { await svc.reorderColumns(req.params.topicId, req.body.orderedColumnIds); res.json({ ok: true }); } catch (e) { next(e); }
  }
);
// #endregion

// #region Cards
router.post(
  '/topics/:topicId/cards',
  validate(schemas?.createCard),
  requireAnyPermission('list:create_card', 'card:edit', 'dev-admin'), // RBAC: crear card
  async (req, res) => {
    try {
      const { topicId } = req.params;
      if (!mongoose.isValidObjectId(topicId)) {
        return res.status(400).json({ error: 'Invalid topicId' });
      }
      const card = await svc.createCard(topicId, req.body || {});
      return res.json({ card });
    } catch (e) {
      const status = e?.status || 500;
      console.error('[POST /topics/:topicId/cards] ERROR:', e?.message, e?.stack || '');
      return res.status(status).json({ error: e?.message || 'Internal Server Error' });
    }
  }
);

router.patch(
  '/cards/:cardId',
  requireAllPermissions('card:edit'), // RBAC: requiere TODOS (aquí sólo uno)
  async (req, res) => {
    try {
      const { cardId } = req.params;
      if (!mongoose.isValidObjectId(cardId)) {
        return res.status(400).json({ error: 'Invalid cardId' });
      }
      const card = await svc.updateCard(cardId, req.body ?? {});
      return res.json({ card });
    } catch (e) {
      const msg = e?.message || 'Internal Server Error';
      console.error('[PATCH /cards/:cardId] ERROR:', msg, e?.stack || '');
      if (msg === 'Card not found') return res.status(404).json({ error: msg });
      if (msg === 'Topic not found') return res.status(404).json({ error: msg });
      return res.status(500).json({ error: msg });
    }
  }
);

router.patch(
  '/cards/:cardId/move',
  requireAnyPermission('card:edit', 'dev-admin'), // RBAC
  async (req, res) => {
    console.log("mover tarjeta",req.dbUser)
    try {
      const { cardId } = req.params;
      let { toColumnId, before, after } = req.body || {};

      const okId = (v) => typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v);
      if (!okId(cardId)) return res.status(400).json({ error: 'Invalid cardId' });

      toColumnId = okId(toColumnId) ? toColumnId : undefined;
      before = okId(before) && before !== cardId ? before : undefined;
      after = okId(after) && after !== cardId ? after : undefined;

      const result = await svc.moveCard({ cardId, toColumnId, before, after });
      return res.json(result);
    } catch (e) {
      console.error('[PATCH /cards/:cardId/move] ERROR:', e?.message, e?.stack || '');
      return res.status(500).json({ error: e?.message || 'Internal Server Error' });
    }
  }
);
// #endregion

// #region Labels
router.get(
  '/topics/:topicId/labels',
  requireAnyPermission('board:read', 'dev-admin'), // RBAC
  async (req, res) => {
    try {
      const out = await svc.listTopicLabels(req.params.topicId);
      return res.json(out);
    } catch (e) {
      const status = e?.status || 500;
      console.error('[GET /labels] ERROR:', e?.message);
      return res.status(status).json({ error: e?.message || 'Internal Server Error' });
    }
  }
);

router.post(
  '/topics/:topicId/labels',
  validate(schemas?.createLabel),
  requireAnyPermission('card:edit', 'dev-admin'), // RBAC: crear label
  async (req, res) => {
    try {
      const lbl = await svc.createTopicLabel(req.params.topicId, req.body);
      return res.json({ label: lbl });
    } catch (e) {
      const status = e?.status || 500;
      console.error('[POST /labels] ERROR:', e?.message);
      return res.status(status).json({ error: e?.message || 'Internal Server Error' });
    }
  }
);

router.patch(
  '/topics/:topicId/labels/:labelId',
  validate(schemas?.updateLabel),
  requireAnyPermission('card:edit', 'dev-admin'), // RBAC: editar label
  async (req, res) => {
    try {
      const lbl = await svc.updateTopicLabel(req.params.topicId, req.params.labelId, req.body);
      return res.json({ label: lbl });
    } catch (e) {
      const status = e?.status || 500;
      console.error('[PATCH /labels/:labelId] ERROR:', e?.message);
      return res.status(status).json({ error: e?.message || 'Internal Server Error' });
    }
  }
);

router.delete(
  '/topics/:topicId/labels/:labelId',
  requireAnyPermission('card:edit', 'dev-admin'), // RBAC: borrar label
  async (req, res) => {
    try {
      await svc.deleteTopicLabel(req.params.topicId, req.params.labelId);
      return res.json({ ok: true });
    } catch (e) {
      const status = e?.status || 500;
      console.error('[DELETE /labels/:labelId] ERROR:', e?.message);
      return res.status(status).json({ error: e?.message || 'Internal Server Error' });
    }
  }
);
// #endregion

// #region Deletes
const isId = (v) => typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v);

router.delete(
  '/cards/:cardId',
  requireAnyPermission('card:delete', 'dev-admin'), // RBAC
  async (req, res) => {
    try {
      const { cardId } = req.params;
      if (!isId(cardId)) return res.status(400).json({ error: 'Invalid cardId' });
      await svc.deleteCard(cardId);
      return res.json({ ok: true, deletedId: cardId });
    } catch (e) {
      const msg = e?.message || 'Internal Server Error';
      if (msg === 'Card not found') return res.status(404).json({ error: msg });
      console.error('[DELETE /cards/:cardId] ERROR:', msg, e?.stack || '');
      return res.status(500).json({ error: msg });
    }
  }
);

router.delete(
  '/columns/:columnId',
  requireRole('admin'), // RBAC
  async (req, res) => {
    try {
      const { columnId } = req.params;
      if (!isId(columnId)) return res.status(400).json({ error: 'Invalid columnId' });
      const out = await svc.deleteColumn(columnId);
      return res.json({ ok: true, deletedId: columnId, deletedCards: out.deletedCards });
    } catch (e) {
      const msg = e?.message || 'Internal Server Error';
      if (msg === 'Column not found') return res.status(404).json({ error: msg });
      console.error('[DELETE /columns/:columnId] ERROR:', msg, e?.stack || '');
      return res.status(500).json({ error: msg });
    }
  }
);

router.delete(
  '/topics/:topicId',
  requireRole('admin'), // RBAC
  async (req, res) => {
    try {
      const { topicId } = req.params;
      if (!isId(topicId)) return res.status(400).json({ error: 'Invalid topicId' });
      const out = await svc.deleteTopic(topicId);
      return res.json({
        ok: true,
        deletedId: topicId,
        deletedColumns: out.deletedColumns,
        deletedCards: out.deletedCards
      });
    } catch (e) {
      const msg = e?.message || 'Internal Server Error';
      if (msg === 'Topic not found') return res.status(404).json({ error: msg });
      console.error('[DELETE /topics/:topicId] ERROR:', msg, e?.stack || '');
      return res.status(500).json({ error: msg });
    }
  }
);
// #endregion


// #region Coments

router.get('/cards/:cardId/comments', async (req, res) => {
  try {
    const { cardId } = req.params;
    if (!mongoose.isValidObjectId(cardId)) {
      return res.status(400).json({ error: 'Invalid cardId' });
    }
    const out = await svc.listCardComments(cardId);
    return res.json(out);
  } catch (e) {
    const status = e?.status || 500;
    console.error('[GET /cards/:cardId/comments] ERROR:', e?.message);
    return res.status(status).json({ error: e?.message || 'Internal Server Error' });
  }
});

router.post('/cards/:cardId/comments', validate(schemas.createComment), async (req, res) => {
  try {
    const { cardId } = req.params;
    if (!mongoose.isValidObjectId(cardId)) {
      return res.status(400).json({ error: 'Invalid cardId' });
    }

    // upsert de usuario desde el token (Auth0)
    const dbUser = req.dbUser
    const out = await svc.addCardComment(cardId, dbUser._id, req.body.text);

    return res.json({ comment: out });
  } catch (e) {
    const status = e?.status || 500;
    console.error('[POST /cards/:cardId/comments] ERROR:', e?.message);
    return res.status(status).json({ error: e?.message || 'Internal Server Error' });
  }
});

router.delete('/cards/:cardId/comments/:commentId', async (req, res) => {
  try {
    const { cardId, commentId } = req.params;
    if (!mongoose.isValidObjectId(cardId)) {
      return res.status(400).json({ error: 'Invalid cardId' });
    }
    // commentId es subdoc _id; no necesita ser ObjectId “global” pero usualmente lo es
   
    const dbUser = req.dbUser;
    const roles = Array.isArray(dbUser.roles) ? dbUser.roles : [];
    const isAdmin = roles.includes('admin');

    const out = await svc.deleteCardComment(cardId, commentId, dbUser._id, isAdmin);
    return res.json(out);
  } catch (e) {
    const status = e?.status || 500;
    console.error('[DELETE /cards/:cardId/comments/:commentId] ERROR:', e?.message);
    return res.status(status).json({ error: e?.message || 'Internal Server Error' });
  }
});

module.exports = router;
