import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

function corsOrigins(): (string | RegExp)[] {
  const fromEnv = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const defaults = [
    'http://localhost:3000',
    'https://lendsync-web.vercel.app',
  ];
  return [...new Set([...defaults, ...fromEnv])];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix('api');

  const allowed = corsOrigins();
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow non-browser / same-origin tools (no Origin header)
      if (!origin) {
        callback(null, true);
        return;
      }
      const ok =
        allowed.includes(origin) ||
        /\.vercel\.app$/.test(new URL(origin).hostname);
      callback(null, ok);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('LendSync API')
    .setDescription('Lending Management System REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`LendSync API listening on :${port}`);
  // eslint-disable-next-line no-console
  console.log(`CORS allowlist: ${allowed.join(', ')} (+ *.vercel.app)`);
}

bootstrap();
