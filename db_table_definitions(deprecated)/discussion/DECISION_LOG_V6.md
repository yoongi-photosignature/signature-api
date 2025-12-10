# 데이터베이스 아키텍처 의사결정 로그 v6

> ⚠️ **v7로 대체됨. DECISION_LOG_V7.md 참조**

> **작성일:** 2025-12-10
> **프로젝트:** PhotoSignature 신규 시스템
> **기반:** PHOTOSIGNATURE_DB_SPEC_V5.md → PHOTOSIGNATURE_DB_SPEC_V6.md

이 문서는 v6 스키마 개선을 위한 검토 과정과 결정 사항을 기록합니다.

---

## 1. 검토 배경

### v5 스키마 검토에서 발견된 이슈

| 이슈 | 영향 |
|------|------|
| `{ status: 1, timestamp: 1 }` 인덱스 순서 | status는 cardinality 낮음 (3개 값), 범위 쿼리 비효율 |
| `{ "popup.id": 1, timestamp: 1 }` 중복 | country.code 항상 함께 사용, 3필드 인덱스로 충분 |
| 환율 캐시 7일 | 환율 변동 시 5-10% 차이 가능, 정산 분쟁 위험 |
| 취소 시 원본 데이터 미보존 | 취소 전 상태 복원 불가, 감사 어려움 |
| discount 음수 검증 없음 | 잘못된 데이터 입력 가능 |
| amountKRW 정밀도 이슈 미문서화 | 정산 시 오차 처리 방법 불명확 |

---

## 2. 인덱스 순서 변경: `status` → `timestamp` 선두

### 문제점

v5에서 status 인덱스:

```javascript
// v5
db.sales.createIndex({ status: 1, timestamp: 1 })
```

**문제:**
- `status`는 cardinality가 낮음 (COMPLETED, CANCELLED, REFUNDED 3개 값)
- 대부분의 쿼리는 날짜 범위 + status 조건
- 선두 컬럼이 낮은 cardinality면 인덱스 효율 저하

### 결정: `timestamp` 선두로 변경

```javascript
// v6
db.sales.createIndex({ timestamp: 1, status: 1 })
```

**근거:**
- `timestamp` 범위 쿼리가 먼저 데이터를 좁힘
- 좁혀진 범위 내에서 `status` 필터링
- MongoDB는 복합 인덱스에서 선두 컬럼으로 먼저 스캔

**쿼리 패턴 분석:**
```javascript
// 실제 사용 패턴
db.sales.find({
  timestamp: { $gte: ISODate("2025-01-01"), $lt: ISODate("2025-02-01") },
  status: "CANCELLED"
})
// → timestamp 범위로 먼저 좁히고, 그 안에서 status 필터링
```

---

## 3. 중복 인덱스 제거: `{ "popup.id": 1, timestamp: 1 }`

### 문제점

v5에서 popup 관련 인덱스 2개:

```javascript
// v5: 두 인덱스 모두 존재
{ timestamp: 1, "country.code": 1, "popup.id": 1 }  // 3필드 복합
{ "popup.id": 1, timestamp: 1 }                      // 2필드 복합
```

### 분석

**쿼리 패턴 확인:**
- 팝업 매출 조회 시 항상 `country.code`와 함께 사용
- 국내/해외 분리 정산이 기본
- 순수하게 `popup.id`만으로 조회하는 케이스 없음

### 결정: 2필드 인덱스 제거

```javascript
// v6: 3필드 복합 인덱스만 유지
{ timestamp: 1, "country.code": 1, "popup.id": 1 }
```

**근거:**
- `country.code` 없이 팝업 조회하는 경우 없음
- 3필드 인덱스가 2필드 쿼리도 커버 가능 (prefix 활용)
- 인덱스 수 감소: 15개 → 14개
- 저장 공간 절약: ~0.2GB

**트레이드오프:**
- 만약 `popup.id`만으로 조회가 필요하면 인덱스 추가 필요
- 현재 요구사항에서는 해당 케이스 없음

---

## 4. 환율 캐시 유효기간: 7일 → 3일

### 문제점

v5 오프라인 환율 정책:
- 캐시 유효기간 7일
- 7일간 환율 변동폭이 클 수 있음

**리스크:**
- 급등락 시 5-10% 차이 발생 가능
- 정산 시 환율 차이로 인한 분쟁
- 해외 매장 수익 계산 오차

### 결정: 3일로 단축

```javascript
// v6: Offline Exchange Rate Policy
// Cache Validity: Accept cached rate up to 3 days old (v6: reduced from 7 days)
// Fallback: If cache > 3 days, reject overseas transactions
```

**근거:**
- 3일 내 환율 변동폭은 일반적으로 1-3% 수준
- 정산 오차 허용 범위 내
- 3일 이상 오프라인은 운영상 문제로 판단 → 네트워크 점검 필요

**영향:**
- 오프라인 허용 기간 감소
- 하지만 3일 이상 오프라인은 비정상 상황
- 안정적인 네트워크 환경에서는 영향 없음

---

