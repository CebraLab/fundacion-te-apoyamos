import { Injectable, Logger } from '@nestjs/common';
import { AxiosInstance } from 'axios';
import { INTEGRATION } from '../utils/config/integration.config';

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);

  readonly apiHubspotV3: AxiosInstance;

  constructor() {
    this.apiHubspotV3 = INTEGRATION.hubspot.apiV3;
  }

  /**
   * Buscar empresa por ID de HubSpot
   */
  async getById(companyId: string, properties?: string[]) {
    try {
      const propertiesParam = properties
        ? `?properties=${properties.join(',')}`
        : '';
      const response = await this.apiHubspotV3.get(
        `/objects/companies/${companyId}${propertiesParam}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Error getting company by ID: ${error.message}`);
      throw error;
    }
  }

  /**
   * Actualizar propiedades de una empresa
   */
  async update(companyId: string, properties: any) {
    try {
      const response = await this.apiHubspotV3.patch(
        `/objects/companies/${companyId}`,
        {
          properties,
        },
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Error updating company: ${error.message}`);
      throw error;
    }
  }

  /**
   * Buscar empresas por RUT usando la API de búsqueda de HubSpot
   * Busca por rut_formateado Y por rut original (para empresas que aún no tienen rut_formateado)
   * Ordena por createdate ASCENDING
   */
  async searchCompaniesByRut(
    rut: string,
    properties: string[] = ['rut', 'rut_formateado'],
  ) {
    const response = await this.apiHubspotV3.post(`/objects/companies/search`, {
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
        {
          filters: [
            {
              propertyName: 'rut',
              value: rut,
              operator: 'CONTAINS_TOKEN',
            },
          ],
        },
      ],
    });
    return response.data;
  }

  /**
   * Mergear empresas en HubSpot
   */
  async mergeCompanies(primaryCompanyId: string, companyIdToMerge: string) {
    const response = await this.apiHubspotV3.post(`/objects/companies/merge`, {
      primaryObjectId: primaryCompanyId,
      objectIdToMerge: companyIdToMerge,
    });
    return response.data;
  }
}
