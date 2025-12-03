// src/rabbitmq/rabbitmq.service.ts
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import * as amqp from 'amqplib';
import { CONFIG } from '../utils/config/enviroment.config';

@Injectable()
export class ClientConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClientConsumerService.name);

  private connection: amqp.Connection;
  private channel: amqp.Channel;

  async onModuleInit() {
    try {
      this.connection = await amqp.connect(
        `amqp://${CONFIG.queues.rabbitmq.username}:${CONFIG.queues.rabbitmq.password}@${CONFIG.queues.rabbitmq.host}:${CONFIG.queues.rabbitmq.port}`,
      );
      this.channel = await this.connection.createChannel();
      this.logger.log('Connected to RabbitMQ via amqplib.');
    } catch (err) {
      this.logger.error('Failed to connect to RabbitMQ:', err);
    }
  }

  async onModuleDestroy() {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
    this.logger.log('Disconnected from RabbitMQ.');
  }

  getChannel(): amqp.Channel {
    return this.channel;
  }
}
