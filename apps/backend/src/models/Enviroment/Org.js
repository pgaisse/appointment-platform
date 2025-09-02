const mongoose = require("mongoose");

const TwilioSchema = new mongoose.Schema({
  account_sid: { type: String, required: true },
  from_main: { type: String, required: true },
  auth_token: { type: String, required: true },
  conversations_service_sid: { type: String, required: true },
});

const OrganizationSchema = new mongoose.Schema(
  {
    org_id: { type: String, unique: true, required: true }, // viene de Auth0
    name: { type: String, required: true }, // opcional
    twilio: { type: TwilioSchema, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Organization", OrganizationSchema);