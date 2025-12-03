import { Injectable } from '@nestjs/common';
import { CONFIG } from '../utils/config/enviroment.config';
import { IPaginationOptions } from 'nestjs-typeorm-paginate';
import { EntityManager } from 'typeorm';
import { UserType } from '../auth/models/user.model';

@Injectable()
export class ClientService {
  constructor(private readonly entityManager: EntityManager) {}

  getQueues(user_type?: UserType) {
    const routerQueues = CONFIG.queues.rabbitmq.queues.map((queue: any) => ({
      title: queue.description || queue.name,
      to: 'queue',
      queueName: queue.name,
    }));

    const aditionalRouters: any[] = [];

    if (user_type && user_type === UserType.ADMIN) {
      aditionalRouters.push({
        title: 'Settings',
        to: 'admin',
        queueName: '',
      });
    }

    return { routerQueues, aditionalRouters };
  }

  async getQueueListPaginated(
    queueName: string,
    options: IPaginationOptions,
    otherOptions: any,
  ) {
    const tableName = `${queueName}_queue_logs`;

    // Extraer parámetros de paginación
    const page: number = Number(options.page) || 1;
    const limit: number = Number(options.limit) || 10;
    const offset = (page - 1) * limit;

    try {
      const queueAditionalColumns =
        (CONFIG.queues.rabbitmq.queues as any[]).find(
          (queue: any) => queue.name === queueName,
        )?.identifiers || [];

      // Construir columnas adicionales para el SELECT
      const additionalColumnsSelect = queueAditionalColumns
        .map((column: string) => `\`${column}\``)
        .join(', ');

      // Construir columnas adicionales para el WHERE (filtrado)
      const additionalColumnsWhere = queueAditionalColumns
        .map((column: string) => `\`${column}\` LIKE ?`)
        .join(' OR ');

      // Construir condiciones de filtrado
      const filterConditions: any[] = [];
      const filterParams: any[] = [];

      if (otherOptions.filter) {
        const filterValue = `%${otherOptions.filter}%`;

        // Filtrar por id
        filterConditions.push('`id` LIKE ?');
        filterParams.push(filterValue);

        // Filtrar por columnas adicionales si existen
        if (additionalColumnsWhere) {
          filterConditions.push(`(${additionalColumnsWhere})`);
          // Agregar el parámetro de filtro para cada columna adicional
          queueAditionalColumns.forEach(() => filterParams.push(filterValue));
        }
      }

      // Construir WHERE clause
      const whereClause =
        filterConditions.length > 0
          ? `WHERE ${filterConditions.join(' OR ')}`
          : '';

      let aditionalWhereClause = '';
      if (otherOptions.statuses.length > 0) {
        aditionalWhereClause = `${filterConditions.length > 0 ? 'AND' : 'WHERE'} status IN ('${otherOptions.statuses.join("','")}')`;
      }

      // Construir ORDER BY clause
      let orderByClause = 'ORDER BY created_at DESC'; // Default
      if (otherOptions.sortBy) {
        const sortDirection = otherOptions.descending === true ? 'DESC' : 'ASC';
        orderByClause = `ORDER BY \`${otherOptions.sortBy}\` ${sortDirection}`;
      }

      // Consulta para obtener el total de registros (con filtros)
      const totalItemsQuery = `
        SELECT COUNT(*) as total 
        FROM \`${tableName}\`
        ${whereClause}
        ${aditionalWhereClause}
      `;

      const totalItemsResult = await this.entityManager.query(
        totalItemsQuery,
        filterParams,
      );
      const totalItems: number = Number(totalItemsResult[0]?.total) || 0;

      // Consulta para obtener los registros paginados
      const itemsQuery = `
        SELECT 
          id,
          queue_name,
          payload,
          status,
          error_data,
          error_stack,
          created_at,
          updated_at
          ${additionalColumnsSelect ? ', ' + additionalColumnsSelect : ''}
        FROM \`${tableName}\`
        ${whereClause}
        ${aditionalWhereClause}
        ${orderByClause}
        LIMIT ? OFFSET ?
      `;

      // Combinar parámetros: filtros + paginación
      const queryParams = [...filterParams, limit, offset];
      const items = await this.entityManager.query(itemsQuery, queryParams);

      // Calcular metadatos de paginación
      const totalPages = Math.ceil(totalItems / limit);
      const itemCount = items.length;

      // Estructura de respuesta con las propiedades solicitadas
      return {
        meta: {
          itemCount,
          totalItems,
          itemsPerPage: limit,
          totalPages,
          currentPage: page,
        },
        items,
      };
    } catch (error) {
      console.error(`Error querying table ${tableName}:`, error);
      throw new Error(`Failed to fetch paginated data from ${tableName}`);
    }
  }

