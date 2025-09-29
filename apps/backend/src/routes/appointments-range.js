// routes/appointments.range.js
const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

const { jwtCheck, ensureUser, attachUserInfo } = require('../middleware/auth');
const { Appointment } = require('../models/Appointments');

// GET /api/appointments/range?start=YYYY-MM-DD&end=YYYY-MM-DD&tz=Australia/Sydney&populate=priority,treatment&limit=300
router.get('/appointments-range', jwtCheck, ensureUser, attachUserInfo, async (req, res) => {
  try {
    const tz = (req.query.tz || 'Australia/Sydney').trim();
    const startYMD = (req.query.start || '').trim();
    const endYMD   = (req.query.end || '').trim();
    const populate = String(req.query.populate || '').split(',').map(s => s.trim()).filter(Boolean);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '300', 10), 1), 1000);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startYMD) || !/^\d{4}-\d{2}-\d{2}$/.test(endYMD)) {
      return res.status(400).json({ error: "Invalid 'start' or 'end'. Expected YYYY-MM-DD." });
    }

    const startUtc = dayjs.tz(`${startYMD} 00:00:00`, tz).toDate();
    const endUtc   = dayjs.tz(`${endYMD} 00:00:00`,   tz).toDate();
    if (!(startUtc < endUtc)) return res.status(400).json({ error: "'end' must be after 'start'." });

    const maxRangeDays = 90;
    if (dayjs(endUtc).diff(dayjs(startUtc), 'day') > maxRangeDays) {
      return res.status(400).json({ error: `Range too large. Max ${maxRangeDays} days.` });
    }

    const org_id = req.dbUser?.org_id;
    if (!org_id) return res.status(403).json({ error: "Missing organization scope." });

    // ✅ SOLO selectedAppDates que se solapen con [start,end)
    const pipeline = [
      { $match: {
          org_id,
          selectedAppDates: {
            $elemMatch: { startDate: { $lt: endUtc }, endDate: { $gt: startUtc } }
          }
        }
      },

      // recorta selectedAppDates al rango solicitado
      {
        $addFields: {
          selectedAppDates: {
            $filter: {
              input: "$selectedAppDates",
              as: "s",
              cond: { $and: [
                { $lt: ["$$s.startDate", endUtc] },
                { $gt: ["$$s.endDate", startUtc] }
              ]}
            }
          }
        }
      },

      // descarta docs sin slots tras el recorte (garantiza que el front vea SOLO lo necesario)
      { $match: { $expr: { $gt: [ { $size: "$selectedAppDates" }, 0 ] } } },

      // ordenar por primer inicio
      {
        $addFields: {
          _minStart: {
            $min: {
              $map: { input: "$selectedAppDates", as: "s", in: "$$s.startDate" }
            }
          }
        }
      },
      { $sort: { _minStart: 1, _id: 1 } },
      { $limit: limit },

      // proyección mínima
      {
        $project: {
          _id: 1,
          org_id: 1,
          nameInput: 1,
          lastNameInput: 1,
          color: 1,
          note: 1,
          selectedAppDates: {
            _id: 1,
            startDate: 1,
            endDate: 1,
            status: 1,
            rescheduleRequested: 1,
            confirmation: 1,
            proposed: 1
          },
          priority: 1,
          treatment: 1
        }
      }
    ];

    let docs = await Appointment.aggregate(pipeline).allowDiskUse(true);

    // populate opcional
    const popSpec = [];
    if (populate.includes('priority')) {
      popSpec.push({ path: 'priority', select: 'id description notes durationHours name color' });
    }
    if (populate.includes('treatment')) {
      popSpec.push({ path: 'treatment', select: '_id name notes duration icon color minIcon' });
    }
    if (popSpec.length) {
      docs = await Appointment.populate(docs, popSpec);
    }

    res.set('Cache-Control', 'private, max-age=15');
    return res.status(200).json(docs);
  } catch (err) {
    console.error('[GET /api/appointments/range] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/appointments-month-days', jwtCheck, ensureUser, attachUserInfo, async (req, res) => {
  try {
    const tz = (req.query.tz || 'Australia/Sydney').trim();
    const month = (req.query.month || '').trim(); // YYYY-MM

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: "Invalid 'month'. Expected YYYY-MM." });
    }

    const org_id = req.dbUser?.org_id;
    if (!org_id) return res.status(403).json({ error: "Missing organization scope." });

    const monthStart = dayjs.tz(`${month}-01 00:00:00`, tz);
    const nextMonthStart = monthStart.add(1, 'month');

    const pipeline = [
      { $match: {
          org_id,
          selectedAppDates: { $elemMatch: { startDate: { $gte: monthStart.toDate(), $lt: nextMonthStart.toDate() } } }
        }
      },
      { $unwind: "$selectedAppDates" },
      { $match: {
          "selectedAppDates.startDate": { $gte: monthStart.toDate(), $lt: nextMonthStart.toDate() }
        }
      },
      {
        // Día truncado en TZ Sydney
        $project: {
          day: {
            $dateToString: { format: "%Y-%m-%d", date: {
              $dateTrunc: { date: "$selectedAppDates.startDate", unit: "day", timezone: tz }
            }, timezone: tz }
          }
        }
      },
      { $group: { _id: "$day" } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, day: "$_id" } }
    ];

    const docs = await Appointment.aggregate(pipeline).allowDiskUse(true);
    res.set('Cache-Control', 'private, max-age=30');
    return res.status(200).json({ month, days: docs.map(d => d.day) });
  } catch (err) {
    console.error('[GET /api/appointments/month-days] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});
module.exports = router;
