import { AmqpConnection, isRabbitContext } from '@golevelup/nestjs-rabbitmq';
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, delay } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { QueueException } from '../exceptions/queue.exception';

@Injectable()
export class QueueInterceptor implements NestInterceptor {
  constructor(private readonly amqpConnection: AmqpConnection) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (isRabbitContext(context)) {
      const queueMessage =
        context.getArgs().length > 0 ? context.getArgs()[0] : null;
      if (!queueMessage) {
        return next.handle();
      }
      const processingQueueName = `${queueMessage.queueName}_processing`;
      void this.amqpConnection.publish('', processingQueueName, queueMessage);

      return next.handle().pipe(
        delay(3000),
        tap(() => {
          const queueMessage =
            context.getArgs().length > 0 ? context.getArgs()[0] : null;
          if (!queueMessage) {
            return true;
          }
          const successQueueName = `${queueMessage.queueName}_success`;
          void this.amqpConnection.publish('', successQueueName, queueMessage);
          return true;
        }),
        catchError((error) => {
          throw QueueException.fromError(error, 'QUEUE_PROCESSOR_ERROR', 404);
        }),
      );
    }
    return next.handle();
  }
}
