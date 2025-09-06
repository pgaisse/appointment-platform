// backend/src/helpers/topics.service.js
const mongoose = require('mongoose');
const { isValidObjectId } = mongoose;

const Topic  = require('../models/Organizer/Topic');
const Column = require('../models/Organizer/Column');
const Card   = require('../models/Organizer/Card');

const BASE_GAP = 1000;
const CARD_GAP = 1000;

// ------------------------ Helpers ------------------------
function normalizePatch(patch, topic) {
  const out = { ...patch };

  // normaliza labels (guardamos solo IDs)
  if (Array.isArray(patch.labels)) {
    out.labels = patch.labels
      .map(l => {
        if (typeof l === 'string') return l;
        if (l && typeof l === 'object' && l.id) return l.id;
        const hit = (topic?.labels || []).find(x => x.name === l?.name);
        return hit ? hit.id : null;
      })
      .filter(Boolean);
  }

  // completed: asegurar boolean si viene
  if (typeof patch.completed !== 'undefined') {
    out.completed = !!patch.completed;
  }

  return out;
}

function hydrateCardLabels(cards, topic) {
  const defs = Array.isArray(topic?.labels) ? topic.labels : [];
  const byId = new Map(defs.map(l => [l.id, l]));
  for (const c of cards) {
    const raw = Array.isArray(c.labels) ? c.labels : [];
    c.labels = raw.map(x => (typeof x === 'string' ? byId.get(x) : x)).filter(Boolean);
  }
  return cards;
}

async function nextSortKeyForColumn(topicId, columnId) {
  const last = await Card.find({ topicId, columnId }).sort({ sortKey: -1 }).limit(1).lean();
  return last.length ? (last[0].sortKey || 0) + BASE_GAP : BASE_GAP;
}

async function renumberColumn(topicId, columnId) {
  const cards = await Card.find({ topicId, columnId }).sort({ sortKey: 1 }).lean();
  const ops = cards.map((c, idx) => ({
    updateOne: {
      filter: { _id: c._id },
      update: { $set: { sortKey: (idx + 1) * BASE_GAP } }
    }
  }));
  if (ops.length) await Card.bulkWrite(ops);
}

// ------------------------ Topics ------------------------
exports.listTopics = async function listTopics() {
  const topics = await Topic.find().lean();
  return topics.map(t => ({
    id: String(t._id),
    title: t.title,
    key: t.key,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt
  }));
};

exports.createTopic = async function createTopic({ title, key }) {
  if (!title || !String(title).trim()) {
    const err = new Error('title required');
    err.status = 400;
    throw err;
  }
  const payload = {
    title: String(title).trim(),
    labels: [],
  };
  if (key && String(key).trim()) payload.key = String(key).trim();

  try {
    const t = await Topic.create(payload);
    return { id: String(t._id), title: t.title, key: t.key, createdAt: t.createdAt, updatedAt: t.updatedAt };
  } catch (e) {
    // Duplicate key
    if (e && e.code === 11000) {
      const err = new Error('duplicated key');
      err.status = 409;
      throw err;
    }
    throw e;
  }
};

// ------------------------ Board read ------------------------
exports.getTopicBoard = async function getTopicBoard(topicId) {
  const topic = await Topic.findById(topicId).lean();
  if (!topic) throw new Error('Topic not found');

  const columns = await Column.find({ topicId }).sort({ sortKey: 1 }).lean();
  const cards   = await Card.find({ topicId }).sort({ sortKey: 1 }).lean();

  hydrateCardLabels(cards, topic);

  const cardsByColumn = {};
  for (const col of columns) cardsByColumn[String(col._id)] = [];
  for (const c of cards) {
    const key = String(c.columnId);
    (cardsByColumn[key] || (cardsByColumn[key] = [])).push({
      id: String(c._id),
      title: c.title,
      description: c.description,
      sortKey: c.sortKey,
      labels: c.labels, // hydrated
      members: c.members,
      dueDate: c.dueDate,
      checklist: c.checklist,
      attachments: c.attachments,
      comments: c.comments,
      completed: !!c.completed, // ✅ incluir completed
    });
  }

  return {
    columns: columns.map(col => ({ id: String(col._id), title: col.title, sortKey: col.sortKey })),
    cardsByColumn
  };
};

// ------------------------ Columns ------------------------
async function nextColumnSort(topicId) {
  const last = await Column.find({ topicId }).sort({ sortKey: -1 }).limit(1).lean();
  return last.length ? (Number(last[0].sortKey) || 0) + BASE_GAP : BASE_GAP;
}

