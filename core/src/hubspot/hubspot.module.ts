import { Module } from '@nestjs/common';
import { HubspotService } from './hubspot.service';
import { ContactService } from './contact.service';
import { HubspotController } from './hubspot.controller';
import { UtilsModule } from '../utils/utils.module';

@Module({
  imports: [UtilsModule],
  controllers: [HubspotController],
  providers: [HubspotService, ContactService],
  exports: [HubspotService],
})
export class HubspotModule {}
