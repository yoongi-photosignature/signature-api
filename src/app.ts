import Fastify, { FastifyInstance } from 'fastify';
import mongoPlugin from './plugins/mongodb.js';
import { salesRoutes } from './modules/sales/sales.routes.js';
import { settlementRoutes } from './modules/settlement/settlement.routes.js';
import { exchangeRatesRoutes } from './modules/exchange-rates/exchange-rates.routes.js';
import { popupsRoutes } from './modules/popups/popups.routes.js';
import { storesRoutes } from './modules/stores/stores.routes.js';
import { devicesRoutes } from './modules/devices/devices.routes.js';
import { configRoutes } from './modules/config/config.routes.js';
import { sessionsRoutes } from './modules/sessions/sessions.routes.js';
import { eventsRoutes } from './modules/events/events.routes.js';
import { performanceRoutes } from './modules/performance/performance.routes.js';
import { errorsRoutes } from './modules/errors/errors.routes.js';
import { dailySummaryRoutes } from './modules/daily-summary/daily-summary.routes.js';
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
  await app.register(sessionsRoutes, { prefix: '/api/sessions' });
  await app.register(eventsRoutes, { prefix: '/api/events' });
  await app.register(performanceRoutes, { prefix: '/api/performance' });
  await app.register(errorsRoutes, { prefix: '/api/errors' });
  await app.register(dailySummaryRoutes, { prefix: '/api/daily-summary' });

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
      sessions: '/api/sessions',
      events: '/api/events',
      performance: '/api/performance',
      errors: '/api/errors',
      dailySummary: '/api/daily-summary',
    },
  }));

  return app;
}
