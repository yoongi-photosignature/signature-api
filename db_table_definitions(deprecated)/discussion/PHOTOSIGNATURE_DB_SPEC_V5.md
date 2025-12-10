# PhotoSignature MongoDB Schema v5

> ⚠️ **Superseded by v6. See MONGODB_SCHEMA_V6.md**

> **Created:** 2025-12-10
> **Project:** PhotoSignature New System
> **Version:** 5.0 (v4 Review Applied)

## Overview

Photo kiosk management system database schema designed for MongoDB.
- **1000 devices** (scalable)
- **Write-heavy** workload (sales transactions)
- **Read: monthly settlement** and analytics

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    1000 Kiosk Devices                       │
│                (No direct MongoDB connection)               │
└───────────────────────────┬─────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
┌───────────────────┐ ┌─────────────┐ ┌─────────────────────────┐
│ Firebase RTDB     │ │ API Server  │ │ Firestore               │
│ (Real-time)       │ │  (2~3 ea)   │ │ (Design Assets)         │
├───────────────────┤ ├──────┬──────┤ ├─────────────────────────┤
│ • Online status   │ │      │      │ │ • Frame designs         │
│ • Paper quantity  │ │      ▼      │ │ • Background images     │
│ • Today's sales   │ │ ┌─────────┐ │ │ • Designer management   │
│ • Exchange rates  │ │ │MongoDB  │ │ │                         │
│   (cached)        │ │ │ (Main)  │ │ │                         │
│                   │ │ ├─────────┤ │ │                         │
│                   │ │ │• Sales  │ │ │                         │
│                   │ │ │• Stores │ │ │                         │
│                   │ │ │• Popups │ │ │                         │
│                   │ │ │• Devices│ │ │                         │
│                   │ │ └─────────┘ │ │                         │
└───────────────────┘ └─────────────┘ └─────────────────────────┘
     Blaze Plan           $57/mo           Already in use
     (~$5-20/mo)       (M10 Dedicated)
```

**Kiosk → MongoDB Connection Flow:**
```
┌──────────┐     HTTP      ┌──────────────┐   Connection   ┌──────────┐
│ Kiosk 1  │──────────────▶│              │     Pool       │          │
│ Kiosk 2  │──────────────▶│  API Server  │◀─────────────▶ │ MongoDB  │
│   ...    │──────────────▶│  (2~3 ea)    │  (200~300)     │   M10    │
│ Kiosk N  │──────────────▶│              │                │          │
└──────────┘               └──────────────┘                └──────────┘
   1000 ea                  Pool per server:               Max 1,500
 (no direct conn)           min 10, max 100               connections
```

### Why 3 Databases?

| DB | Role | Reason |
|----|------|--------|
| MongoDB | Sales, settlement, aggregation | Aggregation Pipeline, flexible schema |
| Firebase RTDB | Real-time status | WebSocket-based, frontend subscription |
| Firestore | Design assets | Already in use, designer page integration |

---

## Connection & Consistency Strategy

### Connection Pool (API Server → MongoDB)

Kiosks do not connect directly to MongoDB. They access it through API servers.

```javascript
// API Server MongoDB connection settings
const client = new MongoClient(uri, {
  maxPoolSize: 100,           // Max connections per server
  minPoolSize: 10,            // Min connections to maintain
  maxIdleTimeMS: 30000,       // Release idle connections after 30s
  waitQueueTimeoutMS: 10000,  // Connection wait timeout
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
});
```

**Connection Structure:**

| Component | Count | MongoDB Connections |
|-----------|-------|---------------------|
| Kiosks | 1000 ea | No direct connection (HTTP only) |
| API Servers | 2~3 ea | min 10, max 100 per server |
| **Total** | | **200~300** |
| M10 Limit | | 1,500 (sufficient headroom) |

**Why route through API Server?**
- Direct kiosk connection: 1000+ connections needed
- Via API server: 3 servers × 100 = max 300 connections
- Efficient connection pool reuse

### Read/Write Concern

```javascript
// 매출 데이터 쓰기 (중요 데이터)
db.sales.insertOne(doc, { writeConcern: { w: "majority" } })

