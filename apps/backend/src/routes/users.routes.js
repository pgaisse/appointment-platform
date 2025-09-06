const express = require('express');
const router = express.Router();

const User = require('../models/User');
const { jwtCheck, attachUserInfo } = require('../middleware/auth');

router.use(jwtCheck);
router.use(attachUserInfo);

router.post('/users', async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    const user = await User.findOneAndUpdate(
      { email },
      { $setOnInsert: { email, name } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
