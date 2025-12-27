import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestApp, closeTestApp, TestContext } from '../helpers/test-app.js';
import { performanceRoutes } from '../../src/modules/performance/performance.routes.js';
import { PerformanceDocument, CreatePerformanceInput, BatchPerformanceInput } from '../../src/types/index.js';

describe('Performance API', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await createTestApp();
    await context.app.register(performanceRoutes, { prefix: '/api/performance' });
  });

  afterEach(async () => {
    await closeTestApp(context);
  });

  describe('POST /api/performance - 단일 성능 지표 기록', () => {
    it('유효한 성능 지표를 기록해야 함', async () => {
      // Arrange
      const performanceInput = {
        kioskId: 'DEV001',
        timestamp: new Date().toISOString(),
        metricType: 'app_start' as const,
        durationMs: 1500,
        success: true,
      };

      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/performance',
        payload: performanceInput,
      });

      // Assert
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();

      // DB 확인
      const metrics = await context.db.collection('performance').find({ kioskId: 'DEV001' }).toArray();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].metricType).toBe('app_start');
      expect(metrics[0].durationMs).toBe(1500);
    });

    it('sessionId를 포함하여 기록할 수 있어야 함', async () => {
      // Arrange
      const sessionId = '01HRJ8XJPK0000000000000000';
      const performanceInput = {
        kioskId: 'DEV001',
        timestamp: new Date().toISOString(),
        sessionId,
        metricType: 'capture' as const,
        durationMs: 3000,
        success: true,
      };

      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/performance',
        payload: performanceInput,
      });

      // Assert
      expect(response.statusCode).toBe(201);

      const metric = await context.db.collection('performance').findOne({ sessionId }) as PerformanceDocument;
      expect(metric).toBeDefined();
      expect(metric.sessionId).toBe(sessionId);
    });

    it('breakdown 정보를 포함하여 기록할 수 있어야 함', async () => {
      // Arrange
      const performanceInput = {
        kioskId: 'DEV001',
        timestamp: new Date().toISOString(),
        metricType: 'capture' as const,
        durationMs: 5000,
        breakdown: {
          camera_init: 1000,
          capture: 2000,
          processing: 2000,
        },
        success: true,
      };

      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/performance',
        payload: performanceInput,
      });

      // Assert
      expect(response.statusCode).toBe(201);

      const metric = await context.db.collection('performance').findOne({ kioskId: 'DEV001' }) as PerformanceDocument;
      expect(metric.breakdown).toBeDefined();
      expect(metric.breakdown?.camera_init).toBe(1000);
      expect(metric.breakdown?.processing).toBe(2000);
    });

    it('context 정보를 포함하여 기록할 수 있어야 함', async () => {
      // Arrange
      const performanceInput = {
        kioskId: 'DEV001',
        timestamp: new Date().toISOString(),
        metricType: 'api_call' as const,
        durationMs: 500,
        context: {
          memoryUsage: 45.5,
          cpuUsage: 30.2,
          networkType: 'wifi',
        },
        success: true,
      };

      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/performance',
        payload: performanceInput,
      });

      // Assert
      expect(response.statusCode).toBe(201);

      const metric = await context.db.collection('performance').findOne({ kioskId: 'DEV001' }) as PerformanceDocument;
      expect(metric.context).toBeDefined();
      expect(metric.context?.memoryUsage).toBe(45.5);
      expect(metric.context?.networkType).toBe('wifi');
    });

    it('실패한 성능 지표를 errorMessage와 함께 기록할 수 있어야 함', async () => {
      // Arrange
      const performanceInput = {
        kioskId: 'DEV001',
        timestamp: new Date().toISOString(),
        metricType: 'payment' as const,
        durationMs: 15000,
        success: false,
        errorMessage: 'Payment timeout',
      };

      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/performance',
        payload: performanceInput,
      });

      // Assert
      expect(response.statusCode).toBe(201);

      const metric = await context.db.collection('performance').findOne({ kioskId: 'DEV001' }) as PerformanceDocument;
      expect(metric.success).toBe(false);
      expect(metric.errorMessage).toBe('Payment timeout');
    });

    it('필수 필드 누락 시 400을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/performance',
        payload: {
          kioskId: 'DEV001',
          // timestamp 누락
          metricType: 'app_start',
          durationMs: 1000,
          success: true,
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });

    it('잘못된 metricType으로 요청 시 400을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/performance',
        payload: {
          kioskId: 'DEV001',
          timestamp: new Date().toISOString(),
          metricType: 'invalid_type',
          durationMs: 1000,
          success: true,
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });

    it('음수 durationMs로 요청 시 400을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/performance',
        payload: {
          kioskId: 'DEV001',
          timestamp: new Date().toISOString(),
          metricType: 'app_start',
          durationMs: -100,
          success: true,
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });

    it('최대 durationMs를 초과하면 400을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/performance',
        payload: {
          kioskId: 'DEV001',
          timestamp: new Date().toISOString(),
          metricType: 'app_start',
          durationMs: 700000, // 600000 초과
          success: true,
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/performance/batch - 배치 성능 지표 기록', () => {
    it('여러 성능 지표를 배치로 기록해야 함', async () => {
      // Arrange
      const batchInput: BatchPerformanceInput = {
        kioskId: 'DEV001',
        metrics: [
          {
            timestamp: new Date().toISOString(),
            metricType: 'app_start',
            durationMs: 1500,
            success: true,
          },
          {
            timestamp: new Date().toISOString(),
            metricType: 'capture',
            durationMs: 3000,
            success: true,
          },
        ],
      };

      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/performance/batch',
        payload: batchInput,
      });

      // Assert
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.inserted).toBe(2);
      expect(body.data.errors).toBe(0);

      // DB 확인
      const metrics = await context.db.collection('performance').find({ kioskId: 'DEV001' }).toArray();
      expect(metrics).toHaveLength(2);
    });

    it('빈 배열 전송 시 400을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/performance/batch',
        payload: {
          kioskId: 'DEV001',
          metrics: [],
        },
      });

      // Assert
      expect(response.statusCode).toBe(400); // minItems: 1 검증 실패
    });

    it('50개 이상의 지표 전송 시 400을 반환해야 함', async () => {
      // Arrange
      const metrics = Array.from({ length: 51 }, (_, i) => ({
        timestamp: new Date().toISOString(),
        metricType: 'app_start' as const,
        durationMs: 1000 + i,
        success: true,
      }));

      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/performance/batch',
        payload: {
          kioskId: 'DEV001',
          metrics,
        },
      });

      // Assert
      expect(response.statusCode).toBe(400); // maxItems: 50 검증 실패
    });

    it('배치에서 하나라도 유효하지 않으면 400을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/performance/batch',
        payload: {
          kioskId: 'DEV001',
          metrics: [
            {
              timestamp: new Date().toISOString(),
              metricType: 'app_start',
              durationMs: 1000,
              success: true,
            },
            {
              timestamp: new Date().toISOString(),
              metricType: 'invalid_type', // 잘못된 타입
              durationMs: 1000,
              success: true,
            },
          ],
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });

    it('다양한 metricType을 배치로 기록할 수 있어야 함', async () => {
      // Arrange
      const batchInput: BatchPerformanceInput = {
        kioskId: 'DEV001',
        metrics: [
          {
            timestamp: new Date().toISOString(),
            metricType: 'app_start',
            durationMs: 1500,
            success: true,
          },
          {
            timestamp: new Date().toISOString(),
            metricType: 'capture',
            durationMs: 3000,
            success: true,
          },
          {
            timestamp: new Date().toISOString(),
            metricType: 'payment',
            durationMs: 5000,
            success: true,
          },
          {
            timestamp: new Date().toISOString(),
            metricType: 'print',
            durationMs: 10000,
            success: true,
          },
        ],
      };

      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/performance/batch',
        payload: batchInput,
      });

      // Assert
      expect(response.statusCode).toBe(201);

      const metrics = await context.db.collection('performance').find({ kioskId: 'DEV001' }).toArray();
      const metricTypes = metrics.map(m => m.metricType);
      expect(metricTypes).toContain('app_start');
      expect(metricTypes).toContain('capture');
      expect(metricTypes).toContain('payment');
      expect(metricTypes).toContain('print');
    });
  });

  describe('GET /api/performance - 성능 지표 조회', () => {
    const sessionId1 = '01HRJ8XJPK0000000000000000';
    const sessionId2 = '01HRJ8XJPK0000000000000001';

    beforeEach(async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const metrics: PerformanceDocument[] = [
        {
          timestamp: now,
          kioskId: 'DEV001',
          sessionId: sessionId1,
          metricType: 'app_start',
          durationMs: 1500,
          success: true,
          createdAt: now,
        } as PerformanceDocument,
        {
          timestamp: now,
          kioskId: 'DEV001',
          sessionId: sessionId1,
          metricType: 'capture',
          durationMs: 3000,
          success: true,
          createdAt: now,
        } as PerformanceDocument,
        {
          timestamp: yesterday,
          kioskId: 'DEV002',
          sessionId: sessionId2,
          metricType: 'app_start',
          durationMs: 2000,
          success: true,
          createdAt: yesterday,
        } as PerformanceDocument,
        {
          timestamp: yesterday,
          kioskId: 'DEV002',
          sessionId: sessionId2,
          metricType: 'payment',
          durationMs: 5000,
          success: false,
          errorMessage: 'Timeout',
          createdAt: yesterday,
        } as PerformanceDocument,
      ];

      await context.db.collection('performance').insertMany(metrics);
    });

    it('모든 성능 지표를 조회해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/performance',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(4);
      expect(body.meta.total).toBe(4);
    });

    it('kioskId로 필터링해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/performance?kioskId=DEV001',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.data.every((m: any) => m.kioskId === 'DEV001')).toBe(true);
    });

    it('sessionId로 필터링해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: `/api/performance?sessionId=${sessionId1}`,
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.data.every((m: any) => m.sessionId === sessionId1)).toBe(true);
    });

    it('metricType으로 필터링해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/performance?metricType=app_start',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.data.every((m: any) => m.metricType === 'app_start')).toBe(true);
    });

    it('여러 필터를 동시에 적용해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/performance?kioskId=DEV001&metricType=capture',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].kioskId).toBe('DEV001');
      expect(body.data[0].metricType).toBe('capture');
    });

    it('시간 범위로 필터링해야 함', async () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString();

      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: `/api/performance?startTime=${yesterdayStr}`,
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.length).toBeGreaterThanOrEqual(2); // 어제 이후의 모든 지표
    });

    it('페이지네이션이 작동해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/performance?limit=2&offset=0',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.meta.limit).toBe(2);
      expect(body.meta.offset).toBe(0);
      expect(body.meta.hasMore).toBe(true);
    });

    it('페이지네이션 두 번째 페이지를 조회해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/performance?limit=2&offset=2',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.meta.offset).toBe(2);
      expect(body.meta.hasMore).toBe(false);
    });

    it('성능 지표가 최신순으로 정렬되어야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/performance',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // 첫 번째가 가장 최신이어야 함
      const timestamps = body.data.map((m: any) => new Date(m.timestamp).getTime());
      for (let i = 0; i < timestamps.length - 1; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1]);
      }
    });

    it('성능 지표가 없을 때 빈 배열을 반환해야 함', async () => {
      // Arrange
      await context.db.collection('performance').deleteMany({});

      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/performance',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
      expect(body.meta.total).toBe(0);
    });

    it('성능 지표가 올바르게 직렬화되어야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/performance',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Date가 ISO 문자열로 변환되었는지 확인
      expect(typeof body.data[0].timestamp).toBe('string');
      expect(body.data[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(typeof body.data[0].createdAt).toBe('string');
    });
  });
});
