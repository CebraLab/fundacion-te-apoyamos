import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { HubspotValidatorService } from '../hubspot-validator.service';
import { CONFIG } from '../../utils/config/enviroment.config';

@Injectable()
export class HubspotSignatureGuard implements CanActivate {
  constructor(
    private readonly hubspotValidatorService: HubspotValidatorService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // Opción 1: Validar por API Key (para testing desde Postman u otros clientes)
    const apiKey = request.headers['x-api-key'] as string;
    if (this.validateApiKey(apiKey)) {
      return true;
    }

    // Si no hay clientSecret configurado, permitir acceso (modo desarrollo)
    const clientSecret = CONFIG.integrations?.hubspot?.clientSecret;
    if (!clientSecret) {
      console.warn(
        '⚠️  HUBSPOT_CLIENT_SECRET no configurado. Webhooks sin validación de firma.',
      );
      return true; // Permitir en desarrollo
    }

    // Opción 2: Validar por firma de HubSpot (para webhooks reales)
    const signature = request.headers['x-hubspot-signature-v3'] as string;
    const requestTimestamp = request.headers[
      'x-hubspot-request-timestamp'
    ] as string;

    if (!signature || !requestTimestamp) {
      throw new UnauthorizedException(
        'Missing authentication: provide either x-api-key or HubSpot signature headers',
      );
    }

    // Validar que el timestamp no sea muy antiguo (5 minutos)
    if (!this.hubspotValidatorService.validateTimestamp(requestTimestamp)) {
      throw new UnauthorizedException('Request timestamp is too old');
    }

    // Construir la URI completa (usar https como en el ejemplo de HubSpot)
    const method = request.method;
    const hostname = request.get('host');
    const uri = `https://${hostname}${request.originalUrl}`;

    // Validar la firma
    if (
      !this.hubspotValidatorService.validateSignatureV3(
        method,
        uri,
        request.body,
        requestTimestamp,
        signature,
      )
    ) {
      throw new UnauthorizedException('Invalid HubSpot signature');
    }

    return true;
  }

  private validateApiKey(apiKey: string | undefined): boolean {
    if (!apiKey) {
      return false;
    }

    const validApiKey = CONFIG.integrations.hubspot.webhookTestApiKey;

    // Si no hay API key configurada, no permitir esta forma de autenticación
    if (!validApiKey) {
      return false;
    }

    return apiKey === validApiKey;
  }
}
