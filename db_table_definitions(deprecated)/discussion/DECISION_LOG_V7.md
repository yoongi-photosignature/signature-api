# 데이터베이스 아키텍처 의사결정 로그 v7

> ⚠️ **v8로 대체됨. DECISION_LOG_V8.md 참조**

> **작성일:** 2025-12-10
> **프로젝트:** PhotoSignature 신규 시스템
> **기반:** PHOTOSIGNATURE_DB_SPEC_V6.md → PHOTOSIGNATURE_DB_SPEC_V7.md

이 문서는 v7 스키마 개선을 위한 검토 과정과 결정 사항을 기록합니다.

---

## 1. 검토 배경

### v6 스키마 검토에서 발견된 이슈

| 이슈 | 영향 |
|------|------|
| `status: "CANCELLED"` 의미 불명확 | 결제 실패와 환불이 구분되지 않음 |
| `popup.revenue` rate 합계 검증 없음 | storeRate + corpRate + licenseRate ≠ 1.0 가능 |
| `devices.country` 동기화 메커니즘 없음 | stores 변경 시 devices 정합성 깨짐 |
| Firestore frame 삭제 시 orphan 참조 | MongoDB frameId가 삭제된 frame 참조 가능 |
| `discount` 필드 타입 불일치 | amount는 Decimal128, discount는 number |
| popups.status 전이 규칙 미정의 | 허용되는 상태 변경 불명확 |

---

## 2. `status` 필드 분리: CANCELLED → FAILED / REFUNDED

### 문제점

v6에서 `status: "CANCELLED"`의 의미가 불명확:
- 결제 실패인가?
- 결제 후 환불인가?

```javascript
// v6: 구분 안됨
status: "CANCELLED"   // 결제 실패? 환불?
```

### 결정: FAILED와 REFUNDED로 분리

```javascript
// v7
status: "COMPLETED"   // 정상 완료
status: "FAILED"      // 결제 실패 (카드 거절 등)
status: "REFUNDED"    // 결제 후 환불
```

**관련 필드 분리:**

| 상태 | 관련 필드 | 설명 |
|------|----------|------|
| FAILED | `failedAt`, `failReason` | 결제 실패 시점 및 사유 |
| REFUNDED | `refundedAt`, `refundReason`, `refundedBy`, `refundSnapshot` | 환불 시점, 사유, 담당자, 원본 데이터 |

**근거:**
- 결제 실패: 결제 자체가 완료되지 않음 → snapshot 불필요
- 환불: 완료된 결제를 취소 → 원본 데이터 보존 필요

**부분 환불:**
- 미지원 (전액 환불만 가능)
- 부분 환불 필요 시 추후 확장

---

## 3. 모든 금액 필드 Decimal128 통일

### 문제점

v6에서 금액 필드 타입 불일치:

```javascript
// v6: 타입 불일치
amount: NumberDecimal("5000"),      // Decimal128 ✓
amountKRW: NumberDecimal("5000"),   // Decimal128 ✓
discount: {
  roulette: 1000,                   // number ✗
  coupon: 0                         // number ✗
}
```

### 결정: 모든 금액 필드 Decimal128

```javascript
// v7
discount: {
  roulette: NumberDecimal("1000"),
  coupon: NumberDecimal("0")
}
```

**변경된 필드 목록:**

| 컬렉션 | 필드 | v6 | v7 |
|--------|------|----|----|
| sales | discount.roulette | number | Decimal128 |
| sales | discount.coupon | number | Decimal128 |
| sales | popup.revenue.storeAmount | number | Decimal128 |
| sales | popup.revenue.corpAmount | number | Decimal128 |
| sales | popup.revenue.licenseAmount | number | Decimal128 |
| sales | services.beauty.fee | number | Decimal128 |
| sales | services.ar.fee | number | Decimal128 |
| popups | discountConfig.maxDiscount | number | Decimal128 |
| popups | pricing.*.price | number | Decimal128 |

