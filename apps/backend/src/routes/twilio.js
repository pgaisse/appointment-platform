// apps/backend/src/routes/twilio.js
const express = require('express');
const router = express.Router();
const { jwtCheck, attachUserInfo, ensureUser } = require('../middleware/auth');
const { syncUserFromToken } = require('../middleware/sync-user');
const TwilioService = require('../services/TwilioService');

// Protected routes middleware chain
router.use(jwtCheck, attachUserInfo, ensureUser, syncUserFromToken);

// Get Twilio account balance
router.get('/balance', async (req, res) => {
  try {
    // Check master permission
    const user = req.dbUser;
    const permissions = user?.permissions || [];
    if (!permissions.includes('master')) {
      console.log('[GET /twilio/balance] Forbidden: user lacks master permission');
      return res.status(403).json({ error: 'Forbidden: master permission required' });
    }

    const org_id = user?.org_id || req.user?.org_id;
    if (!org_id) {
      console.log('[GET /twilio/balance] Missing org_id. req.dbUser:', user, 'req.user:', req.user);
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    console.log('[GET /twilio/balance] Fetching balance for org:', org_id);
    
    // Use TwilioService to get client (supports multi-tenant)
    const { client } = await TwilioService.getClient(org_id);
    
    // Fetch balance using the correct Twilio API endpoint
    const balance = await client.balance.fetch();

    console.log('[GET /twilio/balance] Success:', { balance: balance.balance, currency: balance.currency });
    return res.json({
      balance: balance.balance,
      currency: balance.currency || 'USD'
    });
  } catch (error) {
    console.error('[GET /twilio/balance] error:', error);
    console.error('[GET /twilio/balance] error details:', {
      message: error.message,
      code: error.code,
      moreInfo: error.moreInfo,
      status: error.status
    });
    return res.status(500).json({ 
      error: 'Failed to fetch Twilio balance', 
      message: error.message,
      code: error.code 
    });
  }
});

module.exports = router;
