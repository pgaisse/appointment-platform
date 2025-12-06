const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const { jwtCheck, attachUserInfo, ensureUser } = require('../middleware/auth');
const { Appointment } = require('../models/Appointments');

// Protect everything in this router
router.use(jwtCheck, attachUserInfo, ensureUser);

/**
 * GET /validate/check-unique?e164=+61XXXXXXXXX&excludeId=<optional 24hex>
 * Returns: { 
 *   exists: boolean, 
 *   isUnknown?: boolean, 
 *   existingId?: string,
 *   existingRecord?: object
 * }
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

    // Generate all possible phone format variations to search
    // E.164: +61422150259
    // Without +: 61422150259  
    // Local: 0422150259
    const phoneVariations = [e164];
    
    // Add variation without the + prefix
    if (e164.startsWith('+61')) {
      phoneVariations.push(e164.substring(1)); // 61422150259
      phoneVariations.push('0' + e164.substring(3)); // 0422150259
    } else if (e164.startsWith('61') && e164.length === 11) {
      phoneVariations.push('+' + e164); // +61422150259
      phoneVariations.push('0' + e164.substring(2)); // 0422150259
    } else if (e164.startsWith('04') && e164.length === 10) {
      phoneVariations.push('+61' + e164.substring(1)); // +61422150259
      phoneVariations.push('61' + e164.substring(1)); // 61422150259
    }

    console.log('[check-unique] Searching for phone variations:', phoneVariations);

    // Search by ALL possible phone format variations
    // This catches duplicates regardless of how the number was stored
    const baseFilter = { 
      org_id,
      $or: [
        { phoneE164: { $in: phoneVariations } },
        { phoneInput: { $in: phoneVariations } }
      ]
    };

    if (excludeId && mongoose.isValidObjectId(excludeId)) {
      baseFilter._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }

    // Query for the record instead of just checking existence
    const existingRecord = await Appointment.findOne(baseFilter)
      .select('_id nameInput lastNameInput phoneInput phoneE164 emailInput unknown')
      .lean();

    if (!existingRecord) {
      return res.json({ exists: false });
    }

    // Determine if record is "unknown"/incomplete:
    // 1. Explicit unknown flag set to true
    // 2. Missing both first and last name (contact added from external source without full data)
    const hasNoName = !existingRecord.nameInput && !existingRecord.lastNameInput;
    const isUnknownRecord = existingRecord.unknown === true || hasNoName;

    if (isUnknownRecord) {
      console.log('[check-unique] Found unknown/incomplete record:', { 
        id: existingRecord._id, 
        phone: e164,
        hasUnknownFlag: existingRecord.unknown === true,
        hasNoName: hasNoName
      });
      
      return res.json({
        exists: true,
        isUnknown: true,
        existingId: existingRecord._id.toString(),
        existingRecord: {
          _id: existingRecord._id.toString(),
          nameInput: existingRecord.nameInput,
          lastNameInput: existingRecord.lastNameInput,
          phoneInput: existingRecord.phoneInput,
          phoneE164: existingRecord.phoneE164,
          emailInput: existingRecord.emailInput,
        },
      });
    }

    // Record exists and is complete - block submission
    return res.json({ exists: true, isUnknown: false });
    
  } catch (err) {
    console.error('[check-unique] error:', err?.message || err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