// 정산 데이터 읽기 (정확성 필요)
db.sales.aggregate(pipeline, { readConcern: { level: "majority" } })

// 일반 조회 (기본값 사용)
db.sales.find(query)  // readConcern: "local" (default)
```

| 작업 | Concern | 이유 |
|------|---------|------|
| 매출 INSERT | `writeConcern: "majority"` | 데이터 손실 방지 |
| 정산 조회 | `readConcern: "majority"` | 정확한 집계 필요 |
| 일반 조회 | 기본값 (local) | 성능 우선 |

---

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
        amount: { bsonType: "number", minimum: 0 },
        currency: { enum: ["KRW", "JPY", "USD", "VND"] },
        amountKRW: { bsonType: "number", minimum: 0 },
        status: { enum: ["COMPLETED", "CANCELLED", "REFUNDED"] },
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
            type: { enum: ["PHOTO", "BEAUTY", "AR", "FORTUNE"] },
            frameCategory: { enum: ["3CUT", "4CUT", "6CUT", "8CUT"] }
          }
        }
      }
    }
  },
  validationLevel: "moderate",  // 기존 문서는 업데이트 시에만 검증
  validationAction: "error"     // 검증 실패 시 거부
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

---

## Collections

### 1. `sales` - Sales Transactions (Core)

The main collection for all sales data. Exchange rate is calculated by kiosk at transaction time.

```javascript
{
  _id: ObjectId,

  // v5: timestamp만 사용 (date 필드 제거)
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

  // Country (for filtering, currency removed - use sales.currency instead)
  country: {
    code: "JPN",                            // Country code (for filtering)
    name: "Japan"
  },

  // Amount (calculated by kiosk at transaction time)
  amount: 500,                              // Original amount (local currency)
  currency: "JPY",                          // Currency code
  exchangeRate: 9.12,                       // Rate at transaction time
  amountKRW: 4560,                          // Converted to KRW
  rateDate: ISODate("2025-01-15"),          // Rate date
  rateSource: "FIREBASE",                   // "FIREBASE" | "CACHED" (for audit)

  // Payment
  payment: {
    type: "CARD",                           // "CASH" | "CARD"
    receiptNo: "R20250115001",              // PG receipt number only
    pgProvider: "NICE"                      // PG provider name
  },

  // Transaction Status
  status: "COMPLETED",                      // "COMPLETED" | "CANCELLED" | "REFUNDED"
  cancelledAt: null,                        // Cancellation timestamp
  cancelReason: null,                       // Cancellation reason
  cancelledBy: null,                        // Who cancelled (email or system)

  // Discounts
  discount: {
    roulette: 1000,                         // Roulette discount amount
    coupon: 0,
    couponCode: null
  },

  // Product
  product: {
    type: "PHOTO",                          // "PHOTO" | "BEAUTY" | "AR" | "FORTUNE"
    frameId: "251210_new_frame01",          // Reference to Firestore
    frameCategory: "4CUT",                  // "3CUT" | "4CUT" | "6CUT" etc.
    printCount: 2,
    isAdditionalPrint: false
  },

  // Popup/Character (if applicable)
  // NOTE: No isActive field - check popups.status instead
  popup: {
    id: "POPUP_KAKAO_2025",
    name: "Kakao Friends 2025",
    characterId: "RYAN",
    characterName: "Ryan",

    // Revenue split (varies per popup)
    revenue: {
      storeRate: 0.30,
      corpRate: 0.50,
      licenseRate: 0.20,
      // Calculated amounts
      storeAmount: 1500,
      corpAmount: 2500,
      licenseAmount: 1000
    }
  },

  // Service usage
  services: {
    beauty: { used: true, fee: 500 },
    ar: { used: false, fee: 0 }
  },

  createdAt: ISODate("2025-01-15T14:30:00Z"),
  updatedAt: ISODate("2025-01-15T14:30:00Z")
}
```

**Indexes:**
```javascript
// v5: date → timestamp 변경
// Timestamp + Store (most common query)
db.sales.createIndex({ timestamp: 1, "store.id": 1 })

