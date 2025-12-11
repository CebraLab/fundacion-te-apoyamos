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
}
