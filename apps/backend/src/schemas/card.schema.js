// backend/src/schemas/card.schema.js (ejemplo con Joi)
const Joi = require('joi');

exports.patchCard = Joi.object({
  title: Joi.string(),
  description: Joi.string().allow(''),
  labels: Joi.array().items(
    Joi.object({
      id: Joi.string().required(),
      name: Joi.string().required(),
      color: Joi.string().valid(
        'green','yellow','orange','red','purple','blue','lime','sky','pink','gray','black'
      ).required()
    })
  ),
  // demás campos opcionales...
}).min(1);