// Timestamp + Country (domestic/overseas filtering)
db.sales.createIndex({ timestamp: 1, "country.code": 1 })

// Timestamp + Country + Popup (overseas popup sales)
db.sales.createIndex({ timestamp: 1, "country.code": 1, "popup.id": 1 })

// Popup ID for $in queries (active popup lookup)
db.sales.createIndex({ "popup.id": 1, timestamp: 1 })

// Product type (Beauty/AR sales)
db.sales.createIndex({ timestamp: 1, "product.type": 1 })

// Status for cancelled/refunded queries
db.sales.createIndex({ status: 1, timestamp: 1 })

// Group-level reporting
db.sales.createIndex({ "store.groupId": 1, timestamp: 1 })
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
    grade: "MID"                            // MASTER | HIGH | MID | LOW
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
  // v5: Each store has its own rate (no isCustomRate flag)
  // Default rates (7% domestic, 4% overseas) are applied at store creation time
  settlement: {
    serverFeeRate: 0.07,                    // Store-specific rate
    vatEnabled: true
  },

  devices: ["KIOSK_001", "KIOSK_002"],      // Device list

  createdAt: ISODate("2024-01-01"),
  updatedAt: ISODate("2025-01-15")
}
```

**Indexes:**
```javascript
db.stores.createIndex({ "country.code": 1 })
db.stores.createIndex({ "group.id": 1 })
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

  // Country info for direct filtering
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

**Indexes:**
```javascript
db.devices.createIndex({ "store.id": 1 })
db.devices.createIndex({ "country.code": 1 })
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

  // Status management (source of truth for active/ended)
  // v5: 관리자가 관리페이지에서 수동 조작
  status: "ACTIVE",                         // "ACTIVE" | "ENDED" | "SCHEDULED"
  period: {
    start: ISODate("2025-01-01"),
    end: ISODate("2025-03-31")              // Planned end (actual end is manual)
  },
  endedAt: null,                            // Actual end timestamp (when status → ENDED)

  // Target regions
  // Use ["ALL"] for all countries instead of empty array
  countries: ["ALL"],                       // ["ALL"] | ["KOR", "JPN", "VNM"]

  // Revenue config (varies per popup)
  revenueConfig: {
    storeRate: 0.30,
    corpRate: 0.50,
    licenseRate: 0.20
  },

  // Discount config (varies per event)
  discountConfig: {
    type: "ROULETTE",                       // "ROULETTE" | "COUPON" | "FIXED" | "NONE"
    rouletteRates: [0, 0.1, 0.2, 0.3],
    maxDiscount: 2000
  },

  // Pricing (can vary per popup)
  pricing: {
    "3CUT": { price: 4000, printCount: 1 },
    "4CUT": { price: 5000, printCount: 2 },
    "6CUT": { price: 6000, printCount: 2 }
  },

  createdAt: ISODate("2025-01-01"),
  updatedAt: ISODate("2025-01-15")
}
```

**Status Management:**
- `SCHEDULED`: 예정된 팝업 (period.start 이전)
- `ACTIVE`: 진행 중인 팝업
- `ENDED`: 종료된 팝업 (endedAt에 실제 종료 시점 기록)
- **관리자가 관리페이지에서 수동으로 상태 변경**

**Indexes:**
```javascript
db.popups.createIndex({ status: 1 })
db.popups.createIndex({ "character.id": 1 })
db.popups.createIndex({ "period.end": 1, status: 1 })
db.popups.createIndex({ countries: 1, status: 1 })
```

---

### 5. `exchangeRates` - Exchange Rates (Reference/Audit)

Rates are fetched by server and cached to Firebase RTDB. This collection is for audit trail.

