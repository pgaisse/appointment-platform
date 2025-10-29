// apps/backend/src/routes/dashboard.js
const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

const { jwtCheck, ensureUser, attachUserInfo } = require('../middleware/auth');
const { Appointment, Message } = require('../models/Appointments');
const ConversationRead = require('../models/Chat/ConversationRead');

const TZ = 'Australia/Sydney';

// GET /api/dashboard/stats
router.get('/stats', jwtCheck, ensureUser, attachUserInfo, async (req, res) => {
  try {
    const org_id = req.dbUser?.org_id;
    if (!org_id) {
      return res.status(403).json({ error: "Missing organization scope." });
    }

    const now = dayjs().tz(TZ);
    const todayStart = now.startOf('day').toDate();
    const todayEnd = now.endOf('day').toDate();
    const weekStart = now.startOf('week').toDate();
    const weekEnd = now.endOf('week').toDate();
    const monthStart = now.startOf('month').toDate();
    const monthEnd = now.endOf('month').toDate();

    // Appointments stats - count appointments that have selectedAppDates within the range
    const appointmentsToday = await Appointment.countDocuments({
      org_id,
      'selectedAppDates.startDate': { $gte: todayStart, $lte: todayEnd }
    });

    const appointmentsThisWeek = await Appointment.countDocuments({
      org_id,
      'selectedAppDates.startDate': { $gte: weekStart, $lte: weekEnd }
    });

    const appointmentsThisMonth = await Appointment.countDocuments({
      org_id,
      'selectedAppDates.startDate': { $gte: monthStart, $lte: monthEnd }
    });

    // Count appointments with pending slots (future dates with pending status)
    const pendingAppointments = await Appointment.countDocuments({
      org_id,
      selectedAppDates: {
        $elemMatch: {
          status: { $regex: /^pending$/i },
        }
      }
    });
    console.log("pendingAppointments", pendingAppointments);

    // Count appointments with completed slots this month
    const completedAppointments = await Appointment.countDocuments({
      org_id,
      selectedAppDates: {
        $elemMatch: {
          status: { $regex: /^completed$/i },
          startDate: { $gte: monthStart, $lte: monthEnd }
        }
      }
    });

    // Count appointments with cancelled slots this month
    const cancelledAppointments = await Appointment.countDocuments({
      org_id,
      selectedAppDates: {
        $elemMatch: {
          status: { $regex: /^cancelled$/i },
          startDate: { $gte: monthStart, $lte: monthEnd }
        }
      }
    });

    // Messages stats - count messages where author equals org_id (clinic sent)
    const messagesToday = await Message.countDocuments({
      author: org_id,
      direction: 'outbound',
      createdAt: { $gte: todayStart, $lte: todayEnd }
    });

    const messagesThisWeek = await Message.countDocuments({
      author: org_id,
      direction: 'outbound',
      createdAt: { $gte: weekStart, $lte: weekEnd }
    });

    const messagesThisMonth = await Message.countDocuments({
      author: org_id,
      direction: 'outbound',
      createdAt: { $gte: monthStart, $lte: monthEnd }
    });

    const totalMessages = await Message.countDocuments({
      author: org_id,
      direction: 'outbound'
    });

    // Contacts stats - based on conversation reads and appointments
    const activeContacts = await ConversationRead.distinct('conversationId', { 
      org_id,
      lastReadAt: { $gte: weekStart }
    });

    const accessedContacts = await ConversationRead.distinct('conversationId', { 
      org_id,
      lastReadAt: { $exists: true, $ne: null }
    });

    const newContacts = await Appointment.countDocuments({
      org_id,
      createdAt: { $gte: monthStart }
    });

    // Urgent appointments - pending within next 48 hours
    const urgentDeadline = dayjs(todayStart).add(2, 'day').toDate();
    const urgentAppointments = await Appointment.countDocuments({
      org_id,
      selectedAppDates: {
        $elemMatch: {
          status: { $regex: /^pending$/i },
          startDate: { $gte: todayStart, $lte: urgentDeadline }
        }
      }
    });
   
    const stats = {
      appointments: {
        today: appointmentsToday,
        thisWeek: appointmentsThisWeek,
        thisMonth: appointmentsThisMonth,
        pending: pendingAppointments,
        completed: completedAppointments,
        cancelled: cancelledAppointments,
      },
      messages: {
        today: messagesToday,
        thisWeek: messagesThisWeek,
        thisMonth: messagesThisMonth,
        total: totalMessages,
      },
      contacts: {
        accessed: accessedContacts.length,
        active: activeContacts.length,
        new: newContacts,
      },
      pending: {
        total: pendingAppointments,
        urgent: urgentAppointments,
      },
    };

    res.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats', message: error.message });
  }
});

