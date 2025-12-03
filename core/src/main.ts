import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { CONFIG } from './utils/config/enviroment.config';
import {
  ClassSerializerInterceptor,
  Logger,
  ValidationPipe,
} from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix(CONFIG.prefix);

  app.useGlobalPipes(new ValidationPipe());

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  const loggerService = new Logger('MAIN');

  app.enableCors({
    origin: CONFIG.corsOrigins,
  });

  await app.listen(CONFIG.httpPort);

  loggerService.log(`Core microservice is running on port ${CONFIG.httpPort}`);
}
bootstrap();
