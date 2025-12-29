import { FastifyPluginAsync } from 'fastify';
import { KiosksRepository } from './kiosks.repository.js';
import {
  getKiosksSchema,
  getKioskByIdSchema,
  createKioskSchema,
  updateKioskSchema,
} from './kiosks.schema.js';
import { CreateKioskInput, UpdateKioskInput, KioskDocument } from '../../types/index.js';

function serializeKiosk(doc: KioskDocument) {
  return {
    ...doc,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const kiosksRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = new KiosksRepository(fastify.mongo.db);

  // GET /api/kiosks - 키오스크 목록 조회
  fastify.get<{ Querystring: { storeId?: string; country?: string } }>(
    '/',
    { schema: getKiosksSchema },
    async (request, reply) => {
      try {
        const { storeId, country } = request.query;

        let kiosks: KioskDocument[];
        if (storeId) {
          kiosks = await repository.findByStore(storeId);
        } else if (country) {
          kiosks = await repository.findByCountry(country);
        } else {
          kiosks = await repository.findAll();
        }

        return reply.send({
          success: true,
          data: kiosks.map(serializeKiosk),
          meta: { count: kiosks.length },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'FETCH_FAILED', message: 'Failed to fetch kiosks' },
        });
      }
    }
  );

  // GET /api/kiosks/:id - 키오스크 상세 조회
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { schema: getKioskByIdSchema },
    async (request, reply) => {
      try {
        const kiosk = await repository.findById(request.params.id);

        if (!kiosk) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Kiosk not found' },
          });
        }

        return reply.send({
          success: true,
          data: serializeKiosk(kiosk),
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'FETCH_FAILED', message: 'Failed to fetch kiosk' },
        });
      }
    }
  );

  // POST /api/kiosks - 키오스크 등록
  fastify.post<{ Body: CreateKioskInput }>(
    '/',
    { schema: createKioskSchema },
    async (request, reply) => {
      try {
        const input = request.body;
        const now = new Date();

        const kiosk: KioskDocument = {
          _id: input._id,
          name: input.name,
          hddSerial: input.hddSerial,
          store: input.store,
          country: input.country,
          programType: input.programType,
          createdAt: now,
          updatedAt: now,
        };

        const id = await repository.create(kiosk);

        return reply.status(201).send({
          success: true,
          data: { id },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'CREATE_FAILED', message: 'Failed to create kiosk' },
        });
      }
    }
  );

  // PUT /api/kiosks/:id - 키오스크 수정
  fastify.put<{ Params: { id: string }; Body: UpdateKioskInput }>(
    '/:id',
    { schema: updateKioskSchema },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const input = request.body;

        const existing = await repository.findById(id);
        if (!existing) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Kiosk not found' },
          });
        }

        const updateData: Partial<KioskDocument> = {};
        if (input.name) updateData.name = input.name;
        if (input.hddSerial) updateData.hddSerial = input.hddSerial;
        if (input.store) updateData.store = input.store;
        if (input.country) updateData.country = input.country;
        if (input.programType) updateData.programType = input.programType;

        await repository.update(id, updateData);

        return reply.send({
          success: true,
          data: { updated: true },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'UPDATE_FAILED', message: 'Failed to update kiosk' },
        });
      }
    }
  );

  // DELETE /api/kiosks/:id - 키오스크 삭제
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { schema: getKioskByIdSchema },
    async (request, reply) => {
      try {
        const { id } = request.params;

        const deleted = await repository.delete(id);

        if (!deleted) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Kiosk not found' },
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
          error: { code: 'DELETE_FAILED', message: 'Failed to delete kiosk' },
        });
      }
    }
  );
};
