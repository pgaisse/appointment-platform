const { z } = require('zod');

const background = z.object({
  type: z.enum(['color', 'image']),
  color: z.string().optional(),
  imageUrl: z.string().url().optional(),
}).superRefine((val, ctx) => {
  if (val.type === 'color' && !val.color) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'color is required for color background' });
  if (val.type === 'image' && !val.imageUrl) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'imageUrl is required for image background' });
});

exports.updateUserPreferences = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  colorblindMode: z.boolean().optional(),
});

exports.updateTopicAppearance = z.object({
  background: background.optional(),
  overlay: z.object({
    blur: z.number().min(0).max(20).optional(),
    brightness: z.number().min(0.5).max(1.5).optional(),
  }).optional()
});

exports.updateCardCover = z.object({
  cover: z.object({
    type: z.enum(['none', 'color', 'image']),
    color: z.string().optional(),
    imageUrl: z.string().url().optional(),
    size: z.enum(['half', 'full']).default('half'),
  })
    .superRefine((val, ctx) => {
      if (val.type === 'color' && !val.color) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'color required for color cover' });
      if (val.type === 'image' && !val.imageUrl) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'imageUrl required for image cover' });
    })
});
