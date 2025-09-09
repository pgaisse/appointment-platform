// backend/src/middleware/validate.js
const isMutation = (m) => ['POST', 'PUT', 'PATCH'].includes(m);

function formatZodIssues(err) {
  try {
    return err.issues?.map(i => `${(i.path || []).join('.')}: ${i.message}`) ?? [];
  } catch {
    return [err?.message || 'Invalid payload'];
  }
}

module.exports.validate = (schema, options = {}) => async (req, res, next) => {
  try {
    // Si no hay schema, deja pasar
    if (!schema) return next();

    const target = isMutation(req.method) ? 'body' : 'query';
    const data = req[target];

    // ---- Joi / Yup: tienen .validate ----
    if (typeof schema.validate === 'function') {
      const cfg = {
        abortEarly: false,
        stripUnknown: true,   // evita campos extra
        convert: true,
        allowUnknown: true,
        ...options,
      };
      const result = await schema.validate(data, cfg); // Yup devuelve Promise, Joi también soporta Promise
      req[target] = result;
      return next();
    }

    // ---- Zod: .safeParse / .parse ----
    if (typeof schema.safeParse === 'function') {
      const out = schema.safeParse(data);
      if (!out.success) {
        return res.status(400).json({
          error: 'ValidationError',
          details: formatZodIssues(out.error),
        });
      }
      req[target] = out.data;
      return next();
    }
    if (typeof schema.parse === 'function') {
      const out = schema.parse(data);
      req[target] = out;
      return next();
    }

    // Tipo de schema desconocido → no validamos (no romper)
    return next();
  } catch (err) {
    // Joi
    if (err && Array.isArray(err.details)) {
      return res.status(400).json({
        error: 'ValidationError',
        details: err.details.map(d => d.message),
      });
    }
    // Yup
    if (err?.name === 'ValidationError' && Array.isArray(err.inner)) {
      return res.status(400).json({
        error: 'ValidationError',
        details: err.inner.map(i => i.message),
      });
    }
    // Zod (si lanza .parse)
    if (err && err.issues) {
      return res.status(400).json({
        error: 'ValidationError',
        details: formatZodIssues(err),
      });
    }
    // Fallback
    return res.status(400).json({
      error: 'ValidationError',
      details: [err?.message || 'Invalid payload'],
    });
  }
};
