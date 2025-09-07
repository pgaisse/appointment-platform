// apps/backend/src/models/User/User.js
const { Schema, model, models } = require('mongoose');

const UserSchema = new Schema(
  {
    auth0_id: { type: String, required: true, unique: true },
    email: { type: String, trim: true, lowercase: true }, // sin índice único
    emailVerified: { type: Boolean, default: false },
    name: { type: String, trim: true },
    picture: { type: String },
    org_id: { type: String, default: null },
    orgs: { type: [String], default: [] },
    roles: { type: [String], default: [] },
    permissions: { type: [String], default: [] },
    status: { type: String, enum: ['active', 'blocked'], default: 'active' },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) { ret.id = ret._id; delete ret._id; return ret; },
    },
    toObject: { virtuals: true },
  }
);

UserSchema.virtual('profile', {
  ref: 'UserProfile',
  localField: '_id',
  foreignField: 'user',
  justOne: true,
});

// --- Helper ---
async function robustUpsert(model, filter, update) {
  try {
    return await model.findOneAndUpdate(filter, update, { upsert: true, new: true }).lean(false);
  } catch (e) {
    // manejar carrera con índice único de auth0_id
    if (e && String(e.code) === '11000') {
      return await model.findOne(filter).lean(false);
    }
    throw e;
  }
}

UserSchema.statics.upsertFromClaims = async function (p, ns = 'https://letsmarter.com/') {
  if (!p || !p.sub) throw new Error('upsertFromClaims: missing sub in payload');
  const up = {
    email: p.email || null,
    emailVerified: Boolean(p.email_verified),
    name: p.name || p.nickname || p.email || null,
    picture: p.picture || null,
    org_id: p[ns + 'org_id'] ?? p.org_id ?? null,
    orgs: p[ns + 'orgs'] ?? (p.org_id ? [p.org_id] : []) ?? [],
    roles: p[ns + 'roles'] ?? p.roles ?? [],
    permissions: p[ns + 'permissions'] ?? p.permissions ?? [],
    status: p['https://auth0.com/blocked'] ? 'blocked' : 'active',
    lastLoginAt: new Date(),
  };
  return robustUpsert(this, { auth0_id: p.sub }, { $set: up, $setOnInsert: { auth0_id: p.sub } });
};

UserSchema.statics.upsertFromActionUser = async function (u) {
  if (!u || !u.user_id) throw new Error('upsertFromActionUser: missing user_id');
  const up = {
    email: u.email || null,
    emailVerified: Boolean(u.email_verified),
    name: u.name || u.email || null,
    picture: u.picture || null,
    org_id: u.app_metadata?.org_id ?? null,
    orgs: u.app_metadata?.orgs ?? (u.app_metadata?.org_id ? [u.app_metadata.org_id] : []) ?? [],
    roles: u.app_metadata?.roles ?? [],
    permissions: u.app_metadata?.permissions ?? [],
    status: u.blocked ? 'blocked' : 'active',
    lastLoginAt: new Date(),
  };
  return robustUpsert(this, { auth0_id: u.user_id }, { $set: up, $setOnInsert: { auth0_id: u.user_id } });
};

const User = models.User || model('User', UserSchema);
module.exports = User;
