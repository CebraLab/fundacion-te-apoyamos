import { Injectable, Logger } from '@nestjs/common';
import { ContactService } from './contact.service';
import { RutFormatter } from './utils/rut-formatter.util';

@Injectable()
export class HubspotService {
  private readonly logger = new Logger(HubspotService.name);

  constructor(private readonly contactService: ContactService) {}

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

      // Formatear el RUT (eliminar puntos, guiones, espacios, letras, etc.)
      const rutFormateado = RutFormatter.formatRut(rutOriginal);

      // Validar el RUT pero continuar de todas formas (solo warning)
      if (!RutFormatter.isValidRut(rutFormateado)) {
        this.logger.warn(
          `Invalid RUT format for contact ${contactId}: "${rutOriginal}" -> "${rutFormateado}" (will save anyway)`,
        );
      }

      // Verificar si el rut_formateado ya existe y es el mismo
      const existingRutFormateado = contact.properties.rut_formateado;
      if (existingRutFormateado === rutFormateado) {
        this.logger.log(
          `✅ Contact ${contactId} - RUT ya está formateado correctamente: "${rutFormateado}" (solo formateo, sin duplicados)`,
        );
        return;
      }

      // Actualizar el contacto con el RUT formateado en la propiedad 'rut_formateado'
      // SIEMPRE guardar el RUT formateado, incluso si no es válido
      await this.contactService.update(contactId, {
        rut_formateado: rutFormateado,
      });

      this.logger.log(
        `✅ Contact ${contactId} - RUT formateado actualizado: "${rutOriginal}" -> "${rutFormateado}"`,
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
