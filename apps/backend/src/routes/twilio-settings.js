const express = require('express');
const router = express.Router();
const TwilioSettings = require('../models/TwilioSettings');
const TwilioService = require('../services/TwilioService');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// Middleware para requerir rol de support en todas las rutas
const requireSupport = requireRole('support');

// GET - Obtener configuración actual (sin exponer tokens)
router.get('/settings', requireAuth, requireSupport, async (req, res) => {
  try {
    const org_id = req.user?.org_id;

    if (!org_id) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    const settings = await TwilioSettings.findOne({ org_id });

    if (!settings) {
      return res.json({
        configured: false,
        enabled: false,
        validated: false,
        fromNumber: null,
        messagingServiceSid: null,
        conversationsServiceSid: null,
        webhookUrl: null,
        webhookEnabled: false,
        webhookConfigured: false,
      });
    }

    // Obtener accountSid para mostrarlo (parcialmente oculto)
    const fullSettings = await TwilioSettings.findOne({ org_id }).select('+accountSid');
    const accountSid = fullSettings?.accountSid || '';
    // Ocultar parte del Account SID (mostrar solo últimos 4 caracteres)
    const maskedAccountSid = accountSid ? `${'*'.repeat(accountSid.length - 4)}${accountSid.slice(-4)}` : '';
    
    res.json({
      configured: true,
      enabled: settings.enabled,
      validated: settings.validated,
      accountSid: maskedAccountSid, // Parcialmente oculto
      fromNumber: settings.fromNumber,
      messagingServiceSid: settings.messagingServiceSid || null,
      conversationsServiceSid: settings.conversationsServiceSid || null,
      webhookUrl: settings.webhookUrl || null,
      webhookEnabled: settings.webhookEnabled,
      webhookConfigured: settings.webhookConfigured,
      lastValidatedAt: settings.lastValidatedAt,
      updatedAt: settings.updatedAt,
    });
  } catch (error) {
    console.error('[TwilioSettings] Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch Twilio settings' });
  }
});

