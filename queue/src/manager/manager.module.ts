import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { UtilsModule } from '../utils/utils.module';
import { QueueService } from './queue.service';
import { CONFIG } from '../utils/config/enviroment.config';
import { DynamicEntityService } from './dynamic_entity.service';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';
import { ClientConsumerService } from './client_consumer.service';
import { QueueStatus } from './models/queue_logs.model';
import { ClientController } from './client.controller';
import { ClientService } from './client.service';
import { AuthModule } from '../auth/auth.module';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ApiKey, User } from '../auth/models/user.model';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

export const IMPORTS_MAIN_MODULE = [
  TypeOrmModule.forRoot({
    ...(CONFIG.databases.mysql as Partial<TypeOrmModuleOptions>),
    entities: [User, ApiKey],
    synchronize: true,
  }),
  ServeStaticModule.forRoot({
    rootPath: join(__dirname, '..', '..', '..', 'client/dist/spa'),
  }),
];

@Module({
  imports: [AuthModule, UtilsModule],
  controllers: [AppController, ClientController],
  providers: [
    QueueService,
    DynamicEntityService,
    {
      provide: 'DATABASE_CONNECTION',
      useFactory: (dataSource: DataSource) => dataSource,
      inject: [DataSource],
    },
    ClientConsumerService,
    ClientService,
  ],
})
export class ManagerModule implements OnModuleInit {
  private readonly logger = new Logger(ManagerModule.name);

  constructor(
    private readonly rabbitmqService: ClientConsumerService,
    private readonly dynamicEntityService: DynamicEntityService,
  ) {}

  async onModuleInit() {
    const channel = this.rabbitmqService.getChannel();
    if (!channel) {
      console.error('RabbitMQ channel not available.');
      return;
    }

    for (const config of CONFIG.queues.rabbitmq.queues) {
      const { name } = config;

      const dlqName = `${name.replace(/_queue$/, '')}_queue_dlq`;
      const sucessQueueName = `${name.replace(/_queue$/, '')}_queue_success`;
      const processingQueueName = `${name.replace(/_queue$/, '')}_queue_processing`;

      const tableName = `${name.replace(/_queue$/, '')}_queue_logs`;

      // Start consuming messages
      channel.consume(
        dlqName,
        async (msg) => {
          if (msg === null) return;

          try {
            const content = JSON.parse(msg.content.toString());

            let errorData = {};
            let errorStack = '';

            if (
              msg.properties.headers['x-first-death-reason'] === 'expired' &&
              msg.properties.headers['x-last-death-reason'] === 'expired'
            ) {
              errorData = { message: 'Message expired' };
              errorStack = 'MESSAGE EXPIRED';
            } else {
              errorStack = content._dlq_metadata.errorStack;
              try {
                const parse = JSON.parse(content._dlq_metadata.errorMessage);
                if (typeof parse === 'object') {
                  errorData = parse;
                } else {
                  errorData = { message: parse };
                }
              } catch {
                errorData = { message: content._dlq_metadata.errorMessage };
              }
            }

            const logData = {
              queueName: dlqName,
              payload: content.payload,
              status: QueueStatus.FAILED,
              errorData: errorData,
              errorStack: errorStack,
              messageId: content.id || null,
              groupDate:
                typeof content.groupDate === 'number'
                  ? content.groupDate
                  : null,
            };

            await this.dynamicEntityService.insertLog(tableName, logData);

            channel.ack(msg);
          } catch (error) {
            console.error(`Error processing message from ${dlqName}:`, error);
            channel.ack(msg);
          }
        },
        { noAck: false },
      );

      channel.consume(
        sucessQueueName,
        async (msg) => {
          try {
            const content = JSON.parse(msg.content.toString());

            const logData = {
              queueName: sucessQueueName,
              payload: content.payload,
              status: QueueStatus.SUCCESS,
              messageId: content.id || null,
              groupDate:
                typeof content.groupDate === 'number'
                  ? content.groupDate
                  : null,
            };

            await this.dynamicEntityService.insertLog(tableName, logData);

            channel.ack(msg);
          } catch (error) {
            this.logger.error(
              `Error processing message from ${sucessQueueName}:`,
              error,
            );
            channel.ack(msg);
          }
        },
        { noAck: false },
      );

      channel.consume(
        processingQueueName,
        async (msg) => {
          try {
            const content = JSON.parse(msg.content.toString());

            const logData = {
              queueName: processingQueueName,
              payload: content.payload,
              status: QueueStatus.PROCESSING,
              messageId: content.id || null,
              groupDate:
                typeof content.groupDate === 'number'
                  ? content.groupDate
                  : null,
            };

            await this.dynamicEntityService.insertLog(tableName, logData);

            channel.ack(msg);
          } catch (error) {
            this.logger.error(
              `Error processing message from ${processingQueueName}:`,
              error,
            );
            channel.ack(msg);
          }
        },
        { noAck: false },
      );
    }
    this.logger.log('All dynamic DLQ listeners have been started.');
    this.logger.log('All dynamic SUCCESS listeners have been started.');
    this.logger.log('All dynamic PROCESSING listeners have been started.');
  }
}
