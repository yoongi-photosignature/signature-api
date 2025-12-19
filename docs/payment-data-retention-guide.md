# 결제 정보 보관 가이드

> **작성일**: 2025-01-19
> **적용 대상**: PhotoSignature 키오스크 결제 시스템
> **핵심 원칙**: "최소한으로, 그러나 반드시 필요한 것만" 저장

---

## 1. 법적 요구사항

### 1.1 PCI-DSS (Payment Card Industry Data Security Standard)

카드 결제 데이터 보안 표준. 위반 시 가맹점 자격 박탈 및 과태료 부과.

| 구분 | 저장 가능 여부 | 비고 |
|------|---------------|------|
| 카드번호 전체 (PAN) | ❌ 금지 | 암호화해도 저장 금지 권장 |
| 카드 유효기간 | ❌ 금지 | |
| CVC/CVV | ❌ **절대 금지** | 승인 후 즉시 폐기 |
| IC칩/MSR 트랙 데이터 | ❌ **절대 금지** | |
| 마스킹된 카드번호 | ⚠️ 조건부 | PG에서 제공한 값만 허용 |
| 카드 브랜드/타입 | ✅ 허용 | VISA, MASTERCARD 등 |

### 1.2 전자상거래법 / 전자금융거래법

| 항목 | 보관 기간 | 근거 |
|------|----------|------|
| 거래 기록 | **5년** | 전자상거래법 제6조 |
| 결제 증빙 | **5년** | 전자금융거래법 |
| 소비자 불만/분쟁 기록 | **3년** | 전자상거래법 |

### 1.3 세법 관련

| 항목 | 보관 기간 | 근거 |
|------|----------|------|
| 매출 증빙 | **5년** | 국세기본법 |
| 세금계산서 | **5년** | 부가가치세법 |

---

## 2. 저장 금지 데이터

### ❌ 절대 저장하면 안 되는 정보

```
절대 금지:
├── 카드번호 전체 (PAN): 1234-5678-9012-3456
├── 카드 유효기간: 12/25
├── CVC/CVV: 123
├── IC칩 데이터
├── MSR 트랙 데이터 (Track1, Track2)
├── PIN 번호
├── 카드 실물/서명 이미지
└── 생체 인증 데이터
```

### ⚠️ 직접 생성/저장 금지

```typescript
// ❌ 잘못된 예 - 직접 마스킹하여 저장
const maskedCard = cardNumber.replace(/\d{12}/, '****-****-****-');
await db.sales.insertOne({ cardNumber: maskedCard });

// ✅ 올바른 예 - PG 응답값만 저장
const pgResponse = await pg.approve(paymentData);
await db.sales.insertOne({
  cardLast4: pgResponse.cardLast4,  // PG가 제공한 값
  cardBrand: pgResponse.cardBrand   // PG가 제공한 값
});
```

---

## 3. 필수 저장 데이터

### 3.1 결제 기본 정보

| 필드 | 설명 | 타입 | 예시 |
|------|------|------|------|
| `_id` | 내부 결제 ID | ObjectId | |
| `payment.pgTransactionId` | **PG 거래번호** (가장 중요) | string | `"NICE_TXN_20250119_001"` |
| `payment.approvalNo` | 승인번호 | string | `"12345678"` |
| `payment.receiptNo` | 영수증 번호 | string | `"R20250119001"` |
| `amount` | 결제 금액 | Decimal128 | `1000.00` |
| `currency` | 통화 | string | `"KRW"` |
| `timestamp` | 승인 시각 | Date | ISO 8601 |
| `status` | 결제 상태 | string | `"COMPLETED"` |
| `payment.type` | 결제 수단 | string | `"CARD"` |
| `payment.installmentMonths` | 할부 개월 (0=일시불) | number | `0` |

### 3.2 카드 메타데이터 (PG 제공값만)

