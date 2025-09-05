const Joi = require('joi');

const createTopic = Joi.object({
  title: Joi.string().min(1).required(),
  key: Joi.string().allow('', null),
  meta: Joi.object().default({}),
});

const createColumn = Joi.object({
  title: Joi.string().min(1).required(),
  meta: Joi.object().default({}),
});

const createCard = Joi.object({
  columnId: Joi.string().required(),
  title: Joi.string().required(),
  description: Joi.string().allow(''),
  labels: Joi.array().items(Joi.string()).default([]),
  members: Joi.array().items(Joi.string()).default([]),
  dueDate: Joi.date().allow(null),
  coverUrl: Joi.string().uri().allow('', null),
  checklist: Joi.array().items(
    Joi.object({ id: Joi.string().required(), text: Joi.string().required(), done: Joi.boolean().default(false) })
  ).default([]),
  attachments: Joi.array().items(
    Joi.object({ id: Joi.string().required(), url: Joi.string().uri().required(), name: Joi.string().allow(''), mime: Joi.string().allow(''), size: Joi.number() })
  ).default([]),
  comments: Joi.array().items(
    Joi.object({ id: Joi.string().required(), authorId: Joi.string().allow(''), authorName: Joi.string().allow(''), text: Joi.string().required(), createdAt: Joi.date() })
  ).default([]),
});

const updateCard = Joi.object({
  title: Joi.string(),
  description: Joi.string().allow(''),
  labels: Joi.array().items(Joi.string()),
  members: Joi.array().items(Joi.string()),
  dueDate: Joi.date().allow(null),
  coverUrl: Joi.string().uri().allow('', null),
  checklist: Joi.array().items(
    Joi.object({ id: Joi.string().required(), text: Joi.string().required(), done: Joi.boolean().default(false) })
  ),
  attachments: Joi.array().items(
    Joi.object({ id: Joi.string().required(), url: Joi.string().uri().required(), name: Joi.string().allow(''), mime: Joi.string().allow(''), size: Joi.number() })
  ),
  comments: Joi.array().items(
    Joi.object({ id: Joi.string().required(), authorId: Joi.string().allow(''), authorName: Joi.string().allow(''), text: Joi.string().required(), createdAt: Joi.date() })
  ),
}).min(1);

module.exports = { createTopic, createColumn, createCard, updateCard };
