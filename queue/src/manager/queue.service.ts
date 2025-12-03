/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import * as amqp from 'amqplib';
import { CONFIG } from '../utils/config/enviroment.config';
import { v4 as uuidv4 } from 'uuid';
import { QueueStatus } from './models/queue_logs.model';
import { DynamicEntityService } from './dynamic_entity.service';

interface QueueMessage {
  id: string;
  correlationId: string;
  payload: any;
  queueName: string;
  status: QueueStatus;
  retryCount: number;
  maxRetries: number;
  expiration?: number;
  expiresAt?: Date;
  groupDate?: number | null;
  errorData?: any;
  errorStack?: string;
  createdAt: Date;
  processedAt?: Date;
}

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;

  constructor(private readonly dynamicEntityService: DynamicEntityService) {}

  async onModuleInit() {
    this.logger.log('QueueService initializing...');

    try {
      // Establecer conexión con RabbitMQ
      await this.connectToRabbitMQ();

      // Esperar un poco para que la conexión esté estable
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const failedQueues: string[] = [];

      // Crear todas las colas según la configuración
      for (const queue of CONFIG.queues.rabbitmq.queues) {
        let retryCount = 0;
        const maxRetries = 3;
        let success = false;

        while (retryCount < maxRetries && !success) {
          try {
            const queueName = `${queue.name.replace(/_queue$/, '')}_queue`;
            this.logger.log(
              `Setting up queues for "${queueName}" (attempt ${retryCount + 1}/${maxRetries})`,
            );

            // Crear todas las colas necesarias
            await this.createAllQueuesForQueue(queueName);

            this.logger.log(
              `✅ All queues for "${queueName}" created successfully`,
            );
            success = true;
          } catch (error) {
            retryCount++;
            this.logger.error(
              `❌ Error creating queues for "${queue.name}" (attempt ${retryCount}/${maxRetries}): ${error.message}`,
            );

            if (retryCount < maxRetries) {
              this.logger.log(`⏳ Retrying in 2 seconds...`);
              await new Promise((resolve) => setTimeout(resolve, 2000));
            } else {
              this.logger.error(
                `💥 Failed to create queues for "${queue.name}" after ${maxRetries} attempts`,
              );
              failedQueues.push(queue.name);
            }
          }
        }
      }

      if (failedQueues.length > 0) {
        this.logger.error(
          `❌ Failed to create the following queues: ${failedQueues.join(', ')}`,
        );
        throw new Error(`Failed to create queues: ${failedQueues.join(', ')}`);
      } else {
        this.logger.log('🎉 All queues created successfully');
      }
    } catch (error) {
      this.logger.error(`Failed to initialize QueueService: ${error.message}`);
      throw error;
    }
  }

  async onModuleDestroy() {
    this.logger.log('QueueService shutting down...');
    await this.closeConnection();
  }

  private async connectToRabbitMQ(): Promise<void> {
    try {
      const username = CONFIG.queues.rabbitmq.username;
      const password = CONFIG.queues.rabbitmq.password;
      const hostname = CONFIG.queues.rabbitmq.host || 'localhost';
      const port = CONFIG.queues.rabbitmq.port || 5672;

      if (!username || !password) {
        throw new Error('RabbitMQ credentials not configured');
      }

      const connectionString = `amqp://${username}:${password}@${hostname}:${port}`;

      this.logger.log(`Connecting to RabbitMQ at ${hostname}:${port}...`);

      this.connection = await amqp.connect(connectionString);
      this.channel = await this.connection.createChannel();

      // Configurar eventos de conexión
      this.connection.on('error', (error) => {
        this.logger.error(`RabbitMQ connection error: ${error.message}`);
      });

      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed');
      });

      this.channel.on('error', (error) => {
        this.logger.error(`RabbitMQ channel error: ${error.message}`);
      });

      this.logger.log('✅ Connected to RabbitMQ successfully');
    } catch (error) {
      this.logger.error(`Failed to connect to RabbitMQ: ${error.message}`);
      throw error;
    }
  }

  private async closeConnection(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      this.logger.log('RabbitMQ connection closed');
    } catch (error) {
      this.logger.error(`Error closing RabbitMQ connection: ${error.message}`);
    }
  }

  private async createAllQueuesForQueue(queueName: string): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not available');
    }

    try {
      this.logger.log(`Creating all queues for "${queueName}"...`);

      // Crear colas auxiliares primero
      await this.createDeadLetterQueue(queueName);
      await this.createSuccessQueue(queueName);
      await this.createProcessingQueue(queueName);

      // Crear cola principal al final
      await this.createMainQueue(queueName);

      this.logger.log(`✅ All queues for "${queueName}" created successfully`);
    } catch (error) {
      this.logger.error(
        `Error creating queues for "${queueName}": ${error.message}`,
      );
      throw error;
    }
  }

  private async createMainQueue(queueName: string): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not available');
    }

    try {
      this.logger.log(`Creating main queue "${queueName}"...`);

      await this.channel.assertQueue(queueName, {
        durable: true,
        autoDelete: false,
        arguments: {
          'x-max-priority': 10,
          'x-max-retries': 3,
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': `${queueName}_dlq`,
        },
      });

      this.logger.log(`✅ Main queue "${queueName}" created successfully`);
    } catch (error) {
      this.logger.error(
        `Error creating main queue "${queueName}": ${error.message}`,
      );
      throw error;
    }
  }

  private async createDeadLetterQueue(queueName: string): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not available');
    }

    try {
      const dlqName = `${queueName}_dlq`;
      this.logger.log(`Creating dead letter queue "${dlqName}"...`);

      await this.channel.assertQueue(dlqName, {
        durable: true,
        autoDelete: false,
        arguments: {
          'x-max-priority': 10,
        },
      });

      this.logger.log(`✅ Dead letter queue "${dlqName}" created successfully`);
    } catch (error) {
      this.logger.error(
        `Error creating dead letter queue for "${queueName}": ${error.message}`,
      );
      throw error;
    }
  }

  private async createSuccessQueue(queueName: string): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not available');
    }

    try {
      const successQueueName = `${queueName}_success`;
      this.logger.log(`Creating success queue "${successQueueName}"...`);

      await this.channel.assertQueue(successQueueName, {
        durable: true,
        autoDelete: false,
        arguments: {
          'x-max-priority': 10,
        },
      });

      this.logger.log(
        `✅ Success queue "${successQueueName}" created successfully`,
      );
    } catch (error) {
      this.logger.error(
        `Error creating success queue for "${queueName}": ${error.message}`,
      );
      throw error;
    }
  }

  private async createProcessingQueue(queueName: string): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not available');
    }

    try {
      const processingQueueName = `${queueName}_processing`;
      this.logger.log(`Creating processing queue "${processingQueueName}"...`);

      await this.channel.assertQueue(processingQueueName, {
        durable: true,
        autoDelete: false,
        arguments: {
          'x-max-priority': 10,
        },
      });

      this.logger.log(
        `✅ Processing queue "${processingQueueName}" created successfully`,
      );
    } catch (error) {
      this.logger.error(
        `Error creating processing queue for "${queueName}": ${error.message}`,
      );
      throw error;
    }
  }

  async sendToQueue(
    queueName: string,
    items: any[],
    expiration?: number,
    groupDate?: number | null,
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not available');
    }

    for (const item of items) {
      const messageId = uuidv4();
      const correlationId = uuidv4();
      const expirationDays = expiration ?? 1;
      const expirationMs = 60000 * 60 * 24 * expirationDays;
      const expiresAt = new Date(Date.now() + expirationMs);

      const message: QueueMessage = {
        id: messageId,
        correlationId,
        payload: item,
        queueName,
        status: QueueStatus.PENDING,
        retryCount: 0,
        maxRetries: 3,
        expiration: expirationDays,
        expiresAt,
        groupDate: groupDate ?? null,
        createdAt: new Date(),
      };

      await this.sendMessageToQueue(message);
    }
  }

  private async sendMessageToQueue(message: QueueMessage): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not available');
    }

    try {
      const messageBuffer = Buffer.from(JSON.stringify(message));
      const expirationDays = message.expiration ?? 1;
      const expirationMs = 60000 * 60 * 24 * expirationDays;

      const published = this.channel.publish(
        '',
        message.queueName,
        messageBuffer,
        {
          persistent: true,
          priority: 5,
          correlationId: message.correlationId,
          messageId: message.id,
          headers: {
            'x-retry-count': message.retryCount,
            'x-max-retries': message.maxRetries,
            'x-first-death-queue': message.queueName,
            'x-first-death-reason': 'rejected',
          },
          expiration: String(expirationMs), // TTL en milisegundos
        },
      );

      if (!published) {
        throw new Error('Failed to publish message to queue');
      }

      await this.updateMessageStatus(message);
      this.logger.log(`Message sent to queue: ${message.id}`);
    } catch (error) {
      this.logger.error(
        `Error sending message to queue: ${message.id}`,
        error.message,
      );

      if (message.retryCount < message.maxRetries) {
        await this.retryMessage(message);
      } else {
        await this.updateMessageStatus(
          message,
          { message: error.message },
          error.stack,
        );
        await this.moveToDeadLetterQueue(message);
      }
    }
  }

  private async retryMessage(message: QueueMessage): Promise<void> {
    message.retryCount++;
    message.status = QueueStatus.PENDING;

    this.logger.log(
      `Retrying message ${message.id}, attempt ${message.retryCount}`,
    );

    if (message.retryCount <= message.maxRetries) {
      // Reenviar el mensaje con el nuevo contador de reintentos
      await this.sendMessageToQueue(message);
    } else {
      this.logger.log(
        `Message ${message.id} exceeded max retries (${message.maxRetries}), moving to DLQ`,
      );
      await this.moveToDeadLetterQueue(message);
    }
  }

  private async moveToDeadLetterQueue(message: QueueMessage): Promise<void> {
    if (!this.channel) {
      this.logger.error('Cannot move to DLQ: RabbitMQ channel not available');
      return;
    }

    try {
      const dlqName = `${message.queueName}_dlq`;

      // Asegurar que la DLQ existe
      await this.createDeadLetterQueue(message.queueName);

      const dlqMessage = {
        ...message,
        originalMessageId: message.id,
        movedToDLQAt: new Date(),
        failureReason: 'Max retries exceeded',
      };

      const messageBuffer = Buffer.from(JSON.stringify(dlqMessage));

      const published = this.channel.publish('', dlqName, messageBuffer, {
        persistent: true,
        priority: 1, // Prioridad baja para mensajes fallidos
        correlationId: message.correlationId,
        messageId: `${message.id}_dlq`,
        headers: {
          'x-original-queue': message.queueName,
          'x-retry-count': message.retryCount,
          'x-max-retries': message.maxRetries,
          'x-failure-reason': 'max_retries_exceeded',
          'x-failure-timestamp': new Date().toISOString(),
        },
      });

      if (!published) {
        throw new Error('Failed to publish message to DLQ');
      }

      this.logger.log(`Message ${message.id} moved to DLQ ${dlqName}`);
    } catch (error) {
      this.logger.error(
        `Failed to move message ${message.id} to DLQ:`,
        error.message,
      );
    }
  }

  private async updateMessageStatus(
    message: QueueMessage,
    errorData?: any,
    errorStack?: any,
  ): Promise<void> {
    try {
      await this.saveMessageToDatabase(message, errorData, errorStack);
    } catch (error) {
      this.logger.error(`Failed to update message status: ${error.message}`);
      throw error;
    }
  }

  private async saveMessageToDatabase(
    message: QueueMessage,
    errorData?: any,
    errorStack?: any,
  ): Promise<void> {
    try {
      this.logger.log(
        `Message ${message.id} status updated to ${message.status}`,
      );
      const sanitizedQueue = `${message.queueName.replace(/_queue$/, '')}_queue_logs`;
      const queueName = sanitizedQueue;
      if (message.errorData || message.errorStack) {
        this.logger.error(`Error: ${message.errorData}`);
        message.status = QueueStatus.FAILED;
        message.errorData = errorData;
        message.errorStack = errorStack;
        await this.dynamicEntityService.insertLog(queueName, {
          ...message,
          messageId: message.id,
        });
      }
      await this.dynamicEntityService.insertLog(queueName, {
        ...message,
        messageId: message.id,
        expiresAt: message.expiresAt,
      });
    } catch (error) {
      this.logger.error(`Database error: ${error.message}`);
      throw error;
    }
  }

  async getQueueInfo(queueName: string): Promise<{
    name: string;
    messages: number;
    consumers: number;
    state: string;
    exists: boolean;
  } | null> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not available');
    }

    try {
      const queueInfo = await this.channel.checkQueue(queueName);

      return {
        name: queueName,
        messages: queueInfo.messageCount,
        consumers: queueInfo.consumerCount,
        state: 'running',
        exists: true,
      };
    } catch (error) {
      if (error.message.includes('NOT_FOUND')) {
        return {
          name: queueName,
          messages: 0,
          consumers: 0,
          state: 'not_found',
          exists: false,
        };
      }

      this.logger.error(
        `Error getting queue info for "${queueName}": ${error.message}`,
      );
      throw error;
    }
  }

  async getQueueMessageCount(queueName: string): Promise<number> {
    try {
      const queueInfo = await this.getQueueInfo(queueName);
      return queueInfo ? queueInfo.messages : 0;
    } catch (error) {
      this.logger.error(
        `Error getting message count for queue "${queueName}": ${error.message}`,
      );
      return 0;
    }
  }

  private async verifyQueuesExist(queueName: string): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not available');
    }

    const queuesToVerify = [
      queueName,
      `${queueName}_dlq`,
      `${queueName}_success`,
      `${queueName}_processing`,
    ];

    for (const queue of queuesToVerify) {
      try {
        await this.channel.checkQueue(queue);
        this.logger.log(`✅ Queue "${queue}" verified successfully`);
      } catch (error) {
        this.logger.error(
          `❌ Queue "${queue}" verification failed: ${error.message}`,
        );
        throw new Error(`Queue "${queue}" does not exist or is not accessible`);
      }
    }

    this.logger.log(`All queues for "${queueName}" verified successfully`);
  }
}