| 필드 | 설명 | 타입 | 예시 |
|------|------|------|------|
| `payment.cardBrand` | 카드 브랜드 | string | `"VISA"`, `"BC"` |
| `payment.cardType` | 카드 종류 | string | `"CREDIT"`, `"DEBIT"` |
| `payment.cardIssuer` | 발급사 | string | `"신한카드"` |
| `payment.cardLast4` | 끝 4자리 | string | `"1234"` |

### 3.3 단말기/환경 정보

| 필드 | 설명 | 타입 | 예시 |
|------|------|------|------|
| `payment.terminalId` | 카드 단말기 ID | string | `"TID_001"` |
| `device.id` | 키오스크 ID | string | `"KIOSK_001"` |
| `store.id` | 매장 ID | string | `"STORE_001"` |
| `payment.pgProvider` | PG사 | string | `"NICE"` |

### 3.4 취소/환불 정보

| 필드 | 설명 | 타입 | 필수 |
|------|------|------|------|
| `payment.pgTransactionId` | 원 거래 PG ID | string | **필수** |
| `payment.approvalNo` | 원 거래 승인번호 | string | 일부 PG 요구 |
| `refundedAt` | 취소 시각 | Date | |
| `refundReason` | 취소 사유 | string | |
| `refundSnapshot` | 원본 금액 스냅샷 | object | 감사 추적용 |

---

## 4. 권장 저장 데이터

### 4.1 분쟁/CS 대응용

```typescript
payment: {
  pgResponseCode?: string;     // PG 응답 코드 (성공: "0000")
  pgErrorMessage?: string;     // 실패 시 오류 메시지
  authMethod?: string;         // 인증 방식 (CHIP, PIN, CONTACTLESS)
}
```

### 4.2 운영 분석용

```typescript
// 시간 차원 (자동 생성)
timeDimension: {
  year: number;
  month: number;
  week: number;
  dayOfWeek: number;
  hour: number;
}

// 금액 상세
amounts: {
  gross: Decimal128;      // 할인 전 원가
  discount: Decimal128;   // 할인액
  tax: Decimal128;        // 세금
  net: Decimal128;        // 최종 결제액
  margin: Decimal128;     // 수익
}
```

---

## 5. 현재 스키마 구현 상태

### 5.1 구현 완료 ✅

| 항목 | 필드 | 상태 |
|------|------|------|
| 결제 금액 | `amount`, `amountKRW` | ✅ |
| 결제 상태 | `status` | ✅ |
| 결제 수단 | `payment.type` | ✅ |
| 영수증 번호 | `payment.receiptNo` | ✅ |
| PG 제공자 | `payment.pgProvider` | ✅ |
| 디바이스 정보 | `device.id`, `device.name` | ✅ |
| 매장 정보 | `store.id`, `store.name` | ✅ |
| 환불 처리 | `refundedAt`, `refundReason`, `refundSnapshot` | ✅ |
| 정산 정보 | `settlement.*` | ✅ |
| 확장 금액 | `amounts.*` | ✅ |

### 5.2 추가 필요 ⚠️

| 항목 | 필드 | 중요도 | 용도 |
|------|------|--------|------|
| PG 거래번호 | `payment.pgTransactionId` | **필수** | 취소/환불 요청 |
| 승인번호 | `payment.approvalNo` | **필수** | 거래 조회/분쟁 |
| 할부 개월 | `payment.installmentMonths` | 권장 | 정산/리포트 |
| 단말기 ID | `payment.terminalId` | 권장 | 장애 추적 |
| 카드 브랜드 | `payment.cardBrand` | 선택 | 분석/CS |
| 카드 타입 | `payment.cardType` | 선택 | 분석 |
| 카드 발급사 | `payment.cardIssuer` | 선택 | 분석/CS |
| 카드 끝 4자리 | `payment.cardLast4` | 선택 | CS 대응 |
| PG 응답코드 | `payment.pgResponseCode` | 선택 | 오류 분석 |

---

## 6. 스키마 개선 제안

### 6.1 payment 객체 확장

