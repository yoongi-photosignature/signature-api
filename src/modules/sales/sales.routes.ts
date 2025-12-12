import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { SalesRepository } from './sales.repository.js';
import { SalesService } from './sales.service.js';
import { createSaleSchema, getSaleSchema, refundSaleSchema } from './sales.schema.js';
import { CreateSaleInput, RefundInput } from '../../types/index.js';

export const salesRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = new SalesRepository(fastify.mongo.db);
  const service = new SalesService(repository);

  // POST /api/sales - 신규 거래 기록
  fastify.post<{ Body: CreateSaleInput }>(
    '/',
    { schema: createSaleSchema },
    async (request, reply) => {
      try {
        const id = await service.createSale(request.body);
        return reply.status(201).send({
          success: true,
          data: { id },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'CREATE_FAILED', message: 'Failed to create sale' },
        });
      }
    }
  );

  // GET /api/sales/:id - 거래 조회
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { schema: getSaleSchema },
    async (request, reply) => {
      try {
        const sale = await service.getSale(request.params.id);

        if (!sale) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Sale not found' },
          });
        }

        return reply.send({
          success: true,
          data: service.serializeSale(sale),
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'FETCH_FAILED', message: 'Failed to fetch sale' },
        });
      }
    }
  );

  // PUT /api/sales/:id/refund - 환불 처리
  fastify.put<{ Params: { id: string }; Body: RefundInput }>(
    '/:id/refund',
    { schema: refundSaleSchema },
    async (request, reply) => {
      try {
        const success = await service.processRefund(request.params.id, request.body);

        if (!success) {
          return reply.status(400).send({
            success: false,
            error: { code: 'REFUND_FAILED', message: 'Failed to process refund' },
          });
        }

        return reply.send({
          success: true,
          data: { refunded: true },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to process refund';
        request.log.error(error);

        if (message === 'Sale not found') {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message },
          });
        }

        if (message === 'Only completed sales can be refunded') {
          return reply.status(400).send({
            success: false,
            error: { code: 'INVALID_STATUS', message },
          });
        }

        return reply.status(500).send({
          success: false,
          error: { code: 'REFUND_FAILED', message },
        });
      }
    }
  );
};
