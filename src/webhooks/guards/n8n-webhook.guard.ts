import {
  CanActivate, ExecutionContext,
  Injectable, UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class N8nWebhookGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request  = context.switchToHttp().getRequest<Request>();
    const incoming = request.headers['x-webhook-secret'] as string | undefined;
    const expected = this.configService.get<string>('N8N_SECRET_KEY');

    if (!expected) {
      throw new UnauthorizedException(
        'N8N_SECRET_KEY no está configurada en el servidor.',
      );
    }
    if (!incoming || incoming !== expected) {
      throw new UnauthorizedException(
        'Webhook secret inválido o ausente. Configura x-webhook-secret en n8n.',
      );
    }

    return true;
  }
}
