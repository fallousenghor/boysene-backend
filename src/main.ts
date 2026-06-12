import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as helmet from 'helmet';
import * as compression from 'compression';


import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3002);

  // Security
  app.use((helmet as any)());
  app.use(compression());

  app.use(cookieParser());

  // CORS
  // Note: Vercel/Render origins are cross-site, so browser preflight (OPTIONS) must be allowed.
  const appUrl = configService.get<string>('APP_URL');
  // Fallback si APP_URL n'est pas défini
  const appUrlSafe = appUrl ?? 'https://boysene-backend.onrender.com';

  // Flutter web (et parfois d'autres serveurs de dev) peut tourner sur n'importe quel port,
  // donc on autorise aussi les origins localhost en match (pattern) en mode dev.
  const corsOrigin = [
    'https://boysene-frontend.vercel.app',
    'http://localhost:5173',
    'http://localhost:3001',
    appUrlSafe,

  ].filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Si la requête n'a pas d'origin (ex: mobile natif), on autorise.
      if (!origin) return callback(null, true);

      // Autoriser les origins localhost avec n'importe quel port (dev)
      if (/^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
        return callback(null, true);
      }

      // Autoriser les origins explicitement listées
      if (corsOrigin.includes(origin)) return callback(null, true);

      // Sinon: refuser
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });



  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global filters & interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  // Swagger API Documentation
  if (configService.get('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Quincaillerie API')
      .setDescription('API de gestion de quincaillerie - Documentation complète')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentification')
      .addTag('users', 'Gestion utilisateurs')
      .addTag('roles', 'Gestion rôles & permissions')
      .addTag('customers', 'Gestion clients')
      .addTag('suppliers', 'Gestion fournisseurs')
      .addTag('categories', 'Catégories produits')
      .addTag('brands', 'Marques produits')
      .addTag('products', 'Gestion produits')
      .addTag('stocks', 'Gestion stocks')
      .addTag('purchases', 'Gestion achats')
      .addTag('sales', 'Gestion ventes')
      .addTag('payments', 'Gestion paiements')
      .addTag('invoices', 'Facturation')
      .addTag('whatsapp', 'WhatsApp Business')
      .addTag('dashboard', 'Tableau de bord')
      .addTag('reports', 'Rapports')
      .addTag('settings', 'Paramètres')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
  }

  await app.listen(port);
  console.log(`🚀 Server running on: http://localhost:${port}/api/v1`);
}

bootstrap();
