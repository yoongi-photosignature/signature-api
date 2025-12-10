# 데이터베이스 아키텍처 의사결정 로그 v3

> **v4로 대체됨. DECISION_LOG_V4.md 참조**

> **작성일:** 2025-12-10
> **프로젝트:** PhotoSignature 신규 시스템
> **기반:** PHOTOSIGNATURE_DB_SPEC_V2.md → PHOTOSIGNATURE_DB_SPEC_V3.md

이 문서는 v3 스키마 개선을 위한 검토 과정과 결정 사항을 기록합니다.

---

## 1. 검토 배경

### v2 스키마 검토에서 발견된 이슈

| 이슈 | 영향 |
|------|------|
| `sales.updatedAt` 누락 | 취소/환불 시 수정 시간 추적 불가 |
| `devices.country` 누락 | 해외 디바이스 필터링 시 2단계 쿼리 필요 |
| 그룹별 조회 인덱스 없음 | 지점 단위 리포트 성능 저하 |
| 오프라인 환율 정책 미정의 | 네트워크 장애 시 해외 결제 처리 불명확 |
| `popups.countries: []` 의미 불명확 | 빈 배열이 "전체"를 의미하는지 혼란 |
| `config` 컬렉션 감사 정보 누락 | 설정 변경 추적 불가 |

---

## 2. `sales.updatedAt` 필드 추가

### 문제점

v2 스키마에는 `createdAt`만 있고 `updatedAt`이 없었음:

```javascript
// v2: updatedAt 없음
{
  status: "CANCELLED",
  cancelledAt: ISODate("..."),
  createdAt: ISODate("...")
  // updatedAt 없음 - 마지막 수정 시점 알 수 없음
}
```

### 결정: `updatedAt` 필드 추가

```javascript
// v3
{
  status: "CANCELLED",
  cancelledAt: ISODate("2025-01-15T15:00:00Z"),
  cancelReason: "고객 요청",
  createdAt: ISODate("2025-01-15T14:30:00Z"),
  updatedAt: ISODate("2025-01-15T15:00:00Z")   // 취소 시점
}
```

**이유:**
- 취소/환불 시 문서 수정 시점 추적
- 데이터 동기화 시 변경 감지 용이
- 일반적인 문서 관리 패턴 준수

---

## 3. `devices.country` 필드 추가

### 문제점

v2에서 디바이스의 국가 정보를 알려면 store를 조회해야 함:

```javascript
// v2: 해외 디바이스 조회 시
// Step 1: stores에서 해외 매장 조회
const overseasStores = await db.stores.find({ "country.code": { $ne: "KOR" } })

// Step 2: devices에서 해당 매장의 디바이스 조회
const devices = await db.devices.find({ "store.id": { $in: storeIds } })
```

### 결정: `devices`에 `country` 필드 추가

```javascript
// v3
{
  _id: "KIOSK_001",
  store: { id: "STORE_001", name: "Gangnam Store" },
  country: {
    code: "KOR",
    name: "Korea",
    currency: "KRW"
  }
}
```

**인덱스 추가:**
```javascript
db.devices.createIndex({ "country.code": 1 })
```

**이유:**
- 해외 디바이스 직접 필터링 가능
- 단일 쿼리로 국가별 디바이스 조회
- 데이터 중복이지만 조회 성능 우선

**트레이드오프:**
- store 변경 시 devices도 업데이트 필요
- 매장 국가 변경은 거의 없으므로 수용 가능

---

## 4. 그룹별 조회 인덱스 추가

### 배경

지점(그룹) 단위 리포트 요구사항:
- "강남 지점 전체 매출"
- "부산 지점 전체 매출"

### 결정: 복합 인덱스 추가

```javascript
db.sales.createIndex({ "store.groupId": 1, date: 1 })
```

**쿼리 예시:**
```javascript
db.sales.aggregate([
  { $match: {
    "store.groupId": "GROUP_GANGNAM",
    date: { $gte: ISODate("2025-01-01"), $lt: ISODate("2025-02-01") }
  }},
  { $group: {
    _id: "$store.id",
    storeName: { $first: "$store.name" },
    totalAmount: { $sum: "$amountKRW" }
  }}
])
```

**인덱스 현황:**
- v2: 전체 15개 인덱스
- v3: 전체 16개 인덱스 (sales +1, devices +1)
- 예상 저장 공간: ~3GB (M10 10GB 내 충분)

---

## 5. 오프라인 환율 캐시 정책

### 문제점

v2에서 키오스크가 Firebase RTDB를 구독하여 환율을 받아오는데, 오프라인 시나리오가 정의되지 않음:
- 네트워크 장애 시 해외 결제 불가?
- 오래된 환율 사용 시 문제 없나?