exports.createColumn = async function createColumn(topicId, { title }) {
  if (!topicId) {
    const e = new Error('topicId required'); e.status = 400; throw e;
  }
  if (!title || !String(title).trim()) {
    const e = new Error('title required'); e.status = 400; throw e;
  }

  const t = await Topic.findById(topicId).lean();
  if (!t) { const e = new Error('Topic not found'); e.status = 404; throw e; }

  const sortKey = await nextColumnSort(topicId);
  const col = await Column.create({
    topicId,
    title: String(title).trim(),
    sortKey,
  });

  return { id: String(col._id), title: col.title, sortKey: col.sortKey };
};

exports.reorderColumns = async function reorderColumns(topicId, orderedColumnIds) {
  if (!Array.isArray(orderedColumnIds)) throw new Error('orderedColumnIds must be an array');
  const ops = orderedColumnIds.map((id, idx) => ({
    updateOne: {
      filter: { _id: id, topicId },
      update: { $set: { sortKey: (idx + 1) * BASE_GAP } }
    }
  }));
  if (ops.length) await Column.bulkWrite(ops);
};

// ------------------------ Cards ------------------------


exports.createCard = async function createCard(topicId, body) {
  const { columnId, title, description } = body || {};

  if (!topicId || !mongoose.isValidObjectId(topicId)) {
    const e = new Error('Invalid topicId'); e.status = 400; throw e;
  }
  if (!columnId || !mongoose.isValidObjectId(columnId)) {
    const e = new Error('Invalid columnId'); e.status = 400; throw e;
  }
  if (!title || !String(title).trim()) {
    const e = new Error('title required'); e.status = 400; throw e;
  }

  const topic = await Topic.findById(topicId).lean();
  if (!topic) { const e = new Error('Topic not found'); e.status = 404; throw e; }

  const column = await Column.findOne({ _id: columnId, topicId }).lean();
  if (!column) { const e = new Error('Column not found in this topic'); e.status = 404; throw e; }

  // sortKey secuencial por columna
  const last = await Card.find({ topicId, columnId }).sort({ sortKey: -1 }).limit(1).lean();
  const sortKey = last.length ? (Number(last[0].sortKey) || 0) + CARD_GAP : CARD_GAP;

  const doc = await Card.create({
    topicId,
    columnId,
    title: String(title).trim(),
    description: description ? String(description) : '',
    sortKey,
    labels: [],
    members: [],
    checklist: [],
    attachments: [],
    comments: [],
    completed: false,
  });

  return {
    id: String(doc._id),
    title: doc.title,
    description: doc.description,
    sortKey: doc.sortKey,
    labels: doc.labels,
    members: doc.members,
    checklist: doc.checklist,
    attachments: doc.attachments,
    comments: doc.comments,
    completed: !!doc.completed,
  };
};


exports.updateCard = async function updateCard(cardId, patch) {
  if (!isValidObjectId(cardId)) throw new Error('Invalid cardId');

  // 1) Cargar card
  const card = await Card.findById(cardId).lean();
  if (!card) throw new Error('Card not found');

  // 2) Intentar cargar topic; si no existe, igual seguimos (no hidrataremos labels)
  let topic = null;
  try {
    topic = await Topic.findById(card.topicId).lean();
    // si te parece crítico:
    // if (!topic) throw new Error('Topic not found');
  } catch {
    topic = null;
  }

  // 3) Normalizar patch con/ sin topic
  const normalized = topic ? normalizePatch(patch, topic) : (() => {
    const out = { ...patch };
    if (typeof out.completed !== 'undefined') out.completed = !!out.completed;
    // evitar cambios de ownership
    delete out._id; delete out.topicId; delete out.columnId;
    return out;
  })();

  // 4) Actualizar
  const updated = await Card.findByIdAndUpdate(
    cardId,
    { $set: normalized },
    { new: true, runValidators: true }
  ).lean();

  if (!updated) throw new Error('Card not found'); // improbable

  // 5) Hidratación segura de labels
  const [hydrated] = hydrateCardLabels([updated], topic);

  return {
    id: String(updated._id),
    title: hydrated.title,
    description: hydrated.description,
    sortKey: hydrated.sortKey,
    labels: hydrated.labels,
    members: hydrated.members,
    dueDate: hydrated.dueDate,
    checklist: hydrated.checklist,
    attachments: hydrated.attachments,
    comments: hydrated.comments,
    completed: !!updated.completed,
  };
};

