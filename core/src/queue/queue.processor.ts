import { Injectable } from '@nestjs/common';
import { QueueService } from './queue.service';
import { SuscribeEventQueueMQ } from '../utils/decorators/queue.decorator';

@Injectable()
export class QueueProcessorService {
  constructor(private readonly queueService: QueueService) {}

  @SuscribeEventQueueMQ('contacts')
  async processContact(message: any) {
    await this.queueService.processContact(message);
  }
}
