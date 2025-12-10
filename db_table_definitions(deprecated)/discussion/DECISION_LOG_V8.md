# 데이터베이스 아키텍처 의사결정 로그 v8

> **작성일:** 2025-12-10
> **프로젝트:** PhotoSignature 신규 시스템
> **기반:** PHOTOSIGNATURE_DB_SPEC_V7.md → PHOTOSIGNATURE_DB_SPEC_V8.md

이 문서는 v8 스키마 개선을 위한 검토 과정과 결정 사항을 기록합니다.

---

## 1. 검토 배경

### v7 스키마 검토에서 발견된 이슈

| 이슈 | 영향 |
|------|------|
| REFUNDED 정산 정책 미정의 | 환불 시 정산 처리 방법 불명확 |
| `refundSnapshot.originalStatus` 누락 | 환불 전 상태 추적 불가 |
| `popup.revenue` 금액 필드 불필요 | 앱에서 계산 가능, DB 저장 불필요 |
| 환율 Fallback 흐름 미정의 | 캐시 만료 시 키오스크 처리 방법 불명확 |
| `ar` → `ai` 명칭 오류 | 실제 서비스명과 불일치 |
| `popups.pricing` currency 누락 | 가격의 통화 단위 불명확 |
| Replica Set 요구사항 미문서화 | 트랜잭션 사용 시 필요 조건 불명확 |

---

## 2. 환불 정산 정책 추가

### 문제점

v7에서 REFUNDED 거래의 정산 처리 방법이 정의되지 않음:
- 원래 거래 월에서 차감?
- 환불 처리 월에서 차감?

### 결정: 환불 처리 월에서 차감

```javascript
// 월 정산 시 환불 처리
db.sales.aggregate([
  { $match: {
    "store.id": "STORE_001",
    $or: [
      // 해당 월의 완료 거래
      {
        timestamp: { $gte: ISODate("2025-01-01"), $lt: ISODate("2025-02-01") },
        status: "COMPLETED"
      },
      // 해당 월에 환불 처리된 거래 (원래 결제 월과 무관)
      {
        refundedAt: { $gte: ISODate("2025-01-01"), $lt: ISODate("2025-02-01") },
        status: "REFUNDED"
      }
    ]
  }},
  { $group: {
    _id: "$store.id",
    completedAmount: {
      $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, "$amountKRW", 0] }
    },
    refundedAmount: {
      $sum: { $cond: [{ $eq: ["$status", "REFUNDED"] }, "$refundSnapshot.originalAmountKRW", 0] }
    }
  }},
  { $addFields: {
    netAmount: { $subtract: ["$completedAmount", "$refundedAmount"] }
  }}
])
```

**근거:**
- 정산은 월 단위 마감 후 진행
- 마감 후 환불은 다음 정산에서 차감이 자연스러움
- `refundedAt` 기준으로 환불 월 결정
- `refundSnapshot.originalAmountKRW`로 원래 금액 차감

---

## 3. `refundSnapshot.originalStatus` 필드 추가

### 문제점

v7에서 `refundSnapshot`에 원래 상태가 없음:

```javascript
// v7
refundSnapshot: {
  originalAmount: NumberDecimal("5000"),
  originalAmountKRW: NumberDecimal("5000")
  // originalStatus 없음
}
```

### 결정: `originalStatus` 필드 추가

```javascript
// v8
refundSnapshot: {
  originalAmount: NumberDecimal("5000"),
  originalAmountKRW: NumberDecimal("5000"),
  originalStatus: "COMPLETED"           // 환불 전 상태
}
```

**근거:**
- 감사 추적 완전성
- 환불 전 상태 확인 가능 (COMPLETED에서 REFUNDED로 변경된 것 명시)
- 비정상 케이스 식별 (예: 이미 FAILED인 거래를 REFUNDED로 변경하려는 시도)

---

## 4. `popup.revenue` 금액 필드 제거

