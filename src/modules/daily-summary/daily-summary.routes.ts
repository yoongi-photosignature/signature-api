import { FastifyPluginAsync } from 'fastify';
import { DailySummaryService } from './daily-summary.service.js';
import { DailySummaryFilter } from './daily-summary.repository.js';
import { listDailySummarySchema, getDailySummarySchema, triggerAggregationSchema } from './daily-summary.schema.js';

interface ListSummaryQuery {
  deviceId?: string;
  storeId?: string;
  groupId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

interface TriggerAggregationBody {
  date: string;
  deviceId?: string;
}

export const dailySummaryRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new DailySummaryService(fastify.mongo.db);

  // GET /api/daily-summary - 일일 요약 목록 조회
  fastify.get<{ Querystring: ListSummaryQuery }>(
    '/',
    { schema: listDailySummarySchema },
    async (request, reply) => {
      try {
        const { deviceId, storeId, groupId, startDate, endDate, limit = 30, offset = 0 } = request.query;

        const filter: DailySummaryFilter = {};
        if (deviceId) filter.deviceId = deviceId;
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

  // GET /api/daily-summary/:date/:deviceId - 특정 일일 요약 조회
  fastify.get<{ Params: { date: string; deviceId: string } }>(
    '/:date/:deviceId',
    { schema: getDailySummarySchema },
    async (request, reply) => {
      try {
        const { date, deviceId } = request.params;
        const summary = await service.getSummary(date, deviceId);

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
        const { date, deviceId } = request.body;
        const count = await service.aggregate(date, deviceId);

        return reply.send({
          success: true,
          data: {
            date,
            deviceId: deviceId || 'all',
            aggregatedDevices: count,
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
