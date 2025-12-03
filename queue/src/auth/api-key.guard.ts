// api-key.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express'; // Assuming Express is used
import { AuthService } from './auth.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'] as string; // Or wherever your API key is located

    if (!apiKey) {
      throw new UnauthorizedException('API Key is required');
    }

    const isValid = await this.authService.validateApiKey(apiKey);

    if (!isValid) {
      throw new UnauthorizedException('Invalid API Key');
    }

    return true;
  }
}