```typescript
// src/types/index.ts
export interface PaymentInfo {
  type: PaymentType;              // 기존
  receiptNo?: string;             // 기존
  pgProvider?: string;            // 기존

  // 추가 필드 (필수)
  pgTransactionId?: string;       // PG 거래 ID - 취소 시 필수
  approvalNo?: string;            // 승인번호

  // 추가 필드 (권장)
  installmentMonths?: number;     // 할부 개월 (0=일시불)
  terminalId?: string;            // 카드 단말기 ID

  // 추가 필드 (선택 - PG 제공값만)
  cardBrand?: string;             // VISA, MASTERCARD, BC 등
  cardType?: string;              // CREDIT, DEBIT, PREPAID
  cardIssuer?: string;            // 발급사명
  cardLast4?: string;             // 끝 4자리

  // 추가 필드 (디버깅/분석용)
  pgResponseCode?: string;        // PG 응답 코드
  pgErrorMessage?: string;        // 실패 시 오류 메시지
}
```

### 6.2 스키마 변경 예시

```typescript
// src/modules/sales/sales.schema.ts
const paymentSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['CASH', 'CARD'] },
    receiptNo: { type: 'string' },
    pgProvider: { type: 'string' },

    // 신규 필드
    pgTransactionId: { type: 'string', maxLength: 100 },
    approvalNo: { type: 'string', maxLength: 20 },
    installmentMonths: { type: 'integer', minimum: 0, maximum: 36 },
    terminalId: { type: 'string', maxLength: 50 },
    cardBrand: { type: 'string', maxLength: 20 },
    cardType: { type: 'string', enum: ['CREDIT', 'DEBIT', 'PREPAID'] },
    cardIssuer: { type: 'string', maxLength: 50 },
    cardLast4: { type: 'string', pattern: '^[0-9]{4}$' },
    pgResponseCode: { type: 'string', maxLength: 10 },
    pgErrorMessage: { type: 'string', maxLength: 500 },
  },
};
```

---

## 7. 데이터 보관 기간

| 데이터 유형 | 보관 기간 | 근거 |
|------------|----------|------|
| 거래 기록 (sales) | **5년** | 전자상거래법, 세법 |
| 결제 증빙 | **5년** | 전자금융거래법 |
| 취소/환불 기록 | **5년** | 전자상거래법 |
| 분쟁 기록 | **3년** | 전자상거래법 |
| 로그 데이터 | **1년** | 내부 정책 |

### TTL 인덱스 설정 예시

```javascript
// 5년 TTL (sales 컬렉션에는 적용하지 않음 - 법적 보관 의무)
// 로그성 데이터에만 적용
db.paymentLogs.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 31536000 }  // 1년
);
```

---

## 8. 체크리스트

### 개발 시 확인사항

- [ ] 카드번호 전체를 어디에도 저장하지 않는가?
- [ ] CVC/CVV를 로그에도 남기지 않는가?
- [ ] 마스킹된 카드번호는 PG 응답값만 사용하는가?
- [ ] pgTransactionId를 저장하여 취소 가능한가?
- [ ] 승인번호(approvalNo)를 저장하는가?
- [ ] 실패 거래도 기록하는가?
- [ ] 환불 시 원본 금액을 스냅샷으로 보관하는가?

### 운영 시 확인사항

- [ ] 5년 이상 된 데이터 아카이빙 정책이 있는가?
- [ ] 결제 데이터 접근 권한이 제한되어 있는가?
- [ ] 결제 로그가 암호화되어 저장되는가?
- [ ] PG사 거래 내역과 정기적으로 대조하는가?

---

## 9. 참고 자료

- [PCI-DSS 공식 문서](https://www.pcisecuritystandards.org/)
- [전자상거래법](https://www.law.go.kr/)
- [전자금융거래법](https://www.law.go.kr/)
- [NICE 페이먼츠 개발 가이드](https://www.nicepay.co.kr/)

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2025-01-19 | 1.0 | 최초 작성 |
