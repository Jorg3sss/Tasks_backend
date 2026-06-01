import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS — permite peticiones desde el frontend (local y VPS)
  const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  // Fallback para desarrollo local
  if (allowedOrigins.length === 0) {
    allowedOrigins.push('http://localhost:3000', 'http://localhost:3001');
  }

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-webhook-secret'],
    credentials: true,
  });

  // Habilita las validaciones globales de class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,       // Elimina propiedades no declaradas en el DTO
      forbidNonWhitelisted: true, // Lanza error si llegan propiedades extras
      transform: true,       // Transforma el payload al tipo del DTO
    }),
  );

  app.setGlobalPrefix('api');

  await app.listen(3001);
  console.log(`🚀 Servidor corriendo en: http://localhost:3001/api`);
}

bootstrap();
