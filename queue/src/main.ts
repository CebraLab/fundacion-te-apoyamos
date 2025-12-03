import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  ClassSerializerInterceptor,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { CONFIG } from './utils/config/enviroment.config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix(CONFIG.prefix);

  app.useGlobalPipes(new ValidationPipe());

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  app.enableCors({
    origin: CONFIG.corsOrigins,
  });

  const projectName = CONFIG.projectName.split('_').join(' ').toUpperCase();
  const options = new DocumentBuilder()
    .setTitle(`${projectName} API`)
    .setDescription(
      `
## 🚀 ${projectName} - RabbitMQ Queue Service

Simple API to enqueue payloads in RabbitMQ with automatic retry and DLQ handling.

### 🔐 Authentication
- **API Key Required**: All endpoints require an API key
- **Header**: Include \`X-API-Key\` in your requests
- **Generation**: Create API keys from the dashboard
- **Permissions**: Each key has specific permissions and rate limits

### 🎯 Main Endpoint
**POST** \`/queues/{queueName}/send\` - Send payloads directly to RabbitMQ queue

### 🔧 Features
- Automatic retry with exponential backoff (3 attempts)
- Dead Letter Queue for failed messages  
- Message persistence to database
- Queue name sanitization
- API key authentication and authorization

### 📊 Message Flow
PENDING → PROCESSING → SUCCESS/FAILED → DLQ (if failed)

### 🚀 Getting Started
1. **Generate API Key**: Create an API key from the dashboard
2. **Include Header**: Add \`X-API-Key: your-key\` to requests
3. **Send Payloads**: Use the main endpoint to enqueue messages
4. **Monitor**: Track message processing through the dashboard

Check the endpoint documentation below for detailed usage examples.
    `,
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-API-Key',
        in: 'header',
        description: 'API Key generated from the dashboard',
      },
      'api-key',
    )
    .addTag('Queue', 'Main Application Endpoints')
    .build();
  const document = SwaggerModule.createDocument(app, options);

  SwaggerModule.setup(`${CONFIG.prefix}/swagger`, app, document, {
    jsonDocumentUrl: `${CONFIG.prefix}/swagger/json`,
    customSiteTitle: `${projectName} API`,
    swaggerOptions: {
      persistAuthorization: true,
      tryItOutEnabled: true,
    },
  });

  await app.listen(CONFIG.httpPort);

  const loggerService = new Logger('MAIN');

  loggerService.log(`Queue microservice is running on port ${CONFIG.httpPort}`);
}
void bootstrap();
