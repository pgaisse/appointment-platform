const validate = (schema) => (req, res, next) => {
  if (!schema) return next();
  const data = ['POST','PUT','PATCH'].includes(req.method) ? req.body : req.query;
  const { error, value } = schema.validate(data, { abortEarly: false, convert: true, allowUnknown: true });
  if (error) {
    return res.status(400).json({ error: 'ValidationError', details: error.details.map(d => d.message) });
  }
  if (['POST','PUT','PATCH'].includes(req.method)) req.body = value; else req.query = value;
  next();
};
module.exports = { validate };
