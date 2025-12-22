# PhotoSignature 데이터 수집 설계 최종안

> **작성일**: 2025-01-19
> **목적**: 키오스크 → API 서버 → MongoDB 데이터 수집 체계 설계
> **대상**: 프론트엔드(키오스크) 팀, 백엔드 팀

---

## 목차

1. [개요](#1-개요)
2. [아키텍처](#2-아키텍처)
3. [컬렉션 구조](#3-컬렉션-구조)
4. [클라이언트 구현 가이드](#4-클라이언트-구현-가이드)
5. [API 엔드포인트](#5-api-엔드포인트)
6. [데이터 흐름](#6-데이터-흐름)
7. [구현 우선순위](#7-구현-우선순위)

---

## 1. 개요

### 1.1 목표

- **매출 정산**: 기기별/매장별/그룹별 정확한 매출 집계
- **UX 분석**: 퍼널 전환율, 이탈 지점, 사용자 행동 패턴
- **성능 모니터링**: 촬영/출력/결제 소요 시간, 병목 구간 식별
- **에러 추적**: 크래시 재현, 에러 패턴 분석, 버전별 안정성

### 1.2 핵심 설계 원칙

| 원칙 | 설명 |
|------|------|
| **세션 중심** | 모든 데이터는 `sessionId`로 연결 |
| **원본 vs 집계 분리** | 이벤트는 90일, 집계 데이터는 영구 보관 |
| **클라이언트 버퍼링** | 이벤트는 배치 전송 (10~50개씩) |
| **유실 방지** | 로컬 저장 후 전송, 시퀀스 번호로 누락 감지 |

### 1.3 예상 데이터 볼륨

| 항목 | 수치 |
|------|------|
| 키오스크 수 | ~1,000대 |
| 일 평균 세션 | 50회/대 (총 50,000 세션/일) |
| 세션당 이벤트 | ~30개 |
| 일일 이벤트 | ~1,500,000건 |

---

## 2. 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     PhotoSignature 데이터 수집 아키텍처                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐                                                        │
│  │   Kiosk     │                                                        │
│  │  (Client)   │                                                        │
│  │             │                                                        │
│  │ ┌─────────┐ │     Batch (10~50 events)                              │
│  │ │ Event   │─┼──────────────────────────┐                            │
│  │ │ Buffer  │ │                          │                            │
│  │ └─────────┘ │                          ▼                            │
│  │ ┌─────────┐ │              ┌─────────────────────┐                  │
│  │ │ Local   │ │              │   API Gateway       │                  │
│  │ │ Storage │ │              │   (x-api-key 인증)   │                  │
│  │ └─────────┘ │              └──────────┬──────────┘                  │
│  └─────────────┘                         │                              │
│        ×1000                             ▼                              │
│                               ┌─────────────────────┐                  │
│                               │   API Server        │                  │
│                               │   (Cloud Run)       │                  │
│                               └──────────┬──────────┘                  │
│                                          │                              │
│                    ┌─────────────────────┼─────────────────────┐       │
│                    ▼                     ▼                     ▼       │
│           ┌──────────────┐     ┌──────────────┐     ┌──────────────┐  │
│           │   MongoDB    │     │   Firebase   │     │   Firebase   │  │
│           │   Atlas      │     │   RTDB       │     │   Firestore  │  │
│           │              │     │              │     │              │  │
│           │ • sessions   │     │ • 실시간상태 │     │ • 디자인자산 │  │
│           │ • sales      │     │ • 용지잔량   │     │ • 프레임     │  │
│           │ • events     │     │ • 온라인여부 │     │ • 배경       │  │
│           │ • performance│     └──────────────┘     └──────────────┘  │
│           │ • errors     │                                             │
│           └──────────────┘                                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 컬렉션 구조

### 3.1 컬렉션 요약

| 컬렉션 | 용도 | 생성 주체 | TTL |
|--------|------|----------|-----|
| **sessions** | 세션 추적, 퍼널 분석 | 클라이언트 | 1년 |
| **sales** | 정산, 회계 | 클라이언트 | 영구 |
| **events** | UI 이벤트 | 클라이언트 | 90일 |
| **performance** | 성능 측정 | 클라이언트 | 90일 |
| **errors** | 에러/크래시 | 클라이언트 | 1년 |
| **dailySummary** | 일별 집계 | 서버 배치 | 영구 |

### 3.2 sessions - 세션 정보

> **역할**: 사용자 1회 이용 흐름의 기본 단위. 모든 데이터의 연결 키.

```typescript
interface Session {
  // 식별자
  sessionId: string;           // UUID v4 (클라이언트 생성)
  deviceId: string;            // 기기 ID (KIOSK_XXX)
  storeId: string;             // 매장 ID
  groupId: string;             // 그룹 ID
  countryCode: string;         // 국가 코드 (KOR, JPN, VNM, USA)
  appVersion: string;          // 앱 버전 (2.5.1)

  // 시간
  startedAt: Date;             // 세션 시작 시간
  endedAt: Date | null;        // 세션 종료 시간
  durationMs: number | null;   // 총 소요 시간 (ms)

  // 상태
  status: SessionStatus;

  // 퍼널 진행도
  funnel: FunnelProgress;

  // 이탈 컨텍스트 (이탈 시에만)
  exitContext?: ExitContext;

  // 최종 선택값
  selections: Selections;

  // 결제 요약 (결제 완료 시에만)
  payment?: PaymentSummary;

  // 행동 요약
  behaviorSummary: BehaviorSummary;

  // 화면별 체류 시간
  screenDurations: Record<string, number>;

  // A/B 테스트 (해당 시)
  experiments?: Record<string, string>;

  // 메타데이터
  metadata: {
    osVersion: string;
    screenResolution: string;
  };
}

// 세션 상태
type SessionStatus =
  | 'started'         // 세션 시작됨
  | 'in_progress'     // 진행 중
  | 'completed'       // 정상 완료 (결제+출력)
  | 'abandoned'       // 사용자 이탈 (뒤로가기, 취소)
  | 'timeout'         // 무응답 타임아웃
  | 'payment_failed'  // 결제 실패
  | 'error';          // 시스템 에러

// 퍼널 진행도
interface FunnelProgress {
  stages: {
    attract:   StageInfo;  // 대기 → 첫 터치
    engage:    StageInfo;  // 시작 → 프레임 선택
    customize: StageInfo;  // 배경/캐릭터 선택
    capture:   StageInfo;  // 촬영
    edit:      StageInfo;  // 편집
    checkout:  StageInfo;  // 가격 확인
    payment:   StageInfo;  // 결제
    fulfill:   StageInfo;  // 인쇄/완료
  };
  lastCompletedStage: string;
  exitStage: string | null;
  overallProgress: number;  // 0.0 ~ 1.0
}

interface StageInfo {
  reached: boolean;
  enteredAt?: Date;
  exitedAt?: Date;
  durationMs?: number;
}

// 이탈 컨텍스트
interface ExitContext {
  reason: 'timeout' | 'back_pressed' | 'idle' | 'cancelled' | 'error';
  idleSeconds: number;           // 마지막 터치 후 경과 시간
  backPressCount: number;        // 뒤로가기 누른 횟수
  selectionChanges: number;      // 해당 화면에서 선택 변경 횟수
  lastInteraction: string;       // 마지막 인터랙션 타입
  lastTarget: string;            // 마지막 터치 대상
}

// 선택값
interface Selections {
  frameType: string;       // '3CUT' | '4CUT' | '6CUT' | '8CUT'
  cutCount: number;
  background: string;      // 배경 ID
  character: string | null; // 캐릭터 ID (없으면 null)
  filter: string;          // 필터 ID
  qrEnabled: boolean;
}

// 결제 요약
interface PaymentSummary {
  completed: boolean;
  method: 'CASH' | 'CARD';
  amount: number;
  currency: string;
}

// 행동 요약
interface BehaviorSummary {
  totalTaps: number;
  totalScrolls: number;
  backPressCount: number;
  retakeCount: number;              // 재촬영 횟수
  selectionChanges: {
    frame: number;
    background: number;
    character: number;
    filter: number;
  };
  longestIdleMs: number;            // 최장 무응답 시간
}
```

### 3.3 events - UI 이벤트

> **역할**: 모든 사용자 인터랙션 기록. UX 분석, 히트맵, 세션 리플레이용.

```typescript
interface Event {
  // 식별자
  sessionId: string;
  deviceId: string;
  timestamp: Date;
  sequenceNo: number;          // 세션 내 순서 (유실 감지용)

  // 이벤트 분류
  category: EventCategory;
  eventType: EventType;

  // 화면 정보
  screen: string;

  // 이벤트 데이터
  data: EventData;
}

type EventCategory =
  | 'interaction'    // 터치, 제스처
  | 'navigation'     // 화면 전환
  | 'selection'      // 옵션 선택
  | 'system';        // 시스템 이벤트

type EventType =
  // Interaction
  | 'tap'            // 일반 탭
  | 'long_press'     // 길게 누르기
  | 'double_tap'     // 더블탭
  | 'drag'           // 드래그
  | 'swipe'          // 스와이프
  | 'pinch'          // 핀치 (확대/축소)
  | 'scroll'         // 스크롤

  // Navigation
  | 'screen_enter'   // 화면 진입
  | 'screen_exit'    // 화면 이탈
  | 'back'           // 뒤로가기
  | 'cancel'         // 취소

  // Selection
  | 'select'         // 옵션 선택
  | 'deselect'       // 선택 해제
  | 'preview'        // 미리보기

  // System
  | 'idle_start'     // 무응답 시작 (30초 경과)
  | 'idle_end'       // 무응답 종료
  | 'timeout_warning' // 타임아웃 경고
  | 'retry';         // 재시도

interface EventData {
  // 공통
  target?: string;              // 버튼/요소 ID

  // 터치 위치
  position?: { x: number; y: number };

  // 선택 관련
  value?: string;               // 선택한 값
  previousValue?: string;       // 이전 값 (변경 시)

  // 히트맵 분석용
  hitResult?: 'success' | 'miss' | 'outside';
  nearestTarget?: string;       // 가장 가까운 타겟 (miss 시)
  distanceToTarget?: number;    // 타겟까지 거리 (px)

  // 제스처용 (drag, swipe, pinch)
  startPosition?: { x: number; y: number };
  endPosition?: { x: number; y: number };
  direction?: 'up' | 'down' | 'left' | 'right';
  velocity?: number;            // px/s
  pinchScale?: number;          // 확대 비율

  // 스크롤
  scrollDepth?: number;         // 0.0 ~ 1.0

  // 시간
  duration?: number;            // 제스처 지속 시간 (ms)
}
```

### 3.4 performance - 성능 측정

> **역할**: 핵심 작업의 소요 시간 측정. 병목 구간 식별, 릴리즈 비교.

```typescript
interface PerformanceMetric {
  // 식별자
  sessionId: string;
  deviceId: string;
  timestamp: Date;
  appVersion: string;          // 필수! 버전별 비교용

  // 측정 대상
  metricType: MetricType;

  // 측정값
  startedAt: Date;
  endedAt: Date;
  durationMs: number;

  // 결과
  success: boolean;
  errorCode?: string;

  // 세부 단계 (선택)
  breakdown?: Record<string, number>;

  // 환경 컨텍스트
  context: PerformanceContext;

  // 추가 정보
  metadata?: Record<string, any>;
}

type MetricType =
  | 'app_start'      // 앱 실행 → 메인 화면
  | 'capture'        // 셔터 → 이미지 저장
  | 'render'         // 필터/합성 적용
  | 'print'          // 인쇄 시작 → 완료
  | 'payment';       // 결제 요청 → 승인

interface PerformanceContext {
  hourOfDay: number;           // 0-23
  concurrentSessions: number;  // 동시 세션 수
  memoryUsagePercent: number;
  cpuUsagePercent: number;
  deviceTemperature?: number;  // 섭씨
}

// 예시: print breakdown
// {
//   data_prepare_ms: 200,
//   spooling_ms: 500,
//   actual_print_ms: 24000,
//   cooling_ms: 300
// }
```

### 3.5 errors - 에러 및 크래시

> **역할**: 에러/크래시 기록. 재현 정보, 비즈니스 영향 포함.

```typescript
interface ErrorLog {
  // 식별자
  errorId: string;             // UUID
  sessionId: string;
  deviceId: string;
  timestamp: Date;
  appVersion: string;          // 필수!
  buildNumber: number;

  // 에러 분류
  severity: 'warning' | 'error' | 'crash';
  errorType: 'hardware' | 'software' | 'network' | 'user_action';
  errorCode: string;
  errorFingerprint?: string;   // 동일 에러 그룹핑용 해시

  // 에러 상세
  message: string;
  stackTrace?: string;

  // 발생 컨텍스트
  context: {
    screen: string;
    lastAction: string;
    selections: Selections;
  };

  // 디바이스 상태
  deviceState: {
    memoryUsageMb: number;
    cpuUsagePercent: number;
    diskFreeGb: number;
    printerStatus: string;
    paperRemaining: number;
  };

  // 브레드크럼 (크래시 재현용, 최근 50개)
  recentEvents?: Array<{
    timestamp: Date;
    eventType: string;
    screen: string;
    target?: string;
  }>;

  // 비즈니스 영향
  impact: {
    sessionInterrupted: boolean;
    saleLost: boolean;
    estimatedLossAmount?: number;
    userRetried: boolean;
    recoveredAutomatically: boolean;
  };
}
```

### 3.6 sales - 매출 (기존 확장)

> **역할**: 정산/회계용 거래 기록. Decimal128 정밀도.

```typescript
interface Sale {
  // 기존 필드 유지 + 아래 추가

  sessionId: string;           // sessions 연결

  // 금액 구조 개선
  amounts: {
    gross: Decimal128;         // 할인 전 원가
    discount: Decimal128;      // 총 할인
    tax: Decimal128;           // 세금
    net: Decimal128;           // 최종 결제액
    margin: Decimal128;        // 본사 수익
    currency: string;
  };

  // 정산 상태 (신규)
  settlement: {
    status: 'PENDING' | 'SETTLED' | 'DISPUTED';
    scheduledDate: Date;
    processedAt?: Date;
    batchId?: string;
  };

  // 시간 차원 (집계 최적화)
  timeDimension: {
    year: number;
    month: number;
    week: number;
    dayOfWeek: number;
    hour: number;
    quarter: number;
  };
}
```

---

## 4. 클라이언트 구현 가이드

### 4.1 세션 관리

```typescript
class SessionManager {
  private sessionId: string;
  private startedAt: Date;
  private eventSequence: number = 0;

  // 세션 시작
  startSession(): void {
    this.sessionId = uuidv4();
    this.startedAt = new Date();
    this.eventSequence = 0;

    // 세션 생성 API 호출
    api.createSession({
      sessionId: this.sessionId,
      deviceId: CONFIG.DEVICE_ID,
      storeId: CONFIG.STORE_ID,
      groupId: CONFIG.GROUP_ID,
      countryCode: CONFIG.COUNTRY_CODE,
      appVersion: CONFIG.APP_VERSION,
      startedAt: this.startedAt,
      status: 'started',
      metadata: {
        osVersion: getOSVersion(),
        screenResolution: getScreenResolution()
      }
    });
  }

  // 세션 종료
  endSession(status: SessionStatus, exitContext?: ExitContext): void {
    api.updateSession(this.sessionId, {
      status,
      endedAt: new Date(),
      durationMs: Date.now() - this.startedAt.getTime(),
      exitContext,
      funnel: this.funnelTracker.getProgress(),
      behaviorSummary: this.getBehaviorSummary(),
      screenDurations: this.screenTracker.getDurations()
    });

    // 남은 이벤트 플러시
    this.eventBuffer.flush();
  }

  // 이벤트 시퀀스 번호 발급
  getNextSequence(): number {
    return ++this.eventSequence;
  }
}
```

### 4.2 이벤트 버퍼링

```typescript
class EventBuffer {
  private buffer: Event[] = [];
  private readonly MAX_BUFFER_SIZE = 50;
  private readonly FLUSH_INTERVAL_MS = 5000;
  private localStore: LocalStore;

  constructor() {
    // 주기적 플러시
    setInterval(() => this.flush(), this.FLUSH_INTERVAL_MS);

    // 앱 종료 시 로컬 저장
    window.addEventListener('beforeunload', () => this.saveToLocal());

    // 앱 시작 시 미전송 데이터 재전송
    this.retryPending();
  }

  // 이벤트 추가
  push(event: Omit<Event, 'sequenceNo'>): void {
    const fullEvent = {
      ...event,
      sequenceNo: sessionManager.getNextSequence()
    };

    this.buffer.push(fullEvent);

    if (this.buffer.length >= this.MAX_BUFFER_SIZE) {
      this.flush();
    }
  }

  // 서버 전송
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const events = [...this.buffer];
    this.buffer = [];

    try {
      await api.batchInsertEvents(events);
    } catch (error) {
      // 실패 시 로컬 저장
      this.localStore.save('pending_events', events);
    }
  }

  // 미전송 데이터 재전송
  async retryPending(): Promise<void> {
    const pending = this.localStore.get('pending_events');
    if (pending && pending.length > 0) {
      try {
        await api.batchInsertEvents(pending);
        this.localStore.remove('pending_events');
      } catch (error) {
        console.error('Failed to retry pending events');
      }
    }
  }
}
```

### 4.3 퍼널 추적

```typescript
class FunnelTracker {
  private stages: Record<string, StageInfo> = {};
  private currentStage: string | null = null;

  // 퍼널 단계 정의
  private readonly FUNNEL_ORDER = [
    'attract',    // 대기 → 첫 터치
    'engage',     // 시작 → 프레임 선택
    'customize',  // 배경/캐릭터 선택
    'capture',    // 촬영
    'edit',       // 편집
    'checkout',   // 가격 확인
    'payment',    // 결제
    'fulfill'     // 인쇄/완료
  ];

  // 화면 → 퍼널 단계 매핑
  private readonly SCREEN_TO_STAGE: Record<string, string> = {
    'idle_screen': 'attract',
    'start_screen': 'engage',
    'frame_select': 'engage',
    'bg_select': 'customize',
    'character_select': 'customize',
    'shooting': 'capture',
    'editing': 'edit',
    'price_confirm': 'checkout',
    'payment': 'payment',
    'printing': 'fulfill',
    'complete': 'fulfill'
  };

  // 화면 진입 시 호출
  enterScreen(screen: string): void {
    const stage = this.SCREEN_TO_STAGE[screen];
    if (!stage) return;

    // 이전 단계 종료
    if (this.currentStage && this.currentStage !== stage) {
      this.stages[this.currentStage].exitedAt = new Date();
      this.stages[this.currentStage].durationMs =
        Date.now() - this.stages[this.currentStage].enteredAt.getTime();
    }

    // 새 단계 시작
    if (!this.stages[stage]) {
      this.stages[stage] = {
        reached: true,
        enteredAt: new Date()
      };
    }

    this.currentStage = stage;
  }

  // 진행도 반환
  getProgress(): FunnelProgress {
    const reachedCount = Object.values(this.stages).filter(s => s.reached).length;

    return {
      stages: this.stages,
      lastCompletedStage: this.getLastCompleted(),
      exitStage: this.currentStage,
      overallProgress: reachedCount / this.FUNNEL_ORDER.length
    };
  }
}
```

### 4.4 성능 측정

```typescript
class PerformanceTracker {
  // 측정 시작
  startMeasure(metricType: MetricType): PerformanceMeasure {
    return new PerformanceMeasure(metricType);
  }
}

class PerformanceMeasure {
  private startTime: Date;
  private breakdown: Record<string, number> = {};
  private stepStart: number | null = null;
  private currentStep: string | null = null;

  constructor(private metricType: MetricType) {
    this.startTime = new Date();
  }

  // 세부 단계 시작
  startStep(stepName: string): void {
    if (this.currentStep) {
      this.endStep();
    }
    this.currentStep = stepName;
    this.stepStart = Date.now();
  }

  // 세부 단계 종료
  endStep(): void {
    if (this.currentStep && this.stepStart) {
      this.breakdown[`${this.currentStep}_ms`] = Date.now() - this.stepStart;
    }
    this.currentStep = null;
    this.stepStart = null;
  }

  // 측정 완료
  end(success: boolean, errorCode?: string): void {
    if (this.currentStep) {
      this.endStep();
    }

    const endTime = new Date();

    api.recordPerformance({
      sessionId: sessionManager.getSessionId(),
      deviceId: CONFIG.DEVICE_ID,
      timestamp: endTime,
      appVersion: CONFIG.APP_VERSION,
      metricType: this.metricType,
      startedAt: this.startTime,
      endedAt: endTime,
      durationMs: endTime.getTime() - this.startTime.getTime(),
      success,
      errorCode,
      breakdown: Object.keys(this.breakdown).length > 0 ? this.breakdown : undefined,
      context: {
        hourOfDay: new Date().getHours(),
        concurrentSessions: 0,
        memoryUsagePercent: getMemoryUsage(),
        cpuUsagePercent: getCpuUsage()
      }
    });
  }
}

// 사용 예시
async function capturePhoto() {
  const measure = performanceTracker.startMeasure('capture');

  try {
    measure.startStep('shutter');
    await camera.capture();

    measure.startStep('transfer');
    const imageData = await camera.getImage();

    measure.startStep('save');
    await storage.save(imageData);

    measure.end(true);
  } catch (error) {
    measure.end(false, error.code);
    throw error;
  }
}
```

### 4.5 에러 수집

```typescript
class ErrorTracker {
  private recentEvents: Array<{
    timestamp: Date;
    eventType: string;
    screen: string;
    target?: string;
  }> = [];

  private readonly MAX_BREADCRUMBS = 50;

  // 브레드크럼 기록 (이벤트 발생 시마다 호출)
  addBreadcrumb(event: Event): void {
    this.recentEvents.push({
      timestamp: event.timestamp,
      eventType: event.eventType,
      screen: event.screen,
      target: event.data?.target
    });

    if (this.recentEvents.length > this.MAX_BREADCRUMBS) {
      this.recentEvents.shift();
    }
  }

  // 에러 리포트
  reportError(
    severity: 'warning' | 'error' | 'crash',
    error: Error,
    additionalContext?: Record<string, any>
  ): void {
    api.reportError({
      errorId: uuidv4(),
      sessionId: sessionManager.getSessionId(),
      deviceId: CONFIG.DEVICE_ID,
      timestamp: new Date(),
      appVersion: CONFIG.APP_VERSION,
      buildNumber: CONFIG.BUILD_NUMBER,

      severity,
      errorType: this.classifyError(error),
      errorCode: error.code || 'UNKNOWN',

      message: error.message,
      stackTrace: error.stack,

      context: {
        screen: screenManager.getCurrentScreen(),
        lastAction: this.recentEvents[this.recentEvents.length - 1]?.eventType,
        selections: selectionManager.getSelections(),
        ...additionalContext
      },

      deviceState: {
        memoryUsageMb: getMemoryUsageMb(),
        cpuUsagePercent: getCpuUsage(),
        diskFreeGb: getDiskFreeGb(),
        printerStatus: printerManager.getStatus(),
        paperRemaining: printerManager.getPaperCount()
      },

      recentEvents: severity === 'crash' ? [...this.recentEvents] : undefined,

      impact: {
        sessionInterrupted: severity !== 'warning',
        saleLost: severity === 'crash' || severity === 'error',
        userRetried: false,
        recoveredAutomatically: false
      }
    });
  }

  private classifyError(error: Error): string {
    if (error.message.includes('printer') || error.message.includes('camera')) {
      return 'hardware';
    }
    if (error.message.includes('network') || error.message.includes('timeout')) {
      return 'network';
    }
    return 'software';
  }
}
```

---

## 5. API 엔드포인트

### 5.1 세션 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/v1/sessions` | 세션 생성 |
| PATCH | `/api/v1/sessions/:sessionId` | 세션 업데이트 |
| GET | `/api/v1/sessions/:sessionId` | 세션 조회 |

```typescript
// POST /api/v1/sessions
interface CreateSessionRequest {
  sessionId: string;
  deviceId: string;
  storeId: string;
  groupId: string;
  countryCode: string;
  appVersion: string;
  startedAt: string;  // ISO 8601
  status: 'started';
  metadata: {
    osVersion: string;
    screenResolution: string;
  };
}

// PATCH /api/v1/sessions/:sessionId
interface UpdateSessionRequest {
  status?: SessionStatus;
  endedAt?: string;
  durationMs?: number;
  funnel?: FunnelProgress;
  exitContext?: ExitContext;
  selections?: Selections;
  payment?: PaymentSummary;
  behaviorSummary?: BehaviorSummary;
  screenDurations?: Record<string, number>;
}
```

### 5.2 이벤트 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/v1/events/batch` | 이벤트 배치 전송 |

```typescript
// POST /api/v1/events/batch
interface BatchEventsRequest {
  events: Event[];  // 최대 100개
}

interface BatchEventsResponse {
  inserted: number;
  failed: number;
  errors?: Array<{
    index: number;
    error: string;
  }>;
}
```

### 5.3 성능 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/v1/performance` | 성능 측정 기록 |
| POST | `/api/v1/performance/batch` | 배치 전송 |

### 5.4 에러 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/v1/errors` | 에러 리포트 |

---

## 6. 데이터 흐름

### 6.1 세션 라이프사이클

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          세션 데이터 흐름                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [1. 세션 시작]                                                          │
│  ┌─────────────┐      POST /sessions      ┌─────────────┐              │
│  │ 첫 터치     │─────────────────────────▶│  sessions   │              │
│  └─────────────┘                          │  (created)  │              │
│                                           └─────────────┘              │
│                                                                         │
│  [2. 진행 중]                                                            │
│  ┌─────────────┐      POST /events/batch  ┌─────────────┐              │
│  │ UI 이벤트   │─────────────────────────▶│   events    │              │
│  │ (버퍼링)    │      (10~50개씩)         │ (Time-Series)│              │
│  └─────────────┘                          └─────────────┘              │
│                                                                         │
│  ┌─────────────┐      POST /performance   ┌─────────────┐              │
│  │ 촬영/출력   │─────────────────────────▶│ performance │              │
│  └─────────────┘                          └─────────────┘              │
│                                                                         │
│  [3. 결제 완료]                                                          │
│  ┌─────────────┐      POST /sales         ┌─────────────┐              │
│  │ 결제 성공   │─────────────────────────▶│   sales     │              │
│  └─────────────┘                          │ (sessionId) │              │
│                                           └─────────────┘              │
│                                                                         │
│  [4. 세션 종료]                                                          │
│  ┌─────────────┐      PATCH /sessions/:id ┌─────────────┐              │
│  │ 완료/이탈   │─────────────────────────▶│  sessions   │              │
│  └─────────────┘      + 남은 이벤트 flush │  (updated)  │              │
│                                           └─────────────┘              │
│                                                                         │
│  [5. 에러 발생 시]                                                       │
│  ┌─────────────┐      POST /errors        ┌─────────────┐              │
│  │ 에러/크래시 │─────────────────────────▶│   errors    │              │
│  └─────────────┘      (즉시 전송)         └─────────────┘              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 이벤트 수집 타이밍

| 이벤트 | 수집 시점 | 전송 방식 |
|--------|----------|----------|
| 화면 진입/이탈 | 화면 전환 시 | 버퍼링 |
| 터치/제스처 | 발생 즉시 | 버퍼링 |
| 선택 변경 | 변경 시 | 버퍼링 |
| 성능 측정 | 작업 완료 시 | 즉시 |
| 에러/크래시 | 발생 즉시 | **즉시** |
| 세션 종료 | 완료/이탈 시 | 즉시 + 버퍼 플러시 |

---

## 7. 구현 우선순위

### Phase 1: 핵심 (1-2주)

| 우선순위 | 항목 | 담당 |
|---------|------|------|
| **P0** | sessions 컬렉션 생성 | Backend |
| **P0** | SessionManager 구현 | Frontend |
| **P0** | 세션 생성/종료 API | Backend |
| **P0** | sales.sessionId 연결 | Both |

### Phase 2: 이벤트 수집 (2-3주)

| 우선순위 | 항목 | 담당 |
|---------|------|------|
| **P1** | events 컬렉션 (Time-Series) | Backend |
| **P1** | EventBuffer 구현 | Frontend |
| **P1** | FunnelTracker 구현 | Frontend |
| **P1** | screen_enter/exit 수집 | Frontend |

### Phase 3: 성능/에러 (2주)

| 우선순위 | 항목 | 담당 |
|---------|------|------|
| **P1** | performance 컬렉션 | Backend |
| **P1** | PerformanceTracker 구현 | Frontend |
| **P1** | errors 컬렉션 | Backend |
| **P1** | ErrorTracker 구현 | Frontend |

### Phase 4: 고도화 (선택)

| 우선순위 | 항목 | 담당 |
|---------|------|------|
| **P2** | 히트맵 데이터 (hitResult) | Frontend |
| **P2** | dailySummary 배치 | Backend |
| **P3** | A/B 테스트 필드 | Both |

---

## 부록: 화면 ID 매핑

| 화면 ID | 설명 | 퍼널 단계 |
|---------|------|----------|
| `idle_screen` | 대기 화면 | attract |
| `start_screen` | 시작 화면 | engage |
| `frame_select` | 프레임 선택 | engage |
| `bg_select` | 배경 선택 | customize |
| `character_select` | 캐릭터 선택 | customize |
| `shooting` | 촬영 | capture |
| `editing` | 편집/필터 | edit |
| `price_confirm` | 가격 확인 | checkout |
| `payment` | 결제 | payment |
| `printing` | 인쇄 중 | fulfill |
| `complete` | 완료 | fulfill |

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2025-01-19 | 1.0 | 초안 작성 |
