import { FastifyPluginAsync } from 'fastify';
import { PerformanceRepository, PerformanceFilter } from './performance.repository.js';
import { PerformanceService } from './performance.service.js';
import { createPerformanceSchema, batchPerformanceSchema, listPerformanceSchema } from './performance.schema.js';
import { CreatePerformanceInput, BatchPerformanceInput, MetricType } from '../../types/index.js';

interface ListPerformanceQuery {
  deviceId?: string;
  sessionId?: string;
  metricType?: MetricType;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}

interface CreatePerformanceBody extends CreatePerformanceInput {
  deviceId: string;
}

export const performanceRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = new PerformanceRepository(fastify.mongo.db);
  const service = new PerformanceService(repository);

  // POST /api/performance - 단일 성능 기록
  fastify.post<{ Body: CreatePerformanceBody }>(
    '/',
    { schema: createPerformanceSchema },
    async (request, reply) => {
      try {
        const { deviceId, ...input } = request.body;
        const id = await service.createMetric(deviceId, input);

        return reply.status(201).send({
          success: true,
          data: { id },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'CREATE_FAILED', message: 'Failed to create performance metric' },
        });
      }
    }
  );

  // POST /api/performance/batch - 배치 성능 기록
  fastify.post<{ Body: BatchPerformanceInput }>(
    '/batch',
    { schema: batchPerformanceSchema },
    async (request, reply) => {
      try {
        const result = await service.insertBatch(request.body);

        return reply.status(201).send({
          success: true,
          data: result,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'INSERT_FAILED', message: 'Failed to insert performance metrics' },
        });
      }
    }
  );

  // GET /api/performance - 성능 지표 조회
  fastify.get<{ Querystring: ListPerformanceQuery }>(
    '/',
    { schema: listPerformanceSchema },
    async (request, reply) => {
      try {
        const { deviceId, sessionId, metricType, startTime, endTime, limit = 100, offset = 0 } = request.query;

        const filter: PerformanceFilter = {};
        if (deviceId) filter.deviceId = deviceId;
        if (sessionId) filter.sessionId = sessionId;
        if (metricType) filter.metricType = metricType;
        if (startTime) filter.startTime = new Date(startTime);
        if (endTime) filter.endTime = new Date(endTime);

        const { metrics, total } = await service.listMetrics(filter, limit, offset);

        return reply.send({
          success: true,
          data: metrics.map((m) => service.serializeMetric(m)),
          meta: {
            total,
            limit,
            offset,
            hasMore: offset + metrics.length < total,
          },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'FETCH_FAILED', message: 'Failed to fetch performance metrics' },
        });
      }
    }
  );
};
