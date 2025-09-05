const Topic = require('../models/Organizer/Topic');
const Column = require('../models/Organizer/Column');
const Card   = require('../models/Organizer/Card');
const svc = require('../helpers/topics.service'); 

function normalizePatch(patch, topic) {
  const out = { ...patch };
  if (Array.isArray(patch.labels)) {
    // guardamos SOLO ids de label
    out.labels = patch.labels.map(l => {
      if (typeof l === 'string') return l;             // ya es id
      if (l && typeof l === 'object' && l.id) return l.id; // objeto -> id
      // fallback: por name -> id del catálogo
      const hit = (topic?.labels || []).find(x => x.name === l?.name);
      return hit ? hit.id : null;
    }).filter(Boolean);
  }
  return out;
}

function hydrateCardLabels(cards, topic) {
  const defs = Array.isArray(topic?.labels) ? topic.labels : [];
  const byId = new Map(defs.map(l => [l.id, l]));
  for (const c of cards) {
    const raw = Array.isArray(c.labels) ? c.labels : [];
    c.labels = raw.map(x => (typeof x === 'string' ? byId.get(x) : x))
                  .filter(Boolean);
  }
  return cards;
}

exports.listTopics = async function listTopics() {
  const topics = await Topic.find().lean();
  return topics.map(t => ({ id: String(t._id), title: t.title, key: t.key, createdAt: t.createdAt, updatedAt: t.updatedAt }));
};
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
      labels: c.labels, // objetos completos (id,name,color)
      members: c.members,
      dueDate: c.dueDate,
      checklist: c.checklist,
      attachments: c.attachments,
      comments: c.comments,
    });
  }

  return {
    columns: columns.map(col => ({ id: String(col._id), title: col.title, sortKey: col.sortKey })),
    cardsByColumn
  };
};

exports.updateCard = async function updateCard(cardId, patch) {
  const card = await Card.findById(cardId).lean();
  if (!card) throw new Error('Card not found');
  const topic = await Topic.findById(card.topicId).lean();

  const normalized = normalizePatch(patch, topic);
  const updated = await Card.findByIdAndUpdate(
    cardId,
    { $set: normalized },
    { new: true, runValidators: true }
  ).lean();

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
  };
};

// ---- Gestión del catálogo de labels del tópico ----
exports.listTopicLabels = async (topicId) => {
  const t = await Topic.findById(topicId).lean();
  if (!t) throw new Error('Topic not found');
  return (t.labels || []).map(l => ({ id: l.id, name: l.name, color: l.color }));
};

exports.createTopicLabel = async (topicId, body) => {
  const t = await Topic.findById(topicId);
  if (!t) throw new Error('Topic not found');
  const exists = (t.labels || []).some(l => l.name.toLowerCase() === body.name.trim().toLowerCase());
  if (exists) throw new Error('Label name already exists');

  const label = {
    id: body.id || (Date.now().toString(36) + Math.random().toString(36).slice(2,8)),
    name: body.name.trim(),
    color: body.color
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
  if (body.name)  t.labels[idx].name  = body.name.trim();
  if (body.color) t.labels[idx].color = body.color;
  await t.save();
  return t.labels[idx];
};

exports.deleteTopicLabel = async (topicId, labelId) => {
  const t = await Topic.findById(topicId);
  if (!t) throw new Error('Topic not found');
  t.labels = (t.labels || []).filter(l => l.id !== labelId);
  await t.save();
  // opcional: quitar ese label de todas las cards del tópico
  await Card.updateMany({ topicId }, { $pull: { labels: labelId } });
};