```javascript
{
  _id: "2025-01-15",                         // Date
  baseCurrency: "KRW",
  rates: {
    "KRW": 1,
    "JPY": 9.12,                            // 1 JPY = 9.12 KRW
    "USD": 1450.5,
    "VND": 0.054
  },
  source: "exchangerate-api",               // API provider
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
    "AR": "AR",
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

// Server fee defaults (used at store creation time)
{
  _id: "serverFees",
  domestic: 0.07,                           // 7% for Korea
  overseas: 0.04,                           // 4% for overseas
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

**Note:** Frame types are managed in Firestore (designer page). MongoDB only stores `frameId` reference.

---

## Firebase Realtime Database Structure

```javascript
{
  // Device real-time status
  "devices": {
    "KIOSK_001": {
      "online": true,
      "lastSeen": 1736945400000,
      "paperQty": 150,
      "paperAlert": false,
      "todaySales": {
        "date": "2025-01-15",
        "amount": 150000,
        "count": 30
      }
    }
  },

  // Exchange rates cache
  // Updated daily by server, subscribed by kiosks
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

**Exchange Rate Flow:**
```
┌─────────────┐     Daily        ┌─────────────────┐
│   Server    │ ───────────────> │ Firebase RTDB   │
│ (Scheduler) │   Fetch API      │ /exchangeRates  │
└─────────────┘   + Cache        └────────┬────────┘
                                          │
                                   Real-time Subscribe
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
              ┌──────────┐          ┌──────────┐          ┌──────────┐
              │ Kiosk 1  │          │ Kiosk 2  │   ...    │ Kiosk N  │
              └──────────┘          └──────────┘          └──────────┘
```

### Offline Exchange Rate Policy

When a kiosk cannot connect to Firebase RTDB:

1. **Local Cache:** Use the last successfully fetched exchange rate
2. **Cache Validity:** Accept cached rate up to 7 days old
3. **Fallback:** If cache > 7 days, reject overseas transactions (require network)
4. **Audit:** Store `rateSource: "CACHED"` in sales document when using cached rate

```javascript
// Kiosk local storage
{
  "exchangeRates": {
    "rates": { ... },
    "fetchedAt": 1736899200000,
    "source": "FIREBASE"        // "FIREBASE" | "CACHED"
  }
}
```

---

## Common Queries

### 1. Monthly Sales by Store

```javascript
db.sales.aggregate([
  { $match: {
    timestamp: { $gte: ISODate("2025-01-01"), $lt: ISODate("2025-02-01") },
    status: "COMPLETED"
  }},
  { $group: {
    _id: "$store.id",
    storeName: { $first: "$store.name" },
    shootCount: { $sum: 1 },
    totalAmount: { $sum: "$amountKRW" },
    cashAmount: {
      $sum: { $cond: [{ $eq: ["$payment.type", "CASH"] }, "$amountKRW", 0] }
    },
    cardAmount: {
      $sum: { $cond: [{ $eq: ["$payment.type", "CARD"] }, "$amountKRW", 0] }
    },
    rouletteDiscount: { $sum: "$discount.roulette" },
    couponDiscount: { $sum: "$discount.coupon" }
  }},
  { $sort: { totalAmount: -1 } }
])
```

### 2. Monthly Sales by Group

```javascript
db.sales.aggregate([
  { $match: {
    timestamp: { $gte: ISODate("2025-01-01"), $lt: ISODate("2025-02-01") },
    status: "COMPLETED"
  }},
  { $group: {
    _id: "$store.groupId",
    groupName: { $first: "$store.groupName" },
    storeCount: { $addToSet: "$store.id" },
    totalAmount: { $sum: "$amountKRW" },
    transactionCount: { $sum: 1 }
  }},
  { $addFields: {
    storeCount: { $size: "$storeCount" }
  }},
  { $sort: { totalAmount: -1 } }
])
```

### 3. Settlement Report (Domestic)

```javascript
db.sales.aggregate([
  { $match: {
    timestamp: { $gte: ISODate("2025-01-01"), $lt: ISODate("2025-02-01") },
    "country.code": "KOR",
    status: "COMPLETED"
  }},
  { $group: {
    _id: "$store.id",
    storeName: { $first: "$store.name" },
    revenue: { $sum: "$amountKRW" },
    popupRevenue: {
      $sum: { $cond: [{ $ne: ["$popup", null] }, "$amountKRW", 0] }
    },
    popupCorpAmount: { $sum: "$popup.revenue.corpAmount" },
    popupStoreAmount: { $sum: "$popup.revenue.storeAmount" },
    beautyFee: { $sum: "$services.beauty.fee" }
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
  }},
  { $project: { storeInfo: 0, serverFeeRate: 0 } }
])
```

### 4. Settlement Report (Overseas)

```javascript
db.sales.aggregate([
  { $match: {
    timestamp: { $gte: ISODate("2025-01-01"), $lt: ISODate("2025-02-01") },
    "country.code": { $ne: "KOR" },
    status: "COMPLETED"
  }},
  { $group: {
    _id: "$store.id",
    storeName: { $first: "$store.name" },
    country: { $first: "$country.code" },
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
  }},
  { $project: { storeInfo: 0, serverFeeRate: 0 } }
])
```

### 5. Active Popup Sales (Two-Step Query)

```javascript
// Step 1: Get active popup IDs from popups collection
const activePopups = await db.popups
  .find({ status: "ACTIVE" })
  .project({ _id: 1 })
  .toArray();

const activePopupIds = activePopups.map(p => p._id);

// Step 2: Query sales with $in (uses popup.id index)
db.sales.aggregate([
  { $match: {
    "popup.id": { $in: activePopupIds }
  }},
  { $group: {
    _id: "$popup.id",
    popupName: { $first: "$popup.name" },
    totalSales: { $sum: "$amountKRW" },
    count: { $sum: 1 }
  }}
])
```

### 6. Cancelled/Refunded Transactions

```javascript
db.sales.find({
  timestamp: { $gte: ISODate("2025-01-01"), $lt: ISODate("2025-02-01") },
  status: { $in: ["CANCELLED", "REFUNDED"] }
}).sort({ cancelledAt: -1 })
```

### 7. Character Sales Ranking

```javascript
db.sales.aggregate([
  { $match: {
    timestamp: { $gte: ISODate("2025-01-01") },
    "popup.characterId": { $ne: null },
    status: "COMPLETED"
  }},
  { $group: {
    _id: "$popup.characterId",
    characterName: { $first: "$popup.characterName" },
    totalSales: { $sum: "$amountKRW" },
    count: { $sum: 1 }
  }},
  { $sort: { totalSales: -1 } },
  { $limit: 10 }
])
```

---

## Security Considerations

### Payment Data

```javascript
// NEVER store
cardNo: "1234-5678-9012-3456"

// Store only PG receipt
payment: {
  type: "CARD",
  receiptNo: "R20250115001",    // PG receipt only
  pgProvider: "NICE"
}
```

### PCI DSS Compliance

| Item | Implementation |
|------|----------------|
| Card number | Not stored (delegated to PG) |
| Sensitive data | Encrypted in transit (TLS) |
| Access control | MongoDB Atlas role-based access |
| Audit logs | Atlas Activity Feed |

---

## Monitoring & Alerts

### Atlas 기본 모니터링 (추가 비용 없음)

M10 이상 클러스터에서 기본 제공되는 모니터링 기능 활용.

**Alert 설정:**

| 항목 | 임계치 | 알림 |
|------|--------|------|
| 연결 수 | 1000 connections | Warning |
| 저장소 사용량 | 9GB (90%) | Warning |
| CPU 사용률 | 80% | Warning |
| Query Targeting | 1000 scanned/returned ratio | Warning |

```javascript
// Atlas UI 또는 API로 Alert 설정
{
  "alertType": "CONNECTIONS_PERCENT",
  "threshold": 67,  // 1000/1500 = 67%
  "notifications": [{ "type": "EMAIL", "address": "admin@photosignature.com" }]
}
```

---

## Cost Estimation

| Item | Specification | Monthly Cost |
|------|--------------|--------------|
| MongoDB Atlas M10 | 10GB, 1500 connections | $57 |
| Firebase RTDB (Blaze) | 1000 devices, ~1GB | $5~20 |
| Firestore | Already in use | - |
| Atlas Monitoring | Basic (included) | $0 |
| **Total** | | **~$77/month** |

---

## Index Summary

### sales Collection (7 indexes)

| Index | Purpose | Type |
|-------|---------|------|
| `{ timestamp: 1, "store.id": 1 }` | Daily sales by store | Compound |
| `{ timestamp: 1, "country.code": 1 }` | Domestic/overseas filter | Compound |
| `{ timestamp: 1, "country.code": 1, "popup.id": 1 }` | Overseas popup sales | Compound |
| `{ "popup.id": 1, timestamp: 1 }` | Active popup lookup ($in) | Compound |
| `{ timestamp: 1, "product.type": 1 }` | Beauty/AR sales | Compound |
| `{ status: 1, timestamp: 1 }` | Cancelled/refunded | Compound |
| `{ "store.groupId": 1, timestamp: 1 }` | Group-level reporting | Compound |

### stores Collection (2 indexes)

| Index | Purpose | Type |
|-------|---------|------|
| `{ "country.code": 1 }` | Stores by country | Single |
| `{ "group.id": 1 }` | Stores by group | Single |

### devices Collection (2 indexes)

| Index | Purpose | Type |
|-------|---------|------|
| `{ "store.id": 1 }` | Devices by store | Single |
| `{ "country.code": 1 }` | Overseas device filter | Single |

### popups Collection (4 indexes)

| Index | Purpose | Type |
|-------|---------|------|
| `{ status: 1 }` | Active popup filter | Single |
| `{ "character.id": 1 }` | Character lookup | Single |
| `{ "period.end": 1, status: 1 }` | Expiring popups | Compound |
| `{ countries: 1, status: 1 }` | Country-specific popups | Compound |

### Total Index Count: 15

| Collection | Index Count |
|------------|-------------|
| sales | 7 |
| stores | 2 |
| devices | 2 |
| popups | 4 |
| **Total** | **15** |

### Index Storage Estimate

| Index Count | Additional Storage |
|------------|-------------------|
| 15 indexes total | ~3GB |
| M10 capacity | 10GB |
| **Available** | **~7GB for data** |

---

## Data Retention Policy

> **Note:** TTL Index 미적용. 별도 아카이빙 프로세스로 관리 예정.

| Data | Retention Period | Method |
|------|-----------------|--------|
| Sales (sales) | 5 years | 별도 아카이빙 후 삭제 (TODO) |
| Device logs | 1 year | 별도 아카이빙 후 삭제 (TODO) |
| Exchange rates | 3 years | Quarterly cleanup |

**TODO:**
- [ ] 5년 이상 데이터 아카이빙 스크립트 작성
- [ ] S3/GCS 등 Cold Storage 선택
- [ ] 아카이브 데이터 조회 방안 검토

---

## Migration Notes

### From Legacy (SQL Server)

| Legacy Table | MongoDB Collection | Notes |
|-------------|-------------------|-------|
| TB_MST001 | devices, stores | Split |
| TB_CAD001 | sales.payment | Embedded |
| TB_HIS003 | sales | Extended |
| TB_MST006 | popups | Restructured |
| TB_MST007 | exchangeRates | Changed to currency code |

### Breaking Changes from v4

| v4 | v5 | Reason |
|----|----|--------|
| `sales.date` + `sales.timestamp` | `sales.timestamp` only | 중복 제거, timestamp만으로 충분 |
| - | Schema Validation 추가 | 데이터 무결성 |
| - | Connection Pool 전략 추가 | 1000대 기기 대응 |
| - | Read/Write Concern 정의 | 일관성 전략 |
| - | Monitoring Alert 추가 | 운영 안정성 |
| 729 devices | 1000 devices | 확장성 고려 |

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-10 | v1.0 | Initial schema design |
| 2025-12-10 | v2.0 | Review applied: removed popup.isActive, added status field, exchange rate caching, security improvements |
| 2025-12-10 | v3.0 | Added updatedAt, device country, group index, offline rate policy, config audit fields, ALL countries |
| 2025-12-10 | v4.0 | Removed currency duplication, added rateSource/cancelledBy/endedAt, removed isCustomRate, fixed rateDate type, added popups countries index |
| 2025-12-10 | v5.0 | Removed date field (timestamp only), added Schema Validation, Connection Pool strategy, Read/Write Concern, Monitoring/Alert config |
