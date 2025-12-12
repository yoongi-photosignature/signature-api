import Fastify, { FastifyInstance } from 'fastify';
import mongoPlugin from './plugins/mongodb.js';
import { salesRoutes } from './modules/sales/sales.routes.js';
import { settlementRoutes } from './modules/settlement/settlement.routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
  });

  // MongoDB 플러그인 등록
  await app.register(mongoPlugin);

  // API 라우트 등록
  await app.register(salesRoutes, { prefix: '/api/sales' });
  await app.register(settlementRoutes, { prefix: '/api/settlement' });

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  // Root
  app.get('/', async () => ({
    name: 'PhotoSignature API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      sales: '/api/sales',
      settlement: '/api/settlement',
    },
  }));

  return app;
}