## 5. 취소 스냅샷 필드 추가: `cancelSnapshot`

### 문제점

v5에서 취소 시:
```javascript
// v5: 취소 시 상태만 변경
{
  status: "CANCELLED",
  cancelledAt: ISODate(...),
  cancelReason: "고객 요청",
  cancelledBy: "admin@example.com"
}
// 원본 금액, 원래 상태 알 수 없음
```

**문제:**
- 취소 전 원본 데이터 복원 불가
- 감사 시 원래 거래 내용 확인 어려움
- 실수로 취소 시 원본 정보 손실

### 결정: `cancelSnapshot` 필드 추가

```javascript
// v6
{
  status: "CANCELLED",
  cancelledAt: ISODate("2025-01-15T15:00:00Z"),
  cancelReason: "고객 요청",
  cancelledBy: "admin@photosignature.com",
  cancelSnapshot: {
    originalAmount: 5000,
    originalAmountKRW: 5000,
    originalStatus: "COMPLETED"
  }
}
```

**저장 시점:**
- `status`가 CANCELLED 또는 REFUNDED로 변경될 때
- 정상 거래(COMPLETED)에서는 null

**포함 정보:**
- `originalAmount`: 취소 전 원본 금액
- `originalAmountKRW`: 취소 전 원화 금액
- `originalStatus`: 취소 전 상태

**근거:**
- 감사 추적 완전성
- 취소 전 상태 복원 가능
- 분쟁 발생 시 원본 데이터 확인

---

## 6. discount 음수 방지 검증

### 문제점

v5 Schema Validation에서 discount 필드 검증 없음:

```javascript
// v5: discount 검증 없음
discount: {
  roulette: 1000,
  coupon: 0
}
// 음수 값 입력 가능 → 데이터 오류
```

### 결정: minimum: 0 검증 추가

```javascript
// v6 Schema Validation
discount: {
  bsonType: "object",
  properties: {
    roulette: { bsonType: "number", minimum: 0 },
    coupon: { bsonType: "number", minimum: 0 }
  }
}
```

**근거:**
- 할인 금액은 항상 0 이상
- 음수 할인은 논리적으로 불가능
- 잘못된 데이터 사전 차단

---

## 7. 금액 필드 Decimal128 타입 적용

### 배경

JavaScript `Number`는 IEEE 754 부동소수점 사용:

```javascript
0.1 + 0.2  // 0.30000000000000004
```

**문제:**
- 대량 집계 시 미세한 오차 누적
- USD 등 소수점 통화 지원 시 정밀도 이슈

**통화별 소수점:**

| 통화 | 소수점 | 예시 |
|------|--------|------|
| KRW | 0자리 | 5000 |
| JPY | 0자리 | 500 |
| USD | 2자리 | 12.99 |
| VND | 0자리 | 50000 |

### 검토 옵션

| 옵션 | 설명 | 장점 | 단점 |
|------|------|------|------|
| A. Decimal128 | MongoDB 128비트 십진수 | 정밀도 완벽 | 앱에서 변환 필요 |
| B. 정수 저장 | 최소 단위로 저장 (센트/전) | 단순, 오차 없음 | 변환 로직 필요 |
| C. 현행 유지 | Number + 반올림 | 단순 | USD 소수점 정밀도 이슈 |

### 결정: Option A - Decimal128

**적용 필드:**
- `amount` - 원화 금액
- `amountKRW` - 원화 환산 금액
- `exchangeRate` - 환율
- `cancelSnapshot.originalAmount` - 취소 전 원금액
- `cancelSnapshot.originalAmountKRW` - 취소 전 원화 금액

**근거:**
- USD 소수점 2자리 정확히 처리
- MongoDB 집계 시 정밀도 유지
- 추가 비용 없음 (저장 공간 약간 증가: 8바이트 → 16바이트)

**애플리케이션 처리:**

```javascript
// 저장 시
const { Decimal128 } = require('mongodb');
await db.sales.insertOne({
  amount: Decimal128.fromString("12.99"),
  amountKRW: Decimal128.fromString("18839.30")
});

// 조회 시
const sale = await db.sales.findOne(...);
const displayAmount = Number(sale.amountKRW.toString());

// 집계 시 - MongoDB가 Decimal128 연산 지원
db.sales.aggregate([
  { $group: { _id: null, total: { $sum: "$amountKRW" } } }
]);
```

---

## 8. 인덱스 최소화 (Write-Heavy 최적화)

### 배경

초기 설계에서 15개 인덱스 제안 → 검토 후 8개로 축소.

**Write-heavy 워크로드에서 인덱스 비용:**

| 인덱스 수 | 저장 공간 | INSERT 오버헤드 |
|----------|----------|----------------|
| 5~6개 | ~1.2GB | ~1.3x |
| 14~15개 | ~2.8GB | ~1.8x |

인덱스가 많을수록 매 INSERT마다 모든 인덱스 업데이트 필요 → 쓰기 성능 저하.

### 인덱스 필요성 검토

