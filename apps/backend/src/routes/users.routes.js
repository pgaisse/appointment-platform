const express = require('express');
const { requireAuth } = require('../middleware/auth');
const User = require('../models/User/User');
const UserProfile = require('../models/UserProfile/UserProfile');

const router = express.Router();

const requireAdmin = [...requireAuth, (req, res, next) => {
  if (!req.user?.roles?.includes('Admin')) {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
}];

router.get('/users', requireAdmin, async (_req, res) => {
  const users = await User.find().populate('profile');
  res.json(users);
});

router.get('/users/:id', requireAdmin, async (req, res) => {
  const user = await User.findById(req.params.id).populate('profile');
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json(user);
});

router.put('/users/:id', requireAdmin, async (req, res) => {
  const { profile, ...userData } = req.body || {};
  const user = await User.findByIdAndUpdate(req.params.id, userData, { new: true });
  if (!user) return res.status(404).json({ error: 'not_found' });

  if (profile) {
    await UserProfile.findOneAndUpdate(
      { user: user._id },
      { $set: profile, $setOnInsert: { user: user._id } },
      { upsert: true }
    );
  }

  const updated = await User.findById(req.params.id).populate('profile');
  res.json(updated);
});

module.exports = router;
