// apps/backend/src/routes/secure.js
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/me', requireAuth, async (req, res) => {
  // req.user => claims normalizados desde JWT
  // req.dbUser => documento Mongo sincronizado por ensureUser
  console.log("entró a ME")
  res.json({ tokenUser: req.user, dbUser: req.dbUser });
});

module.exports = router;
