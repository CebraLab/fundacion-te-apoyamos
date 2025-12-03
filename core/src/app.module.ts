import { Module } from '@nestjs/common';
import { UtilsModule } from './utils/utils.module';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [UtilsModule, QueueModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
