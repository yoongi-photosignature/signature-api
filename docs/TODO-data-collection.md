# PhotoSignature 데이터 수집 구현 TODO

> **관련 문서**: [photosignature-data-collection-design.md](./photosignature-data-collection-design.md)
> **작성일**: 2025-01-19
> **최종 업데이트**: 2025-01-19

---

## Phase 1: 핵심 인프라 (1-2주)

### Backend

- [x] **sessions 컬렉션 생성** ✅ 완료 (2025-01-19)
  - [x] 스키마 정의 (`src/modules/sessions/sessions.schema.ts`)
  - [x] Repository 구현 (`src/modules/sessions/sessions.repository.ts`)
  - [x] Service 구현 (`src/modules/sessions/sessions.service.ts`)
  - [x] 인덱스 생성 스크립트 (`scripts/create-indexes.js`)
    - `{ sessionId: 1 }` (unique)
    - `{ deviceId: 1, startedAt: -1 }`
    - `{ storeId: 1, startedAt: -1 }`
    - `{ groupId: 1, startedAt: -1 }`
    - `{ startedAt: -1, status: 1 }`
    - `{ status: 1, funnel.exitStage: 1 }` (sparse)
    - `{ countryCode: 1, startedAt: -1 }`
    - TTL 인덱스 (1년)

- [x] **세션 API 구현** ✅ 완료 (2025-01-19)
  - [x] `POST /api/sessions` - 세션 생성
  - [x] `PATCH /api/sessions/:sessionId` - 세션 업데이트
  - [x] `GET /api/sessions/:sessionId` - 세션 조회
  - [x] `GET /api/sessions` - 세션 목록 조회 (필터링/페이지네이션)

- [x] **sales 컬렉션 확장** ✅ 완료 (2025-01-19)
  - [x] `sessionId` 필드 추가
  - [x] `amounts` 구조 개선 (gross/discount/tax/net/margin)
  - [x] `settlement` 필드 추가 (정산 상태)
  - [x] `timeDimension` 필드 추가 (자동 생성)
  - [x] 관련 인덱스 추가 (`scripts/create-indexes.js`)

### Frontend (키오스크)

- [ ] **SessionManager 구현**
  - [ ] UUID 생성 (sessionId)
  - [ ] 세션 시작 시 API 호출
  - [ ] 세션 종료 시 API 호출
  - [ ] 이벤트 시퀀스 번호 관리

- [ ] **세션 상태 관리**
  - [ ] status 상태 전환 로직
  - [ ] 타임아웃 감지
  - [ ] 이탈 감지 (뒤로가기, 취소)

---

## Phase 2: 이벤트 수집 (2-3주)

### Backend

- [x] **events 컬렉션 생성** ✅ 완료 (2025-01-19)
  - [x] 스키마 정의 (`src/modules/events/events.schema.ts`)
  - [x] Repository 구현 (`src/modules/events/events.repository.ts`)
  - [x] Service 구현 (`src/modules/events/events.service.ts`)
  - [x] Routes 구현 (`src/modules/events/events.routes.ts`)
  - [x] 인덱스 생성 스크립트 추가
    - `{ sessionId: 1, sequenceNo: 1 }` (unique)
    - `{ deviceId: 1, timestamp: -1 }`
    - `{ eventType: 1, timestamp: -1 }`

- [x] **이벤트 배치 API** ✅ 완료 (2025-01-19)
  - [x] `POST /api/events/batch` - 배치 삽입
  - [x] `GET /api/events` - 이벤트 목록 조회 (필터링/페이지네이션)
  - [x] `GET /api/events/session/:sessionId` - 세션별 이벤트 조회
  - [x] 벌크 삽입 최적화 (`ordered: false`)
  - [x] 중복 제거 (sessionId + sequenceNo)

### Frontend (키오스크)

- [ ] **EventBuffer 구현**
  - [ ] 메모리 버퍼 (최대 50개)
  - [ ] 5초 주기 자동 플러시
  - [ ] 50개 도달 시 즉시 플러시
  - [ ] 로컬 저장 (네트워크 실패 시)
  - [ ] 앱 시작 시 미전송 데이터 재전송

- [ ] **FunnelTracker 구현**
  - [ ] 퍼널 단계 정의 (8단계)
  - [ ] 화면 → 퍼널 매핑
  - [ ] 단계별 진입/이탈 시간 기록
  - [ ] 진행도 계산

- [ ] **이벤트 수집 구현**
  - [ ] `screen_enter` / `screen_exit`
  - [ ] `tap` / `long_press`
  - [ ] `select` / `deselect`
  - [ ] `back` / `cancel`
  - [ ] `scroll` (scrollDepth 포함)

- [ ] **행동 요약 집계**
  - [ ] totalTaps, totalScrolls 카운트
  - [ ] selectionChanges 카운트
  - [ ] screenDurations 계산

---

## Phase 3: 성능/에러 모니터링 (2주)

### Backend

