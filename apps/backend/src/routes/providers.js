// src/routes/providers.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/providers.controller');
const { attachUserInfo, jwtCheck, checkJwt, decodeToken, ensureUser } = require('../middleware/auth');
const { requireAnyPermissionExplain } = require('../middleware/rbac-explain');
router.use(jwtCheck, attachUserInfo, ensureUser);
// Optional: RBAC middlewares (uncomment and adapt to your project)
// const { requireAnyPermission } = require('../middlewares/requireAnyPermission');

router.get('/', /* requireAnyPermission(['provider:read']), */ ctrl.listProviders);
router.post('/', /* requireAnyPermission(['provider:write']), */ ctrl.createProvider);
router.get('/suggest',/* requireAnyPermission(['provider:timeoff_edit']),*/ ctrl.suggestProviders);


router.get('/:id', /* requireAnyPermission(['provider:read']), */ ctrl.getProvider);
router.patch('/:id', /* requireAnyPermission(['provider:write']), */ ctrl.updateProvider);


router.get('/:id/appointments', /* requireAnyPermission(['provider:read']), */ ctrl.getProviderAppointments);
router.get('/:id/availability', /* requireAnyPermission(['provider:read']), */ ctrl.providerAvailability);
// === NEW: leer schedule actual (latest)
router.get('/:id/schedule', ctrl.getLatestSchedule);

router.post('/:id/schedule',     /* requireAnyPermission(['provider:schedule_edit']), */ ctrl.upsertSchedule);
router.post('/:id/timeoff',      /* requireAnyPermission(['provider:timeoff_edit']), */ ctrl.createTimeOff);
router.get('/:id/timeoff',      /* requireAnyPermission(['provider:timeoff_edit']), */ ctrl.listTimeOff);
// === NEW: editar/eliminar time off
router.patch('/:id/timeoff/:timeOffId', ctrl.updateTimeOff);
router.delete('/:id/timeoff/:timeOffId', ctrl.deleteTimeOff);

module.exports = router;
