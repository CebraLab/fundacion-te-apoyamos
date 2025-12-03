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
}
