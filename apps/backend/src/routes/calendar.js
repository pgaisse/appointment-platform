// apps/backend/src/routes/calendar.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const helpers = require('../helpers');
const { Appointment } = require('../models/Appointments');
const { attachUserInfo, jwtCheck, ensureUser } = require('../middleware/auth');
const { requireAnyPermissionExplain } = require('../middleware/rbac-explain');

router.use(jwtCheck, attachUserInfo, ensureUser);

// GET /calendar/appointments - Obtener appointments para el calendario
router.get(
  '/calendar/appointments',
  jwtCheck,
  requireAnyPermissionExplain('calendar:read', 'dev-admin'),
  async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'Authorization header missing' });
      }

      const { org_id } = await helpers.getTokenInfo(authHeader);
      if (!org_id) {
        return res.status(403).json({ error: 'Unauthorized: org_id not found' });
      }

      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate and endDate are required' });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' });
      }

      // Buscar appointments con slots en el rango de fechas
      const appointments = await Appointment.aggregate([
        {
          $match: {
            org_id,
            // Excluir archivados y position == -1
            archived: { $ne: true },
            $expr: {
              $ne: [
                { $convert: { input: '$position', to: 'double', onError: null, onNull: null } },
                -1,
              ],
            },
            // Al menos un slot en el rango
            selectedAppDates: {
              $elemMatch: {
                startDate: { $lte: end },
                endDate: { $gte: start },
              },
            },
          },
        },

        // POPULATE patient info
        {
          $lookup: {
            from: 'appointments',
            let: { repId: '$representative.appointment' },
            pipeline: [
              { $match: { $expr: { $eq: ['$_id', '$$repId'] } } },
              {
                $project: {
                  _id: 1,
                  phoneInput: 1,
                  nameInput: 1,
                  lastNameInput: 1,
                },
              },
            ],
            as: 'repDoc',
          },
        },
        { $unwind: { path: '$repDoc', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            'representative.appointment': '$repDoc',
          },
        },

        // UNWIND slots para popular cada uno
        { $unwind: { path: '$selectedAppDates', preserveNullAndEmptyArrays: false } },

        // Filtrar slots en el rango
        {
          $match: {
            'selectedAppDates.startDate': { $lte: end },
            'selectedAppDates.endDate': { $gte: start },
          },
        },

        // POPULATE treatment
        {
          $lookup: {
            from: 'treatments',
            localField: 'selectedAppDates.treatment',
            foreignField: '_id',
            as: 'selectedAppDates.treatment',
          },
        },
        {
          $unwind: {
            path: '$selectedAppDates.treatment',
            preserveNullAndEmptyArrays: true,
          },
        },

        // POPULATE priority
        {
          $lookup: {
            from: 'PriorityList',
            localField: 'selectedAppDates.priority',
            foreignField: '_id',
            as: 'selectedAppDates.priority',
          },
        },
        {
          $unwind: {
            path: '$selectedAppDates.priority',
            preserveNullAndEmptyArrays: true,
          },
        },

        // POPULATE providers
        {
          $lookup: {
            from: 'providers',
            localField: 'selectedAppDates.providers',
            foreignField: '_id',
            as: 'selectedAppDates.providers',
          },
        },

        // GROUP back to reconstruct appointment with slots array
        {
          $group: {
            _id: '$_id',
            nameInput: { $first: '$nameInput' },
            lastNameInput: { $first: '$lastNameInput' },
            phoneInput: { $first: '$phoneInput' },
            emailInput: { $first: '$emailInput' },
            org_id: { $first: '$org_id' },
            representative: { $first: '$representative' },
            selectedAppDates: { $push: '$selectedAppDates' },
          },
        },

        // Project final structure
        {
          $project: {
            _id: 1,
            nameInput: 1,
            lastNameInput: 1,
            phoneInput: 1,
            emailInput: 1,
            org_id: 1,
            representative: 1,
            selectedAppDates: 1,
            repDoc: 0,
          },
        },
      ]);

      console.log(`✅ [GET /calendar/appointments] Found ${appointments.length} appointments with slots in range`);
      return res.status(200).json(appointments);
    } catch (err) {
      console.error('[GET /calendar/appointments] Error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PATCH /calendar/update-date - Actualizar fecha de un slot específico (manual, sin SMS)
router.patch(
  '/calendar/update-date',
  jwtCheck,
  requireAnyPermissionExplain('calendar:update', 'dev-admin'),
  async (req, res) => {
    try {
      const { org_id } = await helpers.getTokenInfo(req.headers.authorization || '');

      const { appointmentId, slotId, newStartDate, newEndDate, status } = req.body;

      if (!appointmentId || !slotId || !newStartDate || !newEndDate) {
        return res.status(400).json({
          error: 'appointmentId, slotId, newStartDate, and newEndDate are required',
        });
      }

      const filter = org_id
        ? {
            _id: new mongoose.Types.ObjectId(appointmentId),
            $or: [{ org_id: { $exists: false } }, { org_id }],
          }
        : { _id: new mongoose.Types.ObjectId(appointmentId) };

      const appointment = await Appointment.findOne(filter);

      if (!appointment) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      // Encontrar el slot específico
      const slotIndex = appointment.selectedAppDates.findIndex(
        (slot) => slot._id.toString() === slotId
      );

      if (slotIndex === -1) {
        return res.status(404).json({ error: 'Slot not found in appointment' });
      }

      const slot = appointment.selectedAppDates[slotIndex];

      // Guardar origin si no existe (captura la fecha original ANTES del primer cambio)
      if (!slot.origin || !slot.origin.startDate) {
        slot.origin = {
          startDate: slot.startDate || new Date(newStartDate),
          endDate: slot.endDate || new Date(newEndDate),
          capturedAt: new Date(),
        };
      }

      // Actualizar las fechas del slot (+ estado si viene)
      slot.startDate = new Date(newStartDate);
      slot.endDate = new Date(newEndDate);
      if (status) {
        slot.status = status;
      }

      await appointment.save();

      console.log(`✅ [PATCH /calendar/update-date] Updated slot ${slotId} for appointment ${appointmentId}`);
      return res.status(200).json({
        success: true,
        message: 'Slot date updated successfully',
        appointment,
      });
    } catch (err) {
      console.error('[PATCH /calendar/update-date] Error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /calendar/slot - Eliminar un slot específico de un appointment
router.delete(
  '/calendar/slot',
  jwtCheck,
  requireAnyPermissionExplain('calendar:update', 'dev-admin'),
  async (req, res) => {
    try {
      const { org_id } = await helpers.getTokenInfo(req.headers.authorization || '');

      // Permitir body o query params
      const appointmentId = req.body?.appointmentId || req.query?.appointmentId;
      const slotId = req.body?.slotId || req.query?.slotId;

      if (!appointmentId || !slotId) {
        return res.status(400).json({ error: 'appointmentId and slotId are required' });
      }

      const filter = org_id
        ? {
            _id: new mongoose.Types.ObjectId(appointmentId),
            $or: [{ org_id: { $exists: false } }, { org_id }],
          }
        : { _id: new mongoose.Types.ObjectId(appointmentId) };

      const appointment = await Appointment.findOne(filter);
      if (!appointment) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      const before = appointment.selectedAppDates.length;
      appointment.selectedAppDates = appointment.selectedAppDates.filter(
        (slot) => slot._id.toString() !== String(slotId)
      );
      const after = appointment.selectedAppDates.length;

      if (before === after) {
        return res.status(404).json({ error: 'Slot not found in appointment' });
      }

      await appointment.save();

      console.log(`✅ [DELETE /calendar/slot] Deleted slot ${slotId} for appointment ${appointmentId}`);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('[DELETE /calendar/slot] Error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router;