// GET /api/dashboard/messages/monthly - Get monthly message statistics
router.get('/messages/monthly', jwtCheck, ensureUser, attachUserInfo, async (req, res) => {
  try {
    const org_id = req.dbUser?.org_id;
    if (!org_id) {
      return res.status(403).json({ error: "Missing organization scope." });
    }

    const { months = 6 } = req.query;
    const monthsToQuery = Math.min(parseInt(months) || 6, 24); // Max 24 months

    const now = dayjs().tz(TZ);
    const startDate = now.subtract(monthsToQuery - 1, 'month').startOf('month').toDate();
    
    const monthlyStats = await Message.aggregate([
      {
        $match: {
          author: org_id,
          direction: 'outbound',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: { date: '$createdAt', timezone: TZ } },
            month: { $month: { date: '$createdAt', timezone: TZ } }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      },
      {
        $project: {
          _id: 0,
          year: '$_id.year',
          month: '$_id.month',
          count: 1
        }
      }
    ]);
    console.log("monthlyStats",monthlyStats);
    res.json({ monthly: monthlyStats });
  } catch (error) {
    console.error('Dashboard monthly messages error:', error);
    res.status(500).json({ error: 'Failed to fetch monthly message stats', message: error.message });
  }
});

// GET /api/dashboard/messages/range - Get message count for a specific date range
router.get('/messages/range', jwtCheck, ensureUser, attachUserInfo, async (req, res) => {
  try {
    const org_id = req.dbUser?.org_id;
    if (!org_id) {
      return res.status(403).json({ error: "Missing organization scope." });
    }

    const { start, end } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ error: "Both 'start' and 'end' query parameters are required (YYYY-MM-DD)" });
    }

    const startDate = dayjs.tz(start, TZ).startOf('day').toDate();
    const endDate = dayjs.tz(end, TZ).endOf('day').toDate();

    const count = await Message.countDocuments({
      author: org_id,
      direction: 'outbound',
      createdAt: { $gte: startDate, $lte: endDate }
    });

    res.json({ 
      start: start,
      end: end,
      count: count 
    });
  } catch (error) {
    console.error('Dashboard message range error:', error);
    res.status(500).json({ error: 'Failed to fetch message range stats', message: error.message });
  }
});

// GET /api/dashboard/appointments/today - Get detailed today's appointments
router.get('/appointments/today', jwtCheck, ensureUser, attachUserInfo, async (req, res) => {
  try {
    const org_id = req.dbUser?.org_id;
    if (!org_id) {
      return res.status(403).json({ error: "Missing organization scope." });
    }

    const now = dayjs().tz(TZ);
    const todayStart = now.startOf('day').toDate();
    const todayEnd = now.endOf('day').toDate();

    const appointments = await Appointment.find({
      org_id,
      'selectedAppDates.startDate': { $gte: todayStart, $lte: todayEnd }
    })
      .populate('representative', 'nameInput lastNameInput phoneInput')
      .sort({ 'selectedAppDates.startDate': 1 })
      .limit(100);

    res.json(appointments);
  } catch (error) {
    console.error('Dashboard today appointments error:', error);
    res.status(500).json({ error: 'Failed to fetch today appointments', message: error.message });
  }
});

