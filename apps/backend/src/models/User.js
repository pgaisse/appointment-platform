const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
