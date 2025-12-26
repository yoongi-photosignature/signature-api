# Signature API Reference

키오스크에서 사용 가능한 API 엔드포인트 목록입니다.

## Base URL
```
https://signature-api-yareqqxdwq-du.a.run.app
```

## 인증
모든 API 요청에 `x-api-key` 헤더가 필요합니다.
```
x-api-key: YOUR_API_KEY
```

---

## 공통 응답 형식

### 성공
```json
{
  "success": true,
  "data": { ... }
}
```

### 실패
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "에러 메시지"
  }
}
```

---

## 엔드포인트 목록

### 기본
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/` | API 정보 |
| GET | `/health` | 헬스 체크 |

### Sales (거래)
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/sales` | 신규 거래 기록 |
| GET | `/api/sales/:id` | 거래 조회 |
| PUT | `/api/sales/:id/refund` | 환불 처리 |

### Settlement (정산)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/settlement/monthly` | 월간 정산 |
| GET | `/api/settlement/domestic` | 국내 정산 |
| GET | `/api/settlement/overseas` | 해외 정산 |

### Exchange Rates (환율)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/exchange-rates` | 최신 환율 조회 |
| GET | `/api/exchange-rates/:date` | 특정 날짜 환율 조회 |

### Popups (팝업/이벤트)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/popups` | 팝업 목록 조회 |
| GET | `/api/popups/active` | 활성 팝업 조회 (키오스크용) |
| GET | `/api/popups/:id` | 팝업 상세 조회 |
| POST | `/api/popups` | 팝업 생성 |
| PUT | `/api/popups/:id` | 팝업 수정 |
| PUT | `/api/popups/:id/status` | 팝업 상태 변경 |
| DELETE | `/api/popups/:id` | 팝업 삭제 |

### Stores (매장)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/stores` | 매장 목록 조회 |
| GET | `/api/stores/:id` | 매장 상세 조회 |
| POST | `/api/stores` | 매장 생성 |
| PUT | `/api/stores/:id` | 매장 수정 |
| DELETE | `/api/stores/:id` | 매장 삭제 |

### Devices (기기)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/devices` | 기기 목록 조회 |
| GET | `/api/devices/:id` | 기기 상세 조회 |
| POST | `/api/devices` | 기기 등록 |
| PUT | `/api/devices/:id` | 기기 수정 |
| DELETE | `/api/devices/:id` | 기기 삭제 |

### Config (설정)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/config` | 전체 설정 조회 |
| GET | `/api/config/:key` | 특정 설정 조회 |
| PUT | `/api/config/:key` | 설정 수정 |

---

## Sales API

### POST /api/sales
신규 거래를 기록합니다.

**Request Body:**
```json
{
  "timestamp": "2024-12-26T14:30:00.000Z",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "transactionId": "TXN_20241226_001",
  "store": {
    "id": "store_001",
    "name": "강남점",
    "groupId": "group_001",
    "groupName": "서울그룹"
  },
  "kiosk": {
    "id": "kiosk_001",
    "name": "키오스크1"
  },
  "country": {
    "code": "KR",
    "name": "대한민국"
  },
  "amount": "5000",
  "currency": "KRW",
  "amountKRW": "5000",
  "rateDate": "2024-12-26",
  "payment": {
    "type": "CARD",
    "receiptNo": "RCP123456",
    "pgProvider": "NICE"
  },
  "product": {
    "type": "PHOTO",
    "frameDesign": "frame_001",
    "frameFormat": "4CUT",
    "printCount": 2,
    "isAdditionalPrint": false
  },
  "discount": {
    "roulette": "500",
    "coupon": "1000",
    "couponCode": "WELCOME2024"
  },
  "popup": {
    "id": "popup_001",
    "name": "크리스마스 이벤트",
    "characterId": "char_001",
    "characterName": "산타",
    "revenue": {
      "storeRate": 0.7,
      "corpRate": 0.2,
      "licenseRate": 0.1
    }
  },
  "services": {
    "beauty": { "used": true, "fee": "500" },
    "ai": { "used": false, "fee": "0" }
  }
}
```

