// backend/src/schemas/topics.schemas.js
const z = require('zod');

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId');

exports.createTopic = z.object({
  body: z.object({
    title: z.string().min(1, 'title required'),
    key: z.string().trim().max(16).optional(),
  }),
});

exports.createColumn = z.object({
  body: z.object({
    title: z.string().min(1, 'title required'),
  }),
});

exports.createCard = z.object({
  body: z.object({
    columnId: objectId,
    title: z.string().min(1),
    description: z.string().optional(),
    labels: z.array(z.union([
      z.string(), // id
      z.object({ id: z.string(), name: z.string(), color: z.string() }) // objeto
    ])).optional(),
    members: z.array(z.string()).optional(),
    dueDate: z.string().or(z.date()).optional(),
    completed: z.boolean().optional(),
  })
});

exports.updateCard = z.object({
  body: z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    labels: z.array(z.union([
      z.string(),
      z.object({ id: z.string(), name: z.string(), color: z.string() })
    ])).optional(),
    members: z.array(z.string()).optional(),
    dueDate: z.string().or(z.date()).nullable().optional(),
    checklist: z.any().optional(),
    attachments: z.any().optional(),
    comments: z.any().optional(),
    completed: z.boolean().optional(), // ✅ permitir toggle
  })
});

exports.createTopicLabel = z.object({
  body: z.object({
    name: z.string().min(1),
    color: z.string().min(1),
  })
});
