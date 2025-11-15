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

// NOTE: Multi-provider support added: `providers` array supplements legacy singular `provider`.
// Backward compatibility: existing documents keep `provider`; new ones can use either or both.
// Do NOT remove `provider` to avoid migration complexity; prefer filling `providers` moving forward.
const ProviderScheduleSchema = new mongoose.Schema({
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true, index: true }, // legacy single provider
  providers: { type: [ { type: mongoose.Schema.Types.ObjectId, ref: 'Provider' } ], default: [], index: true }, // new multi-provider list
  timezone: { type: String, default: 'Australia/Sydney' },
  weekly:   { type: WeeklySchema, required: true },
  breaks:   { type: WeeklySchema, default: () => ({}) },
  effectiveFrom: { type: Date, default: null },
  effectiveTo:   { type: Date, default: null },
  version: { type: Number, default: 1 },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

ProviderScheduleSchema.index({ provider: 1, effectiveFrom: 1, effectiveTo: 1 });
ProviderScheduleSchema.index({ providers: 1, effectiveFrom: 1, effectiveTo: 1 });

// Virtual: unifiedProviders returns the merged unique set of providers (multi + legacy)
ProviderScheduleSchema.virtual('unifiedProviders').get(function() {
  const set = new Set();
  if (this.provider) set.add(String(this.provider));
  if (Array.isArray(this.providers)) this.providers.forEach(p => p && set.add(String(p)));
  return Array.from(set);
});

// Pre-validate: ensure singular provider is present if only providers[] was supplied
ProviderScheduleSchema.pre('validate', function(next) {
  if (!this.provider && Array.isArray(this.providers) && this.providers.length > 0) {
    this.provider = this.providers[0];
  }
  next();
});

// Pre-save: normalize providers array and keep it in sync with legacy field.
ProviderScheduleSchema.pre('save', function(next) {
  // If providers array empty, seed with legacy provider for consistency in new queries.
  if (this.provider && (!this.providers || this.providers.length === 0)) {
    this.providers = [ this.provider ];
  }
  // Deduplicate providers array.
  if (Array.isArray(this.providers) && this.providers.length > 1) {
    const unique = [];
    const seen = new Set();
    for (const p of this.providers) {
      const id = String(p);
      if (!seen.has(id)) { seen.add(id); unique.push(p); }
    }
    this.providers = unique;
  }
  next();
});

module.exports = mongoose.model('ProviderSchedule', ProviderScheduleSchema);
