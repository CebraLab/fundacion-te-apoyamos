import { applyDecorators, Logger, UseInterceptors } from '@nestjs/common';
import { Channel } from 'amqplib';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { QueueInterceptor } from './queue.interceptor';

// Helper function for delay
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function SuscribeEventQueueMQ(queueName: string, isDlq: boolean = false) {
  const logger = new Logger(`Queue:${queueName}`);

  let sanitizedQueueName = '';

  const baseQueueName = queueName.replace(/(_dlq|_queue)$/, '');

  if (isDlq) {
    sanitizedQueueName = `${baseQueueName}_dlq`;
  } else {
    sanitizedQueueName = `${baseQueueName}_queue`;
  }


  return applyDecorators(
    RabbitSubscribe({
      queue: sanitizedQueueName,
      routingKey: sanitizedQueueName,
      queueOptions: {
        durable: true,
        // Solo configurar dead letter exchange si no es una cola DLQ
        ...(() => {
          if (isDlq) {
            return {
              arguments: {
                'x-max-priority': 5,
              },
            };
          } else {
            return {
              arguments: {
                'x-max-priority': 10,
                'x-max-retries': 3, // Máximo 3 intentos
                'x-dead-letter-exchange': '', // Exchange por defecto
                'x-dead-letter-routing-key': `${sanitizedQueueName}_dlq`, // Routing key para DLQ
              },
            };
          }
        })(),
      },
      errorHandler: async (channel: Channel, msg: any, error: any) => {
        try {
          // IMPORTANTE: Este errorHandler maneja reintentos y libera la cola apropiadamente
          // Durante reintentos: Se hace ack del mensaje original para permitir procesamiento del reintento
          // Al ir a DLQ: Se hace ack del mensaje original para liberar completamente la cola

          // Obtener el contador de reintentos del mensaje
          const retryCount =
            (msg.properties.headers?.['x-retry-count'] || 0) + 1;
          const maxRetries = msg.properties.headers?.['x-max-retries'] || 3;
          const firstDeathQueue =
            msg.properties.headers?.['x-first-death-queue'] ||
            msg.fields.routingKey;
          const firstDeathReason =
            msg.properties.headers?.['x-first-death-reason'] || 'rejected';

          logger.warn(
            `Error processing message in queue "${sanitizedQueueName}". Retry ${retryCount}/${maxRetries}`,
          );

          if (retryCount < maxRetries) {
            // Calcular delay exponencial para reintentos
            const delayMs = Math.min(1000 * Math.pow(2, retryCount - 1), 30000); // Max 30 segundos

            logger.log(
              `Reintentando mensaje en ${delayMs}ms. Intento ${retryCount}/${maxRetries}`,
            );

            const originalPriority = msg.properties.priority || 7;
            const newPriority = originalPriority + 1;

            // Esperar antes del reintento
            await delay(delayMs);

            // Reenviar el mensaje a la misma cola con contador de reintentos actualizado
            await channel.sendToQueue(msg.fields.routingKey, msg.content, {
              ...msg.properties,
              priority: newPriority,
              headers: {
                ...msg.properties.headers,
                'x-retry-count': retryCount,
                'x-max-retries': maxRetries,
                'x-first-death-queue': firstDeathQueue,
                'x-first-death-reason': firstDeathReason,
              },
            });

            // IMPORTANTE: Hacer ack del mensaje original para liberar la cola
            // y permitir que el mensaje reenviado se procese
            await channel.ack(msg);

            logger.log(
              `Mensaje reenviado para reintento ${retryCount}/${maxRetries}. Cola liberada para procesar reintento.`,
            );
          } else {
            // El mensaje ha alcanzado el límite de reintentos
            logger.error(
              `Mensaje alcanzó el límite de reintentos (${maxRetries}). Enviando a DLQ.`,
            );

            // Crear el nombre de la cola DLQ
            const dlqName = `${msg.fields.routingKey}_dlq`;

            // Preparar el mensaje para DLQ con información completa del error
            const messageContent = JSON.parse(msg.content.toString());
            const dlqMessage = {
              ...messageContent,
              _dlq_metadata: {
                originalQueue: msg.fields.routingKey,
                retryCount: retryCount,
                maxRetries: maxRetries,
                firstDeathQueue: firstDeathQueue,
                firstDeathReason: firstDeathReason,
                errorMessage: error.message,
                errorStack: error.stack,
                lastRetryAt: new Date().toISOString(),
                originalHeaders: msg.properties.headers,
              },
            };

            // Convertir el mensaje de vuelta a Buffer
            const dlqBuffer = Buffer.from(JSON.stringify(dlqMessage));

            // Enviar a la cola DLQ
            await channel.sendToQueue(dlqName, dlqBuffer, {
              ...msg.properties,
              headers: {
                ...msg.properties.headers,
                'x-retry-count': retryCount,
                'x-max-retries': maxRetries,
                'x-first-death-queue': firstDeathQueue,
                'x-first-death-reason': firstDeathReason,
                'x-dlq-reason': 'max_retries_exceeded',
                'x-dlq-timestamp': new Date().toISOString(),
              },
            });

            // Acknowledge el mensaje original para liberar la cola
            await channel.ack(msg);

            logger.log(
              `Mensaje enviado a DLQ "${dlqName}" después de ${retryCount} reintentos`,
            );
          }
        } catch (errorHandlerError) {
          // Si hay error en el error handler, logear y hacer ack para evitar bloqueos
          logger.error(
            `Error en errorHandler para cola "${sanitizedQueueName}": ${errorHandlerError.message}`,
          );

          try {
            await channel.ack(msg);
          } catch (ackError) {
            logger.error(
              `Error al hacer ack del mensaje después de error en errorHandler: ${ackError.message}`,
            );
          }
        }
      },
    }),
    UseInterceptors(QueueInterceptor),
  );
}
