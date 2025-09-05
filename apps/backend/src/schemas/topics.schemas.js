// backend/src/schemas/topics.schemas.js
const Joi = require('joi');

const labelDef = Joi.object({
  id: Joi.string().optional(),
  name: Joi.string().required(),
  color: Joi.string().valid(
    'green', 'yellow', 'orange', 'red', 'purple', 'blue', 'lime', 'sky', 'pink', 'gray', 'black'
  ).required()
});

exports.createTopic = Joi.object({
  title: Joi.string().min(1).required(),
  key: Joi.string().optional()
});

exports.createColumn = Joi.object({
  title: Joi.string().min(1).required()
});
exports.createTopicLabel = Joi.object({
  name: Joi.string().min(1).required(),
  color: Joi.string().valid(
    'green', 'yellow', 'orange', 'red', 'purple', 'blue', 'lime', 'sky', 'pink', 'gray', 'black'
  ).required()
});
exports.createCard = Joi.object({
  title: Joi.string().min(1).required(),
  columnId: Joi.string().required()
});

exports.updateTopicLabel = Joi.object({
  name: Joi.string().min(1).optional(),
  color: Joi.string().valid(
    'green','yellow','orange','red','purple','blue','lime','sky','pink','gray','black'
  ).optional()
}).min(1);

exports.updateCard = Joi.object({
  title: Joi.string(),
  description: Joi.string().allow(''),
  // ⬇️ acepta ambas formas
  labels: Joi.alternatives().try(
    Joi.array().items(Joi.string()),
    Joi.array().items(labelDef)
  ),
  members: Joi.array().items(Joi.string()),
  dueDate: Joi.date().allow(null),
  checklist: Joi.array().items(Joi.object({
    id: Joi.string().required(),
    text: Joi.string().required(),
    done: Joi.boolean().required()
  })),
  attachments: Joi.array().items(Joi.object({
    id: Joi.string().required(),
    url: Joi.string().uri().required(),
    name: Joi.string().allow('')
  })),
  comments: Joi.array().items(Joi.object({
    id: Joi.string().required(),
    text: Joi.string().required(),
    createdAt: Joi.date().iso().optional()
  }))
}).min(1);
