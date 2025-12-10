# PhotoSignature MongoDB Schema

> **Version:** 8.0
> **Last Updated:** 2025-12-10

## Schema Validation

### sales Collection

```javascript
db.createCollection("sales", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["timestamp", "store", "device", "country", "amount", "currency", "amountKRW", "payment", "status", "product"],
      properties: {
        timestamp: { bsonType: "date" },
        store: {
          bsonType: "object",
          required: ["id", "name"],
          properties: {
            id: { bsonType: "string" },
            name: { bsonType: "string" },
            groupId: { bsonType: "string" },
            groupName: { bsonType: "string" }
          }
        },
        amount: { bsonType: "decimal", minimum: 0 },
        currency: { enum: ["KRW", "JPY", "USD", "VND"] },
        amountKRW: { bsonType: "decimal", minimum: 0 },
        status: { enum: ["COMPLETED", "FAILED", "REFUNDED"] },
        payment: {
          bsonType: "object",
          required: ["type"],
          properties: {
            type: { enum: ["CASH", "CARD"] }
          }
        },
        product: {
          bsonType: "object",
          required: ["type", "frameCategory"],
          properties: {
            type: { enum: ["PHOTO", "BEAUTY", "AI", "FORTUNE"] },
            frameCategory: { enum: ["3CUT", "4CUT", "6CUT", "8CUT"] }
          }
        },
        discount: {
          bsonType: "object",
          properties: {
            roulette: { bsonType: "decimal", minimum: 0 },
            coupon: { bsonType: "decimal", minimum: 0 }
          }
        }
      }
    }
  },
  validationLevel: "moderate",
  validationAction: "error"
})
```

### stores Collection

```javascript
db.createCollection("stores", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["_id", "name", "group", "country", "settlement"],
      properties: {
        _id: { bsonType: "string" },
        name: { bsonType: "string" },
        group: {
          bsonType: "object",
          required: ["id", "name", "grade"],
          properties: {
            grade: { enum: ["MASTER", "HIGH", "MID", "LOW"] }
          }
        },
        settlement: {
          bsonType: "object",
          required: ["serverFeeRate"],
          properties: {
            serverFeeRate: { bsonType: "number", minimum: 0, maximum: 1 }
          }
        }
      }
    }
  }
})
```

### popups Collection

```javascript
db.createCollection("popups", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["_id", "name", "status", "period", "countries", "revenueConfig"],
      properties: {
        status: { enum: ["SCHEDULED", "ACTIVE", "ENDED"] },
        countries: {
          bsonType: "array",
          minItems: 1,
          description: "Must contain at least one country code or 'ALL'"
        },
        revenueConfig: {
          bsonType: "object",
          required: ["storeRate", "corpRate", "licenseRate"],
          properties: {
            storeRate: { bsonType: "number", minimum: 0, maximum: 1 },
            corpRate: { bsonType: "number", minimum: 0, maximum: 1 },
            licenseRate: { bsonType: "number", minimum: 0, maximum: 1 }
          }
        }
      }
    }
  }
})
```

**Note:** `revenueConfig` rate sum validation (storeRate + corpRate + licenseRate = 1.0) is performed at the application level.

---

## Collections

### 1. `sales` - Sales Transactions (Core)

The main collection for all sales data. Exchange rate is calculated by kiosk at transaction time.

