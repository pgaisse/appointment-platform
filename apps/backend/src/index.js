// apps/backend/index.js
require('dotenv').config();

// Desactivar todos los console en producción
if (process.env.NODE_ENV === 'production') {
  console.log = () => { };
  console.debug = () => { };
  console.info = () => { };
  console.warn = () => { };
  console.error = () => { };
}

const express = require('express');
const compression = require('compression');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');



const { connectDB, initIndexes} = require('./config/db');
const setupSocket = require('./config/setupSocket');

const app = express();
const port = process.env.PORT || 3003;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PUBLIC GOOGLE REVIEWS ENDPOINTS - BEFORE ALL MIDDLEWARES
// These endpoints must be FIRST for maximum speed (no CORS, no body parsing)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const GoogleReviewRequest = require('./models/GoogleReviewRequest');
const GoogleReviewSettings = require('./models/GoogleReviewSettings');
const Organization = require('./models/Enviroment/Org');

/**
 * GET /api/google-reviews/click/:requestId
 * Click tracking redirect - NO AUTH REQUIRED (patient clicks from SMS)
 */
app.get('/api/google-reviews/click/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const reviewRequest = await GoogleReviewRequest.findById(requestId);

    if (!reviewRequest) {
      return res.status(404).send('Review link not found');
    }

    // Update click tracking
    if (reviewRequest.status === 'sent' || reviewRequest.status === 'delivered' || reviewRequest.status === 'pending') {
      reviewRequest.status = 'clicked';
      reviewRequest.clickedAt = new Date();
      await reviewRequest.save();
    }

    // Redirect to frontend review page
    const frontendUrl = process.env.FRONTEND_URL || 'https://dev.letsmarter.com:8443';
    const reviewPageUrl = `${frontendUrl}/review/${requestId}`;


    return res.redirect(reviewPageUrl);
  } catch (error) {
    console.error('❌ Click tracking error:', error);
    return res.status(500).send('An error occurred');
  }
});

/**
 * GET /api/google-reviews/review-page/:requestId
 * Get review page data - NO AUTH REQUIRED (public page)
 */
app.get('/api/google-reviews/review-page/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const reviewRequest = await GoogleReviewRequest.findById(requestId);

    if (!reviewRequest) {
      return res.status(404).json({ error: 'Review request not found' });
    }

    // Parallelize queries for faster response
    const [settings, org] = await Promise.all([
      GoogleReviewSettings.findOne({ org_id: reviewRequest.org_id }),
      Organization.findOne({ org_id: reviewRequest.org_id })
    ]);

    if (!settings || !settings.reviewUrl) {
      return res.status(500).json({ error: 'Review not configured' });
    }

    const orgName = org?.name || 'Our Clinic';
    const displayName = (settings.clinicName && settings.clinicName.trim()) ? settings.clinicName : orgName;

    return res.json({
      clinicName: displayName,
      organizationName: orgName,
      reviewUrl: settings.reviewUrl,
      patientName: reviewRequest.patient.name,
      status: reviewRequest.status,
    });
  } catch (error) {
    console.error('❌ Review page data error:', error);
    return res.status(500).json({ error: 'An error occurred' });
  }
});

/**
 * POST /api/google-reviews/track-google-click/:requestId
 * Track when user clicks "Continue with Google" - NO AUTH REQUIRED
 * Fire-and-forget endpoint for maximum speed
 */
app.post('/api/google-reviews/track-google-click/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;

    // Fire and forget - update without waiting
    GoogleReviewRequest.updateOne(
      { _id: requestId, status: { $in: ['sent', 'delivered', 'pending', 'clicked'] } },
      { 
        $set: { 
          status: 'reviewed',
          reviewedAt: new Date() 
        } 
      }
    ).exec();

    // Immediate response
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Tracking failed' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NOW apply middlewares (after public endpoints are defined)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Compression first - reduce response size
app.use(compression());

// Trust proxy
app.enable('trust proxy');

// CORS and body parser ONLY on /api routes (not on static assets)
app.use('/api', cors());
app.use('/api', bodyParser.urlencoded({ extended: false }));
app.use('/api', bodyParser.json({ limit: '10mb' }));

// Use Express's built-in query parser (faster than qs)

// healthcheck
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'dev', time: new Date().toISOString() });
});

const Routes = require('./routes/index');
const SMS = require('./routes/sms');
const Topics = require('./routes/topics.routes');
const SocketRoutes = require('./routes/socket');

// server + socket
const server = http.createServer(app);
const io = setupSocket(server);

// Socket.IO middleware - only inject where needed
const ioMiddleware = (req, _res, next) => { 
  req.io = io; 
  next(); 
};

// Unified error handler - handles all errors in one place
app.use((err, req, res, next) => {
  // RBAC/Permission errors
  if (err?.code === 'RBAC_DENY' || err?.name === 'ForbiddenError') {
    const required = err.required || [];
    res.set('X-Required-Permissions', required.join(','));
    return res.status(403).json({
      error: 'forbidden',
      code: 'insufficient_permissions',
      message: "You don't have permission to perform this action.",
      required,
      anyOf: !!err.anyOf,
      path: req.originalUrl,
      method: req.method,
    });
  }

  // JWT/Auth errors
  if (err?.name === 'UnauthorizedError') {
    res.set('WWW-Authenticate', 'Bearer realm="api", error="invalid_token"');
    return res.status(401).json({
      error: 'unauthorized',
      code: 'invalid_token',
      message: 'Invalid or missing access token.',
      inner: err.inner?.message
    });
  }

  // Generic error fallback
  console.error('Unhandled error:', err);
  return res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message
  });
});
// rutas (solo montarlas; que NO ejecuten queries top-level al importar)

// Google Reviews (public endpoints moved to top of file for speed)
app.use('/api/google-reviews', require('./routes/google-reviews'));

// Routes that need Socket.IO
app.use('/api', ioMiddleware, SMS);
app.use('/api/socket.io', ioMiddleware, SocketRoutes);

// Routes that DON'T need Socket.IO (faster)
app.use('/api', require('./routes/secure'));
app.use('/api', require('./routes/auth0-sync'));
app.use('/api', require('./routes/debug-auth'));
app.use('/api', require('./routes/priority-list'));
app.use('/api', Routes);
app.use('/api', Topics);
app.use('/api/users', require('./routes/users'));
app.use('/api/tokens', require('./routes/tokens'));
app.use('/api/appointment-manager', require('./routes/appointment-manager'));
app.use('/api/appointment-migration', require('./routes/appointment-migration'));
app.use('/api/admin/auth0', require('./routes/admin-auth0'));
app.use('/api/profile', require('./routes/profile'));
app.use("/api/message-templates", require("./routes/message-templates"));
app.use('/api', require('./routes/appointments-range'));
app.use('/api/priorities/meta', require('./routes/categories-priorities-manager'));
app.use('/api/providers', require('./routes/providers'));
app.use('/api/appointment-providers', require('./routes/appointmentProviders'));
app.use('/api/validate', require('./routes/validate'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/twilio', require('./routes/twilio'));
app.use('/api/twilio-config', require('./routes/twilio-settings'));
app.use('/api/webhook-logs', require('./routes/webhook-logs'));
app.use('/api', require('./routes/calendar'));

// Final healthcheck
app.get("/healthz", (_, res) => res.send("ok"));
// ARRANQUE: **espera** Mongo antes de escuchar
(async () => {
  await connectDB(); // 👈 evita "buffering timed out"
  await initIndexes(); // 2) asegura índices únicos
  server.listen(port, '0.0.0.0', () => {
    console.log(`HTTP server listening on :${port}`);
  });
})();
