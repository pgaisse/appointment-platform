// apps/backend/src/routes/appointment-migration.js
const express = require('express');
const router = express.Router();
const { Appointment } = require('../models/Appointments');
const { jwtCheck, attachUserInfo, ensureUser } = require('../middleware/auth');
const helpers = require('../helpers');

router.use(jwtCheck, attachUserInfo, ensureUser);

/**
 * POST /api/appointment-migration/migrate-to-slot-fields
 * 
 * Migra los campos treatment, priority, providers del root de los appointments
 * a cada slot individual en selectedAppDates.
 * 
 * Query params:
 *   - dryRun=true (default): Solo reporta qué se haría sin modificar la DB
 *   - dryRun=false: Ejecuta la migración real
 * 
 * Body (opcional):
 *   - org_id: Si se omite, usa el org_id del token
 * 
 * Responde con:
 *   - total: cantidad de appointments revisados
 *   - modified: cantidad que necesitaron cambios
 *   - errors: array de errores si hubo alguno
 *   - dryRun: si fue una simulación o real
 */
router.post('/migrate-to-slot-fields', async (req, res) => {
  try {
    const dryRun = req.query.dryRun !== 'false'; // default true
    const tokenOrgId = req.user?.org_id || (await helpers.getTokenInfo(req.headers.authorization)).org_id;
    const org_id = req.body.org_id || tokenOrgId;

    if (!org_id) {
      return res.status(400).json({ error: 'Missing org_id' });
    }

    console.log(`[appointment-migration] Starting migration for org_id=${org_id}, dryRun=${dryRun}`);

    const results = await Appointment.migrateBulkToSlotFields(org_id, dryRun);

    console.log(`[appointment-migration] Results:`, results);

    return res.status(200).json({
      success: true,
      message: dryRun 
        ? `Dry run completed. ${results.modified}/${results.total} appointments would be modified.`
        : `Migration completed. ${results.modified}/${results.total} appointments were modified.`,
      ...results
    });

  } catch (err) {
    console.error('[appointment-migration] Error:', err);
    return res.status(500).json({ 
      error: 'Migration failed', 
      details: err.message 
    });
  }
});

/**
 * GET /api/appointment-migration/status
 * 
 * Reporta cuántos appointments tienen datos en root vs en slots
 */
router.get('/status', async (req, res) => {
  try {
    const tokenOrgId = req.user?.org_id || (await helpers.getTokenInfo(req.headers.authorization)).org_id;
    const org_id = req.query.org_id || tokenOrgId;

    if (!org_id) {
      return res.status(400).json({ error: 'Missing org_id' });
    }

    const [
      totalWithSlots,
      rootTreatment,
      rootPriority,
      rootProviders,
      slotTreatment,
      slotPriority,
      slotProviders
    ] = await Promise.all([
      Appointment.countDocuments({ org_id, selectedAppDates: { $exists: true, $ne: [] } }),
      Appointment.countDocuments({ org_id, treatment: { $exists: true, $ne: null } }),
      Appointment.countDocuments({ org_id, priority: { $exists: true, $ne: null } }),
      Appointment.countDocuments({ org_id, 'providers.0': { $exists: true } }),
      Appointment.countDocuments({ org_id, 'selectedAppDates.treatment': { $exists: true, $ne: null } }),
      Appointment.countDocuments({ org_id, 'selectedAppDates.priority': { $exists: true, $ne: null } }),
      Appointment.countDocuments({ org_id, 'selectedAppDates.providers.0': { $exists: true } })
    ]);

    return res.status(200).json({
      org_id,
      totalAppointmentsWithSlots: totalWithSlots,
      legacy: {
        treatmentInRoot: rootTreatment,
        priorityInRoot: rootPriority,
        providersInRoot: rootProviders
      },
      current: {
        treatmentInSlots: slotTreatment,
        priorityInSlots: slotPriority,
        providersInSlots: slotProviders
      },
      recommendation: (rootTreatment > 0 || rootPriority > 0 || rootProviders > 0)
        ? 'Consider running migration with POST /migrate-to-slot-fields?dryRun=false'
        : 'No migration needed - all appointments use slot-level fields'
    });

  } catch (err) {
    console.error('[appointment-migration] Status check error:', err);
    return res.status(500).json({ 
      error: 'Status check failed', 
      details: err.message 
    });
  }
});

module.exports = router;
