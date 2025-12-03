// dynamic-entity.service.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { QueueLogs } from './models/queue_logs.model';
import { CONFIG } from '../utils/config/enviroment.config';

interface QueueConfig {
  name: string;
  identifiers?: string[];
}

interface InsertLogData {
  queueName: string;
  payload?: any;
  status?: string;
  errorData?: any;
  errorStack?: string;
  messageId?: string;
  expiresAt?: Date | string | null;
  groupDate?: number | null;
}

@Injectable()
export class DynamicEntityService {
  private readonly logger = new Logger(DynamicEntityService.name);
  private readonly entityMap = new Map<string, any>();

  constructor(
    @Inject('DATABASE_CONNECTION') private readonly dataSource: DataSource,
  ) {}

  private formatDateForMysql(value?: Date | string | null): string | null {
    if (!value) {
      return null;
    }

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString().slice(0, 19).replace('T', ' ');
  }

  async onModuleInit() {
    this.logger.log('Dynamic entities initialization started');
    this.logger.log(`Queues to process:`, CONFIG.queues.rabbitmq.queues);

    // Probar la conexión a la base de datos primero
    try {
      await this.testDatabaseConnection();
    } catch (error) {
      this.logger.error('Failed to test database connection:', error);
      return; // No continuar si no hay conexión
    }

    for (const queue of CONFIG.queues.rabbitmq.queues as QueueConfig[]) {
      try {
        this.logger.log(`Processing queue: "${queue.name}"`);
        const sanitizedQueue = queue.name.replace(/_queue$/, '');
        const tableName = `${sanitizedQueue}_queue_logs`;
        this.logger.log(`Table name will be: "${tableName}"`);
        this.logger.log(
          `Identifiers for queue "${queue.name}":`,
          queue.identifiers || [],
        );

        await this.createDynamicTable(tableName, queue.identifiers || []);
        this.logger.log(
          `Dynamic table "${tableName}" created/verified successfully`,
        );
      } catch (error) {
        this.logger.error(
          `Error creating dynamic table for queue "${queue.name}": ${error.message}`,
        );
        this.logger.error(`Full error for queue "${queue.name}":`, error);
      }
    }

    this.logger.log('Dynamic entities initialization completed');
  }

