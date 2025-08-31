const mongoose = require("mongoose");
const ChatCategory = require("./chatCategoryModel");
const ConversationChatCategory = require("./conversationChatCategoryModel");

// Solo convierte a ObjectId si el string es válido. ¡Nunca castees org_id!
const toObjId = (x) =>
  typeof x === "string" && mongoose.Types.ObjectId.isValid(x)
    ? new mongoose.Types.ObjectId(x)
    : x;

/* ========= Categorías ========= */

async function listChatCategories({ org_id, search }) {
  const q = { org_id, isActive: true }; // org_id string
  if (search) {
    q.$or = [
      { name: { $regex: search, $options: "i" } },
      { key:  { $regex: search, $options: "i" } },
    ];
  }
  return ChatCategory.find(q).sort({ name: 1 });
}

async function createChatCategory({ org_id, data }) {
  return ChatCategory.create({
    org_id,                // <- string del JWT
    key: data.key,
    name: data.name,
    color: data.color,
    icon: data.icon,
  });
}

async function updateChatCategory({ org_id, chatCategoryId, patch }) {
  return ChatCategory.findOneAndUpdate(
    { _id: toObjId(chatCategoryId), org_id }, // org_id string
    { $set: patch },
    { new: true }
  );
}

/* === Conversación (CH...) ↔ Categoría === */

async function assignCategoryToConversation({ org_id, conversationSid, chatCategoryKey, chatCategoryId }) {
  let cat = null;
  if (chatCategoryId) {
    cat = await ChatCategory.findOne({ _id: toObjId(chatCategoryId), org_id, isActive: true });
  } else if (chatCategoryKey) {
    cat = await ChatCategory.findOne({ org_id, key: chatCategoryKey, isActive: true });
  }
  if (!cat) throw new Error("ChatCategory not found or inactive");

  return ConversationChatCategory.findOneAndUpdate(
    { org_id, conversationSid, chat_category_id: cat._id },
    { $setOnInsert: { org_id, conversationSid, chat_category_id: cat._id } },
    { upsert: true, new: true }
  );
}

async function listConversationCategories({ org_id, conversationSid }) {
  return ConversationChatCategory.aggregate([
    { $match: { org_id, conversationSid } }, // org_id string, no castear
    {
      $lookup: {
        from: "chat_categories",
        localField: "chat_category_id",
        foreignField: "_id",
        as: "cat",
      },
    },
    { $unwind: "$cat" },
    {
      $project: {
        _id: 1,
        chat_category_id: 1,
        createdAt: 1,
        chatCategory: {
          _id: "$cat._id",
          key: "$cat.key",
          name: "$cat.name",
          color: "$cat.color",
          icon: "$cat.icon",
        },
      },
    },
    { $sort: { "chatCategory.name": 1 } },
  ]);
}

async function unassignCategoryFromConversation({ org_id, conversationSid, chatCategoryId }) {
  const r = await ConversationChatCategory.deleteOne({
    org_id,                           // string
    conversationSid,
    chat_category_id: toObjId(chatCategoryId),
  });
  return r.deletedCount;
}

module.exports = {
  listChatCategories,
  createChatCategory,
  updateChatCategory,
  assignCategoryToConversation,
  listConversationCategories,
  unassignCategoryFromConversation,
};
