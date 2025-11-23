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
    
    // Additional user information
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    phone: { type: String, trim: true },
    mobile: { type: String, trim: true },
    position: { type: String, trim: true }, // Job title/position
    department: { type: String, trim: true },
    location: { type: String, trim: true },
    timezone: { type: String, default: 'Australia/Sydney' },
    language: { type: String, default: 'en' },
    bio: { type: String, maxlength: 500 },
    
    // Contact & Social
    website: { type: String, trim: true },
    linkedin: { type: String, trim: true },
    
    // Preferences
    emailNotifications: { type: Boolean, default: true },
    smsNotifications: { type: Boolean, default: false },
    
    // Tracking
    lastAccessAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: null },
    lastLoginUa: { type: String, default: null },
    lastTokenJti: { type: String, default: null },
    lastTokenIat: { type: Number, default: null },
    loginCount: { type: Number, default: 0 },
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

UserSchema.statics.upsertFromClaims = async function upsertFromClaims(p, ns = 'https://letsmarter.com/') {
  if (!p || !p.sub) throw new Error('upsertFromClaims: missing sub in payload');

  const roles = [...new Set([...(p[ns + 'roles'] || []), ...(p.roles || [])])];
  const permissions = [...new Set([...(p[ns + 'permissions'] || []), ...(p.permissions || [])])];

  // Check if user exists and has a custom avatar (S3 key in avatars/ folder)
  const existingUser = await this.findOne({ auth0_id: p.sub }, { picture: 1 }).lean();
  const hasCustomAvatar = existingUser?.picture && existingUser.picture.startsWith('avatars/');

  const up = {
    email: p.email || null,
    emailVerified: Boolean(p.email_verified),
    name: p.name || p.nickname || p.email || null,
    // Only update picture from Auth0 if user doesn't have a custom avatar
    ...(hasCustomAvatar ? {} : { picture: p.picture || null }),

    org_id: p[ns + 'org_id'] ?? p.org_id ?? null,
    orgs:   (p[ns + 'orgs'] && p[ns + 'orgs'].length)
              ? p[ns + 'orgs']
              : (p.org_id ? [p.org_id] : []),

    // 👇 ahora sí se guardan aunque uno de los dos venga vacío
    roles,
    permissions,

    status: p['https://auth0.com/blocked'] ? 'blocked' : 'active',
    lastLoginAt: new Date(),
  };

  return this.findOneAndUpdate(
    { auth0_id: p.sub },
    { $set: up, $setOnInsert: { auth0_id: p.sub } },
    { upsert: true, new: true }
  ).lean(false);
};


UserSchema.statics.upsertFromActionUser = async function (u) {
  if (!u || !u.user_id) throw new Error('upsertFromActionUser: missing user_id');
  
  // Check if user exists and has a custom avatar
  const existingUser = await this.findOne({ auth0_id: u.user_id }, { picture: 1 }).lean();
  const hasCustomAvatar = existingUser?.picture && existingUser.picture.startsWith('avatars/');
  
  const up = {
    email: u.email || null,
    emailVerified: Boolean(u.email_verified),
    name: u.name || u.email || null,
    // Only update picture from Auth0 if user doesn't have a custom avatar
    ...(hasCustomAvatar ? {} : { picture: u.picture || null }),
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
