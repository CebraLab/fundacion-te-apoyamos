import { Module } from '@nestjs/common';
import { UtilsModule } from './utils/utils.module';
import { QueueModule } from './queue/queue.module';
import { HubspotModule } from './hubspot/hubspot.module';
import { AppController } from './app.controller';

@Module({
  imports: [UtilsModule, QueueModule, HubspotModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
