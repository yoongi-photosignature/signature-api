import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestApp, closeTestApp, TestContext } from '../helpers/test-app.js';
import { dailySummaryRoutes } from '../../src/modules/daily-summary/daily-summary.routes.js';
import { DailySummaryDocument, SessionDocument } from '../../src/types/index.js';

describe('Daily Summary API', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await createTestApp();
    await context.app.register(dailySummaryRoutes, { prefix: '/api/daily-summary' });
  });

  afterEach(async () => {
    await closeTestApp(context);
  });

  describe('GET /api/daily-summary - 일일 요약 목록 조회', () => {
    beforeEach(async () => {
      const summaries: DailySummaryDocument[] = [
        {
          date: '2024-01-15',
          kioskId: 'DEV001',
          storeId: 'STORE001',
          groupId: 'GROUP001',
          countryCode: 'KR',
          sessions: {
            total: 100,
            completed: 80,
            abandoned: 15,
            timeout: 5,
            avgDurationMs: 120000,
          },
          funnel: {
            attract: 100,
            engage: 90,
            customize: 80,
            capture: 75,
            edit: 70,
            checkout: 65,
            payment: 60,
            fulfill: 60,
            conversionRate: 0.6,
          },
          sales: {
            totalCount: 60,
            totalAmount: 300000,
            avgAmount: 5000,
            byPaymentType: {
              cash: { count: 20, amount: 100000 },
              card: { count: 40, amount: 200000 },
            },
            refundCount: 2,
            refundAmount: 10000,
          },
          performance: {
            appStart: { p50: 1500, p95: 2500, p99: 3000 },
            capture: { p50: 3000, p95: 4500, p99: 5000 },
            render: { p50: 2000, p95: 3000, p99: 3500 },
            print: { p50: 10000, p95: 15000, p99: 20000 },
            payment: { p50: 5000, p95: 8000, p99: 10000 },
          },
          errors: {
            total: 5,
            bySeverity: { critical: 1, error: 3, warning: 1 },
            byCategory: { hardware: 1, software: 3, network: 1, payment: 0 },
          },
          createdAt: new Date('2024-01-16T00:00:00Z'),
          updatedAt: new Date('2024-01-16T00:00:00Z'),
        } as DailySummaryDocument,
        {
          date: '2024-01-14',
          kioskId: 'DEV001',
          storeId: 'STORE001',
          groupId: 'GROUP001',
          countryCode: 'KR',
          sessions: {
            total: 90,
            completed: 70,
            abandoned: 15,
            timeout: 5,
            avgDurationMs: 115000,
          },
          funnel: {
            attract: 90,
            engage: 80,
            customize: 70,
            capture: 65,
            edit: 60,
            checkout: 55,
            payment: 50,
            fulfill: 50,
            conversionRate: 0.556,
          },
          sales: {
            totalCount: 50,
            totalAmount: 250000,
            avgAmount: 5000,
            byPaymentType: {
              cash: { count: 15, amount: 75000 },
              card: { count: 35, amount: 175000 },
            },
            refundCount: 1,
            refundAmount: 5000,
          },
          performance: {
            appStart: { p50: 1400, p95: 2400, p99: 2900 },
            capture: { p50: 2900, p95: 4400, p99: 4900 },
            render: { p50: 1900, p95: 2900, p99: 3400 },
            print: { p50: 9500, p95: 14500, p99: 19500 },
            payment: { p50: 4800, p95: 7800, p99: 9800 },
          },
          errors: {
            total: 3,
            bySeverity: { critical: 0, error: 2, warning: 1 },
            byCategory: { hardware: 0, software: 2, network: 1, payment: 0 },
          },
          createdAt: new Date('2024-01-15T00:00:00Z'),
          updatedAt: new Date('2024-01-15T00:00:00Z'),
        } as DailySummaryDocument,
        {
          date: '2024-01-15',
          kioskId: 'DEV002',
          storeId: 'STORE002',
          groupId: 'GROUP001',
          countryCode: 'JP',
          sessions: {
            total: 50,
            completed: 40,
            abandoned: 8,
            timeout: 2,
            avgDurationMs: 110000,
          },
          funnel: {
            attract: 50,
            engage: 45,
            customize: 42,
            capture: 40,
            edit: 38,
            checkout: 35,
            payment: 33,
            fulfill: 33,
            conversionRate: 0.66,
          },
          sales: {
            totalCount: 33,
            totalAmount: 165000,
            avgAmount: 5000,
            byPaymentType: {
              cash: { count: 10, amount: 50000 },
              card: { count: 23, amount: 115000 },
            },
            refundCount: 0,
            refundAmount: 0,
          },
          performance: {
            appStart: { p50: 1600, p95: 2600, p99: 3100 },
            capture: { p50: 3100, p95: 4600, p99: 5100 },
            render: { p50: 2100, p95: 3100, p99: 3600 },
            print: { p50: 10500, p95: 15500, p99: 20500 },
            payment: { p50: 5200, p95: 8200, p99: 10200 },
          },
          errors: {
            total: 2,
            bySeverity: { critical: 0, error: 1, warning: 1 },
            byCategory: { hardware: 1, software: 1, network: 0, payment: 0 },
          },
          createdAt: new Date('2024-01-16T00:00:00Z'),
          updatedAt: new Date('2024-01-16T00:00:00Z'),
        } as DailySummaryDocument,
      ];

      await context.db.collection('dailySummary').insertMany(summaries);
    });

    it('모든 일일 요약을 조회해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/daily-summary',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(3);
      expect(body.meta.total).toBe(3);
    });

    it('kioskId로 필터링해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/daily-summary?kioskId=DEV001',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.data.every((s: any) => s.kioskId === 'DEV001')).toBe(true);
    });

    it('storeId로 필터링해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/daily-summary?storeId=STORE002',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].storeId).toBe('STORE002');
    });

    it('groupId로 필터링해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/daily-summary?groupId=GROUP001',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(3);
      expect(body.data.every((s: any) => s.groupId === 'GROUP001')).toBe(true);
    });

    it('날짜 범위로 필터링해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/daily-summary?startDate=2024-01-15&endDate=2024-01-15',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.data.every((s: any) => s.date === '2024-01-15')).toBe(true);
    });

    it('여러 필터를 동시에 적용해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/daily-summary?kioskId=DEV001&startDate=2024-01-15',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].kioskId).toBe('DEV001');
      expect(body.data[0].date).toBe('2024-01-15');
    });

    it('페이지네이션이 작동해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/daily-summary?limit=2&offset=0',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.meta.limit).toBe(2);
      expect(body.meta.offset).toBe(0);
      expect(body.meta.hasMore).toBe(true);
    });

    it('일일 요약이 날짜 역순으로 정렬되어야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/daily-summary?kioskId=DEV001',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // 첫 번째가 더 최근 날짜여야 함
      expect(body.data[0].date).toBe('2024-01-15');
      expect(body.data[1].date).toBe('2024-01-14');
    });

    it('일일 요약이 없을 때 빈 배열을 반환해야 함', async () => {
      // Arrange
      await context.db.collection('dailySummary').deleteMany({});

      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/daily-summary',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
      expect(body.meta.total).toBe(0);
    });

    it('일일 요약 데이터가 올바르게 직렬화되어야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/daily-summary',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Date가 ISO 문자열로 변환되었는지 확인
      expect(typeof body.data[0].createdAt).toBe('string');
      expect(body.data[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // 집계 데이터 구조 확인
      expect(body.data[0].sessions).toBeDefined();
      expect(body.data[0].funnel).toBeDefined();
      expect(body.data[0].sales).toBeDefined();
      expect(body.data[0].performance).toBeDefined();
      expect(body.data[0].errors).toBeDefined();
    });
  });

  describe('GET /api/daily-summary/:date/:kioskId - 특정 일일 요약 조회', () => {
    beforeEach(async () => {
      const summary: DailySummaryDocument = {
        date: '2024-01-15',
        kioskId: 'DEV001',
        storeId: 'STORE001',
        groupId: 'GROUP001',
        countryCode: 'KR',
        sessions: {
          total: 100,
          completed: 80,
          abandoned: 15,
          timeout: 5,
          avgDurationMs: 120000,
        },
        funnel: {
          attract: 100,
          engage: 90,
          customize: 80,
          capture: 75,
          edit: 70,
          checkout: 65,
          payment: 60,
          fulfill: 60,
          conversionRate: 0.6,
        },
        sales: {
          totalCount: 60,
          totalAmount: 300000,
          avgAmount: 5000,
          byPaymentType: {
            cash: { count: 20, amount: 100000 },
            card: { count: 40, amount: 200000 },
          },
          refundCount: 2,
          refundAmount: 10000,
        },
        performance: {
          appStart: { p50: 1500, p95: 2500, p99: 3000 },
          capture: { p50: 3000, p95: 4500, p99: 5000 },
          render: { p50: 2000, p95: 3000, p99: 3500 },
          print: { p50: 10000, p95: 15000, p99: 20000 },
          payment: { p50: 5000, p95: 8000, p99: 10000 },
        },
        errors: {
          total: 5,
          bySeverity: { critical: 1, error: 3, warning: 1 },
          byCategory: { hardware: 1, software: 3, network: 1, payment: 0 },
        },
        createdAt: new Date('2024-01-16T00:00:00Z'),
        updatedAt: new Date('2024-01-16T00:00:00Z'),
      } as DailySummaryDocument;

      await context.db.collection('dailySummary').insertOne(summary);
    });

    it('존재하는 일일 요약을 조회해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/daily-summary/2024-01-15/DEV001',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.date).toBe('2024-01-15');
      expect(body.data.kioskId).toBe('DEV001');
    });

    it('세션 통계를 포함해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/daily-summary/2024-01-15/DEV001',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.sessions.total).toBe(100);
      expect(body.data.sessions.completed).toBe(80);
      expect(body.data.sessions.abandoned).toBe(15);
    });

    it('퍼널 통계를 포함해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/daily-summary/2024-01-15/DEV001',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.funnel.attract).toBe(100);
      expect(body.data.funnel.fulfill).toBe(60);
      expect(body.data.funnel.conversionRate).toBe(0.6);
    });

    it('매출 통계를 포함해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/daily-summary/2024-01-15/DEV001',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.sales.totalCount).toBe(60);
      expect(body.data.sales.totalAmount).toBe(300000);
      expect(body.data.sales.byPaymentType.cash.count).toBe(20);
      expect(body.data.sales.byPaymentType.card.amount).toBe(200000);
    });

    it('성능 통계를 포함해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/daily-summary/2024-01-15/DEV001',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.performance.appStart.p50).toBe(1500);
      expect(body.data.performance.capture.p95).toBe(4500);
      expect(body.data.performance.payment.p99).toBe(10000);
    });

    it('에러 통계를 포함해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/daily-summary/2024-01-15/DEV001',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.errors.total).toBe(5);
      expect(body.data.errors.bySeverity.critical).toBe(1);
      expect(body.data.errors.byCategory.software).toBe(3);
    });

    it('존재하지 않는 일일 요약 조회 시 404를 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/daily-summary/2024-01-20/DEV999',
      });

      // Assert
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('잘못된 날짜 형식으로 요청 시 400을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/daily-summary/2024-1-15/DEV001', // 잘못된 형식
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/daily-summary/aggregate - 수동 집계 실행', () => {
    beforeEach(async () => {
      // 테스트용 세션 데이터 생성
      const now = new Date('2024-01-15T12:00:00Z');
      const sessions: SessionDocument[] = [
        {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          kioskId: 'DEV001',
          storeId: 'STORE001',
          groupId: 'GROUP001',
          countryCode: 'KR',
          appVersion: '1.0.0',
          startedAt: now,
          endedAt: new Date('2024-01-15T12:05:00Z'),
          durationMs: 300000,
          status: 'completed',
          funnel: {
            stages: {
              attract: { reached: true, enteredAt: now },
              engage: { reached: true, enteredAt: now },
              customize: { reached: true, enteredAt: now },
              capture: { reached: true, enteredAt: now },
              edit: { reached: true, enteredAt: now },
              checkout: { reached: true, enteredAt: now },
              payment: { reached: true, enteredAt: now },
              fulfill: { reached: true, enteredAt: now },
            },
            lastCompletedStage: 'fulfill',
            exitStage: null,
            overallProgress: 1.0,
          },
          selections: {
            frameType: '4cut',
            cutCount: 4,
            background: 'blue',
            character: null,
            filter: null,
            qrEnabled: false,
          },
          behaviorSummary: {
            totalTaps: 20,
            totalScrolls: 5,
            backPressCount: 0,
            retakeCount: 0,
            selectionChanges: { frame: 1, background: 1, character: 0, filter: 0 },
            longestIdleMs: 3000,
          },
          screenDurations: {},
          metadata: {
            osVersion: 'Android 12',
            screenResolution: '1920x1080',
          },
          createdAt: now,
          updatedAt: now,
        } as SessionDocument,
      ];

      await context.db.collection('sessions').insertMany(sessions);
    });

    it('특정 날짜의 집계를 실행해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/daily-summary/aggregate',
        payload: {
          date: '2024-01-15',
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.date).toBe('2024-01-15');
      expect(body.data.aggregatedKiosks).toBeGreaterThan(0);
    });

    it('특정 디바이스만 집계할 수 있어야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/daily-summary/aggregate',
        payload: {
          date: '2024-01-15',
          kioskId: 'DEV001',
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.kioskId).toBe('DEV001');
    });

    it('집계 결과가 DB에 저장되어야 함', async () => {
      // Act
      await context.app.inject({
        method: 'POST',
        url: '/api/daily-summary/aggregate',
        payload: {
          date: '2024-01-15',
          kioskId: 'DEV001',
        },
      });

      // Assert
      const summary = await context.db.collection('dailySummary').findOne({
        date: '2024-01-15',
        kioskId: 'DEV001',
      });

      expect(summary).toBeDefined();
      expect(summary?.sessions).toBeDefined();
      expect(summary?.funnel).toBeDefined();
    });

    it('필수 필드 누락 시 400을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/daily-summary/aggregate',
        payload: {
          // date 누락
          kioskId: 'DEV001',
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });

    it('잘못된 날짜 형식으로 요청 시 400을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/daily-summary/aggregate',
        payload: {
          date: '2024-1-15', // 잘못된 형식
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });
  });
});
