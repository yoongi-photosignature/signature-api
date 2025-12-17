import { FastifyPluginAsync } from 'fastify';
import { ConfigRepository } from './config.repository.js';
import { getConfigByIdSchema, updateConfigSchema } from './config.schema.js';
import { ConfigDocument } from '../../types/index.js';

function serializeConfig(doc: ConfigDocument) {
  return {
    ...doc,
    lastUpdated: doc.lastUpdated?.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

interface UpdateConfigBody {
  values?: Record<string, unknown>;
  domestic?: number;
  overseas?: number;
  provider?: string;
  endpoint?: string;
  updateFrequency?: string;
  updatedBy: string;
}

export const configRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = new ConfigRepository(fastify.mongo.db);

  // GET /api/config - 전체 설정 조회
  fastify.get(
    '/',
    async (request, reply) => {
      try {
        const configs = await repository.findAll();

        return reply.send({
          success: true,
          data: configs.map(serializeConfig),
          meta: { count: configs.length },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'FETCH_FAILED', message: 'Failed to fetch configs' },
        });
      }
    }
  );

  // GET /api/config/:key - 특정 설정 조회
  fastify.get<{ Params: { key: string } }>(
    '/:key',
    { schema: getConfigByIdSchema },
    async (request, reply) => {
      try {
        const config = await repository.findById(request.params.key);

        if (!config) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Config not found' },
          });
        }

        return reply.send({
          success: true,
          data: serializeConfig(config),
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'FETCH_FAILED', message: 'Failed to fetch config' },
        });
      }
    }
  );

  // PUT /api/config/:key - 설정 수정 (없으면 생성)
  fastify.put<{ Params: { key: string }; Body: UpdateConfigBody }>(
    '/:key',
    { schema: updateConfigSchema },
    async (request, reply) => {
      try {
        const { key } = request.params;
        const { updatedBy, ...data } = request.body;

        await repository.upsert(key, data, updatedBy);

        return reply.send({
          success: true,
          data: { key, updated: true },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'UPDATE_FAILED', message: 'Failed to update config' },
        });
      }
    }
  );
};
