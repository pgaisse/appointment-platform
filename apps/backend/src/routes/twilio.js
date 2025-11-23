// apps/backend/src/routes/twilio.js
const express = require('express');
const router = express.Router();
const { jwtCheck, attachUserInfo, ensureUser } = require('../middleware/auth');
const { syncUserFromToken } = require('../middleware/sync-user');
const twilio = require('twilio');

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

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      console.error('[GET /twilio/balance] Missing Twilio credentials in environment');
      return res.status(500).json({ error: 'Twilio credentials not configured' });
    }

    console.log('[GET /twilio/balance] Fetching balance from Twilio...');
    const client = twilio(accountSid, authToken);
    
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
