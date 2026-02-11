import { Injectable } from '@nestjs/common';
import { QueueService } from './queue.service';
import { SuscribeEventQueueMQ } from '../utils/decorators/queue.decorator';
import { HubspotService } from '../hubspot/hubspot.service';

@Injectable()
export class QueueProcessorService {
  constructor(
    private readonly queueService: QueueService,
    private readonly hubspotService: HubspotService,
  ) {}

  @SuscribeEventQueueMQ('contacts')
  async processContact(message: any) {
    await this.queueService.processContact(message);
  }

  /**
   * Procesa mensajes de la cola rut_unified_queue
   * Unifica contactos duplicados basándose en el RUT
   */
  @SuscribeEventQueueMQ('rut_unified')
  async processUnificarRut(message: any) {
    await this.queueService.unificarRut(message);
  }

  /**
   * Procesa mensajes de la cola companies_queue
   * Formatea el RUT de la empresa y lo guarda en rut_entidad_formateado
   */
  @SuscribeEventQueueMQ('companies')
  async processCompany(message: any) {
    await this.hubspotService.processCompanyFromQueue(message);
  }
}