**근거:**
- 타입 일관성
- 집계 시 정밀도 유지
- USD 등 소수점 통화 대응

---

## 4. stores → devices 동기화 메커니즘

### 문제점

v6에서 `devices.country`는 `stores.country`의 복사본이지만, 동기화 방법이 정의되지 않음.

stores 변경 시 devices 업데이트 누락 → 데이터 정합성 깨짐.

### 결정: API 서버에서 트랜잭션으로 동기화

```javascript
// stores 업데이트 시 devices 동기화
async function updateStore(storeId, updateData) {
  const session = client.startSession();

  try {
    await session.withTransaction(async () => {
      // 1. Update store
      await db.stores.updateOne(
        { _id: storeId },
        { $set: updateData },
        { session }
      );

      // 2. If country changed, sync to devices
      if (updateData.country) {
        await db.devices.updateMany(
          { "store.id": storeId },
          { $set: { country: updateData.country, updatedAt: new Date() } },
          { session }
        );
      }

      // 3. If store name changed, sync to devices
      if (updateData.name) {
        await db.devices.updateMany(
          { "store.id": storeId },
          { $set: { "store.name": updateData.name, updatedAt: new Date() } },
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
  }
}
```

**동기화 대상 필드:**

| stores 필드 | devices 필드 |
|-------------|--------------|
| `country` | `country` |
| `name` | `store.name` |

**근거:**
- 트랜잭션으로 원자성 보장
- API 서버 레벨에서 처리 (Change Streams 서버 불필요)

---

## 5. Firestore frame soft delete 정책

### 문제점

Firestore에서 frame을 삭제하면 MongoDB의 `product.frameId`가 orphan 참조가 됨.

### 결정: Firestore에서 soft delete 사용

```javascript
// Firestore frame document
{
  id: "251210_new_frame01",
  name: "Christmas Special",
  bgColor: "#FF0000",
  deletedAt: null              // null = active, timestamp = deleted
}
```

**조회 시:**
```javascript
// Active frames only
db.collection('frames').where('deletedAt', '==', null)
```

**근거:**
- MongoDB의 frameId 참조 유지
- 과거 매출 데이터의 프레임 정보 조회 가능
- 실수로 삭제해도 복구 가능

**스키마 문서에 명시:**
- Architecture 다이어그램에 Firestore soft delete 정책 추가

---

## 6. popup.status 상태 전이 규칙

### 문제점

v6에서 팝업 상태 관리는 "관리자 수동"이라고만 명시. 허용되는 전이 규칙이 불명확.

### 결정: 모든 전이 허용

```
┌──────────┐      ┌──────────┐      ┌──────────┐
│ SCHEDULED│ ←──→ │  ACTIVE  │ ←──→ │  ENDED   │
└──────────┘      └──────────┘      └──────────┘
     ↑                                   │
     └───────────────────────────────────┘
```

**허용되는 전이:**

| From | To | 사용 사례 |
|------|-----|----------|
| SCHEDULED | ACTIVE | 팝업 시작 |
| SCHEDULED | ENDED | 시작 전 취소 |
| ACTIVE | ENDED | 팝업 종료 |
| ACTIVE | SCHEDULED | 일시 중지 (재조정) |
| ENDED | ACTIVE | 팝업 재오픈 |
| ENDED | SCHEDULED | 재스케줄링 |

**근거:**
- 운영 유연성 최대화
- 비즈니스 상황에 따라 팝업 재오픈 필요할 수 있음
- 상태 변경 제한은 애플리케이션 레벨에서 (비즈니스 로직)

---

## 7. popup.revenueConfig rate 합계 검증

### 문제점

```javascript
revenueConfig: {
  storeRate: 0.30,
  corpRate: 0.50,
  licenseRate: 0.30   // 합계 = 1.10 (오류!)
}
```

MongoDB Schema Validation에서 합계 검증 어려움.

### 결정: 애플리케이션 레벨 검증

