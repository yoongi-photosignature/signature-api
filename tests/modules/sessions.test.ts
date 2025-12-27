import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestApp, closeTestApp, TestContext } from '../helpers/test-app.js';
import { sessionsRoutes } from '../../src/modules/sessions/sessions.routes.js';
import { SessionDocument, CreateSessionInput, UpdateSessionInput } from '../../src/types/index.js';

describe('Sessions API', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await createTestApp();
    await context.app.register(sessionsRoutes, { prefix: '/api/sessions' });
  });

  afterEach(async () => {
    await closeTestApp(context);
  });

  describe('POST /api/sessions - 세션 생성', () => {
    const validSessionInput: CreateSessionInput = {
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      kioskId: 'DEV001',
      storeId: 'STORE001',
      groupId: 'GROUP001',
      countryCode: 'KR',
      kioskVersion: '1.0.0',
      launcherVersion: '1.0.0',
      metadata: {
        osVersion: 'Android 12',
        screenResolution: '1920x1080',
      },
    };

    it('유효한 입력으로 세션을 생성해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: validSessionInput,
      });

      // Assert
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.sessionId).toBe(validSessionInput.sessionId);

      // DB 확인
      const session = await context.db.collection('sessions').findOne({ sessionId: validSessionInput.sessionId });
      expect(session).toBeDefined();
      expect(session?.kioskId).toBe('DEV001');
      expect(session?.status).toBe('started');
      expect(session?.funnel).toBeDefined();
      expect(session?.funnel.stages.attract.reached).toBe(true);
      expect(session?.funnel.overallProgress).toBe(0.125);
    });

    it('초기 세션 상태가 올바르게 생성되어야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: validSessionInput,
      });

      // Assert
      expect(response.statusCode).toBe(201);

      const session = await context.db.collection('sessions').findOne({ sessionId: validSessionInput.sessionId }) as SessionDocument;

      // 초기 퍼널 상태 확인
      expect(session.funnel.stages.attract.reached).toBe(true);
      expect(session.funnel.stages.engage.reached).toBe(false);
      expect(session.funnel.lastCompletedStage).toBeNull();

      // 초기 선택 상태 확인
      expect(session.selections.frameType).toBeNull();
      expect(session.selections.cutCount).toBe(0);
      expect(session.selections.qrEnabled).toBe(false);

      // 초기 행동 요약 확인
      expect(session.behaviorSummary.totalTaps).toBe(0);
      expect(session.behaviorSummary.backPressCount).toBe(0);
      expect(session.behaviorSummary.retakeCount).toBe(0);
    });

    it('중복된 sessionId로 생성 시도 시 409를 반환해야 함', async () => {
      // Arrange - 첫 번째 세션 생성
      await context.app.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: validSessionInput,
      });

      // Act - 동일한 sessionId로 재시도
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: validSessionInput,
      });

      // Assert
      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('DUPLICATE_SESSION');
    });

    it('잘못된 UUID 형식의 sessionId로 요청 시 400을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: {
          ...validSessionInput,
          sessionId: 'invalid-uuid',
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });

    it('잘못된 국가 코드로 요청 시 400을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: {
          ...validSessionInput,
          countryCode: 'INVALID',
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });

    it('잘못된 앱 버전 형식으로 요청 시 400을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: {
          ...validSessionInput,
          kioskVersion: 'not-semver',
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });

    it('필수 필드 누락 시 400을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: {
          sessionId: validSessionInput.sessionId,
          // kioskId 등 필수 필드 누락
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/sessions/:sessionId - 세션 조회', () => {
    const testSessionId = '550e8400-e29b-41d4-a716-446655440001';

    beforeEach(async () => {
      const now = new Date();
      await context.db.collection('sessions').insertOne({
        sessionId: testSessionId,
        kioskId: 'DEV001',
        storeId: 'STORE001',
        groupId: 'GROUP001',
        countryCode: 'KR',
        kioskVersion: '1.0.0',
        launcherVersion: '1.0.0',
        startedAt: now,
        endedAt: null,
        durationMs: null,
        status: 'in_progress',
        funnel: {
          stages: {
            attract: { reached: true, enteredAt: now },
            engage: { reached: true, enteredAt: now },
            customize: { reached: false },
            capture: { reached: false },
            edit: { reached: false },
            checkout: { reached: false },
            payment: { reached: false },
            fulfill: { reached: false },
          },
          lastCompletedStage: 'engage',
          exitStage: null,
          overallProgress: 0.25,
        },
        selections: {
          frameType: null,
          cutCount: 0,
          background: null,
          character: null,
          filter: null,
          qrEnabled: false,
        },
        behaviorSummary: {
          totalTaps: 5,
          totalScrolls: 2,
          backPressCount: 0,
          retakeCount: 0,
          selectionChanges: { frame: 0, background: 0, character: 0, filter: 0 },
          longestIdleMs: 2000,
        },
        screenDurations: {},
        metadata: {
          osVersion: 'Android 12',
          screenResolution: '1920x1080',
        },
        createdAt: now,
        updatedAt: now,
      } as SessionDocument);
    });

    it('존재하는 세션을 조회해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: `/api/sessions/${testSessionId}`,
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.sessionId).toBe(testSessionId);
      expect(body.data.status).toBe('in_progress');
      expect(body.data.funnel.overallProgress).toBe(0.25);
    });

    it('세션 데이터가 올바르게 직렬화되어야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: `/api/sessions/${testSessionId}`,
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Date가 ISO 문자열로 변환되었는지 확인
      expect(typeof body.data.startedAt).toBe('string');
      expect(body.data.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(typeof body.data.funnel.stages.attract.enteredAt).toBe('string');
    });

    it('존재하지 않는 세션 조회 시 404를 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/sessions/550e8400-e29b-41d4-a716-446655440099',
      });

      // Assert
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('잘못된 UUID 형식으로 요청 시 400을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/sessions/invalid-uuid',
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });
  });

  describe('PATCH /api/sessions/:sessionId - 세션 업데이트', () => {
    const testSessionId = '550e8400-e29b-41d4-a716-446655440002';

    beforeEach(async () => {
      const now = new Date();
      await context.db.collection('sessions').insertOne({
        sessionId: testSessionId,
        kioskId: 'DEV001',
        storeId: 'STORE001',
        groupId: 'GROUP001',
        countryCode: 'KR',
        kioskVersion: '1.0.0',
        launcherVersion: '1.0.0',
        startedAt: now,
        endedAt: null,
        durationMs: null,
        status: 'in_progress',
        funnel: {
          stages: {
            attract: { reached: true, enteredAt: now },
            engage: { reached: true, enteredAt: now },
            customize: { reached: false },
            capture: { reached: false },
            edit: { reached: false },
            checkout: { reached: false },
            payment: { reached: false },
            fulfill: { reached: false },
          },
          lastCompletedStage: 'engage',
          exitStage: null,
          overallProgress: 0.25,
        },
        selections: {
          frameType: null,
          cutCount: 0,
          background: null,
          character: null,
          filter: null,
          qrEnabled: false,
        },
        behaviorSummary: {
          totalTaps: 5,
          totalScrolls: 2,
          backPressCount: 0,
          retakeCount: 0,
          selectionChanges: { frame: 0, background: 0, character: 0, filter: 0 },
          longestIdleMs: 2000,
        },
        screenDurations: {},
        metadata: {
          osVersion: 'Android 12',
          screenResolution: '1920x1080',
        },
        createdAt: now,
        updatedAt: now,
      } as SessionDocument);
    });

    it('세션 상태를 업데이트해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PATCH',
        url: `/api/sessions/${testSessionId}`,
        payload: {
          status: 'completed',
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.updated).toBe(true);

      const updated = await context.db.collection('sessions').findOne({ sessionId: testSessionId }) as SessionDocument;
      expect(updated.status).toBe('completed');
    });

    it('퍼널 진행 상황을 업데이트해야 함', async () => {
      // Arrange
      const now = new Date();
      const updatePayload: UpdateSessionInput = {
        funnel: {
          stages: {
            attract: { reached: true, enteredAt: now.toISOString() },
            engage: { reached: true, enteredAt: now.toISOString() },
            customize: { reached: true, enteredAt: now.toISOString() },
            capture: { reached: false },
            edit: { reached: false },
            checkout: { reached: false },
            payment: { reached: false },
            fulfill: { reached: false },
          },
          lastCompletedStage: 'customize',
          exitStage: null,
          overallProgress: 0.375,
        },
      };

      // Act
      const response = await context.app.inject({
        method: 'PATCH',
        url: `/api/sessions/${testSessionId}`,
        payload: updatePayload,
      });

      // Assert
      expect(response.statusCode).toBe(200);

      const updated = await context.db.collection('sessions').findOne({ sessionId: testSessionId }) as SessionDocument;
      expect(updated.funnel.lastCompletedStage).toBe('customize');
      expect(updated.funnel.overallProgress).toBe(0.375);
      expect(updated.funnel.stages.customize.reached).toBe(true);
    });

    it('선택 사항을 업데이트해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PATCH',
        url: `/api/sessions/${testSessionId}`,
        payload: {
          selections: {
            frameType: '4cut',
            cutCount: 4,
            background: 'blue',
            character: 'bear',
            filter: 'vintage',
            qrEnabled: true,
          },
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);

      const updated = await context.db.collection('sessions').findOne({ sessionId: testSessionId }) as SessionDocument;
      expect(updated.selections.frameType).toBe('4cut');
      expect(updated.selections.cutCount).toBe(4);
      expect(updated.selections.qrEnabled).toBe(true);
    });

    it('결제 정보를 업데이트해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PATCH',
        url: `/api/sessions/${testSessionId}`,
        payload: {
          payment: {
            completed: true,
            method: 'CARD',
            amount: 5000,
            currency: 'KRW',
          },
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);

      const updated = await context.db.collection('sessions').findOne({ sessionId: testSessionId }) as SessionDocument;
      expect(updated.payment?.completed).toBe(true);
      expect(updated.payment?.method).toBe('CARD');
      expect(updated.payment?.amount).toBe(5000);
    });

    it('행동 요약을 업데이트해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PATCH',
        url: `/api/sessions/${testSessionId}`,
        payload: {
          behaviorSummary: {
            totalTaps: 25,
            totalScrolls: 10,
            backPressCount: 2,
            retakeCount: 1,
            selectionChanges: { frame: 2, background: 3, character: 1, filter: 4 },
            longestIdleMs: 5000,
          },
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);

      const updated = await context.db.collection('sessions').findOne({ sessionId: testSessionId }) as SessionDocument;
      expect(updated.behaviorSummary.totalTaps).toBe(25);
      expect(updated.behaviorSummary.backPressCount).toBe(2);
      expect(updated.behaviorSummary.selectionChanges.filter).toBe(4);
    });

    it('세션 종료 시 endedAt과 durationMs를 업데이트해야 함', async () => {
      // Arrange
      const endedAt = new Date();

      // Act
      const response = await context.app.inject({
        method: 'PATCH',
        url: `/api/sessions/${testSessionId}`,
        payload: {
          status: 'completed',
          endedAt: endedAt.toISOString(),
          durationMs: 120000,
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);

      const updated = await context.db.collection('sessions').findOne({ sessionId: testSessionId }) as SessionDocument;
      expect(updated.status).toBe('completed');
      expect(updated.endedAt).toBeDefined();
      expect(updated.durationMs).toBe(120000);
    });

    it('스크린 체류 시간을 업데이트해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PATCH',
        url: `/api/sessions/${testSessionId}`,
        payload: {
          screenDurations: {
            'home': 5000,
            'customize': 15000,
            'capture': 30000,
          },
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);

      const updated = await context.db.collection('sessions').findOne({ sessionId: testSessionId }) as SessionDocument;
      expect(updated.screenDurations.home).toBe(5000);
      expect(updated.screenDurations.capture).toBe(30000);
    });

    it('존재하지 않는 세션 업데이트 시 404를 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PATCH',
        url: '/api/sessions/550e8400-e29b-41d4-a716-446655440099',
        payload: {
          status: 'completed',
        },
      });

      // Assert
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('빈 업데이트 요청 시 400을 반환해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'PATCH',
        url: `/api/sessions/${testSessionId}`,
        payload: {},
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });

    it('updatedAt이 자동으로 갱신되어야 함', async () => {
      // Arrange
      const original = await context.db.collection('sessions').findOne({ sessionId: testSessionId }) as SessionDocument;
      await new Promise(resolve => setTimeout(resolve, 10));

      // Act
      await context.app.inject({
        method: 'PATCH',
        url: `/api/sessions/${testSessionId}`,
        payload: {
          status: 'completed',
        },
      });

      // Assert
      const updated = await context.db.collection('sessions').findOne({ sessionId: testSessionId }) as SessionDocument;
      expect(updated.updatedAt.getTime()).toBeGreaterThan(original.updatedAt.getTime());
    });
  });

  describe('GET /api/sessions - 세션 목록 조회', () => {
    beforeEach(async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const baseFunnel = {
        stages: {
          attract: { reached: true, enteredAt: now },
          engage: { reached: false },
          customize: { reached: false },
          capture: { reached: false },
          edit: { reached: false },
          checkout: { reached: false },
          payment: { reached: false },
          fulfill: { reached: false },
        },
        lastCompletedStage: null,
        exitStage: null,
        overallProgress: 0.125,
      };

      const sessions: SessionDocument[] = [
        {
          sessionId: '550e8400-e29b-41d4-a716-446655440010',
          kioskId: 'DEV001',
          storeId: 'STORE001',
          groupId: 'GROUP001',
          countryCode: 'KR',
          kioskVersion: '1.0.0',
          launcherVersion: '1.0.0',
          startedAt: now,
          endedAt: null,
          durationMs: null,
          status: 'in_progress',
          funnel: baseFunnel,
          selections: { frameType: null, cutCount: 0, background: null, character: null, filter: null, qrEnabled: false },
          behaviorSummary: { totalTaps: 0, totalScrolls: 0, backPressCount: 0, retakeCount: 0, selectionChanges: { frame: 0, background: 0, character: 0, filter: 0 }, longestIdleMs: 0 },
          screenDurations: {},
          metadata: { osVersion: 'Android 12', screenResolution: '1920x1080' },
          createdAt: now,
          updatedAt: now,
        } as SessionDocument,
        {
          sessionId: '550e8400-e29b-41d4-a716-446655440011',
          kioskId: 'DEV001',
          storeId: 'STORE001',
          groupId: 'GROUP001',
          countryCode: 'KR',
          kioskVersion: '1.0.0',
          launcherVersion: '1.0.0',
          startedAt: yesterday,
          endedAt: yesterday,
          durationMs: 180000,
          status: 'completed',
          funnel: baseFunnel,
          selections: { frameType: '4cut', cutCount: 4, background: 'blue', character: null, filter: null, qrEnabled: false },
          behaviorSummary: { totalTaps: 20, totalScrolls: 5, backPressCount: 0, retakeCount: 0, selectionChanges: { frame: 1, background: 1, character: 0, filter: 0 }, longestIdleMs: 3000 },
          screenDurations: {},
          metadata: { osVersion: 'Android 12', screenResolution: '1920x1080' },
          createdAt: yesterday,
          updatedAt: yesterday,
        } as SessionDocument,
        {
          sessionId: '550e8400-e29b-41d4-a716-446655440012',
          kioskId: 'DEV002',
          storeId: 'STORE002',
          groupId: 'GROUP001',
          countryCode: 'JP',
          kioskVersion: '1.0.0',
          launcherVersion: '1.0.0',
          startedAt: yesterday,
          endedAt: null,
          durationMs: null,
          status: 'abandoned',
          funnel: baseFunnel,
          selections: { frameType: null, cutCount: 0, background: null, character: null, filter: null, qrEnabled: false },
          behaviorSummary: { totalTaps: 3, totalScrolls: 0, backPressCount: 1, retakeCount: 0, selectionChanges: { frame: 0, background: 0, character: 0, filter: 0 }, longestIdleMs: 10000 },
          screenDurations: {},
          metadata: { osVersion: 'Android 11', screenResolution: '1920x1080' },
          createdAt: yesterday,
          updatedAt: yesterday,
        } as SessionDocument,
      ];

      await context.db.collection('sessions').insertMany(sessions);
    });

    it('모든 세션을 조회해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/sessions',
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
        url: '/api/sessions?kioskId=DEV001',
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
        url: '/api/sessions?storeId=STORE002',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].storeId).toBe('STORE002');
    });

    it('status로 필터링해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/sessions?status=completed',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].status).toBe('completed');
    });

    it('여러 필터를 동시에 적용해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/sessions?kioskId=DEV001&status=completed',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].kioskId).toBe('DEV001');
      expect(body.data[0].status).toBe('completed');
    });

    it('날짜 범위로 필터링해야 함', async () => {
      // Arrange
      const today = new Date().toISOString().split('T')[0];

      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: `/api/sessions?startDate=${today}`,
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1); // 오늘 생성된 세션만
    });

    it('페이지네이션이 작동해야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/sessions?limit=2&offset=0',
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
        url: '/api/sessions?limit=2&offset=2',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.meta.hasMore).toBe(false);
    });

    it('세션이 없을 때 빈 배열을 반환해야 함', async () => {
      // Arrange
      await context.db.collection('sessions').deleteMany({});

      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/sessions',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
      expect(body.meta.total).toBe(0);
    });

    it('세션이 최신순으로 정렬되어야 함', async () => {
      // Act
      const response = await context.app.inject({
        method: 'GET',
        url: '/api/sessions',
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // 첫 번째가 가장 최신이어야 함
      const dates = body.data.map((s: any) => new Date(s.startedAt).getTime());
      for (let i = 0; i < dates.length - 1; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
      }
    });
  });
});
