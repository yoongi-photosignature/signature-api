import { FastifyPluginAsync } from 'fastify';
import { ExchangeRatesRepository } from './exchange-rates.repository.js';
import { getLatestRatesSchema, getRatesByDateSchema } from './exchange-rates.schema.js';
import { ExchangeRateDocument } from '../../types/index.js';

function serializeRate(doc: ExchangeRateDocument) {
  return {
    date: doc._id,
    baseCurrency: doc.baseCurrency,
    rates: doc.rates,
    source: doc.source,
    fetchedAt: doc.fetchedAt.toISOString(),
  };
}

export const exchangeRatesRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = new ExchangeRatesRepository(fastify.mongo.db);

  // GET /api/exchange-rates - 최신 환율 조회
  fastify.get(
    '/',
    { schema: getLatestRatesSchema },
    async (request, reply) => {
      try {
        const rate = await repository.findLatest();

        if (!rate) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'No exchange rates found' },
          });
        }

        return reply.send({
          success: true,
          data: serializeRate(rate),
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'FETCH_FAILED', message: 'Failed to fetch exchange rates' },
        });
      }
    }
  );

  // GET /api/exchange-rates/:date - 특정 날짜 환율 조회
  fastify.get<{ Params: { date: string } }>(
    '/:date',
    { schema: getRatesByDateSchema },
    async (request, reply) => {
      try {
        const rate = await repository.findByDate(request.params.date);

        if (!rate) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Exchange rates not found for this date' },
          });
        }

        return reply.send({
          success: true,
          data: serializeRate(rate),
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'FETCH_FAILED', message: 'Failed to fetch exchange rates' },
        });
      }
    }
  );
};
