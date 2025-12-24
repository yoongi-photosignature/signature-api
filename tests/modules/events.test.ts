import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestApp, closeTestApp, TestContext } from '../helpers/test-app.js';
import { eventsRoutes } from '../../src/modules/events/events.routes.js';
import { BatchEventsInput, EventDocument } from '../../src/types/index.js';

describe('Events API', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await createTestApp();
    await context.app.register(eventsRoutes, { prefix: '/api/events' });
  });

  afterEach(async () => {
    await closeTestApp(context);
  });

  describe('POST /api/events/batch - 이벤트 배치 삽입', () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000';

    it('유효한 이벤트 배치를 삽입해야 함', async () => {
      // Arrange
      const batchInput: BatchEventsInput = {
        kioskId: 'DEV001',
        events: [
          {
            timestamp: new Date().toISOString(),
            sessionId,
            sequenceNo: 1,
            eventType: 'screen_enter',
            screenName: 'home',
          },
          {
            timestamp: new Date().toISOString(),
            sessionId,
            sequenceNo: 2,
            eventType: 'tap',
            screenName: 'home',
            targetId: 'start_button',
            targetType: 'button',
          },
        ],
      };

      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/events/batch',
        payload: batchInput,
      });

      // Assert
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.inserted).toBe(2);
      expect(body.data.duplicates).toBe(0);
      expect(body.data.errors).toBe(0);

      // DB 확인
      const events = await context.db.collection('events').find({ sessionId }).toArray();
      expect(events).toHaveLength(2);
    });

    it('중복된 이벤트는 필터링되어야 함', async () => {
      // Arrange - 기존 이벤트 삽입
      await context.db.collection('events').insertOne({
        timestamp: new Date(),
        kioskId: 'DEV001',
        sessionId,
        sequenceNo: 1,
        eventType: 'screen_enter',
        screenName: 'home',
        createdAt: new Date(),
      } as EventDocument);

      const batchInput: BatchEventsInput = {
        kioskId: 'DEV001',
        events: [
          {
            timestamp: new Date().toISOString(),
            sessionId,
            sequenceNo: 1, // 중복
            eventType: 'screen_enter',
            screenName: 'home',
          },
          {
            timestamp: new Date().toISOString(),
            sessionId,
            sequenceNo: 2, // 신규
            eventType: 'tap',
            screenName: 'home',
          },
        ],
      };

      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/events/batch',
        payload: batchInput,
      });

      // Assert
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.inserted).toBe(1);
      expect(body.data.duplicates).toBe(1);

      // DB 확인 - 총 2개만 있어야 함
      const events = await context.db.collection('events').find({ sessionId }).toArray();
      expect(events).toHaveLength(2);
    });

    it('빈 이벤트 배열 전송 시 정상 처리되어야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/events/batch',
        payload: {
          kioskId: 'DEV001',
          events: [],
        },
      });

      // Assert
      expect(response.statusCode).toBe(400); // minItems: 1 검증 실패
    });

    it('필수 필드 누락 시 400을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/events/batch',
        payload: {
          kioskId: 'DEV001',
          events: [
            {
              timestamp: new Date().toISOString(),
              sessionId,
              // sequenceNo 누락
              eventType: 'tap',
              screenName: 'home',
            },
          ],
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });

    it('잘못된 eventType으로 요청 시 400을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/events/batch',
        payload: {
          kioskId: 'DEV001',
          events: [
            {
              timestamp: new Date().toISOString(),
              sessionId,
              sequenceNo: 1,
              eventType: 'invalid_event_type',
              screenName: 'home',
            },
          ],
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });

    it('잘못된 UUID 형식의 sessionId로 요청 시 400을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/events/batch',
        payload: {
          kioskId: 'DEV001',
          events: [
            {
              timestamp: new Date().toISOString(),
              sessionId: 'invalid-uuid',
              sequenceNo: 1,
              eventType: 'tap',
              screenName: 'home',
            },
          ],
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });

    it('100개 이상의 이벤트 전송 시 400을 반환해야 함', async () => {
      // Arrange
      const events = Array.from({ length: 101 }, (_, i) => ({
        timestamp: new Date().toISOString(),
        sessionId,
        sequenceNo: i,
        eventType: 'tap' as const,
        screenName: 'home',
      }));

      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/events/batch',
        payload: {
          kioskId: 'DEV001',
          events,
        },
      });

      // Assert
      expect(response.statusCode).toBe(400); // maxItems: 100 검증 실패
    });

    it('선택적 필드들을 포함하여 저장할 수 있어야 함', async () => {
      // Arrange
      const batchInput: BatchEventsInput = {
        kioskId: 'DEV001',
        events: [
          {
            timestamp: new Date().toISOString(),
            sessionId,
            sequenceNo: 1,
            eventType: 'select',
            screenName: 'customize',
            targetId: 'frame_4cut',
            targetType: 'frame',
            value: '4cut',
          },
        ],
      };

      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/events/batch',
        payload: batchInput,
      });

      // Assert
      expect(response.statusCode).toBe(201);

      const event = await context.db.collection('events').findOne({ sessionId, sequenceNo: 1 }) as EventDocument;
      expect(event.targetId).toBe('frame_4cut');
      expect(event.targetType).toBe('frame');
      expect(event.value).toBe('4cut');
    });

    it('여러 세션의 이벤트를 배치로 처리할 수 있어야 함', async () => {
      // Arrange
      const sessionId2 = '550e8400-e29b-41d4-a716-446655440001';
      const batchInput: BatchEventsInput = {
        kioskId: 'DEV001',
        events: [
          {
            timestamp: new Date().toISOString(),
            sessionId,
            sequenceNo: 1,
            eventType: 'screen_enter',
            screenName: 'home',
          },
          {
            timestamp: new Date().toISOString(),
            sessionId: sessionId2,
            sequenceNo: 1,
            eventType: 'screen_enter',
            screenName: 'home',
          },
        ],
      };

      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/events/batch',
        payload: batchInput,
      });

      // Assert
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.inserted).toBe(2);

      const session1Events = await context.db.collection('events').find({ sessionId }).toArray();
      const session2Events = await context.db.collection('events').find({ sessionId: sessionId2 }).toArray();
      expect(session1Events).toHaveLength(1);
      expect(session2Events).toHaveLength(1);
    });
  });

  describe('GET /api/events/session/:sessionId - 세션별 이벤트 조회', () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000';

    beforeEach(async () => {
      const now = new Date();
      const events: EventDocument[] = [
        {
          timestamp: now,
          kioskId: 'DEV001',
          sessionId,
          sequenceNo: 1,
          eventType: 'screen_enter',
          screenName: 'home',
          createdAt: now,
        } as EventDocument,
        {
          timestamp: now,
          kioskId: 'DEV001',
          sessionId,
          sequenceNo: 2,
          eventType: 'tap',
          screenName: 'home',
          targetId: 'start_button',
          targetType: 'button',
          createdAt: now,
        } as EventDocument,
        {
          timestamp: now,
          kioskId: 'DEV001',
          sessionId,
          sequenceNo: 3,
          eventType: 'screen_exit',
          screenName: 'home',
          createdAt: now,
        } as EventDocument,
      ];

      await context.db.collection('events').insertMany(events);
    });

    it('특정 세션의 모든 이벤트를 조회해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: `/api/events/session/${sessionId}`,
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(3);
      expect(body.meta.count).toBe(3);
    });

    it('이벤트가 sequenceNo 순서로 정렬되어야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: `/api/events/session/${sessionId}`,
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      const sequenceNos = body.data.map((e: any) => e.sequenceNo);
      expect(sequenceNos).toEqual([1, 2, 3]);
    });

    it('존재하지 않는 세션의 이벤트 조회 시 빈 배열을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/events/session/550e8400-e29b-41d4-a716-446655440099',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
      expect(body.meta.count).toBe(0);
    });

    it('잘못된 UUID 형식으로 요청 시 400을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/events/session/invalid-uuid',
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });

    it('이벤트 데이터가 올바르게 직렬화되어야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: `/api/events/session/${sessionId}`,
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

  describe('GET /api/events - 이벤트 목록 조회 (필터링)', () => {
    const sessionId1 = '550e8400-e29b-41d4-a716-446655440000';
    const sessionId2 = '550e8400-e29b-41d4-a716-446655440001';

    beforeEach(async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const events: EventDocument[] = [
        {
          timestamp: now,
          kioskId: 'DEV001',
          sessionId: sessionId1,
          sequenceNo: 1,
          eventType: 'screen_enter',
          screenName: 'home',
          createdAt: now,
        } as EventDocument,
        {
          timestamp: now,
          kioskId: 'DEV001',
          sessionId: sessionId1,
          sequenceNo: 2,
          eventType: 'tap',
          screenName: 'home',
          createdAt: now,
        } as EventDocument,
        {
          timestamp: yesterday,
          kioskId: 'DEV002',
          sessionId: sessionId2,
          sequenceNo: 1,
          eventType: 'screen_enter',
          screenName: 'customize',
          createdAt: yesterday,
        } as EventDocument,
        {
          timestamp: yesterday,
          kioskId: 'DEV002',
          sessionId: sessionId2,
          sequenceNo: 2,
          eventType: 'select',
          screenName: 'customize',
          createdAt: yesterday,
        } as EventDocument,
      ];

      await context.db.collection('events').insertMany(events);
    });

    it('모든 이벤트를 조회해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/events',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(4);
      expect(body.meta.total).toBe(4);
    });

    it('sessionId로 필터링해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: `/api/events?sessionId=${sessionId1}`,
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.data.every((e: any) => e.sessionId === sessionId1)).toBe(true);
    });

    it('kioskId로 필터링해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/events?kioskId=DEV001',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.data.every((e: any) => e.kioskId === 'DEV001')).toBe(true);
    });

    it('eventType으로 필터링해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/events?eventType=screen_enter',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.data.every((e: any) => e.eventType === 'screen_enter')).toBe(true);
    });

    it('여러 필터를 동시에 적용해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: `/api/events?kioskId=DEV001&eventType=tap`,
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].kioskId).toBe('DEV001');
      expect(body.data[0].eventType).toBe('tap');
    });

    it('시간 범위로 필터링해야 함', async () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString();

      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: `/api/events?startTime=${yesterdayStr}`,
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.length).toBeGreaterThanOrEqual(2); // 어제 이후의 모든 이벤트
    });

    it('페이지네이션이 작동해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/events?limit=2&offset=0',
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
        url: '/api/events?limit=2&offset=2',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.meta.offset).toBe(2);
      expect(body.meta.hasMore).toBe(false);
    });

    it('이벤트가 최신순으로 정렬되어야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/events',
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

    it('이벤트가 없을 때 빈 배열을 반환해야 함', async () => {
      // Arrange
      await context.db.collection('events').deleteMany({});

      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/events',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
      expect(body.meta.total).toBe(0);
    });
  });
});