// GET /api/dashboard/appointments/week - Get detailed this week's appointments
router.get('/appointments/week', jwtCheck, ensureUser, attachUserInfo, async (req, res) => {
  try {
    const org_id = req.dbUser?.org_id;
    if (!org_id) {
      return res.status(403).json({ error: "Missing organization scope." });
    }

    const now = dayjs().tz(TZ);
    const weekStart = now.startOf('week').toDate();
    const weekEnd = now.endOf('week').toDate();

    const appointments = await Appointment.find({
      org_id,
      'selectedAppDates.startDate': { $gte: weekStart, $lte: weekEnd }
    })
      .populate('representative', 'nameInput lastNameInput phoneInput')
      .sort({ 'selectedAppDates.startDate': 1 })
      .limit(200);

    res.json(appointments);
  } catch (error) {
    console.error('Dashboard week appointments error:', error);
    res.status(500).json({ error: 'Failed to fetch week appointments', message: error.message });
  }
});

// GET /api/dashboard/appointments/pending - Get detailed pending appointments
router.get('/appointments/pending', jwtCheck, ensureUser, attachUserInfo, async (req, res) => {
  try {
    const org_id = req.dbUser?.org_id;
    if (!org_id) {
      return res.status(403).json({ error: "Missing organization scope." });
    }

    const appointments = await Appointment.find({
      org_id,
      selectedAppDates: {
        $elemMatch: {
          status: { $regex: /^pending$/i },
        }
      }
    })
      .populate('representative', 'nameInput lastNameInput phoneInput')
      .sort({ 'selectedAppDates.startDate': 1 })
      .limit(200);

    res.json(appointments);
  } catch (error) {
    console.error('Dashboard pending appointments error:', error);
    res.status(500).json({ error: 'Failed to fetch pending appointments', message: error.message });
  }
});

// GET /api/dashboard/messages/today - Get detailed today's messages
router.get('/messages/today', jwtCheck, ensureUser, attachUserInfo, async (req, res) => {
  try {
    const org_id = req.dbUser?.org_id;
    if (!org_id) {
      return res.status(403).json({ error: "Missing organization scope." });
    }

    const now = dayjs().tz(TZ);
    const todayStart = now.startOf('day').toDate();
    const todayEnd = now.endOf('day').toDate();

    const enriched = await Message.aggregate([
      {
        $match: {
          author: org_id,
          direction: 'outbound',
          createdAt: { $gte: todayStart, $lte: todayEnd },
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 100 },
      {
        $lookup: {
          from: 'appointments',
          let: { conv: '$conversationId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$org_id', org_id] },
                    { $eq: ['$sid', '$$conv'] },
                  ],
                },
              },
            },
            { $project: { nameInput: 1, lastNameInput: 1, phoneInput: 1, phoneE164: 1 } },
            { $limit: 1 },
          ],
          as: 'appointment',
        },
      },
      { $unwind: { path: '$appointment', preserveNullAndEmptyArrays: true } },
      // If the appointment is a dependent (has representative.appointment), fetch representative record
      {
        $lookup: {
          from: 'appointments',
          let: { repId: '$appointment.representative.appointment' },
          pipeline: [
            { $match: { $expr: { $and: [ { $eq: ['$_id', '$$repId'] }, { $eq: ['$org_id', org_id] } ] } } },
            { $project: { nameInput: 1, lastNameInput: 1, phoneInput: 1, phoneE164: 1, sid: 1 } },
            { $limit: 1 },
          ],
          as: 'representative',
        },
      },
      { $unwind: { path: '$representative', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          // Prefer representative details when present; otherwise use appointment
          recipientName: {
            $let: {
              vars: {
                nameRep: {
                  $trim: { input: { $concat: [ { $ifNull: ['$representative.nameInput',''] }, ' ', { $ifNull: ['$representative.lastNameInput',''] } ] } }
                },
                nameApt: {
                  $trim: { input: { $concat: [ { $ifNull: ['$appointment.nameInput',''] }, ' ', { $ifNull: ['$appointment.lastNameInput',''] } ] } }
                }
              },
              in: { $cond: [ { $gt: [ { $strLenCP: '$$nameRep' }, 0 ] }, '$$nameRep', { $cond: [ { $gt: [ { $strLenCP: '$$nameApt' }, 0 ] }, '$$nameApt', null ] } ] }
            }
          },
          recipientPhone: {
            $ifNull: [
              '$representative.phoneInput',
              { $ifNull: [ '$representative.phoneE164', { $ifNull: [ '$appointment.phoneInput', { $ifNull: [ '$appointment.phoneE164', { $ifNull: ['$proxyAddress', '$to'] } ] } ] } ] }
            ]
          },
          time: '$createdAt',
        },
      },
    ]);

    res.json(enriched);
  } catch (error) {
    console.error('Dashboard today messages error:', error);
    res.status(500).json({ error: 'Failed to fetch today messages', message: error.message });
  }
});

