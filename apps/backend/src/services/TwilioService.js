const twilio = require('twilio');
const TwilioSettings = require('../models/TwilioSettings');

class TwilioService {
  constructor() {
    this.clients = new Map(); // Cache de clientes por org_id
  }

  /**
   * Obtiene cliente de Twilio para una organización
   * @param {string} org_id - ID de la organización
   * @returns {Promise<{client: any, settings: object}>}
   */
  async getClient(org_id) {
    // Check cache
    if (this.clients.has(org_id)) {
      return this.clients.get(org_id);
    }

    // Obtener credenciales de la org desde DB
    const settings = await TwilioSettings.findOne({ org_id, enabled: true })
      .select('+accountSid +authToken'); // Incluir campos sensibles

    if (!settings) {
      // Fallback a variables de entorno si existen
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        console.warn(`[TwilioService] Using fallback credentials for org: ${org_id}`);
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        
        const fallbackConfig = {
          client,
          settings: {
            fromNumber: process.env.TWILIO_FROM_MAIN || null,
            messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || null,
            conversationsServiceSid: process.env.TWILIO_CONVERSATIONS_SERVICE_SID || null,
            isFallback: true,
          },
        };
        
        this.clients.set(org_id, fallbackConfig);
        return fallbackConfig;
      }
      
      throw new Error('Twilio not configured for this organization');
    }

    // Crear cliente
    const client = twilio(settings.accountSid, settings.authToken);
    
    const config = {
      client,
      settings: {
        fromNumber: settings.fromNumber,
        messagingServiceSid: settings.messagingServiceSid,
        conversationsServiceSid: settings.conversationsServiceSid,
        webhookUrl: settings.webhookUrl,
        webhookEnabled: settings.webhookEnabled,
        isFallback: false,
      },
    };
    
    // Cache it
    this.clients.set(org_id, config);