### 결정: 로컬 캐시 정책 수립

**정책:**

| 상황 | 처리 |
|------|------|
| 정상 연결 | Firebase RTDB 실시간 환율 사용 |
| 일시적 오프라인 | 로컬 캐시 환율 사용 (7일 이내) |
| 장기 오프라인 (7일+) | 해외 결제 거부 (네트워크 필요 안내) |

**구현:**
```javascript
// 키오스크 로컬 스토리지
{
  "exchangeRates": {
    "rates": { "JPY": 9.12, "USD": 1450.5 },
    "fetchedAt": 1736899200000,
    "source": "FIREBASE"        // "FIREBASE" | "CACHED"
  }
}

// 캐시 사용 시 sales 문서에 기록
{
  exchangeRate: 9.12,
  rateSource: "CACHED",         // 감사용
  rateDate: "2025-01-10"        // 캐시된 환율 날짜
}
```

**이유:**
- 7일은 환율 변동폭 감안 시 수용 가능한 오차 범위
- 장기 오프라인은 운영상 문제이므로 결제 차단이 적절
- 감사 추적을 위해 캐시 사용 여부 기록

---

## 6. 정산 요율 예외 처리

### 배경

기본 서버 수수료:
- 국내: 7%
- 해외: 4%

하지만 특수 계약 매장은 다른 요율 적용 가능

### 결정: `isCustomRate` 플래그 추가

```javascript
// v3: stores 컬렉션
{
  settlement: {
    serverFeeRate: 0.05,        // 특수 계약: 5%
    vatEnabled: true,
    isCustomRate: true          // 커스텀 요율 여부
  }
}
```

**이유:**
- 기본값(7%/4%)과 다른 요율 적용 매장 식별
- 정산 리포트에서 예외 케이스 필터링 가능
- 계약 관리 용이

---

## 7. `popups.countries` 명시적 표현

### 문제점

v2에서 `countries: []` (빈 배열)이 "전체 국가"를 의미:

```javascript
// v2: 의미 불명확
countries: []     // 전체 국가? 아니면 국가 없음?
```

### 결정: `["ALL"]` 사용

```javascript
// v3: 명시적 표현
countries: ["ALL"]              // 전체 국가
countries: ["KOR", "JPN"]       // 특정 국가만
```

**쿼리 예시:**
```javascript
// 특정 국가에서 활성화된 팝업 찾기
db.popups.find({
  status: "ACTIVE",
  $or: [
    { countries: "ALL" },
    { countries: "JPN" }
  ]
})
```

**이유:**
- 의도가 명확함
- 빈 배열의 모호함 제거
- 코드 가독성 향상

---

## 8. `config` 컬렉션 감사 정보 추가

### 문제점

v2의 config 문서에는 누가 언제 수정했는지 알 수 없음

### 결정: `updatedAt`, `updatedBy` 추가

```javascript
// v3
{
  _id: "serverFees",
  domestic: 0.07,
  overseas: 0.04,
  updatedAt: ISODate("2025-01-15T10:00:00Z"),
  updatedBy: "admin@photosignature.com"
}
```

**이유:**
- 설정 변경 추적
- 문제 발생 시 원인 파악 용이
- 감사 요구사항 충족

---

## 9. 변경 사항 요약

### 스키마 변경

| 컬렉션 | 필드 | v2 | v3 | 이유 |
|--------|------|----|----|------|
| sales | updatedAt | - | 추가 | 취소/환불 추적 |
| devices | country | - | 추가 | 직접 필터링 |
| stores | settlement.isCustomRate | - | 추가 | 특수 계약 식별 |
| popups | countries | [] | ["ALL"] | 명시적 표현 |
| config | updatedAt, updatedBy | - | 추가 | 감사 추적 |

### 인덱스 변경

| 컬렉션 | 인덱스 | 변경 |
|--------|--------|------|
| sales | `{ "store.groupId": 1, date: 1 }` | 추가 (그룹별 조회) |
| devices | `{ "country.code": 1 }` | 추가 (국가별 필터링) |

### 정책 추가

| 정책 | 내용 |
|------|------|
| 오프라인 환율 캐시 | 7일 이내 캐시 사용, 이후 결제 거부 |
| 정산 요율 예외 | isCustomRate로 특수 계약 매장 식별 |

---

## 10. 비용 영향

| 항목 | v2 | v3 | 변화 |
|------|----|----|------|
| 인덱스 수 (전체) | 15개 | 16개 | +1 (devices country) |
| 예상 인덱스 저장 | ~3GB | ~3GB | 변화 없음 |
| 월 비용 | ~$77 | ~$77 | 변화 없음 |

M10 (10GB) 용량 내에서 충분히 운영 가능

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2025-12-10 | v3 의사결정 로그 작성 |