- [x] **performance 컬렉션 생성** ✅ 완료 (2025-01-19)
  - [x] 스키마 정의 (`src/modules/performance/performance.schema.ts`)
  - [x] Repository 구현 (`src/modules/performance/performance.repository.ts`)
  - [x] Service 구현 (`src/modules/performance/performance.service.ts`)
  - [x] Routes 구현 (`src/modules/performance/performance.routes.ts`)
  - [x] 인덱스 생성 스크립트 추가
    - `{ deviceId: 1, metricType: 1, timestamp: -1 }`
    - `{ sessionId: 1, metricType: 1 }` (sparse)
    - `{ success: 1, metricType: 1, timestamp: -1 }`

- [x] **성능 API** ✅ 완료 (2025-01-19)
  - [x] `POST /api/performance` - 단건 기록
  - [x] `POST /api/performance/batch` - 배치 기록
  - [x] `GET /api/performance` - 성능 지표 목록 조회

- [x] **errors 컬렉션 생성** ✅ 완료 (2025-01-19)
  - [x] 스키마 정의 (`src/modules/errors/errors.schema.ts`)
  - [x] Repository 구현 (`src/modules/errors/errors.repository.ts`)
  - [x] Service 구현 (`src/modules/errors/errors.service.ts`)
  - [x] Routes 구현 (`src/modules/errors/errors.routes.ts`)
  - [x] 인덱스 생성 스크립트 추가
    - `{ deviceId: 1, timestamp: -1 }`
    - `{ severity: 1, timestamp: -1 }`
    - `{ category: 1, timestamp: -1 }`
    - `{ resolved: 1, severity: 1, timestamp: -1 }`
    - `{ sessionId: 1 }` (sparse)

- [x] **에러 API** ✅ 완료 (2025-01-19)
  - [x] `POST /api/errors` - 에러 리포트
  - [x] `GET /api/errors` - 에러 목록 조회
  - [x] `GET /api/errors/:id` - 에러 상세 조회
  - [x] `PATCH /api/errors/:id/resolve` - 에러 해결 표시

### Frontend (키오스크)

- [ ] **PerformanceTracker 구현**
  - [ ] 측정 시작/종료 인터페이스
  - [ ] 세부 단계(breakdown) 측정
  - [ ] 컨텍스트 수집 (메모리, CPU)

- [ ] **성능 측정 적용**
  - [ ] `app_start` - 앱 시작 시간
  - [ ] `capture` - 촬영 시간 (shutter → save)
  - [ ] `render` - 필터/합성 시간
  - [ ] `print` - 인쇄 시간
  - [ ] `payment` - 결제 응답 시간

- [ ] **ErrorTracker 구현**
  - [ ] 브레드크럼 기록 (최근 50개)
  - [ ] 에러 분류 (hardware/software/network)
  - [ ] 디바이스 상태 스냅샷
  - [ ] 즉시 전송

- [ ] **전역 에러 핸들러**
  - [ ] try-catch 래퍼
  - [ ] 미처리 예외 캐치
  - [ ] 크래시 리포트

---

## Phase 4: 집계 및 고도화 (선택)

### Backend

- [x] **dailySummary 컬렉션** ✅ 완료 (2025-01-19)
  - [x] 스키마 정의 (`src/modules/daily-summary/daily-summary.schema.ts`)
  - [x] Repository 구현 (`src/modules/daily-summary/daily-summary.repository.ts`)
  - [x] Service 구현 (`src/modules/daily-summary/daily-summary.service.ts`)
  - [x] Routes 구현 (`src/modules/daily-summary/daily-summary.routes.ts`)
  - [x] 인덱스 생성 스크립트 추가
    - `{ date: 1, deviceId: 1 }` (unique)
    - `{ storeId: 1, date: -1 }`
    - `{ groupId: 1, date: -1 }`
    - `{ deviceId: 1, date: -1 }`
    - `{ countryCode: 1, date: -1 }`

- [x] **집계 API 구현** ✅ 완료 (2025-01-19)
  - [x] `GET /api/daily-summary` - 일일 요약 목록 조회
  - [x] `GET /api/daily-summary/:date/:deviceId` - 특정 일일 요약 조회
  - [x] `POST /api/daily-summary/aggregate` - 수동 집계 실행
  - [x] sessions → dailySummary (퍼널, 전환율)
  - [x] sales → dailySummary (매출, 결제수단)
  - [x] performance → dailySummary (P50/P95/P99)
  - [x] errors → dailySummary (에러 카운트)
  - [x] 병렬 처리 최적화 (배치 단위 10개)

- [ ] **집계 배치 스케줄러** (별도 구현 필요)
  - [ ] 일일 배치 집계 스케줄러 (00:05 KST)
  - [ ] Cloud Scheduler 또는 cron job 설정

### Frontend (키오스크)

- [ ] **히트맵 데이터 강화**
  - [ ] `hitResult` (success/miss/outside)
  - [ ] `nearestTarget`, `distanceToTarget`
  - [ ] 제스처 경로 (startPosition, endPosition)

- [ ] **A/B 테스트 지원**
  - [ ] experiments 필드 전송
  - [ ] variant 할당 로직

---

## 인덱스 체크리스트

