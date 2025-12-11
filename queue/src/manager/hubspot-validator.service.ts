import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { CONFIG } from '../utils/config/enviroment.config';

@Injectable()
export class HubspotValidatorService {
  private readonly MAX_ALLOWED_TIMESTAMP = 300000; // 5 minutos en milisegundos

  validateTimestamp(timestamp: string): boolean {
    const requestTime = parseInt(timestamp, 10);
    const currentTime = Date.now();
    return currentTime - requestTime <= this.MAX_ALLOWED_TIMESTAMP;
  }

  validateSignatureV3(
    method: string,
    uri: string,
    body: any,
    timestamp: string,
    signature: string,
  ): boolean {
    const clientSecret = CONFIG.integrations?.hubspot?.clientSecret;

    // Si no hay clientSecret, no se puede validar
    if (!clientSecret) {
      console.warn(
        '⚠️  Cannot validate signature: HUBSPOT_CLIENT_SECRET not configured',
      );
      return false;
    }

    // Concatenar método, URI, body y timestamp según documentación de HubSpot
    const rawString = `${method}${uri}${JSON.stringify(body)}${timestamp}`;

    // Crear HMAC SHA-256 hash y codificarlo en base64
    const hashedString = createHmac('sha256', clientSecret)
      .update(rawString)
      .digest('base64');

    // Validar firma usando timingSafeEqual para evitar timing attacks
    try {
      return timingSafeEqual(Buffer.from(hashedString), Buffer.from(signature));
    } catch {
      // Si las longitudes no coinciden, timingSafeEqual lanza un error
      return false;
    }
  }
}
