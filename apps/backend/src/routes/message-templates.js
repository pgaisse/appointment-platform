// apps/backend/src/routes/message-templates.js
// Secure endpoint to create Message Templates (Auth0 + RBAC + validation + sanitization)

const express = require("express");
const router = express.Router();

const mongoose = require('mongoose');
const { z } = require("zod");
const rateLimit = require("express-rate-limit");

// Auth / RBAC
const { jwtCheck, attachUserInfo, ensureUser } = require("../middleware/auth");
const { requireAnyPermissionExplain } = require("../middleware/rbac-explain");

// Model (supports consolidated export or standalone model)

const { MessageTemplate } = require('../models/Appointments');


// DOMPurify in Node (no globals)
const { JSDOM } = require("jsdom");
const createDOMPurify = require("dompurify");
const { window } = new JSDOM("", { url: "http://localhost" });
const DOMPurify = createDOMPurify(window);

// ────────────────────────────────────────────────────────────
// Router-level middlewares
// ────────────────────────────────────────────────────────────

// Auth pipeline once (do not duplicate jwtCheck in handlers)
router.use(jwtCheck, attachUserInfo, ensureUser);

// ────────────────────────────────────────────────────────────
const sanitize = (s) =>
    DOMPurify.sanitize(String(s ?? ""), {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
    }).trim();

const bodySchema = z.object({
    title: z.string().min(1).max(160),
    content: z.string().min(1).max(5000),
    category: z.enum(["message", "confirmation"]).optional().default("message"),
    variablesUsed: z.array(z.string().min(1)).optional().default([]),
});

const ok = (res, status, payload) => res.status(status).json({ ok: true, ...payload });
const fail = (res, status, message, extra) =>
    res.status(status).json({ ok: false, message, ...(extra || {}) });

// ────────────────────────────────────────────────────────────
// POST /api/message-templates
// Permissions: 'message_templates:create' or 'admin:*' or 'dev-admin'
// ────────────────────────────────────────────────────────────

// Intenta obtener el modelo ya registrado; si no, haz require directo.


router.get('/', requireAnyPermissionExplain("message_templates:read", "admin:*", "dev-admin"), async (req, res) => {
    try {
        const {
            q = '',
            category,
            org_id,
            limit = 20,
            cursor,
            fields,
        } = req.query;

        const lim = Math.min(parseInt(limit, 10) || 20, 100);

        const find = {};
        if (category) find.category = category;
        if (org_id) find.org_id = org_id;

        if (q && String(q).trim() !== '') {
            const re = new RegExp(String(q).trim(), 'i');
            find.$or = [{ title: re }, { content: re }];
        }

        // Paginación por cursor (_id descendente)
        if (cursor) {
            find._id = { $lt: new mongoose.Types.ObjectId(cursor) };
        }

        let projection = undefined;
        if (fields && typeof fields === 'string') {
            projection = {};
            String(fields)
                .split(',')
                .map(s => s.trim())
                .filter(Boolean)
                .forEach(f => (projection[f] = 1));
        }

        const items = await MessageTemplate
            .find(find, projection)
            .sort({ _id: -1 })
            .limit(lim + 1); // pedir 1 extra para saber si hay más

        const hasMore = items.length > lim;
        const sliced = hasMore ? items.slice(0, lim) : items;

        const nextCursor = hasMore ? String(sliced[sliced.length - 1]._id) : null;

        res.json({
            items: sliced,
            nextCursor,
            hasMore,
        });
    } catch (err) {
        console.error('[GET /message-templates] error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.post(
    "/",
    requireAnyPermissionExplain("message_templates:create", "admin:*", "dev-admin"),
    async (req, res) => {
        try {
            const parsed = bodySchema.parse(req.body);

            const clean = {
                ...parsed,
                title: sanitize(parsed.title),
                content: sanitize(parsed.content),
                variablesUsed: Array.from(new Set(parsed.variablesUsed || [])).map(sanitize),
            };

            // attachUserInfo sets: req.user = { id, org_id, ... }
            const orgId = req.user?.org_id || null;
            const userId = req.user?.id || null;

            if (!orgId) return fail(res, 400, "Missing org_id in token.");
            if (!userId) return fail(res, 400, "Missing user id (sub).");


            console.log("[MT schema paths]", Object.keys(MessageTemplate.schema.paths));
            console.log("[incoming.body.category]", req.body?.category);
            console.log("[clean.category]", clean.category);

            const doc = await MessageTemplate.create({
                ...clean,
                org_id: orgId,
                createdBy: userId,
            });

            return ok(res, 201, {
                message: "Message template created.",
                document: doc,
            });
        } catch (err) {
            if (err?.name === "ZodError") {
                return fail(res, 422, "Validation failed.", { issues: err.issues });
            }
            if (err?.code === 11000) {
                return fail(
                    res,
                    409,
                    "A template with this title already exists for this organization."
                );
            }
            console.error("[POST /api/message-templates] Unexpected error:", err);
            return fail(res, 500, "Internal server error.");
        }
    }
);

module.exports = router;
