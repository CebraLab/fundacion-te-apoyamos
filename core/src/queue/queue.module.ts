import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { Module } from '@nestjs/common';
import { CONFIG } from '../utils/config/enviroment.config';
import { UtilsModule } from '../utils/utils.module';
import { QueueService } from './queue.service';
import { QueueProcessorService } from './queue.processor';
import { HubspotModule } from '../hubspot/hubspot.module';

@Module({
  imports: [
    RabbitMQModule.forRoot({
      uri: `amqp://${CONFIG.queues.rabbitmq.username}:${CONFIG.queues.rabbitmq.password}@${CONFIG.queues.rabbitmq.host}:${CONFIG.queues.rabbitmq.port}`,
      connectionInitOptions: { wait: true },
      prefetchCount: 1,
      registerHandlers: true,
      enableControllerDiscovery: true,
    }),
    UtilsModule,
    HubspotModule,
  ],
  providers: [QueueService, QueueProcessorService],
})
export class QueueModule {}
