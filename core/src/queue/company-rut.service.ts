import { Injectable, Logger } from '@nestjs/common';
import { CompanyService } from '../hubspot/company.service';
import { RutFormatter } from '../hubspot/utils/rut-formatter.util';

@Injectable()
export class CompanyRutService {
  private readonly logger = new Logger(CompanyRutService.name);

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

  constructor(private readonly companyService: CompanyService) {}

  /**
   * Unifica empresas duplicadas basándose en el RUT
   * Sigue el mismo patrón que la unificación de contactos
   */
  async unificarRut(message: any): Promise<void> {
    const companyId = message.payload?.objectId;
    if (!companyId) {
      return;
    }

    const company = await this.companyService.getById(companyId, [
      'rut_entidad',
    ]);
    if (!company?.properties?.rut_entidad) {
      return;
    }

    const rutOriginal = company.properties.rut_entidad;
    const rutNormalizado = RutFormatter.formatRut(rutOriginal);

    this.logger.log(
      `Empresa ${companyId} - RUT: "${rutOriginal}" (normalizado: "${rutNormalizado}")`,
    );

    // Asegurarse de que la empresa actual tenga rut_entidad_formateado guardado
    const companyWithFormatted = await this.companyService.getById(companyId, [
      'rut_entidad',
      'rut_entidad_formateado',
    ]);
    if (
      !companyWithFormatted?.properties?.rut_entidad_formateado ||
      companyWithFormatted.properties.rut_entidad_formateado !== rutNormalizado
    ) {
      await this.companyService.update(companyId, {
        rut_entidad_formateado: rutNormalizado,
      });
      this.logger.log(
        `   Actualizado rut_entidad_formateado para empresa ${companyId}: "${rutOriginal}" -> "${rutNormalizado}"`,
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    // Buscar empresas con el mismo RUT (con reintentos para indexación)
    // HubSpot necesita tiempo para indexar el cambio de rut_entidad_formateado
    // Busca tanto por rut_entidad_formateado como por rut_entidad
    let companies = { results: [] as any[] };
    let retries = 2;

    while (retries > 0) {
      const searchResult = await this.companyService.searchCompaniesByRutAll(
        rutNormalizado,
        ['rut_entidad', 'rut_entidad_formateado', 'createdate'],
      );

      const foundCompanies = searchResult?.results || [];
      if (searchResult?.capped) {
        this.logger.warn(
          `⚠️ Búsqueda paginada alcanzó el límite de páginas para RUT "${rutNormalizado}". Resultados parciales: ${foundCompanies.length}`,
        );
      }

      // Filtrar por RUT normalizado (puede haber falsos positivos con CONTAINS)
      const companiesWithSameRut = foundCompanies.filter((c) => {
        const companyRut = c.properties?.rut_entidad;
        if (!companyRut) return false;
        return RutFormatter.formatRut(companyRut) === rutNormalizado;
      });

      // Si encuentra más de 1 empresa, hay duplicados
      if (companiesWithSameRut.length > 1) {
        companies.results = companiesWithSameRut;
        this.logger.log(
          `✅ Búsqueda exitosa en intento ${3 - retries}: encontradas ${companiesWithSameRut.length} empresa(s) con RUT "${rutNormalizado}"`,
        );
        break;
      }

      if (retries > 1) {
        this.logger.debug(
          `⏳ Reintentando búsqueda de empresas con RUT "${rutNormalizado}" (encontradas: ${companiesWithSameRut.length}, intentos restantes: ${retries - 1})...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 8000));
      }
      retries--;
    }

    if (retries === 0) {
      this.logger.log(
        `⚠️ No se encontraron duplicados después de 3 intentos para RUT "${rutNormalizado}"`,
      );
    }

    // Eliminar duplicados
    const uniqueCompanies = (companies.results || []).filter(
      (company, index, self) =>
        index === self.findIndex((c) => c.id === company.id),
    );

    if (uniqueCompanies.length <= 1) {
      this.logger.log(
        `Empresa ${companyId} - RUT "${rutNormalizado}" es única, no hay duplicados para unificar`,
      );
      return;
    }

    // Tomar el primero como primary (ya está ordenado por createdate ASC) y mergear el resto
    const [primaryCompany, ...companiesToMerge] = uniqueCompanies;
    let primaryCompanyId = primaryCompany.id;

    this.logger.log(
      `🔗 Empresa ${companyId} tiene el mismo RUT "${rutNormalizado}" que ${uniqueCompanies.length - 1} otra(s) empresa(s). Se procede a unificar.`,
    );
    this.logger.log(
      `   Empresa principal (más antigua): ${primaryCompanyId}. Empresas a unificar: ${companiesToMerge.map((c) => c.id).join(', ')}`,
    );

    let successCount = 0;
    let failCount = 0;
    let retryableFailCount = 0;
    let lastRetryableError = '';

    for (const companyToMerge of companiesToMerge) {
      try {
        await this.companyService.mergeCompanies(
          primaryCompanyId,
          companyToMerge.id,
        );
        successCount++;
        this.logger.log(
          `   ✅ Empresa ${companyToMerge.id} unificada exitosamente en ${primaryCompanyId}`,
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
          if (canonicalId !== primaryCompanyId) {
            this.logger.warn(
              `   ⚠️ Empresa principal ${primaryCompanyId} no es canonical. Reintentando con canonical ${canonicalId}...`,
            );
            primaryCompanyId = canonicalId;
            try {
              await this.companyService.mergeCompanies(
                primaryCompanyId,
                companyToMerge.id,
              );
              successCount++;
              this.logger.log(
                `   ✅ Empresa ${companyToMerge.id} unificada exitosamente en ${primaryCompanyId}`,
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
                `   ⚠️ Empresa ${companyToMerge.id} no pudo ser unificada tras reintento: ${retryMessage}`,
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
        if (status === 400) {
          this.logger.warn(
            `   ⚠️ Empresa ${companyToMerge.id} no pudo ser unificada: ${errorMessage}`,
          );
        } else {
          this.logger.error(
            `   ❌ Error al unificar empresa ${companyToMerge.id}: ${errorMessage}`,
          );
        }
      }
    }

    this.logger.log(
      `✅ Unificación completada para RUT "${rutNormalizado}". Empresa principal: ${primaryCompanyId}. Exitosas: ${successCount}, Fallidas: ${failCount}`,
    );

    if (retryableFailCount > 0) {
      throw new Error(
        `Retryable merge errors for company ${companyId}: ${lastRetryableError}`,
      );
    }
  }
}
