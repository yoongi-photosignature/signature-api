import { SessionsRepository, SessionFilter } from './sessions.repository.js';
import {
  CreateSessionInput,
  UpdateSessionInput,
  SessionDocument,
  FunnelProgress,
  SessionSelections,
  BehaviorSummary,
} from '../../types/index.js';

export class SessionsService {
  constructor(private repository: SessionsRepository) {}

  /**
   * 새 세션 생성
   */
  async createSession(input: CreateSessionInput): Promise<string> {
    const now = new Date();

    // 초기 퍼널 상태 생성
    const initialFunnel: FunnelProgress = {
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
      overallProgress: 0.125, // 1/8
    };

    // 초기 선택 상태
    const initialSelections: SessionSelections = {
      frameType: null,
      cutCount: 0,
      background: null,
      character: null,
      filter: null,
      qrEnabled: false,
    };

    // 초기 행동 요약
    const initialBehavior: BehaviorSummary = {
      totalTaps: 0,
      totalScrolls: 0,
      backPressCount: 0,
      retakeCount: 0,
      selectionChanges: { frame: 0, background: 0, character: 0, filter: 0 },
      longestIdleMs: 0,
    };

    const session: Omit<SessionDocument, '_id'> = {
      sessionId: input.sessionId,
      kioskId: input.kioskId,
      storeId: input.storeId,
      groupId: input.groupId,
      countryCode: input.countryCode,
      appVersion: input.appVersion,
      startedAt: now,
      endedAt: null,
      durationMs: null,
      status: 'started',
      funnel: initialFunnel,
      selections: initialSelections,
      behaviorSummary: initialBehavior,
      screenDurations: {},
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
    };

    return this.repository.create(session);
  }

  /**
   * 세션 조회
   */
  async getSession(sessionId: string): Promise<SessionDocument | null> {
    return this.repository.findBySessionId(sessionId);
  }

  /**
   * 세션 업데이트
   */
  async updateSession(sessionId: string, input: UpdateSessionInput): Promise<boolean> {
    const session = await this.repository.findBySessionId(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const updateData: Partial<SessionDocument> = {};

    if (input.status !== undefined) updateData.status = input.status;
    if (input.endedAt !== undefined) updateData.endedAt = new Date(input.endedAt);
    if (input.durationMs !== undefined) updateData.durationMs = input.durationMs;
    if (input.funnel !== undefined) updateData.funnel = this.deserializeFunnel(input.funnel);
    if (input.exitContext !== undefined) updateData.exitContext = input.exitContext;
    if (input.selections !== undefined) updateData.selections = input.selections;
    if (input.payment !== undefined) updateData.payment = input.payment;
    if (input.behaviorSummary !== undefined) updateData.behaviorSummary = input.behaviorSummary;
    if (input.screenDurations !== undefined) updateData.screenDurations = input.screenDurations;
    if (input.experiments !== undefined) updateData.experiments = input.experiments;

    return this.repository.update(sessionId, updateData);
  }

  /**
   * 세션 목록 조회
   */
  async listSessions(
    filter: SessionFilter,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ sessions: SessionDocument[]; total: number }> {
    const [sessions, total] = await Promise.all([
      this.repository.findMany(filter, limit, offset),
      this.repository.count(filter),
    ]);

    return { sessions, total };
  }

  /**
   * 키오스크의 최근 세션 조회
   */
  async getLatestSessionByKiosk(kioskId: string): Promise<SessionDocument | null> {
    return this.repository.findLatestByKiosk(kioskId);
  }

  /**
   * Funnel 데이터 역직렬화 (ISO 문자열 → Date 변환)
   */
  private deserializeFunnel(funnel: FunnelProgress): FunnelProgress {
    const stages = { ...funnel.stages };

    for (const key of Object.keys(stages) as Array<keyof typeof stages>) {
      const stage = stages[key];
      if (stage.enteredAt) {
        stage.enteredAt = new Date(stage.enteredAt);
      }
      if (stage.exitedAt) {
        stage.exitedAt = new Date(stage.exitedAt);
      }
    }

    return {
      ...funnel,
      stages,
    };
  }

  /**
   * 세션 직렬화 (API 응답용)
   */
  serializeSession(session: SessionDocument) {
    return {
      ...session,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      funnel: this.serializeFunnel(session.funnel),
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
  }

  /**
   * Funnel 데이터 직렬화 (Date → ISO 문자열)
   */
  private serializeFunnel(funnel: FunnelProgress) {
    const serializedStages: Record<string, unknown> = {};

    for (const key of Object.keys(funnel.stages) as Array<keyof typeof funnel.stages>) {
      const stage = funnel.stages[key];
      serializedStages[key] = {
        reached: stage.reached,
        enteredAt: stage.enteredAt instanceof Date ? stage.enteredAt.toISOString() : stage.enteredAt,
        exitedAt: stage.exitedAt instanceof Date ? stage.exitedAt.toISOString() : stage.exitedAt,
        durationMs: stage.durationMs,
      };
    }

    return {
      ...funnel,
      stages: serializedStages,
    };
  }
}
