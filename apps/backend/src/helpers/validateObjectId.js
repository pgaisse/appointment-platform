// src/helpers/validateObjectId.js
const mongoose = require('mongoose');
const { badRequest } = require('./httpErrors');

function validateObjectId(raw, name = 'id', { asObjectId = false } = {}) {
  const s = String(raw ?? '').trim();

  // strict 24-hex check avoids weird coercions
  if (!/^[0-9a-fA-F]{24}$/.test(s) || !mongoose.Types.ObjectId.isValid(s)) {
    throw badRequest(`Invalid ${name}`);
  }

  return asObjectId ? new mongoose.Types.ObjectId(s.toLowerCase()) : s.toLowerCase();
}

module.exports = { validateObjectId };