// GET /api/dashboard/messages/month - Get detailed this month's messages
router.get('/messages/month', jwtCheck, ensureUser, attachUserInfo, async (req, res) => {
  try {
    const org_id = req.dbUser?.org_id;
    if (!org_id) {
      return res.status(403).json({ error: "Missing organization scope." });
    }

    const now = dayjs().tz(TZ);
    const monthStart = now.startOf('month').toDate();
    const monthEnd = now.endOf('month').toDate();

    const enriched = await Message.aggregate([
      {
        $match: {
          author: org_id,
          direction: 'outbound',
          createdAt: { $gte: monthStart, $lte: monthEnd },
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 500 },
      {
        $lookup: {
          from: 'appointments',
          let: { conv: '$conversationId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$org_id', org_id] },
                    { $eq: ['$sid', '$$conv'] },
                  ],
                },
              },
            },
            { $project: { nameInput: 1, lastNameInput: 1, phoneInput: 1, phoneE164: 1, sid: 1 } },
            { $limit: 1 },
          ],
          as: 'appointment',
        },
      },
      { $unwind: { path: '$appointment', preserveNullAndEmptyArrays: true } },
      // If the appointment is a dependent (has representative.appointment), fetch representative record
      {
        $lookup: {
          from: 'appointments',
          let: { repId: '$appointment.representative.appointment' },
          pipeline: [
            { $match: { $expr: { $and: [ { $eq: ['$_id', '$$repId'] }, { $eq: ['$org_id', org_id] } ] } } },
            { $project: { nameInput: 1, lastNameInput: 1, phoneInput: 1, phoneE164: 1, sid: 1 } },
            { $limit: 1 },
          ],
          as: 'representative',
        },
      },
      { $unwind: { path: '$representative', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          // Prefer representative details when present; otherwise use appointment
          recipientName: {
            $let: {
              vars: {
                nameRep: {
                  $trim: { input: { $concat: [ { $ifNull: ['$representative.nameInput',''] }, ' ', { $ifNull: ['$representative.lastNameInput',''] } ] } }
                },
                nameApt: {
                  $trim: { input: { $concat: [ { $ifNull: ['$appointment.nameInput',''] }, ' ', { $ifNull: ['$appointment.lastNameInput',''] } ] } }
                }
              },
              in: { $cond: [ { $gt: [ { $strLenCP: '$$nameRep' }, 0 ] }, '$$nameRep', { $cond: [ { $gt: [ { $strLenCP: '$$nameApt' }, 0 ] }, '$$nameApt', null ] } ] }
            }
          },
          recipientPhone: {
            $ifNull: [
              '$representative.phoneInput',
              { $ifNull: [ '$representative.phoneE164', { $ifNull: [ '$appointment.phoneInput', { $ifNull: [ '$appointment.phoneE164', { $ifNull: ['$proxyAddress', '$to'] } ] } ] } ] }
            ]
          },
          time: '$createdAt',
        },
      },
    ]);

    res.json(enriched);
  } catch (error) {
    console.error('Dashboard month messages error:', error);
    res.status(500).json({ error: 'Failed to fetch month messages', message: error.message });
  }
});

module.exports = router;
