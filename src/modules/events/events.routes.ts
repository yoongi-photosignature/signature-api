import { FastifyPluginAsync } from 'fastify';
import { EventsRepository, EventFilter } from './events.repository.js';
import { EventsService } from './events.service.js';
import { batchEventsSchema, listEventsSchema, getSessionEventsSchema } from './events.schema.js';
import { BatchEventsInput, EventType } from '../../types/index.js';

interface ListEventsQuery {
  sessionId?: string;
  kioskId?: string;
  eventType?: EventType;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}

export const eventsRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = new EventsRepository(fastify.mongo.db);
  const service = new EventsService(repository);

  // POST /api/events/batch - 이벤트 배치 삽입
  fastify.post<{ Body: BatchEventsInput }>(
    '/batch',
    { schema: batchEventsSchema },
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
          error: { code: 'INSERT_FAILED', message: 'Failed to insert events' },
        });
      }
    }
  );

  // GET /api/events - 이벤트 목록 조회
  fastify.get<{ Querystring: ListEventsQuery }>(
    '/',
    { schema: listEventsSchema },
    async (request, reply) => {
      try {
        const { sessionId, kioskId, eventType, startTime, endTime, limit = 100, offset = 0 } = request.query;

        const filter: EventFilter = {};
        if (sessionId) filter.sessionId = sessionId;
        if (kioskId) filter.kioskId = kioskId;
        if (eventType) filter.eventType = eventType;
        if (startTime) filter.startTime = new Date(startTime);
        if (endTime) filter.endTime = new Date(endTime);

        const { events, total } = await service.listEvents(filter, limit, offset);

        return reply.send({
          success: true,
          data: events.map((e) => service.serializeEvent(e)),
          meta: {
            total,
            limit,
            offset,
            hasMore: offset + events.length < total,
          },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'FETCH_FAILED', message: 'Failed to fetch events' },
        });
      }
    }
  );

  // GET /api/events/session/:sessionId - 세션별 이벤트 조회
  fastify.get<{ Params: { sessionId: string } }>(
    '/session/:sessionId',
    { schema: getSessionEventsSchema },
    async (request, reply) => {
      try {
        const events = await service.getEventsBySession(request.params.sessionId);

        return reply.send({
          success: true,
          data: events.map((e) => service.serializeEvent(e)),
          meta: { count: events.length },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'FETCH_FAILED', message: 'Failed to fetch session events' },
        });
      }
    }
  );
};
