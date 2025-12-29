import { FastifyPluginAsync } from 'fastify';
import { StoresRepository } from './stores.repository.js';
import {
  getStoresSchema,
  getStoreByIdSchema,
  createStoreSchema,
  updateStoreSchema,
} from './stores.schema.js';
import { CreateStoreInput, UpdateStoreInput, StoreDocument } from '../../types/index.js';

function serializeStore(doc: StoreDocument) {
  return {
    ...doc,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const storesRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = new StoresRepository(fastify.mongo.db);

  // GET /api/stores - 매장 목록 조회
  fastify.get<{ Querystring: { country?: string; groupId?: string } }>(
    '/',
    { schema: getStoresSchema },
    async (request, reply) => {
      try {
        const { country, groupId } = request.query;

        let stores: StoreDocument[];
        if (country) {
          stores = await repository.findByCountry(country);
        } else if (groupId) {
          stores = await repository.findByGroup(groupId);
        } else {
          stores = await repository.findAll();
        }

        return reply.send({
          success: true,
          data: stores.map(serializeStore),
          meta: { count: stores.length },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'FETCH_FAILED', message: 'Failed to fetch stores' },
        });
      }
    }
  );

  // GET /api/stores/:id - 매장 상세 조회
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { schema: getStoreByIdSchema },
    async (request, reply) => {
      try {
        const store = await repository.findById(request.params.id);

        if (!store) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Store not found' },
          });
        }

        return reply.send({
          success: true,
          data: serializeStore(store),
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'FETCH_FAILED', message: 'Failed to fetch store' },
        });
      }
    }
  );

  // POST /api/stores - 매장 생성
  fastify.post<{ Body: CreateStoreInput }>(
    '/',
    { schema: createStoreSchema },
    async (request, reply) => {
      try {
        const input = request.body;
        const now = new Date();

        const store: StoreDocument = {
          _id: input._id,
          name: input.name,
          group: input.group,
          country: input.country,
          owner: input.owner,
          settlement: input.settlement,
          kiosks: input.kiosks || [],
          createdAt: now,
          updatedAt: now,
        };

        const id = await repository.create(store);

        return reply.status(201).send({
          success: true,
          data: { id },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'CREATE_FAILED', message: 'Failed to create store' },
        });
      }
    }
  );

  // PUT /api/stores/:id - 매장 수정
  fastify.put<{ Params: { id: string }; Body: UpdateStoreInput }>(
    '/:id',
    { schema: updateStoreSchema },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const input = request.body;

        const existing = await repository.findById(id);
        if (!existing) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Store not found' },
          });
        }

        const updateData: Partial<StoreDocument> = {};
        if (input.name) updateData.name = input.name;
        if (input.group) updateData.group = input.group;
        if (input.country) updateData.country = input.country;
        if (input.owner) updateData.owner = input.owner;
        if (input.settlement) updateData.settlement = input.settlement;
        if (input.kiosks) updateData.kiosks = input.kiosks;

        await repository.update(id, updateData);

        return reply.send({
          success: true,
          data: { updated: true },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'UPDATE_FAILED', message: 'Failed to update store' },
        });
      }
    }
  );

  // DELETE /api/stores/:id - 매장 삭제
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { schema: getStoreByIdSchema },
    async (request, reply) => {
      try {
        const { id } = request.params;

        const deleted = await repository.delete(id);

        if (!deleted) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Store not found' },
          });
        }

        return reply.send({
          success: true,
          data: { deleted: true },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'DELETE_FAILED', message: 'Failed to delete store' },
        });
      }
    }
  );
};
