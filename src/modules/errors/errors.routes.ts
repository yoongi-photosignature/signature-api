import { FastifyPluginAsync } from 'fastify';
import { ErrorsRepository, ErrorFilter } from './errors.repository.js';
import { ErrorsService } from './errors.service.js';
import { createErrorSchema, listErrorsSchema, getErrorSchema, resolveErrorSchema } from './errors.schema.js';
import { CreateErrorInput, ErrorSeverity, ErrorCategory } from '../../types/index.js';

interface ListErrorsQuery {
  kioskId?: string;
  sessionId?: string;
  severity?: ErrorSeverity;
  category?: ErrorCategory;
  errorCode?: string;
  resolved?: boolean;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}

interface CreateErrorBody extends CreateErrorInput {
  kioskId: string;
}

export const errorsRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = new ErrorsRepository(fastify.mongo.db);
  const service = new ErrorsService(repository);

  // POST /api/errors - 에러 리포트
  fastify.post<{ Body: CreateErrorBody }>(
    '/',
    { schema: createErrorSchema },
    async (request, reply) => {
      try {
        const { kioskId, ...input } = request.body;
        const id = await service.createError(kioskId, input);

        // Critical 에러의 경우 로그 남김
        if (input.severity === 'critical') {
          request.log.error({
            type: 'CRITICAL_ERROR',
            kioskId,
            errorCode: input.errorCode,
            errorMessage: input.errorMessage,
          });
        }

        return reply.status(201).send({
          success: true,
          data: { id },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'CREATE_FAILED', message: 'Failed to create error report' },
        });
      }
    }
  );

  // GET /api/errors - 에러 목록 조회
  fastify.get<{ Querystring: ListErrorsQuery }>(
    '/',
    { schema: listErrorsSchema },
    async (request, reply) => {
      try {
        const {
          kioskId, sessionId, severity, category, errorCode,
          resolved, startTime, endTime, limit = 50, offset = 0
        } = request.query;

        const filter: ErrorFilter = {};
        if (kioskId) filter.kioskId = kioskId;
        if (sessionId) filter.sessionId = sessionId;
        if (severity) filter.severity = severity;
        if (category) filter.category = category;
        if (errorCode) filter.errorCode = errorCode;
        if (resolved !== undefined) filter.resolved = resolved;
        if (startTime) filter.startTime = new Date(startTime);
        if (endTime) filter.endTime = new Date(endTime);

        const { errors, total } = await service.listErrors(filter, limit, offset);

        return reply.send({
          success: true,
          data: errors.map((e) => service.serializeError(e)),
          meta: {
            total,
            limit,
            offset,
            hasMore: offset + errors.length < total,
          },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'FETCH_FAILED', message: 'Failed to fetch errors' },
        });
      }
    }
  );

  // GET /api/errors/:id - 에러 상세 조회
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { schema: getErrorSchema },
    async (request, reply) => {
      try {
        const error = await service.getError(request.params.id);

        if (!error) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Error not found' },
          });
        }

        return reply.send({
          success: true,
          data: service.serializeError(error),
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'FETCH_FAILED', message: 'Failed to fetch error' },
        });
      }
    }
  );

  // PATCH /api/errors/:id/resolve - 에러 해결 표시
  fastify.patch<{ Params: { id: string } }>(
    '/:id/resolve',
    { schema: resolveErrorSchema },
    async (request, reply) => {
      try {
        const success = await service.resolveError(request.params.id);

        if (!success) {
          return reply.status(400).send({
            success: false,
            error: { code: 'RESOLVE_FAILED', message: 'Error not found or already resolved' },
          });
        }

        return reply.send({
          success: true,
          data: { resolved: true },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'RESOLVE_FAILED', message: 'Failed to resolve error' },
        });
      }
    }
  );
};
