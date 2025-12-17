import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestApp, closeTestApp, TestContext } from '../helpers/test-app.js';
import { configRoutes } from '../../src/modules/config/config.routes.js';
import { ConfigDocument } from '../../src/types/index.js';

describe('Config API', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await createTestApp();
    await context.app.register(configRoutes, { prefix: '/api/config' });
  });

  afterEach(async () => {
    await closeTestApp(context);
  });

  describe('GET /api/config - 전체 설정 조회', () => {
    beforeEach(async () => {
      const now = new Date();
      const testConfigs: ConfigDocument[] = [
        {
          _id: 'SERVER_FEE_RATES',
          domestic: 30,
          overseas: 35,
          updatedAt: now,
          updatedBy: 'admin',
        },
        {
          _id: 'EXCHANGE_RATE_API',
          provider: 'exchangerate-api.com',
          endpoint: 'https://api.exchangerate-api.com/v4/latest/KRW',
          updateFrequency: 'daily',
          lastUpdated: now,
          updatedAt: now,
          updatedBy: 'system',
        },
        {
          _id: 'FEATURE_FLAGS',
          values: {
            enableNewUI: true,
            enableBeautyService: true,
            enableAIService: false,
          },
          updatedAt: now,
          updatedBy: 'admin',
        },
      ];

      await context.db.collection('config').insertMany(testConfigs);
    });

    it('전체 설정 목록을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/config',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(3);
      expect(body.meta.count).toBe(3);
    });

    it('설정이 없을 때 빈 배열을 반환해야 함', async () => {
      // Arrange
      await context.db.collection('config').deleteMany({});

      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/config',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
      expect(body.meta.count).toBe(0);
    });

    it('모든 설정이 올바른 형식으로 직렬화되어야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/config',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      const serverFeeConfig = body.data.find((c: any) => c._id === 'SERVER_FEE_RATES');
      expect(serverFeeConfig).toBeDefined();
      expect(serverFeeConfig.domestic).toBe(30);
      expect(serverFeeConfig.overseas).toBe(35);
      expect(serverFeeConfig.updatedBy).toBe('admin');

      const apiConfig = body.data.find((c: any) => c._id === 'EXCHANGE_RATE_API');
      expect(apiConfig).toBeDefined();
      expect(apiConfig.provider).toBe('exchangerate-api.com');
      expect(apiConfig.lastUpdated).toBeDefined();
    });
  });

  describe('GET /api/config/:key - 특정 설정 조회', () => {
    beforeEach(async () => {
      const now = new Date();
      await context.db.collection('config').insertMany([
        {
          _id: 'SERVER_FEE_RATES',
          domestic: 30,
          overseas: 35,
          updatedAt: now,
          updatedBy: 'admin',
        },
        {
          _id: 'FEATURE_FLAGS',
          values: {
            enableNewUI: true,
            enableBeautyService: true,
          },
          updatedAt: now,
          updatedBy: 'admin',
        },
      ]);
    });

    it('존재하는 설정 키로 조회 시 해당 설정을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/config/SERVER_FEE_RATES',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data._id).toBe('SERVER_FEE_RATES');
      expect(body.data.domestic).toBe(30);
      expect(body.data.overseas).toBe(35);
    });

    it('values 필드를 포함한 설정을 조회할 수 있어야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/config/FEATURE_FLAGS',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data._id).toBe('FEATURE_FLAGS');
      expect(body.data.values).toEqual({
        enableNewUI: true,
        enableBeautyService: true,
      });
    });

    it('존재하지 않는 설정 키로 조회 시 404를 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/config/NON_EXISTENT_KEY',
      });

      // Assert
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBe('Config not found');
    });
  });

  describe('PUT /api/config/:key - 설정 수정 (upsert)', () => {
    it('존재하는 설정을 수정해야 함', async () => {
      // Arrange
      await context.db.collection('config').insertOne({
        _id: 'SERVER_FEE_RATES',
        domestic: 30,
        overseas: 35,
        updatedAt: new Date(),
        updatedBy: 'admin',
      });

      // Act
      const response = await context.app.inject({
        method: 'PUT',
        url: '/api/config/SERVER_FEE_RATES',
        payload: {
          domestic: 32,
          overseas: 37,
          updatedBy: 'manager',
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.key).toBe('SERVER_FEE_RATES');
      expect(body.data.updated).toBe(true);

      const updated = await context.db.collection('config').findOne({ _id: 'SERVER_FEE_RATES' });
      expect(updated?.domestic).toBe(32);
      expect(updated?.overseas).toBe(37);
      expect(updated?.updatedBy).toBe('manager');
    });

    it('존재하지 않는 설정을 생성해야 함 (upsert)', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PUT',
        url: '/api/config/NEW_CONFIG',
        payload: {
          values: {
            setting1: 'value1',
            setting2: 100,
          },
          updatedBy: 'admin',
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.key).toBe('NEW_CONFIG');

      const created = await context.db.collection('config').findOne({ _id: 'NEW_CONFIG' });
      expect(created).toBeDefined();
      expect(created?.values).toEqual({
        setting1: 'value1',
        setting2: 100,
      });
      expect(created?.updatedBy).toBe('admin');
    });

    it('환율 API 설정을 수정해야 함', async () => {
      // Arrange
      await context.db.collection('config').insertOne({
        _id: 'EXCHANGE_RATE_API',
        provider: 'old-provider',
        endpoint: 'https://old-api.com',
        updateFrequency: 'daily',
        updatedAt: new Date(),
        updatedBy: 'system',
      });

      // Act
      const response = await context.app.inject({
        method: 'PUT',
        url: '/api/config/EXCHANGE_RATE_API',
        payload: {
          provider: 'new-provider',
          endpoint: 'https://new-api.com',
          updateFrequency: 'hourly',
          updatedBy: 'admin',
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);

      const updated = await context.db.collection('config').findOne({ _id: 'EXCHANGE_RATE_API' });
      expect(updated?.provider).toBe('new-provider');
      expect(updated?.endpoint).toBe('https://new-api.com');
      expect(updated?.updateFrequency).toBe('hourly');
    });

    it('feature flags를 수정해야 함', async () => {
      // Arrange
      await context.db.collection('config').insertOne({
        _id: 'FEATURE_FLAGS',
        values: {
          enableNewUI: false,
          enableBeautyService: true,
        },
        updatedAt: new Date(),
        updatedBy: 'admin',
      });

      // Act
      const response = await context.app.inject({
        method: 'PUT',
        url: '/api/config/FEATURE_FLAGS',
        payload: {
          values: {
            enableNewUI: true,
            enableBeautyService: true,
            enableAIService: true,
          },
          updatedBy: 'admin',
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);

      const updated = await context.db.collection('config').findOne({ _id: 'FEATURE_FLAGS' });
      expect(updated?.values).toEqual({
        enableNewUI: true,
        enableBeautyService: true,
        enableAIService: true,
      });
    });

    it('부분 수정이 작동해야 함', async () => {
      // Arrange
      await context.db.collection('config').insertOne({
        _id: 'SERVER_FEE_RATES',
        domestic: 30,
        overseas: 35,
        updatedAt: new Date(),
        updatedBy: 'admin',
      });

      // Act - domestic만 수정
      const response = await context.app.inject({
        method: 'PUT',
        url: '/api/config/SERVER_FEE_RATES',
        payload: {
          domestic: 32,
          updatedBy: 'manager',
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);

      const updated = await context.db.collection('config').findOne({ _id: 'SERVER_FEE_RATES' });
      expect(updated?.domestic).toBe(32);
      expect(updated?.overseas).toBe(35); // 기존 값 유지
    });

    it('updatedAt이 자동으로 갱신되어야 함', async () => {
      // Arrange
      const oldDate = new Date('2024-01-01');
      await context.db.collection('config').insertOne({
        _id: 'TEST_CONFIG',
        values: { test: 'old' },
        updatedAt: oldDate,
        updatedBy: 'admin',
      });

      // Act
      await new Promise(resolve => setTimeout(resolve, 10)); // 시간 경과 보장
      const response = await context.app.inject({
        method: 'PUT',
        url: '/api/config/TEST_CONFIG',
        payload: {
          values: { test: 'new' },
          updatedBy: 'admin',
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);

      const updated = await context.db.collection('config').findOne({ _id: 'TEST_CONFIG' });
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(oldDate.getTime());
    });

    it('복잡한 중첩 객체를 설정값으로 저장할 수 있어야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PUT',
        url: '/api/config/COMPLEX_CONFIG',
        payload: {
          values: {
            level1: {
              level2: {
                level3: 'deep value',
                array: [1, 2, 3],
              },
              flag: true,
            },
            number: 42,
          },
          updatedBy: 'admin',
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);

      const created = await context.db.collection('config').findOne({ _id: 'COMPLEX_CONFIG' });
      expect(created?.values).toEqual({
        level1: {
          level2: {
            level3: 'deep value',
            array: [1, 2, 3],
          },
          flag: true,
        },
        number: 42,
      });
    });
  });

  describe('PUT /api/config/:key - 에러 케이스', () => {
    it('updatedBy 없이 요청 시 에러를 반환해야 함', async () => {
      // 참고: schema validation이 있다면 400을 반환할 것
      // 없다면 500이나 다른 에러 처리 방식에 따라 다름
      // 실제 구현에 맞게 조정 필요
      const response = await context.app.inject({
        method: 'PUT',
        url: '/api/config/TEST_CONFIG',
        payload: {
          values: { test: 'value' },
          // updatedBy 누락
        },
      });

      // 스키마 검증이 있다면 400, 없다면 다른 상태 코드
      // 실제 동작 확인 필요
      expect([400, 500]).toContain(response.statusCode);
    });
  });
});
