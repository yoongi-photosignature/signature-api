import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestApp, closeTestApp, TestContext } from '../helpers/test-app.js';
import { popupsRoutes } from '../../src/modules/popups/popups.routes.js';
import { PopupDocument } from '../../src/types/index.js';

describe('Popups API', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await createTestApp();
    await context.app.register(popupsRoutes, { prefix: '/api/popups' });
  });

  afterEach(async () => {
    await closeTestApp(context);
  });

  describe('GET /api/popups - 팝업 목록 조회', () => {
    beforeEach(async () => {
      // 테스트 데이터 삽입
      const testPopups: PopupDocument[] = [
        {
          _id: 'popup-001',
          name: '스누피 팝업',
          character: { id: 'char-001', name: '스누피', code: 'SNOOPY' },
          status: 'ACTIVE',
          period: {
            start: new Date('2025-01-01'),
            end: new Date('2025-03-31'),
          },
          countries: ['KR', 'JP'],
          revenueConfig: {
            storeRate: 0.60,
            corpRate: 0.30,
            licenseRate: 0.10,
          },
          createdAt: new Date('2024-12-01'),
          updatedAt: new Date('2024-12-01'),
        },
        {
          _id: 'popup-002',
          name: '산리오 팝업',
          status: 'SCHEDULED',
          period: {
            start: new Date('2025-02-01'),
            end: new Date('2025-04-30'),
          },
          countries: ['KR'],
          revenueConfig: {
            storeRate: 0.65,
            corpRate: 0.25,
            licenseRate: 0.10,
          },
          createdAt: new Date('2024-12-15'),
          updatedAt: new Date('2024-12-15'),
        },
        {
          _id: 'popup-003',
          name: '종료된 팝업',
          status: 'ENDED',
          period: {
            start: new Date('2024-10-01'),
            end: new Date('2024-12-31'),
          },
          endedAt: new Date('2024-12-31'),
          countries: ['KR', 'JP'],
          revenueConfig: {
            storeRate: 0.60,
            corpRate: 0.30,
            licenseRate: 0.10,
          },
          createdAt: new Date('2024-09-01'),
          updatedAt: new Date('2024-12-31'),
        },
      ];

      await context.db.collection('popups').insertMany(testPopups);
    });

    it('전체 팝업 목록을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/popups',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(3);
      expect(body.meta.count).toBe(3);
    });

    it('상태별 필터링이 작동해야 함 - ACTIVE', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/popups?status=ACTIVE',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]._id).toBe('popup-001');
      expect(body.data[0].status).toBe('ACTIVE');
    });

    it('상태별 필터링이 작동해야 함 - SCHEDULED', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/popups?status=SCHEDULED',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]._id).toBe('popup-002');
    });

    it('상태별 필터링이 작동해야 함 - ENDED', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/popups?status=ENDED',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]._id).toBe('popup-003');
      expect(body.data[0].endedAt).toBeDefined();
    });

    it('팝업이 없을 때 빈 배열을 반환해야 함', async () => {
      // Arrange: 모든 데이터 삭제
      await context.db.collection('popups').deleteMany({});

      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/popups',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
      expect(body.meta.count).toBe(0);
    });
  });

  describe('GET /api/popups/active - 활성 팝업 조회', () => {
    beforeEach(async () => {
      const now = new Date('2025-01-15');
      await context.db.collection('popups').insertMany([
        {
          _id: 'popup-active-1',
          name: '현재 진행중 팝업 1',
          status: 'ACTIVE',
          period: {
            start: new Date('2025-01-01'),
            end: new Date('2025-01-31'),
          },
          countries: ['KR'],
          revenueConfig: { storeRate: 60, corpRate: 30, licenseRate: 10 },
          createdAt: now,
          updatedAt: now,
        },
        {
          _id: 'popup-active-2',
          name: '현재 진행중 팝업 2',
          status: 'ACTIVE',
          period: {
            start: new Date('2025-01-10'),
            end: new Date('2025-02-10'),
          },
          countries: ['JP'],
          revenueConfig: { storeRate: 65, corpRate: 25, licenseRate: 10 },
          createdAt: now,
          updatedAt: now,
        },
        {
          _id: 'popup-scheduled',
          name: '예정된 팝업',
          status: 'SCHEDULED',
          period: {
            start: new Date('2025-02-01'),
            end: new Date('2025-03-01'),
          },
          countries: ['KR'],
          revenueConfig: { storeRate: 60, corpRate: 30, licenseRate: 10 },
          createdAt: now,
          updatedAt: now,
        },
      ]);
    });

    it('활성 상태의 팝업만 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/popups/active',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.data.every((p: any) => p.status === 'ACTIVE')).toBe(true);
    });

    it('활성 팝업이 없을 때 빈 배열을 반환해야 함', async () => {
      // Arrange
      await context.db.collection('popups').deleteMany({ status: 'ACTIVE' });

      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/popups/active',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
      expect(body.meta.count).toBe(0);
    });
  });

  describe('GET /api/popups/:id - 팝업 상세 조회', () => {
    beforeEach(async () => {
      await context.db.collection('popups').insertOne({
        _id: 'popup-detail-001',
        name: '상세 조회용 팝업',
        status: 'ACTIVE',
        period: {
          start: new Date('2025-01-01'),
          end: new Date('2025-03-31'),
        },
        countries: ['KR', 'JP'],
        revenueConfig: {
          storeRate: 60,
          corpRate: 30,
          licenseRate: 10,
        },
        createdAt: new Date('2024-12-01'),
        updatedAt: new Date('2024-12-01'),
      });
    });

    it('존재하는 팝업 ID로 조회 시 상세 정보를 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/popups/popup-detail-001',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data._id).toBe('popup-detail-001');
      expect(body.data.name).toBe('상세 조회용 팝업');
      expect(body.data.countries).toEqual(['KR', 'JP']);
    });

    it('존재하지 않는 팝업 ID로 조회 시 404를 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/popups/non-existent-popup',
      });

      // Assert
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBe('Popup not found');
    });
  });

  describe('POST /api/popups - 팝업 생성', () => {
    it('유효한 데이터로 팝업을 생성해야 함', async () => {
      // Arrange
      const newPopup = {
        _id: 'popup-new-001',
        name: '새로운 팝업',
        status: 'SCHEDULED',
        period: {
          start: '2025-02-01',
          end: '2025-04-30',
        },
        countries: ['KR', 'JP'],
        revenueConfig: {
          storeRate: 0.60,
          corpRate: 0.30,
          licenseRate: 0.10,
        },
      };

      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/popups',
        payload: newPopup,
      });

      // Assert
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('popup-new-001');

      // DB 확인
      const inserted = await context.db.collection('popups').findOne({ _id: 'popup-new-001' });
      expect(inserted).toBeDefined();
      expect(inserted?.name).toBe('새로운 팝업');
    });

    it('캐릭터 정보를 포함한 팝업을 생성해야 함', async () => {
      // Arrange
      const newPopup = {
        _id: 'popup-with-char',
        name: '캐릭터 팝업',
        character: {
          id: 'char-001',
          name: '스누피',
          code: 'SNOOPY',
        },
        status: 'ACTIVE',
        period: {
          start: '2025-01-01',
          end: '2025-03-31',
        },
        countries: ['KR'],
        revenueConfig: {
          storeRate: 0.60,
          corpRate: 0.30,
          licenseRate: 0.10,
        },
      };

      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/popups',
        payload: newPopup,
      });

      // Assert
      expect(response.statusCode).toBe(201);

      const inserted = await context.db.collection('popups').findOne({ _id: 'popup-with-char' });
      expect(inserted?.character).toEqual({
        id: 'char-001',
        name: '스누피',
        code: 'SNOOPY',
      });
    });

    it('할인 설정을 포함한 팝업을 생성해야 함', async () => {
      // Arrange
      const newPopup = {
        _id: 'popup-with-discount',
        name: '할인 팝업',
        status: 'ACTIVE',
        period: {
          start: '2025-01-01',
          end: '2025-03-31',
        },
        countries: ['KR'],
        revenueConfig: {
          storeRate: 0.60,
          corpRate: 0.30,
          licenseRate: 0.10,
        },
        discountConfig: {
          type: 'ROULETTE',
          rouletteRates: [0, 5, 10, 15, 20],
          maxDiscount: '5000',
        },
      };

      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/popups',
        payload: newPopup,
      });

      // Assert
      expect(response.statusCode).toBe(201);

      const inserted = await context.db.collection('popups').findOne({ _id: 'popup-with-discount' });
      expect(inserted?.discountConfig?.type).toBe('ROULETTE');
      expect(inserted?.discountConfig?.maxDiscount).toBe(5000);
    });
  });

  describe('PUT /api/popups/:id - 팝업 수정', () => {
    beforeEach(async () => {
      await context.db.collection('popups').insertOne({
        _id: 'popup-to-update',
        name: '수정할 팝업',
        status: 'SCHEDULED',
        period: {
          start: new Date('2025-02-01'),
          end: new Date('2025-04-30'),
        },
        countries: ['KR'],
        revenueConfig: {
          storeRate: 60,
          corpRate: 30,
          licenseRate: 10,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('팝업 이름을 수정해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PUT',
        url: '/api/popups/popup-to-update',
        payload: {
          name: '수정된 팝업 이름',
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.updated).toBe(true);

      const updated = await context.db.collection('popups').findOne({ _id: 'popup-to-update' });
      expect(updated?.name).toBe('수정된 팝업 이름');
    });

    it('팝업 기간을 수정해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PUT',
        url: '/api/popups/popup-to-update',
        payload: {
          period: {
            start: '2025-03-01',
            end: '2025-05-31',
          },
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);

      const updated = await context.db.collection('popups').findOne({ _id: 'popup-to-update' });
      expect(updated?.period.start).toEqual(new Date('2025-03-01'));
      expect(updated?.period.end).toEqual(new Date('2025-05-31'));
    });

    it('존재하지 않는 팝업 수정 시 404를 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PUT',
        url: '/api/popups/non-existent-popup',
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

  describe('PUT /api/popups/:id/status - 팝업 상태 변경', () => {
    beforeEach(async () => {
      await context.db.collection('popups').insertOne({
        _id: 'popup-status-change',
        name: '상태 변경 테스트',
        status: 'SCHEDULED',
        period: {
          start: new Date('2025-02-01'),
          end: new Date('2025-04-30'),
        },
        countries: ['KR'],
        revenueConfig: {
          storeRate: 60,
          corpRate: 30,
          licenseRate: 10,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('팝업 상태를 ACTIVE로 변경해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PUT',
        url: '/api/popups/popup-status-change/status',
        payload: {
          status: 'ACTIVE',
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('ACTIVE');

      const updated = await context.db.collection('popups').findOne({ _id: 'popup-status-change' });
      expect(updated?.status).toBe('ACTIVE');
    });

    it('팝업 상태를 ENDED로 변경하면 endedAt이 설정되어야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PUT',
        url: '/api/popups/popup-status-change/status',
        payload: {
          status: 'ENDED',
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);

      const updated = await context.db.collection('popups').findOne({ _id: 'popup-status-change' });
      expect(updated?.status).toBe('ENDED');
      expect(updated?.endedAt).toBeDefined();
    });

    it('존재하지 않는 팝업의 상태 변경 시 404를 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PUT',
        url: '/api/popups/non-existent/status',
        payload: {
          status: 'ACTIVE',
        },
      });

      // Assert
      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/popups/:id - 팝업 삭제', () => {
    beforeEach(async () => {
      await context.db.collection('popups').insertOne({
        _id: 'popup-to-delete',
        name: '삭제할 팝업',
        status: 'SCHEDULED',
        period: {
          start: new Date('2025-02-01'),
          end: new Date('2025-04-30'),
        },
        countries: ['KR'],
        revenueConfig: {
          storeRate: 60,
          corpRate: 30,
          licenseRate: 10,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('팝업을 삭제해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'DELETE',
        url: '/api/popups/popup-to-delete',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.deleted).toBe(true);

      const deleted = await context.db.collection('popups').findOne({ _id: 'popup-to-delete' });
      expect(deleted).toBeNull();
    });

    it('존재하지 않는 팝업 삭제 시 404를 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'DELETE',
        url: '/api/popups/non-existent-popup',
      });

      // Assert
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });
});
