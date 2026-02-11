import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiTags,
  ApiSecurity,
} from '@nestjs/swagger';
import { QueueService } from './queue.service';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { HubspotSignatureGuard } from './guards/hubspot-signature.guard';

@ApiTags('Queue')
@Controller()
export class AppController {
  constructor(private readonly queueService: QueueService) {}

  @Get('health')
  @ApiOperation({
    summary: 'Health check endpoint',
    description: `
Check if the RabbitMQ queue service is running and healthy.

**Returns:**
- Service status
- Confirms the API is accessible
- Used for monitoring and load balancer health checks

**Response:**
\`\`\`json
{
  "status": "ok"
}
\`\`\`
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy and running',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Service status',
          example: 'ok',
        },
      },
    },
  })
  async health() {
    return {
      status: 'ok',
    };
  }

  @Post('/queues/:queueName/send')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Enqueue payloads to RabbitMQ queue',
    description: `
Send a list of payloads directly to a RabbitMQ queue.

**Authentication Required:**
- API Key must be provided in the \`X-API-Key\` header
- Generate API keys from the dashboard
- Each API key has specific permissions and rate limits

**Features:**
- Automatic retry with exponential backoff (3 attempts)
- Dead Letter Queue for failed messages
- Message persistence to database
- Queue name sanitization (special chars → _)

**Message Flow:**
PENDING → PROCESSING → SUCCESS/FAILED → DLQ (if failed)

**Example Request:**
\`\`\`
POST /queues/contact/send
X-API-Key: your-api-key-here
Content-Type: application/json

[
  { "userId": 123, "action": "send_email" },
  { "orderId": 456, "status": "pending" }
]
\`\`\`
    `,
  })
  @ApiParam({
    name: 'queueName',
    description: 'Queue name (will be sanitized and suffixed with _queue)',
    example: 'contact',
  })
  @ApiBody({
    description: 'Array of payloads to enqueue',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        description: 'Payload data (any JSON object)',
        example: { userId: 123, action: 'send_email' },
      },
    },
    examples: {
      single: {
        summary: 'Single payload',
        value: [{ userId: 123, action: 'send_email' }],
      },
      multiple: {
        summary: 'Multiple payloads',
        value: [
          { userId: 123, action: 'send_email' },
          { orderId: 456, status: 'pending' },
        ],
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Payloads enqueued successfully',
    schema: {
      type: 'object',
      properties: {
        successCount: {
          type: 'number',
          description: 'Number of successfully enqueued payloads',
          example: 2,
        },
        errorCount: {
          type: 'number',
          description: 'Number of failed payloads',
          example: 0,
        },
        errors: {
          type: 'array',
          description: 'List of errors if any',
          example: [],
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid payload format or queue issues',
  })
  async send(@Param('queueName') queueName: string, @Body() body: any) {
    try {
      const sanitizedQueue = `${queueName.replace(/_queue$/, '')}_queue`;
      const result = await this.queueService.sendToQueue(
        sanitizedQueue,
        body,
        2,
      );
      return result;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('/hubspot/webhook/:queueName')
  @UseGuards(HubspotSignatureGuard)
  @ApiOperation({
    summary: 'Receive HubSpot webhooks and enqueue to multiple queues',
    description: `
Endpoint para recibir webhooks desde HubSpot y encolarlos automáticamente a múltiples colas según el tipo de evento.

**Características:**
- Ruteo automático por subscriptionType (contact.* → colas de contactos, company.* → colas de empresas)
- Encola eventos de contactos a:
  1. contacts_queue: Para formatear el RUT del contacto
  2. rut_unified_queue: Para unificar contactos duplicados por RUT
- Encola eventos de empresas a:
  1. companies_queue: Para formatear el RUT de la empresa
  2. companies_rut_unified_queue: Para unificar empresas duplicadas por RUT
- Validación automática de firma de HubSpot (v3)
- Validación de payload (debe ser array)
- Manejo de errores específico para webhooks

**Autenticación (Dual):**
Este endpoint acepta DOS formas de autenticación:
1. **Firma de HubSpot (Producción)** - Automática desde HubSpot:
   - Headers: \`x-hubspot-signature-v3\` y \`x-hubspot-request-timestamp\`
   - Validación automática de firma HMAC SHA-256
   - No requiere configuración manual
2. **API Key (Testing)** - Para pruebas desde Postman:
   - Header: \`X-API-Key: tu-api-key\`
   - Útil para testing local

**Flujo para Contactos:**
HubSpot envía evento (contact.propertyChange) → Validación → Encola a contacts_queue + rut_unified_queue → Respuesta 200
Core workers procesan desde ambas colas:
- contacts_queue: Formatea RUT y actualiza rut_formateado
- rut_unified_queue: Busca duplicados por RUT y los mergea

**Flujo para Empresas:**
HubSpot envía evento (company.propertyChange) → Validación → Encola a companies_queue + companies_rut_unified_queue → Respuesta 200
Core workers procesan desde ambas colas:
- companies_queue: Formatea RUT y actualiza rut_entidad_formateado
- companies_rut_unified_queue: Busca duplicados por RUT y los mergea

**Ejemplo de Payload HubSpot (Contacto):**
\`\`\`json
[
  {
    "subscriptionType": "contact.propertyChange",
    "objectId": 123456,
    "propertyName": "rut",
    "propertyValue": "12.345.678-9",
    "changeSource": "CRM",
    "eventId": 789,
    "subscriptionId": 12345,
    "portalId": 62515,
    "occurredAt": 1659457602421
  }
]
\`\`\`

**Ejemplo de Payload HubSpot (Empresa):**
\`\`\`json
[
  {
    "subscriptionType": "company.propertyChange",
    "objectId": 654321,
    "propertyName": "rut",
    "propertyValue": "12.345.678-9",
    "changeSource": "CRM",
    "eventId": 790,
    "subscriptionId": 5388850,
    "portalId": 7114540,
    "occurredAt": 1659457602421
  }
]
\`\`\`
    `,
  })
  @ApiParam({
    name: 'queueName',
    description:
      'Base queue name (ignored, routing is based on subscriptionType in payload)',
    example: 'contacts',
  })
  @ApiBody({
    description: 'HubSpot webhook payload (array of events)',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          subscriptionType: {
            type: 'string',
            example: 'contact.propertyChange',
            description: 'contact.* for contacts, company.* for companies',
          },
          objectId: { type: 'number', example: 123456 },
          propertyName: { type: 'string', example: 'rut' },
          propertyValue: { type: 'string', example: '12.345.678-9' },
          changeSource: { type: 'string', example: 'CRM' },
          eventId: { type: 'number', example: 789 },
          subscriptionId: { type: 'number', example: 12345 },
          portalId: { type: 'number', example: 62515 },
          occurredAt: { type: 'number', example: 1659457602421 },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook received and enqueued successfully',
    schema: {
      type: 'object',
      properties: {
        received: { type: 'boolean', example: true },
        eventsCount: { type: 'number', example: 1 },
        queues: {
          type: 'array',
          items: { type: 'string' },
          example: ['contacts_queue', 'rut_unified_queue'],
        },
        message: {
          type: 'string',
          example: 'HubSpot webhook enqueued successfully',
        },
        details: {
          type: 'object',
          properties: {
            isContact: { type: 'boolean' },
            isCompany: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid HubSpot signature or API key',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid payload or queue error',
  })
  async receiveHubSpotWebhook(
    @Param('queueName') queueName: string,
    @Body() body: any,
  ) {
    try {
      // Validar que el payload sea un array
      if (!Array.isArray(body)) {
        throw new HttpException(
          'Invalid payload format. HubSpot webhooks should be an array of events',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Determinar si es contacto o empresa basado en subscriptionType
      const isCompany = body.some((event) =>
        event.subscriptionType?.startsWith('company.'),
      );
      const isContact = body.some((event) =>
        event.subscriptionType?.startsWith('contact.'),
      );

      const queues: string[] = [];
      const results: any[] = [];

      // Enviar a colas de contactos si es necesario
      if (isContact) {
        queues.push('contacts_queue', 'rut_unified_queue');
        const contactsResults = await Promise.all([
          this.queueService.sendToQueue('contacts_queue', body, 2),
          this.queueService.sendToQueue('rut_unified_queue', body, 2),
        ]);
        results.push(...contactsResults);
      }

      // Enviar a colas de empresas si es necesario
      if (isCompany) {
        queues.push('companies_queue', 'companies_rut_unified_queue');
        const companiesResults = await Promise.all([
          this.queueService.sendToQueue('companies_queue', body, 2),
          this.queueService.sendToQueue('companies_rut_unified_queue', body, 2),
        ]);
        results.push(...companiesResults);
      }

      return {
        received: true,
        eventsCount: body.length,
        queues,
        message: 'HubSpot webhook enqueued successfully',
        details: {
          isContact,
          isCompany,
        },
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to process HubSpot webhook',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }
}
