import { Module } from '@nestjs/common';
import { UtilsModule } from './utils/utils.module';
import { AuthModule } from './auth/auth.module';
import { IMPORTS_MAIN_MODULE, ManagerModule } from './manager/manager.module';

@Module({
  imports: [...IMPORTS_MAIN_MODULE, UtilsModule, AuthModule, ManagerModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
