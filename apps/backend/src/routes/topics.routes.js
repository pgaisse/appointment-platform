const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const svc = require('../helpers/topics.service');
const schemas = require('../schemas/topics.schemas');
const { validate } = require('../middleware/validate');


router.get('/topics', async (req, res) => {
  try {
    const data = await svc.listTopics();
    return res.json(data);
  } catch (e) {
    console.error('[GET /topics] ERROR:', e?.message, e?.stack || '');
    return res.status(500).json({ error: e?.message || 'Internal Server Error' });
  }
});

router.post('/topics', /* validate(schemas.createTopic), */ async (req, res) => {
  try {
    // Asegúrate de tener app.use(express.json()) en index.js
    // console.log('BODY /topics:', req.body);
    const created = await svc.createTopic(req.body || {});
    return res.json({ topic: created });
  } catch (e) {
    const status = e?.status || (e?.code === 11000 ? 409 : 500);
    console.error('[POST /topics] ERROR:', e?.message, e?.stack || '');
    return res.status(status).json({ error: e?.message || 'Internal Server Error' });
  }
});

router.get('/topics/:topicId/board', async (req, res, next) => {
  try { res.json(await svc.getTopicBoard(req.params.topicId)); } catch (e) { next(e); }
});

router.post('/topics/:topicId/columns', /* validate(schemas.createColumn), */ async (req, res) => {
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
});
router.patch('/topics/:topicId/columns/reorder', async (req, res, next) => {
  try { await svc.reorderColumns(req.params.topicId, req.body.orderedColumnIds); res.json({ ok: true }); } catch (e) { next(e); }
});

router.post('/topics/:topicId/cards', validate(schemas.createCard), async (req, res, next) => {
  try { res.json({ card: await svc.createCard(req.params.topicId, req.body) }); } catch (e) { next(e); }
});
router.patch('/cards/:cardId', async (req, res) => {
  try {
    const { cardId } = req.params;
    if (!mongoose.isValidObjectId(cardId)) {
      return res.status(400).json({ error: 'Invalid cardId' });
    }

    const card = await svc.updateCard(cardId, req.body ?? {});
    return res.json({ card });
  } catch (e) {
    const msg = e?.message || 'Internal Server Error';
    // logs claros para depurar
    console.error('[PATCH /cards/:cardId] ERROR:', msg, e?.stack || '');
    if (msg === 'Card not found') return res.status(404).json({ error: msg });
    if (msg === 'Topic not found') return res.status(404).json({ error: msg });
    return res.status(500).json({ error: msg });
  }
});
router.patch('/cards/:cardId/move', async (req, res) => {
  try {
    const { cardId } = req.params;
    let { toColumnId, before, after } = req.body || {};

    const okId = (v) => typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v);

    if (!okId(cardId)) {
      return res.status(400).json({ error: 'Invalid cardId' });
    }

    // Normaliza: trata "", null, etc. como undefined. Evita self-reference.
    toColumnId = okId(toColumnId) ? toColumnId : undefined;
    before = okId(before) && before !== cardId ? before : undefined;
    after = okId(after) && after !== cardId ? after : undefined;

    const result = await svc.moveCard({ cardId, toColumnId, before, after });
    return res.json(result);
  } catch (e) {
    console.error('[PATCH /cards/:cardId/move] ERROR:', e?.message, e?.stack || '');
    return res.status(500).json({ error: e?.message || 'Internal Server Error' });
  }
});
// backend/src/routes/topics.routes.js
// Listar labels del tópico
router.get('/topics/:topicId/labels', async (req, res, next) => {
  try {
    const { topicId } = req.params;
    if (!mongoose.isValidObjectId(topicId)) {
      return res.status(400).json({ error: 'Invalid topicId' });
    }
    res.json(await svc.listTopicLabels(topicId));
  } catch (e) { next(e); }
});

router.post('/topics/:topicId/labels', validate(schemas.createTopicLabel), async (req, res, next) => {
  try {
    const { topicId } = req.params;
    if (!mongoose.isValidObjectId(topicId)) {
      return res.status(400).json({ error: 'Invalid topicId' });
    }
    const label = await svc.createTopicLabel(topicId, req.body);
    res.json({ label });
  } catch (e) { next(e); }
});

router.patch('/topics/:topicId/labels/:labelId', async (req, res, next) => {
  try {
    const { topicId, labelId } = req.params;
    if (!mongoose.isValidObjectId(topicId)) return res.status(400).json({ error: 'Invalid topicId' });
    res.json({ label: await svc.updateTopicLabel(topicId, labelId, req.body) });
  } catch (e) { next(e); }
});

router.delete('/topics/:topicId/labels/:labelId', async (req, res, next) => {
  try {
    const { topicId, labelId } = req.params;
    if (!mongoose.isValidObjectId(topicId)) return res.status(400).json({ error: 'Invalid topicId' });
    await svc.deleteTopicLabel(topicId, labelId);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
