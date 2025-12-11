import { Injectable, Logger } from '@nestjs/common';
import { ContactService } from './contact.service';
import { RutFormatter } from './utils/rut-formatter.util';

@Injectable()
export class HubspotService {
  private readonly logger = new Logger(HubspotService.name);

  constructor(private readonly contactService: ContactService) {}

  /**
   * Procesa un contacto recibido desde webhook de HubSpot
   * Lee la propiedad 'RUT' del contacto y actualiza 'rut_formateado'
   * Se activa cuando el contacto cambia (especialmente cuando cambia el RUT)
   */
  async processContactFromWebhook(webhookPayload: any): Promise<void> {
    try {
      this.logger.log(
        `Processing contact webhook: ${webhookPayload.objectId || 'unknown'}`,
      );

      // Extraer el ID del contacto desde el webhook
      const contactId = webhookPayload.objectId;
      if (!contactId) {
        throw new Error('Contact ID not found in webhook payload');
      }

      // El webhook puede incluir el valor del RUT directamente
      let rutOriginal = webhookPayload.propertyValue;

      // Si no viene en el webhook, obtener el contacto completo desde HubSpot
      // Especificando explícitamente las propiedades que necesitamos
      if (!rutOriginal) {
        const contact = await this.contactService.getById(contactId, [
          'rut',
          'rut_formateado',
        ]);
        if (!contact || !contact.properties) {
          throw new Error(`Contact ${contactId} not found in HubSpot`);
        }
        rutOriginal = contact.properties.rut;
      }

      if (!rutOriginal) {
        this.logger.warn(
          `No RUT property found in contact ${contactId}, skipping rut_formateado update`,
        );
        return;
      }

      this.logger.log(`Contact ${contactId} - RUT original: "${rutOriginal}"`);

      // Formatear el RUT (eliminar puntos, guiones, espacios)
      const rutFormateado = RutFormatter.formatRut(rutOriginal);

      if (!RutFormatter.isValidRut(rutFormateado)) {
        this.logger.warn(
          `Invalid RUT format for contact ${contactId}: "${rutOriginal}" -> "${rutFormateado}"`,
        );
        return;
      }

      // Obtener el contacto para verificar el rut_formateado actual
      const contact = await this.contactService.getById(contactId, [
        'rut',
        'rut_formateado',
      ]);

      // Verificar si el rut_formateado ya existe y es el mismo
      const existingRutFormateado = contact?.properties?.rut_formateado;
      if (existingRutFormateado === rutFormateado) {
        this.logger.log(
          `Contact ${contactId} already has correct rut_formateado: "${rutFormateado}"`,
        );
        return;
      }

      // Actualizar el contacto con el RUT formateado en la propiedad 'rut_formateado'
      await this.contactService.update(contactId, {
        rut_formateado: rutFormateado,
      });

      this.logger.log(
        `✅ Contact ${contactId} updated successfully. RUT: "${rutOriginal}" -> rut_formateado: "${rutFormateado}"`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing contact webhook: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Procesa un contacto desde la cola RabbitMQ
   * Lee la propiedad 'RUT' del contacto y actualiza 'rut_formateado'
   * Este método se llama cuando se consume un mensaje de la cola
   */
  async processContactFromQueue(message: any): Promise<void> {
    try {
      this.logger.log(
        `Processing contact from queue: ${message.id} - ${message.payload?.objectId || 'unknown'}`,
      );

      const contactId = message.payload?.objectId;
      if (!contactId) {
        throw new Error('Contact ID not found in queue message payload');
      }

      // Obtener el contacto completo desde HubSpot
      // Especificando explícitamente las propiedades que necesitamos
      const contact = await this.contactService.getById(contactId, [
        'rut',
        'rut_formateado',
      ]);
      if (!contact || !contact.properties) {
        throw new Error(`Contact ${contactId} not found in HubSpot`);
      }

      // Extraer el RUT de la propiedad 'rut' del contacto
      const rutOriginal = contact.properties.rut;
      if (!rutOriginal) {
        this.logger.warn(
          `No RUT property found in contact ${contactId}, skipping rut_formateado update`,
        );
        return;
      }

      this.logger.log(`Contact ${contactId} - RUT original: "${rutOriginal}"`);

      // Formatear el RUT (eliminar puntos, guiones, espacios)
      const rutFormateado = RutFormatter.formatRut(rutOriginal);

      if (!RutFormatter.isValidRut(rutFormateado)) {
        this.logger.warn(
          `Invalid RUT format for contact ${contactId}: "${rutOriginal}" -> "${rutFormateado}"`,
        );
        return;
      }

      // Verificar si el rut_formateado ya existe y es el mismo
      const existingRutFormateado = contact.properties.rut_formateado;
      if (existingRutFormateado === rutFormateado) {
        this.logger.log(
          `Contact ${contactId} already has correct rut_formateado: "${rutFormateado}"`,
        );
        return;
      }

      // Actualizar el contacto con el RUT formateado en la propiedad 'rut_formateado'
      await this.contactService.update(contactId, {
        rut_formateado: rutFormateado,
      });

      this.logger.log(
        `✅ Contact ${contactId} updated successfully from queue. RUT: "${rutOriginal}" -> rut_formateado: "${rutFormateado}"`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing contact from queue: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