// POST - Guardar/actualizar configuración
router.post('/settings', requireAuth, requireSupport, async (req, res) => {
  try {
    const org_id = req.user?.org_id;

    if (!org_id) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    const {
      accountSid,
      authToken,
      fromNumber,
      messagingServiceSid,
      conversationsServiceSid,
    } = req.body;

    // Validaciones
    if (!accountSid || !authToken || !fromNumber) {
      return res.status(400).json({
        error: 'accountSid, authToken, and fromNumber are required',
      });
    }

    // Validar formato de número
    if (!/^\+[1-9]\d{1,14}$/.test(fromNumber)) {
      return res.status(400).json({
        error: 'Invalid phone number format. Use E.164 format (e.g., +61412345678)',
      });
    }

    // Validar credenciales con Twilio antes de guardar
    console.log('[TwilioSettings] Validating credentials...');
    const isValid = await TwilioService.validateCredentials(accountSid, authToken);

    if (!isValid) {
      return res.status(400).json({
        error: 'Invalid Twilio credentials. Please check your Account SID and Auth Token.',
      });
    }

    console.log('[TwilioSettings] Credentials validated successfully');

    // Guardar o actualizar
    const settings = await TwilioSettings.findOneAndUpdate(
      { org_id },
      {
        accountSid,
        authToken,
        fromNumber,
        messagingServiceSid: messagingServiceSid || null,
        conversationsServiceSid: conversationsServiceSid || null,
        enabled: true,
        validated: true,
        lastValidatedAt: new Date(),
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    // Invalidar cache
    TwilioService.invalidateCache(org_id);

    console.log(`[TwilioSettings] Settings saved for org: ${org_id}`);

    res.json({
      success: true,
      message: 'Twilio settings saved and validated successfully',
      fromNumber: settings.fromNumber,
      validated: true,
    });
  } catch (error) {
    console.error('[TwilioSettings] Error saving settings:', error);
    res.status(500).json({
      error: 'Failed to save Twilio settings',
      details: error.message,
    });
  }
});

// POST - Configurar webhook de conversaciones
router.post('/webhook/configure', requireAuth, requireSupport, async (req, res) => {
  try {
    const org_id = req.user?.org_id;

    if (!org_id) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    const { webhookUrl } = req.body;

    if (!webhookUrl) {
      return res.status(400).json({ error: 'webhookUrl is required' });
    }

    // Validar URL
    try {
      new URL(webhookUrl);
    } catch {
      return res.status(400).json({ error: 'Invalid webhook URL format' });
    }

    console.log(`[TwilioSettings] Configuring webhook for org ${org_id}: ${webhookUrl}`);

    // Configurar webhook en Twilio
    const configuration = await TwilioService.configureConversationsWebhook(org_id, webhookUrl);

    res.json({
      success: true,
      message: 'Webhook configured successfully',
      configuration: {
        url: configuration.postWebhookUrl,
        method: configuration.method,
        filters: configuration.filters,
      },
    });
  } catch (error) {
    console.error('[TwilioSettings] Webhook configuration error:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to configure webhook';
    if (error.message.includes('Conversations Service SID not configured')) {
      errorMessage = 'Conversations Service SID must be configured before setting up webhooks';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(500).json({
      error: errorMessage,
      details: error.message,
    });
  }
});

// GET - Obtener configuración actual del webhook
router.get('/webhook/status', requireAuth, requireSupport, async (req, res) => {
  try {
    const org_id = req.user?.org_id;

    if (!org_id) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    const configuration = await TwilioService.getWebhookConfiguration(org_id);

    if (!configuration) {
      return res.json({
        configured: false,
        preWebhookUrl: null,
        postWebhookUrl: null,
        method: null,
        filters: [],
      });
    }

    res.json({
      configured: !!(configuration.preWebhookUrl || configuration.postWebhookUrl),
      preWebhookUrl: configuration.preWebhookUrl || null,
      postWebhookUrl: configuration.postWebhookUrl || null,
      method: configuration.method || 'POST',
      filters: configuration.filters || [],
      source: configuration.source || 'unknown',
    });
  } catch (error) {
    console.error('[TwilioSettings] Error fetching webhook status:', error);
    res.status(500).json({
      error: 'Failed to fetch webhook status',
      details: error.message,
    });
  }
});

// PUT - Habilitar/deshabilitar Twilio
router.put('/settings/toggle', requireAuth, requireSupport, async (req, res) => {
  try {
    const org_id = req.user?.org_id;

    if (!org_id) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }

    const settings = await TwilioSettings.findOneAndUpdate(
      { org_id },
      { enabled, updatedAt: new Date() },
      { new: true }
    );

    if (!settings) {
      return res.status(404).json({ error: 'Twilio settings not found' });
    }

    TwilioService.invalidateCache(org_id);

    res.json({
      success: true,
      message: `Twilio ${enabled ? 'enabled' : 'disabled'} successfully`,
      enabled: settings.enabled,
    });
  } catch (error) {
    console.error('[TwilioSettings] Error toggling settings:', error);
    res.status(500).json({ error: 'Failed to toggle Twilio settings' });
  }
});

// DELETE - Eliminar configuración (deshabilitarla)
router.delete('/settings', requireAuth, requireSupport, async (req, res) => {
  try {
    const org_id = req.user?.org_id;

    if (!org_id) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    await TwilioSettings.findOneAndUpdate(
      { org_id },
      {
        enabled: false,
        webhookEnabled: false,
        updatedAt: new Date(),
      }
    );

    TwilioService.invalidateCache(org_id);

    res.json({
      success: true,
      message: 'Twilio configuration disabled successfully',
    });
  } catch (error) {
    console.error('[TwilioSettings] Error deleting settings:', error);
    res.status(500).json({ error: 'Failed to delete Twilio settings' });
  }
});

// POST - Test de envío de SMS (para validar configuración)
router.post('/test/sms', requireAuth, requireSupport, async (req, res) => {
  try {
    const org_id = req.user?.org_id;

    if (!org_id) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    const { to, body } = req.body;

    if (!to || !body) {
      return res.status(400).json({ error: 'to and body are required' });
    }

    console.log(`[TwilioSettings] Sending test SMS for org ${org_id} to ${to}`);

    const message = await TwilioService.sendSMS(org_id, { to, body });

    res.json({
      success: true,
      message: 'Test SMS sent successfully',
      messageSid: message.sid,
      status: message.status,
    });
  } catch (error) {
    console.error('[TwilioSettings] Test SMS error:', error);
    res.status(500).json({
      error: 'Failed to send test SMS',
      details: error.message,
    });
  }
});

module.exports = router;
