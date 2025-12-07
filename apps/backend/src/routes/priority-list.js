// apps/backend/src/routes/priority-list.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const helpers = require('../helpers');
const { Appointment } = require('../models/Appointments');
const { attachUserInfo, jwtCheck, checkJwt, decodeToken, ensureUser } = require('../middleware/auth');
const { requireAnyPermissionExplain } = require('../middleware/rbac-explain');
router.use(jwtCheck, attachUserInfo, ensureUser);
const OID_RE = /^[a-fA-F0-9]{24}$/;
const models = require("../models/Appointments");

/**
 * PATCH /priority-list/move
 * Move appointments between priorities
 * ⚠️ IMPORTANTE: Esta ruta debe estar ANTES de /priority-list/:id para que Express no confunda "move" con un :id
 */
router.patch('/priority-list/move', jwtCheck, requireAnyPermissionExplain('appointment_cards:move', 'dev-admin'), async (req, res) => {
  const { org_id } = await helpers.getTokenInfo(req.headers.authorization || '');

  console.log('📦 [PATCH /priority-list/move] Request body:', JSON.stringify(req.body, null, 2));

  // Acepta: array directo o { moves: [] }
  const rawMoves = Array.isArray(req.body)
    ? req.body
    : (Array.isArray(req.body?.moves) ? req.body.moves : []);
  
  console.log('📦 [PATCH /priority-list/move] Parsed rawMoves:', rawMoves);
  
  if (!rawMoves.length) {
    console.log('❌ [PATCH /priority-list/move] No moves found in body');
    return res.status(400).json({ 
      error: 'Body debe ser un array de moves o { moves: [] }',
      received: req.body,
      parsedMoves: rawMoves
    });
  }

  // ✅ NUEVO: Agrupar moves por appointmentId+slotId (cada slot es independiente)
  const appointmentMoves = new Map();
  
  for (const m of rawMoves) {
    const id = String(m?.id || '').trim();
    if (!OID_RE.test(id)) continue;

    const position = Number.isFinite(m?.position) ? Number(m.position) : undefined;
    const priority = m?.priority && OID_RE.test(String(m.priority)) ? String(m.priority) : undefined;
    const slotId = m?.slotId && OID_RE.test(String(m.slotId)) ? String(m.slotId) : undefined;

    if (position === undefined && !priority) continue;

    // ✅ Clave única: appointmentId|slotId para mantener slots independientes
    const key = slotId ? `${id}|${slotId}` : id;

    if (!appointmentMoves.has(key)) {
      appointmentMoves.set(key, { id, position, priority, slotId });
    } else {
      const existing = appointmentMoves.get(key);
      if (position !== undefined) existing.position = position;
      if (priority) existing.priority = priority;
      if (slotId) existing.slotId = slotId;
    }
  }

  const moves = [...appointmentMoves.values()];
  if (!moves.length) {
    console.error('❌ [PATCH /priority-list/move] All moves filtered out:', {
      rawMovesCount: rawMoves.length,
      invalidIds: rawMoves.filter(m => !OID_RE.test(String(m?.id || ''))).length,
      missingPositionAndPriority: rawMoves.filter(m => {
        const pos = Number.isFinite(m?.position) ? Number(m.position) : undefined;
        const pri = m?.priority && OID_RE.test(String(m.priority)) ? String(m.priority) : undefined;
        return pos === undefined && !pri;
      }).length,
      invalidSlotIds: rawMoves.filter(m => m?.slotId && !OID_RE.test(String(m.slotId))).length
    });
    
    return res.status(400).json({ 
      error: 'No hay movimientos válidos tras filtrar por validez de IDs, position y priority',
      details: {
        received: rawMoves.length,
        invalidIds: rawMoves.filter(m => !OID_RE.test(String(m?.id || ''))).map(m => m?.id),
        missingData: rawMoves.filter(m => {
          const pos = Number.isFinite(m?.position) ? Number(m.position) : undefined;
          const pri = m?.priority && OID_RE.test(String(m.priority)) ? String(m.priority) : undefined;
          return pos === undefined && !pri;
        }).map(m => ({ id: m?.id, position: m?.position, priority: m?.priority, slotId: m?.slotId }))
      }
    });
  }

  const session = await mongoose.startSession();
  const results = [];

  try {
    await session.withTransaction(async () => {
      for (const m of moves) {
        console.log('🔍 [Processing Move]', {
          id: m.id,
          position: m.position,
          priority: m.priority,
          slotId: m.slotId
        });

        const filter = org_id != null
          ? {
              _id: new mongoose.Types.ObjectId(m.id),
              $or: [{ org_id: { $exists: false } }, { org_id }],
            }
          : { _id: new mongoose.Types.ObjectId(m.id) };

        // ✅ Obtener el appointment actual
        const appointment = await Appointment.findOne(filter).session(session);

        if (!appointment) {
          console.log('❌ [Move Processing] Appointment not found:', m.id);
          results.push({
            status: 'failed',
            id: m.id,
            reason: 'Documento no encontrado o fuera de la organización',
          });
          continue;
        }

        console.log('✅ [Move Processing] Appointment found:', {
          id: m.id,
          hasSelectedAppDates: !!appointment.selectedAppDates,
          slotsCount: appointment.selectedAppDates?.length,
          slotIds: appointment.selectedAppDates?.map(s => s._id.toString())
        });

        // ⚠️ VALIDACIÓN CRÍTICA: Verificar que selectedAppDates es un array válido
        if (!appointment.selectedAppDates || !Array.isArray(appointment.selectedAppDates)) {
          console.error('❌ [Invalid Structure] Appointment has no selectedAppDates array:', {
            appointmentId: m.id,
            hasField: !!appointment.selectedAppDates,
            isArray: Array.isArray(appointment.selectedAppDates),
            type: typeof appointment.selectedAppDates
          });
          results.push({
            status: 'failed',
            id: m.id,
            reason: 'Appointment has invalid selectedAppDates structure',
          });
          continue;
        }

        // ✅ ESTRATEGIA: Si viene slotId, actualizar ESE slot específico
        // Si NO viene slotId, es un movimiento legacy (actualizar root.priority/position)
        
        if (m.slotId) {
          // NUEVO SISTEMA: Actualizar slot específico
          const slotIndex = appointment.selectedAppDates.findIndex(
            slot => slot._id.toString() === m.slotId
          );

          console.log('🔍 [Slot Search]', {
            lookingFor: m.slotId,
            foundIndex: slotIndex,
            availableSlots: appointment.selectedAppDates?.map(s => s._id.toString())
          });

          if (slotIndex === -1) {
            console.error('❌ [Slot Not Found]', {
              appointmentId: m.id,
              requestedSlotId: m.slotId,
              availableSlots: appointment.selectedAppDates?.map(s => ({
                id: s._id.toString(),
                priority: s.priority?.toString(),
                position: s.position
              }))
            });
            results.push({
              status: 'failed',
              id: m.id,
              reason: `Slot ${m.slotId} no encontrado en appointment`,
            });
            continue;
          }

          // ✅ Actualizar priority del slot si viene
          if (m.priority) {
            appointment.selectedAppDates[slotIndex].priority = new mongoose.Types.ObjectId(m.priority);
          }

          // ✅ Actualizar position del SLOT específico (no del root)
          if (m.position !== undefined) {
            appointment.selectedAppDates[slotIndex].position = m.position;
          }

          appointment.unknown = false;
          if (org_id != null) appointment.org_id = org_id;

          // ⚠️ PROTECCIÓN: Try-catch para capturar errores de validación del schema
          try {
            // ✅ CRÍTICO: Solo validar campos modificados (priority, position)
            // No validar campos requeridos no modificados como 'user'
            await appointment.save({ 
              session, 
              validateModifiedOnly: true,
              validateBeforeSave: true
            });
            
            results.push({ 
              status: 'success', 
              id: m.id,
              slotId: m.slotId,
              updatedSlot: true 
            });
          } catch (saveError) {
            console.error('❌ [Save Error] Failed to save appointment:', {
              appointmentId: m.id,
              slotId: m.slotId,
              slotIndex,
              priority: m.priority,
              position: m.position,
              errorMessage: saveError.message,
              errorName: saveError.name,
              errorStack: saveError.stack
            });
            
            results.push({
              status: 'failed',
              id: m.id,
              slotId: m.slotId,
              reason: `Save failed: ${saveError.message}`,
              errorDetails: saveError.name
            });
            // Continuar con el siguiente move en lugar de abortar toda la transacción
            continue;
          }

        } else {
          // LEGACY SYSTEM: Actualizar root.priority y root.position (deprecado)
          const set = { unknown: false };
          if (m.position !== undefined) set.position = m.position;
          if (m.priority) set.priority = new mongoose.Types.ObjectId(m.priority);
          if (org_id != null) set.org_id = org_id;

          try {
            const updated = await Appointment.findOneAndUpdate(
              filter,
              { $set: set },
              { new: true, session, runValidators: true }
            );

            if (!updated) {
              results.push({
                status: 'failed',
                id: m.id,
                reason: 'Error al actualizar documento',
              });
            } else {
              results.push({ 
                status: 'success', 
                id: m.id,
                updatedRoot: true 
              });
            }
          } catch (updateError) {
            console.error('❌ [Update Error] Failed to update appointment (legacy):', {
              appointmentId: m.id,
              priority: m.priority,
              position: m.position,
              errorMessage: updateError.message,
              errorName: updateError.name
            });
            
            results.push({
              status: 'failed',
              id: m.id,
              reason: `Update failed: ${updateError.message}`,
              errorDetails: updateError.name
            });
            continue;
          }
        }
      }
    });

    const allOK = results.every(r => r.status === 'success');
    return res.status(allOK ? 200 : 207).json({
      message: allOK ? 'All moves applied' : 'Some moves failed',
      results,
    });
  } catch (err) {
    console.error('❌ Critical error in /priority-list/move:', {
      errorMessage: err.message,
      errorName: err.name,
      errorStack: err.stack,
      movesAttempted: moves.length,
      resultsProcessed: results.length,
      lastResult: results[results.length - 1]
    });
    
    return res.status(500).json({
      error: 'Critical failure while processing priority-list moves',
      details: err.message,
      errorType: err.name,
      processedCount: results.length,
      totalCount: moves.length,
      partialResults: results
    });
  } finally {
    session.endSession();
  }
});

