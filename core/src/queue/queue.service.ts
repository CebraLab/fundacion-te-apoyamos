import { Injectable, Logger } from '@nestjs/common';
import { HubspotService } from '../hubspot/hubspot.service';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(private readonly hubspotService: HubspotService) {}

  /**
   * Procesa un mensaje de contacto desde la cola RabbitMQ
   * El mensaje contiene el objectId del contacto de HubSpot
   */
  async processContact(message: any): Promise<void> {
    try {
      this.logger.log(
        `[contact_queue] Starting to process message: ${message.id} - ${message.payload?.objectId || 'unknown'}`,
      );

      // Procesar el contacto usando HubspotService
      await this.hubspotService.processContactFromQueue(message);

      this.logger.log(
        `[contact_queue] Message processed successfully: ${message.id} - ${message.payload?.objectId || 'unknown'}`,
      );
    } catch (error) {
      this.logger.error(
        `[contact_queue] Error processing message: ${message.id} - ${message?.payload?.objectId || 'unknown'}`,
        error.stack,
      );
      throw error;
    }
  }
}