  async getQueueStats(queueName: string, period: string, timezone: string) {
    const tableName = `${queueName}_queue_logs`;

    try {
      // Convertir timezone a formato MySQL (ej: '-5' -> '-05:00')
      const timezoneOffset =
        timezone.startsWith('-') || timezone.startsWith('+')
          ? timezone
          : `+${timezone}`;

      // Formatear correctamente el timezone
      let mysqlTimezone: string;
      if (timezoneOffset.startsWith('-')) {
        const absValue = timezoneOffset.substring(1);
        mysqlTimezone = `-${absValue.padStart(2, '0')}:00`;
      } else {
        const absValue = timezoneOffset.substring(1);
        mysqlTimezone = `+${absValue.padStart(2, '0')}:00`;
      }

      // Determinar el formato de agrupación según el período usando UNIX_TIMESTAMP
      let timeFormat: string;

      switch (period.toLowerCase()) {
        case 'minute':
          timeFormat =
            'FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(CONVERT_TZ(updated_at, "+00:00", "' +
            mysqlTimezone +
            '")) / 60) * 60)';
          break;
        case 'hour':
          timeFormat =
            'FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(CONVERT_TZ(updated_at, "+00:00", "' +
            mysqlTimezone +
            '")) / 3600) * 3600)';
          break;
        case 'day':
          timeFormat =
            'FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(CONVERT_TZ(updated_at, "+00:00", "' +
            mysqlTimezone +
            '")) / 86400) * 86400)';
          break;
        case 'week':
          timeFormat =
            'FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(CONVERT_TZ(updated_at, "+00:00", "' +
            mysqlTimezone +
            '")) / 604800) * 604800)';
          break;
        default:
          timeFormat =
            'FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(CONVERT_TZ(updated_at, "+00:00", "' +
            mysqlTimezone +
            '")) / 3600) * 3600)'; // Default a hora
      }

      // Consulta para obtener estadísticas agrupadas por tiempo
      const statsQuery =
        'SELECT ' +
        timeFormat +
        ' as timeGroup, ' +
        "SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as success, " +
        "SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed, " +
        "SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending " +
        'FROM `' +
        tableName +
        '` ' +
        'WHERE updated_at IS NOT NULL ' +
        'GROUP BY timeGroup ' +
        'ORDER BY timeGroup ASC';

      const statsResult = await this.entityManager.query(statsQuery);

      // Consulta para obtener totales generales
      const summaryQuery = `
        SELECT 
          SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as totalSuccess,
          SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as totalErrors,
          SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as totalPending,
          COUNT(*) as totalMessages
        FROM \`${tableName}\`
      `;

      const summaryResult = await this.entityManager.query(summaryQuery);
      const summary = summaryResult[0];

      // Calcular success rate
      const totalMessages = summary.totalMessages || 0;
      const successRate =
        totalMessages > 0
          ? Math.round((summary.totalSuccess / totalMessages) * 100)
          : 0;

      // Formatear datos para la respuesta
      const data = statsResult.map((row: any) => ({
        x: new Date(row.timeGroup).getTime(),
        success: Number(row.success),
        failed: Number(row.failed),
        pending: Number(row.pending),
      }));

      return {
        data,
        summary: {
          totalSuccess: Number(summary.totalSuccess) || 0,
          totalErrors: Number(summary.totalErrors) || 0,
          totalPending: Number(summary.totalPending) || 0,
          successRate,
        },
      };
    } catch (error) {
      console.error(`Error getting stats for table ${tableName}:`, error);
      throw new Error(`Failed to fetch statistics from ${tableName}`);
    }
  }

  async getQueueProcessing(queueName: string) {
    const tableName = `${queueName}_queue_logs`;
    const queueAditionalColumns =
      (CONFIG.queues.rabbitmq.queues as any[]).find(
        (queue: any) => queue.name === queueName,
      )?.identifiers || [];

    // Construir columnas adicionales para el SELECT
    const additionalColumnsSelect = queueAditionalColumns
      .map((column: string) => `\`${column}\``)
      .join(', ');
    const query = `SELECT 
        id,
        queue_name,
        payload,
        status,
        error_data,
        error_stack,
        created_at,
        updated_at
        ${additionalColumnsSelect ? ', ' + additionalColumnsSelect : ''}
      FROM \`${tableName}\` WHERE status = 'PROCESSING'
      ORDER BY updated_at DESC
    `;
    const result = await this.entityManager.query(query);
    return result;
  }
}
