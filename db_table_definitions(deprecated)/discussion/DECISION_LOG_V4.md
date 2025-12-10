# 데이터베이스 아키텍처 의사결정 로그 v4

> ⚠️ **v5로 대체됨. DECISION_LOG_V5.md 참조**

> **작성일:** 2025-12-10
> **프로젝트:** PhotoSignature 신규 시스템
> **기반:** PHOTOSIGNATURE_DB_SPEC_V3.md → PHOTOSIGNATURE_DB_SPEC_V4.md

이 문서는 v4 스키마 개선을 위한 검토 과정과 결정 사항을 기록합니다.

---

## 1. 검토 배경

### v3 스키마 검토에서 발견된 이슈

| 이슈 | 영향 |
|------|------|
| `sales.rateDate` 타입 불일치 | string vs ISODate 혼용 |
| `sales.currency`와 `sales.country.currency` 중복 | 불필요한 데이터 중복 |
| `sales.rateSource` 누락 | 오프라인 캐시 사용 여부 추적 불가 |
| `sales.cancelledBy` 누락 | 취소 담당자 추적 불가 |
| `popups.endedAt` 누락 | 실제 종료 시점 추적 불가 |
| `popups.countries` 인덱스 없음 | 국가별 팝업 조회 성능 저하 |
| `stores.settlement.isCustomRate` 불필요 | 모든 store가 개별 rate를 가지면 됨 |
| 인덱스 수 불일치 | 문서 간 수치 불일치 |

---

## 2. `sales.rateDate` 타입 변경

### 문제점

v3에서 `rateDate`만 string 타입이고 다른 날짜 필드들은 ISODate:

```javascript
// v3: 타입 불일치
date: ISODate("2025-01-15"),           // ISODate
timestamp: ISODate("2025-01-15T14:30:00Z"),  // ISODate
rateDate: "2025-01-15"                 // string ← 불일치
```

### 결정: ISODate로 통일

```javascript
// v4
rateDate: ISODate("2025-01-15")
```

**이유:**
- 다른 날짜 필드들과 타입 일관성 유지
- MongoDB 날짜 연산 활용 가능
- 클라이언트 측 파싱 로직 통일

---

## 3. `sales.country.currency` 제거

### 문제점

`currency` 정보가 두 곳에 중복 저장:

```javascript
// v3: 중복
currency: "JPY",                 // 결제 통화
country: {
  code: "JPN",
  name: "Japan",
  currency: "JPY"                // 중복
}
```

### 결정: `sales.currency`만 유지

```javascript
// v4
currency: "JPY",
country: {
  code: "JPN",
  name: "Japan"
  // currency 제거
}
```

**이유:**
- `amount`와 `currency`가 나란히 있어 가독성 좋음
- `country`는 지역 필터링 용도이므로 code와 name만 필요
- 해당 국가 통화로만 결제하므로 중복 불필요

---

## 4. `sales.rateSource` 필드 추가

### 문제점

v3 Decision Log에서 오프라인 환율 캐시 정책을 정의했으나, 스키마에 `rateSource` 필드가 누락됨.

### 결정: `rateSource` 필드 추가

```javascript
// v4
{
  exchangeRate: 9.12,
  rateDate: ISODate("2025-01-15"),
  rateSource: "FIREBASE"           // "FIREBASE" | "CACHED"
}
```

**이유:**
- 오프라인 캐시 사용 여부 감사 추적
- 문제 발생 시 캐시된 환율로 인한 차이 확인 가능

---

## 5. `sales.cancelledBy` 필드 추가

### 문제점

취소 시 누가 취소했는지 알 수 없음:

```javascript
// v3
cancelledAt: ISODate(...),
cancelReason: "고객 요청"
// 누가 취소했는지 정보 없음
```

### 결정: `cancelledBy` 필드 추가

```javascript
// v4
cancelledAt: ISODate("2025-01-15T15:00:00Z"),
cancelReason: "고객 요청",
cancelledBy: "admin@photosignature.com"   // 또는 "SYSTEM"
```

**이유:**
- 취소 담당자 추적
- 감사 요구사항 충족
- 문제 발생 시 책임 소재 파악

---

## 6. `popups.endedAt` 필드 추가

### 문제점

`period.end`는 계획된 종료일이고 실제 종료는 수동이라고 정의했으나, 실제 종료 시점을 기록할 필드가 없음:

```javascript
// v3
period: {
  start: ISODate("2025-01-01"),
  end: ISODate("2025-03-31")      // 계획된 종료일
}
status: "ENDED"                   // 상태만 변경, 실제 종료 시점 모름
```

### 결정: `endedAt` 필드 추가

```javascript
// v4
period: {
  start: ISODate("2025-01-01"),
  end: ISODate("2025-03-31")      // 계획된 종료일
},
status: "ENDED",
endedAt: ISODate("2025-03-15T18:00:00Z")   // 실제 종료 시점
```

