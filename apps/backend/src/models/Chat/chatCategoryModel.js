const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * ChatCategory
 * - org_id: STRING (viene del JWT, p.ej. "org_Abc123...")
 */
const ChatCategorySchema = new Schema(
  {
    org_id:  { type: String, required: true, index: true }, // <- string, no ObjectId
    key:     { type: String, required: true },              // slug único por org
    name:    { type: String, required: true },
    color:   { type: String },
    icon:    { type: String },
    isActive:{ type: Boolean, default: true },
  },
  { timestamps: true, collection: "chat_categories" }
);

// Unicidad por organización+key
ChatCategorySchema.index({ org_id: 1, key: 1 }, { unique: true });

module.exports =
  mongoose.models.ChatCategory ||
  mongoose.model("ChatCategory", ChatCategorySchema);
