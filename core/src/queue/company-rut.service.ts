import { Injectable, Logger } from '@nestjs/common';
import { CompanyService } from '../hubspot/company.service';
import { RutFormatter } from '../hubspot/utils/rut-formatter.util';

@Injectable()
export class CompanyRutService {
  private readonly logger = new Logger(CompanyRutService.name);

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

    const company = await this.companyService.getById(companyId, ['rut']);
    if (!company?.properties?.rut) {
      return;
    }

    const rutOriginal = company.properties.rut;
    const rutNormalizado = RutFormatter.formatRut(rutOriginal);

    this.logger.log(
      `Empresa ${companyId} - RUT: "${rutOriginal}" (normalizado: "${rutNormalizado}")`,
    );

    // Asegurarse de que la empresa actual tenga rut_formateado guardado
    const companyWithFormatted = await this.companyService.getById(companyId, [
      'rut',
      'rut_formateado',
    ]);
    if (
      !companyWithFormatted?.properties?.rut_formateado ||
      companyWithFormatted.properties.rut_formateado !== rutNormalizado
    ) {
      await this.companyService.update(companyId, {
        rut_formateado: rutNormalizado,
      });
      this.logger.log(
        `   Actualizado rut_formateado para empresa ${companyId}: "${rutOriginal}" -> "${rutNormalizado}"`,
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    // Buscar empresas con el mismo RUT (con reintentos para indexación)
    // HubSpot necesita tiempo para indexar el cambio de rut_formateado
    // Busca tanto por rut_formateado como por rut original
    let companies = { results: [] as any[] };
    let retries = 10;

    while (retries > 0) {
      const searchResult = await this.companyService.searchCompaniesByRut(
        rutNormalizado,
        ['rut', 'rut_formateado', 'createdate'],
      );

      const foundCompanies = searchResult?.results || [];

      // Filtrar por RUT normalizado (puede haber falsos positivos con CONTAINS)
      const companiesWithSameRut = foundCompanies.filter((c) => {
        const companyRut = c.properties?.rut;
        if (!companyRut) return false;
        return RutFormatter.formatRut(companyRut) === rutNormalizado;
      });

      // Si encuentra más de 1 empresa, hay duplicados
      if (companiesWithSameRut.length > 1) {
        companies.results = companiesWithSameRut;
        this.logger.log(
          `✅ Búsqueda exitosa en intento ${11 - retries}: encontradas ${companiesWithSameRut.length} empresa(s) con RUT "${rutNormalizado}"`,
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
        `⚠️ No se encontraron duplicados después de 10 intentos para RUT "${rutNormalizado}"`,
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

    this.logger.log(
      `🔗 Empresa ${companyId} tiene el mismo RUT "${rutNormalizado}" que ${uniqueCompanies.length - 1} otra(s) empresa(s). Se procede a unificar.`,
    );
    this.logger.log(
      `   Empresa principal (más antigua): ${primaryCompany.id}. Empresas a unificar: ${companiesToMerge.map((c) => c.id).join(', ')}`,
    );

    let successCount = 0;
    let failCount = 0;

    for (const companyToMerge of companiesToMerge) {
      try {
        await this.companyService.mergeCompanies(
          primaryCompany.id,
          companyToMerge.id,
        );
        successCount++;
        this.logger.log(
          `   ✅ Empresa ${companyToMerge.id} unificada exitosamente en ${primaryCompany.id}`,
        );
      } catch (error: any) {
        failCount++;
        if (error.response?.status === 400) {
          this.logger.warn(
            `   ⚠️ Empresa ${companyToMerge.id} no pudo ser unificada: ${error.response?.data?.message || error.message}`,
          );
        } else {
          this.logger.error(
            `   ❌ Error al unificar empresa ${companyToMerge.id}: ${error.message}`,
          );
        }
      }
    }

    this.logger.log(
      `✅ Unificación completada para RUT "${rutNormalizado}". Empresa principal: ${primaryCompany.id}. Exitosas: ${successCount}, Fallidas: ${failCount}`,
    );
  }
}
