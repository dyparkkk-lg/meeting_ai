import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ApiModule } from './api.module';

async function bootstrap() {
  const logger = new Logger('API');
  const app = await NestFactory.create(ApiModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS 설정 (개발용)
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type,Authorization',
  });

  // API prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  logger.log(`🚀 Meeting AI API Server running on: http://localhost:${port}/api`);
  logger.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap();

