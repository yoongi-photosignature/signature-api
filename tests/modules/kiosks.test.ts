import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestApp, closeTestApp, TestContext } from '../helpers/test-app.js';
import { kiosksRoutes } from '../../src/modules/kiosks/kiosks.routes.js';
import { KioskDocument } from '../../src/types/index.js';

describe('Kiosks API', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await createTestApp();
    await context.app.register(kiosksRoutes, { prefix: '/api/kiosks' });
  });

  afterEach(async () => {
    await closeTestApp(context);
  });

  describe('GET /api/kiosks - 키오스크 목록 조회', () => {
    beforeEach(async () => {
      const now = new Date();
      const testKiosks: KioskDocument[] = [
        {
          _id: 'kiosk-kr-001',
          name: '강남점 1호기',
          hddSerial: 'HDD-KR-001',
          store: {
            id: 'store-kr-001',
            name: '강남점',
          },
          country: {
            code: 'KR',
            name: '한국',
            currency: 'KRW',
          },
          programType: 'PHOTO_SIGNATURE_V3',
          createdAt: now,
          updatedAt: now,
        },
        {
          _id: 'kiosk-kr-002',
          name: '강남점 2호기',
          hddSerial: 'HDD-KR-002',
          store: {
            id: 'store-kr-001',
            name: '강남점',
          },
          country: {
            code: 'KR',
            name: '한국',
            currency: 'KRW',
          },
          programType: 'PHOTO_SIGNATURE_V3',
          createdAt: now,
          updatedAt: now,
        },
        {
          _id: 'kiosk-jp-001',
          name: '도쿄 시부야점 1호기',
          hddSerial: 'HDD-JP-001',
          store: {
            id: 'store-jp-001',
            name: '도쿄 시부야점',
          },
          country: {
            code: 'JP',
            name: '일본',
            currency: 'JPY',
          },
          programType: 'PHOTO_SIGNATURE_V3',
          createdAt: now,
          updatedAt: now,
        },
      ];

      await context.db.collection('kiosks').insertMany(testKiosks);
    });

    it('전체 키오스크 목록을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/kiosks',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(3);
      expect(body.meta.count).toBe(3);
    });

    it('매장별 필터링이 작동해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/kiosks?storeId=store-kr-001',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.data.every((d: any) => d.store.id === 'store-kr-001')).toBe(true);
    });

    it('국가별 필터링이 작동해야 함 - KR', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/kiosks?country=KR',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.data.every((d: any) => d.country.code === 'KR')).toBe(true);
    });

    it('국가별 필터링이 작동해야 함 - JP', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/kiosks?country=JP',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]._id).toBe('kiosk-jp-001');
      expect(body.data[0].country.code).toBe('JP');
    });

    it('키오스크가 없을 때 빈 배열을 반환해야 함', async () => {
      // Arrange
      await context.db.collection('kiosks').deleteMany({});

      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/kiosks',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
      expect(body.meta.count).toBe(0);
    });
  });

  describe('GET /api/kiosks/:id - 키오스크 상세 조회', () => {
    beforeEach(async () => {
      await context.db.collection('kiosks').insertOne({
        _id: 'kiosk-detail-001',
        name: '상세 조회용 키오스크',
        hddSerial: 'HDD-DETAIL-001',
        store: {
          id: 'store-001',
          name: '테스트 매장',
        },
        country: {
          code: 'KR',
          name: '한국',
          currency: 'KRW',
        },
        programType: 'PHOTO_SIGNATURE_V3',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('존재하는 키오스크 ID로 조회 시 상세 정보를 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/kiosks/kiosk-detail-001',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data._id).toBe('kiosk-detail-001');
      expect(body.data.name).toBe('상세 조회용 키오스크');
      expect(body.data.hddSerial).toBe('HDD-DETAIL-001');
      expect(body.data.store.id).toBe('store-001');
    });

    it('존재하지 않는 키오스크 ID로 조회 시 404를 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/kiosks/non-existent-kiosk',
      });

      // Assert
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBe('Kiosk not found');
    });
  });

  describe('POST /api/kiosks - 키오스크 등록', () => {
    it('유효한 데이터로 키오스크를 등록해야 함', async () => {
      // Arrange
      const newKiosk = {
        _id: 'kiosk-new-001',
        name: '신규 키오스크',
        hddSerial: 'HDD-NEW-001',
        store: {
          id: 'store-001',
          name: '테스트 매장',
        },
        country: {
          code: 'KR',
          name: '한국',
          currency: 'KRW',
        },
        programType: 'PHOTO_SIGNATURE_V3',
      };

      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/kiosks',
        payload: newKiosk,
      });

      // Assert
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('kiosk-new-001');

      const inserted = await context.db.collection('kiosks').findOne({ _id: 'kiosk-new-001' });
      expect(inserted).toBeDefined();
      expect(inserted?.name).toBe('신규 키오스크');
      expect(inserted?.hddSerial).toBe('HDD-NEW-001');
    });

    it('hddSerial 없이 키오스크를 등록할 수 있어야 함', async () => {
      // Arrange
      const newKiosk = {
        _id: 'kiosk-no-serial',
        name: 'HDD 시리얼 없는 키오스크',
        store: {
          id: 'store-001',
          name: '테스트 매장',
        },
        country: {
          code: 'KR',
          name: '한국',
          currency: 'KRW',
        },
        programType: 'PHOTO_SIGNATURE_V2',
      };

      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/kiosks',
        payload: newKiosk,
      });

      // Assert
      expect(response.statusCode).toBe(201);

      const inserted = await context.db.collection('kiosks').findOne({ _id: 'kiosk-no-serial' });
      expect(inserted).toBeDefined();
      // hddSerial이 없으면 undefined 또는 null일 수 있음
      expect(inserted?.hddSerial == null).toBe(true);
    });

    it('다양한 programType으로 키오스크를 등록할 수 있어야 함', async () => {
      // Arrange
      const kiosks = [
        {
          _id: 'kiosk-v2',
          name: 'V2 키오스크',
          store: { id: 'store-001', name: '매장' },
          country: { code: 'KR', name: '한국', currency: 'KRW' },
          programType: 'PHOTO_SIGNATURE_V2',
        },
        {
          _id: 'kiosk-v3',
          name: 'V3 키오스크',
          store: { id: 'store-001', name: '매장' },
          country: { code: 'KR', name: '한국', currency: 'KRW' },
          programType: 'PHOTO_SIGNATURE_V3',
        },
      ];

      for (const kiosk of kiosks) {
        // Act
        const response = await context.app.inject({
          method: 'POST',
          url: '/api/kiosks',
          payload: kiosk,
        });

        // Assert
        expect(response.statusCode).toBe(201);
      }

      const count = await context.db.collection('kiosks').countDocuments();
      expect(count).toBe(2);
    });
  });

  describe('PUT /api/kiosks/:id - 키오스크 수정', () => {
    beforeEach(async () => {
      await context.db.collection('kiosks').insertOne({
        _id: 'kiosk-to-update',
        name: '수정할 키오스크',
        hddSerial: 'HDD-OLD',
        store: {
          id: 'store-001',
          name: '기존 매장',
        },
        country: {
          code: 'KR',
          name: '한국',
          currency: 'KRW',
        },
        programType: 'PHOTO_SIGNATURE_V2',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('키오스크 이름을 수정해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PUT',
        url: '/api/kiosks/kiosk-to-update',
        payload: {
          name: '수정된 키오스크 이름',
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.updated).toBe(true);

      const updated = await context.db.collection('kiosks').findOne({ _id: 'kiosk-to-update' });
      expect(updated?.name).toBe('수정된 키오스크 이름');
    });

    it('HDD 시리얼을 수정해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PUT',
        url: '/api/kiosks/kiosk-to-update',
        payload: {
          hddSerial: 'HDD-NEW',
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);

      const updated = await context.db.collection('kiosks').findOne({ _id: 'kiosk-to-update' });
      expect(updated?.hddSerial).toBe('HDD-NEW');
    });

    it('매장 정보를 수정해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PUT',
        url: '/api/kiosks/kiosk-to-update',
        payload: {
          store: {
            id: 'store-002',
            name: '새로운 매장',
          },
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);

      const updated = await context.db.collection('kiosks').findOne({ _id: 'kiosk-to-update' });
      expect(updated?.store.id).toBe('store-002');
      expect(updated?.store.name).toBe('새로운 매장');
    });

    it('프로그램 타입을 수정해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PUT',
        url: '/api/kiosks/kiosk-to-update',
        payload: {
          programType: 'PHOTO_SIGNATURE_V3',
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);

      const updated = await context.db.collection('kiosks').findOne({ _id: 'kiosk-to-update' });
      expect(updated?.programType).toBe('PHOTO_SIGNATURE_V3');
    });

    it('국가 정보를 수정해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PUT',
        url: '/api/kiosks/kiosk-to-update',
        payload: {
          country: {
            code: 'JP',
            name: '일본',
            currency: 'JPY',
          },
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);

      const updated = await context.db.collection('kiosks').findOne({ _id: 'kiosk-to-update' });
      expect(updated?.country.code).toBe('JP');
      expect(updated?.country.currency).toBe('JPY');
    });

    it('존재하지 않는 키오스크 수정 시 404를 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PUT',
        url: '/api/kiosks/non-existent-kiosk',
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

  describe('DELETE /api/kiosks/:id - 키오스크 삭제', () => {
    beforeEach(async () => {
      await context.db.collection('kiosks').insertOne({
        _id: 'kiosk-to-delete',
        name: '삭제할 키오스크',
        store: {
          id: 'store-001',
          name: '테스트 매장',
        },
        country: {
          code: 'KR',
          name: '한국',
          currency: 'KRW',
        },
        programType: 'PHOTO_SIGNATURE_V3',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('키오스크를 삭제해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'DELETE',
        url: '/api/kiosks/kiosk-to-delete',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.deleted).toBe(true);

      const deleted = await context.db.collection('kiosks').findOne({ _id: 'kiosk-to-delete' });
      expect(deleted).toBeNull();
    });

    it('존재하지 않는 키오스크 삭제 시 404를 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'DELETE',
        url: '/api/kiosks/non-existent-kiosk',
      });

      // Assert
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });
});