| 인덱스 | 빈도 | 결정 |
|--------|------|------|
| `{ timestamp: 1, "store.id": 1 }` | 매우 높음 | ✅ 유지 |
| `{ timestamp: 1, "country.code": 1 }` | 매우 높음 | ✅ 유지 |
| `{ timestamp: 1, "country.code": 1, "popup.id": 1 }` | 높음 | ✅ 유지 |
| `{ "store.groupId": 1, timestamp: 1 }` | 중간 | ✅ 유지 |
| `{ timestamp: 1, "product.type": 1 }` | 낮음 | ❌ 제거 |
| `{ timestamp: 1, status: 1 }` | 낮음 | ❌ 제거 |
| `{ "group.id": 1 }` (stores) | 낮음 | ❌ 제거 |
| `{ "country.code": 1 }` (stores) | 중간 | ✅ 유지 |
| `{ "store.id": 1 }` (devices) | 높음 | ✅ 유지 |
| `{ "country.code": 1 }` (devices) | 낮음 | ❌ 제거 |
| `{ status: 1 }` (popups) | 높음 | ✅ 유지 |
| `{ "character.id": 1 }` (popups) | 중간 | ✅ 유지 |
| `{ "period.end": 1, status: 1 }` (popups) | 낮음 | ❌ 제거 |
| `{ countries: 1, status: 1 }` (popups) | 낮음 | ❌ 제거 |

### 결정: 8개 인덱스로 최소화

**유지 인덱스 (8개):**

| 컬렉션 | 인덱스 | 용도 |
|--------|--------|------|
| sales | `{ timestamp: 1, "store.id": 1 }` | 매장별 매출 |
| sales | `{ timestamp: 1, "country.code": 1 }` | 국내/해외 정산 |
| sales | `{ timestamp: 1, "country.code": 1, "popup.id": 1 }` | 팝업 매출 |
| sales | `{ "store.groupId": 1, timestamp: 1 }` | 그룹 리포트 |
| stores | `{ "country.code": 1 }` | 국가별 매장 |
| devices | `{ "store.id": 1 }` | 매장별 기기 |
| popups | `{ status: 1 }` | 활성 팝업 |
| popups | `{ "character.id": 1 }` | 캐릭터 조회 |

**제거된 인덱스 (7개):**
- `{ timestamp: 1, "product.type": 1 }` - Beauty/AR 조회 빈도 낮음
- `{ timestamp: 1, status: 1 }` - 취소 조회 빈도 낮음
- `{ "group.id": 1 }` (stores) - 그룹 조회 빈도 낮음
- `{ "country.code": 1 }` (devices) - 국가별 기기 조회 빈도 낮음
- `{ "period.end": 1, status: 1 }` (popups) - 만료 예정 조회 빈도 낮음
- `{ countries: 1, status: 1 }` (popups) - 국가별 팝업 조회 빈도 낮음
- `{ "popup.id": 1, timestamp: 1 }` - country.code와 항상 함께 사용, 3필드 인덱스로 커버

### v6 인덱스 현황

| 컬렉션 | 인덱스 수 |
|--------|----------|
| sales | 4 |
| stores | 1 |
| devices | 1 |
| popups | 2 |
| **총계** | **8** |

### 저장 공간 추정

- 8개 인덱스: ~1.6GB
- M10 용량: 10GB
- 데이터용 여유: ~8.4GB

### 향후 인덱스 추가 가이드

운영 중 느린 쿼리 발견 시 MongoDB Atlas Performance Advisor 활용하여 필요한 인덱스 추가.

---

## 9. 변경 사항 요약

### 스키마 변경

| 컬렉션 | 필드 | v5 | v6 | 이유 |
|--------|------|----|----|------|
| sales | amount, amountKRW, exchangeRate | Number | Decimal128 | USD 소수점 정밀도 |
| sales | cancelSnapshot | - | 추가 | 취소 전 원본 보존 |
| sales | discount validation | 없음 | minimum: 0 | 음수 방지 |

### 인덱스 변경

| 항목 | v5 | v6 |
|------|----|----|
| 총 인덱스 수 | 15개 | 8개 |
| sales | 7개 | 4개 |
| stores | 2개 | 1개 |
| devices | 2개 | 1개 |
| popups | 4개 | 2개 |

### 정책 변경

| 정책 | v5 | v6 | 이유 |
|------|----|----|------|
| 환율 캐시 유효기간 | 7일 | 3일 | 환율 변동 리스크 최소화 |

---

## 10. 비용 영향

| 항목 | v5 | v6 | 변화 |
|------|----|----|------|
| 인덱스 수 | 15개 | 8개 | -7 |
| 인덱스 저장 | ~3GB | ~1.6GB | -1.4GB |
| 데이터 여유 공간 | ~7GB | ~8.4GB | +1.4GB |
| INSERT 성능 | ~1.8x | ~1.4x | 개선 |
| 월 비용 | ~$77 | ~$77 | 변화 없음 |

M10 (10GB) 용량 내에서 충분히 운영 가능

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2025-12-10 | v6 의사결정 로그 작성 |