### sessions ✅ 완료
- [x] `{ sessionId: 1 }` (unique)
- [x] `{ deviceId: 1, startedAt: -1 }`
- [x] `{ storeId: 1, startedAt: -1 }`
- [x] `{ groupId: 1, startedAt: -1 }`
- [x] `{ startedAt: -1, status: 1 }`
- [x] `{ status: 1, funnel.exitStage: 1 }` (sparse)
- [x] `{ countryCode: 1, startedAt: -1 }`
- [x] `{ createdAt: 1 }` (TTL 1년)

### events ✅ 완료
- [x] `{ sessionId: 1, sequenceNo: 1 }` (unique)
- [x] `{ deviceId: 1, timestamp: -1 }`
- [x] `{ eventType: 1, timestamp: -1 }`

### performance ✅ 완료
- [x] `{ deviceId: 1, metricType: 1, timestamp: -1 }`
- [x] `{ sessionId: 1, metricType: 1 }` (sparse)
- [x] `{ success: 1, metricType: 1, timestamp: -1 }`

### errors ✅ 완료
- [x] `{ deviceId: 1, timestamp: -1 }`
- [x] `{ severity: 1, timestamp: -1 }`
- [x] `{ category: 1, timestamp: -1 }`
- [x] `{ resolved: 1, severity: 1, timestamp: -1 }`
- [x] `{ sessionId: 1 }` (sparse)

### sales (확장) ✅ 완료
- [x] `{ sessionId: 1 }` (sparse)
- [x] `{ "settlement.status": 1, "settlement.scheduledDate": 1 }` (sparse)
- [x] `{ "timeDimension.year": 1, "timeDimension.month": 1, "store.id": 1 }`
- [x] `{ "timeDimension.year": 1, "timeDimension.week": 1 }`
- [x] `{ "timeDimension.hour": 1, "device.id": 1 }`

### dailySummary ✅ 완료
- [x] `{ date: 1, deviceId: 1 }` (unique)
- [x] `{ storeId: 1, date: -1 }`
- [x] `{ groupId: 1, date: -1 }`
- [x] `{ deviceId: 1, date: -1 }`
- [x] `{ countryCode: 1, date: -1 }`

---

## 테스트 체크리스트

### Unit Tests
- [ ] SessionManager
- [ ] EventBuffer
- [ ] FunnelTracker
- [ ] PerformanceTracker
- [ ] ErrorTracker

### Integration Tests
- [ ] 세션 생성 → 이벤트 수집 → 세션 종료 흐름
- [ ] 네트워크 실패 시 로컬 저장 → 재전송
- [ ] 에러 발생 시 브레드크럼 포함 리포트

### Load Tests
- [ ] 1,000대 동시 이벤트 전송 시뮬레이션
- [ ] 배치 삽입 성능 (1,500,000건/일)

---

## 마일스톤

| 단계 | 목표 | 상태 |
|------|------|------|
| Phase 1 | 세션 추적 + sales 연결 | ✅ Backend 완료 |
| Phase 2 | 이벤트 수집 + 퍼널 분석 | ✅ Backend 완료 |
| Phase 3 | 성능/에러 모니터링 | ✅ Backend 완료 |
| Phase 4 | 집계 자동화 | ✅ Backend 완료 (스케줄러 제외) |

---

## 구현 완료 파일 목록

### 타입 정의
- `src/types/index.ts` - Session, Event, Performance, Error, DailySummary 타입

### Sessions 모듈
- `src/modules/sessions/sessions.schema.ts`
- `src/modules/sessions/sessions.repository.ts`
- `src/modules/sessions/sessions.service.ts`
- `src/modules/sessions/sessions.routes.ts`

### Events 모듈
- `src/modules/events/events.schema.ts`
- `src/modules/events/events.repository.ts`
- `src/modules/events/events.service.ts`
- `src/modules/events/events.routes.ts`

### Performance 모듈
- `src/modules/performance/performance.schema.ts`
- `src/modules/performance/performance.repository.ts`
- `src/modules/performance/performance.service.ts`
- `src/modules/performance/performance.routes.ts`

### Errors 모듈
- `src/modules/errors/errors.schema.ts`
- `src/modules/errors/errors.repository.ts`
- `src/modules/errors/errors.service.ts`
- `src/modules/errors/errors.routes.ts`

### Daily-Summary 모듈
- `src/modules/daily-summary/daily-summary.schema.ts`
- `src/modules/daily-summary/daily-summary.repository.ts`
- `src/modules/daily-summary/daily-summary.service.ts`
- `src/modules/daily-summary/daily-summary.routes.ts`

### 인덱스 스크립트
- `scripts/create-indexes.js`

### 앱 설정
- `src/app.ts` - 새 모듈 라우트 등록

---

## 참고 자료

- [설계 문서](./photosignature-data-collection-design.md)
- [기존 metrics 설계 1](./photosignature-metrics-design.md)
- [기존 metrics 설계 2](./photosignature-metrics-design_1.md)
- [요구사항 정의](./required_metrics.md)
- [DB 아키텍처](./db-architecture/INDEX.md)
