const express = require('express');
const router = express.Router();
const WebhookLog = require('../models/WebhookLog');
const { jwtCheck, attachUserInfo, ensureUser } = require('../middleware/auth');
const helpers = require('../helpers');

// Apply auth middleware to all routes
router.use(jwtCheck, attachUserInfo, ensureUser);

// GET /api/webhook-logs - Get paginated webhook logs for organization
router.get('/', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    const { org_id } = await helpers.getTokenInfo(authHeader);
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Filters
    const filters = { org_id };
    
    if (req.query.eventType) {
      filters.eventType = req.query.eventType;
    }
    
    if (req.query.status) {
      filters.status = req.query.status;
    }
    
    if (req.query.conversationSid) {
      filters.conversationSid = req.query.conversationSid;
    }

    if (req.query.search) {
      const searchRegex = new RegExp(helpers.sanitizeInput(req.query.search), 'i');
      filters.$or = [
        { author: searchRegex },
        { body: searchRegex },
        { conversationSid: searchRegex },
        { messageSid: searchRegex }
      ];
    }

    // Date range
    if (req.query.startDate || req.query.endDate) {
      filters.createdAt = {};
      if (req.query.startDate) {
        filters.createdAt.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filters.createdAt.$lte = new Date(req.query.endDate);
      }
    }

    const [logs, total] = await Promise.all([
      WebhookLog.find(filters)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WebhookLog.countDocuments(filters)
    ]);

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching webhook logs:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// GET /api/webhook-logs/stats - Get webhook statistics
router.get('/stats', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    const { org_id } = await helpers.getTokenInfo(authHeader);

    // Get date range (default last 7 days)
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    const startDate = req.query.startDate 
      ? new Date(req.query.startDate)
      : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalEvents,
      eventsByType,
      eventsByStatus,
      recentErrors,
      avgProcessingTime
    ] = await Promise.all([
      // Total events
      WebhookLog.countDocuments({ 
        org_id,
        createdAt: { $gte: startDate, $lte: endDate }
      }),
      
      // Events by type
      WebhookLog.aggregate([
        { 
          $match: { 
            org_id,
            createdAt: { $gte: startDate, $lte: endDate }
          } 
        },
        { 
          $group: { 
            _id: '$eventType', 
            count: { $sum: 1 } 
          } 
        },
        { $sort: { count: -1 } }
      ]),
      
      // Events by status
      WebhookLog.aggregate([
        { 
          $match: { 
            org_id,
            createdAt: { $gte: startDate, $lte: endDate }
          } 
        },
        { 
          $group: { 
            _id: '$status', 
            count: { $sum: 1 } 
          } 
        }
      ]),
      
      // Recent errors (last 10)
      WebhookLog.find({ 
        org_id,
        status: 'error',
        createdAt: { $gte: startDate, $lte: endDate }
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('eventType error conversationSid createdAt')
        .lean(),
      
      // Average processing time
      WebhookLog.aggregate([
        { 
          $match: { 
            org_id,
            processingTimeMs: { $exists: true, $ne: null },
            createdAt: { $gte: startDate, $lte: endDate }
          } 
        },
        { 
          $group: { 
            _id: null, 
            avgTime: { $avg: '$processingTimeMs' } 
          } 
        }
      ])
    ]);

    res.json({
      totalEvents,
      eventsByType: eventsByType.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      eventsByStatus: eventsByStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      recentErrors,
      avgProcessingTimeMs: avgProcessingTime[0]?.avgTime || 0,
      dateRange: { startDate, endDate }
    });
  } catch (error) {
    console.error('Error fetching webhook stats:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// GET /api/webhook-logs/:id - Get single webhook log details
router.get('/:id', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    const { org_id } = await helpers.getTokenInfo(authHeader);
    
    const log = await WebhookLog.findOne({
      _id: req.params.id,
      org_id
    }).lean();

    if (!log) {
      return res.status(404).json({ error: 'Webhook log not found' });
    }

    res.json(log);
  } catch (error) {
    console.error('Error fetching webhook log:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// DELETE /api/webhook-logs - Delete old webhook logs
router.delete('/', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    const { org_id } = await helpers.getTokenInfo(authHeader);
    
    // Delete logs older than specified days (default 30)
    const days = parseInt(req.query.days) || 30;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await WebhookLog.deleteMany({
      org_id,
      createdAt: { $lt: cutoffDate }
    });

    res.json({
      success: true,
      deletedCount: result.deletedCount,
      cutoffDate
    });
  } catch (error) {
    console.error('Error deleting webhook logs:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

module.exports = router;
