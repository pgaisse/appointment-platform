const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const svc = require('../helpers/topics.service');
const schemas = require('../schemas/topics.schemas');
const { validate } = require('../middleware/validate');

router.get('/topics', async (req, res, next) => {
  try { res.json(await svc.listTopics()); } catch (e) { next(e); }
});
router.post('/topics', validate(schemas.createTopic), async (req, res, next) => {
  try { res.json({ topic: await svc.createTopic(req.body) }); } catch (e) { next(e); }
});

router.get('/topics/:topicId/board', async (req, res, next) => {
  try { res.json(await svc.getTopicBoard(req.params.topicId)); } catch (e) { next(e); }
});

router.post('/topics/:topicId/columns', validate(schemas.createColumn), async (req, res, next) => {
  try { res.json({ column: await svc.createColumn(req.params.topicId, req.body) }); } catch (e) { next(e); }
});
router.patch('/topics/:topicId/columns/reorder', async (req, res, next) => {
  try { await svc.reorderColumns(req.params.topicId, req.body.orderedColumnIds); res.json({ ok: true }); } catch (e) { next(e); }
});

router.post('/topics/:topicId/cards', validate(schemas.createCard), async (req, res, next) => {
  try { res.json({ card: await svc.createCard(req.params.topicId, req.body) }); } catch (e) { next(e); }
});
router.patch('/cards/:cardId', validate(schemas.updateCard), async (req, res, next) => {
  try { res.json({ card: await svc.updateCard(req.params.cardId, req.body) }); } catch (e) { next(e); }
});
router.patch('/cards/:cardId/move', async (req, res, next) => {
  try {
    const { cardId } = req.params;
    const { toColumnId, before, after } = req.body;
    res.json(await svc.moveCard({ cardId, toColumnId, before, after }, {}));
  } catch (e) { next(e); }
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
