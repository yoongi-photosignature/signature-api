import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestApp, closeTestApp, TestContext } from '../helpers/test-app.js';
import { exchangeRatesRoutes } from '../../src/modules/exchange-rates/exchange-rates.routes.js';
import { ExchangeRateDocument } from '../../src/types/index.js';

describe('Exchange Rates API', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await createTestApp();
    await context.app.register(exchangeRatesRoutes, { prefix: '/api/exchange-rates' });
  });

  afterEach(async () => {
    await closeTestApp(context);
  });

  describe('GET /api/exchange-rates - 최신 환율 조회', () => {
    it('최신 환율이 존재할 때 성공적으로 반환해야 함', async () => {
      // Arrange: 테스트 데이터 삽입
      const testRate: ExchangeRateDocument = {
        _id: '2025-01-15',
        baseCurrency: 'KRW',
        rates: {
          USD: 0.00075,
          JPY: 0.11,
          VND: 19.5,
        },
        source: 'TEST_API',
        apiEndpoint: 'https://test-api.com',
        fetchedAt: new Date('2025-01-15T10:00:00Z'),
      };

      await context.db.collection('exchangeRates').insertOne(testRate);

      // Act: API 호출
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/exchange-rates',
      });

      // Assert: 응답 검증
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.date).toBe('2025-01-15');
      expect(body.data.baseCurrency).toBe('KRW');
      expect(body.data.rates).toEqual({
        USD: 0.00075,
        JPY: 0.11,
        VND: 19.5,
      });
      expect(body.data.source).toBe('TEST_API');
      expect(body.data.fetchedAt).toBe('2025-01-15T10:00:00.000Z');
    });

    it('환율 데이터가 없을 때 404 에러를 반환해야 함', async () => {
      // Act: API 호출
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/exchange-rates',
      });

      // Assert: 응답 검증
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBe('No exchange rates found');
    });

    it('여러 환율 데이터가 있을 때 가장 최신 데이터를 반환해야 함', async () => {
      // Arrange: 여러 날짜의 데이터 삽입
      await context.db.collection('exchangeRates').insertMany([
        {
          _id: '2025-01-13',
          baseCurrency: 'KRW',
          rates: { USD: 0.00074 },
          source: 'API',
          apiEndpoint: 'https://api.com',
          fetchedAt: new Date('2025-01-13T10:00:00Z'),
        },
        {
          _id: '2025-01-15',
          baseCurrency: 'KRW',
          rates: { USD: 0.00075 },
          source: 'API',
          apiEndpoint: 'https://api.com',
          fetchedAt: new Date('2025-01-15T10:00:00Z'),
        },
        {
          _id: '2025-01-14',
          baseCurrency: 'KRW',
          rates: { USD: 0.00076 },
          source: 'API',
          apiEndpoint: 'https://api.com',
          fetchedAt: new Date('2025-01-14T10:00:00Z'),
        },
      ]);

      // Act: API 호출
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/exchange-rates',
      });

      // Assert: 가장 최신 데이터 확인
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.date).toBe('2025-01-15');
      expect(body.data.rates.USD).toBe(0.00075);
    });
  });

  describe('GET /api/exchange-rates/:date - 특정 날짜 환율 조회', () => {
    beforeEach(async () => {
      // 테스트 데이터 삽입
      await context.db.collection('exchangeRates').insertMany([
        {
          _id: '2025-01-15',
          baseCurrency: 'KRW',
          rates: { USD: 0.00075, JPY: 0.11 },
          source: 'API',
          apiEndpoint: 'https://api.com',
          fetchedAt: new Date('2025-01-15T10:00:00Z'),
        },
        {
          _id: '2025-01-14',
          baseCurrency: 'KRW',
          rates: { USD: 0.00076, JPY: 0.12 },
          source: 'API',
          apiEndpoint: 'https://api.com',
          fetchedAt: new Date('2025-01-14T10:00:00Z'),
        },
      ]);
    });

    it('존재하는 날짜로 조회 시 해당 날짜의 환율을 반환해야 함', async () => {
      // Act: API 호출
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/exchange-rates/2025-01-15',
      });

      // Assert: 응답 검증
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.date).toBe('2025-01-15');
      expect(body.data.rates.USD).toBe(0.00075);
      expect(body.data.rates.JPY).toBe(0.11);
    });

    it('존재하지 않는 날짜로 조회 시 404 에러를 반환해야 함', async () => {
      // Act: API 호출
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/exchange-rates/2025-01-20',
      });

      // Assert: 응답 검증
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBe('Exchange rates not found for this date');
    });

    it('잘못된 날짜 형식으로 조회 시 에러를 반환해야 함', async () => {
      // Act: API 호출
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/exchange-rates/invalid-date',
      });

      // Assert: 응답 검증 (스키마 검증에 따라 400 또는 404 가능)
      expect([400, 404, 500]).toContain(response.statusCode);
      // 잘못된 날짜 형식이므로 에러가 발생해야 함
    });

    it('과거 날짜 조회가 정상 작동해야 함', async () => {
      // Act: API 호출
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/exchange-rates/2025-01-14',
      });

      // Assert: 응답 검증
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.date).toBe('2025-01-14');
      expect(body.data.rates.USD).toBe(0.00076);
    });
  });
});
