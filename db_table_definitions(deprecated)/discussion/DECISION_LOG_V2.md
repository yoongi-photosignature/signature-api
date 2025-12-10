# 데이터베이스 아키텍처 의사결정 로그 v2

> ⚠️ **v3로 대체됨. DECISION_LOG_V3.md 참조**

> **작성일:** 2025-12-10
> **프로젝트:** PhotoSignature 신규 시스템
> **기반:** PHOTOSIGNATURE_DB_SPEC_V1.md → PHOTOSIGNATURE_DB_SPEC_V2.md

이 문서는 v2 스키마 개선을 위한 검토 과정과 결정 사항을 기록합니다.

---

## 1. 검토 배경

### 초기 스키마 (v1) 발견된 이슈

| 이슈 | 영향 |
|------|------|
| `popup.isActive`가 sales에 저장됨 | 팝업 종료 시 대량 업데이트 필요 |
| 취소/환불 처리 없음 | 취소된 거래 추적 불가 |
| 카드번호 저장 | PCI DSS 준수 위험 |
| 729대 키오스크가 환율 API 개별 호출 | Rate limit 위험 |
| Firebase RTDB 무료 티어 | 100 연결 제한 vs 729대 기기 |

---

## 2. `popup.isActive` 필드 제거

### 문제점

v1 설계에서 모든 매출 문서에 `popup.isActive` 저장:

```javascript
// v1: sales 문서
popup: {
  id: "POPUP_KAKAO_2025",
  isActive: true,  // 문제: 팝업 종료 시 대량 업데이트 필요
}
```

팝업 종료 시 관련 매출 문서 전체 업데이트 필요 → 수천 건 쓰기 발생 가능.

### 검토 옵션

| 옵션 | 설명 | 장점 | 단점 |
|------|------|------|------|
| A. 현행 유지 | 팝업 종료 시 배치 업데이트 | 단순함 | 대량 쓰기 발생 |
| B. isActive 제거 | 앱에서 활성 ID 조회 후 $in 사용 | 배치 업데이트 없음 | 2단계 쿼리 |
| C. $lookup 사용 | popups 컬렉션과 조인 | 단일 쿼리 | 성능 저하 |

### 결정: Option B - `isActive` 제거

**근거:**
- 팝업 종료는 드묾 (월 2-3회)
- 하지만 배치 업데이트는 수천 문서 영향
- 활성 팝업 수가 적으므로 (< 20) `$in` 쿼리 성능 양호
- 2단계 쿼리는 수용 가능한 트레이드오프

**구현:**
```javascript
// Step 1: 활성 팝업 ID 조회
const activePopups = await db.popups
  .find({ status: "ACTIVE" })
  .project({ _id: 1 })
  .toArray();

// Step 2: $in으로 매출 조회
db.sales.find({ "popup.id": { $in: activePopupIds } })
```

**인덱스:**
```javascript
// $in 쿼리 효율적 지원
db.sales.createIndex({ "popup.id": 1, date: 1 })
```

---

## 3. 거래 상태 필드 추가

### 문제점

v1에 취소/환불 거래 추적 방법 없음.

레거시 시스템에는 TB_CAD001에 `CANCEL_YN`이 있었으나 v1 스키마에서 누락.

### 결정: `status` 필드 추가

```javascript
// v2: sales 문서
{
  status: "COMPLETED",      // "COMPLETED" | "CANCELLED" | "REFUNDED"
  cancelledAt: null,        // 취소 시점
  cancelReason: null        // 취소 사유
}
```

**인덱스:**
```javascript
db.sales.createIndex({ status: 1, date: 1 })
```

**쿼리 패턴:**
```javascript
// 리포트에서 취소 제외
db.sales.find({ status: "COMPLETED", ... })

// 취소 거래 조회
db.sales.find({ status: { $in: ["CANCELLED", "REFUNDED"] } })
```

---

## 4. Firebase RTDB 플랜

### 문제점

v1에서 무료 티어로 729대 운영 가정.

| 티어 | 동시 연결 |
|------|----------|
| Spark (무료) | 100 |
| Blaze (종량제) | 200,000 |

