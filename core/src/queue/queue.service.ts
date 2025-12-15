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
   */
  async processContact(message: any): Promise<void> {
    await this.hubspotService.processContactFromQueue(message);
  }

  /**
   * Unifica contactos duplicados basándose en el RUT
   * Sigue el patrón de nuestros-parques-project: busca contactos y mergea directamente
   */
  async unificarRut(message: any): Promise<void> {
    const contactId = message.payload?.objectId;
    if (!contactId) {
      return;
    }

    const contact = await this.contactService.getById(contactId, ['rut']);
    if (!contact?.properties?.rut) {
      return;
    }

    const rutOriginal = contact.properties.rut;
    const rutNormalizado = RutFormatter.formatRut(rutOriginal);

    this.logger.log(
      `Contacto ${contactId} - RUT: "${rutOriginal}" (normalizado: "${rutNormalizado}")`,
    );

    // Asegurarse de que el contacto tenga rut_formateado guardado
    const contactWithFormatted = await this.contactService.getById(contactId, [
      'rut',
      'rut_formateado',
    ]);
    if (
      !contactWithFormatted?.properties?.rut_formateado ||
      contactWithFormatted.properties.rut_formateado !== rutNormalizado
    ) {
      await this.contactService.update(contactId, {
        rut_formateado: rutNormalizado,
      });
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    // Buscar contactos con el mismo RUT (con reintentos para indexación)
    let contacts = { results: [] as any[] };
    let retries = 5;

    while (retries > 0) {
      const searchResult = await this.contactService.searchContactsByRut(
        rutNormalizado,
        ['rut', 'rut_formateado', 'createdate'],
      );

      const foundContacts = searchResult?.results || [];
      const otherContacts = foundContacts.filter((c) => c.id !== contactId);

      if (otherContacts.length > 0) {
        contacts = searchResult;
        break;
      }

      if (retries > 1) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
      retries--;
    }

    // Eliminar duplicados
    const uniqueContacts = (contacts.results || []).filter(
      (contact, index, self) =>
        index === self.findIndex((c) => c.id === contact.id),
    );

    if (uniqueContacts.length <= 1) {
      this.logger.log(
        `Contacto ${contactId} - RUT "${rutNormalizado}" es único, no hay duplicados para unificar`,
      );
      return;
    }

    // Tomar el primero como primary (ya está ordenado por createdate ASC) y mergear el resto
    const [primaryContact, ...contactsToMerge] = uniqueContacts;

    this.logger.log(
      `🔗 Contacto ${contactId} tiene el mismo RUT "${rutNormalizado}" que ${uniqueContacts.length - 1} otro(s) contacto(s). Se procede a unificar.`,
    );
    this.logger.log(
      `   Contacto principal (más antiguo): ${primaryContact.id}. Contactos a unificar: ${contactsToMerge.map((c) => c.id).join(', ')}`,
    );

    let successCount = 0;
    let failCount = 0;

    for (const contactToMerge of contactsToMerge) {
      try {
        await this.contactService.mergeContacts(
          primaryContact.id,
          contactToMerge.id,
        );
        successCount++;
        this.logger.log(
          `   ✅ Contacto ${contactToMerge.id} unificado exitosamente en ${primaryContact.id}`,
        );
      } catch (error: any) {
        failCount++;
        // Continuar con el siguiente contacto aunque falle uno
        if (error.response?.status === 400) {
          this.logger.warn(
            `   ⚠️ Contacto ${contactToMerge.id} no pudo ser unificado: ${error.response?.data?.message || error.message}`,
          );
        } else {
          this.logger.error(
            `   ❌ Error al unificar contacto ${contactToMerge.id}: ${error.message}`,
          );
        }
      }
    }

    this.logger.log(
      `✅ Unificación completada para RUT "${rutNormalizado}". Contacto principal: ${primaryContact.id}. Exitosos: ${successCount}, Fallidos: ${failCount}`,
    );
  }
}
