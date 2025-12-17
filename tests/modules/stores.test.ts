import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestApp, closeTestApp, TestContext } from '../helpers/test-app.js';
import { storesRoutes } from '../../src/modules/stores/stores.routes.js';
import { StoreDocument } from '../../src/types/index.js';

describe('Stores API', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await createTestApp();
    await context.app.register(storesRoutes, { prefix: '/api/stores' });
  });

  afterEach(async () => {
    await closeTestApp(context);
  });

  describe('GET /api/stores - 매장 목록 조회', () => {
    beforeEach(async () => {
      const now = new Date();
      const testStores: StoreDocument[] = [
        {
          _id: 'store-kr-001',
          name: '강남점',
          group: {
            id: 'group-001',
            name: '직영',
            grade: 'MASTER',
          },
          country: {
            code: 'KR',
            name: '한국',
            currency: 'KRW',
          },
          owner: {
            phone: '010-1234-5678',
          },
          settlement: {
            serverFeeRate: 0.30,
            vatEnabled: true,
          },
          devices: ['device-001', 'device-002'],
          createdAt: now,
          updatedAt: now,
        },
        {
          _id: 'store-kr-002',
          name: '홍대점',
          group: {
            id: 'group-002',
            name: '가맹',
            grade: 'HIGH',
          },
          country: {
            code: 'KR',
            name: '한국',
            currency: 'KRW',
          },
          settlement: {
            serverFeeRate: 0.35,
            vatEnabled: true,
          },
          devices: ['device-003'],
          createdAt: now,
          updatedAt: now,
        },
        {
          _id: 'store-jp-001',
          name: '도쿄 시부야점',
          group: {
            id: 'group-003',
            name: '해외 직영',
            grade: 'MASTER',
          },
          country: {
            code: 'JP',
            name: '일본',
            currency: 'JPY',
          },
          settlement: {
            serverFeeRate: 0.30,
            vatEnabled: false,
          },
          devices: ['device-004'],
          createdAt: now,
          updatedAt: now,
        },
      ];

      await context.db.collection('stores').insertMany(testStores);
    });

    it('전체 매장 목록을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/stores',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(3);
      expect(body.meta.count).toBe(3);
    });

    it('국가별 필터링이 작동해야 함 - KR', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/stores?country=KR',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.data.every((s: any) => s.country.code === 'KR')).toBe(true);
    });

    it('국가별 필터링이 작동해야 함 - JP', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/stores?country=JP',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]._id).toBe('store-jp-001');
      expect(body.data[0].country.code).toBe('JP');
    });

    it('그룹별 필터링이 작동해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/stores?groupId=group-001',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]._id).toBe('store-kr-001');
      expect(body.data[0].group.id).toBe('group-001');
    });

    it('매장이 없을 때 빈 배열을 반환해야 함', async () => {
      // Arrange
      await context.db.collection('stores').deleteMany({});

      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/stores',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
      expect(body.meta.count).toBe(0);
    });
  });

  describe('GET /api/stores/:id - 매장 상세 조회', () => {
    beforeEach(async () => {
      await context.db.collection('stores').insertOne({
        _id: 'store-detail-001',
        name: '상세 조회용 매장',
        group: {
          id: 'group-001',
          name: '직영',
          grade: 'MASTER',
        },
        country: {
          code: 'KR',
          name: '한국',
          currency: 'KRW',
        },
        owner: {
          phone: '010-9999-8888',
        },
        settlement: {
          serverFeeRate: 0.30,
          vatEnabled: true,
        },
        devices: ['device-001', 'device-002'],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('존재하는 매장 ID로 조회 시 상세 정보를 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/stores/store-detail-001',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data._id).toBe('store-detail-001');
      expect(body.data.name).toBe('상세 조회용 매장');
      expect(body.data.devices).toEqual(['device-001', 'device-002']);
      expect(body.data.owner.phone).toBe('010-9999-8888');
    });

    it('존재하지 않는 매장 ID로 조회 시 404를 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/stores/non-existent-store',
      });

      // Assert
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBe('Store not found');
    });
  });

  describe('POST /api/stores - 매장 생성', () => {
    it('유효한 데이터로 매장을 생성해야 함', async () => {
      // Arrange
      const newStore = {
        _id: 'store-new-001',
        name: '신규 매장',
        group: {
          id: 'group-001',
          name: '직영',
          grade: 'MASTER',
        },
        country: {
          code: 'KR',
          name: '한국',
          currency: 'KRW',
        },
        owner: {
          phone: '010-1111-2222',
        },
        settlement: {
          serverFeeRate: 0.30,
          vatEnabled: true,
        },
        devices: [],
      };

      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/stores',
        payload: newStore,
      });

      // Assert
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('store-new-001');

      const inserted = await context.db.collection('stores').findOne({ _id: 'store-new-001' });
      expect(inserted).toBeDefined();
      expect(inserted?.name).toBe('신규 매장');
      expect(inserted?.devices).toEqual([]);
    });

    it('owner 정보 없이 매장을 생성할 수 있어야 함', async () => {
      // Arrange
      const newStore = {
        _id: 'store-no-owner',
        name: '점주 정보 없는 매장',
        group: {
          id: 'group-001',
          name: '직영',
          grade: 'MASTER',
        },
        country: {
          code: 'JP',
          name: '일본',
          currency: 'JPY',
        },
        settlement: {
          serverFeeRate: 0.30,
          vatEnabled: false,
        },
      };

      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/stores',
        payload: newStore,
      });

      // Assert
      expect(response.statusCode).toBe(201);

      const inserted = await context.db.collection('stores').findOne({ _id: 'store-no-owner' });
      expect(inserted).toBeDefined();
      // owner가 없으면 undefined 또는 null일 수 있음
      expect(inserted?.owner == null).toBe(true);
    });

    it('devices 배열이 없으면 빈 배열로 초기화되어야 함', async () => {
      // Arrange
      const newStore = {
        _id: 'store-no-devices',
        name: '기기 없는 매장',
        group: {
          id: 'group-001',
          name: '직영',
          grade: 'MASTER',
        },
        country: {
          code: 'KR',
          name: '한국',
          currency: 'KRW',
        },
        settlement: {
          serverFeeRate: 0.30,
          vatEnabled: true,
        },
      };

      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/stores',
        payload: newStore,
      });

      // Assert
      expect(response.statusCode).toBe(201);

      const inserted = await context.db.collection('stores').findOne({ _id: 'store-no-devices' });
      expect(inserted?.devices).toEqual([]);
    });
  });

  describe('PUT /api/stores/:id - 매장 수정', () => {
    beforeEach(async () => {
      await context.db.collection('stores').insertOne({
        _id: 'store-to-update',
        name: '수정할 매장',
        group: {
          id: 'group-001',
          name: '직영',
          grade: 'MASTER',
        },
        country: {
          code: 'KR',
          name: '한국',
          currency: 'KRW',
        },
        settlement: {
          serverFeeRate: 0.30,
          vatEnabled: true,
        },
        devices: ['device-001'],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('매장 이름을 수정해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PUT',
        url: '/api/stores/store-to-update',
        payload: {
          name: '수정된 매장 이름',
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.updated).toBe(true);

      const updated = await context.db.collection('stores').findOne({ _id: 'store-to-update' });
      expect(updated?.name).toBe('수정된 매장 이름');
    });

    it('정산 정보를 수정해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PUT',
        url: '/api/stores/store-to-update',
        payload: {
          settlement: {
            serverFeeRate: 0.35,
            vatEnabled: false,
          },
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);

      const updated = await context.db.collection('stores').findOne({ _id: 'store-to-update' });
      expect(updated?.settlement.serverFeeRate).toBe(0.35);
      expect(updated?.settlement.vatEnabled).toBe(false);
    });

    it('기기 목록을 수정해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PUT',
        url: '/api/stores/store-to-update',
        payload: {
          devices: ['device-001', 'device-002', 'device-003'],
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);

      const updated = await context.db.collection('stores').findOne({ _id: 'store-to-update' });
      expect(updated?.devices).toEqual(['device-001', 'device-002', 'device-003']);
    });

    it('점주 정보를 추가해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PUT',
        url: '/api/stores/store-to-update',
        payload: {
          owner: {
            phone: '010-5555-6666',
          },
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);

      const updated = await context.db.collection('stores').findOne({ _id: 'store-to-update' });
      expect(updated?.owner?.phone).toBe('010-5555-6666');
    });

    it('존재하지 않는 매장 수정 시 404를 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PUT',
        url: '/api/stores/non-existent-store',
        payload: {
          name: '수정 시도',
        },
      });

      // Assert
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/stores/:id - 매장 삭제', () => {
    beforeEach(async () => {
      await context.db.collection('stores').insertOne({
        _id: 'store-to-delete',
        name: '삭제할 매장',
        group: {
          id: 'group-001',
          name: '직영',
          grade: 'MASTER',
        },
        country: {
          code: 'KR',
          name: '한국',
          currency: 'KRW',
        },
        settlement: {
          serverFeeRate: 0.30,
          vatEnabled: true,
        },
        devices: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('매장을 삭제해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'DELETE',
        url: '/api/stores/store-to-delete',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.deleted).toBe(true);

      const deleted = await context.db.collection('stores').findOne({ _id: 'store-to-delete' });
      expect(deleted).toBeNull();
    });

    it('존재하지 않는 매장 삭제 시 404를 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'DELETE',
        url: '/api/stores/non-existent-store',
      });

      // Assert
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });
});
