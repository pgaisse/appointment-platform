const Joi = require('joi');

const schema = Joi.object({
  phone: Joi.string().required(),
  text: Joi.string().min(1).required(),
  author: Joi.string().required(),
});

const validateMessage = (data) => schema.validate(data);

module.exports = { validateMessage };