```javascript
// API Server validation
function validateRevenueConfig(config) {
  const sum = config.storeRate + config.corpRate + config.licenseRate;
  if (Math.abs(sum - 1.0) > 0.001) {  // 부동소수점 오차 허용
    throw new Error(`Revenue rates must sum to 1.0, got ${sum}`);
  }
}
```

**근거:**
- MongoDB $jsonSchema는 필드 간 합계 검증 미지원
- 애플리케이션 레벨에서 명확한 에러 메시지 제공
- 스키마 문서에 검증 위치 명시

---

## 8. exchangeRates 컬렉션 용도 명확화

### 배경

v6에서 exchangeRates 컬렉션의 용도가 "audit trail"로만 설명.

### 결정: 3가지 용도 명시

**1. 감사 추적 (Audit Trail)**
- 특정 날짜의 환율 기록
- 정산 검증 시 참조

**2. API 장애 시 Fallback**
- Firebase RTDB 캐시가 3일 이상 오래된 경우
- MongoDB에서 최근 3일 환율 조회 가능

**3. 정산 분쟁 해결**
- 환율 관련 분쟁 시 증빙 자료
- 특정 거래 시점의 적용 환율 확인

---

## 9. 검토 후 무시한 항목

다음 항목은 검토 후 현 시점에서 불필요하다고 판단하여 반영하지 않음:

| 항목 | 무시 이유 |
|------|----------|
| Sharding 전략 | 데이터 증가 시 아카이빙으로 대응 |
| 부분 환불 지원 | 현재 요구사항 없음 (전액 환불만) |
| 아카이빙 전략 상세화 | 향후 별도 검토 예정 |
| 취소/환불 전용 인덱스 | 조회 빈도 낮음, 성능 이슈 없음 |

---

## 10. 변경 사항 요약

### 스키마 변경

| 컬렉션 | 필드 | v6 | v7 | 이유 |
|--------|------|----|----|------|
| sales | status | COMPLETED/CANCELLED/REFUNDED | COMPLETED/FAILED/REFUNDED | 결제 실패와 환불 구분 |
| sales | cancelledAt/cancelReason/cancelledBy | 있음 | 제거 | FAILED/REFUNDED로 분리 |
| sales | failedAt/failReason | - | 추가 | 결제 실패 추적 |
| sales | refundedAt/refundReason/refundedBy | - | 추가 | 환불 추적 |
| sales | cancelSnapshot | 있음 | 제거 | refundSnapshot으로 변경 |
| sales | refundSnapshot | - | 추가 | 환불 시에만 필요 |
| sales | discount.* | number | Decimal128 | 타입 일관성 |
| sales | popup.revenue.*Amount | number | Decimal128 | 타입 일관성 |
| sales | services.*.fee | number | Decimal128 | 타입 일관성 |
| popups | discountConfig.maxDiscount | number | Decimal128 | 타입 일관성 |
| popups | pricing.*.price | number | Decimal128 | 타입 일관성 |

### 인프라 변경

| 항목 | v6 | v7 |
|------|----|----|
| stores → devices 동기화 | 미정의 | 트랜잭션 기반 동기화 |
| Firestore frame 삭제 | 미정의 | soft delete (deletedAt) |

### 정책 변경

| 정책 | v6 | v7 |
|------|----|----|
| popup.status 전이 | 수동 관리 | 모든 전이 허용 |
| revenueConfig 검증 | 미정의 | 앱 레벨 검증 (합계 = 1.0) |
| exchangeRates 용도 | audit trail | audit + fallback + 분쟁 해결 |

### 인덱스 변경

변경 없음 (8개 유지)

---

## 11. 비용 영향

| 항목 | v6 | v7 | 변화 |
|------|----|----|------|
| 인덱스 수 | 8개 | 8개 | 변화 없음 |
| 인덱스 저장 | ~1.6GB | ~1.6GB | 변화 없음 |
| Decimal128 저장 | 일부 | 전체 | 미미한 증가 |
| 월 비용 | ~$77 | ~$77 | 변화 없음 |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2025-12-10 | v7 의사결정 로그 작성 |
