# PhotoSignature 지표 설계 (MongoDB)

## 목차

1. [개요](#개요)
2. [비즈니스 지표](#비즈니스-지표)
3. [사용자 행동 지표](#사용자-행동-지표)
4. [시스템/성능 지표](#시스템성능-지표)
5. [컬렉션 설계](#컬렉션-설계)
6. [인덱싱 전략](#인덱싱-전략)
7. [집계 쿼리 예시](#집계-쿼리-예시)

---

## 개요

### 목표

- 데이터 기반 의사결정을 위한 핵심 지표 정의
- 사용자 경험 개선을 위한 행동 분석
- 시스템 안정성 및 성능 모니터링
- Crash 재현 및 디버깅 지원

### 설계 원칙

- **이벤트 기반**: 모든 사용자 행동과 시스템 이벤트를 개별 도큐먼트로 기록
- **세션 중심**: 세션 ID로 관련 이벤트를 연결하여 흐름 분석 가능
- **유연한 스키마**: MongoDB의 장점을 활용해 다양한 이벤트 타입 수용
- **시계열 최적화**: Time-Series Collection 활용으로 로그 데이터 효율적 저장

---

## 비즈니스 지표

### 매출 지표

| 지표 | 설명 | 계산 방식 |
|------|------|-----------|
| 일/주/월 매출 | 기간별 총 매출액 | `sum(salesAmount)` by period |
| 기기별 매출 | 기기 성과 비교 | `sum(salesAmount)` by kioskId |
| 매장별 매출 | 매장 그룹 성과 | `sum(salesAmount)` by groupId |
| 평균 객단가 | 건당 평균 결제액 | `avg(salesAmount)` |
| 결제 수단 비율 | 현금 vs 카드 | `count` by paymentMethod |

### 상품 선택 지표

| 지표 | 설명 | 활용 |
|------|------|------|
| 프레임 선택률 | 몇 컷 프레임이 인기 있는지 | 인기 상품 파악, 재고/디자인 우선순위 |
| 배경 선택 분포 | 배경색/이미지 선호도 | 신규 배경 기획 |
| 캐릭터 선택률 | 팝업/캐릭터 콜라보 성과 | 수익 배분, 콜라보 연장 결정 |
| 필터 선택 분포 | 필터 인기도 | UX 개선, 필터 순서 조정 |
| QR 선택률 | 디지털 다운로드 수요 | 기능 개선 우선순위 |

### 프로모션 지표

| 지표 | 설명 | 계산 방식 |
|------|------|-----------|
| 쿠폰 사용률 | 발급 대비 사용 비율 | `used / issued * 100` |
| 쿠폰별 할인 총액 | 프로모션 비용 | `sum(discountAmount)` by couponType |
| 룰렛 할인 평균 | 룰렛 이벤트 효과 | `avg(rouletteDiscount)` |
| 매장별 쿠폰 소진 | 매장별 프로모션 활용도 | `count(used)` by storeId |

---

## 사용자 행동 지표

### 퍼널 지표

| 지표 | 설명 | 목표 |
|------|------|------|
| 전환율 | 시작 → 결제 완료 비율 | > 80% |
| 단계별 이탈률 | 각 화면에서 이탈하는 비율 | 병목 구간 식별 |
| 평균 세션 시간 | 촬영 시작~완료까지 시간 | 적정 시간 유지 |
| 재촬영률 | 재촬영 기능 사용 비율 | UX 개선 지표 |

### 화면별 지표

| 화면 | 측정 항목 |
|------|-----------|
| 시작 화면 | 진입 수, 다음 단계 이동률 |
| 프레임 선택 | 체류 시간, 선택 변경 횟수, 최종 선택 |
| 배경 선택 | 체류 시간, 스크롤/탐색 패턴 |
| 캐릭터 선택 | 체류 시간, 미리보기 횟수 |
| 촬영 | 촬영 횟수, 재촬영 횟수, 소요 시간 |
| 편집 | 필터 변경 횟수, 체류 시간 |
| 결제 | 결제 수단 선택, 완료/취소 |

### 인터랙션 지표

| 지표 | 설명 | 활용 |
|------|------|------|
| 터치 히트맵 | 화면별 터치 위치 분포 | UI 배치 최적화 |
| 제스처 분포 | tap/drag/pinch 비율 | 제스처 UX 개선 |
| 버튼별 클릭률 | 각 버튼 사용 빈도 | 불필요한 버튼 제거 |
| 스크롤 깊이 | 목록 탐색 정도 | 콘텐츠 노출 순서 조정 |

---

## 시스템/성능 지표

### 성능 지표

| 지표 | 설명 | 목표값 |
|------|------|--------|
| 촬영 소요 시간 | 셔터 → 이미지 저장 | < 2s |
| 이미지 처리 시간 | 필터/합성 적용 | < 3s |
| 출력 소요 시간 | 인쇄 시작 → 완료 | < 30s |
| 결제 처리 시간 | 결제 요청 → 승인 | < 5s |
| 앱 시작 시간 | 실행 → 메인 화면 | < 3s |
| P95 Latency | 95% 요청 처리 시간 | 각 작업별 설정 |

### 에러/안정성 지표

| 지표 | 설명 | 목표값 |
|------|------|--------|
| Crash Rate | 세션당 크래시 비율 | < 0.1% |
| Error Rate | 세션당 에러 발생률 | < 1% |
| MTBF | 장애 간 평균 시간 | > 24h |
| 하드웨어 에러율 | 프린터/카메라 오류 | < 0.5% |

### 운영 지표

| 지표 | 설명 | 알림 기준 |
|------|------|-----------|
| 용지 잔량 | 기기별 출력 가능 매수 | < 50매 |
| 기기 가동률 | 정상 운영 시간 비율 | < 95% |
| 일평균 출력량 | 기기별 출력 건수 | 트렌드 모니터링 |

---

## 컬렉션 설계

### sessions

세션 단위 정보. 퍼널 분석의 기본 단위.

```javascript
{
  _id: ObjectId,
  sessionId: "uuid-v4",
  kioskId: "DEVICE001",
  groupId: "GROUP001",
  
  // 시간 정보
  startedAt: ISODate("2024-01-15T10:30:00Z"),
  endedAt: ISODate("2024-01-15T10:35:00Z"),
  durationMs: 300000,
  
  // 전환 정보
  status: "completed", // started | abandoned | completed | error
  exitScreen: null,    // 이탈 시 마지막 화면
  
  // 선택 정보 (최종 선택값)
  selections: {
    frameType: "4cut",
    background: "bg_001",
    character: "char_pikachu",
    filter: "filter_warm",
    qrEnabled: true
  },
  
  // 결제 정보
  payment: {
    method: "card",        // cash | card | coupon
    amount: 5000,
    discount: 0,
    couponCode: null,
    rouletteDiscount: 0,
    cardReceiptNo: "1234567890"
  },
  
  // 메타 정보
  metadata: {
    appVersion: "2.1.0",
    osVersion: "Windows 10",
    screenResolution: "1920x1080"
  }
}
```

### events

모든 사용자 인터랙션 이벤트. Time-Series Collection 권장.

```javascript
{
  _id: ObjectId,
  sessionId: "uuid-v4",
  kioskId: "DEVICE001",
  timestamp: ISODate("2024-01-15T10:31:15.234Z"),
  
  // 이벤트 분류
  category: "interaction",  // interaction | navigation | selection | system
  eventType: "tap",         // tap | drag | pinch | scroll | screen_enter | screen_exit | select | ...
  
  // 화면 정보
  screen: "frame_selection",
  
  // 이벤트 상세
  data: {
    target: "btn_4cut",           // 버튼/요소 ID
    position: { x: 540, y: 320 }, // 터치 좌표
    value: "4cut",                // 선택값 (selection 이벤트 시)
    previousValue: "3cut",        // 이전값 (변경 시)
    scrollDepth: 0.7,             // 스크롤 깊이 (0~1)
    duration: 150                 // 제스처 지속 시간 (ms)
  }
}
```

### performance

성능 측정 데이터. Time-Series Collection 권장.

```javascript
{
  _id: ObjectId,
  sessionId: "uuid-v4",
  kioskId: "DEVICE001",
  timestamp: ISODate("2024-01-15T10:32:00Z"),
  
  // 측정 대상
  metricType: "capture",  // capture | process | print | payment | app_start
  
  // 측정값
  startedAt: ISODate("2024-01-15T10:32:00.000Z"),
  endedAt: ISODate("2024-01-15T10:32:01.523Z"),
  durationMs: 1523,
  
  // 결과
  success: true,
  errorCode: null,
  
  // 추가 정보
  metadata: {
    imageSize: 2048576,      // bytes
    resolution: "1920x1080",
    filterApplied: "warm",
    printCopies: 2
  }
}
```

### errors

에러 및 크래시 로그. Crash 재현을 위한 상세 정보 포함.

```javascript
{
  _id: ObjectId,
  errorId: "uuid-v4",
  sessionId: "uuid-v4",
  kioskId: "DEVICE001",
  timestamp: ISODate("2024-01-15T10:33:45Z"),
  
  // 에러 분류
  severity: "error",       // warning | error | crash
  errorType: "exception",  // exception | timeout | hardware | network
  errorCode: "ERR_PRINT_001",
  
  // 에러 상세
  message: "Printer communication timeout",
  stackTrace: "at PrintService.send() line 234\nat ...",
  
  // 발생 컨텍스트
  context: {
    screen: "printing",
    lastAction: "print_start",
    
    // 에러 시점까지의 선택 정보
    selections: {
      frameType: "4cut",
      background: "bg_001",
      character: "char_pikachu",
      filter: "filter_warm"
    }
  },
  
  // 디바이스 상태
  deviceState: {
    memoryUsageMb: 1024,
    cpuUsagePercent: 45,
    diskFreeGb: 50,
    printerStatus: "offline",
    paperRemaining: 120
  },
  
  // 재현을 위한 이벤트 히스토리 (최근 N개)
  recentEvents: [
    { timestamp: "...", eventType: "tap", screen: "editing", target: "btn_filter" },
    { timestamp: "...", eventType: "select", screen: "editing", value: "warm" },
    { timestamp: "...", eventType: "tap", screen: "editing", target: "btn_next" },
    { timestamp: "...", eventType: "screen_enter", screen: "payment" },
    // ... 최근 20~50개 이벤트
  ]
}
```

### sales

매출 데이터. 기존 TB_HIS003 대체. 빠른 집계를 위한 별도 컬렉션.

```javascript
{
  _id: ObjectId,
  sessionId: "uuid-v4",
  kioskId: "DEVICE001",
  groupId: "GROUP001",
  
  // 날짜 (집계용 필드 분리)
  saleDate: ISODate("2024-01-15T00:00:00Z"),
  saleDateTime: ISODate("2024-01-15T10:35:00Z"),
  year: 2024,
  month: 1,
  week: 3,
  dayOfWeek: 1,  // 0=일, 1=월, ...
  hour: 10,
  
  // 판매 정보
  printCount: 2,
  salesAmount: 5000,
  unitPrice: 2500,
  
  // 결제 정보
  paymentMethod: "card",
  discount: 0,
  couponUsed: false,
  rouletteDiscount: 0,
  
  // 선택 정보
  frameType: "4cut",
  background: "bg_001",
  character: "char_pikachu",
  filter: "filter_warm",
  qrEnabled: true,
  
  // 국가/환율 (해외 매장용)
  nationCode: "KOR",
  exchangeRate: 1.0,
  salesAmountLocal: 5000
}
```

### dailySummary

일별 집계 데이터. 대시보드 성능 최적화용.

```javascript
{
  _id: ObjectId,
  date: ISODate("2024-01-15T00:00:00Z"),
  kioskId: "DEVICE001",
  groupId: "GROUP001",
  
  // 매출 집계
  totalSessions: 150,
  completedSessions: 142,
  conversionRate: 0.947,
  
  totalSalesAmount: 710000,
  avgSalesAmount: 5000,
  
  // 결제 수단 분포
  paymentMethods: {
    cash: { count: 50, amount: 250000 },
    card: { count: 92, amount: 460000 }
  },
  
  // 선택 분포
  frameTypes: {
    "3cut": 30,
    "4cut": 85,
    "6cut": 27
  },
  characters: {
    "char_pikachu": 45,
    "char_hello": 32,
    "none": 65
  },
  
  // 성능 집계
  performance: {
    capture: { avg: 1234, p50: 1100, p95: 2100, p99: 2800 },
    process: { avg: 2500, p50: 2300, p95: 3500, p99: 4200 },
    print: { avg: 25000, p50: 24000, p95: 32000, p99: 38000 }
  },
  
  // 에러 집계
  errors: {
    total: 3,
    byType: {
      "exception": 1,
      "hardware": 2
    }
  },
  
  // 운영 정보
  paperConsumed: 284,
  paperRemaining: 516
}
```

### coupons

쿠폰 관리. 기존 TB_EVE001 대체.

```javascript
{
  _id: ObjectId,
  couponCode: "NEWYEAR2024-001",
  
  // 쿠폰 정보
  campaignId: "NEWYEAR2024",
  campaignName: "2024 신년 이벤트",
  discountAmount: 1000,
  discountType: "fixed",  // fixed | percent
  
  // 발급 정보
  issuedAt: ISODate("2024-01-01T00:00:00Z"),
  issuedDeviceId: "DEVICE001",
  expiresAt: ISODate("2024-01-31T23:59:59Z"),
  
  // 사용 정보
  status: "used",  // issued | used | expired
  usedAt: ISODate("2024-01-15T10:35:00Z"),
  usedDeviceId: "DEVICE002",
  usedSessionId: "uuid-v4"
}
```

---

## 인덱싱 전략

### sessions

```javascript
// 기기별 최근 세션 조회
db.sessions.createIndex({ kioskId: 1, startedAt: -1 })

// 날짜 범위 + 상태 필터
db.sessions.createIndex({ startedAt: -1, status: 1 })

// 그룹별 매출 집계
db.sessions.createIndex({ groupId: 1, startedAt: -1 })

// 전환 분석 (이탈 화면별)
db.sessions.createIndex({ status: 1, exitScreen: 1 })
```

### events

```javascript
// Time-Series Collection 설정 (MongoDB 5.0+)
db.createCollection("events", {
  timeseries: {
    timeField: "timestamp",
    metaField: "sessionId",
    granularity: "seconds"
  },
  expireAfterSeconds: 7776000  // 90일 보관
})

// 세션별 이벤트 조회
db.events.createIndex({ sessionId: 1, timestamp: 1 })

// 화면별 분석
db.events.createIndex({ screen: 1, eventType: 1, timestamp: -1 })
```

### performance

```javascript
// Time-Series Collection
db.createCollection("performance", {
  timeseries: {
    timeField: "timestamp",
    metaField: "kioskId",
    granularity: "seconds"
  },
  expireAfterSeconds: 7776000
})

// 성능 분석용
db.performance.createIndex({ metricType: 1, timestamp: -1 })
db.performance.createIndex({ kioskId: 1, metricType: 1, timestamp: -1 })
```

### errors

```javascript
// 최근 에러 조회
db.errors.createIndex({ timestamp: -1 })

// 기기별 에러 조회
db.errors.createIndex({ kioskId: 1, timestamp: -1 })

// 에러 타입별 분석
db.errors.createIndex({ errorType: 1, errorCode: 1, timestamp: -1 })

// 심각도별 조회
db.errors.createIndex({ severity: 1, timestamp: -1 })
```

### sales

```javascript
// 날짜 범위 매출 조회
db.sales.createIndex({ saleDate: -1 })

// 기기별 매출
db.sales.createIndex({ kioskId: 1, saleDate: -1 })

// 그룹별 매출
db.sales.createIndex({ groupId: 1, saleDate: -1 })

// 상품별 분석
db.sales.createIndex({ frameType: 1, saleDate: -1 })
db.sales.createIndex({ character: 1, saleDate: -1 })
```

### dailySummary

```javascript
// 기기별 일별 조회
db.dailySummary.createIndex({ kioskId: 1, date: -1 })

// 그룹별 일별 조회
db.dailySummary.createIndex({ groupId: 1, date: -1 })

// 전체 날짜 조회
db.dailySummary.createIndex({ date: -1 })
```

---

## 집계 쿼리 예시

### 일별 매출 추이

```javascript
db.sales.aggregate([
  {
    $match: {
      saleDate: {
        $gte: ISODate("2024-01-01"),
        $lt: ISODate("2024-02-01")
      }
    }
  },
  {
    $group: {
      _id: "$saleDate",
      totalSales: { $sum: "$salesAmount" },
      totalSessions: { $sum: 1 },
      avgSales: { $avg: "$salesAmount" }
    }
  },
  { $sort: { _id: 1 } }
])
```

### 프레임 타입별 선택률

```javascript
db.sales.aggregate([
  {
    $match: {
      saleDate: { $gte: ISODate("2024-01-01") }
    }
  },
  {
    $group: {
      _id: "$frameType",
      count: { $sum: 1 },
      revenue: { $sum: "$salesAmount" }
    }
  },
  {
    $group: {
      _id: null,
      total: { $sum: "$count" },
      frames: { $push: { type: "$_id", count: "$count", revenue: "$revenue" } }
    }
  },
  {
    $unwind: "$frames"
  },
  {
    $project: {
      _id: 0,
      frameType: "$frames.type",
      count: "$frames.count",
      revenue: "$frames.revenue",
      percentage: {
        $multiply: [{ $divide: ["$frames.count", "$total"] }, 100]
      }
    }
  },
  { $sort: { count: -1 } }
])
```

### 화면별 평균 체류 시간

```javascript
db.events.aggregate([
  {
    $match: {
      eventType: { $in: ["screen_enter", "screen_exit"] },
      timestamp: { $gte: ISODate("2024-01-15") }
    }
  },
  {
    $group: {
      _id: { sessionId: "$sessionId", screen: "$screen" },
      enterTime: {
        $min: {
          $cond: [{ $eq: ["$eventType", "screen_enter"] }, "$timestamp", null]
        }
      },
      exitTime: {
        $max: {
          $cond: [{ $eq: ["$eventType", "screen_exit"] }, "$timestamp", null]
        }
      }
    }
  },
  {
    $project: {
      screen: "$_id.screen",
      durationMs: { $subtract: ["$exitTime", "$enterTime"] }
    }
  },
  {
    $group: {
      _id: "$screen",
      avgDurationMs: { $avg: "$durationMs" },
      count: { $sum: 1 }
    }
  },
  { $sort: { avgDurationMs: -1 } }
])
```

### 퍼널 전환율

```javascript
db.sessions.aggregate([
  {
    $match: {
      startedAt: { $gte: ISODate("2024-01-01") }
    }
  },
  {
    $group: {
      _id: null,
      totalStarted: { $sum: 1 },
      completed: {
        $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
      },
      abandoned: {
        $sum: { $cond: [{ $eq: ["$status", "abandoned"] }, 1, 0] }
      },
      error: {
        $sum: { $cond: [{ $eq: ["$status", "error"] }, 1, 0] }
      }
    }
  },
  {
    $project: {
      _id: 0,
      totalStarted: 1,
      completed: 1,
      conversionRate: {
        $multiply: [{ $divide: ["$completed", "$totalStarted"] }, 100]
      },
      abandonRate: {
        $multiply: [{ $divide: ["$abandoned", "$totalStarted"] }, 100]
      },
      errorRate: {
        $multiply: [{ $divide: ["$error", "$totalStarted"] }, 100]
      }
    }
  }
])
```

### 이탈 화면 분석

```javascript
db.sessions.aggregate([
  {
    $match: {
      status: "abandoned",
      startedAt: { $gte: ISODate("2024-01-01") }
    }
  },
  {
    $group: {
      _id: "$exitScreen",
      count: { $sum: 1 }
    }
  },
  {
    $group: {
      _id: null,
      total: { $sum: "$count" },
      screens: { $push: { screen: "$_id", count: "$count" } }
    }
  },
  { $unwind: "$screens" },
  {
    $project: {
      _id: 0,
      screen: "$screens.screen",
      count: "$screens.count",
      percentage: {
        $multiply: [{ $divide: ["$screens.count", "$total"] }, 100]
      }
    }
  },
  { $sort: { count: -1 } }
])
```

### 성능 백분위수 (P50, P95, P99)

```javascript
db.performance.aggregate([
  {
    $match: {
      metricType: "capture",
      timestamp: { $gte: ISODate("2024-01-15") }
    }
  },
  {
    $group: {
      _id: null,
      durations: { $push: "$durationMs" },
      count: { $sum: 1 },
      avg: { $avg: "$durationMs" }
    }
  },
  {
    $project: {
      _id: 0,
      count: 1,
      avg: { $round: ["$avg", 0] },
      p50: {
        $arrayElemAt: [
          "$durations",
          { $floor: { $multiply: [0.5, "$count"] } }
        ]
      },
      p95: {
        $arrayElemAt: [
          "$durations",
          { $floor: { $multiply: [0.95, "$count"] } }
        ]
      },
      p99: {
        $arrayElemAt: [
          "$durations",
          { $floor: { $multiply: [0.99, "$count"] } }
        ]
      }
    }
  }
])
```

### 에러 발생률 추이

```javascript
db.errors.aggregate([
  {
    $match: {
      timestamp: { $gte: ISODate("2024-01-01") }
    }
  },
  {
    $group: {
      _id: {
        $dateToString: { format: "%Y-%m-%d", date: "$timestamp" }
      },
      errorCount: { $sum: 1 },
      crashCount: {
        $sum: { $cond: [{ $eq: ["$severity", "crash"] }, 1, 0] }
      },
      uniqueDevices: { $addToSet: "$kioskId" }
    }
  },
  {
    $lookup: {
      from: "sessions",
      let: { date: "$_id" },
      pipeline: [
        {
          $match: {
            $expr: {
              $eq: [
                { $dateToString: { format: "%Y-%m-%d", date: "$startedAt" } },
                "$$date"
              ]
            }
          }
        },
        { $count: "totalSessions" }
      ],
      as: "sessionData"
    }
  },
  {
    $project: {
      _id: 0,
      date: "$_id",
      errorCount: 1,
      crashCount: 1,
      affectedDevices: { $size: "$uniqueDevices" },
      totalSessions: { $arrayElemAt: ["$sessionData.totalSessions", 0] },
      errorRate: {
        $multiply: [
          {
            $divide: [
              "$errorCount",
              { $arrayElemAt: ["$sessionData.totalSessions", 0] }
            ]
          },
          100
        ]
      }
    }
  },
  { $sort: { date: -1 } }
])
```

---

## 데이터 보관 정책

| 컬렉션 | 보관 기간 | 비고 |
|--------|-----------|------|
| sessions | 1년 | 분석 완료 후 archived로 이동 |
| events | 90일 | Time-Series TTL 적용 |
| performance | 90일 | Time-Series TTL 적용 |
| errors | 1년 | 중요 에러는 영구 보관 |
| sales | 영구 | 세금/회계용 |
| dailySummary | 영구 | 집계 데이터 |
| coupons | 2년 | 프로모션 분석용 |

---

## 다음 단계

1. **우선순위 1**: sessions, sales 컬렉션 구현 → 핵심 비즈니스 지표 확보
2. **우선순위 2**: events 컬렉션 구현 → 사용자 행동 분석 시작
3. **우선순위 3**: errors, performance 구현 → 시스템 모니터링
4. **우선순위 4**: dailySummary 집계 배치 구현 → 대시보드 성능 최적화
