const mongoose = require('mongoose');
const { Topic }   = require('../models/Topic');
const { Column }  = require('../models/Column');
const { Card }    = require('../models/Card');
const { between } = require('../utils/lexorank');
const { DEFAULT_RANK_STEP } = require('../constants');
const { mongoSupportsTransactions } = require('./txSupport');

async function listTopics() {
  const topics = await Topic.find().sort({ createdAt: 1 }).lean();
  return topics.map(t => ({ id: String(t._id), title: t.title, key: t.key, meta: t.meta }));
}

async function createTopic({ title, key, meta }) {
  const t = await Topic.create({ title, key, meta: meta ?? {} });
  return { id: String(t._id), title: t.title, key: t.key, meta: t.meta };
}

async function getTopicBoard(topicId) {
  const filter = topicId ? { topicId } : { topicId: { $exists: false } };
  const [columns, cards] = await Promise.all([
    Column.find({ $or: [filter, { topicId: { $exists: false } }] }).sort({ sortKey: 1 }).lean(),
    Card.find({ $or: [filter, { topicId: { $exists: false } }] }).sort({ sortKey: 1 }).lean(),
  ]);

  const cardsByColumn = {};
  for (const c of cards) {
    const key = String(c.columnId);
    (cardsByColumn[key] ||= []).push({
      id: String(c._id),
      topicId: c.topicId ? String(c.topicId) : undefined,
      columnId: key,
      title: c.title,
      description: c.description,
      labels: c.labels ?? [],
      members: c.members ?? [],
      dueDate: c.dueDate,
      coverUrl: c.coverUrl,
      checklist: c.checklist ?? [],
      attachments: c.attachments ?? [],
      comments: c.comments ?? [],
      params: c.params ?? [],
      sortKey: c.sortKey,
      createdAt: c.createdAt, updatedAt: c.updatedAt,
    });
  }

  const shapedColumns = columns.map(c => ({
    id: String(c._id), topicId: c.topicId ? String(c.topicId) : undefined,
    title: c.title, sortKey: c.sortKey, meta: c.meta,
  }));

  return { columns: shapedColumns, cardsByColumn };
}

async function createColumn(topicId, { title, meta }) {
  const last = await Column.find({ topicId }).sort({ sortKey: -1 }).limit(1);
  const next = last[0]
    ? String((parseInt(last[0].sortKey || '0', 10) + DEFAULT_RANK_STEP))
    : String(DEFAULT_RANK_STEP);
  const col = await Column.create({ topicId, title, sortKey: next, meta: meta ?? {} });
  return { id: String(col._id), title: col.title, sortKey: col.sortKey, meta: col.meta };
}

async function reorderColumns(topicId, orderedColumnIds) {
  let cur = DEFAULT_RANK_STEP;
  for (const id of orderedColumnIds) {
    await Column.findOneAndUpdate({ _id: id, topicId }, { sortKey: String(cur) });
    cur += DEFAULT_RANK_STEP;
  }
}

async function createCard(topicId, body) {
  const last = await Card.find({ columnId: body.columnId }).sort({ sortKey: -1 }).limit(1);
  const sk = between(last[0]?.sortKey, null);
  const card = await Card.create({ ...body, topicId, sortKey: sk });
  const obj = card.toObject();
  return { id: String(card._id), ...obj };
}

async function updateCard(cardId, patch) {
  const updated = await Card.findByIdAndUpdate(cardId, { $set: patch }, { new: true });
  if (!updated) throw new Error('Card not found');
  const obj = updated.toObject();
  return { id: String(updated._id), ...obj };
}

async function moveCard({ cardId, toColumnId, before, after }, { io } = {}) {
  const finalSortKey = between(before || null, after || null);

  if (await mongoSupportsTransactions()) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const card = await Card.findById(cardId).session(session);
      if (!card) throw new Error('Card not found');
      card.columnId = toColumnId;
      card.sortKey = finalSortKey;
      await card.save({ session });
      await session.commitTransaction();
      session.endSession();
    } catch (e) {
      await session.abortTransaction(); session.endSession(); throw e;
    }
  } else {
    const updated = await Card.findByIdAndUpdate(
      cardId,
      { $set: { columnId: toColumnId, sortKey: finalSortKey } },
      { new: true }
    );
    if (!updated) throw new Error('Card not found');
  }

  io?.emit?.('card:moved', { cardId, toColumnId, sortKey: finalSortKey });
  return { finalSortKey };
}

module.exports = {
  listTopics, createTopic,
  getTopicBoard,
  createColumn, reorderColumns,
  createCard, updateCard, moveCard,
};