729대 > 100 연결 → **무료 티어 불가**

### 결정: Blaze 플랜 사용

**비용 추정:** 월 $5-20
- 저장소: ~1GB (1GB까지 무료)
- 다운로드: ~10GB/월
- 연결: 729대 (Blaze에서 연결당 과금 없음)

**총 비용 변경:** ~$77/월 (기존 ~$60)

---

## 5. 환율 캐싱

### 문제점

v1에서 각 키오스크가 환율을 개별 조회:
- 729대 × 일일 조회 = 729 API 호출/일
- Rate limit 위험
- 중앙 통제 없음

### 결정: Firebase RTDB를 통한 중앙 캐싱

**흐름:**
```
┌─────────────┐     매일 1회      ┌─────────────────┐
│   서버      │ ───────────────> │ Firebase RTDB   │
│ (스케줄러)  │   API 호출        │ /exchangeRates  │
└─────────────┘                  └────────┬────────┘
                                          │
                                   실시간 구독
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
              ┌──────────┐          ┌──────────┐          ┌──────────┐
              │ Kiosk 1  │          │ Kiosk 2  │   ...    │ Kiosk N  │
              └──────────┘          └──────────┘          └──────────┘
```

**장점:**
- 일일 1회 API 호출 (rate limit 위험 없음)
- 모든 키오스크 동일 환율 (일관성)
- MongoDB `exchangeRates` 컬렉션에 감사 기록

**Firebase RTDB 구조:**
```javascript
{
  "exchangeRates": {
    "date": "2025-01-15",
    "baseCurrency": "KRW",
    "rates": {
      "KRW": 1,
      "JPY": 9.12,
      "USD": 1450.5,
      "VND": 0.054
    },
    "updatedAt": 1736899200000
  }
}
```

**MongoDB config 추가:**
```javascript
{
  _id: "exchangeRateApi",
  provider: "exchangerate-api",
  endpoint: "https://api.exchangerate-api.com/v4/latest/KRW",
  updateFrequency: "daily"
}
```

---

## 6. 인덱스 전략 변경

### Partial Index 논의

v1에서 `popup.isActive`에 Partial Index 제안:

```javascript
// v1: Partial Index (isActive=true만 인덱싱)
db.sales.createIndex(
  { "popup.id": 1 },
  { partialFilterExpression: { "popup.isActive": true } }
)
```

**Cardinality 설명:**
- Boolean 필드는 낮은 cardinality (2개 값만 존재)
- Boolean만 인덱싱하면 비효율적
- Partial Index는 조건에 맞는 문서만 인덱싱
- 문서가 조건에서 벗어나면 인덱스에서 자동 제거

### 결정: 표준 복합 인덱스

`popup.isActive` 제거로 Partial Index 불필요.

**v2 인덱스:**
```javascript
// $in 쿼리용 표준 복합 인덱스
db.sales.createIndex({ "popup.id": 1, date: 1 })
```

### 최종 인덱스 목록 (전체 15개)

**sales (7개):**

| 인덱스 | 용도 |
|--------|------|
| `{ date: 1, "store.id": 1 }` | 매장별 일일 매출 |
| `{ date: 1, "country.code": 1 }` | 국내/해외 필터 |
| `{ date: 1, "country.code": 1, "popup.id": 1 }` | 해외 팝업 매출 |
| `{ "popup.id": 1, date: 1 }` | 활성 팝업 조회 ($in) |
| `{ date: 1, "product.type": 1 }` | Beauty/AR 매출 |
| `{ status: 1, date: 1 }` | 취소/환불 조회 |
| `{ "store.groupId": 1, date: 1 }` | 그룹별 리포트 |

**stores (2개):**

| 인덱스 | 용도 |
|--------|------|
| `{ "country.code": 1 }` | 국가별 매장 |
| `{ "group.id": 1 }` | 그룹별 매장 |

**devices (2개):**

| 인덱스 | 용도 |
|--------|------|
| `{ "store.id": 1 }` | 매장별 기기 |
| `{ "country.code": 1 }` | 해외 기기 필터 |

