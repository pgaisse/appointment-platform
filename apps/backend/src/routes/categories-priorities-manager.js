const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { PriorityList, Treatment } = require("../models/Appointments");
const { jwtCheck, ensureUser } = require("../middleware/auth");

function buildIdFilter(param, hasNumeric = true) {
  if (!param) return {};
  if (mongoose.Types.ObjectId.isValid(param)) return { _id: param };
  if (hasNumeric) {
    const asNum = Number(param);
    if (!Number.isNaN(asNum)) return { id: asNum };
  }
  return { _id: param }; // fallback, typically won't match if not ObjectId
}

router.use(jwtCheck, ensureUser);

// ——— PRIORITIES ———
router.get("/priorities", async (req, res) => {
  try {
    const org_id = req.dbUser?.org_id;
    const docs = await PriorityList.find(org_id ? { org_id } : {}).sort({ name: 1 }).lean();
    res.json(docs);
  } catch (e) {
    res.status(500).send(e.message || "Error");
  }
});

router.post("/priorities", async (req, res) => {
  try {
    const org_id = req.dbUser?.org_id;
    const payload = { ...req.body, org_id };

    if (!payload.name || !payload.description || payload.durationHours == null || !payload.color || payload.id == null)
      return res.status(400).send("Missing required fields");

    const dup = await PriorityList.findOne({ org_id, id: payload.id }).lean();
    if (dup) return res.status(409).send("ID already exists in organization");

    const created = await PriorityList.create(payload);
    res.json(created);
  } catch (e) {
    res.status(500).send(e.message || "Error");
  }
});

router.put("/priorities/:id", async (req, res) => {
  try {
    const org_id = req.dbUser?.org_id;
    const filter = { ...buildIdFilter(req.params.id, true), ...(org_id ? { org_id } : {}) };
    const update = { ...req.body };
    const doc = await PriorityList.findOneAndUpdate(filter, update, { new: true });
    if (!doc) return res.status(404).send("Not found");
    res.json(doc);
  } catch (e) {
    res.status(500).send(e.message || "Error");
  }
});

router.delete("/priorities/:id", async (req, res) => {
  try {
    const org_id = req.dbUser?.org_id;
    const filter = { ...buildIdFilter(req.params.id, true), ...(org_id ? { org_id } : {}) };
    const r = await PriorityList.deleteOne(filter);
    if (r.deletedCount === 0) return res.status(404).send("Not found");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).send(e.message || "Error");
  }
});

// ——— TREATMENTS ———
router.get("/treatments", async (req, res) => {
  try {
    const org_id = req.dbUser?.org_id;
    const docs = await Treatment.find(org_id ? { org_id } : {}).sort({ name: 1 }).lean();
    res.json(docs);
  } catch (e) {
    res.status(500).send(e.message || "Error");
  }
});

router.post("/treatments", async (req, res) => {
  try {
    const org_id = req.dbUser?.org_id;
    const payload = { ...req.body, org_id };

    if (!payload.name || payload.duration == null || !payload.icon || !payload.minIcon || !payload.color)
      return res.status(400).send("Missing required fields");

    // Optional: ensure unique name per org (schema may have global unique)
    const dup = await Treatment.findOne({ org_id, name: payload.name }).lean();
    if (dup) return res.status(409).send("Treatment name already exists in organization");

    const created = await Treatment.create(payload);
    res.json(created);
  } catch (e) {
    res.status(500).send(e.message || "Error");
  }
});

router.put("/treatments/:id", async (req, res) => {
  try {
    const org_id = req.dbUser?.org_id;
    const filter = { ...buildIdFilter(req.params.id, false), ...(org_id ? { org_id } : {}) };
    const update = { ...req.body };

    // If updating name, check duplicate by org
    if (update.name) {
      const exists = await Treatment.findOne({ org_id, name: update.name, _id: { $ne: filter._id } }).lean();
      if (exists) return res.status(409).send("Treatment name already exists in organization");
    }

    const doc = await Treatment.findOneAndUpdate(filter, update, { new: true });
    if (!doc) return res.status(404).send("Not found");
    res.json(doc);
  } catch (e) {
    res.status(500).send(e.message || "Error");
  }
});

router.delete("/treatments/:id", async (req, res) => {
  try {
    const org_id = req.dbUser?.org_id;
    const filter = { ...buildIdFilter(req.params.id, false), ...(org_id ? { org_id } : {}) };
    const r = await Treatment.deleteOne(filter);
    if (r.deletedCount === 0) return res.status(404).send("Not found");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).send(e.message || "Error");
  }
});

module.exports = router;