// src/schemas/messages.js o src/validation/messages.js
const { z } = require("zod");

const SendMessageSchema = z.object({
  to: z.string().regex(/^\+61\d{9}$/, "Invalid E.164 Australian number"),
  body: z.string().min(1, "Message body is required"),
  appId: z.string().min(1, "appId body is required"),
});

module.exports = {
  SendMessageSchema,
};