```javascript
{
  _id: ObjectId,

  timestamp: ISODate("2025-01-15T14:30:00Z"),

  // Store (embedded for fast queries without joins)
  store: {
    id: "STORE_001",
    name: "Gangnam Store",
    groupId: "GROUP_GANGNAM",
    groupName: "Gangnam Branch"
  },

  // Device
  device: {
    id: "KIOSK_001",
    name: "Gangnam_Unit1"
  },

  // Country (for filtering)
  country: {
    code: "JPN",
    name: "Japan"
  },

  // Amount (all monetary fields use Decimal128)
  amount: NumberDecimal("500"),
  currency: "JPY",
  exchangeRate: NumberDecimal("9.12"),
  amountKRW: NumberDecimal("4560"),
  rateDate: ISODate("2025-01-15"),
  rateSource: "FIREBASE",  // "FIREBASE" | "CACHED" | "API_FALLBACK"

  // Payment
  payment: {
    type: "CARD",
    receiptNo: "R20250115001",
    pgProvider: "NICE"
  },

  // Transaction Status
  status: "COMPLETED",  // "COMPLETED" | "FAILED" | "REFUNDED"
  failedAt: null,
  failReason: null,
  refundedAt: null,
  refundReason: null,
  refundedBy: null,

  // Refund snapshot (stored only on refund)
  refundSnapshot: null,  // { originalAmount, originalAmountKRW, originalStatus }

  // Discounts
  discount: {
    roulette: NumberDecimal("1000"),
    coupon: NumberDecimal("0"),
    couponCode: null
  },

  // Product
  product: {
    type: "PHOTO",  // "PHOTO" | "BEAUTY" | "AI" | "FORTUNE"
    frameId: "251210_new_frame01",
    frameCategory: "4CUT",
    printCount: 2,
    isAdditionalPrint: false
  },

  // Popup/Character (if applicable)
  popup: {
    id: "POPUP_KAKAO_2025",
    name: "Kakao Friends 2025",
    characterId: "RYAN",
    characterName: "Ryan",
    revenue: {
      storeRate: 0.30,
      corpRate: 0.50,
      licenseRate: 0.20
    }
  },

  // Service usage
  services: {
    beauty: { used: true, fee: NumberDecimal("500") },
    ai: { used: false, fee: NumberDecimal("0") }
  },

  createdAt: ISODate("2025-01-15T14:30:00Z"),
  updatedAt: ISODate("2025-01-15T14:30:00Z")
}
```

**Refund Snapshot Example:**
```javascript
{
  status: "REFUNDED",
  refundedAt: ISODate("2025-01-15T15:00:00Z"),
  refundReason: "Customer request",
  refundedBy: "admin@photosignature.com",
  refundSnapshot: {
    originalAmount: NumberDecimal("5000"),
    originalAmountKRW: NumberDecimal("5000"),
    originalStatus: "COMPLETED"
  }
}
```

**Failed Transaction Example:**
```javascript
{
  status: "FAILED",
  failedAt: ISODate("2025-01-15T14:30:05Z"),
  failReason: "Card declined",
  refundSnapshot: null
}
```

---

### 2. `stores` - Store Information

```javascript
{
  _id: "STORE_001",
  name: "Gangnam Store",

  group: {
    id: "GROUP_GANGNAM",
    name: "Gangnam Branch",
    grade: "MID"  // MASTER | HIGH | MID | LOW
  },

  country: {
    code: "KOR",
    name: "Korea",
    currency: "KRW"
  },

  owner: {
    phone: "010-1234-5678"
  },

  // Settlement config
  settlement: {
    serverFeeRate: 0.07,
    vatEnabled: true
  },

  devices: ["KIOSK_001", "KIOSK_002"],

  createdAt: ISODate("2024-01-01"),
  updatedAt: ISODate("2025-01-15")
}
```

---

### 3. `devices` - Device Information (Static Only)

Real-time status is managed in Firebase Realtime Database.

```javascript
{
  _id: "KIOSK_001",
  name: "Gangnam_Unit1",
  hddSerial: "ABC123",

  store: {
    id: "STORE_001",
    name: "Gangnam Store"
  },

  // Country info (synced from stores collection)
  country: {
    code: "KOR",
    name: "Korea",
    currency: "KRW"
  },

  programType: "SIGNATURE",

  createdAt: ISODate("2024-01-01"),
  updatedAt: ISODate("2025-01-15")
}
```

---

### 4. `popups` - Popup/Character/Event Management

