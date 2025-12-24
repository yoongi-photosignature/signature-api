import { FastifyPluginAsync } from 'fastify';
import { DailySummaryService } from './daily-summary.service.js';
import { DailySummaryFilter } from './daily-summary.repository.js';
import { listDailySummarySchema, getDailySummarySchema, triggerAggregationSchema } from './daily-summary.schema.js';

interface ListSummaryQuery {
  kioskId?: string;
  storeId?: string;
  groupId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

interface TriggerAggregationBody {
  date: string;
  kioskId?: string;
}

export const dailySummaryRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new DailySummaryService(fastify.mongo.db);

  // GET /api/daily-summary - 일일 요약 목록 조회
  fastify.get<{ Querystring: ListSummaryQuery }>(
    '/',
    { schema: listDailySummarySchema },
    async (request, reply) => {
      try {
        const { kioskId, storeId, groupId, startDate, endDate, limit = 30, offset = 0 } = request.query;

        const filter: DailySummaryFilter = {};
        if (kioskId) filter.kioskId = kioskId;
        if (storeId) filter.storeId = storeId;
        if (groupId) filter.groupId = groupId;
        if (startDate) filter.startDate = startDate;
        if (endDate) filter.endDate = endDate;

        const { summaries, total } = await service.listSummaries(filter, limit, offset);

        return reply.send({
          success: true,
          data: summaries.map((s) => service.serializeSummary(s)),
          meta: {
            total,
            limit,
            offset,
            hasMore: offset + summaries.length < total,
          },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'FETCH_FAILED', message: 'Failed to fetch daily summaries' },
        });
      }
    }
  );

  // GET /api/daily-summary/:date/:kioskId - 특정 일일 요약 조회
  fastify.get<{ Params: { date: string; kioskId: string } }>(
    '/:date/:kioskId',
    { schema: getDailySummarySchema },
    async (request, reply) => {
      try {
        const { date, kioskId } = request.params;
        const summary = await service.getSummary(date, kioskId);

        if (!summary) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Daily summary not found' },
          });
        }

        return reply.send({
          success: true,
          data: service.serializeSummary(summary),
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'FETCH_FAILED', message: 'Failed to fetch daily summary' },
        });
      }
    }
  );

  // POST /api/daily-summary/aggregate - 수동 집계 실행
  fastify.post<{ Body: TriggerAggregationBody }>(
    '/aggregate',
    { schema: triggerAggregationSchema },
    async (request, reply) => {
      try {
        const { date, kioskId } = request.body;
        const count = await service.aggregate(date, kioskId);

        return reply.send({
          success: true,
          data: {
            date,
            kioskId: kioskId || 'all',
            aggregatedKiosks: count,
          },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'AGGREGATION_FAILED', message: 'Failed to aggregate daily summary' },
        });
      }
    }
  );
};
