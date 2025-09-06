// backend/src/schemas/topics.schemas.js
const z = require('zod');

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId');
//Topics
exports.createTopic = z.object({
  body: z.object({
    title: z.string().min(1, 'title required'),
    key: z.string().trim().max(16).optional(),
  }),
});
exports.createTopicLabel = z.object({
  body: z.object({
    name: z.string().min(1),
    color: z.string().min(1),
  })
});

exports.createColumn = z.object({
  body: z.object({
    title: z.string().min(1, 'title required'),
  }),
});


//Cards
exports.createCard = z.object({
  columnId: z.string().min(1, 'columnId is required'),
  title: z.string().min(1, 'title is required'),
  description: z.string().optional(),
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



//Labels
exports.createLabel = z.object({
  name:  z.string().min(1).max(60),
  color: z.enum(['green','yellow','orange','red','purple','blue','lime','sky','pink','gray','black']),
});

exports.updateLabel = z.object({
  name:  z.string().min(1).max(60).optional(),
  color: z.enum(['green','yellow','orange','red','purple','blue','lime','sky','pink','gray','black']).optional(),
});
