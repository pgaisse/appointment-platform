// src/models/ProviderSchedule.js
const mongoose = require('mongoose');

const DayBlockSchema = new mongoose.Schema({
  start: { type: String, required: true }, // "HH:mm" local time
  end:   { type: String, required: true }, // "HH:mm" local time
  location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null },
  chair:    { type: mongoose.Schema.Types.ObjectId, ref: 'Chair', default: null },
}, { _id: false });

const WeeklySchema = new mongoose.Schema({
  mon: { type: [DayBlockSchema], default: [] },
  tue: { type: [DayBlockSchema], default: [] },
  wed: { type: [DayBlockSchema], default: [] },
  thu: { type: [DayBlockSchema], default: [] },
  fri: { type: [DayBlockSchema], default: [] },
  sat: { type: [DayBlockSchema], default: [] },
  sun: { type: [DayBlockSchema], default: [] },
}, { _id: false });

const ProviderScheduleSchema = new mongoose.Schema({
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true, index: true },
  timezone: { type: String, default: 'Australia/Sydney' },
  weekly:   { type: WeeklySchema, required: true },
  breaks:   { type: WeeklySchema, default: () => ({}) },
  effectiveFrom: { type: Date, default: null },
  effectiveTo:   { type: Date, default: null },
  version: { type: Number, default: 1 },
}, { timestamps: true });

ProviderScheduleSchema.index({ provider: 1, effectiveFrom: 1, effectiveTo: 1 });

module.exports = mongoose.model('ProviderSchedule', ProviderScheduleSchema);
