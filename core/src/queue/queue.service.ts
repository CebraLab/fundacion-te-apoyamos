import { Injectable, Logger } from '@nestjs/common';
import { HubspotService } from '../hubspot/hubspot.service';
import { ContactService } from '../hubspot/contact.service';
import { RutFormatter } from '../hubspot/utils/rut-formatter.util';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    private readonly hubspotService: HubspotService,
    private readonly contactService: ContactService,
  ) {}

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

  /**
   * Unifica contactos duplicados basándose en el RUT
   * Busca todos los contactos con el mismo RUT y los mergea en el contacto más antiguo
   */
  async unificarRut(message: any): Promise<void> {
    try {
      this.logger.log(
        `[rut_unified_queue] Starting to unify RUT for message: ${message.id} - ${message.payload?.objectId || 'unknown'}`,
      );

      const contactId = message.payload?.objectId;
      if (!contactId) {
        this.logger.warn('No contactId found in message payload, skipping');
        return;
      }

      // 1. Obtener el contacto que disparó el evento (con createdate para comparar antigüedad)
      const contact = await this.contactService.getById(contactId, [
        'rut',
        'createdate',
      ]);
      if (!contact || !contact.properties) {
        this.logger.warn(`Contact ${contactId} not found in HubSpot, skipping`);
        return;
      }

      // 2. Verificar si el contacto tiene RUT
      const rutOriginal = contact.properties.rut;
      if (!rutOriginal) {
        this.logger.log(
          `Contact ${contactId} has no RUT property, skipping unification`,
        );
        return;
      }

      // 3. Normalizar el RUT (eliminar puntos, guiones, espacios)
      const rutNormalizado = RutFormatter.formatRut(rutOriginal);
      if (!RutFormatter.isValidRut(rutNormalizado)) {
        this.logger.warn(
          `Invalid RUT format for contact ${contactId}: "${rutOriginal}" -> "${rutNormalizado}", skipping`,
        );
        return;
      }

      this.logger.log(
        `Contact ${contactId} - RUT: "${rutOriginal}" (normalized: "${rutNormalizado}")`,
      );

      // 3.5. Asegurarse de que el contacto tenga rut_formateado guardado
      // (por si la cola contacts_queue aún no lo ha procesado)
      const contactWithFormatted = await this.contactService.getById(
        contactId,
        ['rut', 'rut_formateado'],
      );
      if (
        !contactWithFormatted?.properties?.rut_formateado ||
        contactWithFormatted.properties.rut_formateado !== rutNormalizado
      ) {
        this.logger.log(
          `Ensuring rut_formateado is set for contact ${contactId}: "${rutNormalizado}"`,
        );
        await this.contactService.update(contactId, {
          rut_formateado: rutNormalizado,
        });
      }

      // 4. Buscar todos los contactos con el mismo RUT usando rut_formateado
      // Incluir createdate para poder ordenar por antigüedad
      const searchResult = await this.contactService.searchContactsByRut(
        rutNormalizado,
        [
          'rut',
          'rut_formateado',
          'createdate',
          'firstname',
          'lastname',
          'email',
        ],
      );

      const contacts = searchResult.results || [];
      this.logger.log(
        `Found ${contacts.length} contact(s) with RUT "${rutNormalizado}"`,
      );

      // 5. Filtrar el contacto actual de la lista (no mergear consigo mismo)
      const otherContacts = contacts.filter((c) => c.id !== contactId);

      // Si no hay otros contactos, no hay nada que hacer
      if (otherContacts.length === 0) {
        this.logger.log(
          `No duplicates found for RUT "${rutNormalizado}". Contact ${contactId} is unique.`,
        );
        return;
      }

      // 5.1. Incluir el contacto actual en la lista para comparar fechas
      const allContacts = [...contacts];
      const currentContactInList = allContacts.find((c) => c.id === contactId);

      // Si el contacto actual no está en la lista, agregarlo
      if (!currentContactInList) {
        allContacts.push({
          id: contactId,
          properties: {
            createdate: contact.properties.createdate || contact.createdAt,
          },
        });
      }

      // 5.2. Ordenar todos los contactos por createdate (más antiguo primero)
      allContacts.sort((a, b) => {
        const dateA = new Date(
          a.properties?.createdate || a.createdAt || 0,
        ).getTime();
        const dateB = new Date(
          b.properties?.createdate || b.createdAt || 0,
        ).getTime();
        return dateA - dateB; // ASC: más antiguo primero
      });

      // 5.3. El contacto más antiguo será el principal
      const primaryContact = allContacts[0];
      const contactsToMerge = allContacts.slice(1);

      // No mergear el contacto principal consigo mismo
      const finalContactsToMerge = contactsToMerge.filter(
        (c) => c.id !== primaryContact.id,
      );

      this.logger.log(
        `Found ${finalContactsToMerge.length} duplicate(s) for RUT "${rutNormalizado}". Primary contact: ${primaryContact.id} (oldest)`,
      );

      // 5.4. Verificar existencia y mergear cada contacto duplicado en el contacto principal
      for (const contactToMerge of finalContactsToMerge) {
        try {
          // Verificar si el contacto existe antes de intentar mergearlo
          // (algunos contactos pueden aparecer en la búsqueda aunque ya fueron mergeados)
          try {
            await this.contactService.getById(contactToMerge.id, ['id']);
          } catch (getError: any) {
            // Si el contacto no existe (404), ya fue mergeado o eliminado
            if (getError.response?.status === 404) {
              this.logger.warn(
                `Contact ${contactToMerge.id} no longer exists (already merged or deleted). Skipping.`,
              );
              continue;
            }
            // Si es otro error, intentar mergear de todas formas
          }

          this.logger.log(
            `Merging contact ${contactToMerge.id} into ${primaryContact.id}`,
          );
          await this.contactService.mergeContacts(
            primaryContact.id,
            contactToMerge.id,
          );
          this.logger.log(
            `✅ Successfully merged contact ${contactToMerge.id} into ${primaryContact.id}`,
          );
        } catch (mergeError: any) {
          // Si el error es 400, puede ser que el contacto ya fue mergeado o no existe
          if (mergeError.response?.status === 400) {
            this.logger.warn(
              `Contact ${contactToMerge.id} may already be merged or doesn't exist (400). Skipping.`,
            );
          } else {
            this.logger.error(
              `Error merging contact ${contactToMerge.id} into ${primaryContact.id}: ${mergeError.message}`,
              mergeError.stack,
            );
          }
          // Continuar con el siguiente contacto aunque falle uno
        }
      }

      this.logger.log(
        `✅ Unification completed for RUT "${rutNormalizado}". Primary contact: ${primaryContact.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error unifying RUT for message ${message.id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
