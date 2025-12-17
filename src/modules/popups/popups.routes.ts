import { FastifyPluginAsync } from 'fastify';
import { PopupsRepository } from './popups.repository.js';
import {
  getPopupsSchema,
  getPopupByIdSchema,
  createPopupSchema,
  updatePopupSchema,
  updatePopupStatusSchema,
} from './popups.schema.js';
import { CreatePopupInput, UpdatePopupInput, PopupStatus, PopupDocument } from '../../types/index.js';

function serializePopup(doc: PopupDocument) {
  return {
    ...doc,
    period: {
      start: doc.period.start.toISOString().split('T')[0],
      end: doc.period.end.toISOString().split('T')[0],
    },
    endedAt: doc.endedAt?.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const popupsRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = new PopupsRepository(fastify.mongo.db);

  // GET /api/popups - 팝업 목록 조회
  fastify.get<{ Querystring: { status?: PopupStatus } }>(
    '/',
    { schema: getPopupsSchema },
    async (request, reply) => {
      try {
        const { status } = request.query;
        const popups = status
          ? await repository.findByStatus(status)
          : await repository.findAll();

        return reply.send({
          success: true,
          data: popups.map(serializePopup),
          meta: { count: popups.length },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'FETCH_FAILED', message: 'Failed to fetch popups' },
        });
      }
    }
  );

  // GET /api/popups/active - 활성 팝업 조회 (키오스크용)
  fastify.get(
    '/active',
    async (request, reply) => {
      try {
        const popups = await repository.findActive();

        return reply.send({
          success: true,
          data: popups.map(serializePopup),
          meta: { count: popups.length },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'FETCH_FAILED', message: 'Failed to fetch active popups' },
        });
      }
    }
  );

  // GET /api/popups/:id - 팝업 상세 조회
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { schema: getPopupByIdSchema },
    async (request, reply) => {
      try {
        const popup = await repository.findById(request.params.id);

        if (!popup) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Popup not found' },
          });
        }

        return reply.send({
          success: true,
          data: serializePopup(popup),
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'FETCH_FAILED', message: 'Failed to fetch popup' },
        });
      }
    }
  );

  // POST /api/popups - 팝업 생성
  fastify.post<{ Body: CreatePopupInput }>(
    '/',
    { schema: createPopupSchema },
    async (request, reply) => {
      try {
        const input = request.body;
        const now = new Date();

        const popup: PopupDocument = {
          _id: input._id,
          name: input.name,
          character: input.character,
          status: input.status,
          period: {
            start: new Date(input.period.start),
            end: new Date(input.period.end),
          },
          countries: input.countries,
          revenueConfig: input.revenueConfig,
          discountConfig: input.discountConfig ? {
            type: input.discountConfig.type,
            rouletteRates: input.discountConfig.rouletteRates,
            maxDiscount: input.discountConfig.maxDiscount
              ? parseFloat(input.discountConfig.maxDiscount)
              : undefined,
          } : undefined,
          pricing: input.pricing ? Object.fromEntries(
            Object.entries(input.pricing).map(([key, val]) => [
              key,
              { price: parseFloat(val.price), printCount: val.printCount },
            ])
          ) : undefined,
          createdAt: now,
          updatedAt: now,
        };

        const id = await repository.create(popup);

        return reply.status(201).send({
          success: true,
          data: { id },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'CREATE_FAILED', message: 'Failed to create popup' },
        });
      }
    }
  );

  // PUT /api/popups/:id - 팝업 수정
  fastify.put<{ Params: { id: string }; Body: UpdatePopupInput }>(
    '/:id',
    { schema: updatePopupSchema },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const input = request.body;

        const existing = await repository.findById(id);
        if (!existing) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Popup not found' },
          });
        }

        const updateData: Partial<PopupDocument> = {};

        if (input.name) updateData.name = input.name;
        if (input.character) updateData.character = input.character;
        if (input.period) {
          updateData.period = {
            start: new Date(input.period.start),
            end: new Date(input.period.end),
          };
        }
        if (input.countries) updateData.countries = input.countries;
        if (input.revenueConfig) updateData.revenueConfig = input.revenueConfig;
        if (input.discountConfig) {
          updateData.discountConfig = {
            type: input.discountConfig.type,
            rouletteRates: input.discountConfig.rouletteRates,
            maxDiscount: input.discountConfig.maxDiscount
              ? parseFloat(input.discountConfig.maxDiscount)
              : undefined,
          };
        }
        if (input.pricing) {
          updateData.pricing = Object.fromEntries(
            Object.entries(input.pricing).map(([key, val]) => [
              key,
              { price: parseFloat(val.price), printCount: val.printCount },
            ])
          );
        }

        await repository.update(id, updateData);

        return reply.send({
          success: true,
          data: { updated: true },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'UPDATE_FAILED', message: 'Failed to update popup' },
        });
      }
    }
  );

  // PUT /api/popups/:id/status - 팝업 상태 변경
  fastify.put<{ Params: { id: string }; Body: { status: PopupStatus } }>(
    '/:id/status',
    { schema: updatePopupStatusSchema },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const { status } = request.body;

        const existing = await repository.findById(id);
        if (!existing) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Popup not found' },
          });
        }

        await repository.updateStatus(id, status);

        return reply.send({
          success: true,
          data: { status },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'UPDATE_FAILED', message: 'Failed to update popup status' },
        });
      }
    }
  );

  // DELETE /api/popups/:id - 팝업 삭제
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { schema: getPopupByIdSchema },
    async (request, reply) => {
      try {
        const { id } = request.params;

        const deleted = await repository.delete(id);

        if (!deleted) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Popup not found' },
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
          error: { code: 'DELETE_FAILED', message: 'Failed to delete popup' },
        });
      }
    }
  );
};