```javascript
{
  _id: "POPUP_KAKAO_2025",
  name: "Kakao Friends New Year Event",

  character: {
    id: "RYAN",
    name: "Ryan",
    code: "KAKAO_RYAN"
  },

  // Status management
  status: "ACTIVE",  // "ACTIVE" | "ENDED" | "SCHEDULED"
  period: {
    start: ISODate("2025-01-01"),
    end: ISODate("2025-03-31")
  },
  endedAt: null,

  // Target regions
  countries: ["ALL"],  // ["ALL"] | ["KOR", "JPN", "VNM"]

  // Revenue config
  revenueConfig: {
    storeRate: 0.30,
    corpRate: 0.50,
    licenseRate: 0.20
  },

  // Discount config
  discountConfig: {
    type: "ROULETTE",  // "ROULETTE" | "COUPON" | "FIXED" | "NONE"
    rouletteRates: [0, 0.1, 0.2, 0.3],
    maxDiscount: NumberDecimal("2000")
  },

  // Pricing (with currency)
  pricing: {
    currency: "KRW",
    "3CUT": { price: NumberDecimal("4000"), printCount: 1 },
    "4CUT": { price: NumberDecimal("5000"), printCount: 2 },
    "6CUT": { price: NumberDecimal("6000"), printCount: 2 }
  },

  createdAt: ISODate("2025-01-01"),
  updatedAt: ISODate("2025-01-15")
}
```

**Status Management:**
- `SCHEDULED`: Upcoming popup (before period.start)
- `ACTIVE`: Currently running popup
- `ENDED`: Ended popup (endedAt records actual end time)
- **Admin manually changes status via management page**
- **All transitions allowed** (including re-opening: ENDED → ACTIVE)

---

### 5. `exchangeRates` - Exchange Rates (Reference/Audit)

```javascript
{
  _id: "2025-01-15",
  baseCurrency: "KRW",
  rates: {
    "KRW": 1,
    "JPY": 9.12,
    "USD": 1450.5,
    "VND": 0.054
  },
  source: "exchangerate-api",
  apiEndpoint: "https://api.exchangerate-api.com/v4/latest/KRW",
  fetchedAt: ISODate("2025-01-15T00:00:00Z")
}
```

---

### 6. `config` - System Configuration

```javascript
// Product types
{
  _id: "productTypes",
  values: {
    "PHOTO": "Photo",
    "BEAUTY": "Beauty",
    "AI": "AI",
    "FORTUNE": "Fortune"
  },
  updatedAt: ISODate("2025-01-15T10:00:00Z"),
  updatedBy: "admin@photosignature.com"
}

// Country codes
{
  _id: "countries",
  values: {
    "KOR": { name: "Korea", currency: "KRW" },
    "JPN": { name: "Japan", currency: "JPY" },
    "VNM": { name: "Vietnam", currency: "VND" },
    "USA": { name: "USA", currency: "USD" }
  },
  updatedAt: ISODate("2025-01-15T10:00:00Z"),
  updatedBy: "admin@photosignature.com"
}

// Server fee defaults
{
  _id: "serverFees",
  domestic: 0.07,
  overseas: 0.04,
  updatedAt: ISODate("2025-01-15T10:00:00Z"),
  updatedBy: "admin@photosignature.com"
}

// Exchange rate API config
{
  _id: "exchangeRateApi",
  provider: "exchangerate-api",
  endpoint: "https://api.exchangerate-api.com/v4/latest/KRW",
  updateFrequency: "daily",
  lastUpdated: ISODate("2025-01-15T00:00:00Z"),
  updatedAt: ISODate("2025-01-15T10:00:00Z"),
  updatedBy: "admin@photosignature.com"
}
```

---

## Index Summary

### sales Collection (4 indexes)

| Index | Purpose | Type |
|-------|---------|------|
| `{ timestamp: 1, "store.id": 1 }` | Daily sales by store | Compound |
| `{ timestamp: 1, "country.code": 1 }` | Domestic/overseas filter | Compound |
| `{ timestamp: 1, "country.code": 1, "popup.id": 1 }` | Popup sales | Compound |
| `{ "store.groupId": 1, timestamp: 1 }` | Group-level reporting | Compound |