/**
 * PATCH /priority-list/:id
 * Update a priority's name
 * ⚠️ Esta ruta usa un parámetro :id, por eso debe estar DESPUÉS de rutas específicas como /move
 */
router.patch('/priority-list/:id', jwtCheck, requireAnyPermissionExplain('appointment_cards:move', 'dev-admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required and must be a non-empty string' });
    }

    if (!OID_RE.test(id)) {
      return res.status(400).json({ error: 'Invalid priority ID' });
    }

    const { org_id } = await helpers.getTokenInfo(req.headers.authorization || '');
    if (!org_id) {
      return res.status(400).json({ error: 'Missing org_id' });
    }

    const PriorityListModel = mongoose.model('PriorityList');
    
    const priority = await PriorityListModel.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id), org_id },
      { $set: { name: name.trim() } },
      { new: true }
    );

    if (!priority) {
      return res.status(404).json({ error: 'Priority not found or does not belong to your organization' });
    }

    console.log(`✅ [PATCH /priority-list/${id}] Priority name updated to: ${name.trim()}`);
    res.json({ success: true, priority });
  } catch (error) {
    console.error('❌ [PATCH /priority-list/:id] Error:', error);
    res.status(500).json({ error: 'Failed to update priority name', details: error.message });
  }
});

router.get(
  '/DraggableCards',
  jwtCheck,
  requireAnyPermissionExplain('appointment_cards:read', 'dev-admin'),
  async (req, res) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        return res.status(401).json({ error: 'Authorization header missing' });
      }

      const { org_id, token } = await helpers.getTokenInfo(authHeader);
      console.log("Token", token);
      if (!org_id) {
        return res.status(403).json({ error: 'Unauthorized: org_id not found' });
      }

      // ✅ SIN FILTRO DE FECHAS: Mostrar todos los appointments
      const appointments = await models.Appointment.aggregate([
        {
          $match: {
            org_id: org_id,
            // Excluir position == -1
            $expr: {
              $ne: [
                { $convert: { input: "$position", to: "double", onError: null, onNull: null } },
                -1
              ]
            },
            // ✅ MODIFICADO: Mostrar todos los slots con cualquier status
            selectedAppDates: {
              $exists: true,
              $ne: [],
            },
          },
        },

        // UNWIND slots para procesar cada uno individualmente
        { $unwind: { path: "$selectedAppDates", preserveNullAndEmptyArrays: false } },

        // POPULATE slot treatment
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

        // POPULATE slot priority
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

        // POPULATE slot providers
        {
          $lookup: {
            from: 'providers',
            localField: 'selectedAppDates.providers',
            foreignField: '_id',
            as: 'selectedAppDates.providers',
          },
        },

        // ✅ POPULATE root priority (para appointments con priority solo a nivel raíz)
        {
          $lookup: {
            from: 'PriorityList',
            localField: 'priority',
            foreignField: '_id',
            as: 'rootPriorityDoc',
          },
        },
        {
          $unwind: {
            path: '$rootPriorityDoc',
            preserveNullAndEmptyArrays: true,
          },
        },

        // POPULATE representative.appointment
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
                  phoneE164: 1,
                  emailLower: 1,
                  nameInput: 1,
                  lastNameInput: 1,
                  sid: 1,
                  proxyAddress: 1
                }
              }
            ],
            as: 'repDoc'
          }
        },
        { $unwind: { path: '$repDoc', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            'representative.appointment': '$repDoc'
          }
        },

        // POPULATE messagelogs
        {
          $lookup: {
            from: 'messagelogs',
            localField: '_id',
            foreignField: 'appointment',
            as: 'contactMessages',
          },
        },

        // POPULATE selectedDates.days.timeBlocks
        { $unwind: { path: "$selectedDates.days", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'timeblocks',
            localField: 'selectedDates.days.timeBlocks',
            foreignField: '_id',
            as: 'selectedDates.days.timeBlocks',
          },
        },

        // GROUP para reconstruir selectedDates.days pero MANTENER el slot individual
        {
          $group: {
            _id: { appointmentId: "$_id", slotId: "$selectedAppDates._id" },
            contactPreference: { $first: "$contactPreference" },
            sid: { $first: "$sid" },
            nameInput: { $first: "$nameInput" },
            emailInput: { $first: "$emailInput" },
            emailLower: { $first: "$emailLower" },
            phoneInput: { $first: "$phoneInput" },
            phoneE164: { $first: "$phoneE164" },
            lastNameInput: { $first: "$lastNameInput" },
            textAreaInput: { $first: "$textAreaInput" },
            representative: { $first: "$representative" },
            note: { $first: "$note" },
            color: { $first: "$color" },
            user_id: { $first: "$user_id" },
            org_id: { $first: "$org_id" },
            contactMessages: { $first: "$contactMessages" },
            position: { $first: "$position" },
            reschedule: { $first: "$reschedule" },
            // ✅ Guardar priority a nivel raíz como fallback (populated)
            rootPriority: { $first: "$rootPriorityDoc" },
            selectedStartDate: { $first: "$selectedDates.startDate" },
            selectedEndDate: { $first: "$selectedDates.endDate" },
            days: { $push: "$selectedDates.days" },
            // ⬇️ SOLO el slot actual con todo populated
            slot: { $first: "$selectedAppDates" },
          },
        },

        // Rebuild selectedDates y aplanar _id
        {
          $addFields: {
            _id: "$_id.appointmentId",
            selectedDates: {
              startDate: "$selectedStartDate",
              endDate: "$selectedEndDate",
              days: "$days",
            },
            // Crear array de 1 slot para compatibilidad
            selectedAppDates: ["$slot"],
            // ✅ Mantener rootPriority disponible para fallback
            priority: "$rootPriority",
          },
        },

        // Limpiar campos temporales
        {
          $project: {
            selectedStartDate: 0,
            selectedEndDate: 0,
            slot: 0,
            repDoc: 0,
            rootPriority: 0,
          },
        },
      ]);

      // ✅ PASO 1: Obtener TODAS las prioridades de la organización
      const allPriorities = await models.PriorityList.find({ org_id }).sort({ id: 1 });
      console.log("allPriorities", allPriorities);
      // ✅ PASO 2: Inicializar grouped con TODAS las prioridades (vacías inicialmente)
      const grouped = new Map();
      
      for (const priority of allPriorities) {
        grouped.set(priority._id.toString(), {
          _id: priority._id,
          priorityNum: priority.id,
          priorityId: priority._id,
          priorityName: priority.name,
          priorityColor: priority.color,
          description: priority.description,
          durationHours: priority.durationHours,
          priority: {
            org_id: priority.org_id,
            id: priority.id,
            _id: priority._id,
            description: priority.description,
            notes: priority.notes || '',
            durationHours: priority.durationHours,
            name: priority.name,
            color: priority.color,
          },
          patients: [],
        });
      }

      // ✅ PASO 3: Agregar appointments a sus respectivas prioridades
      for (const appt of appointments) {
        const slot = appt.selectedAppDates?.[0];
        
        // ✅ FALLBACK: Usar priority del slot, o si no existe, la del root appointment (ya populated)
        let priorityId;
        let priorityDoc;
        
        if (slot?.priority?._id) {
          // Priority a nivel de slot (ya populated)
          priorityId = slot.priority._id.toString();
          priorityDoc = slot.priority;
        } else if (appt.priority?._id) {
          // Priority a nivel raíz (ya populated desde rootPriorityDoc)
          priorityId = appt.priority._id.toString();
          priorityDoc = appt.priority;
          
          // ✅ CRÍTICO: Copiar la priority del root al slot para que el frontend la vea
          if (slot) {
            slot.priority = priorityDoc;
          }
        }

        // Silenciosamente ignorar slots sin priority (esperado para appointments sin categorizar)
        if (!priorityId) {
          console.log(`ℹ️ [/DraggableCards] Appointment ${appt._id} (${appt.nameInput}) ignorado: sin priority asignada`);
          continue;
        }

        // Si la priority existe en el Map, agregar el appointment
        if (grouped.has(priorityId)) {
          grouped.get(priorityId).patients.push(appt);
        } else {
          console.warn(`⚠️ Appointment ${appt._id} tiene priority ${priorityId} que no existe en PriorityList`);
        }
      }

      // Convertir Map a Array y agregar count
      const result = Array.from(grouped.values()).map(col => {
        // ✅ Ordenar patients por slot.position
        const sortedPatients = col.patients.sort((a, b) => {
          const posA = a.selectedAppDates?.[0]?.position ?? 0;
          const posB = b.selectedAppDates?.[0]?.position ?? 0;
          return posA - posB;
        });
        
        return {
          ...col,
          patients: sortedPatients,
          count: sortedPatients.length,
        };
      });

      console.log(`✅ [/DraggableCards] Procesados ${appointments.length} appointment-slots`);
      console.log(`✅ [/DraggableCards] Agrupados en ${result.length} columnas de prioridad`);
      result.forEach(col => {
        console.log(`   📋 ${col.priorityName} (${col.priorityColor}): ${col.count} patients`);
      });
      console.log("Result", result);
      return res.status(200).json(result);
    } catch (err) {
      console.error('[GET /DraggableCards] Error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);



module.exports = router;
