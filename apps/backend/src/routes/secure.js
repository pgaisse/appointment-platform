// apps/backend/src/routes/secure.js
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/me', requireAuth, (req, res) => {
  res.json({
    ok: true,
    tokenUser: req.user,  // lo que vino del token (incluye roles/permissions)
    dbUser: req.dbUser,   // lo que se guardó/actualizó en Mongo
  });
});

module.exports = router;
