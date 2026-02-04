import { Injectable } from '@nestjs/common';
import { CompanyRutService } from './company-rut.service';
import { SuscribeEventQueueMQ } from '../utils/decorators/queue.decorator';

@Injectable()
export class CompanyProcessorService {
  constructor(private readonly companyRutService: CompanyRutService) {}

  @SuscribeEventQueueMQ('companies_rut_unified')
  async processUnificarRut(message: any) {
    await this.companyRutService.unificarRut(message);
  }
}