    return config;
  }

  /**
   * Enviar SMS
   * @param {string} org_id - ID de la organización
   * @param {object} options - Opciones del mensaje
   * @param {string} options.to - Número destino
   * @param {string} options.body - Contenido del mensaje
   * @returns {Promise<any>}
   */
  async sendSMS(org_id, { to, body }) {
    const { client, settings } = await this.getClient(org_id);

    const messageOptions = {
      body,
      to,
    };

    // Priorizar Messaging Service sobre número directo
    if (settings.messagingServiceSid) {
      messageOptions.messagingServiceSid = settings.messagingServiceSid;
    } else if (settings.fromNumber) {
      messageOptions.from = settings.fromNumber;
    } else {
      throw new Error('No from number or messaging service configured');
    }

    console.log(`[TwilioService] Sending SMS for org ${org_id} to ${to}`);
    return await client.messages.create(messageOptions);
  }

  /**
   * Validar credenciales de Twilio
   * @param {string} accountSid 
   * @param {string} authToken 
   * @returns {Promise<boolean>}
   */
  async validateCredentials(accountSid, authToken) {
    try {
      const client = twilio(accountSid, authToken);
      await client.api.accounts(accountSid).fetch();
      return true;
    } catch (error) {
      console.error('[TwilioService] Credential validation failed:', error.message);
      return false;
    }
  }

  /**
   * Configurar webhook en Twilio Conversations
   * @param {string} org_id 
   * @param {string} webhookUrl 
   * @returns {Promise<any>}
   */
  async configureConversationsWebhook(org_id, webhookUrl) {
    const { client, settings } = await this.getClient(org_id);

    try {
      let configuration;
      
      // Si hay Conversations Service SID, configurar en el service
      if (settings.conversationsServiceSid) {
        console.log(`[TwilioService] Configuring webhook for service: ${settings.conversationsServiceSid}`);
        
        configuration = await client.conversations.v1
          .services(settings.conversationsServiceSid)
          .configuration()
          .webhooks()
          .update({
            method: 'POST',
            filters: [
              'onMessageAdded',
              'onConversationAdded',
              'onConversationRemoved',
              'onParticipantAdded',
              'onParticipantRemoved',
            ],
            postWebhookUrl: webhookUrl,
          });
          
        console.log(`[TwilioService] Webhook configured for service ${settings.conversationsServiceSid}:`, webhookUrl);
      } else {
        // Si no hay service, configurar globalmente
        console.log(`[TwilioService] Configuring GLOBAL webhook (no service configured)`);
        
        configuration = await client.conversations.v1
          .configuration()
          .webhooks()
          .update({
            method: 'POST',
            filters: [
              'onMessageAdded',
              'onConversationAdded',
              'onConversationRemoved',
              'onParticipantAdded',
              'onParticipantRemoved',
            ],
            postWebhookUrl: webhookUrl,
          });
          
        console.log(`[TwilioService] Global webhook configured for org ${org_id}:`, webhookUrl);
      }
      
      // Actualizar en DB
      await TwilioSettings.findOneAndUpdate(
        { org_id },
        {
          webhookUrl,
          webhookConfigured: true,
          webhookEnabled: true,
          updatedAt: new Date(),
        }
      );

      return configuration;
    } catch (error) {
      console.error('[TwilioService] Webhook configuration failed:', error);
      throw error;
    }
  }

  /**
   * Obtener información del webhook configurado
   * Intenta obtener de dos lugares:
   * 1. Del Conversations Service específico (si existe)
   * 2. De la configuración global de Conversations
   * @param {string} org_id 
   * @returns {Promise<any>}
   */
  async getWebhookConfiguration(org_id) {
    const { client, settings } = await this.getClient(org_id);

    try {
      // Primero intentar obtener del Service específico
      if (settings.conversationsServiceSid) {
        try {
          console.log('[TwilioService] Fetching webhook config for service:', settings.conversationsServiceSid);
          
          const configuration = await client.conversations.v1
            .services(settings.conversationsServiceSid)
            .configuration()
            .webhooks()
            .fetch();

          console.log('[TwilioService] Service webhook config retrieved:', {
            preWebhookUrl: configuration.preWebhookUrl,
            postWebhookUrl: configuration.postWebhookUrl,
            method: configuration.method,
            filters: configuration.filters,
          });

          // Si tiene URLs configuradas, retornar
          if (configuration.preWebhookUrl || configuration.postWebhookUrl) {
            return { ...configuration, source: 'service' };
          }
        } catch (serviceError) {
          console.log('[TwilioService] Service webhook fetch failed, trying global:', serviceError.message);
        }
      }
      
      // Si no hay Service o no tiene webhooks, intentar global
      console.log('[TwilioService] Fetching GLOBAL webhook configuration...');
      const globalConfiguration = await client.conversations.v1
        .configuration()
        .webhooks()
        .fetch();

      console.log('[TwilioService] Global webhook config retrieved:', {
        preWebhookUrl: globalConfiguration.preWebhookUrl,
        postWebhookUrl: globalConfiguration.postWebhookUrl,
        method: globalConfiguration.method,
        filters: globalConfiguration.filters,
      });

      return { ...globalConfiguration, source: 'global' };
      
    } catch (error) {
      console.error('[TwilioService] Failed to fetch webhook config:', error.message);
      return null;
    }
  }

  /**
   * Invalidar cache (útil al actualizar credenciales)
   * @param {string} org_id 
   */
  invalidateCache(org_id) {
    if (org_id) {
      this.clients.delete(org_id);
      console.log(`[TwilioService] Cache invalidated for org: ${org_id}`);
    } else {
      this.clients.clear();
      console.log('[TwilioService] All cache cleared');
    }
  }

  /**
   * Obtener estadísticas de uso (opcional, requiere permisos en Twilio)
   * @param {string} org_id 
   * @returns {Promise<any>}
   */
  async getUsageStats(org_id) {
    const { client } = await this.getClient(org_id);

    try {
      const usage = await client.usage.records.list({ limit: 20 });
      return usage;
    } catch (error) {
      console.error('[TwilioService] Failed to fetch usage stats:', error);
      return null;
    }
  }
}

// Exportar singleton
module.exports = new TwilioService();
