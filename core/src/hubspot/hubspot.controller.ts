import {
  Controller,
  Post,
  Body,
  Logger,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { HubspotService } from './hubspot.service';

@Controller('webhooks/hubspot')
export class HubspotController {
  private readonly logger = new Logger(HubspotController.name);

  constructor(private readonly hubspotService: HubspotService) {}

  /**
   * Endpoint para recibir webhooks de HubSpot sobre contactos
   * HubSpot envía webhooks cuando se crean o actualizan contactos
   */
  @Post('contacts')
  @HttpCode(HttpStatus.OK)
  async handleContactWebhook(
    @Body() webhookPayload: any,
    @Headers() headers: any,
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log('=== HUBSPOT CONTACT WEBHOOK RECEIVED ===');
      this.logger.debug(
        'Webhook payload:',
        JSON.stringify(webhookPayload, null, 2),
      );
      this.logger.debug('Headers:', JSON.stringify(headers, null, 2));
      this.logger.debug('Timestamp:', new Date().toISOString());

      // HubSpot puede enviar múltiples eventos en un solo webhook
      if (webhookPayload && Array.isArray(webhookPayload)) {
        // Procesar múltiples eventos
        for (const event of webhookPayload) {
          await this.processWebhookEvent(event);
        }
      } else if (webhookPayload) {
        // Procesar un solo evento
        await this.processWebhookEvent(webhookPayload);
      } else {
        this.logger.warn('Empty webhook payload received');
      }

      this.logger.log('✅ Contact webhook processed successfully');
      return {
        success: true,
        message: 'Webhook processed successfully',
      };
    } catch (error) {
      this.logger.error(
        `❌ Error processing contact webhook: ${error.message}`,
        error.stack,
      );
      // Retornar 200 para que HubSpot no reintente el webhook
      // pero loguear el error para debugging
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Procesa un evento individual del webhook
   * HubSpot envía webhooks cuando cambia un contacto, especialmente cuando cambia el RUT
   */
  private async processWebhookEvent(event: any): Promise<void> {
    // HubSpot envía eventos con estructura:
    // { subscriptionId, portalId, occurredAt, subscriptionType, eventId, objectId, ... }
    if (!event.objectId) {
      this.logger.warn('Webhook event missing objectId, skipping');
      return;
    }

    // Solo procesar eventos de creación o actualización de contactos
    const subscriptionType = event.subscriptionType || '';
    if (
      !subscriptionType.includes('contact') &&
      !subscriptionType.includes('contact.propertyChange')
    ) {
      this.logger.log(`Skipping non-contact event: ${subscriptionType}`);
      return;
    }

    // Verificar si el evento es específicamente por cambio en la propiedad RUT
    if (event.propertyName) {
      this.logger.log(
        `Property changed: ${event.propertyName} for contact ${event.objectId}`,
      );
      // Si el webhook especifica la propiedad, podemos filtrar solo cambios en RUT
      // Pero procesamos todos los cambios de contacto por si acaso
    }

    // Procesar el contacto (lee RUT y actualiza rut_formateado)
    await this.hubspotService.processContactFromWebhook(event);
  }
}