**popups (4개):**

| 인덱스 | 용도 |
|--------|------|
| `{ status: 1 }` | 활성 팝업 필터 |
| `{ "character.id": 1 }` | 캐릭터 조회 |
| `{ "period.end": 1, status: 1 }` | 만료 예정 팝업 |
| `{ countries: 1, status: 1 }` | 국가별 팝업 |

---

## 7. 보안 개선

### PCI DSS 준수

**문제:** v1에서 마스킹된 카드번호 저장

```javascript
// v1: 여전히 부분 카드 데이터 저장
payment: {
  cardNo: "1234-****-****-5678"  // 위험
}
```

**결정:** 카드번호 완전 제거

```javascript
// v2: PG 영수증만 저장
payment: {
  type: "CARD",
  receiptNo: "R20250115001",  // PG 영수증만
  pgProvider: "NICE"          // PG 사업자 추적용
}
```

**근거:**
- 카드 데이터 처리는 PCI DSS 인증 필요
- PG사에 위임하여 컴플라이언스 부담 제거
- 영수증 번호로 환불/조회 충분

---

## 8. 데이터 보관 정책

### 결정: 보류 (TODO)

초기 런칭 시 낮은 우선순위. 추후 검토.

**고려사항 기록:**
- [ ] 법적 보관 요구사항 (세무: 5년, 감사: 별도)
- [ ] Cold Storage (S3/GCS) vs TTL Index 삭제
- [ ] 아카이브 데이터 조회 필요성
- [ ] 장기 저장 비용 영향

**임시 추정:**

| 데이터 | 보관 기간 | 방법 |
|--------|----------|------|
| 매출 | 5년 | TBD |
| 환율 | 3년 | TBD |
| 기기 로그 | 1년 | TBD |

---

## 9. 아키텍처 확정

### 검토 옵션

| 옵션 | 설명 | 결정 |
|------|------|------|
| A. MongoDB + Firebase RTDB + Firestore | 현재 3-DB 구성 | ✅ 선택 |
| B. MongoDB만 (Change Streams) | 단일 DB + 실시간 | ❌ 추가 서버 필요 |
| C. Supabase (PostgreSQL + Realtime) | 단일 플랫폼 | ❌ NoSQL 유연성 상실 |

### 결정: 3-Database 아키텍처 유지

**근거:**
- 각 DB가 고유 역할에 최적화
- Firebase RTDB: 실시간 기기 상태에 최적
- MongoDB: 집계와 유연한 스키마에 최적
- Firestore: 디자이너 에셋에 이미 사용 중

**트레이드오프 수용:**
- 운영 복잡성 약간 증가
- 하지만 각 컴포넌트가 역할에 최적화

---

## 10. 변경 사항 요약

### 스키마 변경

| 필드 | v1 | v2 | 이유 |
|------|----|----|------|
| `sales.popup.isActive` | 있음 | 제거 | 대량 업데이트 방지 |
| `sales.status` | - | 추가 | 취소/환불 추적 |
| `sales.cancelledAt` | - | 추가 | 감사 추적 |
| `sales.cancelReason` | - | 추가 | 감사 추적 |
| `sales.payment.cardNo` | 마스킹 | 제거 | PCI DSS |
| `sales.payment.pgProvider` | - | 추가 | PG 추적 |

### 인프라 변경

| 항목 | v1 | v2 |
|------|----|----|
| Firebase RTDB 플랜 | 무료 | Blaze |
| 환율 소스 | 각 키오스크 | 중앙 캐시 |
| 예상 비용 | ~$60/월 | ~$77/월 |

### 인덱스 변경

| v1 | v2 |
|----|-----|
| `popup.isActive` Partial Index | 제거 (필드 삭제) |
| - | `{ "popup.id": 1, date: 1 }` 추가 |
| - | `{ status: 1, date: 1 }` 추가 |
| 전체 인덱스 | 15개 |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2025-12-10 | v2 의사결정 로그 작성 |
| 2025-12-10 | 영어 → 한글 변환 |
| 2025-12-10 | 인덱스 수 전체 기준(15개)으로 업데이트 |