**이유:**
- 실제 운영 기간 정확히 파악
- 팝업별 실적 분석 시 정확한 기간 사용

---

## 7. `popups.countries` 인덱스 추가

### 문제점

국가별 활성 팝업 조회 시 인덱스가 없어 성능 저하 가능:

```javascript
// 쿼리
db.popups.find({
  status: "ACTIVE",
  $or: [
    { countries: "ALL" },
    { countries: "JPN" }
  ]
})
```

### 결정: 복합 인덱스 추가

```javascript
db.popups.createIndex({ countries: 1, status: 1 })
```

**이유:**
- 국가별 팝업 조회 성능 향상
- $or 쿼리에서 양쪽 조건 모두 인덱스 활용

---

## 8. `stores.settlement.isCustomRate` 제거

### 문제점

v3에서 `isCustomRate` 플래그로 특수 계약 매장을 구분하려 했으나:

```javascript
// v3
settlement: {
  serverFeeRate: 0.05,
  isCustomRate: true     // 7%가 아니면 true
}
```

이 방식은 "기본값이 7%/4%이고 예외만 표시"하는 개념인데, 실제로는 **모든 매장이 각자의 요율을 가지는 것**이 더 자연스러움.

### 결정: `isCustomRate` 제거, 개별 rate 사용

```javascript
// v4
settlement: {
  serverFeeRate: 0.07    // 각 매장별 요율 (기본값 개념은 생성 시점에만 적용)
}
```

**이유:**
- 모든 매장이 동등하게 자신의 요율을 가짐
- "기본값"은 매장 생성 시 초기값으로만 사용
- 불필요한 플래그 제거로 단순화

**config.serverFees 활용:**
- 매장 생성 시 국내/해외에 따라 기본값(7%/4%) 적용
- 이후에는 각 매장의 `serverFeeRate`을 직접 사용

---

## 9. 정산 쿼리 수정

### 변경 사항

`isCustomRate` 제거로 인해 정산 쿼리에서 각 매장의 rate를 직접 조회해야 함:

```javascript
// v4: $lookup으로 매장별 rate 조회
db.sales.aggregate([
  { $match: { ... }},
  { $group: {
    _id: "$store.id",
    revenue: { $sum: "$amountKRW" }
  }},
  { $lookup: {
    from: "stores",
    localField: "_id",
    foreignField: "_id",
    as: "storeInfo"
  }},
  { $addFields: {
    serverFeeRate: { $arrayElemAt: ["$storeInfo.settlement.serverFeeRate", 0] }
  }},
  { $addFields: {
    serverFee: { $multiply: ["$revenue", "$serverFeeRate"] }
  }}
])
```

**트레이드오프:**
- 쿼리가 약간 복잡해짐
- 하지만 매장별 다른 요율을 정확히 적용 가능

---

## 10. 인덱스 수 정리

### v3 문서 간 불일치 해결

v3에서 Decision Log와 Schema 문서 간 인덱스 수가 불일치했음.

### v4 인덱스 현황 (스키마 기준)

| 컬렉션 | 인덱스 수 | 인덱스 목록 |
|--------|----------|-------------|
| sales | 7 | date+store.id, date+country.code, date+country.code+popup.id, popup.id+date, date+product.type, status+date, store.groupId+date |
| stores | 2 | country.code, group.id |
| devices | 2 | store.id, country.code |
| popups | 4 | status, character.id, period.end+status, countries+status |
| **총계** | **15** | |

### 저장 공간 추정

- 15개 인덱스: ~3GB
- M10 용량: 10GB
- 데이터용 여유: ~7GB

---

## 11. 변경 사항 요약

### 스키마 변경

| 컬렉션 | 필드 | v3 | v4 | 이유 |
|--------|------|----|----|------|
| sales | rateDate | string | ISODate | 타입 일관성 |
| sales | country.currency | 있음 | 제거 | 중복 제거 |
| sales | rateSource | - | 추가 | 캐시 사용 추적 |
| sales | cancelledBy | - | 추가 | 감사 추적 |
| popups | endedAt | - | 추가 | 실제 종료 시점 |
| stores | settlement.isCustomRate | 있음 | 제거 | 불필요 |

### 인덱스 변경

| 컬렉션 | 인덱스 | 변경 |
|--------|--------|------|
| popups | `{ countries: 1, status: 1 }` | 추가 |

### 쿼리 변경

| 쿼리 | 변경 사항 |
|------|----------|
| 정산 리포트 | $lookup으로 매장별 rate 조회 필요 |

---

## 12. 비용 영향

| 항목 | v3 | v4 | 변화 |
|------|----|----|------|
| 인덱스 수 | 16개 | 15개 | -1 |
| 예상 인덱스 저장 | ~2.5GB | ~3GB | +0.5GB |
| 월 비용 | ~$77 | ~$77 | 변화 없음 |

M10 (10GB) 용량 내에서 충분히 운영 가능

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2025-12-10 | v4 의사결정 로그 작성 |
