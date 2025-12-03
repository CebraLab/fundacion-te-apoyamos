import { Injectable, Logger } from '@nestjs/common';
import { AxiosInstance } from 'axios';
import { INTEGRATION } from '../utils/config/integration.config';
// import { QueueException } from '../utils/exceptions/queue.exception';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  readonly apiHbV3: AxiosInstance;

  constructor() {
    this.apiHbV3 = INTEGRATION.hubspot.apiV3;
  }

  async getCompanies() {
    const properties = 'name,phone,website';
    const response = await this.apiHbV3.get(
      `/objects/companies?properties=${properties}&limit=100`,
    ); // &after=10
    return response.data;
  }

  private delay = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

  async processContact(message: any): Promise<void> {
    try {
      this.logger.log(
        `[contact_queue]Starting to process message: ${message.id} - ${message.payload.objectId}`,
      );

      await this.delay(Number(message.payload.objectId) * 2500);

      // if (message.payload.objectId) {
      //   throw Error('Object ID is required');
      // }
      // await this.getCompanies();

      this.logger.log(
        `[contact_queue] Message processed successfully: ${message.id} - ${message.payload.objectId}`,
      );
    } catch (error) {
      this.logger.error(
        `[contact_queue] Error processing message: ${message.id} - ${message?.payload?.objectId}`,
      );
      // throw QueueException.fromError(error, 'QUEUE_PROCESSOR_ERROR', 404);
      throw error;
    }
  }
}
