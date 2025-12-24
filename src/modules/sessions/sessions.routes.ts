import { FastifyPluginAsync } from 'fastify';
import { SessionsRepository, SessionFilter } from './sessions.repository.js';
import { SessionsService } from './sessions.service.js';
import {
  createSessionSchema,
  getSessionSchema,
  updateSessionSchema,
  listSessionsSchema,
} from './sessions.schema.js';
import { CreateSessionInput, UpdateSessionInput, SessionStatus } from '../../types/index.js';

interface ListSessionsQuery {
  kioskId?: string;
  storeId?: string;
  groupId?: string;
  status?: SessionStatus;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export const sessionsRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = new SessionsRepository(fastify.mongo.db);
  const service = new SessionsService(repository);

  // POST /api/sessions - 세션 생성
  fastify.post<{ Body: CreateSessionInput }>(
    '/',
    { schema: createSessionSchema },
    async (request, reply) => {
      try {
        // 중복 세션 체크
        const existing = await service.getSession(request.body.sessionId);
        if (existing) {
          return reply.status(409).send({
            success: false,
            error: { code: 'DUPLICATE_SESSION', message: 'Session already exists' },
          });
        }

        const sessionId = await service.createSession(request.body);
        return reply.status(201).send({
          success: true,
          data: { sessionId },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'CREATE_FAILED', message: 'Failed to create session' },
        });
      }
    }
  );

  // GET /api/sessions/:sessionId - 세션 조회
  fastify.get<{ Params: { sessionId: string } }>(
    '/:sessionId',
    { schema: getSessionSchema },
    async (request, reply) => {
      try {
        const session = await service.getSession(request.params.sessionId);

        if (!session) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Session not found' },
          });
        }

        return reply.send({
          success: true,
          data: service.serializeSession(session),
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'FETCH_FAILED', message: 'Failed to fetch session' },
        });
      }
    }
  );

  // PATCH /api/sessions/:sessionId - 세션 업데이트
  fastify.patch<{ Params: { sessionId: string }; Body: UpdateSessionInput }>(
    '/:sessionId',
    { schema: updateSessionSchema },
    async (request, reply) => {
      try {
        const success = await service.updateSession(request.params.sessionId, request.body);

        if (!success) {
          return reply.status(400).send({
            success: false,
            error: { code: 'UPDATE_FAILED', message: 'Failed to update session' },
          });
        }

        return reply.send({
          success: true,
          data: { updated: true },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update session';
        request.log.error(error);

        if (message === 'Session not found') {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message },
          });
        }

        return reply.status(500).send({
          success: false,
          error: { code: 'UPDATE_FAILED', message },
        });
      }
    }
  );

  // GET /api/sessions - 세션 목록 조회
  fastify.get<{ Querystring: ListSessionsQuery }>(
    '/',
    { schema: listSessionsSchema },
    async (request, reply) => {
      try {
        const { kioskId, storeId, groupId, status, startDate, endDate, limit = 20, offset = 0 } = request.query;

        const filter: SessionFilter = {};
        if (kioskId) filter.kioskId = kioskId;
        if (storeId) filter.storeId = storeId;
        if (groupId) filter.groupId = groupId;
        if (status) filter.status = status;
        if (startDate) filter.startDate = new Date(startDate);
        if (endDate) {
          // endDate는 해당 날짜의 끝까지 포함
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          filter.endDate = end;
        }

        const { sessions, total } = await service.listSessions(filter, limit, offset);

        return reply.send({
          success: true,
          data: sessions.map((s) => service.serializeSession(s)),
          meta: {
            total,
            limit,
            offset,
            hasMore: offset + sessions.length < total,
          },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'FETCH_FAILED', message: 'Failed to fetch sessions' },
        });
      }
    }
  );
};
