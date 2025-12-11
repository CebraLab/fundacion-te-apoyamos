import { Injectable, Logger } from '@nestjs/common';
import { AxiosInstance } from 'axios';
import { INTEGRATION } from '../utils/config/integration.config';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  readonly apiHubspotV3: AxiosInstance;

  constructor() {
    this.apiHubspotV3 = INTEGRATION.hubspot.apiV3;
  }

  /**
   * Buscar contacto por ID de HubSpot
   */
  async getById(contactId: string, properties?: string[]) {
    try {
      // Si se especifican propiedades, incluirlas en la query
      const propertiesParam = properties
        ? `?properties=${properties.join(',')}`
        : '';
      const response = await this.apiHubspotV3.get(
        `/objects/contacts/${contactId}${propertiesParam}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Error getting contact by ID: ${error.message}`);
      throw error;
    }
  }

  /**
   * Actualizar propiedades de un contacto
   */
  async update(contactId: string, properties: any) {
    try {
      const response = await this.apiHubspotV3.patch(
        `/objects/contacts/${contactId}`,
        {
          properties,
        },
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Error updating contact: ${error.message}`);
      throw error;
    }
  }

  /**
   * Buscar contactos por RUT usando la API de búsqueda de HubSpot
   * Busca por rut_formateado (RUT normalizado sin puntos ni guiones)
   * Ordena por createdate ASCENDING para obtener el contacto más antiguo primero
   */
  async searchContactsByRut(
    rut: string,
    properties: string[] = ['rut', 'rut_formateado'],
  ) {
    try {
      const response = await this.apiHubspotV3.post(
        `/objects/contacts/search`,
        {
          properties,
          sorts: [
            {
              propertyName: 'createdate',
              direction: 'ASCENDING',
            },
          ],
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'rut_formateado',
                  value: rut,
                  operator: 'EQ',
                },
              ],
            },
          ],
        },
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Error searching contacts by RUT: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mergear contactos en HubSpot
   * El contacto primaryContactId será el contacto principal (se mantiene)
   * El contacto contactIdToMerge será mergeado y eliminado
   */
  async mergeContacts(primaryContactId: string, contactIdToMerge: string) {
    try {
      this.logger.log(
        `Merging contact ${contactIdToMerge} into ${primaryContactId}`,
      );
      const response = await this.apiHubspotV3.post(`/objects/contacts/merge`, {
        primaryObjectId: primaryContactId,
        objectIdToMerge: contactIdToMerge,
      });
      this.logger.log(
        `Successfully merged contact ${contactIdToMerge} into ${primaryContactId}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Error merging contacts ${contactIdToMerge} into ${primaryContactId}: ${error.message}`,
      );
      throw error;
    }
  }
}