  private async createDynamicTable(
    tableName: string,
    identifiers: string[],
  ): Promise<void> {
    try {
      this.logger.log(`Checking if table "${tableName}" exists...`);

      // Verificar si la tabla ya existe en MySQL
      const tableExists = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM information_schema.tables 
         WHERE table_schema = DATABASE() 
         AND table_name = ?`,
        [tableName],
      );

      this.logger.log(`Table existence check result:`, tableExists);

      if (tableExists[0]?.count === 0 || tableExists[0]?.count === '0') {
        this.logger.log(`Table "${tableName}" does not exist, creating it...`);
      } else {
        this.logger.log(
          `Table "${tableName}" already exists (count: ${tableExists[0]?.count}), dropping and recreating...`,
        );

        // Eliminar la tabla existente
        const dropTableQuery = `DROP TABLE IF EXISTS \`${tableName}\``;
        this.logger.log(`Executing DROP TABLE query:`, dropTableQuery);

        await this.dataSource.query(dropTableQuery);
        this.logger.log(`Table "${tableName}" dropped successfully`);
      }

      // Crear la tabla dinámicamente para MySQL
      const identifierColumns = identifiers
        .map((identifier) => `\`${identifier}\` VARCHAR(250)`)
        .join(',\n            ');

      const createTableQuery = `
        CREATE TABLE \`${tableName}\` (
          id VARCHAR(36) PRIMARY KEY,
          queue_name VARCHAR(250) NOT NULL,
          payload JSON,
          status VARCHAR(250),
          error_data JSON,
          error_stack TEXT,
          group_date BIGINT NULL,
          expires_at TIMESTAMP NULL,
          ${identifierColumns ? identifierColumns + ',' : ''}
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `;

      this.logger.log(`Executing CREATE TABLE query:`, createTableQuery);

      await this.dataSource.query(createTableQuery);
      this.logger.log(`Table "${tableName}" created successfully`);

      // Crear índices para mejorar el rendimiento
      await this.createTableIndexes(tableName);
    } catch (error) {
      this.logger.error(
        `Error creating table "${tableName}": ${error.message}`,
      );
      this.logger.error(`Full error:`, error);
      throw error;
    }
  }

  private async createTableIndexes(tableName: string): Promise<void> {
    try {
      // Verificar si los índices ya existen antes de crearlos (MySQL no tiene IF NOT EXISTS para índices)
      const indexExists = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM information_schema.statistics 
         WHERE table_schema = DATABASE() 
         AND table_name = ? 
         AND index_name = ?`,
        [tableName, `idx_${tableName}_queue_name`],
      );

      if (indexExists[0]?.count === 0) {
        // Índice en queue_name para búsquedas rápidas
        await this.dataSource.query(
          `CREATE INDEX idx_${tableName}_queue_name ON \`${tableName}\` (queue_name)`,
        );
      }

      const statusIndexExists = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM information_schema.statistics 
         WHERE table_schema = DATABASE() 
         AND table_name = ? 
         AND index_name = ?`,
        [tableName, `idx_${tableName}_status`],
      );

      if (statusIndexExists[0]?.count === 0) {
        // Índice en status para filtrar por estado
        await this.dataSource.query(
          `CREATE INDEX idx_${tableName}_status ON \`${tableName}\` (status)`,
        );
      }

      const createdAtIndexExists = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM information_schema.statistics 
         WHERE table_schema = DATABASE() 
         AND table_name = ? 
         AND index_name = ?`,
        [tableName, `idx_${tableName}_created_at`],
      );

      if (createdAtIndexExists[0]?.count === 0) {
        // Índice en created_at para ordenamiento temporal
        await this.dataSource.query(
          `CREATE INDEX idx_${tableName}_created_at ON \`${tableName}\` (created_at)`,
        );
      }

      this.logger.log(`Indexes created/verified for table "${tableName}"`);
    } catch (error) {
      this.logger.error(
        `Error creating indexes for table "${tableName}": ${error.message}`,
      );
    }
  }

  private async addMissingColumns(
    tableName: string,
    identifiers: string[],
  ): Promise<void> {
    try {
      this.logger.log(
        `Checking for missing columns in table "${tableName}"...`,
      );

      // Obtener las columnas existentes en la tabla
      const existingColumns = await this.dataSource.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_schema = DATABASE() 
         AND table_name = ?`,
        [tableName],
      );

      const existingColumnNames = existingColumns.map(
        (col: any) => col.column_name,
      );
      this.logger.log(`Existing columns:`, existingColumnNames);

      // Filtrar los identificadores que no existen como columnas
      const missingIdentifiers = identifiers.filter(
        (identifier) => !existingColumnNames.includes(identifier),
      );

      if (missingIdentifiers.length === 0) {
        this.logger.log(
          `All identifier columns already exist in table "${tableName}"`,
        );
        return;
      }

      this.logger.log(`Adding missing columns:`, missingIdentifiers);

      // Agregar cada columna faltante
      for (const identifier of missingIdentifiers) {
        const alterQuery = `ALTER TABLE \`${tableName}\` ADD COLUMN \`${identifier}\` VARCHAR(250)`;
        this.logger.log(`Executing ALTER TABLE query:`, alterQuery);

        await this.dataSource.query(alterQuery);
        this.logger.log(
          `Column "${identifier}" added successfully to table "${tableName}"`,
        );
      }

      this.logger.log(`All missing columns added to table "${tableName}"`);
    } catch (error) {
      this.logger.error(
        `Error adding missing columns to table "${tableName}": ${error.message}`,
      );
      throw error;
    }
  }

  public async getRepository(tableName: string) {
    // Verificar si la tabla existe antes de devolver el repositorio
    const tableExists = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM information_schema.tables 
       WHERE table_schema = DATABASE() 
       AND table_name = ?`,
      [tableName],
    );

    if (tableExists[0]?.count === 0) {
      throw new Error(`Table "${tableName}" does not exist`);
    }

    // Usar el repositorio de la entidad base pero con la tabla específica
    return this.dataSource.getRepository(QueueLogs);
  }

  public async insertLog(
    tableName: string,
    logData: InsertLogData,
  ): Promise<void> {
    try {
      // Buscar la cola en la configuración para obtener los identificadores
      const queueConfig = CONFIG.queues.rabbitmq.queues.find(
        (queue: any) =>
          `${queue.name.replace(/_queue$/, '')}_queue_logs` === tableName,
      );

      if (!queueConfig) {
        throw new Error(
          `Queue configuration not found for table "${tableName}"`,
        );
      }

      const identifiers = (queueConfig as any).identifiers || [];
      this.logger.log(
        `Found identifiers for table "${tableName}":`,
        identifiers,
      );

      // Preparar las columnas dinámicas basándose en los identificadores
      let additionalColumns = '';
      let additionalValues = '';
      let additionalParams: any[] = [];

      if (identifiers.length > 0) {
        additionalColumns = identifiers
          .map((identifier) => `\`${identifier}\``)
          .join(', ');
        additionalValues = identifiers.map(() => '?').join(', ');

        // Extraer valores de los identificadores del payload
        additionalParams = identifiers.map((identifier) => {
          if (logData.payload && typeof logData.payload === 'object') {
            return logData.payload[identifier] || null;
          }
          return null;
        });
      }

      // Si tenemos un messageId, buscar si ya existe el registro
      const existingRecord = await this.findLogByMessageId(
        tableName,
        logData.messageId || '',
      );

      if (existingRecord) {
        // Actualizar registro existente
        await this.updateExistingLog(
          tableName,
          logData,
          identifiers,
          additionalParams,
        );
        this.logger.log(
          `Log updated successfully in table "${tableName}" for messageId: ${logData.messageId}`,
        );
        return;
      }

      // Si no existe o no hay messageId, crear nuevo registro
      const insertQuery = `
        INSERT INTO \`${tableName}\` (
          id, 
          queue_name, 
          payload, 
          status, 
          error_data, 
          error_stack,
          group_date,
          expires_at
          ${additionalColumns ? ', ' + additionalColumns : ''}
        ) VALUES (
          ?, 
          ?, 
          ?, 
          ?, 
          ?, 
          ?,
          ?,
          ?
          ${additionalValues ? ', ' + additionalValues : ''}
        )
      `;

      // Preparar todos los parámetros
      const allParams = [
        logData.messageId,
        logData.queueName,
        logData.payload ? JSON.stringify(logData.payload) : null,
        logData.status || null,
        logData.errorData ? JSON.stringify(logData.errorData) : null,
        logData.errorStack || null,
        logData.groupDate ?? null,
        this.formatDateForMysql(logData.expiresAt),
        ...additionalParams,
      ];

      this.logger.log(`Executing INSERT query:`, insertQuery);
      this.logger.log(`Parameters:`, allParams);

      await this.dataSource.query(insertQuery, allParams);

      this.logger.log(
        `Log inserted successfully in table "${tableName}" for messageId: ${logData.messageId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error inserting log in table "${tableName}": ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Busca un registro de log por messageId
   */
  private async findLogByMessageId(
    tableName: string,
    messageId: string,
  ): Promise<{ id: string } | null> {
    try {
      const selectQuery = `
        SELECT id FROM \`${tableName}\` 
        WHERE id = '${messageId}' 
        LIMIT 1
      `;

      this.logger.log(
        `Searching for existing log with messageId: ${messageId}`,
      );
      const result = await this.dataSource.query(selectQuery);

      if (result && result.length > 0) {
        this.logger.log(`Found existing log with ID: ${result[0].id}`);
        return result[0];
      }

      return null;
    } catch (error) {
      this.logger.error(
        `Error searching for log with messageId ${messageId}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Actualiza un registro de log existente
   */
  private async updateExistingLog(
    tableName: string,
    logData: InsertLogData,
    identifiers: string[],
    additionalParams: any[],
  ): Promise<void> {
    try {
      // Construir la consulta UPDATE dinámicamente
      let updateColumns = `
        queue_name = ?,
        payload = ?,
        status = ?,
        error_data = ?,
        error_stack = ?,
        group_date = ?,
        expires_at = ?,
        updated_at = CURRENT_TIMESTAMP
      `;

      // Agregar columnas dinámicas si existen
      if (identifiers.length > 0) {
        const dynamicUpdates = identifiers
          .map((identifier) => `\`${identifier}\` = ?`)
          .join(', ');
        updateColumns += `, ${dynamicUpdates}`;
      }

      const updateQuery = `
        UPDATE \`${tableName}\` 
        SET ${updateColumns}
        WHERE id = '${logData.messageId}' 
      `;

      // Preparar todos los parámetros para UPDATE
      const updateParams = [
        logData.queueName,
        logData.payload ? JSON.stringify(logData.payload) : null,
        logData.status || null,
        logData.errorData ? JSON.stringify(logData.errorData) : null,
        logData.errorStack || null,
        logData.groupDate ?? null,
        this.formatDateForMysql(logData.expiresAt),
        ...additionalParams,
      ];

      this.logger.log(`Executing UPDATE query:`, updateQuery);
      this.logger.log(`Update parameters:`, updateParams);

      const result = await this.dataSource.query(updateQuery, updateParams);

      if (result.affectedRows === 0) {
        this.logger.warn(
          `No rows were updated for messageId: ${logData.messageId}`,
        );
      } else {
        this.logger.log(`Successfully updated ${result.affectedRows} row(s)`);
      }
    } catch (error) {
      this.logger.error(
        `Error updating log for messageId ${logData.messageId}: ${error.message}`,
      );
      throw error;
    }
  }

  public async getLogs(
    tableName: string,
    options: {
      limit?: number;
      offset?: number;
      status?: string;
      queue_name?: string;
    } = {},
  ): Promise<any[]> {
    try {
      let whereClause = '';
      const params: any[] = [];

      if (options.status) {
        whereClause += ` WHERE status = ?`;
        params.push(options.status);
      }

      if (options.queue_name) {
        const operator = whereClause ? 'AND' : 'WHERE';
        whereClause += ` ${operator} queue_name = ?`;
        params.push(options.queue_name);
      }

      const query = `
        SELECT * FROM \`${tableName}\`
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;

      const limit = options.limit || 100;
      const offset = options.offset || 0;
      params.push(limit, offset);

      const result = await this.dataSource.query(query, params);
      return result;
    } catch (error) {
      this.logger.error(
        `Error getting logs from table "${tableName}": ${error.message}`,
      );
      throw error;
    }
  }

  public async getTableInfo(tableName: string): Promise<any> {
    try {
      const result = await this.dataSource.query(
        `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_schema = DATABASE() 
        AND table_name = ?
        ORDER BY ordinal_position
      `,
        [tableName],
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Error getting table info for "${tableName}": ${error.message}`,
      );
      throw error;
    }
  }

  // Método de prueba para verificar la conexión a la base de datos
  public async testDatabaseConnection(): Promise<void> {
    try {
      this.logger.log('Testing database connection...');

      // Probar una consulta simple
      const result = await this.dataSource.query('SELECT 1 as test');
      this.logger.log('Database connection test result:', result);

      // Probar obtener el nombre de la base de datos actual
      const dbResult = await this.dataSource.query(
        'SELECT DATABASE() as current_db',
      );
      this.logger.log('Current database:', dbResult);

      // Probar obtener información del esquema
      const schemaResult = await this.dataSource.query(
        'SELECT SCHEMA() as current_schema',
      );
      this.logger.log('Current schema:', schemaResult);

      this.logger.log('Database connection test completed successfully');
    } catch (error) {
      this.logger.error('Database connection test failed:', error);
      throw error;
    }
  }
}
