const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const { jwtCheck, attachUserInfo, ensureUser } = require('../middleware/auth');
const { Appointment } = require('../models/Appointments');

// Protect everything in this router
router.use(jwtCheck, attachUserInfo, ensureUser);

/**
 * GET /validate/check-unique?e164=+61XXXXXXXXX&excludeId=<optional 24hex>
 * Returns: { exists: boolean }
 */
router.get('/check-unique', async (req, res) => {
  try {
    const org_id = req.user?.org_id; // set by attachUserInfo
    if (!org_id) return res.status(400).json({ error: 'org_id missing' });

    const e164 = String(req.query.e164 || '').trim();
    const excludeId = String(req.query.excludeId || '').trim();

    if (!e164) {
      return res.status(400).json({ error: 'e164 is required' });
    }

    const filter = { org_id, phoneE164: e164 };

    if (excludeId && mongoose.isValidObjectId(excludeId)) {
      filter._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }

    const exists = await Appointment.exists(filter);

    // Helpful server log (optional)
    console.log('[check-unique]', { org_id, e164, excludeId: filter._id ? excludeId : undefined, exists: !!exists });

    return res.json({ exists: !!exists });
  } catch (err) {
    console.error('[check-unique] error:', err?.message || err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
