import { Injectable, Logger } from '@nestjs/common';
import { ContactService } from './contact.service';
import { CompanyService } from './company.service';
import { RutFormatter } from './utils/rut-formatter.util';

@Injectable()
export class HubspotService {
  private readonly logger = new Logger(HubspotService.name);

  constructor(
    private readonly contactService: ContactService,
    private readonly companyService: CompanyService,
  ) {}

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

  /**
   * Procesa una empresa desde la cola RabbitMQ
   * Lee la propiedad 'RUT' de la empresa y actualiza 'rut_formateado'
   * Este método se llama cuando se consume un mensaje de la cola
   */
  async processCompanyFromQueue(message: any): Promise<void> {
    try {
      this.logger.log(
        `Processing company from queue: ${message.id} - ${message.payload?.objectId || 'unknown'}`,
      );

      const companyId = message.payload?.objectId;
      if (!companyId) {
        throw new Error('Company ID not found in queue message payload');
      }

      // Obtener la empresa completa desde HubSpot
      const company = await this.companyService.getById(companyId, [
        'rut',
        'rut_formateado',
      ]);
      if (!company || !company.properties) {
        throw new Error(`Company ${companyId} not found in HubSpot`);
      }

      // Extraer el RUT de la propiedad 'rut' de la empresa
      const rutOriginal = company.properties.rut;
      if (!rutOriginal) {
        this.logger.warn(
          `No RUT property found in company ${companyId}, skipping rut_formateado update`,
        );
        return;
      }

      this.logger.log(`Company ${companyId} - RUT original: "${rutOriginal}"`);

      // Formatear el RUT (eliminar puntos, guiones, espacios, letras, etc.)
      const rutFormateado = RutFormatter.formatRut(rutOriginal);

      // Validar el RUT pero continuar de todas formas (solo warning)
      if (!RutFormatter.isValidRut(rutFormateado)) {
        this.logger.warn(
          `Invalid RUT format for company ${companyId}: "${rutOriginal}" -> "${rutFormateado}" (will save anyway)`,
        );
      }

      // Verificar si el rut_formateado ya existe y es el mismo
      const existingRutFormateado = company.properties.rut_formateado;
      if (existingRutFormateado === rutFormateado) {
        this.logger.log(
          `✅ Company ${companyId} - RUT ya está formateado correctamente: "${rutFormateado}" (solo formateo, sin duplicados)`,
        );
        return;
      }

      // Actualizar la empresa con el RUT formateado en la propiedad 'rut_formateado'
      // SIEMPRE guardar el RUT formateado, incluso si no es válido
      await this.companyService.update(companyId, {
        rut_formateado: rutFormateado,
      });

      this.logger.log(
        `✅ Company ${companyId} - RUT formateado actualizado: "${rutOriginal}" -> "${rutFormateado}"`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing company from queue: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