### 문제점

v7에서 `popup.revenue`에 rate와 amount가 모두 저장:

```javascript
// v7
popup: {
  revenue: {
    storeRate: 0.30,
    corpRate: 0.50,
    licenseRate: 0.20,
    storeAmount: NumberDecimal("1500"),    // 불필요
    corpAmount: NumberDecimal("2500"),     // 불필요
    licenseAmount: NumberDecimal("1000")   // 불필요
  }
}
```

**문제:**
- `amountKRW * rate`로 언제든 계산 가능
- 저장 공간 낭비
- 데이터 정합성 관리 포인트 증가

### 결정: 금액 필드 제거, rate만 유지

```javascript
// v8
popup: {
  revenue: {
    storeRate: 0.30,
    corpRate: 0.50,
    licenseRate: 0.20
    // 금액 필드 제거 - 앱에서 계산
  }
}
```

**근거:**
- 앱에서 `amountKRW * storeRate` 등으로 계산
- 저장 공간 절약
- 정합성 관리 포인트 감소
- rate는 거래 시점 기록이므로 유지 필요

---

## 5. 환율 Fallback API 흐름 추가

### 문제점

v7에서 캐시 만료 시 키오스크의 처리 방법이 불명확:
- Firebase RTDB 캐시 3일 초과 시 어떻게 하나?
- 키오스크가 직접 MongoDB에 접근할 수 없음

### 결정: API 서버 경유 Fallback 흐름 추가

```
┌──────────┐                    ┌──────────────┐                ┌──────────┐
│  Kiosk   │                    │  API Server  │                │ MongoDB  │
└────┬─────┘                    └──────┬───────┘                └────┬─────┘
     │                                 │                              │
     │  1. Check Firebase RTDB         │                              │
     │  (cache > 3 days)               │                              │
     │                                 │                              │
     │  2. GET /api/exchange-rates     │                              │
     │  ─────────────────────────>     │                              │
     │                                 │  3. Query exchangeRates      │
     │                                 │  ─────────────────────────>  │
     │                                 │                              │
     │                                 │  4. Return rates             │
     │                                 │  <─────────────────────────  │
     │  5. Return rates                │                              │
     │  <─────────────────────────     │                              │
     │                                 │                              │
     │  6. Use rate, set rateSource: "API_FALLBACK"                   │
```

**rateSource 값:**
- `"FIREBASE"`: Firebase RTDB 실시간 환율
- `"CACHED"`: 로컬 캐시 환율 (3일 이내)
- `"API_FALLBACK"`: MongoDB 환율 (캐시 만료 시 API 서버 경유)

**근거:**
- 키오스크는 MongoDB에 직접 접근하지 않음
- API 서버가 MongoDB에서 환율 조회 후 응답
- 감사를 위해 `rateSource: "API_FALLBACK"` 기록

---

## 6. `ar` → `ai` 명칭 변경

### 문제점

v7에서 `ar` (Augmented Reality)로 표기했으나 실제 서비스명은 `ai`

### 결정: 전체 명칭 변경

```javascript
// v7
services: {
  beauty: { used: true, fee: NumberDecimal("500") },
  ar: { used: false, fee: NumberDecimal("0") }       // 잘못된 명칭
}

product: {
  type: "AR"                                         // 잘못된 명칭
}

// v8
services: {
  beauty: { used: true, fee: NumberDecimal("500") },
  ai: { used: false, fee: NumberDecimal("0") }       // 수정됨
}

product: {
  type: "AI"                                         // 수정됨
}
```

**변경 위치:**
- `sales.services.ar` → `sales.services.ai`
- `sales.product.type: "AR"` → `"AI"`
- `config.productTypes.AR` → `AI`
- Schema Validation의 enum 값

---

## 7. `popups.pricing` currency 필드 추가

### 문제점

v7에서 pricing의 통화 단위가 명시되지 않음:

