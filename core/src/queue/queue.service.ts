import { Injectable, Logger } from '@nestjs/common';
import { HubspotService } from '../hubspot/hubspot.service';
import { ContactService } from '../hubspot/contact.service';
import { RutFormatter } from '../hubspot/utils/rut-formatter.util';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  private isRetryableMergeError(
    errorMessage: string,
    status?: number,
    errorCode?: string,
  ): boolean {
    const nonRetryablePatterns = [
      /association configuration limits are exceeded/i,
      /more than \d+ objects merged into it/i,
    ];

    if (nonRetryablePatterns.some((pattern) => pattern.test(errorMessage))) {
      return false;
    }

    if (status === 429 || (status && status >= 500)) {
      return true;
    }

    return ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'].includes(
      errorCode || '',
    );
  }

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

    // Asegurarse de que el contacto actual tenga rut_formateado guardado
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
      this.logger.log(
        `   Actualizado rut_formateado para contacto ${contactId}: "${rutOriginal}" -> "${rutNormalizado}"`,
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    // Buscar contactos con el mismo RUT (con reintentos para indexación)
    // Busca tanto por rut_formateado como por rut original
    let contacts = { results: [] as any[] };
    let retries = 2;

    while (retries > 0) {
      const searchResult = await this.contactService.searchContactsByRut(
        rutNormalizado,
        ['rut', 'rut_formateado', 'createdate'],
      );

      const foundContacts = searchResult?.results || [];

      // Filtrar por RUT normalizado (puede haber falsos positivos con CONTAINS)
      const contactsWithSameRut = foundContacts.filter((c) => {
        const contactRut = c.properties?.rut;
        if (!contactRut) return false;
        return RutFormatter.formatRut(contactRut) === rutNormalizado;
      });

      // Si encuentra más de 1 contacto, hay duplicados (exit loop)
      // Si encuentra solo 1, no hay duplicados (exit loop sin reintentos)
      if (contactsWithSameRut.length >= 1) {
        contacts.results = contactsWithSameRut;
        this.logger.log(
          `✅ Búsqueda en intento ${3 - retries}: encontrados ${contactsWithSameRut.length} contacto(s) con RUT "${rutNormalizado}"`,
        );
        break;
      }

      if (retries > 1) {
        this.logger.debug(
          `⏳ Reintentando búsqueda de contactos con RUT "${rutNormalizado}" (encontrados: 0, intentos restantes: ${retries - 1})...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 8000));
      }
      retries--;
    }

    // Eliminar duplicados por ID
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
    let primaryContactId = primaryContact.id;

    this.logger.log(
      `🔗 Contacto ${contactId} tiene el mismo RUT "${rutNormalizado}" que ${uniqueContacts.length - 1} otro(s) contacto(s). Se procede a unificar.`,
    );
    this.logger.log(
      `   Contacto principal (más antiguo): ${primaryContactId}. Contactos a unificar: ${contactsToMerge.map((c) => c.id).join(', ')}`,
    );

    let successCount = 0;
    let failCount = 0;
    let retryableFailCount = 0;
    let lastRetryableError = '';

    for (const contactToMerge of contactsToMerge) {
      try {
        await this.contactService.mergeContacts(
          primaryContactId,
          contactToMerge.id,
        );
        successCount++;
        this.logger.log(
          `   ✅ Contacto ${contactToMerge.id} unificado exitosamente en ${primaryContactId}`,
        );
      } catch (error: any) {
        const errorMessage = error.response?.data?.message || error.message;
        const status = error.response?.status;
        const errorCode = error.code as string | undefined;
        const forwardRefMatch = /forward reference to (\d+)/i.exec(
          errorMessage,
        );

        if (forwardRefMatch?.[1]) {
          const canonicalId = forwardRefMatch[1];
          if (canonicalId !== primaryContactId) {
            this.logger.warn(
              `   ⚠️ Contacto principal ${primaryContactId} no es canonical. Reintentando con canonical ${canonicalId}...`,
            );
            primaryContactId = canonicalId;
            try {
              await this.contactService.mergeContacts(
                primaryContactId,
                contactToMerge.id,
              );
              successCount++;
              this.logger.log(
                `   ✅ Contacto ${contactToMerge.id} unificado exitosamente en ${primaryContactId}`,
              );
              continue;
            } catch (retryError: any) {
              failCount++;
              const retryMessage =
                retryError.response?.data?.message || retryError.message;
              if (
                this.isRetryableMergeError(
                  retryMessage,
                  retryError.response?.status,
                  retryError.code,
                )
              ) {
                retryableFailCount++;
                lastRetryableError = retryMessage;
              }
              this.logger.warn(
                `   ⚠️ Contacto ${contactToMerge.id} no pudo ser unificado tras reintento: ${retryMessage}`,
              );
              continue;
            }
          }
        }

        failCount++;
        if (this.isRetryableMergeError(errorMessage, status, errorCode)) {
          retryableFailCount++;
          lastRetryableError = errorMessage;
        }
        // Continuar con el siguiente contacto aunque falle uno
        if (status === 400) {
          this.logger.warn(
            `   ⚠️ Contacto ${contactToMerge.id} no pudo ser unificado: ${errorMessage}`,
          );
        } else {
          this.logger.error(
            `   ❌ Error al unificar contacto ${contactToMerge.id}: ${errorMessage}`,
          );
        }
      }
    }

    this.logger.log(
      `✅ Unificación completada para RUT "${rutNormalizado}". Contacto principal: ${primaryContactId}. Exitosos: ${successCount}, Fallidos: ${failCount}`,
    );

    if (retryableFailCount > 0) {
      throw new Error(
        `Retryable merge errors for contact ${contactId}: ${lastRetryableError}`,
      );
    }
  }
}
