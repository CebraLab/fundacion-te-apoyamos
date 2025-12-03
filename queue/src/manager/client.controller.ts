import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClientService } from './client.service';
import { Pagination } from 'nestjs-typeorm-paginate';
import { AuthGuard } from '../auth/auth.guard';
import { ApiExcludeController } from '@nestjs/swagger';

@ApiExcludeController()
@Controller('client')
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Get('health')
  async health() {
    return {
      status: 'ok',
    };
  }

  @Get('queues')
  @UseGuards(AuthGuard)
  async getQueues(@Req() req: any) {
    return this.clientService.getQueues(req.user.user_type || null);
  }

  @Post('queues/:queueName')
  @UseGuards(AuthGuard)
  async getQueueListPaginated(
    @Param('queueName') queueName: string,
    @Body()
    body: {
      page: number;
      limit: number;
      sortBy: string;
      descending: boolean;
      filter: string;
      statuses: string[];
    },
  ): Promise<Pagination<any>> {
    const { page, limit, sortBy, descending, filter, statuses } = body;
    return await this.clientService.getQueueListPaginated(
      queueName,
      {
        page,
        limit: limit > 100 ? 100 : limit,
        route: '',
      },
      {
        sortBy,
        descending,
        filter,
        statuses,
      },
    );
  }

  @Get('queues/:queueName/stats')
  @UseGuards(AuthGuard)
  async getQueueStats(
    @Param('queueName') queueName: string,
    @Query()
    query: {
      period: string;
      timezone: string;
    },
  ) {
    const { period, timezone } = query;
    return this.clientService.getQueueStats(queueName, period, timezone);
  }

  @Get('queues/:queueName/processing')
  @UseGuards(AuthGuard)
  async getQueueProcessing(@Param('queueName') queueName: string) {
    return this.clientService.getQueueProcessing(queueName);
  }
}