```javascript
// v7
pricing: {
  "3CUT": { price: NumberDecimal("4000"), printCount: 1 },
  "4CUT": { price: NumberDecimal("5000"), printCount: 2 }
  // 이 가격이 KRW인지 JPY인지 불명확
}
```

### 결정: currency 필드 추가

```javascript
// v8
pricing: {
  currency: "KRW",                                   // 가격 통화
  "3CUT": { price: NumberDecimal("4000"), printCount: 1 },
  "4CUT": { price: NumberDecimal("5000"), printCount: 2 }
}
```

**근거:**
- 팝업별로 다른 통화 사용 가능
- 해외 팝업은 JPY, USD 등 가격 책정 가능
- 명시적 통화 표기로 혼란 방지

---

## 8. Replica Set 요구사항 문서화

### 문제점

v7에서 트랜잭션을 사용하지만 Replica Set 요구사항이 명시되지 않음:

```javascript
// v7: 트랜잭션 사용
await session.withTransaction(async () => { ... });
```

MongoDB 트랜잭션은 **Replica Set**에서만 동작함.

### 결정: Replica Set 요구사항 섹션 추가

**MongoDB Atlas M10:**
- M10+ 클러스터는 **자동으로 Replica Set 구성**
- 트랜잭션 사용 위한 추가 설정 불필요
- 기본 3노드 replica set (1 primary + 2 secondaries)

**확인 방법:**
```javascript
// MongoDB shell에서 확인
rs.status()

// Atlas UI:
// Clusters → 클러스터 선택 → Overview → "Replica Set" 뱃지 확인
```

**근거:**
- 트랜잭션은 쓰기 작업이 여러 노드에 복제되어야 함
- `writeConcern: "majority"`는 최소 2노드 확인 필요
- 단일 노드(Standalone)는 multi-document 트랜잭션 미지원

---

## 9. 검토 후 무시한 항목

다음 항목은 검토 후 현 시점에서 불필요하다고 판단하여 반영하지 않음:

| 항목 | 무시 이유 |
|------|----------|
| 취소/환불 전용 인덱스 | 조회 빈도 낮음, 성능 이슈 없음 |
| config 컬렉션 validation | 관리자만 수정, 앱 레벨 검증으로 충분 |
| services.beauty/ai 수수료 정의 | 추후 별도 정의 예정 |

---

## 10. 변경 사항 요약

### 스키마 변경

| 컬렉션 | 필드 | v7 | v8 | 이유 |
|--------|------|----|----|------|
| sales | refundSnapshot.originalStatus | - | 추가 | 환불 전 상태 추적 |
| sales | popup.revenue.*Amount | 있음 | 제거 | 앱에서 계산 |
| sales | services.ar | 있음 | ai로 변경 | 명칭 수정 |
| sales | product.type "AR" | 있음 | "AI"로 변경 | 명칭 수정 |
| sales | rateSource | FIREBASE/CACHED | +API_FALLBACK | Fallback 추가 |
| popups | pricing.currency | - | 추가 | 통화 명시 |

### 정책 추가

| 정책 | 내용 |
|------|------|
| 환불 정산 | `refundedAt` 기준 월에서 차감 |
| 환율 Fallback | 캐시 만료 시 API 서버 경유 MongoDB 조회 |
| Replica Set | 트랜잭션 사용 위해 필수 (Atlas M10 자동 구성) |

### 인덱스 변경

변경 없음 (8개 유지)

---

## 11. 비용 영향

| 항목 | v7 | v8 | 변화 |
|------|----|----|------|
| 인덱스 수 | 8개 | 8개 | 변화 없음 |
| 인덱스 저장 | ~1.6GB | ~1.6GB | 변화 없음 |
| 문서 크기 | - | 약간 감소 | popup.revenue 금액 필드 제거 |
| 월 비용 | ~$77 | ~$77 | 변화 없음 |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2025-12-10 | v8 의사결정 로그 작성 |
