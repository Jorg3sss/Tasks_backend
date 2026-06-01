import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request }       from 'express';

/**
 * Guard para endpoints llamados por n8n o servicios externos.
 * Verifica el header X-Webhook-Secret contra la variable WEBHOOK_SECRET del .env
 */
@Injectable()
export class WebhookApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request  = context.switchToHttp().getRequest<Request>();
    const incoming = request.headers['x-webhook-secret'] as string | undefined;
    const expected = this.configService.get<string>('WEBHOOK_SECRET');

    if (!incoming || incoming !== expected) {
      throw new UnauthorizedException('API Key de webhook inválida o ausente.');
    }

    return true;
  }
}
