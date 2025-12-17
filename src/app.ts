import Fastify, { FastifyInstance } from 'fastify';
import mongoPlugin from './plugins/mongodb.js';
import { salesRoutes } from './modules/sales/sales.routes.js';
import { settlementRoutes } from './modules/settlement/settlement.routes.js';
import { exchangeRatesRoutes } from './modules/exchange-rates/exchange-rates.routes.js';
import { popupsRoutes } from './modules/popups/popups.routes.js';
import { storesRoutes } from './modules/stores/stores.routes.js';
import { devicesRoutes } from './modules/devices/devices.routes.js';
import { configRoutes } from './modules/config/config.routes.js';
import { setupErrorHandler } from './utils/error-handler.js';

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

  // 에러 핸들러 설정 (민감 정보 마스킹)
  setupErrorHandler(app);

  // API 라우트 등록
  await app.register(salesRoutes, { prefix: '/api/sales' });
  await app.register(settlementRoutes, { prefix: '/api/settlement' });
  await app.register(exchangeRatesRoutes, { prefix: '/api/exchange-rates' });
  await app.register(popupsRoutes, { prefix: '/api/popups' });
  await app.register(storesRoutes, { prefix: '/api/stores' });
  await app.register(devicesRoutes, { prefix: '/api/devices' });
  await app.register(configRoutes, { prefix: '/api/config' });

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
      exchangeRates: '/api/exchange-rates',
      popups: '/api/popups',
      stores: '/api/stores',
      devices: '/api/devices',
      config: '/api/config',
    },
  }));

  return app;
}