exports.moveCard = async function moveCard({ cardId, toColumnId, before, after }) {
  if (!isValidObjectId(cardId)) throw new Error('Invalid cardId');
  const card = await Card.findById(cardId).lean();
  if (!card) throw new Error('Card not found');

  const topicId = card.topicId;
  let targetColumnId = card.columnId;

  if (toColumnId) {
    if (!isValidObjectId(toColumnId)) throw new Error('Invalid toColumnId');
    const col = await Column.findOne({ _id: toColumnId, topicId }).lean();
    if (!col) throw new Error('Target column not found in this topic');
    targetColumnId = col._id;
  }

  let beforeDoc = null;
  if (before && isValidObjectId(before)) {
    beforeDoc = await Card.findById(before).lean();
    if (beforeDoc && String(beforeDoc.topicId) !== String(topicId)) beforeDoc = null;
  }
  let afterDoc = null;
  if (after && isValidObjectId(after)) {
    afterDoc = await Card.findById(after).lean();
    if (afterDoc && String(afterDoc.topicId) !== String(topicId)) afterDoc = null;
  }
  if (beforeDoc && String(beforeDoc.columnId) !== String(targetColumnId)) beforeDoc = null;
  if (afterDoc  && String(afterDoc.columnId)  !== String(targetColumnId)) afterDoc  = null;

  let finalSort;
  if (!beforeDoc && !afterDoc) {
    finalSort = await nextSortKeyForColumn(topicId, targetColumnId);
  } else if (beforeDoc && afterDoc) {
    finalSort = (Number(beforeDoc.sortKey) + Number(afterDoc.sortKey)) / 2;
    if (!isFinite(finalSort) || finalSort === beforeDoc.sortKey || finalSort === afterDoc.sortKey) {
      await renumberColumn(topicId, targetColumnId);
      beforeDoc = await Card.findById(before).lean();
      afterDoc  = await Card.findById(after).lean();
      finalSort = (Number(beforeDoc.sortKey) + Number(afterDoc.sortKey)) / 2;
    }
  } else if (beforeDoc && !afterDoc) {
    finalSort = Number(beforeDoc.sortKey) - 0.5;
  } else {
    finalSort = Number(afterDoc.sortKey) + 0.5;
  }

  if (!isFinite(finalSort)) {
    await renumberColumn(topicId, targetColumnId);
    finalSort = await nextSortKeyForColumn(topicId, targetColumnId);
  }

  await Card.updateOne(
    { _id: cardId },
    { $set: { columnId: targetColumnId, sortKey: finalSort } }
  );

  return { finalSortKey: finalSort };
};

// ------------------------ Topic Labels ------------------------
exports.listTopicLabels = async (topicId) => {
  const t = await Topic.findById(topicId).lean();
  if (!t) throw new Error('Topic not found');
  return (t.labels || []).map(l => ({ id: l.id, name: l.name, color: l.color }));
};

exports.createTopicLabel = async (topicId, body) => {
  const t = await Topic.findById(topicId);
  if (!t) throw new Error('Topic not found');
  const name = String(body?.name || '').trim();
  if (!name) throw new Error('name required');

  const exists = (t.labels || []).some(l => l.name.toLowerCase() === name.toLowerCase());
  if (exists) throw new Error('Label name already exists');

  const label = {
    id: body.id || (Date.now().toString(36) + Math.random().toString(36).slice(2,8)),
    name,
    color: body.color,
  };
  t.labels.push(label);
  await t.save();
  return label;
};

exports.updateTopicLabel = async (topicId, labelId, body) => {
  const t = await Topic.findById(topicId);
  if (!t) throw new Error('Topic not found');
  const idx = (t.labels || []).findIndex(l => l.id === labelId);
  if (idx === -1) throw new Error('Label not found');
  if (body.name)  t.labels[idx].name  = String(body.name).trim();
  if (body.color) t.labels[idx].color = body.color;
  await t.save();
  return t.labels[idx];
};


// ---- Deletes ----
exports.deleteTopicLabel = async (topicId, labelId) => {
  const t = await Topic.findById(topicId);
  if (!t) throw new Error('Topic not found');
  t.labels = (t.labels || []).filter(l => l.id !== labelId);
  await t.save();
  await Card.updateMany({ topicId }, { $pull: { labels: labelId } });
};

exports.deleteCard = async function deleteCard(cardId) {
  const found = await Card.findById(cardId).lean();
  if (!found) throw new Error('Card not found');
  await Card.deleteOne({ _id: cardId });
  return { ok: true };
};

exports.deleteColumn = async function deleteColumn(columnId) {
  const col = await Column.findById(columnId).lean();
  if (!col) throw new Error('Column not found');
  // borra tarjetas de la columna
  const { deletedCount: delCards } = await Card.deleteMany({ columnId });
  await Column.deleteOne({ _id: columnId });
  return { ok: true, deletedCards: delCards || 0 };
};

exports.deleteTopic = async function deleteTopic(topicId) {
  const topic = await Topic.findById(topicId).lean();
  if (!topic) throw new Error('Topic not found');
  const cols = await Column.find({ topicId }, { _id: 1 }).lean();
  const colIds = cols.map(c => c._id);

  const { deletedCount: delCards } = await Card.deleteMany({ topicId });
  const { deletedCount: delCols }  = await Column.deleteMany({ topicId });
  await Topic.deleteOne({ _id: topicId });

  return { ok: true, deletedColumns: delCols || colIds.length, deletedCards: delCards || 0 };
};