const mongoose = require('mongoose');
const { Schema } = mongoose;

const UserPreferencesSchema = new Schema({
  userId: { type: String, index: true, unique: true, required: true }, // Auth0 sub
  theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
  colorblindMode: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('UserPreferences', UserPreferencesSchema);
