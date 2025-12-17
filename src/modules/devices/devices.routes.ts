import { FastifyPluginAsync } from 'fastify';
import { DevicesRepository } from './devices.repository.js';
import {
  getDevicesSchema,
  getDeviceByIdSchema,
  createDeviceSchema,
  updateDeviceSchema,
} from './devices.schema.js';
import { CreateDeviceInput, UpdateDeviceInput, DeviceDocument } from '../../types/index.js';

function serializeDevice(doc: DeviceDocument) {
  return {
    ...doc,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const devicesRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = new DevicesRepository(fastify.mongo.db);

  // GET /api/devices - 기기 목록 조회
  fastify.get<{ Querystring: { storeId?: string; country?: string } }>(
    '/',
    { schema: getDevicesSchema },
    async (request, reply) => {
      try {
        const { storeId, country } = request.query;

        let devices: DeviceDocument[];
        if (storeId) {
          devices = await repository.findByStore(storeId);
        } else if (country) {
          devices = await repository.findByCountry(country);
        } else {
          devices = await repository.findAll();
        }

        return reply.send({
          success: true,
          data: devices.map(serializeDevice),
          meta: { count: devices.length },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'FETCH_FAILED', message: 'Failed to fetch devices' },
        });
      }
    }
  );

  // GET /api/devices/:id - 기기 상세 조회
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { schema: getDeviceByIdSchema },
    async (request, reply) => {
      try {
        const device = await repository.findById(request.params.id);

        if (!device) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Device not found' },
          });
        }

        return reply.send({
          success: true,
          data: serializeDevice(device),
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'FETCH_FAILED', message: 'Failed to fetch device' },
        });
      }
    }
  );

  // POST /api/devices - 기기 등록
  fastify.post<{ Body: CreateDeviceInput }>(
    '/',
    { schema: createDeviceSchema },
    async (request, reply) => {
      try {
        const input = request.body;
        const now = new Date();

        const device: DeviceDocument = {
          _id: input._id,
          name: input.name,
          hddSerial: input.hddSerial,
          store: input.store,
          country: input.country,
          programType: input.programType,
          createdAt: now,
          updatedAt: now,
        };

        const id = await repository.create(device);

        return reply.status(201).send({
          success: true,
          data: { id },
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'CREATE_FAILED', message: 'Failed to create device' },
        });
      }
    }
  );

  // PUT /api/devices/:id - 기기 수정
  fastify.put<{ Params: { id: string }; Body: UpdateDeviceInput }>(
    '/:id',
    { schema: updateDeviceSchema },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const input = request.body;

        const existing = await repository.findById(id);
        if (!existing) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Device not found' },
          });
        }

        const updateData: Partial<DeviceDocument> = {};
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
          error: { code: 'UPDATE_FAILED', message: 'Failed to update device' },
        });
      }
    }
  );

  // DELETE /api/devices/:id - 기기 삭제
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { schema: getDeviceByIdSchema },
    async (request, reply) => {
      try {
        const { id } = request.params;

        const deleted = await repository.delete(id);

        if (!deleted) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Device not found' },
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
          error: { code: 'DELETE_FAILED', message: 'Failed to delete device' },
        });
      }
    }
  );
};