**필수 필드:**
- `timestamp` (string, ISO 8601)
- `sessionId` (string, UUID v4): 세션 ID
- `transactionId` (string): 결제 트랜잭션 ID
- `store` (object): `id`, `name` 필수
- `kiosk` (object): `id`, `name` 필수
- `country` (object): `code` (2자리: KR, JP, US, VN), `name` 필수
- `amount` (string): 숫자 문자열
- `currency` (string): `KRW` | `JPY` | `USD` | `VND`
- `amountKRW` (string): 숫자 문자열
- `rateDate` (string, YYYY-MM-DD)
- `payment` (object): `type` 필수 (`CASH` | `CARD`)
- `product` (object): 모든 필드 필수
  - `type`: `PHOTO` | `BEAUTY` | `AI` | `FORTUNE`
  - `frameFormat`: `3CUT` | `4CUT` | `6CUT` | `8CUT`
  - `frameDesign`: 프레임 디자인 ID

**선택 필드:**
- `exchangeRate` (string): 환율 (기본값: "1")
- `rateSource` (string): `FIREBASE` | `CACHED` | `API_FALLBACK` (기본값: "FIREBASE")

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011"
  }
}
```

---

### GET /api/sales/:id
거래 상세 정보를 조회합니다.

**Path Parameters:**
- `id` (string): MongoDB ObjectId (24자리 hex)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "timestamp": "2024-12-26T14:30:00.000Z",
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "transactionId": "TXN_20241226_001",
    "store": { "id": "store_001", "name": "강남점" },
    "kiosk": { "id": "kiosk_001", "name": "키오스크1" },
    "country": { "code": "KR", "name": "대한민국" },
    "amount": "5000",
    "currency": "KRW",
    "exchangeRate": "1",
    "amountKRW": "5000",
    "rateDate": "2024-12-26",
    "rateSource": "FIREBASE",
    "payment": { "type": "CARD", "receiptNo": "RCP123456" },
    "status": "COMPLETED",
    "product": { "type": "PHOTO", "frameDesign": "frame_001", "frameFormat": "4CUT", ... },
    "createdAt": "2024-12-26T14:30:00.000Z",
    "updatedAt": "2024-12-26T14:30:00.000Z"
  }
}
```

**Error Codes:**
- `NOT_FOUND` (404): 거래를 찾을 수 없음

---

### PUT /api/sales/:id/refund
거래를 환불 처리합니다.

**Path Parameters:**
- `id` (string): MongoDB ObjectId (24자리 hex)

**Request Body:**
```json
{
  "reason": "고객 요청으로 인한 환불",
  "refundedBy": "admin_user_001"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "refunded": true
  }
}
```

**Error Codes:**
- `NOT_FOUND` (404): 거래를 찾을 수 없음
- `INVALID_STATUS` (400): COMPLETED 상태가 아닌 거래는 환불 불가

---

## Settlement API

### GET /api/settlement/monthly
월간 정산 데이터를 조회합니다.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| year | integer | Yes | 연도 (2020-2100) |
| month | integer | Yes | 월 (1-12) |
| storeId | string | No | 특정 매장 필터 |

**Example:**
```
GET /api/settlement/monthly?year=2024&month=12&storeId=store_001
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "storeId": "store_001",
      "storeName": "강남점",
      "completedAmount": "1500000",
      "refundedAmount": "50000",
      "netAmount": "1450000",
      "serverFee": "145000",
      "transactionCount": 300,
      "refundCount": 10
    }
  ],
  "meta": {
    "year": 2024,
    "month": 12,
    "storeId": "store_001",
    "count": 1
  }
}
```

---

