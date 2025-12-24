import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestApp, closeTestApp, TestContext } from '../helpers/test-app.js';
import { errorsRoutes } from '../../src/modules/errors/errors.routes.js';
import { ErrorDocument } from '../../src/types/index.js';
import { ObjectId } from 'mongodb';

describe('Errors API', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await createTestApp();
    await context.app.register(errorsRoutes, { prefix: '/api/errors' });
  });

  afterEach(async () => {
    await closeTestApp(context);
  });

  describe('POST /api/errors - 에러 리포트 생성', () => {
    it('유효한 에러 리포트를 생성해야 함', async () => {
      // Arrange
      const errorInput = {
        kioskId: 'DEV001',
        timestamp: new Date().toISOString(),
        severity: 'error' as const,
        category: 'software' as const,
        errorCode: 'ERR_CAPTURE_FAILED',
        errorMessage: 'Camera capture failed',
        appVersion: '1.0.0',
      };

      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/errors',
        payload: errorInput,
      });

      // Assert
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();

      // DB 확인
      const errors = await context.db.collection('errors').find({ kioskId: 'DEV001' }).toArray();
      expect(errors).toHaveLength(1);
      expect(errors[0].errorCode).toBe('ERR_CAPTURE_FAILED');
      expect(errors[0].resolved).toBe(false);
    });

    it('sessionId를 포함하여 기록할 수 있어야 함', async () => {
      // Arrange
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      const errorInput = {
        kioskId: 'DEV001',
        timestamp: new Date().toISOString(),
        sessionId,
        severity: 'critical' as const,
        category: 'payment' as const,
        errorCode: 'ERR_PAYMENT_TIMEOUT',
        errorMessage: 'Payment gateway timeout',
        appVersion: '1.0.0',
      };

      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/errors',
        payload: errorInput,
      });

      // Assert
      expect(response.statusCode).toBe(201);

      const error = await context.db.collection('errors').findOne({ sessionId }) as ErrorDocument;
      expect(error).toBeDefined();
      expect(error.sessionId).toBe(sessionId);
      expect(error.severity).toBe('critical');
    });

    it('stackTrace를 포함하여 기록할 수 있어야 함', async () => {
      // Arrange
      const stackTrace = `Error: Camera not available
  at CameraModule.capture (/app/camera.js:45)
  at async Session.startCapture (/app/session.js:120)`;

      const errorInput = {
        kioskId: 'DEV001',
        timestamp: new Date().toISOString(),
        severity: 'error' as const,
        category: 'hardware' as const,
        errorCode: 'ERR_CAMERA_UNAVAILABLE',
        errorMessage: 'Camera not available',
        stackTrace,
        appVersion: '1.0.0',
      };

      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/errors',
        payload: errorInput,
      });

      // Assert
      expect(response.statusCode).toBe(201);

      const error = await context.db.collection('errors').findOne({ errorCode: 'ERR_CAMERA_UNAVAILABLE' }) as ErrorDocument;
      expect(error.stackTrace).toBe(stackTrace);
    });

    it('deviceState 정보를 포함하여 기록할 수 있어야 함', async () => {
      // Arrange
      const errorInput = {
        kioskId: 'DEV001',
        timestamp: new Date().toISOString(),
        severity: 'warning' as const,
        category: 'software' as const,
        errorCode: 'WARN_LOW_MEMORY',
        errorMessage: 'Low memory warning',
        deviceState: {
          memoryUsage: 85.5,
          cpuUsage: 45.2,
          diskSpace: 1024000,
          batteryLevel: 20,
          networkConnected: true,
        },
        appVersion: '1.0.0',
      };

      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/errors',
        payload: errorInput,
      });

      // Assert
      expect(response.statusCode).toBe(201);

      const error = await context.db.collection('errors').findOne({ errorCode: 'WARN_LOW_MEMORY' }) as ErrorDocument;
      expect(error.deviceState).toBeDefined();
      expect(error.deviceState?.memoryUsage).toBe(85.5);
      expect(error.deviceState?.batteryLevel).toBe(20);
    });

    it('recentEvents를 포함하여 기록할 수 있어야 함', async () => {
      // Arrange
      const now = new Date();
      const errorInput = {
        kioskId: 'DEV001',
        timestamp: now.toISOString(),
        severity: 'error' as const,
        category: 'software' as const,
        errorCode: 'ERR_CRASH',
        errorMessage: 'Application crashed',
        recentEvents: [
          {
            timestamp: new Date(now.getTime() - 5000).toISOString(),
            eventType: 'tap',
            screenName: 'capture',
          },
          {
            timestamp: new Date(now.getTime() - 3000).toISOString(),
            eventType: 'capture',
            screenName: 'capture',
          },
        ],
        appVersion: '1.0.0',
      };

      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/errors',
        payload: errorInput,
      });

      // Assert
      expect(response.statusCode).toBe(201);

      const error = await context.db.collection('errors').findOne({ errorCode: 'ERR_CRASH' }) as ErrorDocument;
      expect(error.recentEvents).toBeDefined();
      expect(error.recentEvents).toHaveLength(2);
      expect(error.recentEvents?.[0].eventType).toBe('tap');
    });

    it('필수 필드 누락 시 400을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/errors',
        payload: {
          kioskId: 'DEV001',
          timestamp: new Date().toISOString(),
          // severity 누락
          category: 'software',
          errorCode: 'ERR_TEST',
          errorMessage: 'Test error',
          appVersion: '1.0.0',
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });

    it('잘못된 severity로 요청 시 400을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/errors',
        payload: {
          kioskId: 'DEV001',
          timestamp: new Date().toISOString(),
          severity: 'invalid_severity',
          category: 'software',
          errorCode: 'ERR_TEST',
          errorMessage: 'Test error',
          appVersion: '1.0.0',
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });

    it('잘못된 category로 요청 시 400을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/errors',
        payload: {
          kioskId: 'DEV001',
          timestamp: new Date().toISOString(),
          severity: 'error',
          category: 'invalid_category',
          errorCode: 'ERR_TEST',
          errorMessage: 'Test error',
          appVersion: '1.0.0',
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });

    it('잘못된 appVersion 형식으로 요청 시 400을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/errors',
        payload: {
          kioskId: 'DEV001',
          timestamp: new Date().toISOString(),
          severity: 'error',
          category: 'software',
          errorCode: 'ERR_TEST',
          errorMessage: 'Test error',
          appVersion: 'not-semver',
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/errors/:id - 에러 상세 조회', () => {
    let testErrorId: string;

    beforeEach(async () => {
      const now = new Date();
      const result = await context.db.collection('errors').insertOne({
        timestamp: now,
        kioskId: 'DEV001',
        severity: 'error',
        category: 'software',
        errorCode: 'ERR_TEST',
        errorMessage: 'Test error',
        appVersion: '1.0.0',
        resolved: false,
        createdAt: now,
      } as ErrorDocument);
      testErrorId = result.insertedId.toHexString();
    });

    it('존재하는 에러를 조회해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: `/api/errors/${testErrorId}`,
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data._id).toBe(testErrorId);
      expect(body.data.errorCode).toBe('ERR_TEST');
    });

    it('존재하지 않는 에러 조회 시 404를 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: `/api/errors/${new ObjectId().toHexString()}`,
      });

      // Assert
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('잘못된 ID 형식으로 요청 시 400을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/errors/invalid-id',
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });

    it('에러 데이터가 올바르게 직렬화되어야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: `/api/errors/${testErrorId}`,
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Date가 ISO 문자열로 변환되었는지 확인
      expect(typeof body.data.timestamp).toBe('string');
      expect(body.data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(typeof body.data.createdAt).toBe('string');
    });
  });

  describe('GET /api/errors - 에러 목록 조회', () => {
    const sessionId1 = '550e8400-e29b-41d4-a716-446655440000';
    const sessionId2 = '550e8400-e29b-41d4-a716-446655440001';

    beforeEach(async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const errors: ErrorDocument[] = [
        {
          timestamp: now,
          kioskId: 'DEV001',
          sessionId: sessionId1,
          severity: 'critical',
          category: 'hardware',
          errorCode: 'ERR_CAMERA_FAIL',
          errorMessage: 'Camera hardware failure',
          appVersion: '1.0.0',
          resolved: false,
          createdAt: now,
        } as ErrorDocument,
        {
          timestamp: now,
          kioskId: 'DEV001',
          sessionId: sessionId1,
          severity: 'warning',
          category: 'software',
          errorCode: 'WARN_SLOW_RESPONSE',
          errorMessage: 'Slow API response',
          appVersion: '1.0.0',
          resolved: true,
          resolvedAt: now,
          createdAt: now,
        } as ErrorDocument,
        {
          timestamp: yesterday,
          kioskId: 'DEV002',
          sessionId: sessionId2,
          severity: 'error',
          category: 'payment',
          errorCode: 'ERR_PAYMENT_FAIL',
          errorMessage: 'Payment processing failed',
          appVersion: '1.0.0',
          resolved: false,
          createdAt: yesterday,
        } as ErrorDocument,
      ];

      await context.db.collection('errors').insertMany(errors);
    });

    it('모든 에러를 조회해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/errors',
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
        url: '/api/errors?kioskId=DEV001',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.data.every((e: any) => e.kioskId === 'DEV001')).toBe(true);
    });

    it('sessionId로 필터링해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: `/api/errors?sessionId=${sessionId1}`,
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.data.every((e: any) => e.sessionId === sessionId1)).toBe(true);
    });

    it('severity로 필터링해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/errors?severity=critical',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].severity).toBe('critical');
    });

    it('category로 필터링해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/errors?category=payment',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].category).toBe('payment');
    });

    it('errorCode로 필터링해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/errors?errorCode=ERR_CAMERA_FAIL',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].errorCode).toBe('ERR_CAMERA_FAIL');
    });

    it('resolved 상태로 필터링해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/errors?resolved=false',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.data.every((e: any) => e.resolved === false)).toBe(true);
    });

    it('해결된 에러만 조회해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/errors?resolved=true',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].resolved).toBe(true);
      expect(body.data[0].resolvedAt).toBeDefined();
    });

    it('여러 필터를 동시에 적용해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/errors?kioskId=DEV001&severity=critical&resolved=false',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].kioskId).toBe('DEV001');
      expect(body.data[0].severity).toBe('critical');
    });

    it('시간 범위로 필터링해야 함', async () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString();

      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: `/api/errors?startTime=${yesterdayStr}`,
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.length).toBeGreaterThanOrEqual(2); // 어제 이후의 모든 에러
    });

    it('페이지네이션이 작동해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/errors?limit=2&offset=0',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.meta.limit).toBe(2);
      expect(body.meta.offset).toBe(0);
      expect(body.meta.hasMore).toBe(true);
    });

    it('에러가 최신순으로 정렬되어야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/errors',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // 첫 번째가 가장 최신이어야 함
      const timestamps = body.data.map((e: any) => new Date(e.timestamp).getTime());
      for (let i = 0; i < timestamps.length - 1; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1]);
      }
    });

    it('에러가 없을 때 빈 배열을 반환해야 함', async () => {
      // Arrange
      await context.db.collection('errors').deleteMany({});

      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/errors',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
      expect(body.meta.total).toBe(0);
    });
  });

  describe('PATCH /api/errors/:id/resolve - 에러 해결 표시', () => {
    let unresolvedErrorId: string;
    let resolvedErrorId: string;

    beforeEach(async () => {
      const now = new Date();

      // 미해결 에러
      const result1 = await context.db.collection('errors').insertOne({
        timestamp: now,
        kioskId: 'DEV001',
        severity: 'error',
        category: 'software',
        errorCode: 'ERR_TEST',
        errorMessage: 'Test error',
        appVersion: '1.0.0',
        resolved: false,
        createdAt: now,
      } as ErrorDocument);
      unresolvedErrorId = result1.insertedId.toHexString();

      // 이미 해결된 에러
      const result2 = await context.db.collection('errors').insertOne({
        timestamp: now,
        kioskId: 'DEV001',
        severity: 'warning',
        category: 'software',
        errorCode: 'WARN_TEST',
        errorMessage: 'Test warning',
        appVersion: '1.0.0',
        resolved: true,
        resolvedAt: now,
        createdAt: now,
      } as ErrorDocument);
      resolvedErrorId = result2.insertedId.toHexString();
    });

    it('미해결 에러를 해결 상태로 변경해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PATCH',
        url: `/api/errors/${unresolvedErrorId}/resolve`,
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.resolved).toBe(true);

      // DB 확인
      const error = await context.db.collection('errors').findOne({ _id: new ObjectId(unresolvedErrorId) }) as ErrorDocument;
      expect(error.resolved).toBe(true);
      expect(error.resolvedAt).toBeDefined();
    });

    it('이미 해결된 에러는 400을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PATCH',
        url: `/api/errors/${resolvedErrorId}/resolve`,
      });

      // Assert
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('RESOLVE_FAILED');
    });

    it('존재하지 않는 에러 해결 시 400을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PATCH',
        url: `/api/errors/${new ObjectId().toHexString()}/resolve`,
      });

      // Assert
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('RESOLVE_FAILED');
    });

    it('잘못된 ID 형식으로 요청 시 400을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PATCH',
        url: '/api/errors/invalid-id/resolve',
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });

    it('resolvedAt 타임스탬프가 기록되어야 함', async () => {
      // Arrange
      const beforeResolve = new Date();

      // Act
      await context.app.inject({
        method: 'PATCH',
        url: `/api/errors/${unresolvedErrorId}/resolve`,
      });

      // Assert
      const error = await context.db.collection('errors').findOne({ _id: new ObjectId(unresolvedErrorId) }) as ErrorDocument;
      expect(error.resolvedAt).toBeDefined();
      expect(error.resolvedAt!.getTime()).toBeGreaterThanOrEqual(beforeResolve.getTime());
    });
  });
});
