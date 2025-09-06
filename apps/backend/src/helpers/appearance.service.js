const mongoose = require('mongoose');
const Topic = require('../models/Organizer/Topic');
const Card = require('../models/Organizer/Card');
const UserPreferences = require('../models/Organizer/UserPreferences');

exports.getUserPreferences = async (userId) => {
    let doc = await UserPreferences.findOne({ userId }).lean();
    if (!doc) {
        doc = await UserPreferences.create({ userId }); // defaults
        doc = doc.toObject();
    }
    return { theme: doc.theme, colorblindMode: !!doc.colorblindMode };
};

exports.updateUserPreferences = async (userId, patch) => {
    const doc = await UserPreferences.findOneAndUpdate(
        { userId },
        { $set: patch },
        { upsert: true, new: true }
    ).lean();
    return { theme: doc.theme, colorblindMode: !!doc.colorblindMode };
};

exports.getTopicAppearance = async (topicId) => {
  const t = await Topic.findById(topicId, { appearance: 1 }).lean();
  if (!t) { const e = new Error('Topic not found'); e.status = 404; throw e; }
  // Normaliza defaults para evitar undefined en el front
  const ap = t.appearance || {};
  return {
    background: ap.background || { type: 'color', color: '#1A202C' }, // gris por defecto
    overlay: {
      blur: typeof ap.overlay?.blur === 'number' ? ap.overlay.blur : 0,
      brightness: typeof ap.overlay?.brightness === 'number' ? ap.overlay.brightness : 1
    }
  };
};


exports.updateTopicAppearance = async (topicId, patch = {}) => {
  const exists = await Topic.exists({ _id: topicId });
  if (!exists) { const e = new Error('Topic not found'); e.status = 404; throw e; }

  const set = {};

  if (patch.background) {
    const { type, color, imageUrl } = patch.background;
    if (type === 'color') {
      if (!color) { const e = new Error('color is required for color background'); e.status = 400; throw e; }
      set['appearance.background'] = { type: 'color', color };
    } else if (type === 'image') {
      if (!imageUrl) { const e = new Error('imageUrl is required for image background'); e.status = 400; throw e; }
      set['appearance.background'] = { type: 'image', imageUrl };
    } else {
      const e = new Error('Invalid background.type'); e.status = 400; throw e;
    }
  }

  if (patch.overlay) {
    if (typeof patch.overlay.blur === 'number') {
      set['appearance.overlay.blur'] = patch.overlay.blur; // 👈 path puntual
    }
    if (typeof patch.overlay.brightness === 'number') {
      set['appearance.overlay.brightness'] = patch.overlay.brightness; // 👈 path puntual
    }
  }

  if (Object.keys(set).length === 0) {
    return await this.getTopicAppearance(topicId);
  }

  await Topic.findByIdAndUpdate(
    topicId,
    { $set: set },
    { new: false, runValidators: true }
  );

  // Devuelve el estado normalizado después del update
  return await this.getTopicAppearance(topicId);
};


exports.updateCardCover = async (cardId, patch) => {
    if (!mongoose.isValidObjectId(cardId)) { const e = new Error('Invalid cardId'); e.status = 400; throw e; }
    const updated = await Card.findByIdAndUpdate(
        cardId,
        { $set: { cover: patch.cover } },
        { new: true, runValidators: true }
    ).lean();
    if (!updated) { const e = new Error('Card not found'); e.status = 404; throw e; }
    return {
        id: String(updated._id),
        title: updated.title,
        cover: updated.cover || { type: 'none', size: 'half' },
    };
};