### GET /api/settlement/domestic
국내(KOR) 정산 데이터를 조회합니다.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| year | integer | Yes | 연도 (2020-2100) |
| month | integer | Yes | 월 (1-12) |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "storeId": "store_001",
      "storeName": "강남점",
      "revenue": "1450000",
      "popupRevenue": "200000",
      "beautyFee": "50000",
      "serverFee": "145000",
      "transactionCount": 300
    }
  ],
  "meta": {
    "year": 2024,
    "month": 12,
    "country": "KOR",
    "count": 1
  }
}
```

---

### GET /api/settlement/overseas
해외 정산 데이터를 조회합니다.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| year | integer | Yes | 연도 (2020-2100) |
| month | integer | Yes | 월 (1-12) |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "storeId": "store_jp_001",
      "storeName": "도쿄점",
      "country": "JPN",
      "currency": "JPY",
      "localRevenue": "50000",
      "revenueKRW": "450000",
      "serverFee": "45000",
      "transactionCount": 100
    }
  ],
  "meta": {
    "year": 2024,
    "month": 12,
    "count": 1
  }
}
```

---

## Utility Endpoints

### GET /
API 기본 정보를 반환합니다.

**Response:**
```json
{
  "name": "PhotoSignature API",
  "version": "1.0.0",
  "endpoints": {
    "health": "/health",
    "sales": "/api/sales",
    "settlement": "/api/settlement"
  }
}
```

### GET /health
서버 상태를 확인합니다.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-12-10T14:30:00.000Z"
}
```

---

## Type Reference

### Currency
```typescript
type Currency = 'KRW' | 'JPY' | 'USD' | 'VND'
```

### PaymentType
```typescript
type PaymentType = 'CASH' | 'CARD'
```

### ProductType
```typescript
type ProductType = 'PHOTO' | 'BEAUTY' | 'AI' | 'FORTUNE'
```

### FrameFormat
```typescript
type FrameFormat = '3CUT' | '4CUT' | '6CUT' | '8CUT'
```

### SaleStatus
```typescript
type SaleStatus = 'COMPLETED' | 'FAILED' | 'REFUNDED'
```

### RateSource
```typescript
type RateSource = 'FIREBASE' | 'CACHED' | 'API_FALLBACK'
```

### PopupStatus
```typescript
type PopupStatus = 'SCHEDULED' | 'ACTIVE' | 'ENDED'
```

### GroupGrade
```typescript
type GroupGrade = 'MASTER' | 'HIGH' | 'MID' | 'LOW'
```

---

## Exchange Rates API

### GET /api/exchange-rates
최신 환율을 조회합니다. 키오스크 Firebase 캐시 만료 시 fallback으로 사용됩니다.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "date": "2024-12-10",
    "baseCurrency": "KRW",
    "rates": {
      "KRW": 1,
      "JPY": 9.12,
      "USD": 1450.5,
      "VND": 0.054
    },
    "source": "exchangerate-api",
    "fetchedAt": "2024-12-10T00:00:00.000Z"
  }
}
```

---

### GET /api/exchange-rates/:date
특정 날짜의 환율을 조회합니다.

**Path Parameters:**
- `date` (string): YYYY-MM-DD 형식

**Example:**
```
GET /api/exchange-rates/2024-12-10
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "date": "2024-12-10",
    "baseCurrency": "KRW",
    "rates": { ... },
    "source": "exchangerate-api",
    "fetchedAt": "2024-12-10T00:00:00.000Z"
  }
}
```

---

## Popups API

### GET /api/popups
팝업 목록을 조회합니다.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | string | No | SCHEDULED, ACTIVE, ENDED |

**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "meta": { "count": 10 }
}
```

---

### GET /api/popups/active
현재 활성 팝업을 조회합니다. 키오스크에서 사용합니다.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "POPUP_KAKAO_2025",
      "name": "Kakao Friends 2025",
      "character": { "id": "RYAN", "name": "Ryan", "code": "KAKAO_RYAN" },
      "status": "ACTIVE",
      "period": { "start": "2025-01-01", "end": "2025-03-31" },
      "countries": ["ALL"],
      "revenueConfig": { "storeRate": 0.3, "corpRate": 0.5, "licenseRate": 0.2 },
      "discountConfig": { "type": "ROULETTE", "rouletteRates": [0, 0.1, 0.2, 0.3], "maxDiscount": 2000 },
      "pricing": { "4CUT": { "price": 5000, "printCount": 2 } }
    }
  ],
  "meta": { "count": 1 }
}
```

---

### POST /api/popups
팝업을 생성합니다.

