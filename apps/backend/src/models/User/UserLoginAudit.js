// apps/backend/src/models/User/UserLoginAudit.js
const { Schema, model, models, Types } = require('mongoose');

const UserLoginAuditSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', index: true },
    auth0_id: { type: String, index: true },
    email: { type: String },
    org_id: { type: String, index: true },
    org_name: { type: String },
    permissions: { type: [String], default: [] },

    at: { type: Date, default: Date.now, index: true },
    ip: { type: String },
    ua: { type: String },

    tokenJti: { type: String },
    tokenIat: { type: Number },
    event: { type: String, default: 'login' },
  },
  { timestamps: true, versionKey: false, collection: 'user_login_audit' }
);

const UserLoginAudit = models.UserLoginAudit || model('UserLoginAudit', UserLoginAuditSchema);
module.exports = UserLoginAudit;