```javascript
db.sales.createIndex({ timestamp: 1, "store.id": 1 })
db.sales.createIndex({ timestamp: 1, "country.code": 1 })
db.sales.createIndex({ timestamp: 1, "country.code": 1, "popup.id": 1 })
db.sales.createIndex({ "store.groupId": 1, timestamp: 1 })
```

### stores Collection (1 index)

| Index | Purpose | Type |
|-------|---------|------|
| `{ "country.code": 1 }` | Stores by country | Single |

```javascript
db.stores.createIndex({ "country.code": 1 })
```

### devices Collection (1 index)

| Index | Purpose | Type |
|-------|---------|------|
| `{ "store.id": 1 }` | Devices by store | Single |

```javascript
db.devices.createIndex({ "store.id": 1 })
```

### popups Collection (2 indexes)

| Index | Purpose | Type |
|-------|---------|------|
| `{ status: 1 }` | Active popup filter | Single |
| `{ "character.id": 1 }` | Character lookup | Single |

```javascript
db.popups.createIndex({ status: 1 })
db.popups.createIndex({ "character.id": 1 })
```

### Total: 8 indexes (optimized for write-heavy workload)

| Collection | Index Count |
|------------|-------------|
| sales | 4 |
| stores | 1 |
| devices | 1 |
| popups | 2 |
| **Total** | **8** |

### Index Storage Estimate

| Index Count | Additional Storage |
|------------|-------------------|
| 8 indexes total | ~1.6GB |
| M10 capacity | 10GB |
| **Available** | **~8.4GB for data** |

---

## Precision Note

### Decimal128 for Financial Data

All monetary fields use MongoDB `Decimal128` type for precise financial calculations.

**Why Decimal128?**
- JavaScript `Number` uses IEEE 754 floating point → precision errors
- `0.1 + 0.2 = 0.30000000000000004` in JavaScript
- Decimal128 provides 128-bit decimal precision → no floating point errors

**Decimal128 Fields:**

| Collection | Field | Description |
|------------|-------|-------------|
| sales | `amount` | Original amount in local currency |
| sales | `amountKRW` | Converted KRW amount |
| sales | `exchangeRate` | Exchange rate at transaction time |
| sales | `discount.roulette` | Roulette discount amount |
| sales | `discount.coupon` | Coupon discount amount |
| sales | `refundSnapshot.originalAmount` | Original amount before refund |
| sales | `refundSnapshot.originalAmountKRW` | Original KRW amount before refund |
| sales | `services.beauty.fee` | Beauty service fee |
| sales | `services.ai.fee` | AI service fee |
| popups | `discountConfig.maxDiscount` | Maximum discount amount |
| popups | `pricing.*.price` | Frame prices |

**Application Handling:**

```javascript
// 1. Saving: Convert to Decimal128
const { Decimal128 } = require('mongodb');
await db.sales.insertOne({
  amount: Decimal128.fromString("12.99"),
  amountKRW: Decimal128.fromString("18839.30"),
  exchangeRate: Decimal128.fromString("1450.50"),
  discount: {
    roulette: Decimal128.fromString("1000"),
    coupon: Decimal128.fromString("0")
  }
});

// 2. Reading: Convert to Number for display
const sale = await db.sales.findOne(...);
const displayAmount = Number(sale.amountKRW.toString());

// 3. Aggregation: MongoDB maintains Decimal128 precision
db.sales.aggregate([
  { $group: { _id: null, total: { $sum: "$amountKRW" } } }
]);
// → total is also Decimal128, precision maintained

// 4. Display formatting
displayAmount.toFixed(2)  // "18839.30"
```

**Currency Decimal Places:**

| Currency | Decimal Places | Example |
|----------|----------------|---------|
| KRW | 0 | 5000 |
| JPY | 0 | 500 |
| USD | 2 | 12.99 |
| VND | 0 | 50000 |