**Request Body:**
```json
{
  "_id": "POPUP_KAKAO_2025",
  "name": "Kakao Friends 2025",
  "character": { "id": "RYAN", "name": "Ryan", "code": "KAKAO_RYAN" },
  "status": "SCHEDULED",
  "period": { "start": "2025-01-01", "end": "2025-03-31" },
  "countries": ["ALL"],
  "revenueConfig": { "storeRate": 0.3, "corpRate": 0.5, "licenseRate": 0.2 }
}
```

**Response (201):**
```json
{
  "success": true,
  "data": { "id": "POPUP_KAKAO_2025" }
}
```

---

### PUT /api/popups/:id/status
팝업 상태를 변경합니다.

**Request Body:**
```json
{
  "status": "ACTIVE"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { "status": "ACTIVE" }
}
```

---

## Stores API

### GET /api/stores
매장 목록을 조회합니다.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| country | string | No | 국가 코드 (KOR, JPN, ...) |
| groupId | string | No | 그룹 ID |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "STORE_001",
      "name": "강남점",
      "group": { "id": "GROUP_GANGNAM", "name": "강남지점", "grade": "MID" },
      "country": { "code": "KOR", "name": "Korea", "currency": "KRW" },
      "settlement": { "serverFeeRate": 0.07, "vatEnabled": true },
      "devices": ["KIOSK_001", "KIOSK_002"]
    }
  ],
  "meta": { "count": 1 }
}
```

---

### POST /api/stores
매장을 생성합니다.

**Request Body:**
```json
{
  "_id": "STORE_001",
  "name": "강남점",
  "group": { "id": "GROUP_GANGNAM", "name": "강남지점", "grade": "MID" },
  "country": { "code": "KOR", "name": "Korea", "currency": "KRW" },
  "settlement": { "serverFeeRate": 0.07, "vatEnabled": true }
}
```

**Response (201):**
```json
{
  "success": true,
  "data": { "id": "STORE_001" }
}
```

---

## Devices API

### GET /api/devices
기기 목록을 조회합니다.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| storeId | string | No | 매장 ID |
| country | string | No | 국가 코드 |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "KIOSK_001",
      "name": "강남_1호기",
      "hddSerial": "ABC123",
      "store": { "id": "STORE_001", "name": "강남점" },
      "country": { "code": "KOR", "name": "Korea", "currency": "KRW" },
      "programType": "SIGNATURE"
    }
  ],
  "meta": { "count": 1 }
}
```

---

### POST /api/devices
기기를 등록합니다.

**Request Body:**
```json
{
  "_id": "KIOSK_001",
  "name": "강남_1호기",
  "hddSerial": "ABC123",
  "store": { "id": "STORE_001", "name": "강남점" },
  "country": { "code": "KOR", "name": "Korea", "currency": "KRW" },
  "programType": "SIGNATURE"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": { "id": "KIOSK_001" }
}
```

---

## Config API

### GET /api/config
전체 설정을 조회합니다.

**Response (200):**
```json
{
  "success": true,
  "data": [
    { "_id": "productTypes", "values": { "PHOTO": "Photo", "BEAUTY": "Beauty" }, "updatedAt": "...", "updatedBy": "admin" },
    { "_id": "serverFees", "domestic": 0.07, "overseas": 0.04, "updatedAt": "...", "updatedBy": "admin" }
  ],
  "meta": { "count": 2 }
}
```

---

### GET /api/config/:key
특정 설정을 조회합니다.

**Path Parameters:**
- `key` (string): 설정 키 (productTypes, countries, serverFees, exchangeRateApi)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "serverFees",
    "domestic": 0.07,
    "overseas": 0.04,
    "updatedAt": "2024-12-10T10:00:00.000Z",
    "updatedBy": "admin@photosignature.com"
  }
}
```

---

### PUT /api/config/:key
설정을 수정합니다. 존재하지 않으면 생성됩니다.

**Request Body:**
```json
{
  "domestic": 0.08,
  "overseas": 0.05,
  "updatedBy": "admin@photosignature.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { "key": "serverFees", "updated": true }
}
```
