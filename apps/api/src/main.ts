import './load-env'; // DEBE ir primero: carga .env antes de importar módulos que leen process.env.
import 'reflect-metadata';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { JsonLogger } from './observability/json-logger';
import type { Env } from './config/env.validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new JsonLogger(),
  });
  const config = app.get(ConfigService<Env, true>);

  // Detrás del proxy de Railway: respeta X-Forwarded-* (TLS, IP real para rate limit).
  app.set('trust proxy', 1);

  // Cabeceras de seguridad (FASE-14, RNF-012).
  app.use(helmet());

  // Cuerpo JSON: el límite por defecto de Express es 100 KB y las imágenes de
  // marca (logo del negocio, foto del especialista) viajan como data URL en
  // base64, que añade ~33% al tamaño real. Con 100 KB el guardado del logo
  // fallaba con "request entity too large". 1 MB deja margen sobre el tope real
  // de 400 KB por imagen, que se sigue validando en cada servicio: subirlo aquí
  // NO relaja esa comprobación.
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });

  // Prefijo global /api (FASE-01, paso 6).
  app.setGlobalPrefix('api');

  // ValidationPipe global: descarta propiedades no declaradas en los DTOs.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // CORS configurable por entorno (admite varios orígenes separados por coma).
  const cors = config.get('CORS_ORIGIN', { infer: true });
  app.enableCors({ origin: cors?.split(',').map((o) => o.trim()), credentials: true });

  // Cierre ordenado (drena conexiones al recibir SIGTERM en Railway).
  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  await app.listen(port, '0.0.0.0');
  Logger.log(`Orkalis API escuchando en el puerto ${port}`, 'Bootstrap');
}

void bootstrap();
