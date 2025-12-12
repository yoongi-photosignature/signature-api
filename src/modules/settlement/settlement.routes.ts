import { FastifyPluginAsync } from 'fastify';
import { SettlementRepository } from './settlement.repository.js';
import { SettlementService } from './settlement.service.js';
import {
  monthlySettlementSchema,
  domesticSettlementSchema,
  overseasSettlementSchema,
} from './settlement.schema.js';

interface SettlementQuery {
  year: number;
  month: number;
  storeId?: string;
}

export const settlementRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = new SettlementRepository(fastify.mongo.db);
  const service = new SettlementService(repository);

  // GET /api/settlement/monthly - 월간 정산
  fastify.get<{ Querystring: SettlementQuery }>(
    '/monthly',
    { schema: monthlySettlementSchema },
    async (request, reply) => {
      try {
        const { year, month, storeId } = request.query;
        const data = await service.getMonthlySettlement(year, month, storeId);

        return reply.send({
          success: true,
          data,
          meta: { year, month, storeId, count: data.length },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'SETTLEMENT_FAILED', message: 'Failed to fetch monthly settlement' },
        });
      }
    }
  );

  // GET /api/settlement/domestic - 국내 정산
  fastify.get<{ Querystring: SettlementQuery }>(
    '/domestic',
    { schema: domesticSettlementSchema },
    async (request, reply) => {
      try {
        const { year, month } = request.query;
        const data = await service.getDomesticSettlement(year, month);

        return reply.send({
          success: true,
          data,
          meta: { year, month, country: 'KOR', count: data.length },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'SETTLEMENT_FAILED', message: 'Failed to fetch domestic settlement' },
        });
      }
    }
  );

  // GET /api/settlement/overseas - 해외 정산
  fastify.get<{ Querystring: SettlementQuery }>(
    '/overseas',
    { schema: overseasSettlementSchema },
    async (request, reply) => {
      try {
        const { year, month } = request.query;
        const data = await service.getOverseasSettlement(year, month);

        return reply.send({
          success: true,
          data,
          meta: { year, month, count: data.length },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'SETTLEMENT_FAILED', message: 'Failed to fetch overseas settlement' },
        });
      }
    }
  );
};
