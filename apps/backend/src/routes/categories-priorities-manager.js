const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { PriorityList, Treatment } = require("../models/Appointments");
const { jwtCheck, ensureUser } = require("../middleware/auth");

// ——— Import robusto de schemas (soporta CJS / ESM default) ———
let S = require("../schemas/categories-priorities-manager.schema");
S = S && S.default ? S.default : S;

const {
  PriorityCreateSchema,
  PriorityUpdateSchema,
  TreatmentCreateSchema,
  TreatmentUpdateSchema,
} = S;

// ——— Helpers ———
function buildIdFilter(param, hasNumeric = true) {
  if (!param) return {};
  if (mongoose.Types.ObjectId.isValid(param)) return { _id: param };
  if (hasNumeric) {
    const asNum = Number(param);
    if (!Number.isNaN(asNum)) return { id: asNum };
  }
  return { _id: param };
}

// Middleware de validación con guardas
function validate(schema, pick = "body") {
  if (!schema || typeof schema.safeParse !== "function") {
    // Devuelve un middleware que reporta configuración inválida en tiempo de ejecución
    return function invalidSchema(_req, res) {
      console.error("[validate] Schema inválido o no importado correctamente:", schema);
      res.status(500).json({ error: "Server misconfiguration: invalid validation schema" });
    };
  }

  return function (req, res, next) {
    try {
      const input = pick === "params" ? req.params : req.body;
      const parsed = schema.safeParse(input);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Payload inválido",
          details: parsed.error.flatten(),
        });
      }
      if (pick === "params") req.validatedParams = parsed.data;
      else req.validatedBody = parsed.data;
      next();
    } catch (e) {
      console.error("[validate] Error validando:", e);
      res.status(500).json({ error: e.message || "Error" });
    }
  };
}

// Wrapper uniforme para errores async
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch((e) => {
      console.error(e);
      res.status(500).json({ error: e.message || "Error" });
    });
  };
}

router.use(jwtCheck, ensureUser);

// ——— PRIORITIES ———
router.get("/priorities", asyncHandler(async (req, res) => {
  const org_id = req.dbUser?.org_id;
  const docs = await PriorityList.find(org_id ? { org_id } : {}).sort({ name: 1 }).lean();
  res.json(docs);
}));

router.post(
  "/priorities",
  validate(PriorityCreateSchema),
  asyncHandler(async (req, res) => {
    const org_id = req.dbUser?.org_id;
    const payload = { ...req.validatedBody, org_id };

    const dup = await PriorityList.findOne({ org_id, id: payload.id }).lean();
    if (dup) return res.status(409).send("ID ya existe en la organización");

    const created = await PriorityList.create(payload);
    res.json(created);
  })
);

router.put(
  "/priorities/:id",
  validate(PriorityUpdateSchema),
  asyncHandler(async (req, res) => {
    const org_id = req.dbUser?.org_id;
    const { _id, org_id: _omit, ...update } = req.validatedBody;

    const filter = { ...buildIdFilter(req.params.id, true), ...(org_id ? { org_id } : {}) };
    const doc = await PriorityList.findOneAndUpdate(filter, update, { new: true, runValidators: true });
    if (!doc) return res.status(404).send("No encontrado");
    res.json(doc);
  })
);

router.delete("/priorities/:id", asyncHandler(async (req, res) => {
  const org_id = req.dbUser?.org_id;
  const filter = { ...buildIdFilter(req.params.id, true), ...(org_id ? { org_id } : {}) };
  const r = await PriorityList.deleteOne(filter);
  if (r.deletedCount === 0) return res.status(404).send("No encontrado");
  res.json({ ok: true });
}));

// ——— TREATMENTS ———
router.get("/treatments", asyncHandler(async (req, res) => {
  const org_id = req.dbUser?.org_id;
  const docs = await Treatment.find(org_id ? { org_id } : {}).sort({ name: 1 }).lean();
  res.json(docs);
}));

router.post(
  "/treatments",
  validate(TreatmentCreateSchema),
  asyncHandler(async (req, res) => {
    const org_id = req.dbUser?.org_id;
    const payload = { ...req.validatedBody, org_id };

    const dup = await Treatment.findOne({ org_id, name: payload.name }).lean();
    if (dup) return res.status(409).send("El nombre de tratamiento ya existe en la organización");

    const created = await Treatment.create(payload);
    res.json(created);
  })
);

router.put(
  "/treatments/:id",
  validate(TreatmentUpdateSchema),
  asyncHandler(async (req, res) => {
    const org_id = req.dbUser?.org_id;
    const { _id, org_id: _omit, ...update } = req.validatedBody;

    const filter = { ...buildIdFilter(req.params.id, false), ...(org_id ? { org_id } : {}) };

    if (update.name) {
      const exists = await Treatment.findOne({ org_id, name: update.name, _id: { $ne: filter._id } }).lean();
      if (exists) return res.status(409).send("El nombre de tratamiento ya existe en la organización");
    }

    const doc = await Treatment.findOneAndUpdate(filter, update, { new: true, runValidators: true });
    if (!doc) return res.status(404).send("No encontrado");
    res.json(doc);
  })
);

router.delete("/treatments/:id", asyncHandler(async (req, res) => {
  const org_id = req.dbUser?.org_id;
  const filter = { ...buildIdFilter(req.params.id, false), ...(org_id ? { org_id } : {}) };
  const r = await Treatment.deleteOne(filter);
  if (r.deletedCount === 0) return res.status(404).send("No encontrado");
  res.json({ ok: true });
}));

module.exports = router;
